import { getDatabase } from "../../src/lib/ichigo-database.js";
import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";

const pluginConfig = {
  name: "publicthisgc",
  alias: ["publicgc", "publicgroup", "publicthisgroup"],
  category: "group",
  description: "Aktifkan mode public hanya di grup ini",
  usage: ".publicthisgc",
  example: ".publicthisgc",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const selfGroups = db.setting("selfGroups") || [];
  const publicGroups = db.setting("publicGroups") || [];

  const isSelfGroup = selfGroups.includes(m.chat);
  const isPublicGroup = publicGroups.includes(m.chat);

  if (isPublicGroup && !isSelfGroup) {
    return m.reply(
      `ℹ️ *ɪɴꜰᴏʀᴍᴀsɪ*\n\n> Grup ini sudah berada dalam mode *Public*.\n` +
        `_Gunakan ${m.prefix}selfthisgc untuk menutup akses._`,
    );
  }

  const updatedSelf = selfGroups.filter((id) => id !== m.chat);
  db.setting("selfGroups", updatedSelf);

  if (!publicGroups.includes(m.chat)) {
    db.setting("publicGroups", [...publicGroups, m.chat]);
  }

  m.react("🌐");
  return m.reply(
    `🌐 *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ (ɢʀᴜᴘ) ᴀᴄᴛɪᴠᴀᴛᴇᴅ*\n\n` +
      `> Bot di grup ini kembali terbuka untuk semua member.\n` +
      `> Override mode global aktif khusus untuk grup ini.\n\n` +
      `*Status*: 🟢 Terbuka untuk member grup\n` +
      `_Gunakan ${m.prefix}selfthisgc untuk menutup akses._`,
  );
}

export { pluginConfig as config, handler };