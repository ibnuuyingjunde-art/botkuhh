import axios from "axios";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { sharp as _sharp } from "../../src/lib/ichigo-lazy.js";
import { addExifToWebp, isValidWebp, isAnimatedWebp } from "../../src/lib/ichigo-exif.js";

const pluginConfig = {
  name: "tiktokstiker",
  alias: ["ttstiker", "ttsticker", "tiktoksticker", "stikertt"],
  category: "downloader",
  description: "Ambil stiker dari komentar video TikTok lalu kirim sebagai sticker pack (via API Cloud)",
  usage: ".tiktokstiker <url_tiktok> [jumlah 1-20]",
  example: ".tiktokstiker https://vt.tiktok.com/ZSbFpJ7mT/ 10",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 3,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/downloader/tiktokstiker";
const PAGES = 3;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const REQUEST_TIMEOUT = 120000;
const DOWNLOAD_TIMEOUT = 20000;
const DOWNLOAD_BATCH = 5;
const SEND_DELAY = 600;
const PACK_TARGET_BYTES = 500 * 1024;
const PACK_MAX_BYTES = 1024 * 1024 - 1024;
const PACK_QUALITIES = [80, 60, 40, 25];

const TIKTOK_URL = /https?:\/\/(?:[\w-]+\.)?tiktok\.com\/\S+/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(prefix, command) {
  return (
    `*ᴛɪᴋᴛᴏᴋ ꜱᴛɪᴋᴇʀ*\n\n` +
    `> Ambil stiker yang dipakai orang di kolom komentar video TikTok\n\n` +
    `\`${prefix}${command} <url_tiktok>\`\n` +
    `\`${prefix}${command} <url_tiktok> <jumlah>\`\n\n` +
    `> Jumlah: 1 sampai ${MAX_LIMIT} (default ${DEFAULT_LIMIT})\n` +
    `> Bisa juga reply pesan yang berisi link TikTok\n\n` +
    `Contoh: \`${prefix}${command} https://vt.tiktok.com/ZSbFpJ7mT/ 10\``
  );
}

function parseInput(m) {
  const input = String(m.text || "").trim();
  const quotedText = (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption)) || "";

  const link = (input.match(TIKTOK_URL) || quotedText.match(TIKTOK_URL) || [])[0] || null;
  const rest = input.replace(TIKTOK_URL, " ");
  const num = rest.match(/(?:^|\s)(\d{1,3})(?=\s|$)/);
  const wanted = num ? Number(num[1]) : DEFAULT_LIMIT;
  const limit = Math.min(Math.max(wanted, 1), MAX_LIMIT);

  return { link, limit };
}

function pickStickerUrl(s) {
  const st = s?.sticker;
  if (!st) return null;
  if (st.is_animated) return st.animated_url || st.sticker_url || st.static_url || null;
  return st.static_url || st.sticker_url || st.animated_url || null;
}

function collectStickers(stickers, limit) {
  const seen = new Set();
  const out = [];
  for (const s of stickers || []) {
    const url = pickStickerUrl(s);
    if (!url) continue;
    const key = s.sticker?.sticker_id || url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, animated: !!s.sticker?.is_animated });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchStickers(link, limit) {
  const res = await axios.get(API_URL, {
    params: { url: link, pages: PAGES, limit },
    timeout: REQUEST_TIMEOUT,
    maxContentLength: Infinity,
    validateStatus: () => true,
  });

  const data = res.data;
  if (res.status !== 200 || !data || data.status !== true || !data.result) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return data.result;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: DOWNLOAD_TIMEOUT,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return Buffer.from(res.data);
}

async function toWebp(buffer) {
  if (isValidWebp(buffer)) return buffer;
  try {
    const sharp = await _sharp;
    return await sharp(buffer, { animated: true })
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function toPackSticker(buffer) {
  try {
    const sharp = await _sharp;
    const animated = await isAnimatedWebp(buffer);
    let best = null;
    for (const quality of PACK_QUALITIES) {
      const out = await sharp(buffer, { animated })
        .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality })
        .toBuffer();
      if (!best || out.length < best.length) best = out;
      if (out.length <= PACK_TARGET_BYTES) break;
    }
    return best.length <= PACK_MAX_BYTES ? best : null;
  } catch {
    return buffer.length <= PACK_MAX_BYTES ? buffer : null;
  }
}

async function downloadAll(items) {
  const buffers = [];
  for (let i = 0; i < items.length; i += DOWNLOAD_BATCH) {
    const batch = items.slice(i, i + DOWNLOAD_BATCH);
    const done = await Promise.all(
      batch.map(async (item) => {
        try {
          const raw = await downloadBuffer(item.url);
          if (!raw.length) return null;
          return await toWebp(raw);
        } catch {
          return null;
        }
      })
    );
    buffers.push(...done.filter(Boolean));
  }
  return buffers;
}

async function sendOneByOne(sock, m, buffers, packname, author) {
  let sent = 0;
  for (const buf of buffers) {
    try {
      let withExif = buf;
      try {
        withExif = await addExifToWebp(buf, { packname, author, emojis: ["😀"] });
      } catch {}
      await sock.sendMessage(m.chat, { sticker: withExif }, { quoted: m });
      sent++;
      await sleep(SEND_DELAY);
    } catch {
      continue;
    }
  }
  return sent;
}

async function handler(m, { sock }) {
  const { link, limit } = parseInput(m);
  if (!link) return m.reply(usage(m.prefix, m.command));

  try {
    const result = await fetchStickers(link, limit);
    const items = collectStickers(result.stickers, limit);
    const stats = result.statistics || {};
    const video = result.video || {};

    if (!items.length) {
      return m.reply(
        `*ᴛɪᴋᴛᴏᴋ ꜱᴛɪᴋᴇʀ*\n\n` +
          `> Tidak ada stiker di komentar video ini\n` +
          `> Komentar dipindai: ${stats.comments_scanned ?? 0}`
      );
    }

    await m.reply(
      `*ᴛɪᴋᴛᴏᴋ ꜱᴛɪᴋᴇʀ*\n\n` +
        (video.author ? `> Video: @${video.author}\n` : "") +
        `> Komentar dipindai: ${stats.comments_scanned ?? "-"}\n` +
        `> Stiker ditemukan: ${items.length}\n` +
        (result.partial ? `> Hasil sebagian, sebagian komentar belum terpindai\n` : "") +
        `\nMengunduh stiker...`
    );

    const buffers = await downloadAll(items);
    if (!buffers.length) return m.reply("Gagal mengunduh stiker. Coba lagi nanti.");

    const packname = video.author ? `TikTok @${video.author}` : "TikTok Stiker";
    const author = config.bot?.developer || config.sticker?.author || "Bot";

    if (buffers.length === 1) {
      await sendOneByOne(sock, m, buffers, packname, author);
      return;
    }

    try {
      const converted = await Promise.all(buffers.map(toPackSticker));
      const packBuffers = converted.filter(Boolean);
      const tooBig = buffers.filter((_, i) => !converted[i]);
      if (packBuffers.length < 2) throw new Error("stiker terlalu besar untuk dijadikan pack");
      await sock.sendStickerPack(m.chat, packBuffers, m, {
        name: packname,
        packname,
        publisher: author,
        author,
        description: `Stiker dari komentar video TikTok${video.author ? ` @${video.author}` : ""}`,
        emojis: ["😀"],
      });
      if (tooBig.length) await sendOneByOne(sock, m, tooBig, packname, author);
    } catch (packErr) {
      console.error("[tiktokstiker] pack gagal:", packErr.message);
      const sent = await sendOneByOne(sock, m, buffers, packname, author);
      if (!sent) return m.reply("Gagal mengirim stiker.");
    }
  } catch (error) {
    console.error("[tiktokstiker error]", error.message);

    if (error.httpStatus === 400) return m.reply(`Input tidak valid: ${error.message}`);
    if (error.httpStatus === 429) return m.reply("Layanan sedang penuh atau kena batas. Coba lagi nanti.");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };