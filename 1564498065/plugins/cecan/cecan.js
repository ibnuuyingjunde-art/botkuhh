import axios from "axios";

const pluginConfig = {
  name: "cecan",
  alias: ["waifu", "cewek", "girl", "nona"],
  category: "cecan",
  description: "Foto cecan random dari berbagai negara Asia",
  usage: ".cecan <negara>",
  example: ".cecan korea",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const NEGARA = {
  korea: { emoji: "🇰🇷", label: "Korea" },
  thailand: { emoji: "🇹🇭", label: "Thailand" },
  china: { emoji: "🇨🇳", label: "China" },
  vietnam: { emoji: "🇻🇳", label: "Vietnam" },
  indonesia: { emoji: "🇮🇩", label: "Indonesia" },
  japan: { emoji: "🇯🇵", label: "Jepang" },
};

async function handler(m, { sock }) {
  const negara = m.args?.[0]?.toLowerCase();

  if (!negara || !NEGARA[negara]) {
    const list = Object.entries(NEGARA)
      .map(([k, v]) => `${v.emoji} \`${k}\``)
      .join("  •  ");

    return m.reply(
      `👧 *CECAN*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}cecan <negara>\`\n\n` +
      `*Negara tersedia:*\n${list}\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}cecan korea\`\n` +
      `\`${m.prefix}cecan japan\``
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.siputzx.my.id/api/r/cecan/${negara}`,
      {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
      }
    );

    const info = NEGARA[negara];

    await sock.sendMessage(
      m.chat,
      {
        image: Buffer.from(data),
        caption: `${info.emoji} *Cecan ${info.label}* 👧\n\n> Ketik *.cecan ${negara}* untuk foto lain!`,
      },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Cecan]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil foto.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };