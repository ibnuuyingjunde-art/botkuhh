import { getDatabase } from "../../src/lib/ichigo-database.js";
import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";

const pluginConfig = {
  name: "selfthisgc",
  alias: ["selfgc", "selfgroup", "selfthisgroup"],
  category: "group",
  description: "Aktifkan mode self hanya di grup ini",
  usage: ".selfthisgc",
  example: ".selfthisgc",
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

  if (isSelfGroup) {
    return m.reply(
      `ℹ️ *ɪɴꜰᴏʀᴍᴀsɪ*\n\n> Grup ini sudah berada dalam mode *Self*.\n` +
        `_Gunakan ${m.prefix}publicthisgc untuk membuka akses._`,
    );
  }

  if (!selfGroups.includes(m.chat)) {
    db.setting("selfGroups", [...selfGroups, m.chat]);
  }

  const updatedPublic = publicGroups.filter((id) => id !== m.chat);
  db.setting("publicGroups", updatedPublic);

  m.react("🔒");
  return m.reply(
    `🔒 *sᴇʟꜰ ᴍᴏᴅᴇ (ɢʀᴜᴘ) ᴀᴄᴛɪᴠᴀᴛᴇᴅ*\n\n` +
      `> Bot di grup ini dibatasi dan hanya merespon:\n` +
      `> • Owner Bot\n` +
      `> • Bot Sendiri (fromMe)\n\n` +
      `*Status*: 🔴 Grup ini privat\n` +
      `_Gunakan ${m.prefix}publicthisgc untuk membuka akses._`,
  );
}

export { pluginConfig as config, handler };