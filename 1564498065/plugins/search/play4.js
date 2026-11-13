import axios from "axios";
import { ytSearch, ytSearchVideo } from "../../src/scraper/ytsearch-safe.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { Button, Carousel } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { getAudioBuffer } from "../../src/scraper/audiofetch.js";

const pluginConfig = {
  name: "play4",
  alias: ["playcarousel", "vplay4"],
  category: "search",
  description: "Cari & putar musik dari YouTube dengan tampilan carousel (multi pilihan)",
  usage: ".play4 <query>",
  example: ".play4 komang",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const MAX_RESULTS = 5;

const DOWNLOAD_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 1;

const YOUTUBE_URL_REGEX = /(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/;

function withTimeout(promiseFactory, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    promiseFactory()
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function withRetry(fn, { retries = MAX_RETRIES, timeoutMs = DOWNLOAD_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (err) {
      lastErr = err;
      const isTimeout = err?.message === "TIMEOUT";
      if (!isTimeout || attempt === retries) throw err;
      continue;
    }
  }
  throw lastErr;
}

// Audio diambil lewat beberapa sumber (ytdl3 -> api-cloud -> mediadl -> SaveTube),
// tiap hasil di-download + divalidasi (bukan HTML, minimal 100 KB) sebelum dikirim.
async function fetchAudioWithFreshLink(youtubeUrl) {
  const r = await getAudioBuffer(youtubeUrl);
  return { scrapeResult: { title: r.title, format: r.format }, buffer: r.buffer };
}

function extractVideoId(url) {
  return String(url || "").match(YOUTUBE_URL_REGEX)?.[1] || url;
}

async function handler(m, { sock }) {
  const query = m.text?.trim();
  const prefix = m.prefix || ".";

  const isDirectUrl = YOUTUBE_URL_REGEX.test(query || "");

  if (isDirectUrl) {
    await m.react("⏳");
    try {
      const video = await ytSearchVideo(extractVideoId(query));
      if (!video?.title) throw new Error("Video tidak ditemukan.");

      let scrapeResult, audioBuffer;
      try {
        ({ scrapeResult, buffer: audioBuffer } = await fetchAudioWithFreshLink(query));
      } catch (dlErr) {
        const isTimeout = dlErr?.message === "TIMEOUT";
        await m.react("⏰");
        return m.reply(
          isTimeout
            ? "⏰ Server YouTube lagi lemot/timeout saat ambil audio. Coba lagi ya."
            : `⚠️ Gagal memproses audio.\n\n> ${dlErr.message}`
        );
      }

      await sock.sendMedia(m.chat, audioBuffer, null, m, {
        type: "audio",
        mimetype: scrapeResult.format === "m4a" ? "audio/mp4" : "audio/mpeg",
        ptt: false,
        fileName: `${scrapeResult.title || video.title || "audio"}.${scrapeResult.format === "m4a" ? "m4a" : "mp3"}`,
      });

      await m.react("✅");
    } catch (err) {
      console.error("[Play4 Download Error]", err);
      await m.react("😭");
      m.reply(`⚠️ Gagal memproses audio.\n\n> Error: ${err.message}`);
    }
    return;
  }

  if (!query) {
    return m.reply(`🎵 *PLAY CAROUSEL*\n\n> Contoh:\n\`${prefix}play4 komang\``);
  }

  await m.react("🔎");

  try {
    const search = await ytSearch(query);
    const results = search?.videos?.slice(0, MAX_RESULTS);

    if (!results || results.length === 0) {
      await m.react("❌");
      return m.reply("❌ Lagu tidak ditemukan di YouTube.");
    }

    const carousel = new Carousel(sock)
      .setBody(`🎵 Hasil pencarian: *${query}*`)
      .setFooter("Swipe untuk lihat pilihan lain • Tekan tombol untuk download audio");

    for (const video of results) {
      const title = video.title.length > 60 ? video.title.slice(0, 57) + "..." : video.title;

      const card = await new Button(sock)
        .setTitle(title)
        .setBody(`⏱️ ${video.duration.timestamp} • 🎙️ ${video.author.name}`)
        .setFooter("YouTube")
        .setImage(video.thumbnail)
        .addReply("🎧 Ambil Audio", `${prefix}play4 ${video.url}`, { icon: "DEFAULT" })
        .addUrl("▶️ Buka di YouTube", video.url, true, { icon: "REVIEW" })
        .toCard();

      carousel.addCard(card);
    }

    await carousel.send(m.chat, { quoted: m });
    await m.react("✅");
  } catch (err) {
    console.error("[Play4 Search Error]", err);
    await m.react("😭");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };