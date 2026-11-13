import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "antilinkwa",
  alias: ["alwa", "antilinkwhatsapp"],
  category: "group",
  description: "Anti link WhatsApp (wa.me, chat.whatsapp.com, channel)",
  usage: ".antilinkwa <on/off/metode>",
  example: ".antilinkwa on",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
  isAdmin: true,
  isBotAdmin: true,
};

function handler(m) {
  const db = getDatabase();
  const option = m.text?.toLowerCase()?.trim();

  if (!option) {
    const groupData = db.getGroup(m.chat) || {};
    const status = groupData.antilinkwa || "off";
    const mode = groupData.antilinkallMode || "remove";

    return m.reply(
      `🔗 *Antilink WA*\n\n` +
        `> Status: *${status === "on" ? "Aktif ✅" : "Nonaktif ❌"}*\n` +
        `> Mode: *${mode.toUpperCase()}*\n\n` +
        `*DETEKSI:*\n` +
        `> • chat.whatsapp.com (link grup WA)\n` +
        `> • wa.me (link kontak WA)\n` +
        `> • whatsapp.com/channel\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}antilinkwa on* — Aktifkan\n` +
        `> *${m.prefix}antilinkwa off* — Nonaktifkan\n` +
        `> *${m.prefix}antilinkwa metode kick* — Mode kick\n` +
        `> *${m.prefix}antilinkwa metode remove* — Mode hapus`
    );
  }

  if (option === "on") {
    db.setGroup(m.chat, { antilinkwa: "on" });
    return m.reply(`✅ *Antilink WA Aktif*\n\n> Link WhatsApp akan dideteksi otomatis`);
  }

  if (option === "off") {
    db.setGroup(m.chat, { antilinkwa: "off" });
    return m.reply(`❌ *Antilink WA Nonaktif*\n\n> Link WhatsApp tidak akan difilter lagi`);
  }

  if (option.startsWith("metode")) {
    const method = m.args?.[1]?.toLowerCase();
    if (method === "kick") {
      db.setGroup(m.chat, { antilinkallMode: "kick" });
      return m.reply(`✅ *Mode Kick*\n\n> User yang kirim link WA akan di-kick`);
    } else if (method === "remove" || method === "delete") {
      db.setGroup(m.chat, { antilinkallMode: "remove" });
      return m.reply(`✅ *Mode Delete*\n\n> Pesan dengan link WA akan dihapus`);
    } else {
      return m.reply(`❌ *Metode Tidak Valid*\n\n> Gunakan *kick* atau *remove*`);
    }
  }

  return m.reply(`❌ *Opsi Tidak Valid*\n\n> Gunakan *on*, *off*, *metode kick*, atau *metode remove*`);
}

export { pluginConfig as config, handler };