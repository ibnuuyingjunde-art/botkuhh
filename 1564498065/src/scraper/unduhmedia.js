import axios from "axios";

const BASE = "https://www.unduhmedia.web.id";

const PLATFORMS = [
  ["tiktok", /(^|\.)(tiktok\.com)$/i],
  ["instagram", /(^|\.)(instagram\.com|instagr\.am)$/i],
  ["threads", /(^|\.)(threads\.net|threads\.com)$/i],
  ["spotify", /(^|\.)(spotify\.com|spotify\.link)$/i],
  ["x", /(^|\.)(x\.com|twitter\.com)$/i],
  ["pinterest", /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i],
  ["facebook", /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i],
  ["soundcloud", /(^|\.)(soundcloud\.com|snd\.sc)$/i],
];

const enc = encodeURIComponent;
const rid = () => Math.random().toString(36).slice(2, 8);
const user = (u) => (u && u !== "N/A" ? "@" + u : null);

function detectPlatform(link) {
  let host;
  try {
    host = new URL(link).hostname;
  } catch {
    return null;
  }
  const hit = PLATFORMS.find(([, re]) => re.test(host));
  return hit ? hit[0] : null;
}

const proxy = (platform, mediaUrl, name) =>
  `${BASE}/api/${platform}?download=${enc(mediaUrl)}&filename=${enc(name)}`;

function makeNamer(f, id) {
  return (ext, idx, prefix = "") => {
    if (f) return idx ? `${f}-${idx}.${ext}` : `${f}.${ext}`;
    const base = `unduhmedia.web.id${prefix}`;
    return idx ? `${base}-${id}-${idx}.${ext}` : `${base}.${id}.${ext}`;
  };
}

const item = (type, label, url, download_url) => ({
  type,
  label,
  url: url || null,
  download_url: download_url || null,
});

function tiktok(G, f) {
  const id = rid();
  const name = makeNamer(f, id);
  const dl = (i, n) => `${BASE}/api/tiktok?action=download&id=${enc(i)}&filename=${enc(n)}`;
  const media = [];
  let kind;

  if (G.isSlide && Array.isArray(G.imageUrls) && G.imageUrls.length) {
    kind = "TikTok Slideshow";
    G.imageUrls.forEach((src, i) => {
      media.push(
        item("image", `Gambar ${i + 1}`, src, G.imageIds?.[i] ? dl(G.imageIds[i], name("jpg", i + 1)) : src),
      );
    });
  } else if (G.videoId) {
    kind = "TikTok Video";
    media.push(item("video", "Unduh MP4", null, dl(G.videoId, name("mp4"))));
  } else {
    return null;
  }
  if (G.audioId) media.push(item("audio", "Unduh MP3", null, dl(G.audioId, name("mp3"))));
  return { kind, author: G.author || null, text: G.description || null, media };
}

function slidesAdapter(platform, kindVideo, kindPost, G, f, videoPrefix = "") {
  const r = G.result || {};
  const c = r.metadata || {};
  const e = r.author || {};
  const Z = r.media || {};
  const id = rid();
  const name = makeNamer(f, id);
  const out = { kind: null, author: user(e.username), text: c.caption || null, media: [] };

  if (c.isVideo && Z.videoUrl) {
    out.kind = kindVideo;
    out.media.push(item("video", "Unduh Video", Z.videoUrl, proxy(platform, Z.videoUrl, name("mp4", 0, videoPrefix))));
  } else if (Array.isArray(Z.slides)) {
    const slides = Z.slides.filter((s) => s?.images?.length || s?.videoUrl);
    if (!slides.length) return null;
    out.kind = typeof kindPost === "function" ? kindPost(slides.length) : kindPost;
    slides.forEach((s, i) => {
      if (s.videoUrl)
        out.media.push(item("video", `Video ${i + 1}`, s.videoUrl, proxy(platform, s.videoUrl, name("mp4", i + 1))));
      const u = s.images?.[0]?.url;
      if (u) out.media.push(item("image", `Gambar ${i + 1}`, u, proxy(platform, u, name("jpg", i + 1))));
    });
  }
  return out.media.length ? out : null;
}

