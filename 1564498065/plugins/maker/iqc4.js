import axios from "axios";
import FormData from "form-data";

const pluginConfig = {
  name: "iqc4",
  alias: ["iqc4", "quote4", "fakequote4"],
  category: "maker",
  description: "Membuat Fake Quote Image via API Cloud",
  usage: ".iqc4 <teks> | [waktu custom]",
  example: ".iqc4 Halo dunia! | 12:00",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function uploadToIchigoCDN(buffer) {
  try {
    const form = new FormData();
    form.append("file", buffer, "image.png"); 
    
    const { data } = await axios.post("https://cdn-ichigo.web.id/upload", form, {
      headers: form.getHeaders(),
    });
    
    return data.url || data.result?.url || (data.files && data.files[0]?.url) || data;
  } catch (err) {
    return null;
  }
}

async function handler(m, { sock, text, prefix, command }) {
  const conn = sock || m.conn;

  if (!text) {
    return m.reply(
      `❌ *Teks quote tidak boleh kosong!*\n\n` +
      `> *Penggunaan:* \`${prefix + command} <teks> | [waktu]\`\n` +
      `> *Contoh 1:* \`${prefix + command} Halo dunia!\`\n` +
      `> *Contoh 2:* \`${prefix + command} Selamat pagi | 08:30\`\n\n` +
      `_Tip: Kirim/Balas gambar dengan caption perintah di atas untuk menambahkan foto._`
    );
  }

  await m.react("⏳");

  try {
    let quoteText = text;
    let customTime = "";

    if (text.includes("|")) {
      const parts = text.split("|");
      quoteText = parts[0].trim();
      customTime = parts[1].trim();
    }

    if (!quoteText) {
      await m.react("❌");
      return m.reply("❌ *Teks quote tidak boleh kosong!*");
    }

    const realTimeWita = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date()).replace(/\./g, ':'); 

    const finalTime = customTime || realTimeWita;

    let imageUrl = "";
    const isImage = m.mtype === 'imageMessage' || (m.quoted && m.quoted.mtype === 'imageMessage');

    if (isImage) {
      const mediaMessage = m.mtype === 'imageMessage' ? m : m.quoted;
      try {
        const buffer = await mediaMessage.download();
        const uploadedUrl = await uploadToIchigoCDN(buffer);
        
        if (uploadedUrl && typeof uploadedUrl === 'string' && uploadedUrl.startsWith('http')) {
          imageUrl = uploadedUrl;
        } else {
          return m.reply("⚠️ *Gagal mengunggah gambar ke CDN Ichigo.* Cek console untuk detail error.");
        }
      } catch (err) {
        return m.reply("⚠️ *Gagal mengunduh media dari pesan.*");
      }
    }

    let apiUrl = `https://api-cloud.my.id/maker/iqc?text=${encodeURIComponent(quoteText)}&time=${encodeURIComponent(finalTime)}`;
    
    if (imageUrl) {
      apiUrl += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    }

    const { data } = await axios.get(apiUrl, { timeout: 20000 });

    if (!data || !data.status || !data.result) {
      await m.react("❌");
      return m.reply("⚠️ *Gagal memproses gambar.* Respon API tidak valid atau error.");
    }

    const base64String = data.result;
    const rawBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(rawBase64, "base64");

    await conn.sendMessage(
      m.chat,
      {
        image: imageBuffer,
        caption: `✨ *IQC Maker*`,
      },
      { quoted: m }
    );

    await m.react("✅");

  } catch (err) {
    await m.react("❌");
    return m.reply(`⚠️ *Terjadi kesalahan sistem:*\n> ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };