import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { config } from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { handleAntiSwGc } from "../../src/lib/ichigo-group-protection.js";
const botConfig = config;

function buildSyntheticSwGcRawMessage(sock, remoteJid, content, messageId) {
  const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  const innerMessage = content.text
    ? {
        extendedTextMessage: {
          text: content.text,
          contextInfo: {
            isGroupStatus: true,
            statusSourceType: 4,
          },
        },
      }
    : content.image
      ? {
          imageMessage: {
            caption: content.caption || "",
            contextInfo: {
              isGroupStatus: true,
              statusSourceType: 0,
            },
          },
        }
      : content.video
        ? {
            videoMessage: {
              caption: content.caption || "",
              contextInfo: {
                isGroupStatus: true,
                statusSourceType: 1,
              },
            },
          }
        : content.audio
          ? {
              audioMessage: {
                mimetype: content.mimetype || "audio/mpeg",
                ptt: Boolean(content.ptt),
                contextInfo: {
                  isGroupStatus: true,
                  statusSourceType: 3,
                },
              },
            }
          : {
              extendedTextMessage: {
                text: "",
                contextInfo: {
                  isGroupStatus: true,
                  statusSourceType: 4,
                },
              },
            };

  return {
    key: {
      remoteJid,
      fromMe: true,
      id: messageId,
      participant: botJid,
    },
    message: {
      groupStatusMessageV2: {
        message: innerMessage,
      },
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };
}

const pluginConfig = {
  name: "swgc",
  alias: ["statusgrup", "swgroup", "groupstory", "toswgc"],
  category: "group",
  description: "Post Group Status/Story ke grup ini (khusus Admin Grup)",
  usage: ".swgc <teks> atau reply media",
  example: ".swgc Halo semua!",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function sendGroupStatus(sock, jid, content) {
  const sent = await sock.sendMessage(jid, { ...content, groupStatus: true });
  return sent?.key?.id ?? sent;
}

async function handler(m, { sock, db }) {
  const args = m.args || [];
  const text = m.text || "";
  const groupJid = m.chat;

  if (!m.isGroup) {
    await m.reply(`⚠️ *Perintah ini hanya bisa digunakan di dalam grup!*`);
    return;
  }

  let isAdmin = false;
  try {
    const groupMeta = await sock.groupMetadata(groupJid);
    const participants = groupMeta.participants;
    const senderId = m.sender;

    const participant = participants.find(p => {
      
      const pId = p.id.includes('@') ? p.id : p.id + '@s.whatsapp.net';
      const sId = senderId.includes('@') ? senderId : senderId + '@s.whatsapp.net';
      return pId === sId;
    });
    
    if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
      isAdmin = true;
    }
  } catch (e) {
    console.error("Error validasi admin:", e);
  }

  if (!isAdmin && m.isAdmin) {
    isAdmin = true;
  }

  if (!isAdmin && m.isGroupAdmin) {
    isAdmin = true;
  }

  const isOwner = m.sender === botConfig?.ownerNumber + "@s.whatsapp.net" || 
                  m.sender === botConfig?.ownerNumber;

  if (!isAdmin && !isOwner) {
    await m.reply(
      `⚠️ *Akses Ditolak*\n\n` +
      `> Hanya *Admin Grup* yang dapat menggunakan fitur ini!\n\n` +
      `_Debug: sender=${m.sender}_`
    );
    return;
  }

  let rawContent = {};
  let buffer, ext, tempFile;
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  if (
    m.quoted &&
    (m.quoted.isImage || m.quoted.isVideo || m.quoted.isAudio || m.quoted.mimetype?.startsWith("audio"))
  ) {
    try {
      buffer = await m.quoted.download();
      if (!buffer) {
        await m.reply(`❌ Gagal mengambil media.`);
        return;
      }
      const fileType = await fileTypeFromBuffer(buffer);
      ext = fileType?.ext || "bin";
      tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, buffer);

      if (m.quoted.isImage) {
        rawContent.image = buffer;
        rawContent.caption = text || "";
      } else if (m.quoted.isVideo) {
        rawContent.video = buffer;
        rawContent.caption = text || "";
      } else if (m.quoted.isAudio || m.quoted.mimetype?.startsWith("audio")) {
        rawContent.audio = buffer;
        rawContent.mimetype = fileType?.mime || m.quoted.mimetype || "audio/mpeg";
        rawContent.ptt = m.quoted.msg?.ptt || false;
      }
    } catch (e) {
      await m.reply(te(m.prefix, m.command, m.pushName));
      return;
    }
  } else if (m.isImage || m.isVideo || m.isAudio || m.mimetype?.startsWith("audio")) {
    try {
      buffer = await m.download();
      if (!buffer) {
        await m.reply(`❌ Gagal mengambil media.`);
        return;
      }
      const fileType = await fileTypeFromBuffer(buffer);
      ext = fileType?.ext || "bin";
      tempFile = path.join(tempDir, `swgc_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, buffer);

      if (m.isImage) {
        rawContent.image = buffer;
        rawContent.caption = text || "";
      } else if (m.isVideo) {
        rawContent.video = buffer;
        rawContent.caption = text || "";
      } else if (m.isAudio || m.mimetype?.startsWith("audio")) {
        rawContent.audio = buffer;
        rawContent.mimetype = fileType?.mime || m.mimetype || "audio/mpeg";
        rawContent.ptt = m.msg?.ptt || false;
      }
    } catch (e) {
      await m.reply(te(m.prefix, m.command, m.pushName));
      return;
    }
  } else if (text && text.trim()) {
    rawContent.text = text;
    rawContent.font = 0;
    rawContent.backgroundColor = "#128C7E";
  } else {
    await m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> \`${m.prefix}swgc teks\` - Story teks\n` +
      `> Reply gambar/video/audio + \`${m.prefix}swgc\`\n` +
      `> Kirim gambar/video + caption \`${m.prefix}swgc\``
    );
    return;
  }

  try {
    await m.react("🕕");

    let content = {};
    if (rawContent.image) {
      content = { image: rawContent.image, caption: rawContent.caption || "" };
    } else if (rawContent.video) {
      content = { video: rawContent.video, caption: rawContent.caption || "" };
    } else if (rawContent.audio) {
      content = {
        audio: rawContent.audio,
        mimetype: rawContent.mimetype || "audio/mpeg",
        ptt: rawContent.ptt || false,
      };
    } else if (rawContent.text) {
      content = { text: rawContent.text };
    }

    const sendResult = await sendGroupStatus(sock, groupJid, content);
    if (typeof sendResult === "string") {
      const syntheticRawMsg = buildSyntheticSwGcRawMessage(
        sock,
        groupJid,
        content,
        sendResult,
      );
      await handleAntiSwGc(syntheticRawMsg, sock, db);
    }

    const groupMeta = await sock.groupMetadata(groupJid);
    const groupName = groupMeta.subject;

    const mediaType = rawContent.text
      ? "Teks"
      : rawContent.image
        ? "Gambar"
        : rawContent.video
          ? "Video"
          : rawContent.audio
            ? "Audio"
            : "Media";

    await m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> 📤 Media: *${mediaType}*\n> 🏠 Grup: *${groupName}*`);

    if (tempFile && fs.existsSync(tempFile)) {
      setTimeout(() => {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }, 5000);
    }
  } catch (error) {
    await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Gagal posting story.\n> _${error.message}_`);
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  }
}

export { pluginConfig as config, handler, sendGroupStatus };