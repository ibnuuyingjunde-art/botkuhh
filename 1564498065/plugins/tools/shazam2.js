/**
 * Shazam (api-cloud.my.id)
 *  .shazam2                    → reply audio/video/VN: kenali lagu (recognize)
 *  .shazam2 <offset> <detik>   → atur mulai & panjang sampel (default 0 & 12)
 *  .shazam2 search <judul>     → cari lagu (search)
 *  .shazam2 track <id>         → detail lagu + lirik (track)
 */
import te from "../../src/lib/ichigo-error.js";
import { uploadImage } from "../../src/lib/ichigo-uploader.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const pluginConfig = {
  name: "shazam2",
  alias: ["shz", "shazamcloud", "kenallagu"],
  category: "tools",
  description: "Kenali lagu dari audio/video, cari lagu, dan lihat detail + lirik (Shazam)",
  usage: ".shazam2 (reply audio) | .shazam2 search <judul> | .shazam2 track <id>",
  example: ".shazam2 search nina feast",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/tools/shazam";
const MAX_LYRICS = 3000;
const MAX_BYTES = 30 * 1024 * 1024;
const MEDIA_TYPES = /audio|video|ptt|document/i;

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const show = (v) => clean(v) || "-";

async function callApi(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(90000),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok || !data || data.status === false) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.notFound = res.status === 404 || /not found|tidak ditemukan|no match/i.test(String(msg));
    throw err;
  }
  const result = data.result ?? null;
  if (Array.isArray(result) && data.total != null) result.total = data.total;
  return result;
}

// "spotify:search:Judul%20Artis" bukan link yang bisa dibuka → ubah ke https
function spotifyLink(uri) {
  const v = clean(uri);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const m = v.match(/^spotify:search:(.+)$/i);
  if (m) return `https://open.spotify.com/search/${m[1]}`;
  const t = v.match(/^spotify:track:(.+)$/i);
  if (t) return `https://open.spotify.com/track/${t[1]}`;
  return null;
}

// Link Apple dari API bisa berupa "intent://...#Intent;scheme=http;...;end" (versi Android)
// yang tidak bisa dibuka sebagai tombol URL → ubah ke https, buang fragment & parameter
// pelacakan (mttn*, itscg, itsct, app, dll), sisakan `i` (ID lagu).
function cleanAppleUrl(u) {
  const raw = clean(u);
  if (!raw) return null;
  try {
    const url = new URL(raw.replace(/^intent:\/\//i, "https://"));
    const i = url.searchParams.get("i");
    url.search = i ? `?i=${i}` : "";
    url.hash = "";
    return url.toString();
  } catch {
    return /^https?:\/\//i.test(raw) ? raw : null;
  }
}

function trackText(r) {
  const lines = [
    `🎵 *${show(r.title)}*`,
    `> 👤 ${show(r.artist)}`,
    ``,
    `💿 Album   : ${show(r.album)}`,
    `🏷️ Label   : ${show(r.label)}`,
    `📅 Rilis   : ${show(r.release_year)}`,
    `🎼 Genre   : ${show(r.genres)}`,
    `🆔 ID      : ${show(r.id)}`,
    `📝 Lirik   : ${r.has_lyrics ? "Tersedia" : "Tidak ada"}`,
  ];
  return lines.join("\n");
}

function buttonsFor(r) {
  const out = [];
  const add = (text, url) =>
    url && out.push({ name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: text, url }) });
  add("🔎 Shazam", r.share_url);
  add("🍎 Apple Music", cleanAppleUrl(r.apple_music_url));
  add("🎧 Spotify", spotifyLink(r.spotify_url));
  return out;
}

async function sendTrack(m, sock, r, footer) {
  const content = {
    caption: trackText(r),
    footer,
    contextInfo: saluranCtx(),
  };
  const buttons = buttonsFor(r);
  if (buttons.length) content.interactiveButtons = buttons;

  if (r.cover) {
    await sock.sendMessage(m.chat, { image: { url: r.cover }, ...content }, { quoted: m });
  } else {
    content.text = content.caption;
    delete content.caption;
    await sock.sendMessage(m.chat, content, { quoted: m });
  }

  if (r.has_lyrics && r.lyrics) {
    let lyrics = String(r.lyrics).trim();
    if (lyrics.length > MAX_LYRICS) lyrics = lyrics.slice(0, MAX_LYRICS).trimEnd() + "\n…";
    await m.reply(`📝 *ʟɪʀɪᴋ* — ${show(r.title)}\n\n${lyrics}`);
  }
}

function findMedia(m) {
  const candidates = [m, m.quoted].filter(Boolean);
  for (const c of candidates) {
    const type = String(c.type || c.mtype || "");
    if (MEDIA_TYPES.test(type) || (c.isMedia && !/image|sticker/i.test(type))) return c;
  }
  return null;
}

async function doRecognize(m, sock, args) {
  const target = findMedia(m);
  if (!target) {
    return m.reply(
      `🎵 *sʜᴀᴢᴀᴍ*\n\n` +
        `> Reply audio / video / voice note dengan \`${m.prefix}${m.command}\`\n\n` +
        `*Opsi:*\n` +
        `> \`${m.prefix}${m.command} <mulai> <detik>\` — contoh \`${m.prefix}${m.command} 10 15\`\n` +
        `> \`${m.prefix}${m.command} search <judul>\` — cari lagu\n` +
        `> \`${m.prefix}${m.command} track <id>\` — detail + lirik`,
    );
  }

  const offset = Math.max(0, parseInt(args[0]) || 0);
  const seconds = Math.min(30, Math.max(3, parseInt(args[1]) || 12));

  await m.react("🕕");

  const buffer = await target.download();
  if (!buffer?.length) {
    await m.react("❌");
    return m.reply("❌ Gagal mengunduh media, coba kirim ulang audionya.");
  }
  if (buffer.length > MAX_BYTES) {
    await m.react("❌");
    return m.reply(`❌ File terlalu besar (maks ${MAX_BYTES / 1024 / 1024} MB).`);
  }

  const ext = /video/i.test(String(target.type)) ? "mp4" : "mp3";
  const url = await uploadImage(buffer, `shazam.${ext}`);

  let result;
  try {
    result = await callApi({ action: "recognize", url, offset, seconds });
  } catch (e) {
    await m.react("❌");
    if (e.notFound) {
      return m.reply(
        `❌ *ʟᴀɢᴜ ᴛɪᴅᴀᴋ ᴅɪᴋᴇɴᴀʟɪ*\n\n` +
          `> Coba bagian lain yang musiknya lebih jelas:\n` +
          `> \`${m.prefix}${m.command} 20 15\` (mulai detik 20, 15 detik)`,
      );
    }
    throw e;
  }
  if (!result) {
    await m.react("❌");
    return m.reply("❌ Lagu tidak dikenali.");
  }

  await sendTrack(m, sock, result, `Shazam • sampel ${seconds}s dari detik ${offset}`);
  await m.react("✅");
}

async function doSearch(m, sock, query) {
  if (!query) {
    return m.reply(`❌ Masukkan judul lagu.\n\n> Contoh: \`${m.prefix}${m.command} search nina feast\``);
  }
  await m.react("🕕");

  // nama parameter pencarian tidak terdokumentasi → kirim beberapa alias umum
  const result = await callApi({ action: "search", q: query, query, text: query });
  const list = Array.isArray(result) ? result : result?.result || [];

  if (!list.length) {
    await m.react("❌");
    return m.reply(`❌ Tidak ada hasil untuk *${clean(query)}*.`);
  }

  const items = list.slice(0, 10);
  const lines = items.map((t, i) => {
    const dur = t.duration_formatted ? ` · ${t.duration_formatted}` : "";
    const year = t.release_date ? ` · ${String(t.release_date).slice(0, 4)}` : "";
    const genre = t.genre ? ` · ${clean(t.genre)}` : "";
    // shazam_id bisa null (lagu hanya ada di Apple Music) → tampilkan link-nya saja
    const id = t.shazam_id ? `🆔 \`${t.shazam_id}\`` : "🆔 -";
    const link = t.apple_music_url ? `\n> 🍎 ${t.apple_music_url}` : "";
    return (
      `*${i + 1}. ${show(t.title)}*\n` +
      `> 👤 ${show(t.artist)}\n` +
      `> 💿 ${show(t.album)}${year}${dur}${genre}\n` +
      `> ${id}${link}`
    );
  });

  const hasId = items.some((t) => t.shazam_id);
  const text =
    `🔍 *ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ* — ${clean(query)}\n\n` +
    lines.join("\n\n") +
    (hasId ? `\n\n> Detail + lirik: \`${m.prefix}${m.command} track <id>\`` : "");
  const footer = `Shazam • ${items.length} dari ${result?.total ?? list.length} hasil`;

  const cover = items[0]?.cover;
  const payload = cover
    ? { image: { url: cover }, caption: text, footer, contextInfo: saluranCtx() }
    : { text, footer, contextInfo: saluranCtx() };
  await sock.sendMessage(m.chat, payload, { quoted: m });

  await m.react("✅");
}

async function doTrack(m, sock, id) {
  if (!/^\d+$/.test(id || "")) {
    return m.reply(`❌ Masukkan ID Shazam (angka).\n\n> Contoh: \`${m.prefix}${m.command} track 40333609\``);
  }
  await m.react("🕕");

  const result = await callApi({ action: "track", id, shazam_id: id, track_id: id });
  if (!result) {
    await m.react("❌");
    return m.reply("❌ Lagu tidak ditemukan.");
  }

  await sendTrack(m, sock, result, "Shazam • detail lagu");
  await m.react("✅");
}

async function handler(m, { sock }) {
  try {
    const parts = clean(m.text).split(" ").filter(Boolean);
    const sub = (parts[0] || "").toLowerCase();
    const rest = parts.slice(1);

    if (["search", "cari", "s"].includes(sub)) return await doSearch(m, sock, rest.join(" "));
    if (["track", "detail", "info", "lirik"].includes(sub)) return await doTrack(m, sock, rest[0]);

    // angka saja → offset/detik; teks biasa tanpa media → anggap pencarian
    const numeric = parts.every((p) => /^\d+$/.test(p));
    if (parts.length && !numeric && !findMedia(m)) return await doSearch(m, sock, parts.join(" "));

    return await doRecognize(m, sock, parts);
  } catch (error) {
    console.error("[shazam2]", error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };