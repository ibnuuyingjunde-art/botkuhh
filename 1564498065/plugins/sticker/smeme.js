import FormData from 'form-data'
import { sharp as _sharp } from '../../src/lib/ichigo-lazy.js';
import axios from "axios";

function getSharp() {
  return _sharp;
}
import fs from "fs";
import path from "path";
import { config } from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
const pluginConfig = {
  name: "smeme",
  alias: ["memesticker", "memes"],
  category: "sticker",
  description: "Membuat sticker meme dari gambar",
  usage: ".smeme <top>|<bottom>",
  example: ".smeme Ketika|Kamu Lupa",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};
async function handler(m, { sock }) {
  const isImage = m.isImage || (m.quoted && m.quoted.isImage);
  const isSticker =
    m.isSticker ||
    (m.quoted && (m.quoted.isSticker || m.quoted.type === "stickerMessage"));
  if (!isImage && !isSticker) {
    return m.reply(
      `😂 *ᴍᴇᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Reply atau kirim gambar/sticker dengan caption\n\n\`Contoh: ${m.prefix}smeme Top|Bottom\``,
    );
  }
  const input = m.args.join(" ");
  if (!input || !input.includes("|")) {
    return m.reply(
      `😂 *ᴍᴇᴍᴇ sᴛɪᴄᴋᴇʀ*\n\n> Format: top|bottom\n\n\`Contoh: ${m.prefix}smeme Ketika|Kamu Lupa\``,
    );
  }
  const [top, bottom] = input.split("|").map((s) => s.trim());
  m.react("🕕");
  try {
    let mediaBuffer;
    if (m.quoted) {
      mediaBuffer = await m.quoted.download();
    } else if (m.download) {
      mediaBuffer = await m.download();
    }
    if (!mediaBuffer) {
      m.react("❌");
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gagal mengunduh media`);
    }
    let imageBuffer;
    try {
      const sharp = await getSharp();
      const srcMeta = await sharp(mediaBuffer).metadata();
      const w = srcMeta.width || 1;
      const h = srcMeta.height || 1;
      const ratio = w / h;
      const isSquareish = Math.abs(ratio - 1) < 0.05;
      const is16by9 = Math.abs(ratio - 16 / 9) < 0.05 || Math.abs(ratio - 9 / 16) < 0.05;
      const fit = isSquareish || is16by9 ? "contain" : "cover";
      imageBuffer = await sharp(mediaBuffer)
        .resize(512, 512, {
          fit,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch (e) {
      console.log("[SMEME] Sharp resize failed:", e.message);
      imageBuffer = mediaBuffer;
    }
    let imageUrl;
    try {
      const form = new FormData();
      form.append("file", imageBuffer, {
        filename: "meme.png",
        contentType: "image/png",
      });
      const uploadRes = await axios.post(
        "https://kappa.lol/api/upload",
        form,
        {
          headers: form.getHeaders(),
          timeout: 30000,
        },
      );
      if (uploadRes.data?.link) {
        imageUrl = uploadRes.data.link;
      } else if (uploadRes.data?.id) {
        imageUrl = `https://kappa.lol/${uploadRes.data.id}`;
      }
    } catch (e) {
      console.log("[SMEME] Kappa upload failed:", e.response?.data || e.message);
    }
    if (!imageUrl) {
      m.react("❌");
      return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Gagal upload gambar, coba lagi nanti`);
    }
    console.log("[SMEME] Image uploaded:", imageUrl);
    const encodeText = (text) => {
      if (!text) return "_";
      return encodeURIComponent(text)
        .replace(/-/g, "--")
        .replace(/_/g, "__")
        .replace(/%20/g, "_");
    };
    const topEncoded = encodeText(top);
    const bottomEncoded = encodeText(bottom);
    const memeUrl = `https://api.memegen.link/images/custom/${topEncoded}/${bottomEncoded}.png?background=${encodeURIComponent(imageUrl)}`;
    const response = await axios.get(memeUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    let buffer = Buffer.from(response.data);
    try {
      const sharp = await getSharp();
      const memeMeta = await sharp(buffer).metadata();
      const mw = memeMeta.width;
      const mh = memeMeta.height;
      if (mw && mh) {
        const watermarkPx = Math.max(20, Math.round(mh * 0.045));
        buffer = await sharp(buffer)
          .extract({ left: 0, top: 0, width: mw, height: mh - watermarkPx })
          .png()
          .toBuffer();
      }
    } catch (e) {
      console.log("[SMEME] Watermark crop failed:", e.message);
    }
    await sock.sendImageAsSticker(m.chat, buffer, m, {
      packname: config.sticker?.packname || "Ourin-AI",
      author: config.sticker?.author || "Bot",
    });
    m.react("✅");
  } catch (error) {
    console.log("[SMEME] Error:", error.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}
export { pluginConfig as config, handler };