import { getDatabase } from "../../src/lib/ichigo-database.js";

function isVipActive(user) {
  if (!user?.isVip) return false;
  if (!user.vipExpired || user.vipExpired === -1) return true;
  return Date.now() < user.vipExpired;
}

function formatExpired(ts) {
  if (!ts || ts === -1) return "♾️ Permanen";
  const sisa = ts - Date.now();
  if (sisa <= 0) return "❌ Expired";
  const d = Math.floor(sisa / (1000 * 60 * 60 * 24));
  const h = Math.floor((sisa % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const min = Math.floor((sisa % (1000 * 60 * 60)) / (1000 * 60));
  if (d > 0) return `${d}h ${h}j lagi`;
  if (h > 0) return `${h}j ${min}m lagi`;
  return `${min}m lagi`;
}

function extractTarget(m) {
  if (m.quoted?.sender) return m.quoted.sender;
  if (m.mentionedJid?.length) return m.mentionedJid[0];
  const numArg = m.args?.find(a => /^[0-9]{8,15}$/.test(a));
  if (numArg) return numArg + "@s.whatsapp.net";
  return null;
}

const pluginConfig = {
  name: "cekvip",
  alias: ["checkvip", "vipinfo", "statusvip"],
  category: "user",
  description: "Cek status VIP user",
  usage: ".cekvip [@user]",
  example: ".cekvip",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const targetJid = extractTarget(m) || m.sender;
  const isSelf = targetJid === m.sender;
  const user = db.getUser(targetJid);

  if (!user || !isVipActive(user)) {
    return m.reply(
      `💎 *CEK VIP*\n\n` +
      `╭┈┈「 INFO 」\n` +
      `┃ 👤 User   : @${targetJid.split("@")[0]}\n` +
      `┃ ❌ Status : Bukan VIP\n` +
      `╰┈┈┈┈┈┈┈┈`,
      { mentions: [targetJid] }
    );
  }

  return m.reply(
    `💎 *CEK VIP*\n\n` +
    `╭┈┈「 VIP INFO 」\n` +
    `┃ 👤 User    : @${targetJid.split("@")[0]}\n` +
    `┃ ✅ Status  : Aktif\n` +
    `┃ ⏳ Expired : ${formatExpired(user.vipExpired)}\n` +
    `╰┈┈┈┈┈┈┈┈`,
    { mentions: [targetJid] }
  );
}

export { pluginConfig as config, handler };