const instagram = (G, f) => slidesAdapter("instagram", "Instagram Video", "Instagram Post", G, f);
const threads = (G, f) =>
  slidesAdapter("threads", "Threads Video", (n) => (n > 1 ? "Threads (Carousel)" : "Threads Foto"), G, f, ".threads");
const pinterest = (G, f) => slidesAdapter("pinterest", "Pinterest", "Pinterest", G, f);

function spotify(G, f) {
  if (!G.download) return null;
  const name = makeNamer(f, rid());
  const media = [];
  if (G.cover) media.push(item("image", "Cover", G.cover, null));
  media.push(
    item(
      "audio",
      "Unduh MP3",
      G.download,
      `${BASE}/api/spotify?download=true&url=${enc(G.download)}&filename=${enc(name("mp3"))}`,
    ),
  );
  return {
    kind: "Spotify",
    author: G.artist || null,
    text: [G.name, G.album, G.duration && G.duration !== "0:00" ? G.duration : ""].filter(Boolean).join(" • "),
    info: { title: G.name || null, artist: G.artist || null, album: G.album || null, duration: G.duration || null },
    media,
  };
}

function x(G, f) {
  const tweet = G.tweet || {};
  const au = G.author || {};
  const id = rid();
  const name = makeNamer(f, id);
  const all = tweet.media || [];
  const videos = all.filter((m) => m.type === "video" || m.type === "gif");
  const photos = all.filter((m) => m.type === "photo");
  const media = [];
  let kind = "X";

  if (videos.length) {
    const v = videos[0];
    let best = v.best_url || null;
    let bitrate = 0;
    (v.variants || []).forEach((w) => {
      const b = w.bitrate || 0;
      if (w.url && b > bitrate) {
        bitrate = b;
        best = w.url;
      }
    });
    if (best) {
      kind = "X Video";
      media.push(
        item("video", "Unduh Video MP4", best, proxy("x", best, f ? `${f}.mp4` : `unduhmedia.web.id.${id}.1.mp4`)),
      );
    }
  } else if (photos.length) {
    const seen = new Set();
    photos.forEach((p) => {
      if (!p.url) return;
      const key = p.url.split("?")[0];
      if (seen.has(key)) return;
      seen.add(key);
      const n = seen.size;
      media.push(item("image", `Gambar ${n}`, p.url, proxy("x", p.url, name("jpg", n))));
    });
    kind = "X Foto";
  }
  if (!media.length) return null;
  return { kind, author: user(au.screen_name), text: tweet.text || null, media };
}

function facebook(G, f) {
  const r = G.result || {};
  const c = r.metadata || {};
  const e = r.media || {};
  const main = e.videoUrl || e.videos?.[0]?.url;
  if (!main) return null;
  const id = rid();
  const media = [];
  const list = e.videos?.length ? e.videos : [{ url: main }];
  list.forEach((v, i) => {
    const n = f
      ? list.length > 1
        ? `${f}-${i + 1}.mp4`
        : `${f}.mp4`
      : `unduhmedia.web.id.${id}.${i + 1}.mp4`;
    media.push(item("video", v.label ? `Unduh Video ${v.label}` : "Unduh Video MP4", v.url, proxy("facebook", v.url, n)));
  });
  if (e.audio)
    media.push(
      item("audio", "Unduh MP3", e.audio, proxy("facebook", e.audio, f ? `${f}.mp3` : `unduhmedia.web.id.${id}.mp3`)),
    );
  return { kind: "Facebook Video", author: c.title || null, text: null, media };
}

