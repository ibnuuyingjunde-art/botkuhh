import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
import { prepareWAMessageMedia } from "ichigo";
import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";

const pluginConfig = {
  name: "playch",
  alias: ["pch", "playsaluran"],
  category: "search",
  description: "Putar musik ke saluran (convert opus)",
  usage: ".playch <query> | .playch --idch <id> <query>",
  example: ".playch komang",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const run = promisify(exec);
const MAX_DURATION_SEC = 900;

// "3:04" / "1:02:03" -> detik
function toSeconds(str) {
  if (!str || typeof str !== "string") return 0;
  const parts = str.split(/[:.]/).map((n) => parseInt(n, 10));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function thumbFromId(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

async function searchYt(q) {
  const { ytSearch } = await import("../../src/scraper/ytsearch-safe.js");
  const { videos } = await ytSearch(q);
  const list = (videos || []).filter((v) => v?.videoId && v.duration?.seconds > 0);
  if (!list.length) return null;

  // Utamakan hasil < 15 menit, kalau tidak ada pakai hasil pertama
  const v = list.find((x) => x.duration.seconds < MAX_DURATION_SEC) || list[0];
  return {
    videoId: v.videoId,
    title: v.title,
    url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
    thumbnail: v.thumbnail || thumbFromId(v.videoId),
    author: v.author?.name,
    duration: v.duration?.timestamp,
    durationSec: v.duration?.seconds || 0,
    views: v.views || null,
    ago: v.ago || null,
  };
}

function parseArtistTitle(video) {
  const raw = (video.title || "Unknown").trim();
  const seps = [" - ", " – ", " — ", " | "];
  for (const sep of seps) {
    if (raw.includes(sep)) {
      const [first, ...rest] = raw.split(sep);
      const artist = first.trim();
      const title = rest.join(sep).trim();
      if (artist && title) return { artist, title };
    }
  }
  return {
    artist: video.author || "Unknown Artist",
    title: raw,
  };
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth);
  }

  return lines.slice(0, maxLines);
}

function drawEqualizer(ctx, x, y, color) {
  const bars = [6, 12, 8, 14, 5];
  let bx = x;
  for (const h of bars) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, y - h, 3, h, 1.5);
    ctx.fill();
    bx += 6;
  }
  return bx - x;
}

