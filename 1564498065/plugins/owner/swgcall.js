import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { config } from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { handleAntiSwGc } from "../../src/lib/ichigo-group-protection.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
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
  name: "swgcall",
  alias: ["statusgrupall", "swgroupall", "groupstoryall", "storyall"],
  category: "owner",
  description: "Post Group Status/Story ke SEMUA grup atau pilih grup (khusus Owner)",
  usage: ".swgcall <teks> atau reply media",
  example: ".swgcall Halo semua grup!",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const pendingSwgcall = new Map();

async function sendGroupStatus(sock, jid, content) {
  const sent = await sock.sendMessage(jid, { ...content, groupStatus: true });
  return sent?.key?.id ?? sent;
}

async function sendToAllGroups(sock, db, rawContent, m, groupList) {
  let successCount = 0;
  let failCount = 0;
  const failedGroups = [];

  await m.reply(`🕕 *Mengirim story ke ${groupList.length} grup...*\n\n_Prosses mengirim..._`);

  for (const [groupId, meta] of groupList) {
    try {
      let content = {};

      if (rawContent.image) {
        content = {
          image: rawContent.image,
          caption: rawContent.caption || "",
        };
      } else if (rawContent.video) {
        content = {
          video: rawContent.video,
          caption: rawContent.caption || "",
        };
      } else if (rawContent.audio) {
        content = {
          audio: rawContent.audio,
          mimetype: rawContent.mimetype || "audio/mpeg",
          ptt: rawContent.ptt || false,
        };
      } else if (rawContent.text) {
        content = { text: rawContent.text };
      }

      const sendResult = await sendGroupStatus(sock, groupId, content);
      if (typeof sendResult === "string") {
        const syntheticRawMsg = buildSyntheticSwGcRawMessage(
          sock,
          groupId,
          content,
          sendResult,
        );
        await handleAntiSwGc(syntheticRawMsg, sock, db);
      }

      successCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      failCount++;
      failedGroups.push(meta.subject || groupId);
    }
  }

  const mediaType = rawContent.text
    ? "Teks"
    : rawContent.image
      ? "Gambar"
      : rawContent.video
        ? "Video"
        : rawContent.audio
          ? "Audio"
          : "Media";

  let reportMsg = `✅ *ʟᴀᴘᴏʀᴀɴ ᴘᴇɴɢɪʀɪᴍᴀɴ sᴡ ᴀʟʟ ɢʀᴏᴜᴘ*\n\n` +
    `> 📤 Media: *${mediaType}*\n` +
    `> ✅ Berhasil: *${successCount}* grup\n` +
    `> ❌ Gagal: *${failCount}* grup\n`;

  if (failedGroups.length > 0 && failedGroups.length <= 10) {
    reportMsg += `\n*❌ Grup Gagal:*\n`;
    failedGroups.forEach((g) => {
      reportMsg += `> • ${g}\n`;
    });
  }

  await m.reply(reportMsg);
}

async function handler(m, { sock, db }) {
  const args = m.args || [];
  const text = m.text || "";

  if (args[0] === "--confirm" && args[1]) {
    const targetGroupId = args[1];
    const pendingData = pendingSwgcall.get(m.sender);

    if (!pendingData) {
      await m.reply(`⚠️ *Tidak ada data pending. Silakan kirim ulang media + .swgcall*`);
      return;
    }

    try {
      let groupName = "Grup";
      try {
        const meta = await sock.groupMetadata(targetGroupId);
        groupName = meta.subject;
      } catch (e) {}

      await m.react("🕕");

      const rawContent = pendingData.rawContent;
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

      const sendResult = await sendGroupStatus(sock, targetGroupId, content);
      if (typeof sendResult === "string") {
        const syntheticRawMsg = buildSyntheticSwGcRawMessage(
          sock,
          targetGroupId,
          content,
          sendResult,
        );
        await handleAntiSwGc(syntheticRawMsg, sock, db);
      }

      await m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Story berhasil dikirim ke grup *${groupName}*`);
      pendingSwgcall.delete(m.sender);

      if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
        setTimeout(() => {
          try { fs.unlinkSync(pendingData.tempFile); } catch (e) {}
        }, 5000);
      }
    } catch (error) {
      await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Gagal posting story.\n> _${error.message}_`);
    }
    return;
  }

  if (args[0] === "--all") {
    const pendingData = pendingSwgcall.get(m.sender);

    if (!pendingData) {
      await m.reply(`⚠️ *Tidak ada data pending. Silakan kirim ulang media + .swgcall*`);
      return;
    }

    try {
      global.isFetchingGroups = true;
      const groups = await sock.groupFetchAllParticipating();
      global.isFetchingGroups = false;
      const groupList = Object.entries(groups);

      if (groupList.length === 0) {
        await m.reply(`⚠️ *Bot tidak berada di grup manapun.*`);
        return;
      }

      await sendToAllGroups(sock, db, pendingData.rawContent, m, groupList);
      pendingSwgcall.delete(m.sender);

      if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
        setTimeout(() => {
          try { fs.unlinkSync(pendingData.tempFile); } catch (e) {}
        }, 5000);
      }
    } catch (error) {
      await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Gagal mengirim ke semua grup.\n> _${error.message}_`);
    }
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
      tempFile = path.join(tempDir, `swgcall_${Date.now()}.${ext}`);
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
      tempFile = path.join(tempDir, `swgcall_${Date.now()}.${ext}`);
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
      `> \`${m.prefix}swgcall teks\` - Story teks\n` +
      `> Reply gambar/video/audio + \`${m.prefix}swgcall\`\n` +
      `> Kirim gambar/video + caption \`${m.prefix}swgcall\``
    );
    return;
  }

  pendingSwgcall.set(m.sender, {
    rawContent: rawContent,
    tempFile: tempFile,
    timestamp: Date.now(),
  });

  try {
    global.isFetchingGroups = true;
    const groups = await sock.groupFetchAllParticipating();
    global.isFetchingGroups = false;
    const groupList = Object.entries(groups);

    if (groupList.length === 0) {
      await m.reply(`⚠️ *Bot tidak berada di grup manapun.*`);
      return;
    }

    const groupRows = groupList.map(([id, meta]) => ({
      title: meta.subject || "Unknown Group",
      description: id,
      id: `${m.prefix}swgcall --confirm ${id}`,
    }));

    const prefix = m.prefix || ".";
    const mediaType = rawContent.text
      ? "Teks"
      : rawContent.image
        ? "Gambar"
        : rawContent.video
          ? "Video"
          : rawContent.audio
            ? "Audio"
            : "Media";

    await sock.sendMessage(m.chat, {
      text:
        `📋 *sᴡ ᴀʟʟ ɢʀᴏᴜᴘ - ᴘɪʟɪʜ ᴀᴋsɪ*\n\n` +
        `> 📤 Media: *${mediaType}*\n` +
        `> 📊 Total Grup: *${groupList.length}*\n\n` +
        `_Pilih mode pengiriman di bawah:_`,
      contextInfo: {
        ...saluranCtx(),
        forwardedNewsletterMessageInfo: {
          newsletterJid: botConfig?.saluran?.id,
          newsletterName: botConfig?.saluran?.name,
        },
      },
      footer: "IchigoStrife - SW All Group",
      interactiveButtons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📢 Kirim ke Semua Grup",
            id: `${prefix}swgcall --all`,
          }),
        },
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎯 Pilih Grup Spesifik",
            sections: [
              {
                title: "Daftar Grup",
                rows: groupRows,
              },
            ],
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "❌ Batal",
            id: `${prefix}cancelswgc`,
          }),
        },
      ],
    });
  } catch (error) {
    await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Gagal mengambil daftar grup.\n> _${error.message}_`);
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
    pendingSwgcall.delete(m.sender);
  }
}

export { pluginConfig as config, handler, sendGroupStatus, pendingSwgcall };