function soundcloud(G, f) {
  const r = G.result || {};
  const c = r.metadata || {};
  const e = r.author || {};
  const Z = r.media || {};
  const audio = Z.audioUrl || Z.audios?.[0]?.url;
  if (!audio) return null;
  const id = rid();
  const media = [];
  if (Z.thumbnail) media.push(item("image", "Cover", Z.thumbnail, null));
  media.push(
    item(
      "audio",
      "Unduh MP3",
      audio,
      proxy("soundcloud", audio, f ? `${f}.mp3` : `unduhmedia.web.id.soundcloud.${id}.mp3`),
    ),
  );
  const info = [];
  if (c.genre) info.push(c.genre);
  if (c.durationSec) info.push(`${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, "0")}`);
  if (c.playbackCount) info.push(Number(c.playbackCount).toLocaleString("id-ID") + " putar");
  return {
    kind: "SoundCloud",
    author: e.username || e.name || c.artist || null,
    text: info.join(" • ") || null,
    media,
  };
}

const ADAPTERS = { tiktok, instagram, threads, spotify, x, pinterest, facebook, soundcloud };

const MEDIA_KEY = /(video|audio|image|photo|cover|thumbnail|download|src|url)/i;

function collectUrls(node, key = "", out = [], seen = new Set()) {
  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node) && MEDIA_KEY.test(key) && !seen.has(node)) {
      seen.add(node);
      out.push({ key, url: node });
    }
  } else if (Array.isArray(node)) {
    node.forEach((v) => collectUrls(v, key, out, seen));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) collectUrls(v, k, out, seen);
  }
  return out;
}

function fallbackMedia(platform, G, f) {
  const media = collectUrls(G).map((u) => {
    const thumb = /thumbnail|cover|avatar|preview|poster/i.test(u.key);
    const type = thumb
      ? "thumbnail"
      : /audio|download/i.test(u.key) && !/video/i.test(u.key)
        ? "audio"
        : /image|photo/i.test(u.key)
          ? "image"
          : "video";
    const ext = { video: "mp4", audio: "mp3", image: "jpg" }[type];
    return item(
      type,
      u.key,
      u.url,
      thumb ? null : proxy(platform, u.url, f ? `${f}.${ext}` : `unduhmedia.web.id.${rid()}.${ext}`),
    );
  });
  return media.some((m) => m.download_url) ? { kind: platform, author: null, text: null, media } : null;
}

async function unduhmedia(url, opts = {}) {
  if (!url) return { status: false, error: "URL wajib diisi" };

  const platform = String(opts.platform || "").toLowerCase() || detectPlatform(url);
  if (!platform || !ADAPTERS[platform]) {
    return {
      status: false,
      error: "Platform tidak dikenali. Didukung: " + Object.keys(ADAPTERS).join(", "),
    };
  }

  try {
    const r = await axios.get(`${BASE}/api/${platform}`, {
      params: { url },
      timeout: 60000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: BASE + "/",
        Origin: BASE,
      },
    });

    const data = r.data;
    if (r.status === 404) {
      return { status: false, error: "Media tidak ditemukan. Pastikan tautan bersifat publik." };
    }
    if (r.status !== 200 || !data || typeof data !== "object" || !data.status) {
      const msg = typeof data === "object" && data ? data.message || data.error : null;
      return {
        status: false,
        error: "Gagal memproses tautan" + (msg ? ": " + msg : ` (HTTP ${r.status})`),
      };
    }

    const f = opts.filename ? String(opts.filename).replace(/\.(mp4|mp3|jpg|jpeg|png)$/i, "") : null;
    let out = null;
    try {
      out = ADAPTERS[platform](data, f);
    } catch {}
    if (!out) out = fallbackMedia(platform, data, f);
    if (!out || !out.media.length) {
      return { status: false, error: "Tidak ada media yang bisa diunduh dari tautan ini" };
    }

    return { status: true, platform, ...out };
  } catch (err) {
    return { status: false, error: "Gagal mengambil data: " + err.message };
  }
}

export { unduhmedia, detectPlatform };
export default unduhmedia;