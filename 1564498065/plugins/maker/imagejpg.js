import axios from "axios";
import FormData from "form-data";

async function uploadToTelegraph(buffer) {
  const form = new FormData();
  form.append("file", buffer, {
    filename: "image.jpg",
    contentType: "image/jpeg",
  });

  const res = await axios.post("https://telegra.ph/upload", form, {
    headers: form.getHeaders(),
    timeout: 20_000,
  });

  const src = res.data?.[0]?.src;
  if (!src) throw new Error("Telegraph upload gagal: " + JSON.stringify(res.data));

  return `https://telegra.ph${src}`;
}

export const config = {
  name: "iqcsticker",
  alias: ["iqc", "quotesticker"],
  category: "maker",
  description: "Buat stiker IQC dengan teks dan gambar",
  usage: ".iqcsticker <teks> (reply gambar)",
  example: ".iqcsticker MY BINI GWEH",
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

export async function handler(m, { sock, args }) {
  const quoted = m.quoted;
  const text = args.join(" ").trim();

  if (!text) {
    return m.reply(
      `❌ Masukkan teks!\n\n` +
      `📌 Cara pakai: ${config.usage}\n` +
      `💡 Contoh: .iqcsticker MY BINI GWEH`
    );
  }

  let imgUrl = null;

  try {
    
    if (quoted) {
      const mime =
        quoted?.mimetype ||
        quoted?.msg?.mimetype ||
        quoted?.message?.imageMessage?.mimetype ||
        "";

      if (mime.startsWith("image")) {
        await m.reply("📤 Mengupload gambar...");
        const buffer = await quoted.download();

        if (!buffer || buffer.length < 512) {
          throw new Error("Download gambar reply gagal (buffer kosong).");
        }

        imgUrl = await uploadToTelegraph(buffer);
        console.log("[IQC] Upload sukses →", imgUrl);
      }
    }

    if (!imgUrl) {
      try {
        imgUrl = await sock.profilePictureUrl(m.sender, "image");
        console.log("[IQC] Pakai foto profil →", imgUrl);
      } catch {
        imgUrl = "https://telegra.ph/file/6259f4b7eb4c9b9f1d1a1.jpg"; 
        console.log("[IQC] Pakai avatar default");
      }
    }

    await m.reply("⏳ Membuat IQC stiker...");

    const response = await axios.get("https://api.azbry.com/api/maker/iqc-sticker", {
      params: { text, img: imgUrl },
      responseType: "arraybuffer",
      timeout: 30_000,
    });

    const contentType = response.headers["content-type"] || "";
    if (!contentType.startsWith("image")) {
      const body = Buffer.from(response.data).toString("utf-8");
      throw new Error(`API error.\nContent-Type: ${contentType}\nBody: ${body}`);
    }

    await sock.sendMessage(
      m.chat,
      {
        image: Buffer.from(response.data),
        caption: `✅ IQC Stiker berhasil!\n💬 Teks: *${text}*`,
        mimetype: "image/png",
      },
      { quoted: m }
    );

  } catch (err) {
    console.error("[IQCSticker Error]", err.message);

    if (err.message.includes("Telegraph")) {
      return m.reply("❌ Gagal upload gambar ke Telegraph. Coba lagi.");
    }
    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      return m.reply("❌ Timeout! Coba lagi nanti.");
    }
    if (err.response?.status === 429) {
      return m.reply("❌ Rate limit, tunggu beberapa saat.");
    }

    return m.reply(`❌ Gagal: ${err.message}`);
  }
}