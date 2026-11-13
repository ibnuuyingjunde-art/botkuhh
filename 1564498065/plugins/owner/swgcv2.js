import { getAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { config } from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { handleAntiSwGc } from "../../src/lib/ichigo-group-protection.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const botConfig = config;

function extractCloseFriendsFlag(rawText) {
  const text = rawText || "";
  const match = text.match(/^(cf|closefriend|close)\b\s*/i);
  if (match) {
    return { isCloseFriends: true, text: text.slice(match[0].length) };
  }
  return { isCloseFriends: false, text };
}

const pluginConfig = {
  name: "swgcv2",
  alias: ["statusgrupv2"],
  category: "owner",
  description: "Post Group Status V2 ke grup pilihan",
  usage: ".swgcv2 <teks> atau reply media | .swgcv2 cf <teks> untuk mode Close Friends",
  example: ".swgcv2 Halo semua! | .swgcv2 cf Halo close friends!",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const pendingSwgcV2 = new Map();

async function handler(m, { sock, db }) {
  const args = m.args || [];

  if (args[0] === "--confirm" && args[1]) {
    const targetGroupId = args[1];
    const pendingData = pendingSwgcV2.get(m.sender);

    if (!pendingData) {
      await m.reply(
        `⚠️ *Tidak ada data pending. Silakan kirim ulang media + .swgcv2*`,
      );
      return;
    }

    try {
      let groupName = "Grup";
      try {
        const meta = await sock.groupMetadata(targetGroupId);
        groupName = meta.subject;
      } catch (e) { }

      await m.react("🕕");

      const rawContent = pendingData.rawContent;
      const isCloseFriends = !!pendingData.isCloseFriends;

      let baseContent = {};
      if (rawContent.image) {
        baseContent = { image: rawContent.image, caption: rawContent.caption || "" };
      } else if (rawContent.video) {
        baseContent = { video: rawContent.video, caption: rawContent.caption || "" };
      } else if (rawContent.audio) {
        baseContent = { audio: rawContent.audio, mimetype: rawContent.mimetype || "audio/mpeg", ptt: rawContent.ptt || false };
      } else if (rawContent.text) {
        baseContent = { text: rawContent.text };
      }

      const sentMsg = await sock.swgc(targetGroupId, baseContent, {
        closeFriends: isCloseFriends,
      });

      await handleAntiSwGc(sentMsg, sock, db);

      const modeLabel = isCloseFriends ? "Close Friends 💚" : "Semua Kontak 🌐";
      const successMsg = `✅ Berhasil up sw (V2) ke grup ${groupName}\n> Mode: *${modeLabel}*`;

      await m.reply(successMsg);
      pendingSwgcV2.delete(m.sender);

      if (pendingData.tempFile && fs.existsSync(pendingData.tempFile)) {
        setTimeout(() => {
          try {
            fs.unlinkSync(pendingData.tempFile);
          } catch (e) { }
        }, 5000);
      }
    } catch (error) {
      await m.reply(
        `❌ *ᴇʀʀᴏʀ*\n\n` + `> Gagal posting story V2.\n` + `> _${error.message}_`,
      );
    }
    return;
  }

  const { isCloseFriends, text } = extractCloseFriendsFlag(m.text || "");

  let rawContent = {};
  let buffer, ext, tempFile;
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  if (
    m.quoted &&
    (m.quoted.isImage ||
      m.quoted.isVideo ||
      m.quoted.isAudio ||
      m.quoted.mimetype?.startsWith("audio"))
  ) {
    try {
      buffer = await m.quoted.download();
      if (!buffer) {
        await m.reply(`❌ Gagal mengambil media.`);
        return;
      }
      const fileType = await fileTypeFromBuffer(buffer);
      ext = fileType?.ext || "bin";
      tempFile = path.join(tempDir, `swgcv2_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, buffer);

      if (m.quoted.isImage) {
        rawContent.image = buffer;
        rawContent.caption = text || "";
      } else if (m.quoted.isVideo) {
        rawContent.video = buffer;
        rawContent.caption = text || "";
      } else if (m.quoted.isAudio || m.quoted.mimetype?.startsWith("audio")) {
        rawContent.audio = buffer;
        rawContent.mimetype =
          fileType?.mime || m.quoted.mimetype || "audio/mpeg";
        rawContent.ptt = m.quoted.msg?.ptt || false;
      }
    } catch (e) {
      await m.reply(te(m.prefix, m.command, m.pushName));
      return;
    }
  } else if (
    m.isImage ||
    m.isVideo ||
    m.isAudio ||
    m.mimetype?.startsWith("audio")
  ) {
    try {
      buffer = await m.download();
      if (!buffer) {
        await m.reply(`❌ Gagal mengambil media.`);
        return;
      }
      const fileType = await fileTypeFromBuffer(buffer);
      ext = fileType?.ext || "bin";
      tempFile = path.join(tempDir, `swgcv2_${Date.now()}.${ext}`);
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
      `> \`${m.prefix}swgcv2 teks\` - Story teks (semua kontak)\n` +
      `> \`${m.prefix}swgcv2 cf teks\` - Story teks (Close Friends)\n` +
      `> Reply gambar/video/audio + \`${m.prefix}swgcv2\` atau \`${m.prefix}swgcv2 cf\`\n` +
      `> Kirim gambar/video + caption \`${m.prefix}swgcv2\` atau \`${m.prefix}swgcv2 cf\``,
    );
    return;
  }

  pendingSwgcV2.set(m.sender, {
    rawContent: rawContent,
    tempFile: tempFile,
    isCloseFriends: isCloseFriends,
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
      id: `${m.prefix}swgcv2 --confirm ${id}`,
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

    const modeLabel = isCloseFriends ? "Close Friends 💚" : "Semua Kontak 🌐";

    let thumbnail = null;
    try {
      thumbnail = getAssetBuffer("ichigo2");
    } catch (e) { }

    await sock.sendMessage(m.chat, {
      text:
        `📋 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ᴘᴏsᴛ sᴛᴏʀʏ ᴠ2*\n\n` +
        `> Media: *${mediaType}*\n` +
        `> Mode: *${modeLabel}*\n` +
        `> Total Grup: *${groupList.length}*\n\n` +
        `_Pilih grup dari daftar di bawah:_`,
      contextInfo: {
        ...saluranCtx(),
        forwardedNewsletterMessageInfo: {
          newsletterJid: botConfig?.saluran?.id,
          newsletterName: botConfig?.saluran?.name,
        },
      },
      footer: "Ichigo Strife MD",
      interactiveButtons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🏠 Pilih Grup",
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
            id: `${prefix}cancelswgcv2`,
          }),
        },
      ],
    });
  } catch (error) {
    await m.reply(
      `❌ *ᴇʀʀᴏʀ*\n\n` +
      `> Gagal mengambil daftar grup.\n` +
      `> _${error.message}_`,
    );
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) { }
    }
    pendingSwgcV2.delete(m.sender);
  }
}

export { pluginConfig as config, handler, pendingSwgcV2 };