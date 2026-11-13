import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";
import axios from "axios";

const pluginConfig = {
  name: "spotifycard",
  alias: ["spotify", "musiccard"],
  category: "tools",
  description: "Generate Spotify music card",
  usage: ".spotify <judul> | <artis> | <album>",
  example: ".spotify Blinding Lights | The Weeknd | After Hours",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  isEnabled: true,
};

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateSpotifyCard({ judul, artis, album, imageBuffer }) {
  const W = 600, H = 170;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  roundRect(ctx, 0, 0, W, H, 20);
  ctx.fillStyle = "#181818";
  ctx.fill();

  const coverSize = 130;
  const coverX = 20, coverY = 20;
  let cover;
  try {
    cover = await loadImage(imageBuffer);
  } catch {
    
    ctx.fillStyle = "#1DB954";
    roundRect(ctx, coverX, coverY, coverSize, coverSize, 10);
    ctx.fill();
  }

  if (cover) {
    ctx.save();
    roundRect(ctx, coverX, coverY, coverSize, coverSize, 10);
    ctx.clip();
    ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);
    ctx.restore();
  }

  const textX = coverX + coverSize + 20;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px Sans";
  ctx.fillText(judul.length > 22 ? judul.slice(0, 22) + "…" : judul, textX, 50);

  ctx.fillStyle = "#B3B3B3";
  ctx.font = "16px Sans";
  ctx.fillText(artis.length > 28 ? artis.slice(0, 28) + "…" : artis, textX, 75);

  ctx.fillStyle = "#727272";
  ctx.font = "13px Sans";
  ctx.fillText(album.length > 30 ? album.slice(0, 30) + "…" : album, textX, 96);

  const barX = textX, barY = 115;
  const barW = W - textX - 20, barH = 4;

  const totalMs = Math.floor(Math.random() * (240000 - 180000) + 180000);
  const currentMs = Math.floor(Math.random() * (totalMs * 0.8 - totalMs * 0.1) + totalMs * 0.1);
  const progress = currentMs / totalMs;

  ctx.fillStyle = "#535353";
  roundRect(ctx, barX, barY, barW, barH, 2);
  ctx.fill();

  ctx.fillStyle = "#1DB954";
  roundRect(ctx, barX, barY, barW * progress, barH, 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(barX + barW * progress, barY + barH / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = "#B3B3B3";
  ctx.font = "12px Sans";
  ctx.fillText(formatDuration(currentMs), barX, barY + 20);
  ctx.textAlign = "right";
  ctx.fillText(formatDuration(totalMs), barX + barW, barY + 20);
  ctx.textAlign = "left";

  ctx.fillStyle = "#1DB954";
  ctx.font = "bold 13px Sans";
  ctx.textAlign = "right";
  ctx.fillText("♫ Spotify", W - 20, H - 15);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

async function handler(m, { sock }) {
  const args = m.text?.trim();

  if (!args || !args.includes("|")) {
    return m.reply(
      `🎵 *𝖲𝗉𝗈𝗍𝗂𝖿𝗒 𝖢𝖺𝗋𝖽*\n\n> Format: \`${m.prefix}spotify <judul> | <artis> | <album>\`\n> Reply gambar album cover (opsional)\n\n*Contoh:*\n\`${m.prefix}spotify Blinding Lights | The Weeknd | After Hours\``
    );
  }

  const parts = args.split("|").map((s) => s.trim());
  const judul = parts[0] || "";
  const artis = parts[1] || "";
  const album = parts[2] || judul;

  if (!judul || !artis) {
    return m.reply(`❌ Format salah.\n\nContoh: \`${m.prefix}spotify Blinding Lights | The Weeknd | After Hours\``);
  }

  await m.react("⏳");

  try {
    
    let imageBuffer = null;
    const quotedIsImage = m.quoted && (m.quoted.type === "imageMessage" || m.quoted.isMedia);

    if (quotedIsImage) {
      imageBuffer = await m.quoted.download();
    } else if (m.isImage) {
      imageBuffer = await m.download();
    }

    const cardBuffer = await generateSpotifyCard({ judul, artis, album, imageBuffer });

    await m.react("✅");

    await sock.sendMessage(m.chat, {
      image: cardBuffer,
      caption: `🎵 *${judul}*\n👤 ${artis}\n💿 ${album}`,
    }, { quoted: m });

  } catch (err) {
    console.error("[spotifycard] Error:", err.message);
    await m.react("❌");
    return m.reply(`❌ Gagal generate Spotify card.\n\n*Detail:* ${err.message}`);
  }
}

export { pluginConfig as config, handler };