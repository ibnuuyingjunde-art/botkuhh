import ttdown from "../../src/scraper/tiktok.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const pluginConfig = {
  name: ["ttmp3"],
  alias: ["ttmusic", "tiktokmusic"],
  category: "download",
  description: "Download audio TikTok",
  usage: ".ttmp3 <url>",
  example: ".ttmp3 https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

function getTempDir() {
  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    maxRedirects: 10,
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.tiktok.com/",
      "Accept": "*/*",
    },
  });
  return Buffer.from(res.data);
}

async function extractAudioFromVideo(videoUrl) {
  const tmpDir = getTempDir();
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const inputFile = path.join(tmpDir, `ttmp3_${stamp}.mp4`);
  const outputFile = path.join(tmpDir, `ttmp3_${stamp}.mp3`);

  const buf = await downloadBuffer(videoUrl);
  fs.writeFileSync(inputFile, buf);

  await new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .noVideo()
      .audioCodec("libmp3lame")
      .format("mp3")
      .on("end", resolve)
      .on("error", reject)
      .save(outputFile);
  });

  if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size <= 0) {
    throw new Error("Gagal mengekstrak audio TikTok");
  }

  return {
    buffer: fs.readFileSync(outputFile),
    files: [inputFile, outputFile],
  };
}

async function handler(m, { sock }) {
  const url = m.text?.trim();
  let cleanupFiles = [];

  const cleanupTempFiles = () => {
    for (const file of cleanupFiles) {
      if (!file) continue;
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
    cleanupFiles = [];
  };

  if (!url) {
    return m.reply(`📌 Contoh: *${m.prefix}ttmp3 https://vt.tiktok.com/...*`);
  }

  if (!url.match(/tiktok\.com|vt\.tiktok/i)) {
    return m.reply("❌ URL tidak valid. Gunakan link TikTok.");
  }

  m.react("🕕");

  try {
    const result = await ttdown(url);

    const audioDownload = result.downloads.find((d) => d.type === "mp3");
    const videoDownload =
      result.downloads.find((d) => d.type === "nowatermark_hd") ||
      result.downloads.find((d) => d.type === "nowatermark");

    let audioBuffer;

    if (audioDownload?.url) {
      
      try {
        audioBuffer = await downloadBuffer(audioDownload.url);
      } catch {
        
        if (!videoDownload?.url) throw new Error("Sumber audio tidak ditemukan.");
        const extracted = await extractAudioFromVideo(videoDownload.url);
        cleanupFiles = extracted.files;
        audioBuffer = extracted.buffer;
      }
    } else if (videoDownload?.url) {
      
      const extracted = await extractAudioFromVideo(videoDownload.url);
      cleanupFiles = extracted.files;
      audioBuffer = extracted.buffer;
    } else {
      throw new Error("Sumber audio tidak ditemukan.");
    }

    await sock.sendMessage(
      m.chat,
      {
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        fileName: `TikTok_Audio_${Date.now()}.mp3`,
        ptt: false,
      },
      { quoted: m },
    );

    m.react("✅");
    cleanupTempFiles();
  } catch (err) {
    cleanupTempFiles();
    console.error("[ttmp3] Error:", err);
    m.react("❌");
    m.reply(`❌ Gagal mengunduh audio\n\n> ${err.message}`);
  }
}

export { pluginConfig as config, handler };