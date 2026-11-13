import axios from "axios";
import crypto from "crypto";
import { probeMedia } from "./probe.js";

const ID_RE = /(?:[?&]v=|youtu\.be\/|shorts\/|embed\/|live\/|\/v\/)([A-Za-z0-9_-]{11})/;
const VALID_FORMATS = ["mp3", "mp4", "144", "240", "360", "480", "720", "1080"];
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36";
const WAIT_MS = 45000;
const REQ_MS = 8000;
const YM_INIT = "https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471";
const YM_HEADERS = {
  accept: "*/*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  referer: "https://id.ytmp3.mobi/",
  origin: "https://id.ytmp3.mobi",
  "user-agent": UA,
};

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

async function ymGet(url, deadline, trace, step) {
  const left = deadline - Date.now();
  if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408, { step, trace });
  try {
    const r = await axios.get(url, { headers: YM_HEADERS, timeout: Math.min(REQ_MS, left) });
    trace.push({ step, status: r.status });
    if (r.data && typeof r.data === "object") return r.data;
    try {
      return JSON.parse(r.data);
    } catch {
      throw new DlError("ytmp3.mobi membalas data yang bukan JSON", 500, {
        step,
        trace,
        body: String(r.data).slice(0, 200),
      });
    }
  } catch (e) {
    if (e instanceof DlError) throw e;
    const st = e.response?.status;
    trace.push({ step, status: st || null, code: e.code, message: e.message });
    if (st === 429) throw new DlError("ytmp3.mobi membatasi request (429)", 429, { step, trace });
    throw new DlError(
      st
        ? `ytmp3.mobi membalas HTTP ${st}`
        : e.code === "ECONNABORTED"
          ? "ytmp3.mobi tidak merespons"
          : "Gagal menghubungi ytmp3.mobi",
      e.code === "ECONNABORTED" ? 408 : 500,
      { step, trace },
    );
  }
}

async function ytdlYtmp3(videoId, format, deadline) {
  const trace = [];
  const ymFormat = format === "mp3" ? "mp3" : "mp4";

  const init = await ymGet(`${YM_INIT}&_=${Math.random()}`, deadline, trace, "init");
  if (!init.convertURL)
    throw new DlError("Field 'convertURL' tidak ditemukan (API ytmp3.mobi mungkin berubah)", 500, {
      step: "init",
      trace,
      init,
    });

  let conv = await ymGet(
    `${init.convertURL}&v=${videoId}&f=${ymFormat}&_=${Math.random()}`,
    deadline,
    trace,
    "convert",
  );
  for (let i = 0; i < 2 && conv?.redirect && conv?.redirectURL; i++) {
    conv = await ymGet(conv.redirectURL, deadline, trace, "redirect");
  }
  if (!conv?.downloadURL) {
    throw new DlError(
      "URL download tidak ditemukan dari ytmp3.mobi" +
        (conv?.error ? ` (kode ${conv.error})` : "") +
        " (video mungkin diblokir / terlalu panjang)",
      500,
      { step: "convert", trace, conv },
    );
  }

  let info = {};
  if (conv.progressURL) {
    for (let i = 0; i < 12; i++) {
      info = await ymGet(
        `${conv.progressURL}&_=${Math.random()}`.replace("?&", "?"),
        deadline,
        trace,
        "progress",
      );
      if (info.error && Number(info.error) > 0) {
        throw new DlError(
          `Konversi gagal di ytmp3.mobi (kode ${info.error}). Video mungkin diblokir, live, atau terlalu panjang.`,
          500,
          { step: "progress", trace, info },
        );
      }
      if (Number(info.progress) === 3) break;
      await sleep(1200);
    }
    if (Number(info.progress) !== 3)
      throw new DlError("Konversi belum selesai, coba lagi sebentar", 408, {
        step: "progress",
        trace,
        info,
      });
  }

  return {
    status: true,
    source: "ytmp3.mobi",
    title: info.title || null,
    videoId,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    format: ymFormat,
    requested: format,
    download: conv.downloadURL,
  };
}

function collectMedias(data) {
  const out = [];
  const seen = new Set();
  const walk = (o, depth) => {
    if (!o || depth > 5) return;
    if (Array.isArray(o)) {
      o.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof o !== "object") return;
    const url = [o.url, o.downloadUrl, o.download_url, o.link, o.href].find(
      (v) => typeof v === "string" && /^https?:\/\//.test(v),
    );
    if (url && !seen.has(url)) {
      seen.add(url);
      const text = JSON.stringify({
        t: o.type,
        l: o.label,
        q: o.quality,
        f: o.format,
        e: o.ext,
        m: o.mimeType || o.mime,
        r: o.resolution,
        n: o.name,
      }).toLowerCase();
      const ext = String(
        o.ext ||
          o.extension ||
          (url.match(/\.(mp4|webm|mp3|m4a|opus|ogg|mkv)(?:\?|$)/i) || [])[1] ||
          "",
      ).toLowerCase();
      let kind = null;
      if (/audio|mp3|m4a|opus|ogg/.test(text) || /^(mp3|m4a|opus|ogg)$/.test(ext)) kind = "audio";
      else if (/video|mp4|webm|\d{3,4}p/.test(text) || /^(mp4|webm|mkv)$/.test(ext)) kind = "video";
      const hm = text.match(/(\d{3,4})\s*p/) || text.match(/"(\d{3,4})"/);
      out.push({
        kind,
        height: hm ? Number(hm[1]) : null,
        ext,
        label: o.label || o.quality || o.name || null,
        url,
      });
    }
    Object.keys(o).forEach((k) => {
      if (o[k] && typeof o[k] === "object") walk(o[k], depth + 1);
    });
  };
  walk(data, 0);
  return out;
}

function pickMedia(medias, format) {
  if (format === "mp3") {
    const a = medias.filter((m) => m.kind === "audio");
    return a.find((m) => m.ext === "mp3") || a.find((m) => m.ext === "m4a") || a[0] || null;
  }
  const v = medias.filter((m) => m.kind === "video");
  if (!v.length) return null;
  const want = /^\d+$/.test(format) ? Number(format) : 720;
  const mp4 = v.filter((m) => m.ext === "mp4");
  const pool = mp4.length ? mp4 : v;
  const withH = pool.filter((m) => m.height);
  if (!withH.length) return pool[0];
  withH.sort((x, y) => Math.abs(x.height - want) - Math.abs(y.height - want) || y.height - x.height);
  return withH[0];
}

function mediaSource(name, label, requestFn) {
  return async function (videoId, format, deadline) {
    const left = deadline - Date.now();
    if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408);
    let data;
    try {
      data = await requestFn(`https://www.youtube.com/watch?v=${videoId}`, Math.min(REQ_MS, left));
    } catch (e) {
      const st = e.response?.status;
      throw new DlError(
        st
          ? `${label} membalas HTTP ${st}`
          : e.code === "ECONNABORTED"
            ? `${label} tidak merespons`
            : `Gagal menghubungi ${label}`,
        e.code === "ECONNABORTED" ? 408 : 500,
        {
          status: st || null,
          code: e.code,
          message: e.message,
          body: e.response
            ? String(
                typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data),
              ).slice(0, 300)
            : undefined,
        },
      );
    }
    const medias = collectMedias(data);
    const m = pickMedia(medias, format);
    if (!m) {
      throw new DlError(
        `${label}: link ${format === "mp3" ? "audio" : "video"} tidak ditemukan`,
        500,
        {
          keys: data && typeof data === "object" ? Object.keys(data).slice(0, 15) : typeof data,
          found: medias
            .slice(0, 8)
            .map((x) => ({ kind: x.kind, height: x.height, ext: x.ext, label: x.label })),
          sample: JSON.stringify(data).slice(0, 300),
        },
      );
    }
    return {
      status: true,
      source: name,
      title: data?.title || data?.data?.title || null,
      videoId,
      thumbnail: data?.thumbnail || data?.data?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: data?.duration || data?.data?.duration || undefined,
      format: m.kind === "audio" ? m.ext || "audio" : "mp4",
      quality: m.label || (m.height ? m.height + "p" : null),
      requested: format,
      download: m.url,
    };
  };
}

const ytdlSosmed = mediaSource("sosmedsaver.me", "sosmedsaver", async (ytUrl, ms) =>
  (
    await axios.get("https://www.sosmedsaver.me/api/info", {
      params: { url: ytUrl },
      headers: { Accept: "application/json", "user-agent": UA },
      timeout: ms,
    })
  ).data,
);

async function ytdlNevercap(videoId, format, deadline) {
  const trace = [];
  const headers = { "content-type": "application/json", "user-agent": "Mozilla/5.0" };
  const post = async (step, url, body) => {
    const left = deadline - Date.now();
    if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408, { step, trace });
    try {
      const r = await axios.post(url, body, { headers, timeout: Math.min(REQ_MS, left) });
      trace.push({ step, status: r.status });
      return r.data;
    } catch (e) {
      const st = e.response?.status;
      trace.push({ step, status: st || null, code: e.code, message: e.message });
      throw new DlError(
        st
          ? `nevercap membalas HTTP ${st}`
          : e.code === "ECONNABORTED"
            ? "nevercap tidak merespons"
            : "Gagal menghubungi nevercap",
        e.code === "ECONNABORTED" ? 408 : 500,
        { step, trace },
      );
    }
  };

  const start = await post("start", "https://nevercap.ai/wapi/fileServer/file/file/uploadUrlOpen", {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    parentId: -1,
  });
  const id = start?.data?.id;
  if (!start?.success || !id)
    throw new DlError("nevercap gagal membuat tugas download", 500, { step: "start", trace, start });

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
    format: "mp4",
    requested: format,
    size: meta.fileSize || null,
    type: meta.fileType || null,
    download: meta.fileUrl,
  };
}

