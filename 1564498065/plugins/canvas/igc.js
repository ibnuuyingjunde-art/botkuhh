import axios from "axios";

const pluginConfig = {
  name: "igc",
  alias: ["igchat", "instagramchat"],
  category: "canvas",
  description: "Membuat gambar info grup iPhone style",
  usage: ".igc",
  example: ".igc",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  m.react("🕕");

  try {
    
    const meta = await sock.groupMetadata(m.chat);
    const nama = meta.subject || "Grup";
    const peserta = meta.participants?.length || 10;

    let ppUrl = "https://i.ibb.co/pP5xBgR/avatar.jpg";
    try {
      const raw = await sock.profilePictureUrl(m.chat, "image");
      if (raw && raw.startsWith("http")) ppUrl = raw;
    } catch (_) {}

    const res = await axios.get("https://api.azbry.com/api/maker/igc", {
      params: {
        profile: ppUrl,
        nama,
        peserta,
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
    console.error("[IGC]", error.message);
    m.react("☢");
    m.reply("😔 *Gagal membuat gambar.*\n\nServer sedang tidak tersedia. Coba beberapa saat lagi ya.");
  }
}

export { pluginConfig as config, handler };