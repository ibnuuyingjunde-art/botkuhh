import axios from "axios";
import FormData from "form-data";
import config from "../../config.js";

const pluginConfig = {
  name: "igqc",
  alias: ["igquote"],
  category: "maker",
  description: "Membuat gambar IG quote card dari foto",
  usage: ".igqc <teks>",
  example: ".igqc Hidup itu indah (reply/kirim sebuah foto)",
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const _K = "U1VQLTZhNzA2MDViYWIwYjRiOTdkNjI0";
const API_KEY = Buffer.from(_K, "base64").toString("utf-8");

function detectMime(buffer) {
  if (buffer.slice(0, 4).toString("hex") === "89504e47") return { mime: "image/png", ext: "png" };
  if (buffer.slice(0, 3).toString("hex") === "ffd8ff") return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.slice(0, 4).toString("ascii") === "RIFF") return { mime: "image/webp", ext: "webp" };
  return { mime: "image/jpeg", ext: "jpg" };
}

async function uploadToKappa(buffer) {
  const { mime, ext } = detectMime(buffer);
  const form = new FormData();
  form.append("file", buffer, { filename: `igqc.${ext}`, contentType: mime });

  const { data } = await axios.post("https://kappa.lol/api/upload", form, {
    headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" },
    timeout: 20000,
  });

  if (!data?.link) throw new Error(`Respon kappa.lol tidak sesuai: ${JSON.stringify(data)}`);
  return data.link;
}

async function handler(m, { sock }) {
  
  const isImg = m.isImage || (m.isQuoted && m.quoted.isImage);
  if (!isImg) {
    return m.reply(
      `❌ Foto tidak ditemukan!\n\n> Contoh:\n\`${m.prefix || "."}igqc Hidup itu indah\`\n(reply/kirim sebuah foto)`
    );
  }

  const text = (m.text || "").trim();
  if (!text) {
    return m.reply(
      `❌ Teks kosong!\n\n> Contoh:\n\`${m.prefix || "."}igqc Hidup itu indah\`\n(reply/kirim sebuah foto)`
    );
  }

  const now = new Date();
  const menuTimeStr = now.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(/\./g, ":");

  await m.react("⏳");

  try {
    
    const gambarNya = m.isQuoted ? await m.quoted.download() : await m.download();
    const imgUrl = await uploadToKappa(gambarNya);

    const { data } = await axios.get(
      "https://api.betabotz.eu.org/api/maker/canvas-igqc",
      {
        params: { apikey: API_KEY, imgUrl, menuTimeStr, txt: text },
        headers: { Accept: "*/*" },
        responseType: "arraybuffer",
        timeout: 30000,
      }
    );

    const isImageResponse =
      data.length > 8 &&
      (data.slice(0, 4).toString("hex") === "89504e47" ||
        data.slice(0, 3).toString("hex") === "ffd8ff");

    if (!isImageResponse) {
      throw new Error(Buffer.from(data).toString("utf-8").slice(0, 300));
    }

    await sock.sendMessage(
      m.chat,
      { image: Buffer.from(data), caption: "✅ Berhasil membuat IG quote card!" },
      { quoted: m }
    );
    await m.react("✅");
  } catch (err) {
    let apiError = err.message;
    if (err.response?.data) {
      apiError = Buffer.isBuffer(err.response.data)
        ? err.response.data.toString("utf-8").slice(0, 300)
        : JSON.stringify(err.response.data);
    }
    await m.react("❌");
    m.reply(`❌ Gagal membuat IG quote card!\n\n> Error: ${apiError}`);
  }
}

export { pluginConfig as config, handler };