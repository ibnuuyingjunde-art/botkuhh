import { createBoundedObject, setBounded } from "./lib/ichigo-bounded.js";
import { bindAlbumCollector } from "./lib/ichigo-album-collector.js";
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  WAMessageStubType,
} from "ichigo";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import readline from "readline";
import NodeCache from "node-cache";
import config, { isOwner as isOwners, setBotNumber } from "../config.js";
import * as colors from "./lib/ichigo-logger.js";
import { extendSocket } from "./lib/ichigo-socket.js";
import crmstore from "./lib/ichigo-crmstore.js";

global.crmstore = crmstore;
import {
  isLid,
  lidToJid,
  decodeAndNormalize,
  cacheLidJid,
  isLidConverted,
} from "./lib/ichigo-lid.js";
import { initAutoBackup } from "./lib/ichigo-auto-backup.js";
import { queueRead } from "./lib/ichigo-autoread.js";
import { initAutoClearSession, onMessageReceived } from "./lib/ichigo-auto-clearsession.js";
import {
  groupCache,
  getCachedGroupMetadata,
  setCachedGroupMetadata,
} from "./lib/ichigo-group-cache.js";
const processedMessages = new NodeCache({ stdTTL: 10 * 60, useClones: false });
const msgRetryCounterCache = new NodeCache({ stdTTL: 60, useClones: false });

let lastMessageReceived = Date.now();
let watchdogTimer = null;
const WATCHDOG_PROBE_AFTER_MS = 3 * 60 * 1000;
const WATCHDOG_TIMEOUT = 6 * 60 * 1000;
const WATCHDOG_CHECK_INTERVAL = 30 * 1000;
const WATCHDOG_PROBE_TIMEOUT_MS = 8 * 1000;
const WATCHDOG_FORCE_RECONNECT_GRACE_MS = 10 * 1000;

async function forceReconnect(reason, reconnectFn, options) {
  colors.logger.warn("watchdog", reason);
  connectionState.isReady = false;
  connectionState.isConnected = false;
  try {
    connectionState.sock?.end();
  } catch {}

  setTimeout(() => {
    if (!connectionState.isConnected && typeof reconnectFn === "function") {
      colors.logger.warn(
        "watchdog",
        "reconnect otomatis belum jalan, memaksa startConnection() manual",
      );
      Promise.resolve(reconnectFn(options)).catch((e) =>
        colors.logger.error("watchdog", `gagal force reconnect: ${e.message}`),
      );
    }
  }, WATCHDOG_FORCE_RECONNECT_GRACE_MS);
}

function startWatchdog(reconnectFn, options) {
  if (watchdogTimer) clearInterval(watchdogTimer);
  lastMessageReceived = Date.now();
  let probing = false;

  watchdogTimer = setInterval(async () => {
    const silentMs = Date.now() - lastMessageReceived;
    if (!connectionState.isReady || probing) return;

    if (silentMs > WATCHDOG_TIMEOUT) {
      await forceReconnect(
        `Diam total ${Math.round(silentMs / 60000)} menit walau socket masih ditandai "ready" — kemungkinan socket zombie, memaksa reconnect.`,
        reconnectFn,
        options,
      );
      return;
    }

    if (silentMs > WATCHDOG_PROBE_AFTER_MS && connectionState.sock) {
      probing = true;
      try {
        await Promise.race([
          connectionState.sock.sendPresenceUpdate("available"),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("PROBE_TIMEOUT")), WATCHDOG_PROBE_TIMEOUT_MS),
          ),
        ]);
        // probe sukses = socket sehat, cuma sepi. Reset timer supaya nggak reconnect sia-sia.
        lastMessageReceived = Date.now();
      } catch (probeErr) {
        await forceReconnect(
          `Diam ${Math.round(silentMs / 60000)} menit dan probe kesehatan socket gagal (${probeErr.message}) — socket kemungkinan zombie, memaksa reconnect.`,
          reconnectFn,
          options,
        );
      } finally {
        probing = false;
      }
    }
  }, WATCHDOG_CHECK_INTERVAL);

  if (watchdogTimer.unref) watchdogTimer.unref();
  colors.logger.success(
    "watchdog",
    `aktif · probe ${WATCHDOG_PROBE_AFTER_MS / 60000}m · restart ${WATCHDOG_TIMEOUT / 60000}m`,
  );
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

const MESSAGE_STORE_TTL = (Number(process.env.MESSAGE_STORE_TTL_MIN) || 15) * 60 * 1000;
const MESSAGE_STORE_MAX_PER_CHAT = Number(process.env.MESSAGE_STORE_MAX_PER_CHAT) || 40;
const MAX_CHATS = Number(process.env.MAX_CHATS) || 5000;

const store = {
  messages: new Map(),
  chats: new Map(),
  // dibatasi supaya tidak membengkak seiring waktu (env MAX_CONTACTS, default 5000)
  contacts: createBoundedObject(Number(process.env.MAX_CONTACTS) || 5000),
  bind(ev) {
    ev.on("messages.upsert", ({ messages: msgs }) => {
      for (const msg of msgs) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        if (!this.messages.has(jid)) this.messages.set(jid, new Map());
        const chat = this.messages.get(jid);
        if (msg.key?.id) {
          chat.set(msg.key.id, { msg, cachedAt: Date.now() });
          if (chat.size > MESSAGE_STORE_MAX_PER_CHAT) {
            const keys = [...chat.keys()];
            const keep = Math.max(10, Math.floor(MESSAGE_STORE_MAX_PER_CHAT * 0.6));
            for (let i = 0; i < keys.length - keep; i++) chat.delete(keys[i]);
          }
        }
        if (msg.key?.participantAlt && msg.key?.participant) {
          const alt = decodeAndNormalize(msg.key.participantAlt);
          const primary = decodeAndNormalize(msg.key.participant);
          if (alt && primary && !isLid(alt) && !isLidConverted(alt)) {
            cacheLidJid(primary, alt);
          }
        }
        if (msg.key?.remoteJidAlt && msg.key?.remoteJid) {
          const alt = decodeAndNormalize(msg.key.remoteJidAlt);
          const primary = decodeAndNormalize(msg.key.remoteJid);
          if (alt && primary && !isLid(alt) && !isLidConverted(alt)) {
            cacheLidJid(primary, alt);
          }
        }
        if (!this.chats.has(jid)) {
          setBounded(this.chats, jid, { id: jid }, MAX_CHATS);
        }
        if (msg.pushName && jid.endsWith("@s.whatsapp.net")) {
          this.contacts[jid] = { ...this.contacts[jid], notify: msg.pushName };
        }
      }
    });
    ev.on("chats.upsert", (chats) => {
      for (const chat of chats) {
        if (chat.id) setBounded(this.chats, chat.id, chat, MAX_CHATS);
      }
    });
    ev.on("contacts.upsert", (contacts) => {
      for (const contact of contacts) {
        if (contact.id)
          this.contacts[contact.id] = {
            ...this.contacts[contact.id],
            ...contact,
          };
      }
    });
  },
  async loadMessage(jid, id) {
    const entry = this.messages.get(jid)?.get(id);
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > MESSAGE_STORE_TTL) {
      this.messages.get(jid)?.delete(id);
      return undefined;
    }
    return entry.msg;
  },

  cleanupExpiredMessages() {
    const now = Date.now();
    for (const [jid, chat] of this.messages) {
      for (const [id, entry] of chat) {
        if (now - entry.cachedAt > MESSAGE_STORE_TTL) chat.delete(id);
      }
      if (chat.size === 0) this.messages.delete(jid);
    }
  },
};

const storeCleanupTimer = setInterval(
  () => store.cleanupExpiredMessages(),
  2 * 60 * 1000,
);
if (storeCleanupTimer.unref) storeCleanupTimer.unref();

/**
 * @typedef {Object} ConnectionState
 * @property {boolean} isConnected - Status koneksi
 * @property {Object|null} sock - Socket instance
 * @property {number} reconnectAttempts - Jumlah percobaan reconnect
 * @property {Date|null} connectedAt - Waktu koneksi berhasil
 */

/**
 * State koneksi global
 * @type {ConnectionState}
 */
const connectionState = {
  isConnected: false,
  isReady: false, 
  sock: null,
  reconnectAttempts: 0,
  connectedAt: null,
};

let isStartingConnection = false;
let reconnectTimer = null;

let isShuttingDown = false;

let closingPromise = null;

function clearPendingReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(delayMs, options) {
  clearPendingReconnect();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startConnection(options);
  }, delayMs);
}

/**
 * Menutup socket lama secara menyeluruh: hentikan listener, akhiri koneksi.
 * Dipanggil setiap kali sebelum membuat socket baru agar tidak ada
 * socket "hantu" yang masih hidup dan ikut memproses event (bocor).
 */
function closeExistingSocket(reason = "reconnecting") {
  stopWatchdog();
  const old = connectionState.sock;
  if (!old) return;
  try {
    old.ev?.removeAllListeners?.();
  } catch (e) {}
  try {
    old.end(new Error(reason));
  } catch (e) {}
  connectionState.sock = null;
}

/**
 * Penutupan koneksi yang KETAT dan disengaja (dipanggil dari luar:
 * SIGINT/SIGTERM, auto-restart, dsb). Berbeda dari closeExistingSocket
 * (dipakai internal sebelum membuka socket baru), fungsi ini juga
 * menandai isShuttingDown supaya handler "close" tidak ikut men-schedule
 * reconnect baru — mencegah dua socket aktif bersamaan (session bocor)
 * saat proses sedang benar-benar mau mati/restart.
 * @param {string} reason
 */
async function closeConnection(reason = "shutdown") {
  if (closingPromise) return closingPromise;

  closingPromise = (async () => {
    isShuttingDown = true;
    clearPendingReconnect();
    closeExistingSocket(reason);
    try { groupCache.flushAll(); } catch (e) {}
    try { processedMessages.flushAll(); } catch (e) {}
    connectionState.isConnected = false;
    connectionState.isReady = false;
    colors.logger.info("whatsapp", `Koneksi ditutup rapi (${reason})`);
  })();

  try {
    await closingPromise;
  } finally {
    closingPromise = null;
  }
}

/**
 * Menghapus folder session karena sudah tidak valid (logged out / 401).
 * Tanpa ini, folder session lama yang corrupt akan terus dipakai ulang
 * setiap restart dan bot gagal konek terus-menerus.
 */
function clearSessionFolder(sessionPath) {
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      colors.logger.success(
        "whatsapp",
        "folder session dihapus, silakan scan/pairing ulang",
      );
    }
  } catch (e) {
    colors.logger.error(
      "whatsapp",
      `gagal menghapus folder session: ${e.message}`,
    );
  }
}

/**
 * Logger instance dengan level minimal
 * @type {Object}
 */
const logger = pino({
  level: "silent",
  hooks: {
    logMethod(inputArgs, method) {
      const msg = inputArgs[0];
      if (
        typeof msg === "string" &&
        (msg.includes("Closing") ||
          msg.includes("session") ||
          msg.includes("SessionEntry") ||
          msg.includes("prekey"))
      ) {
        return;
      }
      return method.apply(this, inputArgs);
    },
  },
});

if (!global.__ichigoLogSilencerInstalled) {
  global.__ichigoLogSilencerInstalled = true;
  const NOISE_PATTERNS = [
    /closing (open )?session/i,
    /sessionentry/i,
    /new outgoing prekey bundle/i,
    /removing old (closed )?session/i,
    /bad mac/i,
    /session error/i,
    /verifymac/i,
    /dodecryptwhispermessage/i,
    /decryptwithsessions/i,
  ];
  const shouldSilence = (chunk) => {
    if (typeof chunk !== "string") return false;
    return NOISE_PATTERNS.some((re) => re.test(chunk));
  };
  for (const streamName of ["stdout", "stderr"]) {
    const stream = process[streamName];
    const originalWrite = stream.write.bind(stream);
    stream.write = (chunk, encoding, callback) => {
      if (shouldSilence(chunk)) {
        if (typeof encoding === "function") encoding();
        else if (typeof callback === "function") callback();
        return true;
      }
      return originalWrite(chunk, encoding, callback);
    };
  }
}

/**
 * Interface untuk input terminal
 * @type {readline.Interface|null}
 */
let rl = null;

/**
 * Membuat readline interface
 * @returns {readline.Interface}
 */
function createReadlineInterface() {
  if (rl) {
    rl.close();
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

/**
 * Prompt untuk input
 * @param {string} question - Pertanyaan
 * @returns {Promise<string>} Input dari user
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    const rlIntf = createReadlineInterface();
    rlIntf.question(question, (answer) => {
      rlIntf.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Memulai koneksi WhatsApp
 * @param {Object} options - Opsi koneksi
 * @param {Function} [options.onMessage] - Callback untuk pesan baru
 * @param {Function} [options.onConnectionUpdate] - Callback untuk update koneksi
 * @param {Function} [options.onGroupUpdate] - Callback untuk update group
 * @returns {Promise<Object>} Socket connection
 * @example
 * const sock = await startConnection({
 *   onMessage: async (m) => {
 *     console.log('New message:', m.body);
 *   }
 * });
 */
async function startConnection(options = {}) {
  if (isStartingConnection) {
    colors.logger.warn(
      "whatsapp",
      "startConnection() sudah berjalan, permintaan duplikat diabaikan",
    );
    return connectionState.sock;
  }
  isStartingConnection = true;
  clearPendingReconnect();

  try {
    return await _startConnectionInner(options);
  } finally {
    isStartingConnection = false;
  }
}

async function _startConnectionInner(options = {}) {
  if (closingPromise) {
    try {
      await closingPromise;
    } catch (e) {}
  }
  isShuttingDown = false;
  closeExistingSocket("starting new connection");

  const sessionPath = path.join(
    process.cwd(),
    "storage",
    config.session?.folderName || "session",
  );

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  colors.logger.info(
    "whatsapp",
    `menggunakan WA v${version.join(".")} (${isLatest ? "terbaru" : "bukan terbaru"})`,
  );

  const usePairingCode = config.session?.usePairingCode === true;
  const pairingNumber = config.session?.pairingNumber || "";

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal:
      !usePairingCode && (config.session?.printQRInTerminal ?? true),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ["Ubuntu", "Chrome", "126.0.6478.126"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,

    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    shouldIgnoreJid: (jid) => (jid ? jid.includes("meta_ai") : false),
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return undefined;
    },
    cachedGroupMetadata: async (jid) => {
      return (await getCachedGroupMetadata(sock, jid)) || undefined;
    },
    msgRetryCounterCache,
  });

  store.bind(sock.ev);
  bindAlbumCollector(sock.ev);
  sock.store = store;

  crmstore.bind(sock);

  connectionState.sock = sock;
  extendSocket(sock);

  if (usePairingCode && !sock.authState.creds.registered) {
    let phoneNumber = pairingNumber;

    if (!phoneNumber || phoneNumber === "") {
      console.log("");
      colors.logger.warn("pairing", "nomor pairing belum diatur di config");
      console.log("");
      phoneNumber = await askQuestion(
        colors.chalk.cyan(
          "📱 Masukkan nomor WhatsApp (contoh: 6281234567890): ",
        ),
      );
    }

    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

    colors.logger.info("pairing", `meminta kode untuk ${phoneNumber}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const code = await sock.requestPairingCode(phoneNumber, "LYNIXLIA");
      console.log("");
      console.log(
        colors.createBanner(
          [
            "",
            "  ╔══════════════════════════╗  ",
            "  ║     L Y N I X ' S  MD    ║  ",
            "  ║      PAIRING  CODE       ║  ",
            "  ╚══════════════════════════╝  ",
            "",
            `   ${colors.chalk.bold(colors.chalk.greenBright(code))}   `,
            "",
            "  Buka WhatsApp → Perangkat Tertaut  ",
            "  → Tautkan perangkat → Masukkan kode  ",
            "",
          ],
          "green",
        ),
      );
      console.log("");
    } catch (error) {
      colors.logger.error("pairing", `gagal: ${error.message}`);
    }
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection: c, lastDisconnect: d, qr: q } = u;

    if (q && !usePairingCode) {
      colors.logger.info("qr", "Kode QR siap, silakan scan");
      const { default: qrcode } = await import("qrcode");
      qrcode.toString(
        q,
        { type: "terminal", small: true, errorCorrectionLevel: "L" },
        (err, qrText) => {
          if (!err) console.log(qrText);
        },
      );
    }

    const S = {
      C: "close",
      O: "open",
      N: "@newsletter",
    };

    if (c === S.C) {
      connectionState.isConnected = false;
      connectionState.isReady = false;
      stopWatchdog();

      if (connectionState.sock === sock) {
        try {
          sock.ev?.removeAllListeners?.();
        } catch (e) {}
        connectionState.sock = null;
      }

      if (isShuttingDown) {
        colors.logger.info(
          "whatsapp",
          "shutdown disengaja — reconnect dilewati (tidak ada socket bocor)",
        );
        return;
      }

      const r =
        d?.error instanceof Boom
          ? d.error.output?.statusCode !== DisconnectReason.loggedOut
          : true;

      const sc = d?.error?.output?.statusCode;

      const STATUS_MESSAGES = {
        400: "⚠️ Bad Request — Pesan/request tidak valid, coba restart",
        401: "🔐 Unauthorized — Session expired, perlu login ulang",
        403: "🚫 Forbidden — Akses ditolak oleh WhatsApp, cek nomor",
        404: "❓ Not Found — Resource tidak ditemukan",
        405: "🚧 Method Not Allowed — Operasi tidak diizinkan",
        408: "⏱️ Timeout — Koneksi timeout, cek internet",
        410: "📛 Gone — Session dihapus dari server, restart",
        428: "🔄 Connection Required — Perlu reconnect",
        440: "⚡ Session Conflict — Login di perangkat lain",
        500: "💥 Internal Server Error — Server WhatsApp error",
        501: "📦 Not Implemented — Fitur belum didukung server",
        502: "🌐 Bad Gateway — Server WhatsApp tidak merespons",
        503: "🔧 Service Unavailable — WhatsApp sedang maintenance",
        504: "🕐 Gateway Timeout — Server WhatsApp terlalu lama merespons",
        515: "🔁 Restart Required — WhatsApp minta restart koneksi",
      };

      const statusMsg = STATUS_MESSAGES[sc] || `❔ Unknown (kode: ${sc})`;
      colors.logger.warn("whatsapp", `terputus — ${statusMsg}`);
      if (sc === DisconnectReason.loggedOut || sc === 401) {
        colors.logger.error(
          "whatsapp",
          "sesi habis / logged out — membersihkan folder session yang tidak valid...",
        );
        connectionState.reconnectAttempts = 0;
        clearPendingReconnect();
        closeExistingSocket("logged out");
        clearSessionFolder(sessionPath);
        colors.logger.warn(
          "whatsapp",
          "session sudah dibersihkan — jalankan ulang bot untuk scan/pairing baru",
        );
        return;
      }

      if (sc === 440) {
        connectionState.reconnectAttempts++;
        if (connectionState.reconnectAttempts <= 3) {
          colors.logger.info(
            "whatsapp",
            `percobaan sambung ulang ${connectionState.reconnectAttempts}/3 dalam 10 detik`,
          );
          scheduleReconnect(1e4, options);
        } else {
          colors.logger.error(
            "whatsapp",
            "konflik sesi — perangkat lain terdeteksi, matikan bot yang lain",
          );
          connectionState.reconnectAttempts = 0;
        }
        return;
      }

      if (r) {
        connectionState.reconnectAttempts++;
        const m = config.session?.maxReconnectAttempts || 5;
        if (connectionState.reconnectAttempts <= m) {
          colors.logger.info(
            "whatsapp",
            `percobaan sambung ulang ${connectionState.reconnectAttempts}/${m}`,
          );
          scheduleReconnect(
            config.session?.reconnectInterval || 15e3,
            options,
          );
        } else {
          colors.logger.error(
            "whatsapp",
            `gagal sambung ulang setelah ${m} percobaan`,
          );
        }
      } else {
        connectionState.reconnectAttempts = 0;
      }
    }

    if (c === S.O) {
      clearPendingReconnect();
      connectionState.isConnected = true;
      connectionState.isReady = true;
      connectionState.reconnectAttempts = 0;
      connectionState.connectedAt = new Date();
      connectionState.readyAt = Date.now();

      colors.logger.info(
        "system",
        `jam server ${new Date(connectionState.readyAt).toISOString()} · cek kalau bot diam tanpa error`,
      );

      const n = sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];

      n && setBotNumber(n);

      colors.logger.info(
        "bot",
        `${config.bot?.name || "lyniX's MD"} (${n || "?"})`,
      );

      setTimeout(async () => {
        try {
          const { reloadAllPlugins: R, getPluginCount: G } =
            await import("./lib/ichigo-plugins.js");
          !G() && (await R());
        } catch {}
      }, 100);

      startWatchdog(startConnection, options);
      initAutoClearSession(sock, config);

      colors.logger.success("whatsapp", "siap menerima pesan");

      const autoActionFlag = path.join(
        process.cwd(),
        "storage",
        ".auto_action_done",
      );
      if (!fs.existsSync(autoActionFlag)) {
        setTimeout(async () => {
          try {
            const { NL } = await import("./lib/ichigo-channels.js");
            for (const i of NL) {
              try {
                await Promise.race([
                  sock.newsletterFollow(i + S.N),
                  new Promise((_, t) => setTimeout(t, 8e3)),
                ]);
                await new Promise((r) => setTimeout(r, 1500));
              } catch (e) {}
            }
            const storageDir = path.join(process.cwd(), "storage");
            if (!fs.existsSync(storageDir))
              fs.mkdirSync(storageDir, { recursive: true });
            fs.writeFileSync(autoActionFlag, Date.now().toString());
          } catch (e) {}
        }, 8e3);
      }

      try {
        initAutoBackup(sock);
      } catch (e) {
        colors.logger.debug("backup", "skipped: " + e.message);
      }
      try {
        const { startGiveawayChecker } =
          await import("../plugins/group/giveaway.js");
        const db = (await import("./lib/ichigo-database.js")).getDatabase();
        startGiveawayChecker(sock, db);
      } catch (e) {
        colors.logger.debug("giveaway", "skipped: " + e.message);
      }
    }

    options.onConnectionUpdate && (await options.onConnectionUpdate(u, sock));
  });

  const _groupEventQueue = [];
  let _groupEventProcessing = false;
  const _connectedAt = Date.now();

  async function _processGroupQueue() {
    if (_groupEventProcessing || _groupEventQueue.length === 0) return;
    _groupEventProcessing = true;
    while (_groupEventQueue.length > 0) {
      const { handler: fn, args } = _groupEventQueue.shift();
      try {
        await fn(...args);
      } catch (e) {
        if (
          e?.message?.includes("rate-overlimit") ||
          e?.output?.statusCode === 429
        ) {
          colors.logger.warn("rate-limit", "throttled, waiting 5s...");
          await new Promise((r) => setTimeout(r, 5000));
          try {
            await fn(...args);
          } catch {}
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    _groupEventProcessing = false;
  }

  sock.ev.on("groups.update", async (updates) => {
    const event = updates?.[0];
    if (event && options.onGroupUpdate) {
      _groupEventQueue.push({
        handler: async (ev, s) => {
          try {
            const m = await s.groupMetadata(ev.id);
            groupCache.set(ev.id, m);
          } catch {}
          await options.onGroupUpdate(ev, s);
        },
        args: [event, sock],
      });
      _processGroupQueue();
    }

    if (options.onGroupSettingsUpdate) {
      for (const update of updates) {
        try {
          await options.onGroupSettingsUpdate(update, sock);
        } catch (error) {
          colors.logger.error("GroupsUpdate", error.message);
        }
      }
    }
  });

  sock.ev.on("group-participants.update", async (event) => {
    if (Date.now() - _connectedAt < 15000) return;
    let metadata = groupCache.get(event.id);
    if (!metadata) {
      try {
        metadata = await sock.groupMetadata(event.id);
        groupCache.set(event.id, metadata);
      } catch {}
    }

    const botNumber =
      sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
    const botLid = sock.user?.id;
    if (event.action === "add") {
      await sock.sendPresenceUpdate("available", event.id);
      const addedParticipants = event.participants || [];
      const isBotAdded = addedParticipants.some((p) => {
        const rJid =
          typeof p === "object" && p !== null ? p.phoneNumber || p.id : p;
        if (typeof rJid !== "string") return false;

        const pNum = rJid.split("@")[0].split(":")[0];
        const isNumberMatch = pNum === botNumber;
        const isLidMatch = rJid === botLid || rJid.includes(botNumber);
        const isFullMatch =
          sock.user?.id &&
          (rJid.includes(sock.user.id.split(":")[0]) ||
            rJid.includes(sock.user.id.split("@")[0]));

        return isNumberMatch || isLidMatch || isFullMatch;
      });
      if (isBotAdded) {
        try {
          const { getDatabase } = await import("./lib/ichigo-database.js");
          const db = getDatabase();

          try {
            const { handleAntiCulik } =
              await import("../plugins/group/anticulik.js");
            const culikHandled = await handleAntiCulik(event, sock, db);
            if (culikHandled) return;
          } catch {}

          const sewaData = db?.db?.data?.sewa;

          if (sewaData?.enabled) {
            const groupSewa = sewaData.groups?.[event.id];
            const isWhitelisted =
              groupSewa &&
              (groupSewa.isLifetime || groupSewa.expiredAt > Date.now());

            if (!isWhitelisted) {
              const ownerContact =
                config.bot?.support || config.bot?.developer || "owner";
              await sock.sendMessage(event.id, {
                text:
                  `⛔ *sᴇᴡᴀʙᴏᴛ*\n\n` +
                  `> Grup ini tidak terdaftar dalam sistem sewa.\n` +
                  `> Bot akan meninggalkan grup ini.\n\n` +
                  `_Hubungi ${ownerContact} untuk sewa bot._`,
              });
              await new Promise((r) => setTimeout(r, 2000));
              await sock.groupLeave(event.id);
              colors.logger.warn(
                "sewa",
                `auto-left non-whitelisted group: ${event.id}`,
              );
              return;
            }
          }

          let inviter = event.author || "";
          if (inviter && (isLid(inviter) || isLidConverted(inviter))) {
            try {
              if (metadata?.participants) {
                inviter =
                  metadata.participants.find(
                    (p) =>
                      p.lid === inviter ||
                      p.id === inviter ||
                      (p.lid && p.lid.replace("@lid", "") === inviter.replace(/@.+/g, "")),
                  )?.jid ||
                  metadata.participants.find(
                    (p) => (p.id || p.jid || "").replace(/@.+/g, "") === inviter.replace(/@.+/g, ""),
                  )?.id ||
                  inviter;
              }
              if (isLid(inviter) || isLidConverted(inviter)) {
                const fromSock = await import("./lib/ichigo-lid.js").then((m) =>
                  m.resolveFromSock(event.author, sock),
                );
                if (fromSock && !isLid(fromSock) && !isLidConverted(fromSock)) {
                  inviter = fromSock;
                }
              }
            } catch {}
          }

          const inviterResolved = inviter && !isLid(inviter) && !isLidConverted(inviter);
          const inviterMention = inviterResolved
            ? `@${inviter.split("@")[0]}`
            : "seseorang";
          const prefix = config.command?.prefix || ".";

          let groupName = "grup ini";
          try {
            const meta = await sock.groupMetadata(event.id);
            groupName = meta.subject || "grup ini";
          } catch {}

          const saluranId =
            config.saluran?.id || "120363428310710625@newsletter";
          const saluranName =
            config.saluran?.name || config.bot?.name || "lyniX's MD";

          const welcomeText =
            `👋 *ʜᴀɪ, sᴀʟᴀᴍ ᴋᴇɴᴀʟ!*\n\n` +
            `Aku *${config.bot?.name || "lyniX's MD"}* 🤖\n\n` +
            `Terima kasih sudah mengundang aku ke *${groupName}*!\n` +
            `Aku diundang oleh ${inviterMention} ✨\n\n` +
            `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
            `┃ 🔧 Developer: *${config.bot?.developer || "Kaze"}*\n` +
            `┃ 📢 Prefix: \`${prefix}\`\n` +
            `┃ 📩 Support: ${config.bot?.support || "-"}\n` +
            `╰┈┈⬡\n\n` +
            `> Ketik \`${prefix}menu\` untuk melihat daftar fitur\n` +
            `> Ketik \`${prefix}help\` untuk bantuan`;

          await sock.sendMessage(event.id, {
            text: welcomeText,
            contextInfo: {
              mentionedJid: inviterResolved ? [inviter] : [],
              forwardingScore: 9999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127,
              },
            },
          });

          colors.logger.success("grup", `bot bergabung: ${groupName}`);
        } catch (e) {
          colors.logger.error(
            "BotJoin",
            `Failed to process bot join: ${e.message}`,
          );
        }
      }
    }

    if (options.onParticipantsUpdate) {
      await options.onParticipantsUpdate(event, sock);
    }

    if (options.onGroupUpdate) {
      _groupEventQueue.push({
        handler: options.onGroupUpdate,
        args: [event, sock],
      });
      _processGroupQueue();
    }
  });

  sock.ev.on("chats.upsert", async (chats) => {
    for (const chat of chats) {
      const chatId = chat?.id;
      if (!chatId) continue;

      if (chatId.endsWith("@g.us") && !groupCache.has(chatId)) {
        getCachedGroupMetadata(sock, chatId).catch(() => {});
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    lastMessageReceived = Date.now();
    onMessageReceived();
    if (config.dev?.debugLog) {
      colors.logger.debug("pesan", `${messages.length} pesan, tipe=${type}`);
    }
    if (!connectionState.isReady) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!connectionState.isReady) return;
    }

    const currentSock = connectionState.sock;
    if (!currentSock) return;

    const memberStubTypes = [
      WAMessageStubType.GROUP_PARTICIPANT_ADD,
      WAMessageStubType.GROUP_PARTICIPANT_REMOVE,
      WAMessageStubType.GROUP_PARTICIPANT_LEAVE,
    ];

    for (const msg of messages) {
      const stubType = msg.messageStubType;
      const groupJid = msg.key?.remoteJid;

      if (!msg.message && memberStubTypes.includes(stubType) && groupJid) {
        (async () => {
          try {
            const { getDatabase } = await import("./lib/ichigo-database.js");
            const groupData = getDatabase().getGroup(groupJid) || {};
            if (groupData.memberReact !== true) return;
            const emoji = groupData.memberReactEmoji || "📸";
            await currentSock.sendMessage(groupJid, { react: { text: emoji, key: msg.key } });
          } catch {}
        })();
        continue;
      }

      if (!msg.message && (stubType === 1 || stubType === 132)) {
        if (options.onStubMessage) {
          options.onStubMessage(msg, currentSock).catch(() => {});
        }
        continue;
      }

      if (msg.message?.reactionMessage) {
        (async () => {
          try {
            const reaction = msg.message.reactionMessage;
            const emoji = String(reaction?.text || "").replace(/\uFE0F/g, "").trim();
            if (!emoji) return; // reaksi dihapus, bukan ditambahkan

            const targetKey = reaction.key;
            if (!targetKey?.id) return;

            const { getDatabase } = await import("./lib/ichigo-database.js");
            const db = getDatabase();
            const map = db.setting("cmdReact") || {};
            const entry = map[emoji];
            if (!entry) return;

            const prefix = config.command?.prefix || ".";

            const targetJid = targetKey.remoteJid || msg.key.remoteJid;
            const target = await store.loadMessage(targetJid, targetKey.id);
            if (!target?.message) {
              await currentSock.sendMessage(msg.key.remoteJid, {
                text: `❌ Pesan yang direaksi sudah tidak ada di cache bot (lebih dari ${Math.round(MESSAGE_STORE_TTL / 60000)} menit yang lalu), jadi ${prefix}${entry.command} tidak bisa dijalankan dari reaksi ini.`,
              }).catch(() => {});
              return;
            }

            const targetType =
              Object.keys(target.message).find((k) => k !== "messageContextInfo") ||
              Object.keys(target.message)[0];
            const targetContent = target.message[targetType] || {};
            const targetText =
              targetType === "conversation"
                ? target.message.conversation || ""
                : targetContent.caption || targetContent.text || "";

            let quotedMessage = target.message;
            let quotedParticipant =
              target.key?.participant || target.key?.remoteJid || targetJid;
            let quotedStanzaId = targetKey.id;

            let args = entry.args || "";
            if (args.includes("{quoted}")) {
              const upper = targetContent?.contextInfo?.quotedMessage;
              if (upper) {
                quotedMessage = upper;
                quotedParticipant = targetContent.contextInfo.participant || quotedParticipant;
                quotedStanzaId = targetContent.contextInfo.stanzaId || quotedStanzaId;
              }
              args = args.replace(/\{quoted\}/g, "").trim();
            }
            args = args.replace(/\{reply\}/g, "").trim();
            args = args.replace(/\{text\}/g, targetText).trim();

            const cmdText = `${prefix}${entry.command}${args ? " " + args : ""}`;

            const syntheticMsg = {
              key: {
                remoteJid: msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                id: "CMDREACT" + Date.now(),
                participant: msg.key.participant,
              },
              message: {
                extendedTextMessage: {
                  text: cmdText,
                  contextInfo: {
                    quotedMessage,
                    participant: quotedParticipant,
                    stanzaId: quotedStanzaId,
                    remoteJid: targetJid,
                  },
                },
              },
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: msg.pushName || "User",
            };

            if (options.onMessage) {
              await options.onMessage(syntheticMsg, currentSock);
            }
          } catch (e) {
            colors.logger.error("cmdreact", e.message);
          }
        })();
        continue;
      }

      if (type !== "notify") {
        if (config.dev?.debugLog) {
          colors.logger.debug("pesan", `Skip: type bukan "notify" (type=${type})`);
        }
        continue;
      }

      if (!msg.message) continue;

      // Autoread maksimal: baca paling awal, sebelum filter umur/duplikat/handler
      {
        const t = Object.keys(msg.message)[0];
        const nonChat = [
          "protocolMessage",
          "senderKeyDistributionMessage",
          "reactionMessage",
          "encReactionMessage",
          "pollUpdateMessage",
        ];
        if (!nonChat.includes(t)) {
          const readKey = { ...msg.key };
          try {
            if (isLid(readKey.remoteJid)) {
              readKey.remoteJid = lidToJid(readKey.remoteJid) || readKey.remoteJid;
            }
            if (readKey.participant && isLid(readKey.participant)) {
              readKey.participant =
                lidToJid(readKey.participant) || readKey.participant;
            }
          } catch {}
          queueRead(currentSock, readKey);
        }
      }

      const msgId = msg.key?.id;
      if (msgId && processedMessages.has(msgId)) {
        if (config.dev?.debugLog) {
          colors.logger.debug("pesan", `Skip: duplikat, msgId=${msgId}`);
        }
        continue;
      }
      if (msgId) processedMessages.set(msgId, true);

      let msgTimestamp = 0;
      if (msg.messageTimestamp) {
        if (typeof msg.messageTimestamp.toNumber === "function") {
          msgTimestamp = msg.messageTimestamp.toNumber() * 1000;
        } else {
          msgTimestamp = Number(msg.messageTimestamp) * 1000;
        }
      }

      const CLOCK_SKEW_TOLERANCE_MS = 15 * 1000;
      const botReadyAt = connectionState.readyAt ?? Date.now();
      const MAX_MSG_AGE = 2 * 60 * 1000;

      if (!msgTimestamp) {
        if (config.dev?.debugLog) {
          colors.logger.debug("pesan", `Skip: messageTimestamp kosong/invalid, msgId=${msgId}`);
        }
        continue;
      }

      if (msgTimestamp < botReadyAt - CLOCK_SKEW_TOLERANCE_MS) {
        if (config.dev?.debugLog) {
          colors.logger.debug(
            "pesan",
            `Skip: pesan dianggap sebelum bot ready. msgTimestamp=${new Date(msgTimestamp).toISOString()} readyAt=${new Date(botReadyAt).toISOString()} — kalau ini terus muncul padahal pesan baru dikirim, jam server kemungkinan salah/maju.`,
          );
        }
        continue;
      }

      if ((Date.now() - msgTimestamp) > MAX_MSG_AGE) {
        if (config.dev?.debugLog) {
          colors.logger.debug(
            "pesan",
            `Skip: pesan basi, umur ${(Date.now() - msgTimestamp)}ms > batas ${MAX_MSG_AGE}ms`,
          );
        }
        continue;
      }

      const metadataKeys = [
        "senderKeyDistributionMessage",
        "messageContextInfo",
      ];
      const msgType =
        Object.keys(msg.message).find((k) => !metadataKeys.includes(k)) ||
        Object.keys(msg.message)[0];
      const hasInteractiveResponse = msg.message.interactiveResponseMessage;

      if (msgType === "protocolMessage") {
        const protocolMessage = msg.message.protocolMessage;
        if (protocolMessage?.type === 30 && protocolMessage?.memberLabel) {
          try {
            const { handleLabelChange } =
              await import("../plugins/group/notifgantitag.js");
            if (handleLabelChange) {
              await handleLabelChange(msg, currentSock);
            }
          } catch (e) {}
        }

        if (
          protocolMessage?.type === "MESSAGE_EDIT" ||
          protocolMessage?.type === 14
        ) {
          const edited = protocolMessage.editedMessage;
          if (edited) {
            const originalKey = protocolMessage.key || msg.key;
            const syntheticMsg = {
              key: {
                remoteJid: originalKey.remoteJid || msg.key.remoteJid,
                fromMe: msg.key.fromMe,
                id: originalKey.id,
                participant: msg.key.participant,
              },
              message: edited,
              messageTimestamp: Math.floor(Date.now() / 1000),
              pushName: msg.pushName || "User",
            };

            if (options.onMessage) {
              await options.onMessage(syntheticMsg, currentSock);
            }
          }
        }

        continue;
      }

      const allMsgKeys = Object.keys(msg.message || {});

      const isStatusMention =
        allMsgKeys.includes("groupStatusMessage") ||
        allMsgKeys.includes("groupStatusMessageV2") ||
        allMsgKeys.includes("groupStatusMentionMessage") ||
        allMsgKeys.includes("groupMentionedMessage") ||
        allMsgKeys.includes("statusMentionMessage") ||
        msg.message?.viewOnceMessage?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessage?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessageV2Extension?.message?.groupStatusMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMessageV2 ||
        msg.message?.ephemeralMessage?.message?.groupStatusMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMessageV2 ||
        msg.message?.viewOnceMessage?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2?.message?.groupStatusMentionMessage ||
        msg.message?.viewOnceMessageV2Extension?.message
          ?.groupStatusMentionMessage ||
        msg.message?.ephemeralMessage?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.message?.groupStatusMessage ||
        msg.message?.[msgType]?.message?.groupStatusMessageV2 ||
        msg.message?.[msgType]?.message?.groupStatusMentionMessage ||
        msg.message?.[msgType]?.contextInfo?.groupMentions?.length > 0;

      const hasGroupMentionInContext = (() => {
        const content = msg.message?.[msgType];
        if (content?.contextInfo?.groupMentions?.length > 0) return true;

        const viewOnce =
          msg.message?.viewOnceMessage?.message ||
          msg.message?.viewOnceMessageV2?.message ||
          msg.message?.viewOnceMessageV2Extension?.message;
        if (viewOnce) {
          const vType = Object.keys(viewOnce)[0];
          if (viewOnce[vType]?.contextInfo?.groupMentions?.length > 0)
            return true;
        }
        return false;
      })();

      if (isStatusMention || hasGroupMentionInContext) {
        const groupJid = msg.key.remoteJid;

        try {
          const { getDatabase } = await import("./lib/ichigo-database.js");
          const { handleAntiTagSW, handleAntiSwGc } =
            await import("./lib/ichigo-group-protection.js");
          const db = getDatabase();
          if (groupJid?.endsWith("@g.us")) {
            const antiTagHandled = await handleAntiTagSW(msg, currentSock, db);
            if (!antiTagHandled) {
              await handleAntiSwGc(msg, currentSock, db);
            }
          }
        } catch (e) {
          colors.logger.error("antitagsw", e.message);
        }
      }

      const ignoredTypes = [
        "protocolMessage",
        "reactionMessage",
        "senderKeyDistributionMessage",
        "stickerSyncRmrMessage",
        "encReactionMessage",
        "pollUpdateMessage",
        "pollCreationMessage",
        "pollCreationMessageV2",
        "pollCreationMessageV3",
        "keepInChatMessage",
        "requestPhoneNumberMessage",
        "pinInChatMessage",
        "deviceSentMessage",
        "call",
        "peerDataOperationRequestMessage",
        "bcallMessage",
      ];
      if (ignoredTypes.includes(msgType) && !hasInteractiveResponse) {
        continue;
      }

      let jid = msg.key.remoteJid || "";

      if (msg.key.fromMe && type === "append" && jid !== "status@broadcast") {
        continue;
      }

      if (jid === "status@broadcast") {
        try {
          let participant = msg.key.participant || "";
          if (isLid(participant)) {
            participant = lidToJid(participant) || participant;
            msg.key.participant = participant;
          }

          const { getDatabase } = await import("./lib/ichigo-database.js");
          const db = getDatabase();
          const autoReadSW = db.setting("autoReadSW") || {};
          const autoReactSW = db.setting("autoReactSW") || {};
          if (
            autoReadSW.enabled &&
            participant &&
            !participant.endsWith("@lid")
          ) {
            await currentSock
              .sendReceipt(
                "status@broadcast",
                participant,
                [msg.key.id],
                "read",
              )
              .catch(() => {});
          }

          if (
            autoReactSW.enabled &&
            participant &&
            !participant.endsWith("@lid")
          ) {
            const emoji = autoReactSW.emoji || "🔥";
            await currentSock
              .sendMessage(
                "status@broadcast",
                {
                  react: { text: emoji, key: msg.key },
                },
                {
                  statusJidList: [participant],
                },
              )
              .catch(() => {});
          }
        } catch (e) {
          colors.logger.debug("story", `auto story error: ${e.message}`);
        }
        continue;
      }

      if (isLid(jid)) {
        jid = lidToJid(jid);
        msg.key.remoteJid = jid;
      }

      if (msg.key.participant && isLid(msg.key.participant)) {
        msg.key.participant = lidToJid(msg.key.participant);
      }
      if (jid.endsWith("@broadcast")) {
        continue;
      }
      if (!jid || jid === "undefined" || jid.length < 5) {
        continue;
      }
      if (options.onRawMessage) {
        try {
          await options.onRawMessage(msg, currentSock);
        } catch (error) {}
      }

      const messageBody = (() => {
        const m = msg.message;
        if (!m) return "";
        const type = Object.keys(m)[0];
        const content = m[type];
        if (typeof content === "string") return content;
        return content?.text || content?.caption || content?.conversation || "";
      })();

      const isGroup = msg.key.remoteJid?.endsWith("@g.us");
      const senderJid = isGroup
        ? msg.key.participantAlt || msg.key.participant
        : msg.key.remoteJidAlt || msg.key.remoteJid || "";
      const isOwner = isOwners(senderJid);
      // Snippet hasil .crm (=> conn.relayMessage(...)) diserahkan ke plugin eval lewat handler
      const isCrmSnippet = /^=>\s*(conn|sock)\.relayMessage\s*\(/.test(messageBody);
      if (isOwner && messageBody.startsWith("=>") && !isCrmSnippet) {
        console.log("Owner", "Executing code");
        const code = messageBody.slice(2).trim();
        if (code) {
          try {
            const { serialize } = await import("./lib/ichigo-serialize.js");
            const m = await serialize(currentSock, msg, {});
            const { getDatabase: _getDb } =
              await import("./lib/ichigo-database.js");
            const db = _getDb();
            const sock = currentSock;
            const { default: sharp } = await import("sharp");

            let result;
            if (code.startsWith("{")) {
              result = await eval(`(async () => ${code})()`);
            } else {
              // Coba sebagai ekspresi dulu; kalau SyntaxError (mis. kode diawali
              // "return" / "const" / banyak statement) jalankan apa adanya sebagai isi fungsi.
              let fn;
              try {
                const expr = code.replace(/[;\s]+$/, "");
                fn = eval(`(async () => { return (${expr}\n) })`);
              } catch (e) {
                if (!(e instanceof SyntaxError)) throw e;
              }
              if (!fn) fn = eval(`(async () => { ${code}\n })`);
              result = await fn();
            }

            if (typeof result !== "string") {
              const { inspect } = await import("util");
              result = inspect(result, { depth: 2 });
            }
            // Pakai m.reply biar tampilannya ngikutin gaya reply (.setreply), sama kayak plugin eval
            await m.reply(result);
          } catch (err) {
            await currentSock.sendMessage(
              jid,
              {
                text: `❌ *ᴇᴠᴀʟ ᴇʀʀᴏʀ*\n\n\`\`\`\n${err.message}\n\`\`\``,
              },
              { quoted: msg },
            );
          }
          continue;
        }
      }

      if (isOwner && messageBody.startsWith("$")) {
        const command = messageBody.slice(1).trim();
        if (command) {
          try {
            const { exec } = await import("child_process");
            const { promisify } = await import("util");
            const execAsync = promisify(exec);

            const isWindows = process.platform === "win32";
            const shell = isWindows ? "powershell.exe" : "/bin/bash";

            await currentSock.sendMessage(
              jid,
              {
                text: `🕕 *ᴇxᴇᴄᴜᴛɪɴɢ...*\n\n\`$ ${command}\``,
              },
              { quoted: msg },
            );

            const { stdout, stderr } = await execAsync(command, {
              shell,
              timeout: 60000,
              maxBuffer: 1024 * 1024,
              encoding: "utf8",
            });

            const output = stdout || stderr || "No output";

            await currentSock.sendMessage(jid, {
              text: `✅ *ᴛᴇʀᴍɪɴᴀʟ*\n\n\`$ ${command}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``,
            });
          } catch (err) {
            const errorMsg = err.stderr || err.stdout || err.message;
            await currentSock.sendMessage(jid, {
              text: `❌ *ᴛᴇʀᴍɪɴᴀʟ ᴇʀʀᴏʀ*\n\n\`$ ${command}\`\n\n\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\``,
            });
          }
          continue;
        }
      }

      if (options.onMessage) {
        options.onMessage(msg, currentSock).catch((error) => {
          colors.logger.error("Message", error.message);
        });
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    if (options.onMessageUpdate) {
      await options.onMessageUpdate(updates, sock);
    }
  });

  {
    const { getDatabase: _getDb } = await import("./lib/ichigo-database.js");
    const _db = _getDb();
    if (_db.setting("antiCall") ?? config.features?.antiCall) {
      sock.ev.on("call", async (calls) => {
        for (const call of calls) {
          if (call.status === "offer") {
            colors.logger.warn("Call", `Menolak panggilan dari ${call.from}`);
            await sock.rejectCall(call.id, call.from);

            await sock.sendMessage(call.from, {
              text: config.messages?.rejectCall,
            });

            if (config.features?.blockIfCall) {
              let targetJid = call.from;

              if (targetJid.endsWith("@lid")) {
                try {
                  const pn =
                    await sock.signalRepository?.lidMapping?.getPNForLID(
                      targetJid,
                    );
                  if (pn) {
                    targetJid = pn;
                    colors.logger.info(
                      "Call",
                      `Berhasil resolve @lid ke PN: ${targetJid}`,
                    );
                  }
                } catch (e) {
                  colors.logger.warn(
                    "Call",
                    `Gagal resolve LID ke PN: ${e.message}`,
                  );
                }
              }

              if (!targetJid.endsWith("@lid")) {
                try {
                  const sanitizedJid = targetJid.replace(/:\d+@/, "@");
                  await _db.setUser(sanitizedJid, { isBlocked: true });

                  try {
                    await sock.updateBlockStatus(
                      sanitizedJid.split("@")[0],
                      "block",
                    );
                    colors.logger.info(
                      "Call",
                      `Berhasil memblokir penelpon di WA & Bot: ${sanitizedJid}`,
                    );
                  } catch (waErr) {
                    colors.logger.warn(
                      "Call",
                      `Diblokir di DB Bot, tapi gagal di WA Server (${sanitizedJid}): ${waErr.message}`,
                    );
                  }
                } catch (e) {
                  colors.logger.error(
                    "Call",
                    `Gagal memblokir di DB: ${e.message}`,
                  );
                }
              } else {
                colors.logger.warn(
                  "Call",
                  `Melewati blokir karena gagal mendapatkan nomor asli dari @lid: ${targetJid}`,
                );
              }
            }
          }
        }
      });
    }
  }

  process.nextTick(() => {
    try {
      sock.ev?.flush?.();
    } catch {}
  });

  setTimeout(() => {
    try {
      sock.ev?.flush?.();
    } catch {}
  }, 2000);

  const flushInterval = setInterval(() => {
    if (!connectionState.isConnected) {
      clearInterval(flushInterval);
      return;
    }
    try {
      sock.ev?.flush?.();
    } catch {}
  }, 30000);
  if (flushInterval.unref) flushInterval.unref();

  return sock;
}

/**
 * Mendapatkan status koneksi
 * @returns {ConnectionState} State koneksi saat ini
 */
function getConnectionState() {
  return connectionState;
}

/**
 * Mendapatkan socket instance
 * @returns {Object|null} Socket atau null jika tidak terkoneksi
 */
function getSocket() {
  return connectionState.sock;
}

/**
 * Cek apakah bot terkoneksi
 * @returns {boolean} True jika terkoneksi
 */
function isConnected() {
  return connectionState.isConnected;
}

/**
 * Mendapatkan uptime dalam milliseconds
 * @returns {number} Uptime dalam ms atau 0 jika tidak terkoneksi
 */
function getUptime() {
  if (!connectionState.connectedAt) return 0;
  return Date.now() - connectionState.connectedAt.getTime();
}

/**
 * Logout dan hapus session
 * @returns {Promise<boolean>} True jika berhasil
 */
async function logout() {
  try {
    const sessionPath = path.join(
      process.cwd(),
      "storage",
      config.session?.folderName || "session",
    );

    isShuttingDown = true;
    clearPendingReconnect();
    stopWatchdog();

    if (connectionState.sock) {
      try {
        await connectionState.sock.logout();
      } catch (e) {}
    }
    closeExistingSocket("manual logout");

    clearSessionFolder(sessionPath);

    connectionState.isConnected = false;
    connectionState.isReady = false;
    connectionState.sock = null;
    connectionState.connectedAt = null;
    connectionState.reconnectAttempts = 0;

    colors.logger.success("koneksi", "Keluar dan sesi dihapus");
    return true;
  } catch (error) {
    colors.logger.error("koneksi", "Gagal logout:", error.message);
    return false;
  }
}

export {
  startConnection,
  closeConnection,
  getConnectionState,
  getSocket,
  isConnected,
  getUptime,
  logout,
  getCachedGroupMetadata,
  groupCache,
};