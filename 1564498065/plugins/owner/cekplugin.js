import { initPluginWatcher, getPluginEvents } from "../../src/lib/ichigo-plugin-watcher.js";

const pluginConfig = {
  name: "cekplugin",
  alias: ["pluginbaru", "newplugin", "recentplugin", "cekpl"],
  category: "owner",
  description: "Cek plugin yang beneran ditambah/diubah/dihapus secara realtime",
  usage: ".cekplugin <jumlah hari>",
  example: ".cekplugin 1",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

initPluginWatcher();

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

const EVENT_LABEL = {
  added: "🆕 Baru ditambah",
  modified: "✏️ Diubah",
  removed: "🗑️ Dihapus",
};

async function handler(m, { sock }) {
  if (!m.isOwner) {
    return m.reply("❌ *Owner Only!*");
  }

  const rawDays = m.args?.[0]?.trim();
  const days = rawDays && !isNaN(rawDays) && Number(rawDays) > 0 ? Number(rawDays) : 1;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const allEvents = getPluginEvents();
  const recentEvents = allEvents
    .filter((e) => e.time >= cutoff && e.event !== "existing")
    .sort((a, b) => b.time - a.time);

  if (recentEvents.length === 0) {
    return m.reply(
      `📦 *ᴄᴇᴋ ᴘʟᴜɢɪɴ ʀᴇᴀʟᴛɪᴍᴇ*\n\n` +
      `> Belum ada perubahan plugin yang kedetect dalam *${days} hari* terakhir.\n\n` +
      `╭┈┈⬡「 📋 *ғᴏʀᴍᴀᴛ* 」\n` +
      `┃ .cekplugin <jumlah hari>\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `*Contoh:*\n` +
      `> .cekplugin 1\n` +
      `> .cekplugin 7\n\n` +
      `ℹ️ _Sistem ini ngecek plugin secara realtime (polling tiap 5 detik) sejak bot mulai nyala. Plugin yang udah ada sebelum watcher aktif dianggap baseline, bukan "baru"._`,
    );
  }

  const grouped = {};
  for (const e of recentEvents) {
    if (!grouped[e.category]) grouped[e.category] = [];
    grouped[e.category].push(e);
  }

  let text = `📦 *ᴄᴇᴋ ᴘʟᴜɢɪɴ ʀᴇᴀʟᴛɪᴍᴇ*\n\n`;
  text += `> Ditemukan *${recentEvents.length} perubahan* dalam *${days} hari* terakhir\n\n`;

  for (const [category, events] of Object.entries(grouped)) {
    text += `╭┈┈⬡「 ☘ *${category}* 」\n`;
    for (const e of events) {
      text += `┃ ${EVENT_LABEL[e.event] || e.event} : ${e.name} _(${timeAgo(e.time)})_\n`;
    }
    text += `╰┈┈┈┈┈┈┈┈⬡\n\n`;
  }

  await m.reply(text.trim());
}

export { pluginConfig as config, handler };