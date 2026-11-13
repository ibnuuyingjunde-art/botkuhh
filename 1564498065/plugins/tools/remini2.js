import { remini2 } from '../../src/scraper/remini2.js';
import { downloadMediaMessage } from 'ichigo';

const pluginConfig = {
  name: "remini2",
  alias: [],
  category: "tools",
  description: "Perjernih gambar (HD) menggunakan mesin Remini2",
  usage: ".remini2 <reply/kirim gambar>",
  example: ".remini2",
  isOwner: false,
  isGroup: false,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mediaType || '';
  const isImage = /image/i.test(mime) || q.mtype === 'imageMessage' || q.type === 'imageMessage';

  if (!isImage) {
    return m.reply(`❌ *Format Salah!*\n\n> Kirim gambar dengan caption *${m.prefix}remini2* atau balas/reply gambar yang sudah ada.`);
  }

  await m.react("⏳");

  try {
    const targetMedia = m.quoted ? m.quoted : m;

    const mediaBuffer = await downloadMediaMessage(
      targetMedia,
      'buffer',
      {},
      {
        logger: console,
        reuploadRequest: sock.updateMediaMessage
      }
    );

    if (!mediaBuffer) {
      await m.react("❌");
      return m.reply("❌ Gagal mengunduh gambar. Silakan coba lagi.");
    }

    const enhancedImage = await remini2(mediaBuffer);

    await sock.sendMessage(m.chat, {
      image: enhancedImage,
      caption: `✨ *REMINI2 SUCCESS*\n\n> Gambar berhasil di-HD-kan!`,
    }, { quoted: m });

    await m.react("✅");

  } catch (error) {
    console.error('[Plugin Remini2 Error]', error);
    await m.react("❌");
    return m.reply(`❌ *Gagal Memproses Gambar*\n\n> ${error?.message || 'Terjadi kesalahan pada server.'}`);
  }
}

export { pluginConfig as config, handler };