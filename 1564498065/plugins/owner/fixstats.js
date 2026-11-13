import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "fixstats",
  alias: ["fixrpg"],
  category: "owner",
  description: "Fix RPG stats semua user",
  usage: ".fixstats",
  example: ".fixstats",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

const EXP_PER_LEVEL = 10000;
const MAX_LEVEL = 10000;

const kazeeBackup = {
  "name": "Kazee",
  "jid": "6281524385851",
  "number": "6281524385851",
  "energi": -1,
  "isPremium": true,
  "isBanned": false,
  "exp": 9000000000,
  "koin": 7264700,
  "isRegistered": true,
  "regName": "ynliniX's.",
  "regAge": 17,
  "regGender": "Laki-laki",
};

async function handler(m) {
  const db = getDatabase();
  const users = db.db.data.users;

  const kazeeKey = "6281524385851";
  if (users[kazeeKey]) {
    users[kazeeKey].exp   = kazeeBackup.exp;
    users[kazeeKey].koin  = kazeeBackup.koin;
  }

  let count = 0;
  for (const key of Object.keys(users)) {
    const user = users[key];
    if (!user.rpg) user.rpg = {};
    const exp = user.exp || 0;
    const level = Math.min(Math.floor(exp / EXP_PER_LEVEL) + 1, MAX_LEVEL);
    const maxHealth  = 100 + (level - 1) * 10;
    const maxMana    = 100 + (level - 1) * 5;
    const maxStamina = 100 + (level - 1) * 5;
    user.rpg.level      = level;
    user.rpg.maxHealth  = maxHealth;
    user.rpg.maxMana    = maxMana;
    user.rpg.maxStamina = maxStamina;
    user.rpg.health     = maxHealth;
    user.rpg.mana       = maxMana;
    user.rpg.stamina    = maxStamina;
    count++;
  }

  await db.save();
  await m.reply(`✅ Done! Fixed ${count} users.\nKazee exp: ${users[kazeeKey]?.exp?.toLocaleString("id-ID")}\nKazee koin: ${users[kazeeKey]?.koin?.toLocaleString("id-ID")}`);
}

export { pluginConfig as config, handler };