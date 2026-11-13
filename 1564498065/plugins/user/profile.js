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
  const progress = Math.min(Math.max(max > 0 ? current / max : 0, 0), 1);

  ctx.fillStyle = "#2A2D32";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(width * progress, height), height, radius);
    ctx.fill();
  }
}

function fitText(ctx, text, maxWidth) {
  let out = String(text ?? "");
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + "…";
}

function drawCoinIcon(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = "#FBBF24";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#B45309";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#B45309";
  ctx.font = `bold ${Math.round(r * 1.2)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", x, y + 1);
  ctx.restore();
}

function drawBankIcon(ctx, x, y, size) {
  ctx.save();
  const half = size / 2;
  ctx.fillStyle = "#60A5FA";
  ctx.beginPath();
  ctx.moveTo(x - half - 2, y - half + 6);
  ctx.lineTo(x, y - half - 4);
  ctx.lineTo(x + half + 2, y - half + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - half, y + half - 3, size, 3);
  ctx.fillStyle = "#93C5FD";
  const colW = size / 5;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x - half + colW * (i * 2) + 1, y - half + 8, colW, size - 12);
  }
  ctx.restore();
}

function drawBoltIcon(ctx, x, y, size, color = "#FACC15") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.15, y - size / 2);
  ctx.lineTo(x - size * 0.25, y + size * 0.1);
  ctx.lineTo(x, y + size * 0.1);
  ctx.lineTo(x - size * 0.15, y + size / 2);
  ctx.lineTo(x + size * 0.3, y - size * 0.05);
  ctx.lineTo(x + size * 0.02, y - size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeartIcon(ctx, x, y, size, color = "#EF4444") {
  ctx.save();
  ctx.fillStyle = color;
  const t = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + t * 0.9);
  ctx.bezierCurveTo(x - t * 1.6, y - t * 0.1, x - t * 0.9, y - t * 1.1, x, y - t * 0.35);
  ctx.bezierCurveTo(x + t * 0.9, y - t * 1.1, x + t * 1.6, y - t * 0.1, x, y + t * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDropIcon(ctx, x, y, size, color = "#3B82F6") {
  ctx.save();
  ctx.fillStyle = color;
  const t = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y - t);
  ctx.bezierCurveTo(x + t * 0.5, y - t * 0.3, x + t * 0.85, y + t * 0.05, x + t * 0.85, y + t * 0.3);
  ctx.arc(x, y + t * 0.3, t * 0.85, 0, Math.PI, false);
  ctx.bezierCurveTo(x - t * 0.85, y + t * 0.05, x - t * 0.5, y - t * 0.3, x, y - t);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeartSmall(ctx, x, y, size) {
  drawHeartIcon(ctx, x, y, size, "#F472B6");
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
  const FONT = "sans-serif";

  ctx.fillStyle = "#12141C";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#1A1D26";
  ctx.beginPath();
  ctx.roundRect(20, 20, 760, 410, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const nameText = user.name || m.pushName || "Unknown";

  ctx.save();
  ctx.beginPath();
  ctx.arc(115, 125, 70, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatarImg, 45, 55, 140, 140);
  ctx.restore();

  ctx.strokeStyle = "#4F46E5";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(115, 125, 72, 0, Math.PI * 2, true);
  ctx.stroke();

  const infoX = 205;
  const infoW = 160;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(fitText(ctx, nameText, infoW), infoX, 105);

  ctx.font = `bold 13px ${FONT}`;
  const badgeText = fitText(ctx, String(statusLabel).toUpperCase(), infoW - 24);
  const badgeW = Math.ceil(ctx.measureText(badgeText).width) + 24;
  ctx.fillStyle = "#4F46E5";
  ctx.beginPath();
  ctx.roundRect(infoX, 120, badgeW, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(badgeText, infoX + 12, 138);

  ctx.fillStyle = "#94A3B8";
  ctx.font = `16px ${FONT}`;
  ctx.fillText(fitText(ctx, `Class: ${role}`, infoW), infoX, 172);

  const rows = [
    { icon: "coin", label: "KOIN", value: `Rp ${formatNumber(user.koin)}` },
    { icon: "bank", label: "BANK", value: `Rp ${formatNumber(user.rpg.bank)}` },
    { icon: "bolt", label: "ENERGI", value: String(energiDisplay) },
  ];
  if (user.rpg.spouse) {
    rows.push({ icon: "heart", label: "PASANGAN", value: `@${user.rpg.spouse.split("@")[0]}` });
  }

  rows.forEach((row, i) => {
    const cy = 246 + i * 46;
    const ix = 62;

    ctx.fillStyle = "#222634";
    ctx.beginPath();
    ctx.roundRect(40, cy - 22, 320, 42, 10);
    ctx.fill();

    if (row.icon === "coin") drawCoinIcon(ctx, ix, cy, 11);
    if (row.icon === "bank") drawBankIcon(ctx, ix, cy, 20);
    if (row.icon === "bolt") drawBoltIcon(ctx, ix, cy, 22);
    if (row.icon === "heart") drawHeartSmall(ctx, ix, cy, 20);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#7C8397";
    ctx.font = `11px ${FONT}`;
    ctx.fillText(row.label, 88, cy - 4);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(fitText(ctx, row.value, 255), 88, cy + 13);
  });

  ctx.strokeStyle = "#2D313E";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(380, 50);
  ctx.lineTo(380, 400);
  ctx.stroke();

  const rx = 410;
  const rw = 350;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 30px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`LEVEL ${user.rpg.level}`, rx, 85);

  ctx.fillStyle = "#94A3B8";
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`EXP ${formatNumber(expInLevel)} / ${formatNumber(expNeeded)}`, rx + rw, 85);
  ctx.textAlign = "left";
  drawProgressBar(ctx, rx, 98, rw, 12, expInLevel, expNeeded, "#3B82F6");

  const stats = [
    { icon: "heart", label: "HP", color: "#EF4444", cur: user.rpg.health, max: user.rpg.maxHealth },
    { icon: "drop", label: "MANA", color: "#06B6D4", cur: user.rpg.mana, max: user.rpg.maxMana },
    { icon: "bolt", label: "STAMINA", color: "#10B981", cur: user.rpg.stamina, max: user.rpg.maxStamina },
  ];

  stats.forEach((st, i) => {
    const top = 160 + i * 82;

    if (st.icon === "heart") drawHeartIcon(ctx, rx + 9, top + 3, 18, st.color);
    if (st.icon === "drop") drawDropIcon(ctx, rx + 9, top + 3, 20, st.color);
    if (st.icon === "bolt") drawBoltIcon(ctx, rx + 9, top + 3, 20, st.color);

    ctx.fillStyle = st.color;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(st.label, rx + 28, top + 9);

    ctx.fillStyle = "#E2E8F0";
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${formatNumber(st.cur)} / ${formatNumber(st.max)}`, rx + rw, top + 9);
    ctx.textAlign = "left";

    drawProgressBar(ctx, rx, top + 22, rw, 16, st.cur, st.max, st.color);
  });

  const buffer = canvas.toBuffer("image/png");

  const caption =
    `⚔️ *PROFILE CARD RPG* untuk @${target.split("@")[0]}\n\n` +
    `╭─「 👤 *PROFIL* 」\n` +
    `│ • Nama     : *${nameText}*\n` +
    `│ • Badge    : *${statusLabel.toUpperCase()}*\n` +
    `│ • Class    : *${role}*\n` +
    `╰──────────────\n\n` +
    `╭─「 💰 *EKONOMI* 」\n` +
    `│ • Koin     : *Rp ${formatNumber(user.koin)}*\n` +
    `│ • Bank     : *Rp ${formatNumber(user.rpg.bank)}*\n` +
    `│ • Energi   : *${energiDisplay}*\n` +
    (user.rpg.spouse ? `│ • Pasangan : *@${user.rpg.spouse.split("@")[0]}*\n` : "") +
    `╰──────────────\n\n` +
    `╭─「 📊 *STATUS* 」\n` +
    `│ • Level    : *${user.rpg.level}* (${formatNumber(expInLevel)}/${formatNumber(expNeeded)} EXP)\n` +
    `│ • HP       : *${formatNumber(user.rpg.health)}/${formatNumber(user.rpg.maxHealth)}*\n` +
    `│ • Mana     : *${formatNumber(user.rpg.mana)}/${formatNumber(user.rpg.maxMana)}*\n` +
    `│ • Stamina  : *${formatNumber(user.rpg.stamina)}/${formatNumber(user.rpg.maxStamina)}*\n` +
    `╰──────────────`;
  const mentions = [target];
  if (user.rpg.spouse) mentions.push(user.rpg.spouse);

  const footer = `© ${config.bot?.name || "lyniX's MD"}`;
  const prefix = m.prefix || ".";

  try {
    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: caption,
          footer,
          image: buffer,
          contextInfo: {
            mentionedJid: mentions,
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({}),
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 Menu",
                  id: `${prefix}menu`,
                }),
              },
            ],
          },
        },
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[profile] Gagal kirim interactive, fallback ke gambar:", err.message);
    await sock.sendMessage(
      m.chat,
      { image: buffer, caption: `${caption}\n\n_${footer}_`, mentions },
      { quoted: m }
    );
  }
}

export { pluginConfig as config, handler };