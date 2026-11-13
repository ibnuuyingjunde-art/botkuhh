import config from "../../config.js";

const EXP_PER_LEVEL = 10000;

const MAX_LEVEL = 900001;

function calculateLevel(exp) {
  return Math.min(Math.floor(exp / EXP_PER_LEVEL) + 1, MAX_LEVEL);
}

function expForLevel(level) {
  return (level - 1) * EXP_PER_LEVEL;
}

function getRole(level) {
  if (level >= 100) return "🐉 Mythic";
  if (level >= 80) return "⚔️ Legend";
  if (level >= 60) return "💜 Epic";
  if (level >= 40) return "💪 Grandmaster";
  if (level >= 20) return "🎖️ Master";
  if (level >= 10) return "⭐ Elite";
  return "🛡️ Warrior";
}

async function checkAndNotifyLevelUp(sock, m, db, user, oldExp, newExp, userName = null) {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");

  async function generateLevelUpCard(data) {
    const W = 900, H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 24);
    ctx.clip();

    try {
      const bg = await loadImage(data.backgroundUrl);
      const ratio = Math.max(W / bg.width, H / bg.height);
      const bx = (W - bg.width * ratio) / 2;
      const by = (H - bg.height * ratio) / 2;
      ctx.drawImage(bg, bx, by, bg.width * ratio, bg.height * ratio);
    } catch {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#0f0c29");
      grad.addColorStop(0.5, "#302b63");
      grad.addColorStop(1, "#24243e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(5, 5, 20, 0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(3, 3, W - 6, H - 6, 22);
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, "#00f2ff");
    borderGrad.addColorStop(1, "#a855f7");
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    const stripGrad = ctx.createLinearGradient(0, 0, 0, H);
    stripGrad.addColorStop(0, "#00f2ff");
    stripGrad.addColorStop(1, "#a855f7");
    ctx.fillStyle = stripGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 6, H, [22, 0, 0, 22]);
    ctx.fill();

    const cx = 110, cy = H / 2, r = 80;
    try {
      const avatar = await loadImage(data.avatarUrl).catch(() => null);
      if (avatar) {
        ctx.save();
        ctx.shadowColor = "#00f2ff";
        ctx.shadowBlur = 28;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#00f2ff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }
    } catch {}

    const tx = 220;

    ctx.save();
    const badgeGrad = ctx.createLinearGradient(tx, 0, tx + 180, 0);
    badgeGrad.addColorStop(0, "#00f2ff");
    badgeGrad.addColorStop(1, "#a855f7");
    ctx.fillStyle = badgeGrad;
    ctx.beginPath();
    ctx.roundRect(tx, 28, 178, 38, 10);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("✦  LEVEL UP!", tx + 16, 47);
    ctx.restore();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 30px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(data.name, tx, 115);

    const role = getRole(data.level);
    ctx.fillStyle = "#a855f7";
    ctx.font = "18px sans-serif";
    ctx.fillText(role, tx, 145);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "bold 130px sans-serif";
    ctx.fillText(`${data.level}`, W - 28, H - 20);

    ctx.fillStyle = "#00f2ff";
    ctx.font = "bold 100px sans-serif";
    ctx.fillText(`${data.level}`, W - 30, H - 22);

    ctx.textAlign = "left";

    const barX = tx, barY = 170, barW = 530, barH = 22;
    
    const progress = Math.min(data.currentXp / data.requiredXp, 1);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 11);
    ctx.fill();

    if (progress > 0) {
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      fillGrad.addColorStop(0, "#00f2ff");
      fillGrad.addColorStop(1, "#a855f7");
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * progress, barH, 11);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, barW * progress - 4, barH / 2 - 2, 8);
      ctx.fill();
    }

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 14px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${data.currentXp.toLocaleString("id-ID")} / ${data.requiredXp.toLocaleString("id-ID")} XP`,
      barX + 10,
      barY + barH / 2,
    );

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "13px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(config.bot?.name || "Bot", tx, H - 16);

    return canvas.toBuffer("image/png");
  }

  const oldLevel = calculateLevel(oldExp);
  const newLevel = calculateLevel(newExp);

  if (newLevel > oldLevel) {
    user.rpg.level = newLevel;
    user.rpg.maxHealth = 100 + (newLevel - 1) * 10;
    user.rpg.maxMana = 100 + (newLevel - 1) * 5;
    user.rpg.maxStamina = 100 + (newLevel - 1) * 5;
    user.rpg.health = user.rpg.maxHealth;
    user.rpg.mana = user.rpg.maxMana;
    user.rpg.stamina = user.rpg.maxStamina;

    db.save();

    if (user.settings?.levelupNotif === false) {
      return { leveledUp: true, notified: false, oldLevel, newLevel };
    }

    const role = getRole(newLevel);
    const botName = config.bot?.name || "lyniX's MD";

    let ppBuffer = null;
    try {
      ppBuffer = await sock.profilePictureUrl(m.sender, "image");
    } catch {}

    const resolvedName = userName || m.pushName || m.sender?.split("@")[0] || "User";

    const xpIntoLevel = newExp - expForLevel(newLevel);  

    const txt = `🎊 *SELAMAT @${m.sender.split("@")[0]}!*

Level kamu bertambah ${newLevel - oldLevel}
🥗 Level kamu sekarang *${newLevel}*

Sekarang kamu berada di rank *${role}*

Mau cek detail level? ketik _${m.prefix}level_

Sering seringlah berinteraksi dengan bot agar level kamu bertambah!`;

    const contextInfo = {
      mentionedJid: [m.sender],
      forwardingScore: 999,
      isForwarded: true,
    };

    const fakeQuoted = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast",
      },
      message: {
        contactMessage: {
          displayName: `✅ ${botName}`,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Verified Bot\nEND:VCARD`,
        },
      },
    };

    await sock.sendMedia(
      m.chat,
      await generateLevelUpCard({
        name: resolvedName,
        level: newLevel,
        currentXp: xpIntoLevel,   
        requiredXp: EXP_PER_LEVEL, 
        avatarUrl:
          ppBuffer ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName.charAt(0))}&background=00f2ff&color=fff&size=256`,
        backgroundUrl:
          "https://images.wallpapersden.com/image/download/anime-night-sky-scenery_bWlsZ26UmZqaraWkpJRmbmdlrWZnZWU.jpg",
      }),
      txt,
      m,
      {
        type: "image",
        contextInfo,
      },
    );

    return { leveledUp: true, notified: true, oldLevel, newLevel };
  }

  return { leveledUp: false, notified: false, oldLevel, newLevel: oldLevel };
}

async function addExpWithLevelCheck(sock, m, db, user, expAmount) {
  if (!user)
    return { leveledUp: false, notified: false, oldLevel: 1, newLevel: 1 };
  if (!user.rpg) user.rpg = {};

  const oldExp = user.exp || 0;
  const newExp = db.updateExp(m.sender, expAmount);
  user.exp = newExp;

  const result = await checkAndNotifyLevelUp(sock, m, db, user, oldExp, newExp, m.pushName || null);

  db.setUser(m.sender, { rpg: user.rpg });

  return result;
}

function getUserStatusLabel({ isOwner = false, isVip = false, isPremium = false } = {}) {
  if (isOwner)   return { label: "Owner",   emoji: "👑" };
  if (isVip)     return { label: "VIP",     emoji: "💎" };
  if (isPremium) return { label: "Premium", emoji: "🌟" };
  return { label: "Member", emoji: "✦" };
}

export {
  calculateLevel,
  expForLevel,
  getRole,
  getUserStatusLabel,
  checkAndNotifyLevelUp,
  addExpWithLevelCheck,
  MAX_LEVEL,
};