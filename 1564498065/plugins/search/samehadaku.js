import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "samehadaku",
  alias: ["anime", "cariAnime", "carianime"],
  category: "search",
  description: "Cari anime di Samehadaku",
  usage: ".samehadaku <judul anime>",
  example: ".samehadaku naruto",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function buildAnimeCard(anime) {
  const W = 900, H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0d1a");
  bg.addColorStop(1, "#1a0d2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const POSTER_W = 200, POSTER_H = 280;
  const POSTER_X = 30, POSTER_Y = 20;

  try {
    const img = await loadImage(anime.image);
    
    ctx.save();
    roundRect(ctx, POSTER_X, POSTER_Y, POSTER_W, POSTER_H, 12);
    ctx.clip();
    ctx.drawImage(img, POSTER_X, POSTER_Y, POSTER_W, POSTER_H);
    ctx.restore();

    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    roundRect(ctx, POSTER_X, POSTER_Y, POSTER_W, POSTER_H, 12);
    ctx.stroke();
  } catch {
    
    ctx.fillStyle = "#1e1b4b";
    roundRect(ctx, POSTER_X, POSTER_Y, POSTER_W, POSTER_H, 12);
    ctx.fill();
    ctx.fillStyle = "#6d28d9";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🎌", POSTER_X + POSTER_W / 2, POSTER_Y + POSTER_H / 2 + 15);
  }

  const CX = 260;

  const typeColors = { TV: "#7c3aed", Movie: "#db2777", OVA: "#0891b2", Special: "#d97706" };
  const badgeColor = typeColors[anime.type] || "#6d28d9";
  ctx.fillStyle = badgeColor;
  roundRect(ctx, CX, 28, 64, 26, 6);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(anime.type || "TV", CX + 32, 46);

  ctx.textAlign = "left";
  ctx.fillStyle = "#f5f3ff";
  ctx.font = "bold 26px sans-serif";
  const title = truncate(anime.title, 38);
  ctx.fillText(title, CX, 90);

  const titleW = Math.min(ctx.measureText(title).width, W - CX - 30);
  const grad = ctx.createLinearGradient(CX, 0, CX + titleW, 0);
  grad.addColorStop(0, "#7c3aed");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(CX, 96, titleW, 2);

  const score = parseFloat(anime.score) || 0;
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(`★ ${anime.score}`, CX, 132);
  
  drawScoreBar(ctx, CX + 120, 118, 200, 14, score / 10, "#fbbf24");

  const genres = (anime.genre || "").split(",").map(g => g.trim()).slice(0, 4);
  let gx = CX;
  const gy = 158;
  for (const genre of genres) {
    const tw = ctx.measureText(genre).width + 20;
    if (gx + tw > W - 20) break;
    ctx.fillStyle = "rgba(124,58,237,0.25)";
    roundRect(ctx, gx, gy, tw, 24, 5);
    ctx.fill();
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 1;
    roundRect(ctx, gx, gy, tw, 24, 5);
    ctx.stroke();
    ctx.fillStyle = "#c4b5fd";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(genre, gx + tw / 2, gy + 16);
    gx += tw + 8;
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#6d28d9";
  ctx.font = "13px sans-serif";
  ctx.fillText("🔗 " + truncate(anime.url, 55), CX, 210);

  ctx.strokeStyle = "rgba(124,58,237,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CX, 228);
  ctx.lineTo(W - 30, 228);
  ctx.stroke();

  ctx.fillStyle = "rgba(196,181,253,0.4)";
  ctx.font = "12px sans-serif";
  ctx.fillText("Samehadaku • powered by azbry.com", CX, 252);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#7c3aed";
  ctx.beginPath();
  ctx.arc(W - 60, 60, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas.toBuffer("image/png");
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

function drawScoreBar(ctx, x, y, w, h, pct, color) {
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const fill = ctx.createLinearGradient(x, 0, x + w, 0);
  fill.addColorStop(0, color);
  fill.addColorStop(1, "#f59e0b");
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, Math.max(w * pct, h), h, h / 2);
  ctx.fill();
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

async function handler(m, { sock, config: botConfig }) {
  const query = m.text?.trim();
  if (!query) {
    return m.reply(
      `❌ *Masukkan judul anime yang ingin dicari!*\n\n` +
      `Contoh: \`${m.prefix}samehadaku naruto\``
    );
  }

  await m.reply(`🔍 Mencari anime *"${query}"*...`);

  let data;
  try {
    const res = await fetch(
      `https://api.azbry.com/api/search/samehadaku?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    return m.reply(`❌ Gagal mengambil data. Coba lagi nanti.\n_${e.message}_`);
  }

  if (!data?.status || !data?.results?.length) {
    return m.reply(`😔 Anime *"${query}"* tidak ditemukan di Samehadaku.`);
  }

  const results = data.results;
  const total = data.total;

  if (results.length === 1) {
    return sendAnimeDetail(m, sock, results[0], botConfig);
  }

  const rows = results.map((anime, i) => ({
    title: `${i + 1}. ${anime.title}`,
    id: `__samehadaku_detail_${anime.id}__`,
    description: `${anime.type} • ⭐ ${anime.score} • ${anime.genre?.split(",")[0]?.trim()}`,
  }));

  const listText = results
    .map((anime, i) =>
      `*${i + 1}. ${anime.title}*\n` +
      `   📺 ${anime.type} | ⭐ ${anime.score}\n` +
      `   🏷️ ${anime.genre?.split(",").slice(0, 3).join(", ")}`
    )
    .join("\n\n");

  const bodyText =
    `🎌 *Hasil pencarian: "${query}"*\n` +
    `📊 Ditemukan *${total}* anime\n\n` +
    listText +
    `\n\n_Pilih anime dari daftar di bawah_`;

  try {
    const { generateWAMessageFromContent, prepareWAMessageMedia } = await import("ichigo");
    const saluranId = botConfig.saluran?.id || "120363409557700746@newsletter";
    const saluranName = botConfig.saluran?.name || botConfig.bot?.name || "Bot";

    let headerMedia = null;
    try {
      headerMedia = await prepareWAMessageMedia(
        { image: { url: results[0].image } },
        { upload: sock.waUploadToServer }
      );
    } catch {}

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage: {
            header: headerMedia?.imageMessage
              ? { hasMediaAttachment: true, imageMessage: headerMedia.imageMessage }
              : { hasMediaAttachment: false },
            body: { text: bodyText },
            footer: { text: `© Samehadaku | ${botConfig.bot?.name || "Bot"}` },
            contextInfo: {
              mentionedJid: [m.sender],
              isForwarded: true,
              forwardingScore: 9,
              forwardedNewsletterMessageInfo: {
                newsletterJid: saluranId,
                newsletterName: saluranName,
                serverMessageId: 127,
              },
            },
            nativeFlowMessage: {
              messageParamsJson: JSON.stringify({
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  list_title: "Pilih anime",
                  button_title: "🎌 Pilih Anime",
                },
              }),
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "🎌 Pilih Anime",
                    sections: [{ title: `📋 Hasil: "${query}"`, rows }],
                  }),
                },
              ],
            },
          },
        },
      },
    }, { userJid: sock.user.jid });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
  } catch (err) {
    console.error("[Samehadaku] interactiveMessage error:", err.message);
    const prefix = botConfig.command?.prefix || ".";
    await m.reply(bodyText + `\n\n_Ketik \`${prefix}samehadaku <judul lengkap>\` untuk detail_`);
  }
}

async function sendAnimeDetail(m, sock, anime, botConfig) {
  const caption =
    `🎌 *${anime.title}*\n\n` +
    `📺 *Tipe*    : ${anime.type}\n` +
    `⭐ *Score*   : ${anime.score}\n` +
    `🏷️ *Genre*   : ${anime.genre}\n` +
    `🔗 *Link*    : ${anime.url}`;

  let imgBuffer = null;
  try {
    imgBuffer = await buildAnimeCard(anime);
  } catch (e) {
    console.error("[Samehadaku] Canvas error:", e.message);
  }

  try {
    if (imgBuffer) {
      await sock.sendMessage(
        m.chat,
        { image: imgBuffer, caption, mimetype: "image/png" },
        { quoted: m }
      );
    } else {
      
      await sock.sendMessage(
        m.chat,
        { image: { url: anime.image }, caption },
        { quoted: m }
      );
    }
  } catch {
    await m.reply(caption);
  }
}

export { sendAnimeDetail };
export default { config: pluginConfig, handler };