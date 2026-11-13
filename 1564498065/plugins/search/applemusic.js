import axios from "axios";

const pluginConfig = {
  name: "applemusic",
  alias: ["amusic", "itunes", "itunesearch"],
  category: "search",
  description: "Cari lagu/album/artist di Apple Music",
  usage: ".applemusic <judul lagu>",
  example: ".applemusic streets doja cat",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function hdImage(url) {
  return url
    .replace(/110x110bb-60/g, "600x600bb-60")
    .replace(/110x110SC/g, "600x600SC")
    .replace(/110x110bb/g, "600x600bb");
}

async function handler(m, { sock }) {
  const query = m.args?.join(" ") || "";

  if (!query) {
    return m.reply(
      `🎵 *APPLE MUSIC SEARCH*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}applemusic <judul lagu>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}applemusic streets doja cat\`\n` +
      `\`${m.prefix}applemusic blinding lights\`\n` +
      `\`${m.prefix}applemusic taylor swift\``
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.nexray.eu.cc/search/applemusic`,
      {
        params: { q: query },
        timeout: 15000,
      }
    );

    if (!data?.status || !data?.result?.length) {
      m.react("☢");
      return m.reply(`❌ Tidak ada hasil untuk *${query}*.\n\n> Coba kata kunci lain.`);
    }

    const results = data.result.slice(0, 6).map(r => ({
      ...r,
      image: hdImage(r.image),
    }));

    let coverBuffer = null;
    try {
      const coverRes = await axios.get(results[0].image, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      coverBuffer = Buffer.from(coverRes.data);
    } catch {}

    const resultLines = results.map((r, i) => [
      `│ *${i + 1}. ${r.title}*`,
      `│ 📌 ${r.subtitle}`,
      `│ 🔗 ${r.link}`,
      `│`,
    ].join("\n")).join("\n");

    const caption = [
      `🎵 *APPLE MUSIC SEARCH*`,
      ``,
      `🔍 Hasil untuk: *${query}*`,
      ``,
      `╭─────────────────`,
      resultLines,
      `╰─────────────────`,
      ``,
      `> _via Apple Music • ${data.response_time}_`,
    ].join("\n");

    if (coverBuffer) {
      await sock.sendMessage(
        m.chat,
        { image: coverBuffer, caption },
        { quoted: m }
      );
    } else {
      await sock.sendMessage(
        m.chat,
        { text: caption },
        { quoted: m }
      );
    }

    m.react("✅");
  } catch (e) {
    console.error("[AppleMusic]", e);
    m.react("☢");
    m.reply(`❌ Gagal mencari lagu.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };