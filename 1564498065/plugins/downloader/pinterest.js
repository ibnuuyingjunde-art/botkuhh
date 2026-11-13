import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

export const config_plugin = {
  name:        "pinterest",
  alias:       ["pindown", "pinsearch", "pin"],
  category:    "downloader",
  description: "Download atau search gambar dari Pinterest",
  usage:       ".pinterest <url | kata kunci>",
  example:     ".pinterest anime\n.pinterest https://pin.it/xxx",
  cooldown:    5,
  energi:      0,
  isOwner:     false,
  isEnabled:   true,
};

function isPinterestUrl(input) {
  return input.includes("pinterest.com") || input.includes("pin.it");
}

async function downloadPin(url) {
  const { data } = await axios.get(
    "https://api.nexray.eu.cc/downloader/pinterest",
    { params: { url }, timeout: 15000 },
  );
  if (!data?.status || !data?.result) throw new Error("API gagal.");
  const r = data.result;
  return {
    imageUrl: r.image || r.thumbnail,
    title:    r.title  || "-",
    author:   r.author || "Unknown",
  };
}

async function searchPin(q) {
  const { data } = await axios.get(
    "https://api.nexray.eu.cc/search/pinterest",
    { params: { q }, timeout: 15000 },
  );
  if (!data?.status || !Array.isArray(data?.result) || data.result.length === 0) {
    throw new Error("Tidak ada hasil ditemukan.");
  }

  const pool = data.result.slice(0, 5);
  const r    = pool[Math.floor(Math.random() * pool.length)];

  return {
    imageUrl: r.images_url,
    title:    r.grid_title || r.description?.trim() || r.seo_alt_text || "-",
    author:   r.pinner?.full_name || r.pinner?.username || "Unknown",
    board:    r.board?.name || "-",
    likes:    r.reaction_counts?.["1"] || 0,
    pinUrl:   r.pin || "",
  };
}

async function toBuffer(imgUrl) {
  const res = await axios.get(imgUrl, {
    responseType: "arraybuffer",
    timeout: 15000,
  });
  return Buffer.from(res.data);
}

async function handler(m, { sock }) {
  const input = (
    (Array.isArray(m.args) && m.args.length > 0 ? m.args.join(" ") : null) ||
    m.fullArgs?.trim() ||
    m.text?.trim() ||
    ""
  ).trim();

  if (!input) {
    return m.reply(
      `╭─ 🖼️ *PINTEREST*\n` +
      `│  · Download: \`${m.prefix}pin https://pin.it/xxx\`\n` +
      `│  · Search: \`${m.prefix}pin anime\`\n` +
      `╰───────────────────────────`,
    );
  }

  await m.react("⏳");

  try {
    const isUrl = isPinterestUrl(input);
    const data  = isUrl
      ? await downloadPin(input)
      : await searchPin(input);

    if (!data.imageUrl) throw new Error("Tidak ada gambar ditemukan.");

    const buffer = await toBuffer(data.imageUrl);

    let caption = `╭─ 🖼️ *Pinterest ${isUrl ? "Downloader" : "Search"}*\n`;
    caption += `│  · Judul: ${data.title}\n`;
    caption += `│  · Author: ${data.author}\n`;
    if (!isUrl && data.board) caption += `│  · Board: ${data.board}\n`;
    if (!isUrl && data.likes) caption += `│  · Likes: ${data.likes.toLocaleString()}\n`;
    if (!isUrl && data.pinUrl) caption += `│  · Link: ${data.pinUrl}\n`;
    caption += `╰───────────────────────────`;

    await sock.sendMessage(
      m.chat,
      { image: buffer, caption },
      { quoted: m },
    );

    await m.react("✅");

  } catch (err) {
    console.error("[PIN ERROR]", err);
    await m.react("❌");

    const e = String(err.message || err).toLowerCase();
    if (e.includes("timeout"))   return m.reply("❌ *Timeout!* Coba lagi.");
    if (e.includes("tidak ada")) return m.reply("❌ *Tidak ditemukan!* Coba kata kunci lain.");
    if (e.includes("not found")) return m.reply("❌ *Tidak ditemukan!* Coba kata kunci lain.");

    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config_plugin as config, handler };