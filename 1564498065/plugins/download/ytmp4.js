import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";

const pluginConfig = {
  name: "ytmp4",
  alias: ["youtubemp4", "ytvideo"],
  category: "download",
  description: "Download video YouTube",
  usage: ".ytmp4 <url> [144|240|360|480|720|1080]",
  example: ".ytmp4 https://youtube.com/watch?v=xxx 480",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

const API_BASE = "https://api-cloud.my.id";
const API_URL = `${API_BASE}/downloader/ytmp4`;
const API_TIMEOUT = 45000;
const RESOLUTIONS = ["144", "240", "360", "480", "720", "1080"];
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

async function fetchFromApi(url, resolution) {
  const endpoint = `${API_URL}?url=${encodeURIComponent(url)}&quality=${resolution}p`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);

  try {
    const res = await fetch(endpoint, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);

    const data = await res.json();
    const r = data?.result;
    const link = r?.downloadUrl || r?.proxyUrl;
    if (!data?.status || !link) {
      throw new Error(data?.error || data?.message || "API tidak mengembalikan link download");
    }

    return {
      // downloadUrl dari API berupa path relatif (/downloader/ytmp4?...&dl=1)
      download: new URL(link, API_BASE).href,
      title: r.title,
      quality: r.quality || `${resolution}p`,
      available: (r.availableQualities || []).map((q) => q.quality),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Sumber 1: API api-cloud.my.id -> dikirim sebagai link
async function sendViaApi(m, sock, url, resolution) {
  const result = await fetchFromApi(url, resolution);
  await sock.sendMedia(
    m.chat,
    result.download,
    `🎬 *${result.title || "YouTube"}*\n📺 ${result.quality}`,
    m,
    { type: "video" },
  );
  return "api";
}

// Sumber 2 (fallback): scraper ytdl2.js -> dikirim sebagai buffer
async function sendViaScraper(m, sock, url, resolution) {
  const r = await ytdl2(url, resolution);
  if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
  const buffer = await readResultBuffer(r, { minBytes: 100_000, maxBytes: MAX_VIDEO_BYTES });
  await sock.sendMedia(
    m.chat,
    buffer,
    `🎬 *${r.title || "YouTube"}*\n📺 ${resolution}p`,
    m,
    {
      type: "video",
      mimetype: "video/mp4",
      fileName: `${r.title || "video"}.mp4`,
    },
  );
  return `ytdl2${r.source ? ` (${r.source})` : ""}`;
}

async function handler(m, { sock }) {
  const args = (m.text || "").trim().split(/\s+/).filter(Boolean);
  const url = args[0];
  if (!url)
    return m.reply(`Contoh: ${m.prefix}ytmp4 https://youtube.com/watch?v=xxx 480`);
  if (!url.includes("youtube.com") && !url.includes("youtu.be"))
    return m.reply("URL harus YouTube");

  const reso = (args[1] || "").replace(/p$/i, "");
  const resolution = RESOLUTIONS.includes(reso) ? reso : "480";

  m.react("🕕");

  const t = Date.now();
  const alasan = [];
  for (const [nama, kirim] of [
    ["API", sendViaApi],
    ["ytdl2", sendViaScraper],
  ]) {
    try {
      const sumber = await kirim(m, sock, url, resolution);
      console.log("[YTMP4]", sumber, "sukses", Date.now() - t, "ms", resolution + "p");
      m.react("✅");
      return;
    } catch (err) {
      console.error(`[YTMP4] ${nama} gagal:`, err.message);
      alasan.push(`${nama}: ${err.message}`);
    }
  }

  m.react("❌");
  m.reply(`Gagal mengunduh video.\n\n${alasan.map((a) => `• ${a}`).join("\n")}`);
}

export { pluginConfig as config, handler };