function drawPlayIcon(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const s = r * 0.55;
  ctx.moveTo(cx - s * 0.4, cy - s);
  ctx.lineTo(cx - s * 0.4, cy + s);
  ctx.lineTo(cx + s * 0.9, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function buildNowPlayingCard({ thumbnail, title, artist, duration, chName }) {
  const W = 1000, H = 460;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(0.55, "#141b33");
  bg.addColorStop(1, "#1e2a4a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#60a5fa";
  ctx.beginPath();
  ctx.arc(W - 40, 10, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#a855f7";
  ctx.beginPath();
  ctx.arc(60, H + 10, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.beginPath();
  ctx.roundRect(20, 20, W - 40, H - 40, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const thumbSize = H - 100;
  const thumbX = 46, thumbY = 50;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 20);
  ctx.fill();
  ctx.restore();

  let thumbImg = null;
  try {
    thumbImg = await loadImage(thumbnail);
  } catch {}

  if (thumbImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 20);
    ctx.clip();
    const scale = Math.max(thumbSize / thumbImg.width, thumbSize / thumbImg.height);
    const iw = thumbImg.width * scale, ih = thumbImg.height * scale;
    ctx.drawImage(thumbImg, thumbX - (iw - thumbSize) / 2, thumbY - (ih - thumbSize) / 2, iw, ih);

    const shade = ctx.createLinearGradient(0, thumbY, 0, thumbY + thumbSize);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = shade;
    ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 20);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 20);
  ctx.stroke();

  drawPlayIcon(ctx, thumbX + thumbSize / 2, thumbY + thumbSize / 2, 30);

  const textX = thumbX + thumbSize + 34;
  const textW = W - textX - 40;
  const blockOffset = 60;

  ctx.fillStyle = "#60a5fa";
  ctx.font = "bold 14px sans-serif";
  const eqW = drawEqualizer(ctx, textX, thumbY + 22 + blockOffset, "#60a5fa");
  ctx.fillText("NOW PLAYING · SALURAN", textX + eqW + 10, thumbY + 24 + blockOffset);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  const titleLines = wrapLines(ctx, title, textW, 2);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, textX, thumbY + 68 + blockOffset + i * 40);
  });

  const artistY = thumbY + 68 + blockOffset + titleLines.length * 40 + 6;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "18px sans-serif";
  ctx.fillText(truncateText(ctx, artist, textW), textX, artistY);

  const badgeY = artistY + 22;

  ctx.font = "bold 13px sans-serif";
  const durLabel = `⏱ ${duration}`;
  const durW = ctx.measureText(durLabel).width + 26;
  ctx.fillStyle = "rgba(96,165,250,0.18)";
  ctx.beginPath();
  ctx.roundRect(textX, badgeY, durW, 28, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(96,165,250,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#93c5fd";
  ctx.fillText(durLabel, textX + 13, badgeY + 19);

  const chLabel = truncateText(ctx, `📡 ${chName}`, textW - durW - 12);
  const chW = ctx.measureText(chLabel).width + 26;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.roundRect(textX + durW + 10, badgeY, chW, 28, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(chLabel, textX + durW + 23, badgeY + 19);

  return canvas.toBuffer("image/png");
}

// Tambah provider cadangan di sini. Tiap provider mengembalikan URL audio (string).
// Contoh:
// async (url) => {
//   const { data } = await axios.get("https://API-KAMU/ytmp3", { params: { url }, timeout: 30000 });
//   return data?.result?.download;
// },
const FALLBACK_PROVIDERS = [];

function isAudioResponse(res) {
  const type = String(res.headers?.["content-type"] || "").toLowerCase();
  if (type.includes("text/html") || type.includes("json")) return false;
  return res.data?.length >= 50000;
}

async function fetchAudioBuffer(link, headers = {}) {
  const res = await axios.get(link, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", ...headers },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  if (!isAudioResponse(res)) throw new Error("Link bukan file audio");
  return Buffer.from(res.data);
}

async function getPlayChAudio(url) {
  const providers = [
    async (u) => {
      const r = await ytdl2(u, "mp3");
      if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
      // yt-dlp lokal -> file di disk; sumber cadangan -> link web
      if (r.file) return { buffer: await readResultBuffer(r, { minBytes: 50000 }) };
      return { download: r.download, headers: r.headers };
    },
    ...FALLBACK_PROVIDERS,
  ];

  let lastErr;
  for (const provider of providers) {
    try {
      const res = await provider(url);
      if (res?.buffer) return res.buffer;
      const link = typeof res === "string" ? res : res?.download;
      if (!link) throw new Error("Provider tidak mengembalikan link");
      return await fetchAudioBuffer(link, res?.headers);
    } catch (err) {
      lastErr = err;
      console.error("[PlayCh] provider gagal:", err?.message);
    }
  }
  throw lastErr || new Error("Semua provider gagal");
}

// Format audio yang dikirim ke saluran. Ganti ke "mp3" kalau mau coba bentuk lama.
//  - "opus": ogg/opus (aman, pasti bisa diputar)
//  - "mp3" : mp3 hasil encode ulang (bentuk pesan sama seperti versi lama)
const AUDIO_MODE = "opus";
const AUDIO_OUT = {
  opus: {
    mimetype: "audio/ogg; codecs=opus",
    ext: "ogg",
    args: "-vn -map_metadata -1 -ac 1 -ar 48000 -c:a libopus -b:a 96k -vbr on -application audio -f ogg",
  },
  mp3: {
    mimetype: "audio/mpeg",
    ext: "mp3",
    args: "-vn -map_metadata -1 -ac 2 -ar 44100 -c:a libmp3lame -b:a 128k -f mp3",
  },
};

function ffmpegBin() {
  try {
    return createRequire(import.meta.url)("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return "ffmpeg";
  }
}

// mp3 -> ogg/opus (sama seperti contoh audioMessage: audio/ogg; codecs=opus)
async function convertAudio(inputBuf) {
  const tmp = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const inp = path.join(tmp, `pch_in_${id}.mp3`);
  const out = path.join(tmp, `pch_out_${id}.${AUDIO_OUT.opus.ext}`);
  fs.writeFileSync(inp, inputBuf);
  try {
    await run(`"${ffmpegBin()}" -y -i "${inp}" ${AUDIO_OUT.opus.args} "${out}"`, { maxBuffer: 1024 * 1024 * 20 });
    return fs.readFileSync(out);
  } finally {
    try { fs.unlinkSync(inp); } catch {}
    try { fs.unlinkSync(out); } catch {}
  }
}

// Kirim audio ke saluran pakai relayMessage (struktur audioMessage)
async function relayChannelAudio(sock, chId, buf, { seconds, artist, title }) {
  const media = await prepareWAMessageMedia(
    { audio: buf, mimetype: AUDIO_OUT.opus.mimetype },
    { upload: sock.waUploadToServer, jid: chId },
  );
  const a = media.audioMessage;

  return sock.relayMessage(
    chId,
    {
      audioMessage: {
        url: a.url,
        mimetype: AUDIO_OUT.opus.mimetype,
        fileSha256: a.fileSha256,
        fileLength: a.fileLength,
        seconds,
        ptt: false,
        mediaKey: a.mediaKey,
        fileEncSha256: a.fileEncSha256,
        directPath: a.directPath,
        mediaKeyTimestamp: a.mediaKeyTimestamp,
        contextInfo: {
          forwardingScore: 2,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: chId,
            serverMessageId: Math.floor(Math.random() * 9999),
            newsletterName: `${artist} - ${title}`,
          },
          forwardOrigin: 0,
          ...(a.mediaKey
            ? { mediaDomainInfo: { mediaKeyDomain: 1, e2EeMediaKey: Buffer.from(a.mediaKey).toString("base64") } }
            : {}),
        },
      },
      messageContextInfo: {
        messageSecret: crypto.randomBytes(32),
      },
    },
    {},
  );
}

async function handler(m, { sock }) {
  const raw = m.text?.trim() || "";
  let chId = config?.saluran?.id;
  let chName = config?.saluran?.name || config?.bot?.name || "lyniX's MD";
  let q = raw;

  const idchMatch = raw.match(/--idch\s+(\S+)/);
  if (idchMatch) {
    chId = idchMatch[1];
    chName = chId;
    q = raw.replace(/--idch\s+\S+/, "").trim();
  }

  if (!q) {
    m.react("❌");
    return m.reply(
      `🎵 *PLAY SALURAN*\n\n` +
      `\`${m.prefix}playch <judul lagu>\`\n` +
      `\`${m.prefix}playch --idch <id_saluran> <judul lagu>\``,
    );
  }

  if (!chId) {
    m.react("❌");
    return m.reply(`❌ Saluran belum diatur. Gunakan \`--idch <id>\` atau atur di config.js`);
  }

  m.react("🔎");

  try {
    const video = await searchYt(q);
    if (!video) {
      await m.react("❌");
      return m.reply(`❌ Video tidak ditemukan`);
    }

    const ytChannel = video.author || "Unknown";
    const { artist, title } = parseArtistTitle(video);
    const duration = video.duration || "0:00";

    const info =
      `╭─ 🎵 *NOW PLAYING (SALURAN)*\n` +
      `│·📌 Judul   : ${video.title}\n` +
      `│·👤 Channel : ${ytChannel}\n` +
      `│·⏱️ Durasi  : ${duration}\n` +
      `│·👀 Views   : ${video.views || "-"}\n` +
      `│·📅 Upload  : ${video.ago || "-"}\n` +
      `│·🆔 ID      : \`${video.videoId}\`\n` +
      `│·📡 Saluran : \`${chId}\`\n` +
      `│·🔗 Link    : ${video.url}\n` +
      `╰───────────────────────────\n` +
      `_⏳ Mengirim audio ke saluran, harap tunggu..._`;

    await sock.sendPreview(
      m.chat,
      {
        caption: info,
        url: video.url,
        title: video.title,
        description: "YouTube Video",
        image: video.thumbnail,
        previewType: 1,
      },
      { quoted: m },
    );

    let mp3Buf;
    try {
      mp3Buf = await getPlayChAudio(video.url);
    } catch (dlErr) {
      await m.react("❌");
      return m.reply("❌ *Gagal mengambil audio.* Server downloader lagi bermasalah, coba lagi nanti.");
    }

    let opusBuf;
    try {
      opusBuf = await convertAudio(mp3Buf);
      if (opusBuf.length < 10000) throw new Error("hasil konversi terlalu kecil");
    } catch (convErr) {
      console.error("[PlayCh] konversi audio gagal:", convErr?.message);
      await m.react("☢");
      return m.reply("❌ *Gagal mengonversi audio untuk saluran.* Pastikan ffmpeg (libopus/libmp3lame) terpasang di server.");
    }

    m.react("🎵");

    const caption =
      `╭➤─┈───┈──✦➤\n` +
      `┆ Judul : ${title}\n` +
      `┆ Artist : ${artist}\n` +
      `┆ Durasi : ${duration}\n` +
      `┆ Saluran : ${chName}\n` +
      `╰─➤─┈───┈───┈`;

    const cardBuffer = await buildNowPlayingCard({
      thumbnail: video.thumbnail,
      title,
      artist,
      duration,
      chName,
    });

    await sock.sendMessage(chId, {
      image: cardBuffer,
      caption,
    });

    await relayChannelAudio(sock, chId, opusBuf, {
      seconds: video.durationSec || toSeconds(duration) || 0,
      artist,
      title,
    });

    m.react("✅");
    m.reply(`✅ *${title}* berhasil dikirim ke saluran`);
  } catch (e) {
    console.error("[PlayCh]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };