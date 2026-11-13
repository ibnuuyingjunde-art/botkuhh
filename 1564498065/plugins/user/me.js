import config from "../../config.js";
import { isPremiumGroup } from "../../src/lib/ichigo-premium-group.js";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getRole } from "./level.js";
import { getUserStatusLabel } from "../../src/lib/ichigo-level.js";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts } from "../../src/lib/ichigo-canvas-lazy.js";

const DEFAULT_ENERGI = config.energi?.default ?? 25;
const EXP_PER_LEVEL = 10000;

const pluginConfig = {
  name: "profile",
  alias: ["me", "profil", "myprofile", "my", "stats", "status"],
  category: "user",
  description: "Melihat profil user dengan RPG stats berbasis gambar Canvas",
  usage: ".profile [@user]",
  example: ".profile",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatNumber(num) {
  return num?.toLocaleString("id-ID") || "0";
}

function isVipActive(user) {
  if (!user?.isVip) return false;
  if (!user.vipExpired || user.vipExpired === -1) return true;
  return Date.now() < user.vipExpired;
}

function drawProgressBar(ctx, x, y, width, height, current, max, color) {
  const radius = height / 2;
  const progress = Math.min(Math.max(current / max, 0), 1);

  ctx.fillStyle = "#2A2D32";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width * progress, height, radius);
    ctx.fill();
  }
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender;

  const user = db.getUser(target) || db.setUser(target);

  if (!user.rpg) user.rpg = {};
  const userExp = user.exp || 0;
  const userLevel = Math.min(Math.floor(userExp / EXP_PER_LEVEL) + 1, 900001);
  user.rpg.level = userLevel;
  user.rpg.health = user.rpg.health || 100;
  user.rpg.maxHealth = 100 + (userLevel - 1) * 10;
  user.rpg.mana = user.rpg.mana || 100;
  user.rpg.maxMana = 100 + (userLevel - 1) * 5;
  user.rpg.stamina = user.rpg.stamina || 100;
  user.rpg.maxStamina = 100 + (userLevel - 1) * 5;

  const currentLevelExp = (userLevel - 1) * EXP_PER_LEVEL;
  const levelUpExp = userLevel * EXP_PER_LEVEL;
  const expInLevel = userExp - currentLevelExp;
  const expNeeded = levelUpExp - currentLevelExp;
  const role = getRole(userLevel);

  const isOwnerUser   = config.isOwner ? config.isOwner(target) : false;
  const isPremiumUser = (config.isPremium ? config.isPremium(target) : false) || (m.isGroup && isPremiumGroup(m.chat));
  const vipActive     = isVipActive(user);

  const { label: statusLabel } = getUserStatusLabel({
    isOwner: isOwnerUser,
    isVip: vipActive,
    isPremium: isPremiumUser,
  });

  const energiDisplay = isOwnerUser || vipActive || isPremiumUser
    ? "Unlimited"
    : (user.energi === -1 ? "Unlimited" : (user.energi ?? DEFAULT_ENERGI));

  let avatarImg;
  try {
    const ppUrl = await sock.profilePictureUrl(target, "image");
    avatarImg = await loadImage(ppUrl);
  } catch {
    const fallbackBuf = await loadAssetBuffer("pp-kosong");
    avatarImg = await loadImage(fallbackBuf || "https://i.imgur.com/TuItj4L.png");
  }

  const canvas = createCanvas(800, 450);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#12141C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#1A1D26";
  ctx.beginPath();
  ctx.roundRect(20, 20, 760, 410, 15);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(120, 130, 80, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatarImg, 40, 50, 160, 160);
  ctx.restore();

  ctx.strokeStyle = "#4F46E5"; 
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(120, 130, 80, 0, Math.PI * 2, true);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px sans-serif";
  const nameText = user.name || m.pushName || "Unknown";
  ctx.fillText(nameText, 230, 85);

  ctx.fillStyle = "#4F46E5";
  ctx.beginPath();
  ctx.roundRect(230, 105, 110, 25, 5);
  ctx.fill();
  
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px sans-serif";
  ctx.fillText(statusLabel.toUpperCase(), 245, 122);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Class: ${role}`, 230, 160);

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "16px sans-serif";
  ctx.fillText(`🪙 Koin: Rp ${formatNumber(user.koin)}`, 40, 270);
  ctx.fillText(`🏦 Bank: Rp ${formatNumber(user.rpg.bank)}`, 40, 300);
  ctx.fillText(`⚡ Energi: ${energiDisplay}`, 40, 330);
  if (user.rpg.spouse) {
    const spouseName = user.rpg.spouse.split("@")[0];
    ctx.fillText(`💖 Pasangan: @${spouseName}`, 40, 360);
  }

  ctx.strokeStyle = "#2D313E";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(380, 50);
  ctx.lineTo(380, 400);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`LEVEL ${user.rpg.level}`, 420, 85);
  
  ctx.fillStyle = "#94A3B8";
  ctx.font = "14px sans-serif";
  ctx.fillText(`EXP: ${formatNumber(expInLevel)} / ${formatNumber(expNeeded)}`, 420, 110);
  drawProgressBar(ctx, 420, 120, 340, 12, expInLevel, expNeeded, "#3B82F6");

  ctx.fillStyle = "#FF4B4B";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`❤️ HP (${formatNumber(user.rpg.health)}/${formatNumber(user.rpg.maxHealth)})`, 420, 175);
  drawProgressBar(ctx, 420, 185, 340, 16, user.rpg.health, user.rpg.maxHealth, "#EF4444");

  ctx.fillStyle = "#3B82F6";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`💧 MANA (${formatNumber(user.rpg.mana)}/${formatNumber(user.rpg.maxMana)})`, 420, 245);
  drawProgressBar(ctx, 420, 255, 340, 16, user.rpg.mana, user.rpg.maxMana, "#06B6D4");

  ctx.fillStyle = "#10B981";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`⚡ STAMINA (${formatNumber(user.rpg.stamina)}/${formatNumber(user.rpg.maxStamina)})`, 420, 315);
  drawProgressBar(ctx, 420, 325, 340, 16, user.rpg.stamina, user.rpg.maxStamina, "#10B981");

  const buffer = canvas.toBuffer("image/png");

  const caption = `⚔️ *Profile Card RPG* untuk @${target.split("@")[0]}`;
  const mentions = [target];
  if (user.rpg.spouse) mentions.push(user.rpg.spouse);

  await sock.sendMessage(
    m.chat, 
    { image: buffer, caption, mentions }, 
    { quoted: m }
  );
}

export { pluginConfig as config, handler };