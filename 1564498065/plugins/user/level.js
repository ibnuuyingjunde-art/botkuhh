import config from "../../config.js";
import { isPremiumGroup } from "../../src/lib/ichigo-premium-group.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getUserStatusLabel } from "../../src/lib/ichigo-level.js";

const EXP_PER_LEVEL = 10000;
const MAX_LEVEL = 900001;
const DEFAULT_ENERGI = config.energi?.default ?? 30;

const pluginConfig = {
  name: "level",
  alias: ["lvl", "ceklevel"],
  category: "user",
  description: "Cek level user",
  usage: ".level [@user]",
  example: ".level",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function calculateLevel(exp) {
  return Math.min(Math.floor(exp / EXP_PER_LEVEL) + 1, MAX_LEVEL);
}

function expForLevel(level) {
  return (level - 1) * EXP_PER_LEVEL;
}

function expToNextLevel(exp) {
  const currentLevel = calculateLevel(exp);
  if (currentLevel >= MAX_LEVEL) return 0;
  const nextLevelExp = expForLevel(currentLevel + 1);
  return nextLevelExp - exp;
}

function getRole(level) {
  if (level >= 2000) return "Mythic";
  if (level >= 1600) return "Legend";
  if (level >= 1200) return "Epic";
  if (level >= 800)  return "Grandmaster";
  if (level >= 400)  return "Master";
  if (level >= 200)  return "Elite";
  return "Warrior";
}

function getRank(level) {
  if (level >= 1000) return "Legend";
  if (level >= 600)  return "Master";
  if (level >= 400)  return "Expert";
  if (level >= 200)  return "Advanced";
  if (level >= 100)  return "Intermediate";
  return "Newbie";
}

function getBadge(level) {
  if (level >= 1000) return "Legend Badge";
  if (level >= 600)  return "Master Badge";
  if (level >= 200)  return "Expert Badge";
  return "Starter Badge";
}

function getReputation(exp) {
  if (exp >= 1000000) return "★★★★★";
  if (exp >= 500000)  return "★★★★";
  if (exp >= 100000)  return "★★★";
  if (exp >= 50000)   return "★★";
  return "★";
}

function getLevelBar(current, target) {
  const totalBars = 10;
  const filledBars = Math.min(Math.floor((current / target) * totalBars), totalBars);
  return "▰".repeat(filledBars) + "▱".repeat(totalBars - filledBars);
}

function getStaminaBar(current, max) {
  const totalBars = 10;
  const filledBars = Math.min(Math.floor((current / max) * totalBars), totalBars);
  return "▰".repeat(filledBars) + "▱".repeat(totalBars - filledBars);
}

function formatVipExpired(ts) {
  if (!ts || ts === -1) return "Permanen";
  const sisa = ts - Date.now();
  if (sisa <= 0) return "Expired";
  const d = Math.floor(sisa / (1000 * 60 * 60 * 24));
  const h = Math.floor((sisa % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (d > 0) return `${d}h ${h}j lagi`;
  const min = Math.floor((sisa % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}j ${min}m lagi`;
  return `${min}m lagi`;
}

function isVipActive(user) {
  if (!user?.isVip) return false;
  if (!user.vipExpired || user.vipExpired === -1) return true;
  return Date.now() < user.vipExpired;
}

async function handler(m, { sock }) {
  const db = getDatabase();

  let targetJid = m.sender;
  let targetName = m.pushName || "Kamu";

  if (m.quoted) {
    targetJid = m.quoted.sender;
    targetName = m.quoted.pushName || targetJid.split("@")[0];
  } else if (m.mentionedJid?.length) {
    targetJid = m.mentionedJid[0];
    targetName = targetJid.split("@")[0];
  }

  const isSelf = targetJid === m.sender;
  const user = db.getUser(targetJid) || db.setUser(targetJid);
  if (!user.rpg) user.rpg = {};

  const exp = user.exp || 0;
  const level = calculateLevel(exp);
  const role = getRole(level);
  const rank = getRank(level);
  const badge = getBadge(level);
  const reputation = getReputation(exp);
  const currentLevelExp = expForLevel(level);
  const nextLevelExp = expForLevel(level + 1);
  const expInLevel = exp - currentLevelExp;
  const expNeeded = nextLevelExp - currentLevelExp;
  const progress = getLevelBar(expInLevel, expNeeded);

  const isOwnerTarget   = isSelf ? m.isOwner : false;
  const isPremiumTarget = (config.isPremium ? config.isPremium(targetJid) : user.isPremium) || (m.isGroup && isPremiumGroup(m.chat));
  const vipActive       = isVipActive(user);

  const { label: statusLabel, emoji: statusEmoji } = getUserStatusLabel({
    isOwner: isOwnerTarget,
    isVip: vipActive,
    isPremium: isPremiumTarget,
  });

  const energiDisplay = isOwnerTarget || vipActive || isPremiumTarget
    ? "∞ Unlimited"
    : (user.energi === -1 ? "∞ Unlimited" : (user.energi ?? DEFAULT_ENERGI));

  const maxStamina = user.rpg.maxStamina || 100;
  const curStamina = user.rpg.stamina ?? maxStamina;
  const staminaBar = getStaminaBar(curStamina, maxStamina);
  const fishStats = user.fishStats || {};
  const staminaStats = user.staminaStats || {};

  let txt = `╭━━━━━━━━━━━━━━━━━╮\n`;
  txt += `┃ LEVEL INFO\n`;
  txt += `╰━━━━━━━━━━━━━━━━━╯\n\n`;

  txt += `╭┈┈「 USER 」\n`;
  txt += `┃ Name   : *${targetName}*\n`;
  txt += `┃ Tag    : @${targetJid.split("@")[0]}\n`;
  txt += `┃ Status : ${statusEmoji} *${statusLabel}*\n`;
  txt += `╰┈┈┈┈┈┈┈┈\n\n`;

  txt += `╭┈┈「 STATS 」\n`;
  txt += `┃ Level  : *${level}${level >= MAX_LEVEL ? " (MAX)" : ""}*\n`;
  txt += `┃ Role   : *${role}*\n`;
  txt += `┃ Rank   : *${rank}*\n`;
  txt += `┃ Badge  : *${badge}*\n`;
  txt += `┃ Rep    : *${reputation}*\n`;
  txt += `┃ Exp    : *${exp.toLocaleString("id-ID")}*\n`;
  txt += `┃ Koin   : *${(user.koin || 0).toLocaleString("id-ID")}*\n`;
  txt += `┃ Energi : *${energiDisplay}*\n`;
  txt += `╰┈┈┈┈┈┈┈┈\n\n`;

  if (vipActive) {
    txt += `╭┈┈「 💎 VIP 」\n`;
    txt += `┃ Expired : *${formatVipExpired(user.vipExpired)}*\n`;
    txt += `╰┈┈┈┈┈┈┈┈\n\n`;
  }

  txt += `╭┈┈「 STAMINA 」\n`;
  txt += `┃ ${staminaBar}\n`;
  txt += `┃ *${curStamina} / ${maxStamina}*\n`;
  txt += `┃ Total Klaim : *${staminaStats.totalKlaim || 0}x*\n`;
  txt += `┃ Total Beli  : *${staminaStats.totalBeli || 0}x*\n`;
  txt += `╰┈┈┈┈┈┈┈┈\n\n`;

  if (fishStats.total > 0) {
    txt += `╭┈┈「 FISHING STATS 」\n`;
    txt += `┃ Total Mancing : *${fishStats.total || 0}x*\n`;
    txt += `┃ Legendary     : *${fishStats.legendary || 0}x*\n`;
    txt += `┃ Dapat Sampah  : *${fishStats.sampah || 0}x*\n`;
    txt += `╰┈┈┈┈┈┈┈┈\n\n`;
  }

  txt += `╭┈┈「 PROGRESS 」\n`;
  txt += `┃ ${progress}\n`;
  txt += `┃ ${expInLevel.toLocaleString("id-ID")} / ${expNeeded.toLocaleString("id-ID")}\n`;
  txt += `╰┈┈┈┈┈┈┈┈\n\n`;

  if (level >= MAX_LEVEL) {
    txt += `> Level sudah *MAX (${MAX_LEVEL})*!`;
  } else {
    txt += `> Next level: *${expToNextLevel(exp).toLocaleString("id-ID")} exp* lagi!`;
  }

  await m.reply(txt, { mentions: [targetJid] });
}

export {
  pluginConfig as config,
  handler,
  calculateLevel,
  expForLevel,
  expToNextLevel,
  getRole,
  getRank,
  getBadge,
  getReputation,
  MAX_LEVEL,
};