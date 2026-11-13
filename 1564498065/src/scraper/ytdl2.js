import axios from "axios";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import { ytdlLegacy, extractVideoId } from "./ytdl2-legacy.js";
import { getMp3 } from "./ytmp3.js";
import { viaInvidious, viaY2mate } from "./ytscrape.js";
import { probeMedia } from "./probe.js";
import { serveFile } from "./ytdl2-serve.js";

/**
 * ytdl2 - downloader YouTube langsung ke youtube.com lewat yt-dlp + cookies.
 * Gabungan handler REST ytmp3 (MP3) dan ytmp4 (MP4).
 * Input boleh link, ID 11 karakter, ATAU judul / kata kunci (dicari dulu lewat ytsearch-safe.js,
 * hasil pertama yang bukan live dipakai). Kalau pemanggil sudah punya link (mis. plugin yang
 * menampilkan kartu info dulu), kirim link-nya saja supaya tidak mencari dua kali.
 *
 * Urutan sumber: yt-dlp lokal  ->  (kalau gagal) ytdl2-legacy (ytmp3pc -> nevercap -> savetube)
 *
 * Hasil yt-dlp berupa FILE LOKAL, jadi result berisi `file` (path), bukan link:
 *   { status, source, title, author, videoId, url, thumbnail, duration(detik), format, requested,
 *     quality, size, cached, file, download }
 *   - `download` hanya terisi kalau opts.wantUrl = true (lewat media server, lihat ytdl2-serve.js)
 *     atau kalau hasilnya datang dari sumber cadangan (link web + headers).
 *   - Pakai readResultBuffer(result) untuk mengambil buffer, apa pun sumbernya.
 *
 * Env (semua opsional):
 *   YTDLP_BIN, YTDLP_COOKIES, YTDLP_AUTO_INSTALL=0 (matikan unduh otomatis binary), FFMPEG_PATH,
 *   YT_MAX_SECONDS (audio, default 1800), YT_MAX_SECONDS_VIDEO (default 1200),
 *   YT_MAX_FILESIZE (video, default 100M), YT_CONCURRENCY (default 2), YT_CACHE_MIN (default 35)
 *
 * Cookies (format Netscape, ekspor dari Firefox), dicari berurutan di:
 *   $YTDLP_COOKIES, database/youtube-cookies.txt, config/youtube-cookies.txt, youtube-cookies.txt
 */

const ROOT = process.cwd();
const IS_WIN = process.platform === "win32";
const LOCAL_BIN = path.join(ROOT, "bin", IS_WIN ? "yt-dlp.exe" : "yt-dlp");
const CACHE_DIR = path.join(ROOT, "temp", "ytdl2-cache");
const CACHE_TTL = (Number(process.env.YT_CACHE_MIN) || 35) * 60 * 1000;
const MAX_SECONDS_AUDIO = Number(process.env.YT_MAX_SECONDS) || 1800;
const MAX_SECONDS_VIDEO = Number(process.env.YT_MAX_SECONDS_VIDEO) || 1200;
const MAX_FILESIZE = process.env.YT_MAX_FILESIZE || "100M";
const MAX_ACTIVE = Number(process.env.YT_CONCURRENCY) || 2;
const WAIT_AUDIO_MS = 90_000; // tunggu hasil di pemanggil; job tetap jalan di background
const WAIT_VIDEO_MS = 150_000;
const JOB_MS = 5 * 60 * 1000; // batas total satu job yt-dlp
const VALID_FORMATS = ["mp3", "mp4", "144", "240", "360", "480", "720", "1080"];
const AUDIO_KBPS = ["128", "192", "256", "320"];
const BIN_RETRY_MS = 10 * 60 * 1000;
const UPDATE_EVERY_MS = 12 * 60 * 60 * 1000;

const G = (globalThis.__ytdl2 ||= { active: 0, jobs: new Map(), bin: null, binFailAt: 0, installing: null, updatedAt: 0, ffmpeg: undefined });

class YtError extends Error {
  constructor(message, status = 500, final = false) {
    super(message);
    this.status = status;
    this.final = final; // true = sumber cadangan pasti percuma (video terlalu panjang / live)
  }
}

// ---------------------------------------------------------------------------
// Proses yt-dlp
// ---------------------------------------------------------------------------
function run(bin, args, ms) {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let killed = false;
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const t = setTimeout(() => {
      killed = true;
      p.kill("SIGKILL");
    }, ms);
    p.stdout.on("data", (d) => {
      if (out.length < 8e6) out += d;
    });
    p.stderr.on("data", (d) => {
      if (err.length < 2e5) err += d;
    });
    p.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: -1, out, err: String(e.message), killed, missing: e.code === "ENOENT" });
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, out, err, killed });
    });
  });
}

async function probeBin(bin) {
  const r = await run(bin, ["--version"], 20_000);
  return r.code === 0 && r.out.trim() ? r.out.trim() : null;
}

function assetName() {
  if (IS_WIN) return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

// Unduh binary standalone yt-dlp (tanpa Python) ke ./bin/yt-dlp
async function installBin() {
  fs.mkdirSync(path.dirname(LOCAL_BIN), { recursive: true });
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName()}`;
  console.log(`[ytdl2] yt-dlp belum ada, mengunduh ${assetName()} ...`);
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 180_000, maxRedirects: 8 });
  const buf = Buffer.from(res.data);
  if (buf.length < 1_000_000) throw new Error(`unduhan yt-dlp tidak valid (${buf.length} byte)`);
  const tmp = `${LOCAL_BIN}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, LOCAL_BIN);
}

async function getBin() {
  if (G.bin) return G.bin;
  if (G.binFailAt && Date.now() - G.binFailAt < BIN_RETRY_MS) return null;

  const candidates = [process.env.YTDLP_BIN, LOCAL_BIN, "yt-dlp"].filter(Boolean);
  for (const c of candidates) {
    if (c !== "yt-dlp" && !fs.existsSync(c)) continue;
    if (await probeBin(c)) {
      G.bin = c;
      return c;
    }
  }

  if (process.env.YTDLP_AUTO_INSTALL !== "0") {
    try {
      G.installing ||= installBin().finally(() => {
        G.installing = null;
      });
      await G.installing;
      if (await probeBin(LOCAL_BIN)) {
        G.bin = LOCAL_BIN;
        return LOCAL_BIN;
      }
    } catch (e) {
      console.error(`[ytdl2] gagal memasang yt-dlp otomatis: ${e.message}`);
    }
  }
  G.binFailAt = Date.now();
  return null;
}

// YouTube sering berubah: binary yang kita pasang sendiri di-update di background tiap 12 jam.
function maybeSelfUpdate(bin) {
  if (bin !== LOCAL_BIN || Date.now() - G.updatedAt < UPDATE_EVERY_MS) return;
  G.updatedAt = Date.now();
  run(bin, ["-U"], 90_000).then((r) => {
    if (r.code === 0) console.log(`[ytdl2] cek update yt-dlp: ${r.out.trim().split("\n").pop()}`);
  });
}

function ffmpegLocation() {
  if (G.ffmpeg !== undefined) return G.ffmpeg;
  let loc = process.env.FFMPEG_PATH || null;
  if (!loc) {
    try {
      const p = createRequire(import.meta.url)("@ffmpeg-installer/ffmpeg").path;
      if (p && fs.existsSync(p)) loc = p;
    } catch {
      /* pakai ffmpeg di PATH */
    }
  }
  G.ffmpeg = loc;
  return loc;
}

function cookiePath() {
  const list = [
    process.env.YTDLP_COOKIES,
    path.join(ROOT, "database", "youtube-cookies.txt"),
    path.join(ROOT, "config", "youtube-cookies.txt"),
    path.join(ROOT, "youtube-cookies.txt"),
  ].filter(Boolean);
  return list.find((p) => fs.existsSync(p)) || null;
}

// Salin cookies ke file sementara: yt-dlp menulis ulang file cookies di akhir proses,
// jadi job paralel tidak boleh berbagi satu file.
function prepareCookies() {
  const src = cookiePath();
  if (!src) return null;
  const tmp = path.join(os.tmpdir(), `ytc-${crypto.randomBytes(6).toString("hex")}.txt`);
  fs.copyFileSync(src, tmp);
  fs.chmodSync(tmp, 0o600);
  return tmp;
}

function baseArgs(cookieFile) {
  const a = [
    "--no-playlist",
    "--no-warnings",
    "--socket-timeout",
    "15",
    "--retries",
    "2",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
  ];
  const ff = ffmpegLocation();
  if (ff) a.push("--ffmpeg-location", ff);
  if (cookieFile) a.push("--cookies", cookieFile);
  return a;
}

// Utamakan H.264 (avc1) + AAC supaya MP4 bisa diputar di HP/WhatsApp; turun ke format lain kalau tidak ada.
function videoSelector(h) {
  return [
    `bv*[height<=${h}][vcodec^=avc1]+ba[ext=m4a]`,
    `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]`,
    `b[height<=${h}][ext=mp4]`,
    `bv*[height<=${h}]+ba`,
    `b[height<=${h}]`,
  ].join("/");
}

function explain(r) {
  if (r.missing) return new YtError("yt-dlp tidak bisa dijalankan di server", 500);
  if (r.killed) return new YtError("YouTube tidak merespons tepat waktu, coba lagi", 408);
  const e = r.err || "";
  if (/Sign in to confirm|confirm you.re not a bot|cookies.*(no longer valid|expired)|Please sign in/i.test(e)) {
    return new YtError("YouTube meminta login: cookies kedaluwarsa/diblokir atau belum dipasang. Ekspor ulang cookies dari Firefox ke database/youtube-cookies.txt", 503);
  }
  if (/Requested format is not available/i.test(e)) return new YtError("Resolusi ini tidak tersedia untuk video tersebut, coba kualitas lain", 400);
  if (/Private video|Video unavailable|has been removed|not available|members-only|age.restricted|copyright/i.test(e)) {
    return new YtError("Video tidak tersedia (privat/dihapus/dibatasi region atau umur)", 400);
  }
  if (/is_live|live event|Premieres in/i.test(e)) return new YtError("Live/premiere belum bisa diunduh", 400, true);
  if (/HTTP Error 429|Too Many Requests/i.test(e)) return new YtError("YouTube membatasi request (429), coba beberapa saat lagi", 429);
  return new YtError("yt-dlp gagal: " + e.trim().split("\n").slice(-1)[0].slice(0, 200), 500);
}

// ---------------------------------------------------------------------------
// Cache + job (dedupe: request yang sama menempel ke job yang sedang jalan)
// ---------------------------------------------------------------------------
function sweepCache() {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(CACHE_DIR)) {
      const full = path.join(CACHE_DIR, f);
      if (now - fs.statSync(full).mtimeMs > CACHE_TTL) fs.unlinkSync(full);
    }
  } catch {
    /* folder belum ada */
  }
}

function parseMeta(out) {
  for (const line of String(out || "").split("\n").reverse()) {
    const s = line.trim();
    if (s.startsWith("{")) {
      try {
        return JSON.parse(s);
      } catch {
        /* lanjut */
      }
    }
  }
  return null;
}

function slimMeta(j) {
  if (!j) return {};
  return {
    title: j.title || null,
    author: j.artist || j.uploader || j.channel || null,
    duration: Math.round(j.duration || 0) || null,
    thumbnail: j.thumbnail || null,
    height: Number(j.height) || null,
  };
}

function isFresh(file) {
  try {
    return Date.now() - fs.statSync(file).mtimeMs < CACHE_TTL;
  } catch {
    return false;
  }
}

function readMeta(metaFile) {
  try {
    return JSON.parse(fs.readFileSync(metaFile, "utf8"));
  } catch {
    return null;
  }
}

function startJob(bin, videoId, kind, quality) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tag = kind === "mp3" ? `${quality}k` : `${quality}p`;
  const key = `${videoId}:${kind}:${tag}`;
  const base = path.join(CACHE_DIR, `${videoId}-${tag}`);
  const file = `${base}.${kind}`;
  const metaFile = `${base}.json`;

  const old = G.jobs.get(key);
  if (old && !old.done) return old;
  if (isFresh(file)) {
    return { key, file, done: true, error: null, cached: true, meta: readMeta(metaFile), promise: Promise.resolve() };
  }
  if (G.active >= MAX_ACTIVE) throw new YtError("Server sedang sibuk mengonversi, coba lagi sebentar", 429);

  const job = { key, file, done: false, error: null, cached: false, meta: null };
  G.active++;
  job.promise = (async () => {
    const cookieFile = prepareCookies();
    try {
      const maxSec = kind === "mp3" ? MAX_SECONDS_AUDIO : MAX_SECONDS_VIDEO;
      const args = [...baseArgs(cookieFile), "-j", "--no-simulate", "--match-filter", `duration<=${maxSec} & !is_live`];
      if (kind === "mp3") {
        args.push("-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", `${quality}K`);
      } else {
        args.push("-f", videoSelector(quality), "--merge-output-format", "mp4", "--max-filesize", MAX_FILESIZE);
      }
      args.push("--no-part", "-o", `${base}.%(ext)s`, `https://www.youtube.com/watch?v=${videoId}`);

      const r = await run(bin, args, JOB_MS);
      if (r.code !== 0) throw explain(r);
      if (!fs.existsSync(file)) {
        const why =
          kind === "mp3"
            ? `lebih dari ${Math.round(maxSec / 60)} menit atau sedang live`
            : `lebih dari ${Math.round(maxSec / 60)} menit, lebih besar dari ${MAX_FILESIZE}, atau sedang live`;
        throw new YtError(`Video dilewati: ${why}`, 400, true);
      }
      job.meta = slimMeta(parseMeta(r.out));
      try {
        fs.writeFileSync(metaFile, JSON.stringify(job.meta));
      } catch {
        /* meta hanya pelengkap */
      }
    } catch (e) {
      job.error = e instanceof YtError ? e : new YtError(e?.message || String(e));
    } finally {
      if (cookieFile) fs.unlink(cookieFile, () => {});
      G.active--;
      job.done = true;
    }
  })();
  G.jobs.set(key, job);
  if (G.jobs.size > 50) G.jobs.delete(G.jobs.keys().next().value);
  return job;
}

async function waitJob(job, waitMs, signal) {
  let timer;
  let onAbort;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new YtError("Konversi masih berjalan di background, coba lagi sebentar", 408)), waitMs);
  });
  const aborted = new Promise((_, rej) => {
    if (!signal) return;
    if (signal.aborted) return rej(new YtError("Dibatalkan", 408));
    onAbort = () => rej(new YtError("Dibatalkan", 408));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    await Promise.race([job.promise, timeout, aborted]);
  } finally {
    clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
  if (job.error) {
    G.jobs.delete(job.key);
    throw job.error;
  }
}

// ---------------------------------------------------------------------------
// Sumber utama: yt-dlp
// ---------------------------------------------------------------------------
async function viaYtdlp(videoId, format, opts) {
  const bin = await getBin();
  if (!bin) throw new YtError("yt-dlp tidak tersedia di server (pasang manual atau izinkan unduh dari github.com)", 500);
  maybeSelfUpdate(bin);
  sweepCache();

  const isAudio = format === "mp3";
  const kbps = String(opts?.quality ?? "128").replace(/\D/g, "");
  const quality = isAudio ? (AUDIO_KBPS.includes(kbps) ? kbps : "128") : /^\d+$/.test(format) ? format : "720";

  const job = startJob(bin, videoId, isAudio ? "mp3" : "mp4", quality);
  await waitJob(job, Number(opts?.waitMs) || (isAudio ? WAIT_AUDIO_MS : WAIT_VIDEO_MS), opts?.signal);

  const meta = job.meta || {};
  const size = fs.statSync(job.file).size;
  const result = {
    status: true,
    source: "yt-dlp",
    title: meta.title || null,
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    author: meta.author || undefined,
    thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: meta.duration || undefined,
    cached: job.cached,
    format: isAudio ? "mp3" : "mp4",
    requested: format,
    quality: isAudio ? `${quality} kbps` : `${meta.height || quality}p`,
    size,
    file: job.file,
    download: null,
    headers: undefined,
  };

  if (opts?.wantUrl) {
    const link = await serveFile(job.file, isAudio ? "audio/mpeg" : "video/mp4").catch(() => null);
    if (!link) throw new YtError("Media server belum dikonfigurasi (config.mediaServer), link publik tidak bisa dibuat", 500);
    result.download = link;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pencarian judul (kalau input bukan link / ID)
// ---------------------------------------------------------------------------
const YT_SEARCH_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function ytScanJson(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const ytRuns = (o) => (o?.runs || []).map((r) => r.text).join("");

function ytWalk(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const v of node) ytWalk(v, out); return; }
  const v = node.videoRenderer;
  if (v?.videoId) {
    out.push({
      id: v.videoId,
      title: ytRuns(v.title) || null,
      length: v.lengthText?.simpleText || null,
      channel: ytRuns(v.ownerText) || null,
      thumb: v.thumbnail?.thumbnails?.at?.(-1)?.url || null,
    });
  }
  for (const val of Object.values(node)) ytWalk(val, out);
}

// "3:04" / "1:02:03" -> detik (0 kalau LIVE / kosong)
function ytLenToSec(str) {
  if (!str || typeof str !== "string") return 0;
  const p = str.split(":").map((n) => parseInt(n, 10));
  if (p.some(Number.isNaN)) return 0;
  return p.reduce((a, n) => a * 60 + n, 0);
}

// Pencarian utama: scrape langsung halaman hasil YouTube (ytInitialData).
async function searchFirstYt(query) {
  const res = await axios.get("https://www.youtube.com/results", {
    params: { search_query: query, hl: "en", gl: "US" },
    headers: { "User-Agent": YT_SEARCH_UA, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html,application/xhtml+xml" },
    timeout: 23000,
    responseType: "text",
    transformResponse: [(d) => d],
    validateStatus: () => true,
  });
  if (res.status !== 200) throw new Error("halaman search HTTP " + res.status);
  const text = String(res.data || "");
  const at = text.indexOf("var ytInitialData");
  const brace = at < 0 ? -1 : text.indexOf("{", at);
  if (brace < 0) throw new Error("ytInitialData tidak ditemukan");
  const raw = ytScanJson(text, brace);
  if (!raw) throw new Error("ytInitialData tidak lengkap");
  const results = [];
  ytWalk(JSON.parse(raw), results);
  const v = results.find((x) => ytLenToSec(x.length) > 0);
  if (!v) return null;
  return {
    videoId: v.id,
    title: v.title,
    author: v.channel || undefined,
    duration: ytLenToSec(v.length) || undefined,
    thumbnail: v.thumb || undefined,
  };
}

async function searchFirst(query) {
  try {
    return await searchFirstYt(query);
  } catch (e) {
    console.error(`[ytdl2] pencarian utama gagal (${e.message}), pakai ytsearch-safe`);
    return await searchFirstSafe(query);
  }
}

async function searchFirstSafe(query) {
  const { ytSearch } = await import("./ytsearch-safe.js");
  const { videos } = await ytSearch(query);
  const v = (videos || []).find((x) => x.duration?.seconds > 0) || null;
  if (!v) return null;
  return {
    videoId: v.videoId,
    title: v.title,
    author: v.author?.name || undefined,
    duration: v.duration?.seconds || undefined,
    thumbnail: v.thumbnail || undefined,
  };
}

// ---------------------------------------------------------------------------
// Sumber utama: ytscrape.js (y2mate.gs + invidious) -> tanpa yt-dlp / ffmpeg
// ---------------------------------------------------------------------------
function withTimeout(p, ms, label) {
  let t;
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

async function viaYtscrape(videoId, format) {
  const isAudio = format === "mp3";
  const wantH = isAudio ? 0 : Number(format) || 720; // mp4 = 720
  // mp3 hanya dari y2mate (invidious cuma m4a/opus mentah); video: invidious (muxed) dulu, lalu y2mate
  const order = isAudio ? ["y2mate"] : ["invidious", "y2mate"];
  const errors = [];

  for (const provider of order) {
    try {
      let link, title, author, duration, quality;
      if (provider === "invidious") {
        const info = await withTimeout(viaInvidious(videoId), 60000, "invidious");
        const muxed = (info.muxed || []).filter((f) => f.url);
        if (!muxed.length) throw new Error("tidak ada stream muxed (hanya video-only)");
        const fit = muxed.filter((f) => (f.height || 0) <= wantH).sort((a, b) => (b.height || 0) - (a.height || 0));
        const pick = fit[0] || [...muxed].sort((a, b) => (a.height || 0) - (b.height || 0))[0];
        link = pick.url;
        quality = pick.quality || (pick.height ? `${pick.height}p` : undefined);
        title = info.title;
        author = info.author;
        duration = Number(info.lengthSeconds) || undefined;
      } else {
        const y = await withTimeout(viaY2mate(videoId, isAudio ? "mp3" : "mp4"), 90000, "y2mate");
        link = y.downloadUrl;
        title = y.title;
        quality = isAudio ? "mp3" : "mp4";
      }
      if (!link) throw new Error("link kosong");

      const probe = await probeMedia(link, isAudio ? "audio" : "video", { timeout: 12000 });
      if (!probe.ok) throw new Error(`link bukan file media (${probe.reason})`);

      return {
        status: true,
        source: provider,
        title: title || undefined,
        author: author || undefined,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration,
        format: isAudio ? "mp3" : "mp4",
        requested: format,
        quality,
        size: probe.size || undefined,
        file: undefined,
        download: link,
        headers: undefined,
      };
    } catch (e) {
      errors.push(`${provider}: ${e.message}`);
      console.error(`[ytscrape] ${provider} gagal: ${e.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

// Lengkapi hasil dengan data dari pencarian kalau yt-dlp / sumber cadangan tidak memberikannya.
function mergeSearch(res, found, query) {
  if (!res?.status || !found) return res;
  return {
    ...res,
    query,
    title: res.title || found.title,
    author: res.author || found.author,
    duration: res.duration || found.duration,
    thumbnail: res.thumbnail && !/i\.ytimg\.com\/vi\//.test(res.thumbnail) ? res.thumbnail : found.thumbnail || res.thumbnail,
  };
}

// ---------------------------------------------------------------------------
// Fungsi utama
// ---------------------------------------------------------------------------
/**
 * @param {string} input   link YouTube, ID 11 karakter, atau judul / kata kunci
 * @param {string} format  mp3 | mp4 | 144 | 240 | 360 | 480 | 720 | 1080   (mp4 = 720)
 * @param {{signal?: AbortSignal, quality?: string|number, source?: string, wantUrl?: boolean, waitMs?: number}} opts
 *   quality : bitrate mp3 (128/192/256/320), default 128
 *   source  : paksa satu sumber (yt-dlp | ytmp3pc | nevercap | savetube), untuk debugging
 *   wantUrl : minta link publik (lewat media server) alih-alih cuma path file
 *   waitMs  : berapa lama pemanggil menunggu; job tetap lanjut di background kalau terlewat
 */
async function ytdl2(input, format = "mp3", opts = {}) {
  try {
    const raw = String(input || "").trim();
    let videoId = extractVideoId(raw);
    let found = null;
    if (!videoId) {
      if (!raw || /^https?:\/\//i.test(raw)) {
        return { status: false, mess: "Format URL tidak dikenali atau bukan link YouTube yang valid" };
      }
      if (raw.length > 200) return { status: false, mess: "Judul terlalu panjang (maksimal 200 karakter)" };
      try {
        found = await searchFirst(raw);
      } catch (e) {
        return { status: false, mess: `Pencarian YouTube gagal: ${e.message}` };
      }
      if (!found) return { status: false, mess: `Video untuk "${raw}" tidak ditemukan` };
      videoId = found.videoId;
    }

    format = String(format || "mp3").trim().toLowerCase().replace(/p$/, "") || "mp3";
    if (!VALID_FORMATS.includes(format)) {
      return { status: false, mess: `Format tidak dikenali. Pilihan: ${VALID_FORMATS.join(", ")}` };
    }

    const only = String(opts?.source || process.env.YTDL2_SOURCE || "").trim().toLowerCase();
    const forceYtdlp = only === "yt-dlp" || only === "ytdlp";

    // Tanpa yt-dlp / ffmpeg / ytmp3pc / nevercap: ytscrape (y2mate + invidious); khusus mp3 cadangannya ytmp3.js.
    if (!only) {
      const errs = [];
      try {
        return mergeSearch(await viaYtscrape(videoId, format), found, raw);
      } catch (e) {
        errs.push(`ytscrape: ${e.message}`);
      }
      if (format === "mp3") {
        try {
          return mergeSearch(await getMp3(videoId, { quality: opts?.quality, signal: opts?.signal }), found, raw);
        } catch (e) {
          errs.push(`ytmp3: ${e.message}`);
        }
      }
      return { status: false, mess: errs.join(" | ") };
    }
    const errors = [];

    if (forceYtdlp) { // yt-dlp hanya jalan kalau dipaksa lewat { source: "yt-dlp" }
      try {
        return mergeSearch(await viaYtdlp(videoId, format, opts), found, raw);
      } catch (e) {
        errors.push(`yt-dlp: ${e.message}`);
        console.error(`[ytdl2] yt-dlp gagal: ${e.message}`);
        if (e.final || forceYtdlp || opts?.signal?.aborted) return { status: false, mess: errors.join(" | ") };
      }
    }

    const legacy = await ytdlLegacy(`https://www.youtube.com/watch?v=${videoId}`, format, {
      ...opts,
      source: only && !forceYtdlp ? only : undefined,
    });
    if (legacy?.status) return mergeSearch(legacy, found, raw);
    return { status: false, mess: [...errors, legacy?.mess].filter(Boolean).join(" | ") };
  } catch (err) {
    return { status: false, mess: err.message };
  }
}

/**
 * Ambil buffer dari hasil ytdl2 (file lokal dari yt-dlp, atau link dari sumber cadangan).
 * @param {object} r        hasil ytdl2 (status true)
 * @param {{minBytes?: number, maxBytes?: number, timeout?: number}} o
 */
async function readResultBuffer(r, { minBytes = 0, maxBytes = 100 * 1024 * 1024, timeout = 90_000 } = {}) {
  let buf;
  if (r?.file) {
    const st = await fs.promises.stat(r.file);
    if (st.size > maxBytes) throw new Error(`file terlalu besar (${(st.size / 1048576).toFixed(1)} MB)`);
    buf = await fs.promises.readFile(r.file);
  } else if (r?.download) {
    const res = await axios.get(r.download, {
      responseType: "arraybuffer",
      timeout,
      maxContentLength: maxBytes,
      headers: { "User-Agent": "Mozilla/5.0", ...(r.headers || {}) },
    });
    const ct = String(res.headers["content-type"] || "").toLowerCase();
    if (/text\/|json|html/.test(ct)) throw new Error(`bukan file media (${ct})`);
    buf = Buffer.from(res.data);
  } else {
    throw new Error("hasil ytdl2 tidak punya file maupun link");
  }
  if (buf.length < minBytes) throw new Error(`file terlalu kecil (${buf.length} byte)`);
  return buf;
}

export { ytdl2, extractVideoId, readResultBuffer };
export default ytdl2;
