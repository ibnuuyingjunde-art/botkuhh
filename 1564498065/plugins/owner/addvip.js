import { getDatabase } from "../../src/lib/ichigo-database.js";

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

function parseDuration(str) {
  if (!str) return -1;
  const match = str.match(/^(\d+)(d|h|m|bulan|hari|jam|menit)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const ms = {
    d: 864e5, hari: 864e5,
    h: 36e5, jam: 36e5,
    m: 6e4, menit: 6e4,
    bulan: 864e5 * 30,
  }[unit];
  return ms ? val * ms : null;
}

function extractTarget(m) {
  if (m.quoted?.sender) return m.quoted.sender;
  if (m.mentionedJid?.length) return m.mentionedJid[0];
  const numArg = m.args?.find(a => /^[0-9]{8,15}$/.test(a));
  if (numArg) return numArg + "@s.whatsapp.net";
  return null;
}

const pluginConfig = {
  name: "addvip",
  alias: ["setvip", "gibbvip"],
  category: "owner",
  description: "Tambah VIP ke user",
  usage: ".addvip @user [durasi]",
  example: ".addvip @user 30d",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const targetJid = extractTarget(m);

  if (!targetJid) {
    return m.reply(
      `❌ *Siapa yang mau di-VIP?*\n\n` +
      `Cara pakai:\n` +
      `> \`${m.prefix}addvip @user\` — permanen\n` +
      `> \`${m.prefix}addvip @user 30d\` — 30 hari\n` +
      `> \`${m.prefix}addvip @user 7hari\` — 7 hari\n` +
      `> \`${m.prefix}addvip @user 12jam\` — 12 jam`
    );
  }

  const durasiArg = m.args?.find(a => /^\d+(d|h|m|hari|jam|menit|bulan)$/i.test(a));
  const durasiMs = parseDuration(durasiArg);

  if (durasiMs === null) {
    return m.reply(`❌ Format durasi tidak valid.\nContoh: \`30d\`, \`7hari\`, \`12jam\`, \`30menit\``);
  }

  const vipExpired = durasiMs === -1 ? -1 : Date.now() + durasiMs;
  const user = db.getUser(targetJid) || db.setUser(targetJid);

  db.setUser(targetJid, {
    ...user,
    isVip: true,
    vipExpired,
    energi: -1,
  });
  db.save();

  await m.react("💎");
  return m.reply(
    `💎 *VIP BERHASIL DITAMBAHKAN*\n\n` +
    `╭┈┈「 INFO 」\n` +
    `┃ 👤 User    : @${targetJid.split("@")[0]}\n` +
    `┃ ⏳ Durasi  : ${durasiArg || "Permanen"}\n` +
    `┃ 📅 Expired : ${formatExpired(vipExpired)}\n` +
    `╰┈┈┈┈┈┈┈┈`,
    { mentions: [targetJid] }
  );
}

export { pluginConfig as config, handler };