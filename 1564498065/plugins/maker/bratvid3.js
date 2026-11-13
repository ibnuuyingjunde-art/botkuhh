import axios from "axios";
import config from "../../config.js";

const pluginConfig = {
  name: "bratvid3",
  alias: ["bratv3", "sbratvid3", "sbrat3"],
  category: "maker",
  description: "Membuat stiker bergerak animasi teks bergaya Brat.",
  usage: ".bratvid3 <teks>",
  example: ".bratvid3 halo dunia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/maker/brat2";

// Hasil API bisa berupa data URI base64 atau link langsung
async function resolveVideoBuffer(result) {
  if (typeof result !== "string") throw new Error("Format hasil API tidak dikenali.");

  if (/^https?:\/\//i.test(result)) {
    const res = await axios.get(result, { responseType: "arraybuffer", timeout: 45000 });
    return Buffer.from(res.data);
  }

  const base64 = result.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

async function handler(m, { sock, text, prefix, command }) {
  const targetText = (text || m.quoted?.text || "").trim();

  if (!targetText) {
    return m.reply(
      `Halo *${m.pushName}*, sepertinya kamu belum memasukkan teksnya.\n\n` +
        `> *Penggunaan:* \`${prefix + command} <teks>\`\n` +
        `> *Contoh:* \`${prefix + command} halo dunia\``,
    );
  }

  if (targetText.length > 200) {
    return m.reply("❌ Teks terlalu panjang, maksimal 200 karakter.");
  }

  try {
    await m.react("🕕");

    const { data } = await axios.get(API_URL, {
      params: { text: targetText },
      timeout: 45000,
    });

    if (!data?.status || !data?.result) {
      throw new Error("Gagal mengambil data video dari server API.");
    }

    const videoBuffer = await resolveVideoBuffer(data.result);
    if (videoBuffer.length < 1000) {
      throw new Error("Video dari API kosong atau rusak.");
    }

    // Kalau hasil API sudah berupa WebP, langsung kirim sebagai stiker tanpa konversi
    const isWebp =
      videoBuffer.slice(0, 4).toString("ascii") === "RIFF" &&
      videoBuffer.slice(8, 12).toString("ascii") === "WEBP";

    if (isWebp) {
      await sock.sendMessage(m.chat, { sticker: videoBuffer }, { quoted: m });
    } else {
      // Video (mp4/gif) -> dikonversi ke stiker animasi oleh helper bawaan bot
      await sock.sendVideoAsSticker(m.chat, videoBuffer, m, {
        packname: config.sticker?.packname,
        author: config.sticker?.author,
      });
    }

    await m.react("✅");
  } catch (error) {
    console.error("[BratVid3 Sticker Error]:", error.message);
    await m.react("❌");
    await m.reply(
      `Maaf *${m.pushName}*, terjadi kesalahan saat membuat stiker Brat. Silakan coba lagi nanti.`,
    );
  }
}

export { pluginConfig as config, handler };