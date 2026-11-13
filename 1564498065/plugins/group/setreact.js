import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setreact",
  alias: ["memberreact", "reactmember"],
  category: "group",
  description: "Toggle & atur emoji react otomatis saat member masuk/keluar grup",
  usage: ".setreact <on/off/emoji> [emoji]",
  example: ".setreact on\n.setreact emoji 🎉",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const args = m.args || [];
  const sub = args[0]?.toLowerCase();
  const groupData = db.getGroup(m.chat) || {};
  const currentStatus = groupData.memberReact === true;
  const currentEmoji = groupData.memberReactEmoji || "📸";

  if (!sub) {
    return m.reply(
      `⚙️ *sᴇᴛ ʀᴇᴀᴄᴛ ᴍᴇᴍʙᴇʀ*\n\n` +
        `Status: ${currentStatus ? "✅ Aktif" : "❌ Nonaktif"}\n` +
        `Emoji: ${currentEmoji}\n\n` +
        `\`${m.prefix}setreact on\` — aktifkan\n` +
        `\`${m.prefix}setreact off\` — nonaktifkan\n` +
        `\`${m.prefix}setreact emoji <emoji>\` — ganti emoji`,
    );
  }

  if (sub === "on" || sub === "off") {
    db.setGroup(m.chat, { memberReact: sub === "on" });
    db.save();
    m.react("✅");
    return m.reply(
      `${sub === "on" ? "✅ React member masuk/keluar diaktifkan" : "❌ React member masuk/keluar dinonaktifkan"} untuk grup ini.`,
    );
  }

  if (sub === "emoji") {
    const emoji = args[1];
    if (!emoji) {
      return m.reply(`Kasih emojinya, contoh:\n\`${m.prefix}setreact emoji 🎉\``);
    }
    db.setGroup(m.chat, { memberReactEmoji: emoji });
    db.save();
    m.react("✅");
    return m.reply(`✅ Emoji react diganti jadi ${emoji}`);
  }

  return m.reply(`Sub command gak dikenal. Ketik \`${m.prefix}setreact\` buat lihat cara pakai.`);
}

export { pluginConfig as config, handler };