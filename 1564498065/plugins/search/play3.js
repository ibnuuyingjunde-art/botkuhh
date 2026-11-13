import ytSearch, { ytSearchVideo } from "../../src/scraper/ytsearch-safe.js";
import axios from "axios";
import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";
import { ytdl3 } from "../../src/scraper/ytdl3.js";
import mediaDownloader, { fetchMediaBuffer } from "../../src/scraper/mediadl.js";
import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "play3",
  alias: ["play3dl"],
  category: "search",
  description: "Cari & download lagu YouTube pakai kartu interaktif A2UI + quick-reply",
  usage: ".play3 <judul lagu>",
  example: ".play3 komang",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const DEFAULT_VIDEO_QUALITY = "480";

function toSmallCaps(text) {
  const smallCaps = {
    a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ",
    k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "s", t: "ᴛ",
    u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
  };
  return text
    .toLowerCase()
    .split("")
    .map((c) => smallCaps[c] || c)
    .join("");
}

const isValidVideoId = (id) => /^[a-zA-Z0-9_-]{10,12}$/.test(id);

const FETCH_TIMEOUT_MS = 90_000;
const MIN_SIZE = { mp3: 20_000, mp4: 100_000 };

/**
 * Link dari SaveTube TIDAK boleh dikirim mentah ke WhatsApp: kalau link belum
 * siap / expired / balasan error (HTML/JSON), WA tetap menerimanya sebagai
 * "audio 0.00" atau "video 52 kB" yang rusak. Jadi download dulu jadi buffer,
 * validasi content-type + ukuran, baru kirim. Kalau gagal, minta link BARU.
 */
async function fetchBuffer(url, format, headers = {}) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: FETCH_TIMEOUT_MS,
    maxContentLength: 100 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0", ...headers },
  });
  const ct = String(res.headers["content-type"] || "").toLowerCase();
  const buffer = Buffer.from(res.data);
  const okType = /audio|video|octet-stream|mpeg|mp4/.test(ct);
  if (!okType) {
    console.error("[PLAY3DL] bukan media, content-type:", ct, "| body:", buffer.toString("utf8", 0, 200));
    throw new Error(`Response bukan file media (${ct || "unknown"})`);
  }
  if (buffer.length < MIN_SIZE[format]) {
    console.error("[PLAY3DL] file terlalu kecil:", buffer.length, "bytes");
    throw new Error("File kosong/terlalu kecil, link belum siap.");
  }
  return buffer;
}

// Handler REST api-cloud /download/ytmp4: quality 360p/480p/720p/1080p, dl=1 = stream file MP4.
// Kalau konversi belum selesai dalam ~50 detik, balasannya 202 "pending" -> panggil ulang URL yang sama.
const YTMP4_API = "https://api-cloud.my.id/download/ytmp4";

async function viaApiCloud(url, format) {
  if (format !== "mp4") throw new Error("api-cloud hanya untuk mp4");
  const link = `${YTMP4_API}?url=${encodeURIComponent(url)}&quality=${DEFAULT_VIDEO_QUALITY}p&dl=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await axios.get(link, {
      responseType: "arraybuffer",
      timeout: 70_000,
      maxContentLength: 100 * 1024 * 1024,
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.status === 202) continue; // job masih jalan di server, tunggu lagi
    const ct = String(res.headers["content-type"] || "").toLowerCase();
    const buffer = Buffer.from(res.data);
    if (res.status !== 200 || !/video|octet-stream|mp4/.test(ct)) {
      console.error("[PLAY3DL] api-cloud respons:", res.status, ct, buffer.toString("utf8", 0, 200));
      throw new Error(`api-cloud membalas HTTP ${res.status}`);
    }
    if (buffer.length < MIN_SIZE.mp4) throw new Error("api-cloud: file terlalu kecil");
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(String(res.headers["content-disposition"] || ""))?.[1];
    return { title: name ? decodeURIComponent(name).replace(/\.mp4$/i, "") : null, buffer };
  }
  throw new Error("api-cloud: konversi belum selesai");
}

async function viaYtdl3(url, format) {
  const r = await ytdl3(url, format === "mp4" ? DEFAULT_VIDEO_QUALITY : "mp3");
  if (!r?.status || !r?.download) throw new Error(r?.error || "ytdl3 gagal");
  return { title: r.title, buffer: await fetchBuffer(r.download, format) };
}

async function viaYtdl2(url, format) {
  const r = await ytdl2(url, format === "mp4" ? DEFAULT_VIDEO_QUALITY : "mp3");
  if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
  // yt-dlp lokal -> file di disk (sudah valid); sumber cadangan -> link yang harus divalidasi dulu.
  const buffer = r.file
    ? await readResultBuffer(r, { minBytes: MIN_SIZE[format] })
    : await fetchBuffer(r.download, format, r.headers || {});
  return { title: r.title, buffer };
}

async function viaMediadl(url, format) {
  const r = await mediaDownloader(url);
  const want = format === "mp4" ? "video" : "audio";
  const dl = r.downloads.find((d) => d.type === want);
  if (!dl) throw new Error(`mediadl: tidak ada link ${want}`);
  const buffer = await fetchMediaBuffer(dl.url);
  if (buffer.length < MIN_SIZE[format]) throw new Error("mediadl: file terlalu kecil");
  return { title: r.title, buffer };
}

// Urutan sumber: tiap sumber di-download + divalidasi; kalau gagal lanjut ke sumber berikutnya.
// ytdl2 (yt-dlp lokal, sudah punya cadangan sendiri) di depan, sisanya jadi cadangan.
async function getMediaWithFreshLink(url, format) {
  const providers = [
    ["ytdl2", viaYtdl2],
    ...(format === "mp4" ? [["api-cloud", viaApiCloud]] : []),
    ["ytdl3", viaYtdl3],
    ["mediadl", viaMediadl],
  ];
  let lastErr;
  for (const [name, run] of providers) {
    try {
      return await run(url, format);
    } catch (err) {
      lastErr = err;
      console.error(`[PLAY3DL] sumber ${name} gagal:`, err.message);
    }
  }
  throw lastErr;
}

async function handleDownload(m, sock, url, format) {
  await m.react("🕕");
  try {
    const { title, buffer } = await getMediaWithFreshLink(url, format);
    if (format === "mp4") {
      await sock.sendMedia(m.chat, buffer, null, m, {
        type: "video",
        mimetype: "video/mp4",
        fileName: `${title || "video"}.mp4`,
      });
    } else {
      await sock.sendMedia(m.chat, buffer, null, m, {
        type: "audio",
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${title || "audio"}.mp3`,
      });
    }

    await m.react("✅");
  } catch (e) {
    console.error("[PLAY3DL]", e);
    await m.react("☢");

    if (e?.message === "TIMEOUT") {
      m.reply(
        "⏰ *Server YouTube lagi lemot/timeout.*\n" +
          "Udah dicoba ulang otomatis tapi tetap gagal. Coba lagi beberapa saat lagi ya."
      );
    } else {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

async function handleSearch(m, sock, query) {
  await m.react("🕕");
  try {
    const search = await ytSearch(query);
    if (!search?.videos?.length) {
      await m.react("☢");
      return m.reply("❌ *Lagu tidak ditemukan di YouTube.*");
    }
    const video = search.videos[0];
    const prefix = m.prefix || ".";

    const ui = new A2UI();
    const thumb = ui.image(video.thumbnail, { variant: "header", fit: "contain" });
    const title = ui.text(video.title, { variant: "h1" });
    const info = ui.text(`${video.author.name} ✦ ${video.duration.timestamp}`, { variant: "caption" });
    const card = ui.card(ui.column([thumb, title, info]));

    ui.root([card]);

    const viewsFmt = video.views ? video.views.toLocaleString("en-US") : "N/A";
    const uploadedAgo = video.ago || "N/A";
    const footerLines = [
      `✦ ${toSmallCaps("author".padEnd(8))} : ${video.author.name}`,
      `✦ ${toSmallCaps("duration".padEnd(8))} : ${video.duration.timestamp}`,
      `✦ ${toSmallCaps("views".padEnd(8))} : ${viewsFmt}`,
      `✦ ${toSmallCaps("uploaded".padEnd(8))} : ${toSmallCaps(uploadedAgo)}`,
    ];
    const border = "─".repeat(8);
    const footerText = [
      `╭⌬${border}⌬`,
      ...footerLines.map((l) => `│ ${l}`),
      `╰⌬${border}⌬`,
    ].join("\n");

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      bodyText: video.title,
      footer: footerText,
      buttons: [
        {
          name: "quick_reply",
          params: {
            display_text: "🎧 Download MP3",
            id: `${prefix}play3dl mp3 ${video.videoId}`,
          },
        },
        {
          name: "quick_reply",
          params: {
            display_text: "🎬 Download Video",
            id: `${prefix}play3dl mp4 ${video.videoId}`,
          },
        },
      ],
      contextInfo: { expiration: 7776000 },
    });

    await m.react("✅");
  } catch (e) {
    console.error("[PLAY3]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

async function handler(m, { sock }) {
  const isDownloadStep = m.command === "play3dl";
  const rawArg = m.args.join(" ").trim();

  if (isDownloadStep) {
    let format = "mp3";
    let arg = rawArg;
    const firstWord = rawArg.split(" ")[0]?.toLowerCase();
    if (firstWord === "mp3" || firstWord === "mp4") {
      format = firstWord;
      arg = rawArg.slice(firstWord.length).trim();
    }

    if (!arg || !isValidVideoId(arg)) {
      return m.reply("❌ ID video YouTube tidak valid.");
    }
    const videoUrl = `https://youtube.com/watch?v=${arg}`;
    return handleDownload(m, sock, videoUrl, format);
  }

  if (!rawArg) {
    return m.reply(
      `🎵 *Play3*\n\n` +
        `> Cari & download lagu YouTube pakai kartu interaktif\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}play3 <judul lagu>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}play3 komang*`
    );
  }

  return handleSearch(m, sock, rawArg);
}

export { pluginConfig as config, handler };