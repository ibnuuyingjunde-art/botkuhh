import crypto from 'crypto';
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'ichigo';

const pluginConfig = {
  name: "imagepoll",
  alias: ["pollimg", "imgpoll"],
  category: "tools",
  description: "Membuat polling interaktif berbasis banyak gambar menggunakan URL",
  usage: ".imagepoll <nama_1> | <nama_2> | <url_1> | <url_2>",
  example: ".imagepoll Kucing | Anjing | https://link1.jpg | https://link2.jpg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

async function sendImagePoll(conn, jid, values) {
  const messageSecret = crypto.randomBytes(32);

  const hashOpt = (name, sha) =>
    crypto
      .createHash('sha256')
      .update(
        crypto.createHash('sha256').update(String(name)).digest('hex') +
          (sha ? Buffer.from(sha).toString('base64') : '')
      )
      .digest('hex');

  const images = await Promise.all(
    values.map(async (item, index) => {
      const mediaInput = typeof item.image === 'string' ? { url: item.image } : item.image;

      const { imageMessage } = await prepareWAMessageMedia(
        { image: mediaInput },
        { upload: conn.waUploadToServer }
      );

      if (!imageMessage?.fileSha256)
        throw new Error(`imageMessage gagal dibuat pada index ${index}`);

      return {
        index,
        name: String(item.name),
        imageMessage,
        optionHash: hashOpt(item.name, imageMessage.fileSha256)
      };
    })
  );

  const parent = generateWAMessageFromContent(
    jid,
    {
      pollCreationMessageV3: {
        name: 'Pilih gambar favorit',
        selectableOptionsCount: 1,
        options: images.map(({ name, optionHash }) => ({
          optionName: name,
          optionHash
        })),
        pollContentType: proto.Message.PollContentType.IMAGE
      },
      messageContextInfo: { messageSecret }
    },
    {}
  );

  const parentKey = parent.key;

  await conn.relayMessage(jid, parent.message, {
    messageId: parentKey.id,
    additionalNodes: [{
      tag: 'meta',
      attrs: {
        polltype: 'creation',
        contenttype: 'image'
      }
    }]
  });

  for (const { imageMessage } of images) {
    const child = proto.Message.create({
      messageContextInfo: {
        messageAssociation: {
          parentMessageKey: parentKey,
          associationType: proto.MessageAssociation.AssociationType.MEDIA_POLL
        }
      },
      pollCreationOptionImageMessage: {
        message: { imageMessage }
      }
    });

    await conn.relayMessage(jid, child, {
      messageId: crypto.randomUUID(),
      additionalNodes: [{
        tag: 'meta',
        attrs: {
          message_association_type: 'media_poll'
        }
      }]
    });
  }
}

async function handler(m, { sock, text, prefix, command }) {
  const conn = sock || m.conn;

  if (!text) {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `> *Contoh:* \`${prefix + command} Kucing | Anjing | https://url1.jpg | https://url2.jpg\``
    );
  }

  try {
    let parts = text.split('|').map(v => v.trim()).filter(Boolean);

    // Pisahkan nama pilihan dan URL gambar secara otomatis
    let middleIndex = Math.ceil(parts.length / 2);
    if (parts.some(p => p.startsWith('http'))) {
      middleIndex = parts.findIndex(p => p.startsWith('http'));
    }

    let names = parts.slice(0, middleIndex);
    let urls = parts.slice(middleIndex);

    // Fallback default jika jumlah tidak seimbang
    if (names.length === 0) names = ['Pilihan 1', 'Pilihan 2'];
    if (urls.length === 0) {
      urls = [
        'https://cdn-ichigo.web.id/i/2p-tu0CRGx.jpg',
        'https://cdn-ichigo.web.id/i/2p-tu0CRGx.jpg'
      ];
    }

    let items = names.map((name, i) => ({
      name: name,
      image: urls[i] || urls[urls.length - 1] // Jika URL kurang, gunakan URL terakhir sebagai duplikat aman
    }));

    await sendImagePoll(conn, m.chat, items);
  } catch (err) {
    console.error("[ImagePoll Error]", err);
    return m.reply(`⚠️ *Gagal membuat polling gambar:* ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };