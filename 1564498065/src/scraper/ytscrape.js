/**
 * ytscrape - downloader YouTube lewat provider yang di-scrape (tanpa yt-dlp, tanpa ffmpeg, zero dependency).
 * Dasar: "YouTube Scraper" milik Zane (invidious + y2mate.gs). Di sini hanya bagian downloader yang dipakai
 * (pencarian ditangani ytsearch-safe.js / ytdl2.js).
 *
 *  1. invidious  -> /api/v1/videos/<id> : daftar stream (muxed = video+audio jadi, adaptive = terpisah)
 *  2. y2mate.gs  -> backend etacloud (auth/init/convert/progress) : mp3 / mp4 jadi
 */
import { request as httpsReq } from "node:https";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT = 30_000;
const RETRIES = 2;

// instance invidious yang biasanya buka API (dicek ulang tiap jalan)
const IV_FALLBACK = [
  "invidious.f5.si", "inv.nadeko.net", "invidious.tiekoetter.com", "yewtu.be",
  "invidious.nerdvpn.de", "invidious.privacyredirect.com", "invidious.materialio.us",
  "invidious.fdn.fr", "iv.ggtyler.dev", "invidious.protokolla.fi",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP ────────────────────────────────────────────────────
/** Request HTTPS native, ikut redirect, retry untuk 429/5xx/timeout. */
async function req(url, { method = "GET", headers = {}, body, maxRedirect = 5, timeout = TIMEOUT, retries = RETRIES } = {}) {
  let cur = url;
  for (let hop = 0; hop <= maxRedirect; hop++) {
    const u = new URL(cur);
    let out = null;
    for (let i = 0; i <= retries; i++) {
      out = await new Promise((resolve) => {
        const rq = httpsReq(
          {
            protocol: u.protocol, hostname: u.hostname, port: u.port || 443,
            path: u.pathname + u.search, method, servername: u.hostname,
            headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers },
          },
          (res) => {
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve({
              status: res.statusCode, headers: res.headers,
              text: Buffer.concat(chunks).toString("utf8"), finalUrl: cur,
            }));
          },
        );
        rq.setTimeout(timeout, () => rq.destroy(new Error("timeout")));
        rq.on("error", (e) => resolve({ status: 0, error: e.message }));
        if (body) rq.write(body);
        rq.end();
      });
      if ((out.status >= 500 || out.status === 429 || out.status === 0) && i < retries) {
        await sleep(700 * (i + 1));
        continue;
      }
      break;
    }
    const loc = out.headers?.location;
    if (loc && out.status >= 300 && out.status < 400) {
      cur = new URL(loc, cur).toString();
      continue;
    }
    return out;
  }
  throw new Error("gagal: kebanyakan redirect");
}

// ── VIDEO ID ────────────────────────────────────────────────
export function videoId(input) {
  const value = String(input || "").trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("link YouTube tidak valid");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const id = host === "youtu.be"
    ? parts[0]
    : (url.searchParams.get("v") || (["embed", "live", "shorts", "v"].includes(parts[0]) ? parts[1] : ""));
  if (!/^[\w-]{11}$/.test(id || "")) throw new Error("link YouTube tidak didukung");
  return id;
}

// ── PROVIDER 1: INVIDIOUS ───────────────────────────────────
async function ivInstances(log) {
  const list = new Set(IV_FALLBACK);
  try {
    const r = await req("https://api.invidious.io/instances.json", { timeout: 12_000, retries: 0 });
    const j = JSON.parse(r.text);
    if (Array.isArray(j)) {
      for (const [host, meta] of j) {
        if (meta?.type?.includes("http") || meta?.api) list.add(host);
      }
    }
  } catch {
    log?.("daftar instance live gagal, pakai fallback");
  }
  return [...list];
}

/** Ambil info + stream dari satu instance invidious. */
async function ivFetch(host, id, timeout = 16_000) {
  const r = await req(`https://${host}/api/v1/videos/${id}`, {
    headers: { Accept: "application/json", Referer: `https://${host}/` },
    timeout, retries: 0,
  });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}${r.error ? ` ${r.error}` : ""}`);
  let j;
  try { j = JSON.parse(r.text); } catch { throw new Error("respons bukan JSON (kemungkinan halaman error/bot)"); }
  const adaptive = j.adaptiveFormats || [];
  const muxed = j.formatStreams || [];
  if (!adaptive.length && !muxed.length) throw new Error("tidak ada stream");
  // "resolution" bisa label ("360p") atau "640x360"; "size" bisa WxH atau jumlah byte
  const wh = (f) => {
    for (const key of ["resolution", "size"]) {
      const m = /^(\d{2,5})x(\d{2,5})$/.exec(String(f[key] || ""));
      if (m) return m;
    }
    return null;
  };
  const bytesOf = (f) => {
    const n = Number(f.clen ?? f.size);
    return Number.isFinite(n) && n > 1000 ? n : null;
  };
  return {
    instance: host,
    title: j.title || null,
    author: j.author || null,
    lengthSeconds: j.lengthSeconds || null,
    muxed: muxed.map((f) => {
      const m = wh(f);
      const label = f.qualityLabel || f.quality || "";
      return {
        itag: Number(f.itag) || null, kind: "muxed", type: f.type || null,
        quality: label || null, container: f.container || null,
        width: m ? Number(m[1]) : null,
        height: m ? Number(m[2]) : (Number((String(label).match(/(\d{3,4})p/) || [])[1]) || null),
        bytes: bytesOf(f),
        url: f.url,
      };
    }).filter((f) => f.url),
    adaptive: adaptive.map((f) => ({
      itag: Number(f.itag) || null,
      kind: String(f.type || "").startsWith("audio") ? "audio" : "video",
      type: f.type || null, container: f.container || null, url: f.url,
    })).filter((f) => f.url),
  };
}

/** Coba instance satu-satu sampai ada yang balikin stream. */
export async function viaInvidious(id, log) {
  const hosts = await ivInstances(log);
  const errors = [];
  for (const host of hosts) {
    try {
      const info = await ivFetch(host, id);
      log?.(`invidious ok di ${host} (${info.muxed.length + info.adaptive.length} stream)`);
      return { provider: "invidious", videoId: id, ...info, errors };
    } catch (e) {
      errors.push({ host, why: e.message });
    }
  }
  throw new Error(`semua instance invidious gagal (${errors.length}): ${errors.slice(0, 3).map((e) => `${e.host}=${e.why}`).join("; ")}`);
}

// ── PROVIDER 2: Y2MATE (backend etacloud) ───────────────────
const Y2 = "https://y2mate.gs";
const y2json = async (url, label, extra = {}) => {
  const r = await req(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "Cache-Control": "no-cache", Pragma: "no-cache",
      Referer: `${Y2}/`, Origin: Y2,
      ...extra,
    },
  });
  if (r.status !== 200) throw new Error(`${label} HTTP ${r.status}`);
  let j;
  try { j = JSON.parse(r.text); } catch { throw new Error(`${label} bukan JSON`); }
  const code = Number(j.error ?? j.err ?? 0);
  if (Number.isFinite(code) && code > 0) throw new Error(`${label} kode ${code}`);
  return j;
};

async function y2discover() {
  const html = await req(Y2, { headers: { Accept: "text/html" } });
  const apiKey = html.text.match(/\bapiKey\s*=\s*(['"])([A-Za-z0-9_-]{16,128})\1/)?.[2];
  const scriptSrc = html.text.match(/<script\b[^>]*\bsrc\s*=\s*(['"])([^'"]*y2mate(?:\.min)?\.js[^'"]*)\1/i)?.[2];
  if (!apiKey || !scriptSrc) throw new Error("struktur y2mate berubah");
  const script = await req(new URL(scriptSrc, Y2).toString(), { headers: { Accept: "text/javascript" } });
  const encHost = script.text.match(/\bendpoint\s*=\s*atob\(\s*(['"])([A-Za-z0-9+/=]+)\1\s*\)/)?.[2];
  return { apiKey, apiOrigin: `https://eta.${encHost ? Buffer.from(encHost, "base64").toString() : "etacloud.org"}` };
}

/** format: "mp3" | "mp4" */
export async function viaY2mate(id, format, log) {
  // auth/init kadang 403 -> discover ulang sekali
  let site = await y2discover();
  let init = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const auth = await y2json(`${site.apiOrigin}/api/v1/auth?api_key=${site.apiKey}&_=${Date.now()}`, "auth y2mate");
    if (!auth.key) throw new Error("token y2mate tidak ada");
    try {
      init = await y2json(`${site.apiOrigin}/api/v1/init?_=${Date.now()}`, "init y2mate", { Authorization: `Bearer ${auth.key}` });
      break;
    } catch (e) {
      if (attempt === 0 && /403/.test(e.message)) {
        log?.(`${e.message}, discover ulang`);
        await sleep(900);
        site = await y2discover();
        continue;
      }
      throw e;
    }
  }
  if (!init?.convertURL) throw new Error("URL convert tidak ada");

  let url = init.convertURL;
  let job = null;
  const withParams = (raw, params) => {
    const u = new URL(raw);
    for (const [k, val] of Object.entries(params)) u.searchParams.set(k, String(val));
    return u.toString();
  };
  for (let hop = 0; hop <= 5; hop++) {
    const data = await y2json(withParams(url, { v: id, f: format, _: Date.now() }), "convert y2mate");
    const dl = String(data.downloadURL || "").trim();
    const st = String(data.status || "").toLowerCase();
    if (st === "download" && dl) { job = { title: data.title || null, downloadUrl: dl }; break; }
    if (String(data.redirect) === "1" && data.redirectURL) { url = data.redirectURL; continue; }
    if (data.progressURL && dl) { job = { title: data.title || null, downloadUrl: dl, progressUrl: data.progressURL, progress: Number(data.progress) || 0 }; break; }
    throw new Error("convert tidak mengembalikan status valid");
  }
  if (!job) throw new Error("convert gagal");

  if (job.progressUrl && (job.progress || 0) < 3) {
    for (let i = 0; i < 20 && (job.progress || 0) < 3; i++) {
      await sleep(3000);
      const data = await y2json(withParams(job.progressUrl, { _: Date.now() }), "progress y2mate");
      if (String(data.status || "").toLowerCase() === "download" && data.downloadURL) {
        job = { title: data.title || job.title, downloadUrl: data.downloadURL };
        break;
      }
      job.progress = Number(data.progress) || job.progress;
      job.downloadUrl = data.downloadURL || job.downloadUrl;
    }
  }
  if (!job.downloadUrl) throw new Error("download URL tidak keluar");
  log?.(`y2mate ok (${format})`);
  return {
    provider: "y2mate", videoId: id, format,
    title: job.title || null,
    downloadUrl: withParams(job.downloadUrl, { v: id, f: format, r: "y2mate.gs" }),
  };
}

export default { videoId, viaInvidious, viaY2mate };
