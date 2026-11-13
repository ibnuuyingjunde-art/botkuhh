import axios from 'axios';

const pluginConfig = {
  name: "stikertele",
  alias: ["spiderman", "naruto"],
  category: "tools",
  description: "Menampilkan informasi paket stiker Telegram bertema Spider-Man dan Naruto",
  usage: ".stikertele <spiderman/naruto>",
  example: ".stikertele spiderman",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const stickerData = {
  spiderman: {
    title: "Spider-Man Pack",
    count: "30 Stiker",
    link: "https://t.me/addstickers/SpiderManPack"
  },
  naruto: {
    title: "Naruto Shippuden & Characters",
    count: "120+ Stiker",
    link: "https://t.me/addstickers/Uzumaki_Naruto_pack"
  }
};

async function handler(m, { sock, text, prefix, command }) {
  const conn = sock || m.conn;
  const query = (text || command).toLowerCase().trim();

  try {
    await m.react("⏳");

    let selectedPack = null;
    if (query.includes("spiderman") || command === "spiderman") {
      selectedPack = stickerData.spiderman;
      let caption = `🕷 *${selectedPack.title}* 🕷\n\n`;
      caption += `• *Jumlah:* ${selectedPack.count}\n`;
      caption += `• *Link Telegram:* ${selectedPack.link}`;
      
      await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
    } else if (query.includes("naruto") || command === "naruto") {
      selectedPack = stickerData.naruto;
      let caption = `🍥 *${selectedPack.title}* 🍥\n\n`;
      caption += `• *Jumlah:* ${selectedPack.count}\n`;
      caption += `• *Link Telegram:* ${selectedPack.link}`;
      
      await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
    } else {
      await m.reply(
        `📌 *Pusat Bantuan Stiker Telegram*\n\n` +
        `> *Penggunaan:* \`${prefix + command} <spiderman/naruto>\`\n` +
        `> *Contoh:* \`${prefix}spiderman\``
      );
    }

    await m.react("✅");

  } catch (err) {
    console.error("[StikerTele Error]:", err);
    await m.react("❌");
    return m.reply(`⚠️ *Terjadi kesalahan saat memproses data stiker:* ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };