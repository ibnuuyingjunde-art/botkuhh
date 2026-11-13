import { queueFFmpeg } from "../../src/lib/ichigo-ffmpeg.js";
import { config as botConfig } from "../../config.js";
import fs from "fs";
import path from "path";

const pluginConfig = {
  name: "vocalremover",
  alias: ["vocal", "removevocal", "karaoke", "instrumental", "novocal"],
  category: "tools",
  description: "Hapus vokal dari audio/video — hasilkan musik instrumental",
  usage: ".vocalremover [reply audio/video] [center|soft|highcut]",
  example: ".vocalremover soft",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 3,
  isEnabled: true,
};

function getTempDir() {
  const dir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

async function createLoadingEditor(sock, m) {
  const sent = await sock.sendMessage(m.chat, { text: "⏳ Memulai..." }, { quoted: m });
  const key = sent?.key;

  return async (text) => {
    if (!key) return; 
    try {
      await sock.sendMessage(m.chat, { text, edit: key });
    } catch (e) {
      console.warn("[VocalRemover] Gagal edit pesan loading:", e.message);
    }
  };
}

function detectMedia(m) {
  const check = (src, dlFn) => {
    if (!src || !dlFn) return null;
    const isAudio = src.isAudio || src.type === "audioMessage" || src.mtype === "audioMessage" || !!src.message?.audioMessage;
    const isVideo = src.isVideo || src.type === "videoMessage" || src.mtype === "videoMessage" || !!src.message?.videoMessage;
    if (isAudio) return { downloadFn: dlFn, isVideo: false };
    if (isVideo) return { downloadFn: dlFn, isVideo: true };
    return null;
  };
  return check(m, m.download) || check(m.quoted, m.quoted?.download) || null;
}

async function tryHuggingFace(audioPath, loading) {
  const token = botConfig?.APIkey?.huggingface;
  if (!token) throw new Error("APIkey.huggingface tidak diset di config.js");

  const { default: fetch } = await import("node-fetch");
  const MODEL = "facebook/demucs";
  const url = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

  const fileBuffer = fs.readFileSync(audioPath);

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "audio/mpeg",
      },
      body: fileBuffer,
      timeout: 60000,
    });

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();

        console.log("[VocalRemover][DEBUG] HF content-type:", contentType);
        console.log("[VocalRemover][DEBUG] HF response keys:", Array.isArray(data) ? `array[${data.length}]` : Object.keys(data || {}));
        console.log("[VocalRemover][DEBUG] HF response sample:", JSON.stringify(data).slice(0, 500));

        const stems = Array.isArray(data) ? data : data?.outputs || data?.audio;
        if (!stems) throw new Error("Format response HF tidak dikenali (JSON tanpa stem)");

        const list = Array.isArray(stems) ? stems : [stems];
        console.log("[VocalRemover][DEBUG] HF stem labels:", list.map((s) => s?.label || s?.name || "(tanpa label)"));

        const target =
          list.find((s) => /no.?vocal|instrumental|accompaniment|other/i.test(s?.label || s?.name || "")) ||
          list[0];
        console.log("[VocalRemover][DEBUG] HF stem dipilih:", target?.label || target?.name || "(index 0, tanpa label)");

        const b64 = target?.["audio-blob"] || target?.blob || target?.data || target;
        if (!b64 || typeof b64 !== "string") throw new Error("Tidak ada data audio di response HF");
        return Buffer.from(b64, "base64");
      }

      console.log("[VocalRemover][DEBUG] HF response binary, content-type:", contentType);
      const arrBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      if (buf.length < 1000) throw new Error("Response audio dari HF terlalu kecil");
      return buf;
    }

    if (res.status === 503) {
      let waitSec = 10;
      try {
        const errData = await res.json();
        waitSec = Math.min(Math.ceil(errData?.estimated_time || 10), 30);
      } catch {}
      if (loading) await loading(`🤖 Model AI sedang dimuat di server...\n> Menunggu ${waitSec}s (percobaan ${attempt + 1}/6)`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    const errText = await res.text();
    throw new Error(`HuggingFace gagal ${res.status}: ${errText.slice(0, 150)}`);
  }

  throw new Error("HuggingFace timeout: model tidak kunjung siap setelah beberapa percobaan");
}

const FILTER_MODES = {

  center: "pan=stereo|c0=c0-c1|c1=c1-c0",

  soft: "pan=stereo|c0=0.85*c0-0.65*c1|c1=0.85*c1-0.65*c0",

  highcut: "pan=stereo|c0=c0-c1|c1=c1-c0,equalizer=f=1000:t=q:w=2:g=-6",
};

const DEFAULT_MODE = "soft";

async function tryFFmpegLocal(audioPath, outputPath, mode) {
  const filter = FILTER_MODES[mode] || FILTER_MODES[DEFAULT_MODE];
  await queueFFmpeg(`ffmpeg -y -i "${audioPath}" -af "${filter}" -ar 44100 -ac 2 -b:a 192k "${outputPath}"`);

  if (!fs.existsSync(outputPath)) throw new Error("FFmpeg gagal menghasilkan file output");
  const buf = fs.readFileSync(outputPath);
  if (buf.length < 1000) throw new Error("Hasil FFmpeg terlalu kecil / kosong");
  return buf;
}

