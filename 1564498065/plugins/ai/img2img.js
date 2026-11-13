import { Img2Img } from "../../src/scraper/img2img.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "img2img",
  alias: ["editimg", "nanobanana", "nano", "imgedit"],
  category: "ai",
  description: "Edit gambar dengan AI menggunakan prompt",
  usage: ".img2img <prompt> (reply gambar)",
  example: ".img2img make it anime style",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const prompt = m.text;
  if (!prompt) {
    m.react("❌");
    return m.reply(
      `🎨 *Image to Image*\n\n` +
        `Edit gambar pakai AI — tinggal reply gambar + kasih prompt.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}img2img <prompt>* (reply gambar)\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}img2img make it anime style*\n` +
        `> *${m.prefix}img2img ubah jadi lukisan cat minyak*\n\n` +
        `_Reply gambar dulu, lalu ketik command + prompt_`
    );
  }

  const isImage = m.isImage || (m.quoted && m.quoted.isImage);
  if (!isImage) {
    m.react("❌");
    return m.reply(`🎨 *Image to Image*\n\n> Reply gambar dulu, lalu ketik command + prompt`);
  }

  m.react("🕕");

  try {
    let mediaBuffer;
    if (m.isImage && m.download) {
      mediaBuffer = await m.download();
    } else if (m.quoted && m.quoted.isImage && m.quoted.download) {
      mediaBuffer = await m.quoted.download();
    }

    if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
      m.react("☢");
      return m.reply(`❌ *Gagal*\n\n> Gagal mengunduh gambar`);
    }

    const result = await Img2Img(prompt, mediaBuffer, `upload_${Date.now()}.png`);

    if (!result.status) {
      m.react("☢");
      return m.reply(`❌ *Edit Gagal*\n\n> ${result.error}`);
    }

    await sock.sendMedia(m.chat, result.result?.url || result.result, `🎨 *Image to Image*\n\n> Prompt: *${prompt}*`, m, {
      type: "image",
    });

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
