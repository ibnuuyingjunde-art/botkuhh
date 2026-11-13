import axios from "axios";
import moment from "moment-timezone";

const pluginConfig = {
  name: "iqcv2",
  alias: ["iqchatv2", "iphonechatv2"],
  category: "canvas",
  description: "Membuat gambar chat iPhone style v2",
  usage: ".iqcv2 <text>",
  example: ".iqcv2 Hai cantik",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.args.join(" ");
  if (!text) {
    return m.reply(
      `📱 *ɪǫᴄ ᴄʜᴀᴛ ᴠ²*\n\n> Masukkan teks untuk chat\n\n\`Contoh: ${m.prefix}iqcv2 Hai cantik\``,
    );
  }

  m.react("🕕");

  try {
    const jam = moment().tz("Asia/Makassar").format("HH:mm");
    const batre = 100;

    const res = await axios.get("https://api-faa.my.id/faa/iqcv2", {
      params: {
        prompt: text,
        jam,
        batre,
      },
      responseType: "arraybuffer",
      timeout: 15000,
    });

    const ct = res.headers["content-type"] || "";
    if (!ct.includes("image")) throw new Error("Response bukan gambar");

    const buf = Buffer.from(res.data);
    m.react("✅");
    await sock.sendMessage(m.chat, { image: buf, caption: "" }, { quoted: m });
  } catch (error) {
    console.error("[IQCv2]", error.message);
    m.react("☢");
    m.reply("😔 *Gagal membuat gambar chat.*\n\nServer sedang tidak tersedia. Coba beberapa saat lagi ya.");
  }
}

export { pluginConfig as config, handler };