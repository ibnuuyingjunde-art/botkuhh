import axios from "axios";
// Jimp v1 dimuat lazy di dalam handler (named export, bukan `import * as`)
import { f } from "../../src/lib/ichigo-http.js";
import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";

const pluginConfig = {
  name: "text2img",
  alias: [],
  category: "ai",
  description: "Buat gambar dari teks",
  usage: ".text2img <teks>",
  example: ".text2img Buat gambar dari teks",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.args.join(" ");
  if (!text) {
    return m.reply(
      `📿 *ᴛᴇxᴛ ᴛᴏ ɪᴍᴀɢᴇ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}text2img kucing\``,
    );
  }

  m.react("🕕");

  try {
    const url = `https://api-cloud.my.id/ai/text2img?prompt=${encodeURIComponent(text)}&shape=square`;

    // Ambil gambar sebagai arraybuffer
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const originalBuffer = Buffer.from(response.data);

    // === PROSES ZOOM / CROP MENGGUNAKAN JIMP v1 ===
    let finalBuffer = originalBuffer;
    try {
      const { Jimp } = await import("jimp");
      const image = await Jimp.read(originalBuffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;

      // 0.08 = potong 8% dari setiap sisi (zoom in)
      const margin = 0.08;
      const x = Math.round(width * margin);
      const y = Math.round(height * margin);
      const w = Math.round(width - width * margin * 2);
      const h = Math.round(height - height * margin * 2);

      // Jimp v1: crop pakai object {x, y, w, h}
      image.crop({ x, y, w, h });

      // Jimp v1: getBuffer(mime) mengembalikan Promise<Buffer>
      finalBuffer = await image.getBuffer("image/jpeg", { quality: 90 });
    } catch (cropErr) {
      // kalau crop gagal, tetap kirim gambar asli
      console.error("[text2img] crop gagal:", cropErr.message);
    }
    // ==============================================

    m.react("✅");
    await sock.sendMedia(m.chat, finalBuffer, text, m, {
      type: "image",
    });
  } catch (error) {
    console.error(error);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };