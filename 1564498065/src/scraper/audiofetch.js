import axios from "axios";
import ytdl2, { readResultBuffer } from "./ytdl2.js";
import { ytdl3 } from "./ytdl3.js";
import mediaDownloader, { fetchMediaBuffer } from "./mediadl.js";

const MIN_AUDIO_BYTES = 100_000; // mp3 lagu asli ratusan KB - MB; 18-52 kB = file rusak
const MEDIA_CT = /audio|video|octet-stream|mpeg|mp4/;

// Download link jadi buffer + validasi. Link HTML/JSON/kecil = ditolak.
export async function fetchValidatedBuffer(link, headers = {}) {
  const res = await axios.get(link, {
    responseType: "arraybuffer",
    timeout: 90_000,
    maxContentLength: 100 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0", ...headers },
  });
  const ct = String(res.headers["content-type"] || "").toLowerCase();
  const buffer = Buffer.from(res.data);
  if (!MEDIA_CT.test(ct)) {
    console.error("[AUDIO] bukan media:", ct, "|", buffer.toString("utf8", 0, 150));
    throw new Error(`bukan file audio (${ct || "unknown"})`);
  }
  if (buffer.length < MIN_AUDIO_BYTES) throw new Error(`file terlalu kecil (${buffer.length} byte)`);
  return buffer;
}

async function viaYtdl3(url) {
  const r = await ytdl3(url, "mp3");
  if (!r?.status || !r?.download) throw new Error(r?.error || "ytdl3 gagal");
  return { title: r.title, format: "mp3", buffer: await fetchValidatedBuffer(r.download) };
}

async function viaMediadl(url) {
  const r = await mediaDownloader(url);
  const dl = r.downloads?.find((d) => d.type === "audio");
  if (!dl) throw new Error("mediadl: tidak ada link audio");
  const buffer = await fetchMediaBuffer(dl.url);
  if (buffer.length < MIN_AUDIO_BYTES) throw new Error("mediadl: file terlalu kecil");
  return { title: r.title, format: "mp3", buffer };
}

async function viaYtdl2(url) {
  const r = await ytdl2(url, "mp3");
  if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
  // yt-dlp lokal -> file di disk; sumber cadangan -> link web yang divalidasi dulu
  const buffer = r.file
    ? await readResultBuffer(r, { minBytes: MIN_AUDIO_BYTES })
    : await fetchValidatedBuffer(r.download, r.headers || {});
  return { title: r.title, format: "mp3", buffer };
}

// ytdl2 (scraper ytmp3.js) paling depan, sisanya jadi cadangan.
const PROVIDERS = [
  ["ytdl2", viaYtdl2],
  ["ytdl3", viaYtdl3],
  ["mediadl", viaMediadl],
];

// opts.skip: daftar nama provider yang dilewati, mis. { skip: ["ytdl2"] }
export async function getAudioBuffer(url, { skip = [] } = {}) {
  const errors = [];
  for (const [name, run] of PROVIDERS) {
    if (skip.includes(name)) continue;
    try {
      const r = await run(url);
      console.log(`[AUDIO] sukses via ${name} (${r.buffer.length} byte)`);
      return r;
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.error(`[AUDIO] ${name} gagal:`, err.message);
    }
  }
  throw new Error("Semua sumber gagal. " + errors.join(" | "));
}