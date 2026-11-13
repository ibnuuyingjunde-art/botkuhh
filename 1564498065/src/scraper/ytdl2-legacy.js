import axios from "axios";
import crypto from "crypto";
import { probeMedia } from "./probe.js";

/**
 * ytdl2-legacy - sumber cadangan berbasis situs pihak ketiga (ytmp3pc -> nevercap [video] -> savetube).
 * Dipakai ytdl2.js HANYA kalau yt-dlp lokal gagal / tidak tersedia.
 * Hanya menerima link / ID video, TIDAK menerima kata kunci.
 *
 * Tiap sumber mengembalikan { status, download, headers?, ... } atau melempar DlError.
 * Sebelum dipakai, link divalidasi dengan probeMedia() supaya halaman HTML
 * (kasus SaveTube) tidak lolos sebagai "file media".
 */

const ID_RE = /(?:[?&]v=|youtu\.be\/|shorts\/|embed\/|live\/|\/v\/)([A-Za-z0-9_-]{11})/;
const VALID_FORMATS = ["mp3", "mp4", "144", "240", "360", "480", "720", "1080"];
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36";
const WAIT_MS = 25000; // total waktu semua sumber
const REQ_MS = 8000; // timeout per request
const PROBE_MS = 8000; // timeout validasi link
const PC_SITE = "https://ytmp3pc.com";
const PC_INFO = "/hP2pPvYldCo";
const PC_CONV_ORIGIN = "https://nodex2.ytzyar.cc";
const PC_MUSIC = "https://ytzyar.cc";
const PC_BUCKET = "https://bucketx2.ytzyar.cc";
const PC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const AES_KEY_HEX = "C5D58EF67A7584E4A29F6C35BBC4EB12";

class DlError extends Error {
  constructor(message, status = 500, debug) {
    super(message);
    this.status = status;
    this.debug = debug;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractVideoId(input) {
  const s = String(input || "").trim();
  const m = s.match(ID_RE);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

function normalizeFormat(f) {
  const s = String(f || "mp3").trim().toLowerCase().replace(/p$/, "");
  return s || "mp3";
}

// ---------------------------------------------------------------------------
// Sumber 1: ytmp3pc
// ---------------------------------------------------------------------------
function pcToken(videoId) {
  const a = String(videoId).toLowerCase();
  let d = 0;
  for (let o = 0; o < a.length; o++) {
    d += a.charCodeAt(o);
    d += d << 10;
    d ^= d >>> 6;
  }
  d += d << 3;
  d ^= d >>> 11;
  d += d << 15;
  return d >>> 0;
}

const pcHeaders = (extra) => ({ Referer: `${PC_CONV_ORIGIN}/`, Origin: PC_CONV_ORIGIN, ...(extra || {}) });

async function pcJson(url, deadline, trace, step, opts, signal) {
  const left = deadline - Date.now();
  if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408, { step, trace });
  try {
    const r = await axios({
      url,
      method: opts?.method || "GET",
      data: opts?.body,
      headers: { "User-Agent": PC_UA, ...(opts?.headers || {}) },
      timeout: Math.min(REQ_MS, left),
      validateStatus: () => true,
      maxRedirects: 5,
      signal,
    });
    trace.push({ step, status: r.status });
    let j = r.data;
    if (typeof j === "string") {
      try {
        j = JSON.parse(j);
      } catch {
        j = null;
      }
    }
    return {
      status: r.status,
      json: j && typeof j === "object" ? j : null,
      raw: typeof r.data === "string" ? r.data.slice(0, 160) : "",
    };
  } catch (e) {
    trace.push({ step, status: null, code: e.code, message: e.message });
    throw new DlError(
      e.code === "ECONNABORTED" ? "ytmp3pc tidak merespons" : "Gagal menghubungi ytmp3pc",
      e.code === "ECONNABORTED" ? 408 : 500,
      { step, trace }
    );
  }
}

async function ytdlYtmp3pc(videoId, format, quality, deadline, signal) {
  const trace = [];
  const kind = format === "mp3" ? "mp3" : "mp4";
  const tok = pcToken(videoId);

  const infoP = pcJson(
    `${PC_SITE}${PC_INFO}?v=${encodeURIComponent(videoId)}`,
    deadline,
    [],
    "info",
    { headers: { Referer: `${PC_SITE}/` } },
    signal
  )
    .then((r) => r.json)
    .catch(() => null);

  const availUrl =
    kind === "mp4"
      ? `${PC_BUCKET}/video/available-video?v=${encodeURIComponent(videoId)}&token=${tok}`
      : `${PC_MUSIC}/music/available-music?v=${encodeURIComponent(videoId)}&token=${tok}`;
  const av = await pcJson(
    availUrl,
    deadline,
    trace,
    "available",
    { headers: pcHeaders({ "Content-Type": "application/json" }) },
    signal
  );
  if (!av.json || !av.json.success) {
    const msg = av.json?.message || av.raw;
    if (av.status === 404 || /Invalid JSON/i.test(msg || "")) {
      throw new DlError("ytmp3pc: video tidak didukung converter (restricted / region-block)", 500, {
        step: "available",
        trace,
        msg,
      });
    }
    throw new DlError(`ytmp3pc: daftar kualitas gagal (HTTP ${av.status})`, 500, { step: "available", trace, msg });
  }
  const list = (av.json.data?.detail || []).filter((d) => d && d.quality != null);
  if (!list.length) throw new DlError(`ytmp3pc: tidak ada kualitas ${kind} untuk video ini`, 500, { step: "available", trace });

  let pick;
  if (kind === "mp3") {
    const want = String(quality || "128");
    pick = list.find((d) => String(d.quality) === want) || list.find((d) => String(d.quality) === "128") || list[0];
  } else {
    const want = /^\d+$/.test(format) ? Number(format) : 720;
    pick = list
      .slice()
      .sort((a, b) => Math.abs(Number(a.quality) - want) - Math.abs(Number(b.quality) - want) || Number(b.quality) - Number(a.quality))[0];
  }
  const qStr = String(pick.quality);

  const base = kind === "mp4" ? "/video" : "/music";
  const pp = await pcJson(
    `${PC_BUCKET}${base}/pre-progress`,
    deadline,
    trace,
    "pre-progress",
    {
      method: "POST",
      headers: pcHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ video_id: videoId, quality: qStr, sig: String(tok) }),
    },
    signal
  );
  if (!pp.json) throw new DlError(`ytmp3pc: pre-progress gagal (HTTP ${pp.status})`, 500, { step: "pre-progress", trace, body: pp.raw });

  let dl = pp.json.download_url;
  const jobId = pp.json.data?.job_id;
  if (!dl && jobId) {
    while (Date.now() < deadline - 1500) {
      const pg = await pcJson(
        `${PC_BUCKET}${base}/progress?job_id=${encodeURIComponent(jobId)}&token=${tok}`,
        deadline,
        trace,
        "progress",
        { headers: pcHeaders() },
        signal
      );
      const j = pg.json;
      if (!j) throw new DlError(`ytmp3pc: progress gagal (HTTP ${pg.status})`, 500, { step: "progress", trace, body: pg.raw });
      if (j.download_url) {
        dl = j.download_url;
        break;
      }
      if (j.success === false || j.status === "error" || j.status === "failed" || j.data?.status === "failed") {
        throw new DlError("ytmp3pc: konversi gagal di server (" + (j.message || "job failed") + ")", 500, { step: "progress", trace, j });
      }
      await sleep(1000);
    }
    if (!dl) throw new DlError("Konversi belum selesai, coba lagi sebentar", 408, { step: "progress", trace });
  }
  if (!dl) throw new DlError("ytmp3pc: download_url tidak ditemukan", 500, { step: "pre-progress", trace, pp: pp.json });

  const info = await infoP;
  const dec = (v) =>
    String(v == null ? "" : v)
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  return {
    status: true,
    source: "ytmp3pc",
    title: (info?.title && dec(info.title)) || null,
    videoId,
    author: (info?.author && dec(info.author)) || undefined,
    thumbnail: info?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: info?.duration || undefined,
    quality: kind === "mp3" ? `${qStr} kbps` : pick.quality_label || `${qStr}p`,
    size: pick.size || undefined,
    cached: !!pp.json.cached,
    download: dl,
    headers: pcHeaders(),
  };
}

// ---------------------------------------------------------------------------
// Sumber 2 (khusus video): nevercap.ai
// ---------------------------------------------------------------------------
async function ytdlNevercap(videoId, deadline, signal) {
  const trace = [];
  const headers = { "content-type": "application/json", "user-agent": "Mozilla/5.0" };
  const post = async (step, url, body) => {
    const left = deadline - Date.now();
    if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408, { step, trace });
    try {
      const r = await axios.post(url, body, { headers, timeout: Math.min(REQ_MS, left), signal });
      trace.push({ step, status: r.status });
      return r.data;
    } catch (e) {
      const st = e.response?.status;
      trace.push({ step, status: st || null, code: e.code, message: e.message });
      throw new DlError(
        st ? `nevercap membalas HTTP ${st}` : e.code === "ECONNABORTED" ? "nevercap tidak merespons" : "Gagal menghubungi nevercap",
        e.code === "ECONNABORTED" ? 408 : 500,
        { step, trace }
      );
    }
  };

  const start = await post("start", "https://nevercap.ai/wapi/fileServer/file/file/uploadUrlOpen", {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    parentId: -1,
  });
  const id = start?.data?.id;
  if (!start?.success || !id) throw new DlError("nevercap gagal membuat tugas download", 500, { step: "start", trace, start });

  let meta = null;
  while (Date.now() < deadline - 1500) {
    const check = await post("status", "https://nevercap.ai/wapi/fileServer/file/file/uploadUrlStatusOpen", { id });
    meta = check?.data?.fileMetaInfo;
    if (meta?.fileUrl) break;
    meta = null;
    await sleep(2000);
  }
  if (!meta) throw new DlError("File dari nevercap belum siap, coba lagi sebentar", 408, { step: "status", trace });

  return {
    status: true,
    source: "nevercap.ai",
    title: meta.fileName || null,
    videoId,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    size: meta.fileSize || null,
    type: meta.fileType || null,
    download: meta.fileUrl,
  };
}

// ---------------------------------------------------------------------------
// Sumber cadangan: SaveTube
// ---------------------------------------------------------------------------
function decrypt(enc) {
  try {
    const src = Buffer.from(enc, "base64");
    const d = crypto.createDecipheriv("aes-128-cbc", Buffer.from(AES_KEY_HEX, "hex"), src.subarray(0, 16));
    return JSON.parse(Buffer.concat([d.update(src.subarray(16)), d.final()]).toString());
  } catch {
    throw new DlError("Gagal membaca data dari SaveTube (format berubah atau kunci enkripsi diganti)");
  }
}

async function stCall(method, url, deadline, body, signal) {
  const left = deadline - Date.now();
  if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408);
  try {
    return (
      await axios({
        method,
        url,
        data: body,
        timeout: Math.min(REQ_MS, left),
        signal,
        headers: { "content-type": "application/json", origin: "https://yt.savetube.me", "user-agent": UA },
      })
    ).data;
  } catch (e) {
    const st = e.response?.status;
    if (st === 429) throw new DlError("SaveTube membatasi request (429), coba beberapa saat lagi", 429);
    if (st) {
      const b = typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data);
      throw new DlError(`SaveTube membalas HTTP ${st}`, 500, { step: url, upstreamStatus: st, body: String(b).slice(0, 300) });
    }
    throw new DlError(
      e.code === "ECONNABORTED" ? "SaveTube tidak merespons, coba lagi" : "Gagal menghubungi SaveTube",
      e.code === "ECONNABORTED" ? 408 : 500,
      { step: url, code: e.code, message: e.message }
    );
  }
}

function pickDownloadUrl(p) {
  const c = [
    p?.downloadUrl,
    p?.download_url,
    p?.data?.downloadUrl,
    p?.data?.download_url,
    p?.data?.url,
    p?.url,
    p?.result?.downloadUrl,
    p?.result?.url,
  ];
  return c.find((v) => typeof v === "string" && v.length > 0) || null;
}

async function ytdlSaveTube(videoId, format, deadline, signal) {
  let cdn, info, lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await stCall("get", "https://media.savetube.vip/api/random-cdn", deadline, undefined, signal);
      if (!c?.cdn) throw new DlError("Tidak bisa mendapatkan server CDN dari SaveTube");
      cdn = c.cdn;
      const r = await stCall("post", `https://${cdn}/v2/info`, deadline, { url: `https://www.youtube.com/watch?v=${videoId}` }, signal);
      if (!r?.data) throw new DlError("Respons info video tidak sesuai");
      info = decrypt(r.data);
      break;
    } catch (e) {
      lastErr = e;
      if (e.status === 429 || e.status === 408 || attempt === 1) throw e;
      await sleep(600);
    }
  }
  if (!info) throw lastErr || new DlError("Gagal mengambil info video");

  const key = info.key || info.data?.key || info.result?.key;
  if (!key) throw new DlError("Field 'key' tidak ditemukan pada info video");

  const d = await stCall(
    "post",
    `https://${cdn}/download`,
    deadline,
    { id: videoId, downloadType: format === "mp3" ? "audio" : "video", quality: format === "mp3" ? "128" : format, key },
    signal
  );
  const download = pickDownloadUrl(d);
  if (!download) throw new DlError("URL download tidak ditemukan. Resolusi ini mungkin tidak tersedia untuk video tersebut, coba resolusi lain.");

  return {
    status: true,
    source: "savetube (cadangan)",
    title: info.title,
    videoId,
    thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: info.duration,
    download,
    headers: { Referer: "https://yt.savetube.me/", Origin: "https://yt.savetube.me" },
  };
}

// SaveTube kadang membalas link yang isinya halaman HTML (CDN acak yang dipilih sedang bermasalah / file belum siap).
// Ulangi sampai 3x: tiap percobaan meminta CDN baru, lalu link divalidasi sebelum dipakai.
async function ytdlSaveTubeRetry(videoId, format, deadline, signal, kind) {
  let last;
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) break;
    if (deadline - Date.now() < 4000) break;
    try {
      const r = await ytdlSaveTube(videoId, format, deadline, signal);
      const probe = await probeMedia(r.download, kind, { headers: r.headers, timeout: PROBE_MS });
      if (probe.ok) return r;
      last = new DlError(`link bukan file media (${probe.reason})`);
      console.error(`[ytdl2-legacy] savetube percobaan ${i + 1}: ${probe.reason} | ${r.download}`);
    } catch (e) {
      last = e;
      if (e.status === 429 || e.status === 408) throw e;
    }
    await sleep(1500);
  }
  throw last || new DlError("SaveTube gagal");
}

// ---------------------------------------------------------------------------
// Fungsi utama
// ---------------------------------------------------------------------------
/**
 * @param {string} input   link YouTube atau ID 11 karakter
 * @param {string} format  mp3 | mp4 | 144 | 240 | 360 | 480 | 720 | 1080
 * @param {{signal?: AbortSignal, quality?: string|number, source?: string}} opts
 *        source: paksa satu sumber saja (ytmp3pc | nevercap | savetube), untuk debugging
 */
async function ytdlLegacy(input, format = "mp3", opts = {}) {
  try {
    const signal = opts?.signal;
    const videoId = extractVideoId(input);
    if (!videoId) {
      return { status: false, mess: "Format URL tidak dikenali atau bukan link YouTube yang valid" };
    }

    format = normalizeFormat(format);
    if (!VALID_FORMATS.includes(format)) {
      return { status: false, mess: `Format tidak dikenali. Pilihan: ${VALID_FORMATS.join(", ")}` };
    }

    const isAudio = format === "mp3";
    const vq = isAudio ? "mp3" : /^\d+$/.test(format) ? format : "720";

    const sources = isAudio
      ? [
          ["ytmp3pc", 12000, (d) => ytdlYtmp3pc(videoId, "mp3", opts?.quality, d, signal)],
          ["savetube", WAIT_MS, (d) => ytdlSaveTubeRetry(videoId, "mp3", d, signal, "audio")],
        ]
      : [
          ["ytmp3pc", 12000, (d) => ytdlYtmp3pc(videoId, vq, null, d, signal)],
          ["nevercap.ai", 8000, (d) => ytdlNevercap(videoId, d, signal)],
          ["savetube", WAIT_MS, (d) => ytdlSaveTubeRetry(videoId, vq, d, signal, "video")],
        ];

    const only = String(opts?.source || "").trim().toLowerCase();
    const list = only ? sources.filter(([n]) => n.toLowerCase().startsWith(only)) : sources;
    if (only && !list.length) {
      return { status: false, mess: `Sumber tidak dikenali. Pilihan: ${sources.map(([n]) => n.split(".")[0]).join(", ")}` };
    }

    const start = Date.now();
    const tried = [];
    let result = null;

    for (const [name, budget, run] of list) {
      if (signal?.aborted) break;
      const deadline = Math.min(start + WAIT_MS, Date.now() + budget);
      if (deadline - Date.now() < 2500) {
        tried.push(`${name}: dilewati, waktu habis`);
        continue;
      }
      try {
        const r = await run(deadline);
        // Pastikan link benar-benar file media, bukan halaman HTML.
        const probe = await probeMedia(r.download, isAudio ? "audio" : "video", { headers: r.headers, timeout: PROBE_MS });
        if (!probe.ok) {
          tried.push(`${name}: link bukan file media (${probe.reason})`);
          console.error(`[ytdl2-legacy] ${name}: link bukan file media (${probe.reason}) | ${r.download}`);
          continue;
        }
        result = r;
        break;
      } catch (e) {
        tried.push(`${name}: ${e.message}`);
        console.error(`[ytdl2-legacy] ${name} gagal: ${e.message}`, e.debug ? JSON.stringify(e.debug) : "");
      }
    }

    if (!result) {
      return { status: false, mess: `Semua sumber gagal. ${tried.join(" | ")}`.trim() };
    }

    return {
      status: true,
      source: result.source,
      title: result.title || null,
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      author: result.author,
      thumbnail: result.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: result.duration,
      cached: Boolean(result.cached),
      format: isAudio ? "mp3" : "mp4",
      requested: format,
      quality: result.quality,
      size: result.size,
      download: result.download,
      headers: result.headers,
    };
  } catch (err) {
    return { status: false, mess: err.message };
  }
}

export { ytdlLegacy, extractVideoId };
export default ytdlLegacy;
