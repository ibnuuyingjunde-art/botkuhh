import axios from "axios";
import { uploadImage } from "../../src/lib/ichigo-uploader.js";
import { f } from "../../src/lib/ichigo-http.js";
import te from "../../src/lib/ichigo-error.js";
import { live3d } from "../../src/scraper/seaart.js";

const pluginConfig = {
  name: "toblack",
  alias: ["black", "hitamkan", "hitam", "tohitam"],
  category: "ai",
  description: "Ubah gambar ke skin tone lebih gelap",
  usage: ".toblack (reply gambar)",
  example: ".toblack",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const quotedIsImage =
    m.quoted &&
    (m.quoted.type === "imageMessage" || m.quoted.isMedia);
  const isImage = m.isImage || quotedIsImage;

  if (!isImage) {
    return m.reply(
      `🖤 *ʙʟᴀᴄᴋ sᴛʏʟᴇ*\n\n> Kirim/reply gambar\n\n\`${m.prefix}toblack\``,
    );
  }

  const PROMPT = `Transform skin tone to a darker complexion, maintain facial features, realistic shadows, high detail, natural skin texture, no distortion`;

  await m.react("⏳");

  let buffer;

  try {
    if (m.quoted?.isMedia) {
      buffer = await m.quoted.download();
    } else if (m.isMedia) {
      buffer = await m.download();
    }

    if (!buffer || buffer.length === 0) {
      await m.react("❌");
      return m.reply(`❌ Gagal mendownload gambar. Coba kirim ulang gambarnya.`);
    }

    const isValidImage =
      (buffer[0] === 0xff && buffer[1] === 0xd8) || 
      (buffer[0] === 0x89 && buffer[1] === 0x50) || 
      (buffer[0] === 0x47 && buffer[1] === 0x49);   

    if (!isValidImage) {
      await m.react("❌");
      return m.reply(`❌ Format gambar tidak valid. Gunakan JPG atau PNG.`);
    }

    let result;
    try {
      result = await Promise.race([
        live3d(buffer, PROMPT),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 60_000)
        ),
      ]);
    } catch (live3dError) {
      console.error("[toblack] live3d gagal:", live3dError?.message || live3dError);
      await m.react("❌");

      if (live3dError?.message === "timeout") {
        return m.reply(`⏱️ Request timeout. Server AI sedang lambat, coba lagi nanti.`);
      }

      return m.reply(`❌ AI gagal memproses gambar.\n\n*Detail:* ${live3dError?.message || "Unknown error"}`);
    }

    if (!result || !result.image) {
      await m.react("❌");
      return m.reply(`❌ AI tidak menghasilkan gambar. Coba lagi beberapa saat.`);
    }

    await m.react("✅");

    await sock.sendMedia(m.chat, result.image, null, m, {
      type: "image",
    });

  } catch (error) {
    console.error("[toblack] Error umum:", error?.message || error);
    await m.react("☢");

    const isTimeout = error?.message?.includes("timeout");
    const isNetwork = error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND";

    if (isTimeout) {
      return m.reply(`⏱️ Request timeout. Server AI sedang lambat, coba lagi nanti.`);
    } else if (isNetwork) {
      return m.reply(`🌐 Koneksi ke server AI gagal. Periksa koneksi bot atau coba lagi.`);
    }

    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };