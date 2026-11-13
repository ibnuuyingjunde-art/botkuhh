import axios from "axios";
import config from "../../config.js";

const pluginConfig = {
  name: "fakecall",
  alias: ["fcall"],
  category: "maker",
  description: "Membuat gambar fake incoming call iOS dari foto",
  usage: ".fakecall <nama>|<durasi>",
  example: ".fakecall ArcxHz|1.35.00 (reply/kirim sebuah foto)",
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || "";

  if (!/image/.test(mime)) {
    return m.reply(`❌ Format salah!\n\n> Contoh:\n\`${m.prefix}fakecall ArcxHz|1.35.00\`\n(reply/kirim sebuah foto)`);
  }

  const text = m.text?.trim();
  if (!text) {
    return m.reply(`❌ Format salah!\n\n> Contoh:\n\`${m.prefix}fakecall ArcxHz|1.35.00\`\n(reply/kirim sebuah foto)`);
  }

  const [nama, durasi] = text.split("|").map((v) => v && v.trim());
  if (!nama || !durasi) {
    return m.reply(`❌ Format salah!\n\n> Contoh:\n\`${m.prefix}fakecall ArcxHz|1.35.00\``);
  }
  if (!/^\d{1,2}(\.\d{1,2}){1,2}$/.test(durasi)) {
    return m.reply("❌ Format durasi salah! Contoh yang benar: *1.35.00* atau *00.42*");
  }

  await m.react("⏳");

  try {
    const gambarNya = await q.download();

    const form = new URLSearchParams();
    form.append("nama", nama);
    form.append("durasi", durasi);

    const { data } = await axios.post(
      "https://api.betabotz.eu.org/api/maker/canvas-fakeCallIos",
      form,
      {
        responseType: "arraybuffer",
        headers: { "Content-Type": "multipart/form-data" },
      }
    );

    const buffer = Buffer.from(data);

    await sock.sendMessage(
      m.chat,
      { image: buffer, caption: "✅ Berhasil membuat fake call!" },
      { quoted: m }
    );

    await m.react("✅");
  } catch (err) {
    console.error("[FakeCall Error]", err);
    await m.react("❌");
    m.reply(`❌ Gagal membuat fake call!\n\n> Error: ${err.message}`);
  }
}

export { pluginConfig as config, handler };