async function handler(m, { sock, args }) {
  const media = detectMedia(m);

  const rawArg = (Array.isArray(args) ? args[0] : args)?.toString().toLowerCase().trim();
  const mode = FILTER_MODES[rawArg] ? rawArg : DEFAULT_MODE;

  if (!media) {
    const hfConfigured = !!botConfig?.APIkey?.huggingface;

    return m.reply(
      `🎵 *ᴠᴏᴄᴀʟ ʀᴇᴍᴏᴠᴇʀ*\n\n` +
      `> Reply atau kirim audio/video dengan caption \`${m.prefix}vocalremover\`\n\n` +
      `*Format:* Audio (MP3, OGG) atau Video MP4\n` +
      `*Alias:* \`.vocal\` \`.karaoke\` \`.instrumental\`\n\n` +
      `*Mode FFmpeg (opsional, dipakai jika AI gagal/belum diset):*\n` +
      `> \`soft\` — default, paling seimbang\n` +
      `> \`center\` — paling agresif\n` +
      `> \`highcut\` — pertahankan bass/kick\n\n` +
      (hfConfigured
        ? `✅ Provider aktif: *Hugging Face (AI)* + fallback FFmpeg`
        : `⚠️ Hugging Face belum diset — pakai FFmpeg saja (kualitas terbatas)\n> Set \`APIkey.huggingface\` di config.js untuk hasil lebih akurat`)
    );
  }

  await m.react("🎵");

  const tempDir = getTempDir();
  const ts = Date.now();
  const inputExt = media.isVideo ? "mp4" : "mp3";
  const inputPath  = path.join(tempDir, `vr_input_${ts}.${inputExt}`);
  const audioPath  = path.join(tempDir, `vr_audio_${ts}.mp3`);
  const outputPath = path.join(tempDir, `vr_out_${ts}.mp3`);

  const loading = await createLoadingEditor(sock, m);

  try {
    await loading("⏳ Mengunduh media...");
    const buffer = await media.downloadFn();
    if (!buffer || buffer.length < 1000) return loading("❌ Gagal mengunduh media.");
    fs.writeFileSync(inputPath, buffer);

    if (media.isVideo) {
      await loading("🔊 Mengekstrak audio dari video...");
      await queueFFmpeg(`ffmpeg -y -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${audioPath}"`);
    } else {
      await loading("🔊 Memproses audio...");
      await queueFFmpeg(`ffmpeg -y -i "${inputPath}" -ar 44100 -ac 2 -b:a 192k "${audioPath}"`);
    }

    if (!fs.existsSync(audioPath)) return loading("❌ Gagal memproses audio.");

    const sizeMB = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(1);
    if (parseFloat(sizeMB) > 50) return loading(`❌ File terlalu besar (${sizeMB}MB). Maks 50MB.`);

    let resultBuffer = null;
    let usedMethod = "";

    if (botConfig?.APIkey?.huggingface) {
      await loading(`🤖 Memproses dengan AI (Hugging Face)...\n> Ukuran: ${sizeMB}MB`);
      try {
        resultBuffer = await tryHuggingFace(audioPath, loading);
        usedMethod = "Hugging Face (Demucs AI)";
      } catch (e) {
        console.warn("[VocalRemover] HuggingFace gagal:", e.message);
        await loading(`⚠️ AI gagal, coba metode lokal...\n> ${e.message.slice(0, 80)}`);
      }
    }

    if (!resultBuffer || resultBuffer.length < 1000) {
      await loading(`🎚️ Memisahkan vokal (mode: ${mode})...\n> Ukuran: ${sizeMB}MB`);
      try {
        resultBuffer = await tryFFmpegLocal(audioPath, outputPath, mode);
        usedMethod = `FFmpeg (mode: ${mode})`;
      } catch (e) {
        console.warn("[VocalRemover] FFmpeg gagal:", e.message);
        await loading(`⚠️ Gagal: ${e.message.slice(0, 80)}`);
      }
    }

    if (!resultBuffer || resultBuffer.length < 1000) {
      return loading(`❌ *Gagal memproses audio*\n\n> Coba file lain atau cek log server.`);
    }

    const outMB = (resultBuffer.length / 1024 / 1024).toFixed(1);

    await loading("📤 Mengirim hasil...");
    await sock.sendMedia(m.chat, resultBuffer, null, m, { type: "audio" });
    await loading(
      `✅ *ᴠᴏᴄᴀʟ ʀᴇᴍᴏᴠᴇᴅ!*\n\n` +
      `> 🎵 Ukuran: *${outMB}MB*\n` +
      `> 🤖 Provider: *${usedMethod}*\n\n` +
      `_Hasil kurang pas? Coba mode lain: \`${m.prefix}vocal center\` / \`${m.prefix}vocal soft\` / \`${m.prefix}vocal highcut\`_`
    );

  } catch (err) {
    console.error("[VocalRemover] Error:", err);
    await loading(`❌ Error: ${err.message}`);
  } finally {
    cleanup(inputPath, audioPath, outputPath);
  }
}

export { pluginConfig as config, handler };