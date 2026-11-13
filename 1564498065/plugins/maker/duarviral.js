import axios from "axios";
import { uploadImage } from "../../src/lib/ichigo-uploader.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "duarviral",
  alias: ["duar", "viralduar"],
  category: "maker",
  description: "Bikin gambar Duar Viral dari foto (background otomatis dihapus) via API Cloud",
  usage: ".duarviral (kirim foto, reply foto, atau link gambar)",
  example: ".duarviral",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/maker/duarviral";

// "result" berbentuk data URI base64 (data:image/jpeg;base64,...), jaga-jaga juga terima link biasa
async function resultToBuffer(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("Format respons API tidak dikenali");

  const dataUri = raw.match(/^data:image\/[\w.+-]+;base64,(.+)$/s);
  if (dataUri) return Buffer.from(dataUri[1], "base64");

  if (/^https?:\/\//i.test(raw)) {
    const dl = await axios.get(raw, { responseType: "arraybuffer", timeout: 60000 });
    return Buffer.from(dl.data);
  }
  throw new Error("Format respons API tidak dikenali");
}

async function handler(m, { sock }) {
  const input = String(m.text || "").trim();
  const quotedText = (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption)) || "";
  const linkMatch = (input + " " + quotedText).match(/https?:\/\/\S+/i);
  const hasImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === "imageMessage"));

  if (!linkMatch && !hasImage) {
    return m.reply(
      `*ᴅᴜᴀʀ ᴠɪʀᴀʟ*\n\n` +
        `> Kirim foto dengan caption, reply foto, atau tulis link gambar\n\n` +
        `\`${m.prefix}${m.command}\`\n` +
        `\`${m.prefix}${m.command} https://link-gambar.jpg\``
    );
  }

  m.react("🕕");

  try {
    let imageUrl;
    if (linkMatch) {
      imageUrl = linkMatch[0];
    } else {
      const target = m.isImage ? m : m.quoted;
      const buffer = await target.download();
      if (!buffer || !buffer.length) {
        m.react("❌");
        return m.reply("Gagal mengunduh gambar.");
      }
      imageUrl = await uploadImage(buffer, `duarviral_${Date.now()}.jpg`);
    }

    const res = await axios.get(API_URL, {
      params: { url: imageUrl },
      timeout: 120000,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    const data = res.data;
    if (res.status !== 200 || !data || data.status !== true) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.httpStatus = res.status;
      throw err;
    }

    const image = await resultToBuffer(data.result);
    await sock.sendMessage(
      m.chat,
      { image, caption: `*ᴅᴜᴀʀ ᴠɪʀᴀʟ*${data.backgroundRemoved ? "\n\n> Background berhasil dihapus" : ""}` },
      { quoted: m }
    );
    m.react("✅");
  } catch (error) {
    m.react("☢");
    console.log("[duarviral error]", error.message);

    if (error.httpStatus === 400) return m.reply(`Input tidak valid: ${error.message}`);
    if (error.httpStatus === 429) return m.reply("Layanan sedang penuh atau kena batas. Coba lagi nanti.");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };