import { getDatabase } from "../../src/lib/ichigo-database.js";
import { logger } from "../../src/lib/ichigo-logger.js";

const afkCooldown = global.afkCooldown || (global.afkCooldown = new Map());

const pluginConfig = {
  name: "afk",
  alias: ["away", "brb"],
  category: "group",
  description: "Set status AFK dengan alasan",
  usage: ".afk <alasan>",
  example: ".afk lagi makan",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function getAfkUser(chat, jid) {
  if (!chat || !jid) return null;
  const group = getDatabase().getGroup(chat);
  return group?.afk?.[jid] || null;
}

function setAfkUser(chat, jid, reason) {
  if (!chat || !jid) return;
  const db = getDatabase();
  const group = db.getGroup(chat);
  const afk = { ...(group?.afk || {}) };
  afk[jid] = {
    reason: reason || "Tidak ada alasan",
    time: Date.now(),
  };
  db.setGroup(chat, { afk });
}

function removeAfkUser(chat, jid) {
  if (!chat || !jid) return;
  const db = getDatabase();
  const group = db.getGroup(chat);
  if (!group?.afk?.[jid]) return;
  const afk = { ...group.afk };
  delete afk[jid];
  db.setGroup(chat, { afk });
}

function isUserAfk(chat, jid) {
  return !!getAfkUser(chat, jid);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} detik`);
  return parts.join(" ");
}

/**
 * Kirim notifikasi AFK lewat m.reply, jadi tampilannya otomatis mengikuti
 * variant reply yang diatur lewat .setreply (ichigo-serialize.js).
 */
async function sendAfkNotice(m, text, mentions = []) {
  try {
    await m.reply(text, { mentions });
  } catch (e) {
    logger.error("AFK", `Notifikasi gagal dikirim: ${e?.message || e}`);
  }
}

async function handler(m) {
  const reason = (m.text || "").trim() || "Tidak ada alasan";
  setAfkUser(m.chat, m.sender, reason);

  const num = m.sender.split("@")[0];
  const text =
    `*AFK AKTIF*\n\n` +
    `@${num} sekarang lagi AFK\n` +
    `Alasan : ${reason}\n\n` +
    `_Kirim pesan apa saja di grup untuk menandai kamu sudah kembali._`;

  await sendAfkNotice(m, text, [m.sender]);
}

async function checkAfk(m, sock, botConfig = {}, isJadibot = false) {
  try {
    await runCheckAfk(m, sock, botConfig, isJadibot);
  } catch (e) {
    logger.error("AFK", `checkAfk error: ${e?.stack || e}`);
  }
}

async function runCheckAfk(m, sock, botConfig = {}, isJadibot = false) {
  
  if (!m.isGroup) return;

  const instanceKey = isJadibot ? "jadibot" : "main";
  const msgKey = `${instanceKey}_${m.chat}_${m.sender}_${m.id || Date.now()}`;
  if (afkCooldown.has(msgKey)) return;
  afkCooldown.set(msgKey, Date.now());

  if (afkCooldown.size > 200) {
    const cutoff = Date.now() - 10000;
    for (const [k, v] of afkCooldown) {
      if (v < cutoff) afkCooldown.delete(k);
    }
  }

  const wasAfkKey = `wasAfk_${m.chat}_${m.sender}`;
  const jadibotSentKey = `jadibotSent_${m.chat}_${m.sender}`;

  if (isJadibot) {
    
    await new Promise((r) => setTimeout(r, 2000));

    if (global[wasAfkKey] && !global[jadibotSentKey]) {
      global[jadibotSentKey] = true;
      
      setTimeout(() => { delete global[jadibotSentKey]; }, 5000);

      const num = m.sender.split("@")[0];
      const text =
        `*WELCOME BACK*\n\n` +
        `@${num} sudah kembali dari AFK`;
      await sendAfkNotice(m, text, [m.sender]);
    }
    return; 
  }

  const notified = new Set();

  const afkData = getAfkUser(m.chat, m.sender);
  if (afkData) {
    const isAfkCmd =
      m.body?.startsWith?.(".afk") ||
      m.body?.startsWith?.("/afk") ||
      m.body?.startsWith?.("!afk");
    if (isAfkCmd) return;

    removeAfkUser(m.chat, m.sender);

    global[wasAfkKey] = true;
    global[jadibotSentKey] = false;
    setTimeout(() => {
      delete global[wasAfkKey];
      delete global[jadibotSentKey];
    }, 10000);

    notified.add(m.sender);
    const duration = formatDuration(Date.now() - afkData.time);
    const num = m.sender.split("@")[0];
    const text =
      `*WELCOME BACK*\n\n` +
      `@${num} sudah kembali dari AFK\n` +
      `Alasan : ${afkData.reason}\n` +
      `Lama   : ${duration}`;

    await sendAfkNotice(m, text, [m.sender]);
  }

  if (m.isGroup && m.mentionedJid && m.mentionedJid.length > 0) {
    for (const mentioned of m.mentionedJid) {
      if (notified.has(mentioned)) continue;
      const mentionedAfk = getAfkUser(m.chat, mentioned);
      if (!mentionedAfk) continue;

      const duration = formatDuration(Date.now() - mentionedAfk.time);
      const num = mentioned.split("@")[0];
      const text =
        `*DIA LAGI AFK*\n\n` +
        `@${num} sedang tidak aktif, jangan diganggu dulu ya\n` +
        `Alasan : ${mentionedAfk.reason}\n` +
        `Sejak  : ${duration} yang lalu`;

      await sendAfkNotice(m, text, [mentioned]);
      notified.add(mentioned);
    }
  }

  if (m.isGroup && m.quoted) {
    const quotedSender = m.quoted.sender || m.quoted.participant || null;
    if (quotedSender && quotedSender !== m.sender && !notified.has(quotedSender)) {
      const quotedAfk = getAfkUser(m.chat, quotedSender);
      if (quotedAfk) {
        const duration = formatDuration(Date.now() - quotedAfk.time);
        const num = quotedSender.split("@")[0];
        const text =
          `*DIA LAGI AFK*\n\n` +
          `@${num} yang kamu balas sedang tidak aktif\n` +
          `Alasan : ${quotedAfk.reason}\n` +
          `Sejak  : ${duration} yang lalu`;

        await sendAfkNotice(m, text, [quotedSender]);
        notified.add(quotedSender);
      }
    }
  }
}

export {
  pluginConfig as config,
  handler,
  checkAfk,
  getAfkUser,
  setAfkUser,
  removeAfkUser,
  isUserAfk,
};