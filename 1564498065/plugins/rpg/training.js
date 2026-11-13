import { getDatabase } from "../../src/lib/ichigo-database.js";
import { addExpWithLevelCheck } from "../../src/lib/ichigo-level.js";

const pluginConfig = {
  name: "training",
  alias: ["train", "latihan", "workout"],
  category: "rpg",
  description: "Latihan untuk meningkatkan stats",
  usage: ".training <attack/defense/health/speed/luck>",
  example: ".training attack",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,   
  energi: 1,
  isEnabled: true,
};

const COOLDOWN_SECONDS = 180;

const TRAINING_TYPES = {
  attack:  { name: "⚔️ Attack Training",  stat: "attack",  bonus: [1, 3],   exp: 80, staminaCost: 20 },
  defense: { name: "🛡️ Defense Training", stat: "defense", bonus: [1, 2],   exp: 70, staminaCost: 15 },
  health:  { name: "❤️ Health Training",  stat: "health",  bonus: [5, 15],  exp: 90, staminaCost: 25 },
  speed:   { name: "💨 Speed Training",   stat: "speed",   bonus: [1, 2],   exp: 75, staminaCost: 18 },
  luck:    { name: "🍀 Luck Training",    stat: "luck",    bonus: [1, 2],   exp: 85, staminaCost: 22 },
};

const DEFAULT_STATS = {
  attack: 10, defense: 5, health: 100, speed: 10, luck: 5,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);
  if (!user) return m.reply("❌ Data user tidak ditemukan.");
  if (!user.rpg) user.rpg = {};

  const trainType = m.args?.[0]?.toLowerCase();

  if (!trainType) {
    let txt = `🏋️ *ᴛʀᴀɪɴɪɴɢ sʏsᴛᴇᴍ*\n\n`;
    txt += `> Latihan untuk meningkatkan stats!\n\n`;
    txt += `*📊 sᴛᴀᴛs ᴋᴀᴍᴜ:*\n`;
    txt += `> ⚔️ Attack  : *${user.rpg.attack  ?? DEFAULT_STATS.attack}*\n`;
    txt += `> 🛡️ Defense : *${user.rpg.defense ?? DEFAULT_STATS.defense}*\n`;
    txt += `> ❤️ Health  : *${user.rpg.health  ?? DEFAULT_STATS.health}*\n`;
    txt += `> 💨 Speed   : *${user.rpg.speed   ?? DEFAULT_STATS.speed}*\n`;
    txt += `> 🍀 Luck    : *${user.rpg.luck    ?? DEFAULT_STATS.luck}*\n`;
    txt += `> ⚡ Stamina : *${user.rpg.stamina ?? 100}*\n\n`;
    txt += `*🏋️ ᴘɪʟɪʜᴀɴ ᴛʀᴀɪɴɪɴɢ:*\n`;
    for (const [key, train] of Object.entries(TRAINING_TYPES)) {
      txt += `\n> ${train.name}\n`;
      txt += `> ⚡ Stamina: *${train.staminaCost}* | ✨ EXP: *+${train.exp}*\n`;
      txt += `> \`${m.prefix}training ${key}\`\n`;
    }
    return m.reply(txt);
  }

  const training = TRAINING_TYPES[trainType];
  if (!training) {
    return m.reply(
      `❌ Training *${trainType}* tidak ditemukan!\n\n` +
      `> Ketik \`${m.prefix}training\` untuk melihat daftar.`
    );
  }

  const cdKey = `training_${trainType}`;
  const remaining = db.checkCooldown(m.sender, cdKey, COOLDOWN_SECONDS);
  if (remaining) {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return m.reply(
      `⏳ *ᴄᴏᴏʟᴅᴏᴡɴ ᴛʀᴀɪɴɪɴɢ*\n\n` +
      `> Tipe  : *${training.name}*\n` +
      `> Tunggu: *${timeStr}* lagi\n\n` +
      `💡 Coba training tipe lain sambil menunggu!`
    );
  }

  const maxStamina = user.rpg.maxStamina || 100;
  user.rpg.stamina = user.rpg.stamina ?? maxStamina;

  if (user.rpg.stamina < training.staminaCost) {
    return m.reply(
      `⚡ *sᴛᴀᴍɪɴᴀ ᴋᴜʀᴀɴɢ*\n\n` +
      `> Butuh  : *${training.staminaCost}*\n` +
      `> Punya  : *${user.rpg.stamina}*\n\n` +
      `💡 Gunakan \`${m.prefix}rest\` atau beli stamina`
    );
  }

  db.setCooldown(m.sender, cdKey, COOLDOWN_SECONDS);

  await m.react("🏋️");
  await m.reply(`🏋️ *ʟᴀᴛɪʜᴀɴ ${training.name.toUpperCase()}...*`);
  await new Promise(r => setTimeout(r, 2500));

  user.rpg.stamina -= training.staminaCost;

  const defaultVal = DEFAULT_STATS[training.stat] ?? 0;
  const currentStat = user.rpg[training.stat] ?? defaultVal;
  const statBonus = Math.floor(
    Math.random() * (training.bonus[1] - training.bonus[0] + 1)
  ) + training.bonus[0];

  user.rpg[training.stat] = currentStat + statBonus;

  db.setUser(m.sender, { rpg: user.rpg });
  await addExpWithLevelCheck(sock, m, db, user, training.exp);

  await m.react("💪");
  return m.reply(
    `💪 *ᴛʀᴀɪɴɪɴɢ sᴇʟᴇsᴀɪ!*\n\n` +
    `*📊 ʀᴇsᴜʟᴛ:*\n` +
    `> 🏋️ Training : *${training.name}*\n` +
    `> 📈 ${training.stat.charAt(0).toUpperCase() + training.stat.slice(1)}: *${currentStat} → ${currentStat + statBonus}* (+${statBonus})\n` +
    `> ⚡ Stamina  : *-${training.staminaCost}* (sisa: ${user.rpg.stamina}/${maxStamina})\n` +
    `> ✨ EXP      : *+${training.exp}*`
  );
}

export { pluginConfig as config, handler };