import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "resetstats",
  alias: ["resetstat", "clearstats"],
  category: "owner",
  description: "Reset statistik penggunaan command bot",
  usage: ".resetstats",
  example: ".resetstats",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, db, botConfig }) {
  try {
    
    const cmdStats = db.data.cmdStats || {};
    const totalCmd = Object.keys(cmdStats).length;
    const totalUsage = Object.values(cmdStats).reduce((a, b) => a + b, 0);

    db.data.cmdStats = {};
    await db.write();

    const text = [
      `✅ *Statistik berhasil direset!*`,
      ``,
      `📊 *Data yang dihapus:*`,
      `• Command tercatat : *${totalCmd} command*`,
      `• Total penggunaan : *${totalUsage.toLocaleString()}x*`,
      ``,
      `Stats akan mulai dihitung ulang dari sekarang.`,
    ].join("\n");

    await m.reply(text);
  } catch (err) {
    console.error("[resetstats] Error:", err.message);
    await m.reply(`❌ Gagal mereset statistik: ${err.message}`);
  }
}

export default {
  config: pluginConfig,
  handler,
};