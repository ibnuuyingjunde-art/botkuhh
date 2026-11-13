import axios from "axios";

const pluginConfig = {
  name: "tiktokslide",
  alias: ["tts", "ttslide", "slidetok"],
  category: "downloader",
  description: "Download TikTok slide/foto",
  usage: ".tiktokslide <url>",
  example: ".tiktokslide https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const url = m.args?.[0] || "";

  if (!url || !url.includes("tiktok")) {
    return m.reply(
      `📥 *TIKTOK SLIDE DOWNLOADER*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}tiktokslide <url>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}tiktokslide https://vt.tiktok.com/xxx\`\n\n` +
      `_Khusus untuk TikTok slide/foto (bukan video)_`
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.azbry.com/api/download/tiktokslide`,
      {
        params: { url },
        timeout: 20000,
      }
    );

    if (!data?.status || !data?.result) {
      m.react("☢");
      return m.reply(`❌ Gagal mengambil data.\n\n> Pastikan URL valid dan merupakan TikTok slide.`);
    }

    const r = data.result;

    if (!r.images || r.images.length === 0) {
      m.react("☢");
      return m.reply(`❌ Tidak ada gambar ditemukan.\n\n> URL ini mungkin bukan TikTok slide.`);
    }

    await sock.sendMessage(
      m.chat,
      {
        text: [
          `📥 *TIKTOK SLIDE*`,
          ``,
          `╭─────────────────`,
          `│ 🎵 Judul  : *${r.title}*`,
          `│ 👤 Author : *${r.author}* (@${r.username})`,
          `│ 🎶 Musik  : *${r.music_title}*`,
          `│ 🖼️ Slide  : *${r.total} gambar*`,
          `╰─────────────────`,
        ].join("\n"),
      },
      { quoted: m }
    );

    for (let i = 0; i < r.images.length; i++) {
      try {
        const imgRes = await axios.get(r.images[i], {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        await sock.sendMessage(
          m.chat,
          {
            image: Buffer.from(imgRes.data),
            caption: `🖼️ *Slide ${i + 1}/${r.total}*${i === r.images.length - 1 ? `\n\n> _@${r.username}_` : ""}`,
          },
          { quoted: m }
        );

        if (i < r.images.length - 1) {
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (imgErr) {
        console.error(`[TiktokSlide] Gambar ${i + 1} gagal:`, imgErr.message);
        await m.reply(`⚠️ Gambar ${i + 1} gagal diunduh.`);
      }
    }

    if (r.music) {
      try {
        const musicRes = await axios.get(r.music, {
          responseType: "arraybuffer",
          timeout: 20000,
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        await sock.sendMessage(
          m.chat,
          {
            audio: Buffer.from(musicRes.data),
            mimetype: "audio/mp4",
            fileName: `${r.music_title}.mp3`,
          },
          { quoted: m }
        );
      } catch (musicErr) {
        console.error("[TiktokSlide] Musik gagal:", musicErr.message);
      }
    }

    m.react("✅");
  } catch (e) {
    console.error("[TiktokSlide]", e);
    m.react("☢");
    m.reply(`❌ Gagal download TikTok slide.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };