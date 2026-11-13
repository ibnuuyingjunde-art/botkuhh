import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { saluranCtx } from "./ichigo-context.js";
import {
  delay,
  DisconnectReason,
  generateWAMessageContent,
  jidNormalizedUser,
  useMultiFileAuthState,
} from "ichigo";
import { logger } from "./ichigo-logger.js";
import { addJadibotOwner } from "./ichigo-jadibot-database.js";
import { extendSocket } from "./ichigo-socket.js";
import { getAssetBuffer } from "./ichigo-asset-manager.js";
import { hasJadibotAccess, getJadibotAccessInfo } from "./ichigo-jadibot-access.js";
import { isJadibotPaymentEnforced } from "./ichigo-jadibot-plans.js";
import { getDatabase } from "./ichigo-database.js";
import config from "../../config.js";
import { sendBatchPrivateRelayUnified } from "../spr/sbpr.js";
import { setBounded } from "./ichigo-bounded.js";
import { bindAlbumCollector } from "./ichigo-album-collector.js";
const JADIBOT_AUTH_FOLDER = path.join(process.cwd(), "session", "jadibot");
const jadibotSessions = new Map();
const reconnectAttempts = new Map();
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_INTERVAL = 5000;

const pendingStarts = new Map();
const cancelledStarts = new Set();
const PENDING_START_TIMEOUT_MS = 2 * 60 * 1000; // bug fix: pending yang macet >2 menit dibersihkan otomatis
const VERSION_FETCH_TIMEOUT_MS = 15000; // bug fix: fetchLatestBaileysVersion tidak punya timeout bawaan

function isJadibotPending(jid) {
  const id = jid.replace(/@.+/g, "");
  return pendingStarts.has(id);
}

// bug fix: watchdog agar pendingStarts yang macet (mis. jaringan server timeout saat
// fetchLatestBaileysVersion / useMultiFileAuthState) tidak mengunci nomor selamanya.
const pendingWatchdog = setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pendingStarts) {
    if (now - (p.startedAt || 0) > PENDING_START_TIMEOUT_MS) {
      logger.warn(
        "Jadibot",
        `${id}: pending start macet lebih dari ${PENDING_START_TIMEOUT_MS / 1000}s, dibersihkan otomatis`,
      );
      try {
        p.sock?.ev?.removeAllListeners?.();
        p.sock?.ws?.close?.();
      } catch { }
      pendingStarts.delete(id);
      cancelledStarts.delete(id);
    }
  }
}, 30000);
if (pendingWatchdog.unref) pendingWatchdog.unref();

if (!fs.existsSync(JADIBOT_AUTH_FOLDER)) {
  fs.mkdirSync(JADIBOT_AUTH_FOLDER, { recursive: true });
}

function getJadibotAuthPath(jid) {
  const id = jid.replace(/@.+/g, "");
  return path.join(JADIBOT_AUTH_FOLDER, id);
}

function isJadibotActive(jid) {
  const id = jid.replace(/@.+/g, "");
  return jadibotSessions.has(id);
}

// bug fix: sebelumnya tidak ada fungsi apapun untuk menghitung jadibot per
// pemilik atau total di seluruh sistem, jadi tidak ada cara untuk menegakkan
// jadibotMaxPerOwner/jadibotMaxTotal (lihat config.js). Dipakai di
// plugins/main/jadibot.js sebelum memulai sesi baru.
function countActiveJadibotsByOwner(ownerJid) {
  const ownerNum = String(ownerJid || "").replace(/[^0-9]/g, "");
  if (!ownerNum) return 0;

  let count = 0;
  for (const session of jadibotSessions.values()) {
    const num = String(session.ownerJid || "").replace(/[^0-9]/g, "");
    if (num === ownerNum) count++;
  }
  for (const pending of pendingStarts.values()) {
    const num = String(pending.ownerJid || "").replace(/[^0-9]/g, "");
    if (num === ownerNum) count++;
  }
  return count;
}

function countAllActiveJadibots() {
  // pendingStarts dan jadibotSessions memakai key (nomor) yang sama untuk sesi
  // yang sama, dan pendingStarts selalu dihapus begitu sesi masuk ke
  // jadibotSessions (lihat connection === "open"), jadi keduanya tidak pernah
  // saling tumpang tindih untuk id yang sama.
  return jadibotSessions.size + pendingStarts.size;
}

function getActiveJadibots() {
  return Array.from(jadibotSessions.entries()).map(([id, data]) => ({
    id,
    jid: id + "@s.whatsapp.net",
    ...data,
  }));
}

function getAllJadibotSessions() {
  const sessions = [];
  if (!fs.existsSync(JADIBOT_AUTH_FOLDER)) return sessions;

  const dirs = fs.readdirSync(JADIBOT_AUTH_FOLDER);
  for (const dir of dirs) {
    const credsPath = path.join(JADIBOT_AUTH_FOLDER, dir, "creds.json");
    if (fs.existsSync(credsPath)) {
      sessions.push({
        id: dir,
        jid: dir + "@s.whatsapp.net",
        isActive: jadibotSessions.has(dir),
        credsPath,
      });
    }
  }
  return sessions;
}

const JADIBOT_STORE_TTL = 10 * 60 * 1000; 

function createJadibotStore() {
  const storeObj = {
    messages: new Map(),
    _cleanupTimer: null,
    chats: new Map(),
    contacts: {},
    bind(ev) {
      ev.on("messages.upsert", ({ messages }) => {
        for (const msg of messages || []) {
          const jid = msg.key?.remoteJid;
          if (!jid) continue;
          if (!this.messages.has(jid)) this.messages.set(jid, new Map());
          const chat = this.messages.get(jid);
          if (msg.key?.id) {
            chat.set(msg.key.id, { msg, cachedAt: Date.now() });
            if (chat.size > 200) {
              const keys = [...chat.keys()];
              for (let i = 0; i < keys.length - 150; i++) chat.delete(keys[i]);
            }
          }
          if (!this.chats.has(jid)) {
            setBounded(this.chats, jid, { id: jid }, 2000);
          }
          if (msg.pushName && jid.endsWith("@s.whatsapp.net")) {
            this.contacts[jid] = {
              ...this.contacts[jid],
              notify: msg.pushName,
            };
          }
        }
      });
      ev.on("chats.upsert", (chats) => {
        for (const chat of chats || []) {
          if (chat.id) setBounded(this.chats, chat.id, chat, 2000);
        }
      });
      ev.on("contacts.upsert", (contacts) => {
        for (const contact of contacts || []) {
          if (contact.id) {
            this.contacts[contact.id] = {
              ...this.contacts[contact.id],
              ...contact,
            };
          }
        }
      });
    },
    async loadMessage(jid, id) {
      const entry = this.messages.get(jid)?.get(id);
      if (!entry) return undefined;
      if (Date.now() - entry.cachedAt > JADIBOT_STORE_TTL) {
        this.messages.get(jid)?.delete(id);
        return undefined;
      }
      return entry.msg;
    },
    cleanupExpiredMessages() {
      const now = Date.now();
      for (const [jid, chat] of this.messages) {
        for (const [id, entry] of chat) {
          if (now - entry.cachedAt > JADIBOT_STORE_TTL) chat.delete(id);
        }
        if (chat.size === 0) this.messages.delete(jid);
      }
    },
  };

  storeObj._cleanupTimer = setInterval(
    () => storeObj.cleanupExpiredMessages(),
    5 * 60 * 1000,
  );
  if (storeObj._cleanupTimer.unref) storeObj._cleanupTimer.unref();

  return storeObj;
}

const rateLimit = new Map();

const ERROR_MESSAGES = {
  [DisconnectReason.loggedOut]: {
    reason: "Logged out dari WhatsApp",
    action: "Akun di-logout dari perangkat, perlu scan ulang QR/pairing",
    fatal: true,
  },
  [DisconnectReason.badSession]: {
    reason: "Session rusak (bad session / bad MAC)",
    action: "Session korup, akan dihapus dan perlu scan ulang",
    fatal: true,
  },
  [DisconnectReason.connectionClosed]: {
    reason: "Koneksi ditutup",
    action: "Kejadian normal, akan mencoba reconnect",
    fatal: false,
  },
  [DisconnectReason.connectionLost]: {
    reason: "Koneksi terputus / timeout",
    action: "Jaringan tidak stabil, akan mencoba reconnect",
    fatal: false,
  },
  [DisconnectReason.connectionReplaced]: {
    reason: "Session dipakai di perangkat lain",
    action: "Login ulang di perangkat lain akan mengganti session ini",
    fatal: true,
  },
  [DisconnectReason.restartRequired]: {
    reason: "Restart diperlukan",
    action: "Bagian normal dari proses login, akan restart otomatis",
    fatal: false,
  },
  [DisconnectReason.multideviceMismatch]: {
    reason: "Multi-device mismatch",
    action: "Session tidak valid untuk device ini, perlu scan ulang",
    fatal: true,
  },
  [DisconnectReason.forbidden]: {
    reason: "Akses ditolak / kemungkinan banned",
    action: "Nomor ini mungkin terkena banned WhatsApp",
    fatal: true,
  },
  [DisconnectReason.unavailableService]: {
    reason: "Layanan tidak tersedia",
    action: "WhatsApp sedang bermasalah, akan mencoba reconnect",
    fatal: false,
  },

  405: {
    reason: "Metode tidak diizinkan",
    action: "Coba lagi nanti",
    fatal: true,
  },
  406: {
    reason: "Nomor dibatasi",
    action: "Nomor ini dibatasi oleh WhatsApp, tunggu beberapa jam",
    fatal: true,
  },
  409: {
    reason: "Konflik session",
    action: "Session sedang digunakan di device lain",
    fatal: true,
  },
  501: {
    reason: "Tidak diimplementasi",
    action: "Fitur belum didukung",
    fatal: true,
  },
};

const CONNECTION_CLOSED_REASONS = [
  {
    match: /Connection Closed/i,
    reason: "Koneksi ditutup",
    action: "Kemungkinan nomor dibanned atau ada masalah jaringan",
    fatal: true,
  },
  {
    match: /write EOF/i,
    reason: "Koneksi terputus",
    action: "Masalah jaringan, akan mencoba reconnect",
    fatal: false,
  },
  {
    match: /ECONNRESET/i,
    reason: "Reset koneksi",
    action: "Jaringan tidak stabil",
    fatal: false,
  },
  {
    match: /ETIMEDOUT/i,
    reason: "Timeout",
    action: "Koneksi lambat",
    fatal: false,
  },
  {
    match: /logged out/i,
    reason: "Logged out",
    action: "Akun di-logout dari perangkat",
    fatal: true,
  },
  {
    match: /replaced/i,
    reason: "Session replaced",
    action: "Login di perangkat lain",
    fatal: true,
  },
  {
    match: /Multidevice mismatch/i,
    reason: "Session tidak valid",
    action: "Perlu scan ulang",
    fatal: true,
  },
  {
    match: /restart required/i,
    reason: "Restart diperlukan",
    action: "Akan restart otomatis",
    fatal: false,
  },
  {
    match: /bad session/i,
    reason: "Session rusak",
    action: "Perlu scan ulang",
    fatal: true,
  },
];

function parseDisconnectError(lastDisconnect) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const errorMessage = lastDisconnect?.error?.message || "Unknown error";

  if (statusCode && ERROR_MESSAGES[statusCode]) {
    return {
      ...ERROR_MESSAGES[statusCode],
      code: statusCode,
      message: errorMessage,
    };
  }

  for (const pattern of CONNECTION_CLOSED_REASONS) {
    if (pattern.match.test(errorMessage)) {
      return {
        code: statusCode || "N/A",
        reason: pattern.reason,
        action: pattern.action,
        fatal: pattern.fatal,
        message: errorMessage,
      };
    }
  }

  return {
    code: statusCode || "N/A",
    reason: "Error tidak dikenal",
    action: "Hubungi admin jika berulang",
    fatal: false,
    message: errorMessage,
  };
}

function isSocketAlive(sock) {
  try {
    if (!sock) return false;
    if (sock.ws && sock.ws.readyState === 1) return true;
    if (sock.user?.id) return true;
    return false;
  } catch {
    return false;
  }
}

function isSessionCorruptionError(e) {
  const msg = (e?.message || "").toLowerCase();
  return (
    msg.includes("bad mac") ||
    msg.includes("failed to decrypt") ||
    msg.includes("no matching sessions") ||
    msg.includes("no session found") ||
    msg.includes("session error") ||
    msg.includes("invalid pretext")
  );
}

const SESSION_CORRUPTION_THRESHOLD = 3;
const SESSION_CORRUPTION_WINDOW_MS = 2 * 60 * 1000;
const sessionCorruptionCounts = new Map();

function noteSessionCorruption(id) {
  const now = Date.now();
  const entry = sessionCorruptionCounts.get(id) || { count: 0, firstAt: now };
  if (now - entry.firstAt > SESSION_CORRUPTION_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }
  entry.count += 1;
  sessionCorruptionCounts.set(id, entry);
  return entry.count;
}

async function safeSend(sock, jid, content, options = {}) {
  try {
    if (!jid) return null;
    if (!isSocketAlive(sock)) return null;
    return await sock.sendMessage(jid, content, options);
  } catch {
    return null;
  }
}

// Notif status jadibot (terhubung/putus/reconnect/berhenti/sesi korup) dikirim
// ke grup info (config.jadibotNotif.groupId, diset lewat .setidgcinfobot)
// via sBPR (private relay, sama seperti plugin bisik): isi notif hanya
// diterima nomor jadibot, pemilik jadibot, dan owner bot (config.owner.number).
// Syarat: bot utama dan penerima di atas harus member grup tsb.
// Fire-and-forget supaya alur reconnect tidak ikut tertahan.
// QR & pairing code dikirim terpisah (lihat sendSecretToRunner). Tidak ada lagi notif jadibot ke PM.
function sendStatusNotif(sock, content) {
  const gc = config.jadibotNotif?.groupId;
  if (typeof gc !== "string" || !gc.endsWith("@g.us")) {
    logger.warn(
      "Jadibot",
      "Notif status jadibot dilewati: grup info belum di-set (.setidgcinfobot)",
    );
    return;
  }
  if (!isSocketAlive(sock)) return;

  const mentioned = Array.isArray(content?.mentions) ? content.mentions : [];

  // Target: nomor jadibot (dari mentions) + pemilik jadibot (kalau sesinya masih
  // tercatat) + owner bot dari config.
  const targets = new Set(mentioned.filter(Boolean));
  for (const num of config.owner?.number || []) {
    const clean = String(num).replace(/[^0-9]/g, "");
    if (clean) targets.add(`${clean}@s.whatsapp.net`);
  }
  for (const jid of mentioned) {
    const id = String(jid).replace(/@.+/g, "");
    const owner =
      jadibotSessions.get(id)?.ownerJid || pendingStarts.get(id)?.ownerJid;
    if (owner && String(owner).includes("@s.whatsapp.net")) targets.add(owner);
  }
  if (!targets.size) return;

  const payload = {
    extendedTextMessage: {
      text: content.text || "",
      contextInfo: { mentionedJid: mentioned },
    },
  };

  sendBatchPrivateRelayUnified(sock, gc, [...targets], payload, {
    verbose: false,
  }).catch((e) => {
    logger.warn("Jadibot", `Notif sBPR gagal dikirim: ${e?.message || e}`);
  });
}

// QR & pairing code: kalau command dijalankan di grup, dikirim via sBPR dan hanya
// bisa dilihat oleh yang menjalankan command (m.sender). Di chat pribadi tetap
// pakai kirim biasa (sudah privat). Kalau sBPR gagal, kode TIDAK dikirim terbuka
// ke grup. Return true kalau sudah ditangani lewat sBPR.
async function sendSecretToRunner(sock, m, content) {
  if (!m?.chat?.endsWith?.("@g.us") || !m?.sender) return false;
  try {
    const proto = content.image
      ? await generateWAMessageContent(
          { image: content.image, caption: content.caption || "" },
          { upload: sock.waUploadToServer },
        )
      : { extendedTextMessage: { text: content.text || "" } };
    await sendBatchPrivateRelayUnified(sock, m.chat, [m.sender], proto, {
      verbose: false,
    });
  } catch (e) {
    logger.warn("Jadibot", `Kirim QR/pairing via sBPR gagal: ${e?.message || e}`);
    await safeSend(sock, m.chat, {
      text: "❌ Gagal mengirim kode secara privat. Coba lagi beberapa saat.",
    });
  }
  return true;
}

async function startJadibot(sock, m, userJid, usePairing = true) {
  if (
    !userJid ||
    typeof userJid !== "string" ||
    !userJid.includes("@s.whatsapp.net")
  ) {
    throw new Error("Invalid User JID");
  }

  const id = userJid.replace(/@.+/g, "");

  if (usePairing) {
    const lastAttempt = rateLimit.get(id) || 0;
    if (Date.now() - lastAttempt < 60000) {
      throw new Error("Tunggu 1 menit sebelum mencoba lagi.");
    }
    rateLimit.set(id, Date.now());
  }

  const authPath = getJadibotAuthPath(userJid);

  if (jadibotSessions.has(id) || pendingStarts.has(id)) {
    throw new Error(
      "Jadibot sudah aktif atau sedang dalam proses konek untuk nomor ini!",
    );
  }

  // bug fix: ownerJid disimpan juga di pendingStarts (bukan cuma di session
  // yang sudah connected) supaya countActiveJadibotsByOwner bisa ikut
  // menghitung proses start yang masih berjalan, mencegah race saat user
  // spam `.jadibot <nomor berbeda>` berkali-kali sebelum satupun konek.
  pendingStarts.set(id, { startedAt: Date.now(), ownerJid: m?.sender || userJid });
  cancelledStarts.delete(id);

  let childSock;
  let childStore;
  let saveCreds;
  let state;
  try {
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    const authState = await useMultiFileAuthState(authPath);
    state = authState.state;
    saveCreds = authState.saveCreds;

    // bug fix: jika user memanggil stopjadibot() saat proses ini masih di tahap
    // "pending" (belum sempat membuat childSock), hentikan di sini alih-alih
    // melanjutkan dan membuat sesi yang seharusnya sudah dibatalkan.
    if (cancelledStarts.has(id)) {
      cancelledStarts.delete(id);
      pendingStarts.delete(id);
      throw new Error("Dibatalkan oleh pengguna");
    }

    const {
      default: makeWASocket,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
    } = await import("ichigo");
    const version = await Promise.race([
      fetchLatestBaileysVersion().then((v) => v.version),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout mengambil versi Baileys, cek koneksi internet server")),
          VERSION_FETCH_TIMEOUT_MS,
        ),
      ),
    ]);
    const pinoModule = await import("pino");
    const pinoLogger = pinoModule.default({ level: "silent" });
    childStore = createJadibotStore();
    const groupMetadataCache = new Map();

    childSock = makeWASocket({
    version,
    logger: pinoLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
    },
    browser: ["Ubuntu", "Chrome", "20.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: 20000,
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 150,
    getMessage: async (key) => {
      return (await childStore.loadMessage(key.remoteJid, key.id))?.message;
    },
    cachedGroupMetadata: async (jid) => {
      const cached = groupMetadataCache.get(jid);
      if (cached) return cached;
      try {
        const fresh = await childSock.groupMetadata(jid);
        groupMetadataCache.set(jid, fresh);
        return fresh;
      } catch {
        return undefined;
      }
    },
    fireInitQueries: true,
    emitOwnEvents: true,
    shouldSyncHistoryMessage: () => false,
    transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 500 },
  });
  } catch (e) {

    pendingStarts.delete(id);
    throw e;
  }

  // bug fix: cek pembatalan lagi setelah childSock berhasil dibuat, sebelum lanjut
  // memasang listener/permintaan pairing code — mencegah sesi "hantu" yang tetap
  // terhubung padahal sudah diminta berhenti.
  if (cancelledStarts.has(id)) {
    cancelledStarts.delete(id);
    pendingStarts.delete(id);
    try {
      childSock.ev?.removeAllListeners?.();
      childSock.ws?.close?.();
    } catch { }
    throw new Error("Dibatalkan oleh pengguna");
  }

  // bug fix: overwrite sebelumnya menghapus ownerJid yang sudah diset di awal
  // (lihat pendingStarts.set pertama), sehingga countActiveJadibotsByOwner bisa
  // salah hitung begitu proses start sampai tahap ini. Gabung, jangan timpa.
  pendingStarts.set(id, {
    ...(pendingStarts.get(id) || {}),
    startedAt: Date.now(),
    sock: childSock,
  });

  childStore.bind(childSock.ev);
  bindAlbumCollector(childSock.ev);
  childSock.store = childStore;
  await extendSocket(childSock);

  function scheduleReconnect(reasonLabel) {
    const attempts = reconnectAttempts.get(id) || 0;

    try {
      childSock.ev?.removeAllListeners?.();
    } catch { }
    try {
      childSock.ws?.close?.();
    } catch { }
    jadibotSessions.delete(id);

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts.delete(id);
      pendingStarts.delete(id);
      logger.warn(
        "Jadibot",
        `${id} gagal reconnect ${MAX_RECONNECT_ATTEMPTS}x (${reasonLabel}), berhenti mencoba`,
      );
      sendStatusNotif(sock, {
        text:
          `❌ *ᴊᴀᴅɪʙᴏᴛ ʙᴇʀʜᴇɴᴛɪ*\n\n` +
          `> 📱 Nomor: *@${id}*\n` +
          `> Gagal reconnect ${MAX_RECONNECT_ATTEMPTS}x berturut-turut\n` +
          `> Ketik \`.jadibot\` untuk memulai ulang`,
        mentions: [userJid],
      });
      return;
    }

    reconnectAttempts.set(id, attempts + 1);
    pendingStarts.set(id, { startedAt: Date.now(), reconnecting: true });

    setTimeout(() => {
      pendingStarts.delete(id);
      startJadibot(sock, m, userJid, false).catch((e) => {
        logger.error("Jadibot", `Reconnect failed for ${id}: ${e.message}`);
        jadibotSessions.delete(id);
        reconnectAttempts.delete(id);
        pendingStarts.delete(id);
      });
    }, RECONNECT_INTERVAL);
  }

  async function forceResetCorruptSession(reason) {
    logger.warn(
      "Jadibot",
      `${id}: reset paksa session karena kedeteksi korup berulang (${reason})`,
    );
    sessionCorruptionCounts.delete(id);
    try {
      await stopJadibot(userJid, true);
    } catch { }
    sendStatusNotif(sock, {
      text:
        `🧨 *sᴇssɪᴏɴ ᴋᴏʀᴜᴘ ᴛᴇʀᴅᴇᴛᴇᴋsɪ*\n\n` +
        `> 📱 Nomor: *@${id}*\n` +
        `> Signal session rusak (error decrypt berulang), session sudah dihapus otomatis\n` +
        `> Ketik \`.jadibot\` untuk pairing ulang dari awal`,
      mentions: [userJid],
    });
  }

  let qrCount = 0;
  let lastQRMsg = null;
  let pairingCode = null;
  let heartbeatInterval = null;

  childSock.ev.on("creds.update", saveCreds);

  childSock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !usePairing) {
      qrCount++;
      if (qrCount > 3) {
        await safeSend(sock, m?.chat, {
          text: "❌ QR Code expired! Silakan coba lagi.",
        });
        if (lastQRMsg?.key) {
          await safeSend(sock, m?.chat, { delete: lastQRMsg.key });
        }
        jadibotSessions.delete(id);
        reconnectAttempts.delete(id);
        pendingStarts.delete(id);
        try {
          childSock.ws.close();
        } catch { }
        return;
      }

      try {
        const qrBuffer = await QRCode.toBuffer(qr, {
          scale: 8,
          margin: 4,
          width: 256,
          color: { dark: "#000000ff", light: "#ffffffff" },
        });

        if (lastQRMsg?.key) {
          await safeSend(sock, m?.chat, { delete: lastQRMsg.key });
        }

        if (!m?.chat) return;
        const qrCaption =
          `🤖 *ᴊᴀᴅɪʙᴏᴛ — Qʀ ᴄᴏᴅᴇ*\n\n` +
          `Scan kode QR ini untuk menjadi bot.\n\n` +
          `> ⏱️ Expired dalam 20 detik\n` +
          `> 📊 QR Count: ${qrCount}/3`;
        if (
          await sendSecretToRunner(sock, m, { image: qrBuffer, caption: qrCaption })
        ) {
          lastQRMsg = null;
          return;
        }
        lastQRMsg = await sock.sendMessage(
          m.chat,
          {
            image: qrBuffer,
            caption:
              `🤖 *ᴊᴀᴅɪʙᴏᴛ — Qʀ ᴄᴏᴅᴇ*\n\n` +
              `Scan kode QR ini untuk menjadi bot.\n\n` +
              `> ⏱️ Expired dalam 20 detik\n` +
              `> 📊 QR Count: ${qrCount}/3`,
          },
          { quoted: m },
        );
      } catch (e) {
        logger.error("Jadibot", "Failed to send QR: " + e.message);
      }
    }

    if (connection === "open") {
      logger.info("Jadibot", `Connected: ${id}`);

      reconnectAttempts.delete(id);
      pendingStarts.delete(id);
      sessionCorruptionCounts.delete(id);

      jadibotSessions.set(id, {
        sock: childSock,
        jid: childSock.user?.jid || userJid,
        startedAt: Date.now(),
        ownerJid: m?.sender || userJid,
        status: "connected",
        connectionReady: true,
        pendingMessages: [],
      });

      heartbeatInterval = setInterval(() => {
        try {
          if (!isSocketAlive(childSock)) {
            clearInterval(heartbeatInterval);

            const stillTracked = jadibotSessions.get(id);
            if (stillTracked) {
              logger.warn(
                "Jadibot",
                `${id}: heartbeat mendeteksi socket zombie, memaksa cleanup+reconnect`,
              );
              scheduleReconnect("heartbeat zombie");
            }
          }
        } catch { }
      }, 30000);

      const session = jadibotSessions.get(id);
      if (session) {
        session.heartbeatInterval = heartbeatInterval;
      }

      childSock.sendPresenceUpdate("available").catch(() => { });

      // bug fix: sebelumnya pesan yang masuk sebelum connectionReady=true ditampung
      // ke session.pendingMessages tapi tidak pernah diproses lagi (pesan hilang
      // diam-diam). Sekarang benar-benar dikuras begitu koneksi siap.
      if (session.pendingMessages?.length) {
        const queued = session.pendingMessages.splice(0);
        (async () => {
          for (const queuedMsg of queued) {
            try {
              const { messageHandler } = await import("../handler.js");
              await messageHandler(queuedMsg, childSock, {
                isJadibot: true,
                jadibotId: id,
              });
            } catch (e) {
              logger.error(
                "Jadibot",
                `Gagal proses pesan tertunda untuk ${id}: ${e.message}`,
              );
            }
          }
        })();
      }

      addJadibotOwner(id, m?.sender || userJid);

      sendStatusNotif(sock, {
        text:
          `✅ *ᴊᴀᴅɪʙᴏᴛ ᴛᴇʀʜᴜʙᴜɴɢ*\n\n` +
          `> 📱 Nomor: *@${id}*\n` +
          `> 🟢 Status: *Online*\n` +
          `> ⏱️ Mulai: *${new Date().toLocaleTimeString("id-ID")}*\n\n` +
          `Bot kamu aktif dan siap menerima perintah!\n\n` +
          `> ℹ️ Ketik \`${m?.prefix || "."}stopjadibot\` untuk menghentikan`,
        mentions: [userJid],
      });

      if (lastQRMsg?.key && m?.chat) {
        safeSend(sock, m.chat, { delete: lastQRMsg.key }).catch(() => { });
      }
    }

    if (connection === "close") {
      const errorInfo = parseDisconnectError(lastDisconnect);

      logger.info(
        "Jadibot",
        `Disconnected: ${id}, code: ${errorInfo.code}, reason: ${errorInfo.reason}`,
      );

      const session = jadibotSessions.get(id);
      if (session?.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
      }

      const attempts = reconnectAttempts.get(id) || 0;

      if (errorInfo.fatal || attempts >= MAX_RECONNECT_ATTEMPTS) {
        jadibotSessions.delete(id);
        reconnectAttempts.delete(id);
        pendingStarts.delete(id);

        if (errorInfo.fatal) {
          try {
            if (fs.existsSync(authPath)) {
              fs.rmSync(authPath, { recursive: true, force: true });
            }
          } catch { }
        }

        let statusEmoji = "❌";
        if (errorInfo.code === 403 || errorInfo.reason?.includes("banned")) {
          statusEmoji = "🚫";
        } else if (
          errorInfo.code === 406 ||
          errorInfo.reason?.includes("dibatasi")
        ) {
          statusEmoji = "⚠️";
        }

        sendStatusNotif(sock, {
          text:
            `${statusEmoji} *ᴊᴀᴅɪʙᴏᴛ ᴅɪsᴄᴏɴɴᴇᴄᴛᴇᴅ*\n\n` +
            `> 📱 Nomor: *@${id}*\n` +
            `> 🔢 Code: \`${errorInfo.code}\`\n` +
            `> 📋 Alasan: *${errorInfo.reason}*\n` +
            `> ℹ️ ${errorInfo.action}\n\n` +
            (errorInfo.fatal
              ? `> ⚠️ Session dihapus. Gunakan \`.jadibot\` untuk memulai ulang.`
              : ""),
          mentions: [userJid],
        });
      } else {
        // bug fix: sebelumnya reconnectAttempts di-set ke attempts+1 lalu langsung
        // ditimpa balik ke attempts sebelum scheduleReconnect() menaikkannya lagi.
        // Hasilnya kebetulan sama, tapi membingungkan dan rawan bug saat diedit.
        // scheduleReconnect() adalah satu-satunya tempat yang menaikkan counter.
        sendStatusNotif(sock, {
          text:
            `🔄 *ᴊᴀᴅɪʙᴏᴛ ʀᴇᴄᴏɴɴᴇᴄᴛɪɴɢ...*\n\n` +
            `> 📱 Nomor: *@${id}*\n` +
            `> 📋 Alasan: *${errorInfo.reason}*\n` +
            `> 🔁 Percobaan: *${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}*\n\n` +
            `> Reconnect dalam ${RECONNECT_INTERVAL / 1000} detik...`,
          mentions: [userJid],
        });

        scheduleReconnect(errorInfo.reason);
      }
    }
  });

  const processedMessages = new Map();

  childSock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!childSock.user || !childSock.user.id) {
      childSock.user = {
        id: jidNormalizedUser(id),
        name: "Jadibot",
      };
    }

    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const msgId = msg.key?.id;
      if (msgId && processedMessages.has(msgId)) continue;
      if (msgId) processedMessages.set(msgId, Date.now());

      if (msg.key && msg.key.remoteJid === "status@broadcast") continue;

      const msgTimestamp = msg.messageTimestamp
        ? Number(msg.messageTimestamp) * 1000
        : Date.now();
      const msgAge = Date.now() - msgTimestamp;

      if (msgAge > 2 * 60 * 1000) continue;

      const sessionForTimeCheck = jadibotSessions.get(id);
      const readyAt = sessionForTimeCheck?.startedAt;
      if (readyAt && msgTimestamp < readyAt) continue;

      const metadataKeys = [
        "senderKeyDistributionMessage",
        "messageContextInfo",
      ];
      const msgType =
        Object.keys(msg.message).find((k) => !metadataKeys.includes(k)) ||
        Object.keys(msg.message)[0];
      const ignoredTypes = [
        "protocolMessage",
        "senderKeyDistributionMessage",
        "reactionMessage",
        "stickerSyncRmrMessage",
        "encReactionMessage",
        "pollUpdateMessage",
        "pollCreationMessage",
        "pollCreationMessageV2",
        "pollCreationMessageV3",
        "keepInChatMessage",
        "deviceSentMessage",
        "call",
        "peerDataOperationRequestMessage",
      ];
      if (ignoredTypes.includes(msgType)) continue;

      if (!isSocketAlive(childSock)) continue;

      const session = jadibotSessions.get(id);
      if (session && !session.connectionReady) {
        session.pendingMessages = session.pendingMessages || [];
        session.pendingMessages.push(msg);
        continue;
      }

      try {
        const { messageHandler } = await import("../handler.js");
        await messageHandler(msg, childSock, {
          isJadibot: true,
          jadibotId: id,
        });
      } catch (e) {
        if (
          e.message?.includes("Connection Closed") ||
          e.message?.includes("428")
        ) {
          logger.info(
            "Jadibot",
            `${id} connection closed during handler, skipping`,
          );
          break;
        }

        if (isSessionCorruptionError(e)) {
          const count = noteSessionCorruption(id);
          logger.error(
            "Jadibot",
            `Signal session korup terdeteksi utk ${id} (${count}/${SESSION_CORRUPTION_THRESHOLD}): ${e.message}`,
          );
          if (count >= SESSION_CORRUPTION_THRESHOLD) {
            forceResetCorruptSession("decrypt error berulang").catch(() => { });
            break;
          }
          continue;
        }

        logger.error("Jadibot", `Handler error for ${id}: ${e.message}`);
      }
    }

    const fiveMinAgo = Date.now() - 300000;
    for (const [key, time] of processedMessages) {
      if (time < fiveMinAgo) processedMessages.delete(key);
    }
  });

  if (usePairing && !state.creds?.registered) {
    try {
      await delay(3000);
      pairingCode = await childSock.requestPairingCode(id);
      pairingCode = pairingCode.match(/.{1,4}/g)?.join("-") || pairingCode;

      const pairingText =
        `🔗 *ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n\n` +
        `Masukkan kode berikut di WhatsApp kamu:\n\n` +
        `> 📱 *Settings → Linked Devices → Link a Device*\n\n` +
        `\`\`\`${pairingCode}\`\`\`\n\n` +
        `> 🕕 Kode berlaku beberapa menit\n` +
        `> ⚠️ Jangan bagikan kode ini ke siapapun`;

      if (m && m.chat && (await sendSecretToRunner(sock, m, { text: pairingText }))) {
        logger.info("Jadibot", `Pairing code untuk ${id} dikirim privat via sBPR`);
      } else if (m && m.chat) {
        let thumbnail = null;
        try {
          if (!!getAssetBuffer("ichigo2")) {
            thumbnail = getAssetBuffer("ichigo2");
          }
        } catch { }

        await sock.sendMessage(
          m.chat,
          {
            text:
              `🔗 *ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n\n` +
              `Masukkan kode berikut di WhatsApp kamu:\n\n` +
              `> 📱 *Settings → Linked Devices → Link a Device*\n\n` +
              `\`\`\`${pairingCode}\`\`\`\n\n` +
              `> 🕕 Kode berlaku beberapa menit\n` +
              `> ⚠️ Jangan bagikan kode ini ke siapapun`,
            contextInfo: saluranCtx(),
            interactiveButtons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 Copy Pairing Code",
                  copy_code: pairingCode.replace(/-/g, ""),
                }),
              },
            ],
          },
          { quoted: m },
        );
      } else {
        logger.info("Jadibot", `Pairing Code for ${id}: ${pairingCode}`);
      }
    } catch (e) {
      logger.error("Jadibot", "Failed to get pairing code: " + e.message);

      let errorMsg = "Gagal mendapatkan pairing code";
      if (
        e.message?.includes("rate") ||
        e.message?.includes("limit") ||
        e.message?.includes("428")
      ) {
        errorMsg = "Rate limited! Tunggu 5-10 menit.";
      } else if (
        e.message?.includes("banned") ||
        e.message?.includes("blocked")
      ) {
        errorMsg = "Nomor mungkin dibanned WhatsApp.";
      } else if (
        e.message?.includes("Connection Closed") ||
        e.message?.includes("closed")
      ) {
        errorMsg = "Koneksi terputus. Coba lagi.";
      }

      await safeSend(sock, m?.chat, {
        text: `❌ *ᴊᴀᴅɪʙᴏᴛ ɢᴀɢᴀʟ*\n\n> ${errorMsg}`,
      });

      try {
        childSock.end?.();
      } catch { }
      jadibotSessions.delete(id);
      reconnectAttempts.delete(id);
      pendingStarts.delete(id);
      throw new Error(errorMsg);
    }
  }

  pendingStarts.delete(id);
  return { sock: childSock, pairingCode };
}

async function stopJadibot(jid, deleteSession = false) {
  const id = jid.replace(/@.+/g, "");
  const session = jadibotSessions.get(id);
  const pending = pendingStarts.get(id);

  if (session) {
    try {
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
      }
      session.sock.ev.removeAllListeners();
      session.sock.ws.close();
    } catch { }
    jadibotSessions.delete(id);
  }

  if (pending) {
    // bug fix: tandai dibatalkan agar startJadibot yang masih berjalan di
    // background (belum sampai membuat childSock) benar-benar berhenti,
    // bukan cuma kehilangan catatan pendingStarts-nya.
    cancelledStarts.add(id);
    if (pending.sock) {
      try {
        pending.sock.ev?.removeAllListeners?.();
        pending.sock.ws?.close?.();
      } catch { }
    }
  }
  pendingStarts.delete(id);

  reconnectAttempts.delete(id);
  sessionCorruptionCounts.delete(id);

  if (deleteSession) {
    const authPath = getJadibotAuthPath(jid);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
  }

  return true;
}

async function stopAllJadibots() {
  const stopped = [];
  for (const [id, session] of jadibotSessions) {
    try {
      if (session.heartbeatInterval) {
        clearInterval(session.heartbeatInterval);
      }
      session.sock.ev.removeAllListeners();
      session.sock.ws.close();
    } catch { }
    stopped.push(id);
  }
  for (const [id, pending] of pendingStarts) {
    cancelledStarts.add(id); // bug fix: sama seperti stopJadibot, pastikan proses pending ikut berhenti
    try {
      pending.sock?.ev?.removeAllListeners?.();
      pending.sock?.ws?.close?.();
    } catch { }
    if (!stopped.includes(id)) stopped.push(id);
  }
  jadibotSessions.clear();
  reconnectAttempts.clear();
  pendingStarts.clear();
  sessionCorruptionCounts.clear();
  return stopped;
}

