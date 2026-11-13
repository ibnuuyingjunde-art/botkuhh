import fetch from "node-fetch";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "pixiv",
  alias: ["pxiv", "pixivsearch", "searchpixiv"],
  category: "search",
  description: "Cari ilustrasi dari Pixiv berdasarkan keyword",
  usage: ".pixiv <keyword>",
  example: ".pixiv hatsune miku",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_URL = "https://api.azbry.com/api/search/pixiv";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://www.pixiv.net/",
  "Accept": "application/json, image/*, */*",
};

function formatTanggal(isoStr) {
  try {
    return new Date(isoStr).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

async function handler(m, { sock }) {
  const keyword = m.text?.trim();

  if (!keyword) {
    return m.reply(
      `🎨 *PIXIV SEARCH*\n\n` +
        `Cari ilustrasi dari Pixiv.\n\n` +
        `Gunakan: ${m.prefix}pixiv <keyword>\n\n` +
        `Contoh:\n` +
        `${m.prefix}pixiv hatsune miku\n` +
        `${m.prefix}pixiv rem re:zero\n` +
        `${m.prefix}pixiv naruto`,
    );
  }

  await m.react("🕕");

  try {
    
    const res = await fetch(`${API_URL}?q=${encodeURIComponent(keyword)}`, {
      headers: HEADERS,
      timeout: 15000,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (!data.status || !data.result || data.result.length === 0) {
      await m.react("❌");
      return m.reply(
        `❌ Tidak ditemukan hasil untuk keyword *${keyword}*\n\n` +
        `Coba keyword lain, contoh:\n` +
        `${m.prefix}pixiv naruto\n` +
        `${m.prefix}pixiv anime girl`,
      );
    }

    const results = data.result;
    const total = data.total || results.length;
    const limit = Math.min(5, results.length);

    const saluranId = config.saluran?.id || "120363409557700746@newsletter";
    const saluranName = config.saluran?.name || config.bot?.name || "lyniX's MD";
    const saluranLink = config.saluran?.link || "";

    let infoTxt = `🎨 *PIXIV SEARCH*\n`;
    infoTxt += `🔍 Keyword: *${keyword}*\n`;
    infoTxt += `📊 Total: *${total} hasil* — Menampilkan ${limit}\n`;
    infoTxt += `🌐 Sumber: pixiv.net\n\n`;

    for (let i = 0; i < limit; i++) {
      const p = results[i];
      const tags = p.tags?.slice(0, 5).join(", ") || "-";
      const tgl = formatTanggal(p.createDate);
      infoTxt += `*[${i + 1}] ${p.title || "Untitled"}*\n`;
      infoTxt += `👤 ${p.userName}\n`;
      infoTxt += `🏷️ ${tags}\n`;
      infoTxt += `📐 ${p.width}x${p.height} • ${p.pageCount} hal\n`;
      infoTxt += `📅 ${tgl}\n`;
      infoTxt += `🔗 pixiv.net/artworks/${p.id}\n\n`;
    }

    await sock.sendMessage(
      m.chat,
      {
        text: infoTxt,
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 9999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127,
          },
          externalAdReply: {
            title: `🎨 Pixiv — ${keyword}`,
            body: `${total} hasil ditemukan`,
            sourceUrl: saluranLink,
            mediaType: 1,
            renderLargerThumbnail: false,
          },
        },
      },
      { quoted: m },
    );

    await m.react("✅");

    for (let i = 0; i < limit; i++) {
      const p = results[i];
      if (!p.image) continue;

      try {
        const imgRes = await fetch(p.image, {
          headers: HEADERS,
          timeout: 20000,
        });

        if (!imgRes.ok) continue;

        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
        if (imgBuf.length < 1000) continue; 

        const caption =
          `🎨 *[${i + 1}/${limit}] ${p.title || "Untitled"}*\n` +
          `👤 ${p.userName}\n` +
          `🏷️ ${p.tags?.slice(0, 3).join(", ") || "-"}\n` +
          `🔗 pixiv.net/artworks/${p.id}`;

        await sock.sendMessage(
          m.chat,
          { image: imgBuf, caption },
          { quoted: m },
        );

        if (i < limit - 1) await new Promise(r => setTimeout(r, 1500));
      } catch {
        
      }
    }
  } catch (error) {
    await m.react("❌");
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };