import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "clearspouse",
  alias: ["clearmarry", "resetspouse", "resetmarry"],
  category: "owner",
  description: "Clear data spouses user tertentu (owner only)",
  usage: ".clearspouse @user",
  example: ".clearspouse @628xxx",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();

  const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender;

  const user = db.getUser(target);
  if (!user) {
    return m.reply(`❌ User @${target.split("@")[0]} tidak ditemukan di database.`, { mentions: [target] });
  }

  if (!user.rpg) user.rpg = {};

  const oldSpouses = user.rpg.spouses || (user.rpg.spouse ? [user.rpg.spouse] : []);
  const oldCount = oldSpouses.length;

  user.rpg.spouses = [];
  delete user.rpg.spouse;
  user.rpg.marriedAt = null;

  let fixedCount = 0;
  for (const spouseJid of oldSpouses) {
    const spouseUser = db.getUser(spouseJid);
    if (!spouseUser?.rpg) continue;

    if (!spouseUser.rpg.spouses) {
      spouseUser.rpg.spouses = spouseUser.rpg.spouse ? [spouseUser.rpg.spouse] : [];
      delete spouseUser.rpg.spouse;
    }

    spouseUser.rpg.spouses = spouseUser.rpg.spouses.filter(s => s !== target);
    if (spouseUser.rpg.spouses.length === 0) spouseUser.rpg.marriedAt = null;

    db.setUser(spouseJid, spouseUser);
    fixedCount++;
  }

  db.setUser(target, user);
  db.save();

  await m.react("✅");

  let txt = `✅ *CLEAR SPOUSE BERHASIL*\n\n`;
  txt += `👤 Target: @${target.split("@")[0]}\n`;
  txt += `🗑️ Spouses dihapus: *${oldCount} orang*\n`;
  txt += `🔄 Data pasangan yang ikut difix: *${fixedCount} orang*`;

  await m.reply(txt, { mentions: [target] });
}

export { pluginConfig as config, handler };