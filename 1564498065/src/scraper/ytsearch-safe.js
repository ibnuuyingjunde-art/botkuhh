import axios from "axios";

/**
 * ytsearch-safe.js
 * Pengganti "yt-search" yang lebih tahan banting.
 *
 * Masalah pada "yt-search": ia mengasumsikan field `title` pada hasil
 * pencarian YouTube selalu berupa string polos, lalu langsung memanggil
 * `.trim()` di atasnya. Pada kenyataannya YouTube kadang mengembalikan
 * elemen non-video (shelf, mix, shorts-shelf) yang title-nya berbentuk
 * objek `{ runs: [...] }` atau `{ simpleText: ... }` — bukan string —
 * sehingga `.trim()` melempar TypeError dan mem-bug seluruh proses parsing.
 *
 * Modul ini mem-parsing ytInitialData secara manual dan selalu
 * mengubah setiap kemungkinan bentuk teks menjadi string aman sebelum
 * dipakai, jadi tidak pernah crash gara-gara bentuk data yang berubah-ubah.
 */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

/** Ubah node teks YouTube (string / simpleText / runs / accessibility) jadi string aman. */
function safeText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) {
    return node.runs
      .map((r) => (typeof r?.text === "string" ? r.text : ""))
      .join("");
  }
  if (typeof node.accessibility?.accessibilityData?.label === "string") {
    return node.accessibility.accessibilityData.label;
  }
  return "";
}

function parseDurationToSeconds(timestamp) {
  if (!timestamp) return 0;
  const parts = String(timestamp)
    .split(":")
    .map((n) => parseInt(n, 10) || 0);
  let seconds = 0;
  for (const p of parts) seconds = seconds * 60 + p;
  return seconds;
}

/** Ambil objek JSON berimbang mulai dari posisi `start` (tahan terhadap "};" di dalam string). */
function scanJson(text, start) {
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

function extractInitialData(html) {
  // Cara utama: scanner berimbang
  const at = html.indexOf("var ytInitialData");
  const brace = at < 0 ? -1 : html.indexOf("{", at);
  if (brace >= 0) {
    const raw = scanJson(html, brace);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        /* lanjut ke regex di bawah */
      }
    }
  }
  const patterns = [
    /var ytInitialData\s*=\s*(\{.*?\});<\/script>/s,
    /ytInitialData"\]\s*=\s*(\{.*?\});/s,
    /ytInitialData\s*=\s*(\{.*?\})\s*;\s*<\/script>/s,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Cari semua node `videoRenderer` di dalam pohon data, sedalam apa pun bersarangnya. */
function walkVideoRenderers(node, out = [], depth = 0) {
  if (!node || typeof node !== "object" || depth > 40) return out;
  if (node.videoRenderer) out.push(node.videoRenderer);
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === "object") walkVideoRenderers(val, out, depth + 1);
  }
  return out;
}

// "1,234,567 views" / "1.2M views" -> angka (0 kalau tidak ada)
function parseViews(text) {
  const m = String(text || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult) || 0;
}

function mapVideoRenderer(vr) {
  const videoId = vr?.videoId;
  if (!videoId) return null;

  const title = safeText(vr.title).trim();
  const durationTimestamp = safeText(vr.lengthText).trim();
  const author =
    safeText(vr.ownerText) ||
    safeText(vr.longBylineText) ||
    safeText(vr.shortBylineText);
  const viewsText = safeText(vr.viewCountText) || safeText(vr.shortViewCountText);
  const views = parseViews(viewsText);
  const ago = safeText(vr.publishedTimeText).trim();
  const thumbs = vr.thumbnail?.thumbnails || [];
  const thumbnail = thumbs.length ? thumbs[thumbs.length - 1].url : "";

  return {
    videoId,
    title: title || "(tanpa judul)",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail,
    views,
    ago,
    timestamp: durationTimestamp || "LIVE",
    seconds: parseDurationToSeconds(durationTimestamp),
    author: { name: author || "-" },
    duration: {
      timestamp: durationTimestamp || "LIVE",
      seconds: parseDurationToSeconds(durationTimestamp),
    },
  };
}

/**
 * Cari video di YouTube.
 * @param {string} query
 * @returns {Promise<{videos: object[]}>}
 */
async function ytSearch(query) {
  const { data: html } = await axios.get("https://www.youtube.com/results", {
    params: { search_query: query, hl: "en", gl: "US" },
    headers: HEADERS,
    timeout: 20000,
  });

  const initialData = extractInitialData(html);
  if (!initialData) {
    throw new Error("Gagal mem-parsing hasil pencarian YouTube.");
  }

  const renderers = walkVideoRenderers(initialData);
  const videos = renderers.map(mapVideoRenderer).filter(Boolean);

  return { videos };
}

/**
 * Ambil metadata satu video (untuk mode link langsung), lewat oEmbed —
 * tidak menyentuh parser ytInitialData sama sekali sehingga tidak mungkin
 * kena bug yang sama.
 * @param {string} videoId
 */
async function ytSearchVideo(videoId) {
  const { data } = await axios.get("https://www.youtube.com/oembed", {
    params: {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      format: "json",
    },
    headers: HEADERS,
    timeout: 15000,
  });

  return {
    videoId,
    title: data?.title || "",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    author: { name: data?.author_name || "-" },
    thumbnail: data?.thumbnail_url || "",
  };
}

/**
 * Ambil satu video dari link / ID (pengganti yts(url) milik yt-search).
 * Dicari lewat ID supaya dapat durasi, views, dll.; kalau tidak ketemu, pakai oEmbed.
 */
async function ytFindVideo(urlOrId) {
  const m = String(urlOrId || "").match(/(?:[?&]v=|youtu\.be\/|shorts\/|embed\/|live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  const id = m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(String(urlOrId || "").trim()) ? String(urlOrId).trim() : null;
  if (!id) return null;
  try {
    const { videos } = await ytSearch(id);
    const hit = (videos || []).find((v) => v.videoId === id);
    if (hit) return hit;
  } catch {
    /* lanjut ke oEmbed */
  }
  return ytSearchVideo(id).catch(() => null);
}

export { ytSearch, ytSearchVideo, ytFindVideo };
export default ytSearch;