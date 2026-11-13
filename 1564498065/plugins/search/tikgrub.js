import fetch from "node-fetch";

const pluginConfig = {
  name: "tikgrub",
  alias: ["tiktokgrub", "carigrup", "tikgrup"],
  category: "search",
  description: "Cari link grup WhatsApp dari TikTok berdasarkan keyword",
  usage: ".tikgrub <keyword>",
  example: ".tikgrub game ff indonesia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  isBotAdmin: false,
  cooldown: 10,
  energi: 0,
  limit: 3,
  isEnabled: true,
};

const WA_REGEX = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/gi;

function extractWALinks(text = "") {
  const matches = text.match(WA_REGEX);
  return matches ? [...new Set(matches)] : [];
}

async function searchTikTokTikwm(keyword) {
  const res = await fetch("https://www.tikwm.com/api/feed/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.tikwm.com/",
    },
    body: new URLSearchParams({
      keywords: keyword,
      count: "30",
      cursor: "0",
      HD: "1",
    }),
    timeout: 15000,
  });

  if (!res.ok) throw new Error(`tikwm error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`tikwm: ${json.msg || "unknown error"}`);
  return json;
}

function parseResults(data) {
  const items = [];
  const list = data?.data?.videos || [];
  for (const v of list) {
    items.push({
      username: v?.author?.unique_id || v?.author?.uniqueId || "unknown",
      nickname: v?.author?.nickname || "",
      bio: v?.author?.signature || "",
      caption: v?.title || v?.desc || "",
      link: v?.play || `https://www.tiktok.com/@${v?.author?.unique_id}/video/${v?.id}`,
      videoUrl: `https://www.tiktok.com/@${v?.author?.unique_id}/video/${v?.id}`,
      likes: v?.digg_count || 0,
    });
  }
  return items;
}

async function handler(m, { sock, config: botConfig, db }) {
  const prefix = botConfig.command?.prefix || ".";
  const body = m.body || "";
  const args = body.trim().slice(prefix.length).trim().split(/\s+/).slice(1);

  if (!args.length || args.join("") === "") {
    return m.reply(
      `❌ Masukkan keyword!\n\nContoh: *${prefix}tikgrub game ff indonesia*`
    );
  }

  const keyword = args.join(" ");
  await m.reply(`🔍 Lagi nyari grup WA dengan keyword *"${keyword}"* di TikTok...\nSabar bentar ya! 🪼`);

  let rawData;
  try {
    rawData = await searchTikTokTikwm(keyword);
  } catch (e) {
    return m.reply(`❌ Gagal ambil data dari TikTok.\n\n> ${e.message}`);
  }

  const items = parseResults(rawData);

  if (!items.length) {
    return m.reply(`😕 Tidak ada hasil untuk keyword *"${keyword}"*.\nCoba keyword yang lebih umum.`);
  }

  const results = [];
  for (const item of items) {
    const allText = `${item.bio} ${item.caption}`;
    const links = extractWALinks(allText);
    if (links.length > 0) {
      results.push({ ...item, waLinks: links });
    }
  }

  if (!results.length) {
    return m.reply(
      `😕 Tidak ketemu link grup WA dari *${items.length}* video TikTok untuk keyword *"${keyword}"*.\n\nCoba tambahkan kata *"grup"* atau *"join wa"* di keyword.`
    );
  }

  let txt = `╭─「 🔍 HASIL CARI GRUP WA 」\n`;
  txt += `│ • Keyword  : ${keyword}\n`;
  txt += `│ • Video    : ${items.length} hasil\n`;
  txt += `│ • Ditemukan: ${results.length} akun\n`;
  txt += `╰──\n\n`;

  let no = 1;
  for (const r of results) {
    txt += `╭─「 ${no}. @${r.username} 」\n`;
    if (r.nickname) txt += `│ 👤 ${r.nickname}\n`;
    if (r.bio) txt += `│ 📝 ${r.bio.slice(0, 80)}${r.bio.length > 80 ? "..." : ""}\n`;
    txt += `│ 🎬 ${r.videoUrl}\n`;
    txt += `│\n`;
    txt += `│ 🔗 Link Grup WA:\n`;
    for (const link of r.waLinks) {
      txt += `│   ↳ ${link}\n`;
    }
    txt += `╰──\n\n`;
    no++;
  }

  txt += `✦ © ${botConfig.bot?.name || "lyniX's MD"} — TikGrub`;

  const saluranLink = botConfig.saluran?.link || "";

  const contextInfo = {
    externalAdReply: {
      title: `🔍 TikGrub — ${keyword}`,
      body: `${results.length} grup WA ditemukan dari TikTok`,
      sourceUrl: saluranLink,
      mediaType: 1,
      renderLargerThumbnail: false,
    },
  };

  try {
    await sock.sendMessage(m.chat, { text: txt }, { quoted: m });
  } catch (e) {
    console.error("Send error:", e);
    await m.reply(txt);
  }
}

export { pluginConfig as config, handler };