import axios from "axios";

const pluginConfig = {
  name: "papayang",
  alias: ["papa", "papay"],
  category: "fun",
  description: "Gambar papayang random",
  usage: ".papayang",
  example: ".papayang",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api-faa.my.id/faa/papayang`,
      {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
      }
    );

    await sock.sendMessage(
      m.chat,
      { image: Buffer.from(data), caption: "🌸 *Papayang~*" },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Papayang]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil gambar.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };