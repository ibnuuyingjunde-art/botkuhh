import * as ichigo from "ichigo";
import te from "../../src/lib/ichigo-error.js";
import { sendBatchPrivateRelay } from "../../src/spr/sbpr.js";

const pluginConfig = {
  name: "bprswgc",
  alias: ["bprgc", "bprgrup"],
  category: "owner",
  description: "BPR status grup (swgc) ke SATU grup: tiap member menerima status berisi foto profilnya sendiri",
  usage: ".bprswgc [pesan]",
  example: ".bprswgc Halo @user, cek DM ya",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const DEFAULT_CAPTION = "Ini adalah foto profil kamu 📸";
const IMG_TIMEOUT = 15000;
const MAX_IMG = 3 * 1024 * 1024;
const CONCURRENCY = 5;

async function downloadImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMG_TIMEOUT) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length && buf.length <= MAX_IMG ? buf : null;
  } catch {
    return null;
  }
}

// Struktur status grup sama persis dengan plugin swgcv3:
// { groupStatusMessageV2: { message: { <tipe>Message: {..., contextInfo: {isGroupStatus...}} } } }
function statusContext(sourceType, pn) {
  return {
    isGroupStatus: true,
    statusSourceType: sourceType, // 0 = gambar, 4 = teks
    featureEligibilities: { canBeReshared: true, canBeSentToParticipants: true },
    statusAttributions: [{ type: 10 }],
    statusAudienceMetadata: { audienceType: 0 },
    ...(pn ? { mentionedJid: [pn] } : {}),
  };
}

async function buildStatusImage(sock, buf, caption, pn) {
  const media = await ichigo.prepareWAMessageMedia({ image: buf }, { upload: sock.waUploadToServer });
  if (!media?.imageMessage) throw new Error("gagal upload gambar");
  return {
    groupStatusMessageV2: {
      message: { imageMessage: { ...media.imageMessage, caption, contextInfo: statusContext(0, pn) } },
    },
  };
}

function buildStatusText(text, pn) {
  return {
    groupStatusMessageV2: {
      message: { extendedTextMessage: { text, contextInfo: statusContext(4, pn) } },
    },
  };
}

async function runPool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

const phoneOf = (jid) => String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

async function resolveParticipantPn(sock, p) {
  if (!p) return null;
  for (const c of [p.phoneNumber, p.id]) {
    if (c && !String(c).includes("@lid")) {
      const ph = phoneOf(c);
      if (ph.length >= 8) return ph + "@s.whatsapp.net";
    }
  }
  try {
    const pn = await sock.signalRepository?.lidMapping?.getPNForLID(p.id);
    if (pn && !String(pn).includes("@lid")) {
      const ph = phoneOf(pn);
      if (ph.length >= 8) return ph + "@s.whatsapp.net";
    }
  } catch {}
  return null;
}

async function handler(m, { sock }) {
  try {
    let raw = String(m.text || "").trim();

    // Grup tujuan: grup tempat perintah dipakai, atau JID grup di awal pesan (bisa dari chat pribadi)
    let groupJid = m.isGroup ? m.chat : null;
    const first = raw.split(/\s+/)[0] || "";
    if (first.endsWith("@g.us")) {
      groupJid = first;
      raw = raw.slice(first.length).trim();
    }

    // Default: status grup (swgc). Tambah "-i" di awal pesan untuk gambar biasa (seperti .bpr all).
    let useStatus = true;
    if (/^(-i|--image)(\s|$)/i.test(raw)) {
      useStatus = false;
      raw = raw.replace(/^(-i|--image)\s*/i, "").trim();
    }

    if (!groupJid) {
      return m.reply("Pakai di dalam grup, atau dari chat pribadi: .bprswgc <id_grup@g.us> <pesan>");
    }
    if (raw === "help") {
      return m.reply(
        `*BPR Satu Grup*\n\n` +
        `Kirim status grup (swgc) berisi foto profil tiap member, hanya terlihat oleh dia sendiri + tag (member lain lihat placeholder).\n\n` +
        `.bprswgc (status grup: pp + teks "ini pp kamu")\n` +
        `.bprswgc <pesan> (status grup: pp + caption)\n` +
        `.bprswgc -i <pesan> (gambar biasa, bukan status)\n` +
        `   tulis @user kalau mau menyisipkan tag member\n` +
        `.bprswgc <id_grup@g.us> <pesan> (dari chat pribadi)`
      );
    }

    m.react?.("🕕");

    const meta = await sock.groupMetadata(groupJid);
    const selfId = sock?.authState?.creds?.me?.id || sock?.user?.id;
    const selfLid = sock?.authState?.creds?.me?.lid;

    const members = [];
    for (const p of meta.participants || []) {
      if (p.id === selfId || p.id === selfLid) continue;
      const pn = await resolveParticipantPn(sock, p);
      if (pn) members.push({ p, pn });
    }

    const targets = [];
    let noPp = 0;
    let errLogged = false;

    await runPool(members, CONCURRENCY, async ({ p, pn }) => {
      const tag = "@" + phoneOf(pn);
      // Tanpa nomor di caption. Default: teks "ini pp kamu". Tag hanya muncul kalau kamu tulis @user sendiri.
      const hasTag = /@user/i.test(raw);
      const caption = !raw ? DEFAULT_CAPTION : hasTag ? raw.replace(/@user/gi, tag) : raw;
      const mentionPn = hasTag ? pn : null;

      // Ambil pp; kalau tidak ada pakai avatar random (sama seperti .bpr all)
      let url = null;
      try { url = await sock.profilePictureUrl(pn, "image"); } catch {}
      const usedFallback = !url;
      if (!url) url = `https://picsum.photos/seed/${phoneOf(pn)}/400/400`;
      if (usedFallback) noPp++;

      let message = null;
      try {
        const buf = await downloadImage(url);
        if (buf) {
          if (useStatus) {
            message = await buildStatusImage(sock, buf, caption, mentionPn);
          } else if (sock.waUploadToServer) {
            const media = await ichigo.prepareWAMessageMedia({ image: buf }, { upload: sock.waUploadToServer });
            if (media?.imageMessage) {
              message = { imageMessage: { ...media.imageMessage, caption, ...(mentionPn ? { contextInfo: { mentionedJid: [mentionPn] } } : {}) } };
            }
          }
        }
      } catch (e) {
        if (!errLogged) { errLogged = true; console.error("[BPRSWGC] gagal siapkan pesan:", e.message); }
      }

      // Gagal siapkan gambar: kirim teks saja kalau ada pesan
      if (!message && raw) {
        message = useStatus
          ? buildStatusText(caption, mentionPn)
          : { extendedTextMessage: { text: caption, ...(mentionPn ? { contextInfo: { mentionedJid: [mentionPn] } } : {}) } };
      }

      if (message) targets.push({ target: p.id, message });
    });

    if (!targets.length) {
      m.react?.("❌");
      return m.reply("Tidak ada member yang bisa dikirimi (gagal siapkan gambar / tidak bisa di-resolve). Cek log konsol.");
    }

    await sendBatchPrivateRelay(sock, groupJid, targets, {
      msgForOthers: global.fakeMsgPlaceholder || "pesan rahasia",
      // Penanda status grup, sama seperti relayMessage di swgcv3
      ...(useStatus ? { additionalNodes: [{ tag: "meta", attrs: { is_group_status: "true" } }] } : {}),
    });

    m.react?.("✅");
    if (noPp) await m.reply(`ℹ️ ${noPp} member tanpa foto profil, dikirimi avatar random.`);
  } catch (err) {
    console.error("[BPRSWGC] Error:", err.message);
    m.react?.("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };