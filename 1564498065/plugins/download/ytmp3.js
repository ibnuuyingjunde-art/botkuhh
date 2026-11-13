const pluginConfig = {
  name: "ytmp3",
  alias: ["youtubemp3", "ytaudio"],
  category: "download",
  description: "Download audio YouTube",
  usage: ".ytmp3 <url> [320|256|192|128]",
  example: ".ytmp3 https://youtube.com/watch?v=xxx 128",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

const API_BASE = "https://api-cloud.my.id";
const API_URL = `${API_BASE}/downloader/ytmp3`;
const API_TIMEOUT = 75000;
const MAX_PENDING_RETRY = 3;
const PENDING_DELAY = 4000;
const QUALITIES = ["320", "256", "192", "128"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callApi(url, quality) {
  const q = new URLSearchParams({ url });
  if (quality) q.set("quality", quality);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const res = await fetch(`${API_URL}?${q.toString()}`, { signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.status) {
      throw new Error(data?.error || data?.message || `API HTTP ${res.status}`);
    }
    return data.result || {};
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromApi(url, quality) {
  for (let i = 0; i <= MAX_PENDING_RETRY; i++) {
    const r = await callApi(url, quality);
    if (r.pending) {
      if (i === MAX_PENDING_RETRY) throw new Error("Konversi belum selesai, coba lagi sebentar");
      await sleep(PENDING_DELAY);
      continue;
    }

    const path = r.proxyUrl || r.mp3Url;
    if (!path) throw new Error("API tidak mengembalikan link audio");

    return {
      download: /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`,
      title: r.title,
      filename: r.filename,
      quality: r.quality,
    };
  }
}

async function sendAudio(m, sock, result) {
  const fileName = result.filename || `${result.title || "audio"}.mp3`;

  await sock.sendMedia(m.chat, result.download, null, m, {
    type: "audio",
    mimetype: "audio/mpeg",
    ptt: false,
    fileName,
  });
}

async function handler(m, { sock }) {
  const input = m.text?.trim() || "";
  const url = input.match(/https?:\/\/\S+/i)?.[0];

  if (!url)
    return m.reply(`Contoh: ${m.prefix}ytmp3 https://youtube.com/watch?v=xxx\nKualitas opsional: ${QUALITIES.join(", ")} (default terbaik)`);
  if (!url.includes("youtube.com") && !url.includes("youtu.be"))
    return m.reply("URL harus YouTube");

  const quality = input.replace(url, " ").match(/\b(320|256|192|128)\b/)?.[1] || "";

  m.react("🕕");

  const t = Date.now();
  try {
    const result = await fetchFromApi(url, quality);
    await sendAudio(m, sock, result);
    console.log("[YTMP3 api] sukses", Date.now() - t, "ms", result.quality || "best");
    m.react("✅");
  } catch (err) {
    console.error("[YTMP3]", err);
    m.react("❌");
    m.reply("Gagal mengunduh audio.");
  }
}

export { pluginConfig as config, handler };