const YT4_BASE = "https://youtubemp4.to";
const strip = (h) => String(h || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();

async function ytdlYt4(videoId, format, deadline) {
  const left = () => deadline - Date.now();
  if (left() < 1500) throw new DlError("Waktu habis, coba lagi", 408);
  const base = {
    "User-Agent": UA,
    "Accept-Language": "id-ID,id;q=0.9",
    Referer: `${YT4_BASE}/HAOT/`,
    Origin: YT4_BASE,
  };

  let cookie = "";
  try {
    const h = await axios.head(`${YT4_BASE}/HAOT/`, { headers: base, timeout: Math.min(4000, left()) });
    cookie = (h.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
  } catch {}

  if (left() < 1500) throw new DlError("Waktu habis, coba lagi", 408);
  let data;
  try {
    data = (
      await axios.post(
        `${YT4_BASE}/download_ajax/`,
        new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}` }).toString(),
        {
          headers: {
            ...base,
            Cookie: cookie,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
          },
          timeout: Math.min(REQ_MS, left()),
        },
      )
    ).data;
  } catch (e) {
    const st = e.response?.status;
    throw new DlError(
      st
        ? `youtubemp4.to membalas HTTP ${st}`
        : e.code === "ECONNABORTED"
          ? "youtubemp4.to tidak merespons"
          : "Gagal menghubungi youtubemp4.to",
      e.code === "ECONNABORTED" ? 408 : 500,
      { status: st || null, code: e.code, message: e.message },
    );
  }

  const html = String(data?.result || "");
  const title = strip((html.match(/class="[^"]*\bmeta\b[^"]*"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1]) || null;
  const thumb = (html.match(/class="[^"]*\bposter\b[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"/) || [])[1];

  const idx = html.indexOf("results-other");
  const area = idx >= 0 ? html.slice(idx) : html;
  const rows = [];
  for (const tr of area.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => strip(x[1]));
    const href = (tr[1].match(/<a[^>]*href="([^"]+)"/) || [])[1];
    if (href && /^https?:\/\//.test(href.replace(/&amp;/g, "&")))
      rows.push({ quality: tds[0] || "", size: tds[1] || "", url: href.replace(/&amp;/g, "&") });
  }

  const isAudio = (r) => /audio|mp3|kbps|kbit/i.test(r.quality);
  let pick = null;
  if (format === "mp3") {
    pick = rows.find(isAudio) || null;
  } else {
    const want = /^\d+$/.test(format) ? Number(format) : 720;
    const vids = rows
      .filter((r) => !isAudio(r))
      .map((r) => ({ ...r, height: Number((r.quality.match(/\d{3,4}/) || [])[0]) || null }))
      .filter((r) => r.height);
    vids.sort((x, y) => Math.abs(x.height - want) - Math.abs(y.height - want) || y.height - x.height);
    pick = vids[0] || null;
  }
  if (!pick)
    throw new DlError(`youtubemp4.to: link ${format === "mp3" ? "audio" : "video"} tidak ditemukan`, 500, {
      found: rows.slice(0, 8),
    });

  return {
    status: true,
    source: "youtubemp4.to",
    title,
    videoId,
    thumbnail: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    format: format === "mp3" ? "mp3" : "mp4",
    quality: pick.quality || null,
    size: pick.size || null,
    requested: format,
    download: pick.url,
  };
}

const AES_KEY_HEX = "C5D58EF67A7584E4A29F6C35BBC4EB12";

function decrypt(enc) {
  try {
    const src = Buffer.from(enc, "base64");
    const d = crypto.createDecipheriv("aes-128-cbc", Buffer.from(AES_KEY_HEX, "hex"), src.subarray(0, 16));
    return JSON.parse(Buffer.concat([d.update(src.subarray(16)), d.final()]).toString());
  } catch {
    throw new DlError("Gagal membaca data dari SaveTube (format berubah atau kunci enkripsi diganti)");
  }
}

async function call(method, url, deadline, body) {
  const left = deadline - Date.now();
  if (left < 1500) throw new DlError("Waktu habis, coba lagi", 408);
  try {
    return (
      await axios({
        method,
        url,
        data: body,
        timeout: Math.min(REQ_MS, left),
        headers: { "content-type": "application/json", origin: "https://yt.savetube.me", "user-agent": UA },
      })
    ).data;
  } catch (e) {
    const st = e.response?.status;
    if (st === 429) throw new DlError("SaveTube membatasi request (429), coba beberapa saat lagi", 429);
    if (st)
      throw new DlError(`SaveTube membalas HTTP ${st}`, 500, {
        step: url,
        upstreamStatus: st,
        body: String(typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data)).slice(0, 300),
      });
    throw new DlError(
      e.code === "ECONNABORTED" ? "SaveTube tidak merespons, coba lagi" : "Gagal menghubungi SaveTube",
      e.code === "ECONNABORTED" ? 408 : 500,
      { step: url, code: e.code, message: e.message },
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

async function ytdlSaveTube(videoId, format, deadline) {
  let cdn, info, lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await call("get", "https://media.savetube.vip/api/random-cdn", deadline);
      if (!c?.cdn) throw new DlError("Tidak bisa mendapatkan server CDN dari SaveTube");
      cdn = c.cdn;
      const r = await call("post", `https://${cdn}/v2/info`, deadline, {
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
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

  const d = await call("post", `https://${cdn}/download`, deadline, {
    id: videoId,
    downloadType: format === "mp3" ? "audio" : "video",
    quality: format === "mp3" ? "128" : format,
    key,
  });
  const download = pickDownloadUrl(d);
  if (!download)
    throw new DlError("URL download tidak ditemukan. Resolusi ini mungkin tidak tersedia untuk video tersebut, coba resolusi lain.");

  return {
    status: true,
    source: "savetube",
    title: info.title,
    videoId,
    thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: info.duration,
    format,
    download,
  };
}

async function ytdl3(url, format = "mp3", opts = {}) {
  if (!url) return { status: false, error: "URL wajib diisi" };

  const videoId = extractVideoId(url);
  if (!videoId) return { status: false, error: "Format URL tidak dikenali atau bukan link YouTube yang valid" };

  const fmt = normalizeFormat(format);
  if (!VALID_FORMATS.includes(fmt))
    return { status: false, error: `Format tidak dikenali. Pilihan: ${VALID_FORMATS.join(", ")}` };

  const start = Date.now();
  const isAudio = fmt === "mp3";
  const stFormat = isAudio ? "mp3" : /^\d+$/.test(fmt) ? fmt : "720";

  const sources = isAudio
    ? [
        ["ytmp3.mobi", 9000, (d) => ytdlYtmp3(videoId, "mp3", d)],
        ["sosmedsaver.me", 5000, (d) => ytdlSosmed(videoId, "mp3", d)],
        ["youtubemp4.to", 8000, (d) => ytdlYt4(videoId, "mp3", d)],
        ["savetube", WAIT_MS, (d) => ytdlSaveTube(videoId, "mp3", d)],
      ]
    : [
        ["sosmedsaver.me", 5000, (d) => ytdlSosmed(videoId, fmt, d)],
        ["nevercap.ai", 18000, (d) => ytdlNevercap(videoId, fmt, d)],
        ["ytmp3.mobi", 5000, (d) => ytdlYtmp3(videoId, "mp4", d)],
        ["youtubemp4.to", 8000, (d) => ytdlYt4(videoId, fmt, d)],
        ["savetube", WAIT_MS, (d) => ytdlSaveTube(videoId, stFormat, d)],
      ];

  const tried = [];
  let lastErr = null;
  for (const [name, budget, run] of sources) {
    const deadline = Math.min(start + WAIT_MS, Date.now() + budget);
    if (deadline - Date.now() < 2500) {
      tried.push({ source: name, error: "dilewati, waktu habis" });
      continue;
    }
    try {
      const result = await run(deadline);
      if (!result.source) result.source = name;

      // Link harus benar-benar file media. Banyak sumber "sukses" tapi link-nya
      // halaman HTML / expired -> anggap gagal dan lanjut ke sumber berikutnya.
      const probe = await probeMedia(result.download, isAudio ? "audio" : "video", {
        headers: result.source === "ytmp3.mobi" ? { Referer: "https://id.ytmp3.mobi/" } : undefined,
      });
      if (!probe.ok) {
        throw new DlError(`${name}: link tidak valid (${probe.reason})`, 502, { step: "probe", probe });
      }
      const out = { ...result };
      if (opts.debug) out.debug = { tried };
      return out;
    } catch (e) {
      lastErr = e;
      tried.push({ source: name, error: e.message, debug: e.debug });
    }
  }

  const out = { status: false, error: lastErr ? lastErr.message : "Semua sumber gagal" };
  if (opts.debug) out.debug = { tried };
  return out;
}

export { ytdl3, extractVideoId };
export default ytdl3;