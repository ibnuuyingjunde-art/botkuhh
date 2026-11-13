import crypto from 'crypto';
import { prepareWAMessageMedia, generateWAMessageFromContent, proto } from 'ichigo';

const pluginConfig = {
  name: "imagepollch",
  alias: ["pollch", "imgpollch"],
  category: "tools",
  description: "Membuat polling interaktif berbasis gambar khusus untuk dikirim ke Saluran (Newsletter)",
  usage: ".imagepollch <jid_saluran> | <nama_1> | <nama_2> | <url_1> | <url_2>",
  example: ".imagepollch 120363... @newsletter | Kucing | Anjing | https://link1.jpg | https://link2.jpg",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

async function sendImagePollToChannel(conn, jid, values) {
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

  // Kirim pesan utama polling ke saluran
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

  // Kirim lampiran gambar asosiasi polling ke saluran
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

  if (!text || !text.includes('|')) {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `> *Contoh:* \`${prefix + command} 120363xxxx@newsletter | Pilihan 1 | Pilihan 2 | https://url1.jpg | https://url2.jpg\``
    );
  }

  try {
    let parts = text.split('|').map(v => v.trim()).filter(Boolean);

    let targetJid = parts[0];
    parts.shift(); 

    if (!targetJid.includes('@newsletter')) {
      targetJid = `${targetJid}@newsletter`;
    }

    let middleIndex = parts.findIndex(p => p.startsWith('http'));
    if (middleIndex === -1) middleIndex = Math.ceil(parts.length / 2);

    let names = parts.slice(0, middleIndex);
    let urls = parts.slice(middleIndex);

    if (names.length === 0) names = ['Pilihan 1', 'Pilihan 2'];
    if (urls.length === 0) {
      urls = [
        'https://cdn-ichigo.web.id/i/2p-tu0CRGx.jpg',
        'https://cdn-ichigo.web.id/i/2p-tu0CRGx.jpg'
      ];
    }

    let items = names.map((name, i) => ({
      name: name,
      image: urls[i] || urls[urls.length - 1]
    }));

    await m.react("⏳");
    await sendImagePollToChannel(conn, targetJid, items);
    await m.react("✅");
    await m.reply(`✅ Berhasil mengirim polling gambar ke saluran: \`${targetJid}\``);

  } catch (err) {
    console.error("[ImagePollCh Error Details]:", err);
    await m.react("❌");
    return m.reply(`⚠️ *Gagal mengirim ke saluran:* ${err.message || err}\n\nPastikan bot sudah menjadi **Admin** di saluran tersebut.`);
  }
}

export { pluginConfig as config, handler };