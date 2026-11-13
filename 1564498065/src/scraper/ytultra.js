const BASE = "https://api.ytultra.com/ikool/youtube";
const HEAD = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36",
  Origin: "https://www.ytultra.com",
  Referer: "https://www.ytultra.com/",
};

const TIMEOUT = 90000;
const MAX_RETRY = 2;
const URL_KEYS = ["url", "downloadUrl", "download_url", "link", "href", "src"];
const ID_RE = /^[\w-]{11}$/;

function videoId(input = "") {
  const s = String(input).trim();
  if (ID_RE.test(s)) return s;

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
  } catch {
    throw new Error("URL YouTube tidak valid");
  }

  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id = null;

  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v");
    if (!id) {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v|e)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }

  if (id && ID_RE.test(id)) return id;
  throw new Error("URL YouTube tidak valid");
}

const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isThumb = (link) => /ytimg|img\.youtube|\.(jpe?g|png|webp|gif)(\?|$)/i.test(link);

function collect(obj, out = [], seen = new Set(), depth = 0) {
  if (depth > 12 || obj == null) return out;

  if (Array.isArray(obj)) {
    for (const v of obj) collect(v, out, seen, depth + 1);
  } else if (typeof obj === "object") {
    const key = URL_KEYS.find((k) => isHttp(obj[k]));

    if (key && !seen.has(obj[key])) {
      seen.add(obj[key]);
      out.push({ ...obj, _link: obj[key] });
    }

    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") collect(v, out, seen, depth + 1);
    }
  } else if (isHttp(obj) && depth > 0 && !seen.has(obj)) {

    seen.add(obj);
    out.push({ _link: obj });
  }

  return out;
}

function descriptor(x) {
  const parts = [];
  for (const [k, v] of Object.entries(x)) {
    if (k === "_link" || URL_KEYS.includes(k) || /^(title|name|description|thumbnail|thumb)$/i.test(k)) continue;
    if (v == null || typeof v === "object") continue;
    parts.push(`${k}:${v}`);
  }

  try {
    const ext = new URL(x._link).pathname.match(/\.(mp4|m4a|mp3|webm|opus|mkv|3gp|ogg|aac)$/i);
    if (ext) parts.push(`ext:${ext[1]}`);
  } catch {}
  return parts.join(" ").toLowerCase();
}

function heightOf(x, d) {
  for (const k of ["height", "quality", "label", "resolution", "res", "format", "qualityLabel"]) {
    const v = x[k];
    if (v == null) continue;
    const n = parseInt(String(v).match(/(\d{3,4})\s*p?/i)?.[1]);
    if (n) return n;
  }
  return parseInt(d.match(/(\d{3,4})p/)?.[1]) || 0;
}

function normalize(x) {
  const d = descriptor(x);

  const audioOnly = /\b(mp3|m4a|opus|aac|ogg|audio only|audio\/|type:audio|audio_only|audioonly)\b/.test(d) && !/video\//.test(d) && !/\b(mp4|webm|mkv)\b.*\b\d{3,4}p\b/.test(d);
  const videoLike = /\b(mp4|webm|mkv|3gp|video)\b|video\//.test(d) || !!heightOf(x, d);
  const type = audioOnly ? "audio" : videoLike ? "video" : "unknown";

  const noAudio = /video only|videoonly|no audio|mute|noaudio|hasaudio:false|audio:false|isaudio:false/.test(d);
  const ext = (d.match(/\b(mp4|m4a|mp3|webm|opus|mkv|3gp|ogg|aac)\b/) || [])[1] || null;

  return {
    ...x,
    url: x._link,
    type,
    ext,
    height: type === "audio" ? 0 : heightOf(x, d),
    hasAudio: type === "audio" ? true : !noAudio,
    _desc: d,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(id) {
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const r = await fetch(`${BASE}/download`, {
        method: "POST",
        headers: HEAD,
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${id}` }),
        signal: AbortSignal.timeout(TIMEOUT),
      });

      const text = await r.text();

      if (!r.ok) {
        const err = new Error(`ytultra ${r.status}: ${text.slice(0, 200)}`);

        if (r.status === 429 || r.status >= 500) {
          lastErr = err;
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw err;
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Respons bukan JSON: " + text.slice(0, 120));
      }
    } catch (e) {
      lastErr = e;
      const transient = e?.name === "TimeoutError" || e?.name === "AbortError" || e?.cause?.code === "ECONNRESET" || /fetch failed/i.test(e?.message || "");
      if (!transient || attempt === MAX_RETRY) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }

  throw lastErr || new Error("ytultra gagal");
}

async function ytultra(input) {
  const id = videoId(input);
  const raw = await request(id);

  const apiErr = raw?.error || (raw?.success === false && raw?.message) || (raw?.status === false && (raw?.msg || raw?.message));
  const items = collect(raw)
    .filter((x) => !isThumb(x._link))
    .map(normalize);

  if (!items.length && apiErr) throw new Error("ytultra: " + (typeof apiErr === "string" ? apiErr : JSON.stringify(apiErr)).slice(0, 200));

  return {
    id,
    title: raw?.title || raw?.data?.title || raw?.result?.title || raw?.data?.info?.title || "",
    thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    items,
    raw,
  };
}

function pick(items = [], type = "mp4", maxHeight = 720) {
  const list = items.map((x) => (x.type ? x : normalize(x)));

  if (type === "mp3") {
    return (
      list.find((x) => x.type === "audio" && x.ext === "mp3") ||
      list.find((x) => x.type === "audio" && /mp3/.test(x._desc || "")) ||
      list.find((x) => x.type === "audio") ||
      null
    );
  }

  const vids = list.filter((x) => x.type === "video");

  const withAudio = vids.filter((x) => x.hasAudio);
  const pool = withAudio.length ? withAudio : vids;

  const mp4First = (a, b) => (b.ext === "mp4") - (a.ext === "mp4");
  const ok = pool.filter((x) => x.height && x.height <= maxHeight).sort((a, b) => b.height - a.height || mp4First(a, b));

  if (ok.length) return ok[0];

  const sorted = pool.filter((x) => x.height).sort((a, b) => a.height - b.height || mp4First(a, b));
  return sorted[0] || pool[0] || null;
}

export { ytultra, pick, videoId, collect, normalize };
export default { ytultra, pick, videoId };