async function restartJadibotSession(sock, sessionId) {
  const userJid = sessionId + "@s.whatsapp.net";
  try {
    logger.info("Jadibot", `Restoring session: ${sessionId}`);

    const dbPath = path.join(JADIBOT_AUTH_FOLDER, sessionId, "data.json");
    let ownerJid = userJid;
    try {
      if (fs.existsSync(dbPath)) {
        const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
        if (data.owners?.[0]) ownerJid = data.owners[0] + "@s.whatsapp.net";
      }
    } catch { }

    // bug fix / fitur baru: kalau pembayaran aktif dan akses pemilik sudah
    // habis selagi server mati, jangan direstore otomatis — biar tidak
    // "hidup gratis" lagi sampai access checker sempat jalan.
    if (isJadibotPaymentEnforced() && !hasJadibotAccess(ownerJid)) {
      logger.warn(
        "Jadibot",
        `${sessionId}: akses berbayar sudah habis, tidak direstore otomatis`,
      );
      return;
    }

    const mockM = {
      chat: ownerJid,
      sender: ownerJid,
      prefix: ".",
      key: {
        remoteJid: ownerJid,
        fromMe: false,
        id: "restart-" + Date.now(),
      },
      reply: async (text) => {
        await safeSend(sock, ownerJid, { text });
      },
      react: async () => { },
    };
    await startJadibot(sock, mockM, userJid, false);
  } catch (e) {
    logger.error("Jadibot", `Failed to restore ${sessionId}: ${e.message}`);
  }
}

function getJadibotStatus(jid) {
  const id = jid.replace(/@.+/g, "");
  const session = jadibotSessions.get(id);
  if (!session) return null;

  return {
    id,
    jid: session.jid,
    status: session.status || "unknown",
    startedAt: session.startedAt,
    ownerJid: session.ownerJid,
    uptime: Date.now() - session.startedAt,
  };
}

let accessCheckerInterval = null;
const ACCESS_CHECK_INTERVAL_MS = 10 * 60 * 1000; // cek tiap 10 menit

/**
 * Pantau semua jadibot yang lagi aktif: kalau masa akses berbayar pemiliknya
 * sudah habis (dan dia bukan owner/partner/premium), sesi otomatis dihentikan
 * supaya tidak terus jalan gratis setelah expired.
 */
function startJadibotAccessChecker() {
  if (accessCheckerInterval) clearInterval(accessCheckerInterval);

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  const doCheck = async () => {
    try {
      if (!isJadibotPaymentEnforced()) return;

      const db = getDatabase();

      for (const [id, session] of jadibotSessions) {
        const ownerJid = session.ownerJid;
        if (!ownerJid) continue;

        const info = getJadibotAccessInfo(ownerJid);
        if (info.active) {
          // bug fix / fitur baru: kirim peringatan H-3 hari dan H-1 jam sebelum
          // habis, meniru pola yang sama seperti checker sewa grup, supaya
          // pemilik jadibot berbayar sempat diingatkan sebelum tiba-tiba mati.
          if (!info.isLifetime && info.expiresAt) {
            const remaining = info.expiresAt - Date.now();
            const user = db.getUser(ownerJid) || {};
            try {
              if (remaining <= ONE_HOUR_MS && !user.jadibotWarned1h) {
                db.setUser(ownerJid, { ...user, jadibotWarned1h: true });
                db.save();
              } else if (
                remaining <= THREE_DAYS_MS &&
                remaining > ONE_HOUR_MS &&
                !user.jadibotWarned3d
              ) {
                db.setUser(ownerJid, { ...user, jadibotWarned3d: true });
                db.save();
              }
            } catch { }
          }
          continue;
        }

        logger.warn(
          "Jadibot",
          `${id}: akses berbayar pemilik (@${ownerJid.split("@")[0]}) sudah habis, menghentikan sesi otomatis`,
        );

        await stopJadibot(id + "@s.whatsapp.net", false);
      }
    } catch (e) {
      logger.error("Jadibot", `Access checker error: ${e.message}`);
    }
  };

  accessCheckerInterval = setInterval(doCheck, ACCESS_CHECK_INTERVAL_MS);
  if (accessCheckerInterval.unref) accessCheckerInterval.unref();
}

export {
  JADIBOT_AUTH_FOLDER,
  jadibotSessions,
  getJadibotAuthPath,
  isJadibotActive,
  isJadibotPending,
  getActiveJadibots,
  countActiveJadibotsByOwner,
  countAllActiveJadibots,
  getAllJadibotSessions,
  startJadibot,
  stopJadibot,
  stopAllJadibots,
  restartJadibotSession,
  getJadibotStatus,
  isSocketAlive,
  safeSend,
  startJadibotAccessChecker,
};