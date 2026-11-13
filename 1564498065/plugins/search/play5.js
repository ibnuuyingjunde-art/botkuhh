import axios from "axios";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";

const pluginConfig = {
  name: "play5",
  alias: ["p5", "ytplay5"],
  category: "search",
  description: "Cari lagu di YouTube dan kirim audionya (kartu info + MP3) - versi 5",
  usage: ".play5 <judul lagu>",
  example: ".play5 bye ariana grande",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

const MAX_AUDIO_BYTES = 40 * 1024 * 1024; // 40 MB
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Buang karakter markdown supaya teks dari YouTube tidak merusak format pesan
function safe(text) {
  return String(text || "").replace(/[\[\]()<>*_`]/g, " ").replace(/\s+/g, " ").trim();
}

// API kadang mengirim durasi "3.04", kadang "3:33" -> samakan jadi "3:04"
function formatDuration(value) {
  const v = String(value || "").trim();
  if (!v) return "-";
  return /^\d+\.\d{2}$/.test(v) ? v.replace(".", ":") : v;
}

function fileNameFor(title) {
  const clean = String(title || "audio").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${clean.slice(0, 80) || "audio"}.mp3`;
}

// detik -> "m:ss"
function secToClock(sec) {
  const n = Math.round(Number(sec) || 0);
  if (!n) return "";
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

// ytdl2: judul -> cari (ytsearch-safe) -> unduh via savetube. Mengembalikan bentuk yang sama dengan data.result API lama + buffer audio.
async function resolveLocal(query) {
  try {
    const x = await ytdl2(query, "mp3");
    if (!x?.status || !(x.file || x.download)) {
      console.error("[Play5] ytdl2:", x?.mess);
      return null;
    }
    const buffer = await readResultBuffer(x, { minBytes: 20_000, maxBytes: MAX_AUDIO_BYTES });
    return {
      title: x.title || query,
      channel: x.author,
      duration: secToClock(x.duration),
      videoId: x.videoId,
      url: x.url,
      thumbnail: x.thumbnail,
      buffer,
    };
  } catch (e) {
    console.error("[Play5] ytdl2 gagal:", e.message);
    return null;
  }
}

async function downloadAudio(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: MAX_AUDIO_BYTES,
    headers: { "User-Agent": UA },
  });
  const buffer = Buffer.from(res.data);
  if (!buffer.length) throw new Error("File audio kosong");
  return buffer;
}

async function handler(m, { sock }) {
  const query = (m.text || "").trim();

  if (!query) {
    return m.reply(
      `🎵 *ᴘʟᴀʏ ᴠ5*\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} bye ariana grande\``,
    );
  }

  if (query.length > 150) {
    return m.reply("❌ Judul terlalu panjang, maksimal 150 karakter.");
  }

  await m.react("🕕");

  try {
    // Hanya ytdl2 + savetube, tanpa API.
    const r = await resolveLocal(query);
    const data = { status: Boolean(r) };

    if (!data?.status || !r?.title) {
      await m.react("❌");
      return m.reply(`❌ Lagu *${safe(query)}* tidak ditemukan atau gagal diunduh. Coba lagi nanti.`);
    }

    const duration = formatDuration(r.duration);
    const videoUrl = r.url || (r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : "");

    // ===== Kartu info (gaya sama seperti tiktokstalk2) =====
    const ai = new AIRich(sock);
    ai.setTitle("YouTube Play");

    const entity = {
      __typename: "GenAICompactEntityPrimitive",
      title: String(r.title).slice(0, 100),
      subtitle: `${r.channel || "YouTube"} • ${duration}`,
      secondary_subtitle: "YouTube Music",
      entity_id: String(r.videoId || query),
      entity_url: videoUrl,
      entity_type: "PAGE",
      action_type: "FOLLOW",
      is_verified: false,
    };
    if (r.thumbnail) entity.image = { url: r.thumbnail, url_fallback: r.thumbnail };

    ai.addSection({
      view_model: {
        primitive: entity,
        __typename: "GenAISingleLayoutViewModel",
      },
    });

    ai.addFOAText(
      `🎵 *${safe(r.title)}*\n\n` +
        `📺 Channel: *${safe(r.channel) || "-"}*\n` +
        `⏱️ Durasi: *${duration}*\n` +
        (videoUrl ? `🔗 [Buka di YouTube](${videoUrl})\n` : "") +
        `\n_Audio sedang dikirim..._`,
    );
    if (r.thumbnail) ai.addImage(r.thumbnail, { resolveUrl: true });
    ai.addMetadata("Play v5 • By lyniX's MD");

    await ai.send(m.chat, { quoted: m, bypassDownload: true });

    // ===== Kirim audio =====
    if (!r.buffer && !r.download) {
      await m.react("❌");
      return m.reply("⚠️ API tidak memberikan link audio untuk lagu ini.");
    }

    let audio = r.buffer;
    try {
      if (!audio) audio = await downloadAudio(r.download);
    } catch (e) {
      console.error("[Play5] Download audio gagal:", e.code || e.message);
      await m.react("❌");
      const tooBig = e.code === "ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED";
      return m.reply(
        tooBig
          ? `⚠️ File audio terlalu besar (maksimal ${MAX_AUDIO_BYTES / 1024 / 1024} MB).`
          : `⚠️ Gagal mengunduh audio. Coba lagi nanti.\n\n> Link langsung: ${r.download}`,
      );
    }

    await sock.sendMessage(
      m.chat,
      {
        audio,
        mimetype: "audio/mpeg",
        fileName: fileNameFor(r.title),
      },
      { quoted: m },
    );
    await m.react("✅");
  } catch (err) {
    console.error("[Play5] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };