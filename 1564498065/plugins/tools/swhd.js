import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: 'swhd',
  alias: ['tovn', 'unwrapdoc', 'doc2media'],
  category: 'tools',
  description: 'Balikin document (video/gambar/sticker/audio yang dikirim sebagai file) jadi media aslinya',
  usage: '.swhd (reply document) [caption]',
  example: '.swhd',
  cooldown: 3,
  isEnabled: true
};

/**
 * Tentuin bentuk asli media dari raw message type Baileys ("documentMessage",
 * "imageMessage", dst) + mimetype.
 *
 * Kalau tipenya memang udah bukan document (reply audio/gambar langsung),
 * pakai apa adanya. Kalau document, bentuk aslinya ditebak dari mimetype —
 * ini kasus utama fitur ini: file yang dikirim sebagai document dibalikin
 * jadi media yang bisa diputar/dilihat langsung.
 */
function detectKind(rawType, mimeType = '') {
  const base = (rawType || '').replace(/Message$/, ''); // "documentMessage" -> "document"
  if (base && base !== 'document') return base;
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'image/webp') return 'sticker'; // webp hampir selalu sticker
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return null;
}

async function sendSwhdError(m, sock, err, { usedPrefix, command } = {}) {
  console.error('[SWHD Error]', err);
  try {
    const rich = new AIRich(sock)
      .setTitle('❌ Gagal Convert Document')
      .setFooter(pluginConfig.name);

    rich.addCode('javascript', err.stack || err.message);
    rich.addText(
      `*Command:* ${usedPrefix || ''}${command || pluginConfig.name}\n` +
      `*Pengirim:* ${m.sender}\n` +
      `*Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
    );

    await rich.send(m.chat, { quoted: m });
  } catch {
    await m.reply(`❌ Gagal convert document\n\n${err.message}`);
  }
}

async function handler(m, { sock, usedPrefix, command, text }) {
  const target = m.quoted || m;
  const rawMsg = target?.message?.[target?.type] || {};
  const mimeType = rawMsg.mimetype || rawMsg.mimeType || '';

  // VALIDATION
  if (!target?.type || !mimeType) {
    return m.reply(
      `⚠️ *Format Salah*\n\n` +
      `Contoh:\n` +
      `reply document video/image dengan caption ${usedPrefix}${command} [caption]`,
    );
  }

  await m.react('⏰');

  try {
    const buffer = await target.download();
    if (!buffer || buffer.length < 10) {
      throw new Error('Gagal download media, buffer kosong');
    }

    // AUTO RESEND BERDASARKAN BENTUK ASLI
    const kind = detectKind(target.type, mimeType);
    const caption = text || '';

    if (kind === 'video') {
      await sock.sendMessage(m.chat, { video: buffer, caption }, { quoted: m });
    } else if (kind === 'image') {
      await sock.sendMessage(m.chat, { image: buffer, caption }, { quoted: m });
    } else if (kind === 'sticker') {
      await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m });
    } else if (kind === 'audio') {
      // WhatsApp pakai ogg/opus khusus buat voice note, format lain (mp3, m4a)
      // dikirim sebagai audio biasa. Audio nggak support caption.
      const isVoiceNote = /ogg|opus/i.test(mimeType);
      await sock.sendMessage(
        m.chat,
        { audio: buffer, mimetype: mimeType, ptt: isVoiceNote },
        { quoted: m },
      );
    } else {
      throw new Error(`Tipe tidak didukung: ${mimeType}`);
    }

    await m.react('✅');
  } catch (err) {
    await m.react('❌');
    await sendSwhdError(m, sock, err, { usedPrefix, command });
  }
}

export { pluginConfig as config, handler };