import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import te from "../../src/lib/ichigo-error.js";
import { ytSearch, ytSearchVideo } from "../../src/scraper/ytsearch-safe.js";
import { ytultra, pick, videoId } from "../../src/scraper/ytultra.js";
import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";

const pluginConfig = {
  name: "play6",
  alias: ["p6", "ytplay6"],
  category: "search",
  description: "Cari lagu di YouTube, pilih MP3 atau MP4 lewat tombol - versi 6",
  usage: ".play6 <judul lagu / link YouTube>",
  example: ".play6 bye ariana grande",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_DURATION_SECONDS = 20 * 60;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const YOUTUBE_URL_REGEX = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
const CHOICE_REGEX = /^(mp3|mp4)\s+(\S+)$/i;

function safe(text) {
  return String(text || "").replace(/[\[\]()<>*_`]/g, " ").replace(/\s+/g, " ").trim();
}

function fileNameFor(title, ext) {
  const clean = String(title || "media").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${clean.slice(0, 80) || "media"}.${ext}`;
}

async function findVideo(query) {
  if (YOUTUBE_URL_REGEX.test(query)) {
    const id = videoId(query);
    const info = await ytSearchVideo(id);
    return {
      videoId: id,
      title: info.title,
      url: info.url,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      channel: info.author?.name || "-",
      duration: "-",
      seconds: 0,
    };
  }

  const { videos } = await ytSearch(query);
  const v = videos.find((x) => x.duration?.seconds > 0) || videos[0];
  if (!v) return null;

  return {
    videoId: v.videoId,
    title: v.title,
    url: v.url,
    thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    channel: v.author?.name || "-",
    duration: v.duration?.timestamp || "-",
    seconds: v.duration?.seconds || 0,
  };
}

async function fetchImage(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: { "User-Agent": UA },
    });
    const buffer = Buffer.from(res.data);
    return buffer.length ? buffer : undefined;
  } catch {
    return undefined;
  }
}

async function downloadRaw(url, maxBytes) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    headers: { "User-Agent": UA, Accept: "*/*" },
  });

  const buffer = Buffer.from(res.data);
  if (!buffer.length) throw new Error("File kosong");

  const contentType = String(res.headers?.["content-type"] || "");
  if (/json|html|text\//i.test(contentType)) {
    console.error("[Play6] Respons bukan media:", contentType, buffer.toString("utf8", 0, 200));
    throw new Error("Respons download bukan file media");
  }

  return buffer;
}

function sniffFormat(buf) {
  if (buf.length > 3 && buf.toString("latin1", 0, 3) === "ID3") return "mp3";
  if (buf.length > 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "mp3";
  if (buf.length > 8 && buf.toString("latin1", 4, 8) === "ftyp") return "m4a";
  return "other";
}

async function downloadAudio(url) {
  const buffer = await downloadRaw(url, MAX_AUDIO_BYTES);
  const format = sniffFormat(buffer);

  if (format === "mp3") return { buffer, mimetype: "audio/mpeg", ext: "mp3" };
  if (format === "m4a") return { buffer, mimetype: "audio/mp4", ext: "m4a" };

  // Tanpa ffmpeg: kirim apa adanya sebagai mp3 (sumber savetube sudah mp3).
  return { buffer, mimetype: "audio/mpeg", ext: "mp3" };
}

function tooBigMessage(e, maxBytes) {
  return e.code === "ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED"
    ? `⚠️ File terlalu besar (maksimal ${maxBytes / 1024 / 1024} MB).`
    : `⚠️ Gagal mengunduh file (${e.message}). Coba lagi nanti.`;
}

async function sendChoice(m, sock, v) {
  const prefix = m.prefix || ".";
  const image = await fetchImage(v.thumbnail);

  await sock.sendMessage(
    m.chat,
    {
      interactiveMessage: {
        header: ``,
        title: `🎵 *${safe(v.title)}*\n\n📺 Channel: *${safe(v.channel) || "-"}*\n⏱️ Durasi: *${v.duration}*\n🔗 ${v.url}`,
        footer: `Pilih format yang kamu mau`,
        ...(image ? { image } : {}),
        contextInfo: {
          mentionedJid: [m.sender],
        },
        nativeFlowMessage: {
          messageParamsJson: JSON.stringify({
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1, 2],
              list_title: "Pilih format",
              button_title: "Tap Disini",
            },
          }),
          buttons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🎵 MP3 (Audio)",
                id: `${prefix}play6 mp3 ${v.url}`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🎬 MP4 (Video)",
                id: `${prefix}play6 mp4 ${v.url}`,
              }),
            },
          ],
        },
      },
    },
    { quoted: m },
  );
}

// Sumber 1: ytdl2 (yt-dlp lokal). Mengembalikan null kalau gagal supaya jatuh ke ytultra (urutan lama).
async function viaYtdl2(v, format) {
  try {
    const r = await ytdl2(v.url, format === "mp3" ? "mp3" : "480");
    if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
    return await readResultBuffer(r, {
      minBytes: format === "mp3" ? 20_000 : 100_000,
      maxBytes: format === "mp3" ? MAX_AUDIO_BYTES : MAX_VIDEO_BYTES,
    });
  } catch (e) {
    console.error(`[Play6] ytdl2 ${format} gagal:`, e.message);
    return null;
  }
}

async function sendMp3(m, sock, v) {
  let file = null;
  const local = await viaYtdl2(v, "mp3");
  if (local) file = { buffer: local, mimetype: "audio/mpeg", ext: "mp3" };

  if (!file) {
    const res = await ytultra(v.url);
    const audio = pick(res.items, "mp3");

    if (!audio?.url) {
      await m.react("❌");
      return m.reply("⚠️ Link audio untuk lagu ini tidak ditemukan.");
    }

    console.log("[Play6] Audio dipilih:", audio.ext, audio.url.slice(0, 120));

    try {
      file = await downloadAudio(audio.url);
    } catch (e) {
      console.error("[Play6] Download audio gagal:", e.code || e.message);
      await m.react("❌");
      return m.reply(tooBigMessage(e, MAX_AUDIO_BYTES));
    }
  }

  await sock.sendMessage(
    m.chat,
    {
      audio: file.buffer,
      mimetype: file.mimetype,
      ptt: false,
      fileName: fileNameFor(v.title, file.ext),
    },
    { quoted: m },
  );
  await m.react("✅");
}

async function sendMp4(m, sock, v) {
  let buffer = await viaYtdl2(v, "mp4");

  if (!buffer) {
    const res = await ytultra(v.url);
    const video = pick(res.items, "mp4");

    if (!video?.url) {
      await m.react("❌");
      return m.reply("⚠️ Link video untuk lagu ini tidak ditemukan.");
    }

    console.log("[Play6] Video dipilih:", video.ext, video.height, video.hasAudio, video.url.slice(0, 120));

    try {
      buffer = await downloadRaw(video.url, MAX_VIDEO_BYTES);
    } catch (e) {
      console.error("[Play6] Download video gagal:", e.code || e.message);
      await m.react("❌");
      return m.reply(tooBigMessage(e, MAX_VIDEO_BYTES));
    }
  }

  await sock.sendMessage(
    m.chat,
    {
      video: buffer,
      mimetype: "video/mp4",
      fileName: fileNameFor(v.title, "mp4"),
      caption: `🎬 *${safe(v.title)}*`,
    },
    { quoted: m },
  );
  await m.react("✅");
}

async function handler(m, { sock }) {
  const query = (m.text || "").trim();

  if (!query) {
    return m.reply(
      `🎵 *ᴘʟᴀʏ ᴠ6*\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} bye ariana grande\``,
    );
  }

  if (query.length > 200) {
    return m.reply("❌ Judul terlalu panjang, maksimal 200 karakter.");
  }

  await m.react("🕕");

  try {
    const choice = query.match(CHOICE_REGEX);

    if (choice && YOUTUBE_URL_REGEX.test(choice[2])) {
      const v = await findVideo(choice[2]);
      return choice[1].toLowerCase() === "mp3" ? await sendMp3(m, sock, v) : await sendMp4(m, sock, v);
    }

    const v = await findVideo(query);

    if (!v) {
      await m.react("❌");
      return m.reply(`❌ Lagu *${safe(query)}* tidak ditemukan.`);
    }

    if (v.seconds > MAX_DURATION_SECONDS) {
      await m.react("❌");
      return m.reply(`⚠️ Durasi terlalu panjang (maksimal ${MAX_DURATION_SECONDS / 60} menit).`);
    }

    await sendChoice(m, sock, v);
    await m.react("✅");
  } catch (err) {
    console.error("[Play6] Error:", err.message);
    await m.react("☢");
    if (/ytultra/i.test(err.message)) {
      return m.reply(`⚠️ Server download sedang bermasalah (${err.message.slice(0, 120)}). Coba lagi beberapa saat lagi.`);
    }
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };