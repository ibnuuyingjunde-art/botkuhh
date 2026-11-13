import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import te from "../../src/lib/ichigo-error.js";

const CHANNEL_JID = "120363409557700746@newsletter";
const STATUS_JID = "status@broadcast";

const pluginConfig = {
  name: "swch",
  alias: ["statuschannel", "swchannel", "channelstory", "toswch"],
  category: "owner",
  description: "Post Status WA + Channel/Saluran sekaligus",
  usage: ".swch <teks> atau reply media",
  example: ".swch Halo semua!",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text || "";

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
      tempFile = path.join(tempDir, `swch_${Date.now()}.${ext}`);
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
      tempFile = path.join(tempDir, `swch_${Date.now()}.${ext}`);
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
  } else {
    await m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
        `> \`${m.prefix}swch teks\` - Post teks\n` +
        `> Reply gambar/video/audio + \`${m.prefix}swch\`\n` +
        `> Kirim gambar/video + caption \`${m.prefix}swch\``,
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

    try {
      let statusJidList = [];
      try {
        const contacts = sock.store?.contacts || {};
        statusJidList = Object.keys(contacts).filter((jid) =>
          jid.endsWith("@s.whatsapp.net"),
        );
      } catch (e) {}

      await sock.sendMessage(
        STATUS_JID,
        content,
        statusJidList.length ? { statusJidList, broadcast: true } : {},
      );
    } catch (e) {
      console.error("[swch] gagal post status:", e.message);
    }

    await sock.sendMessage(CHANNEL_JID, content);

    await m.reply(`✅ Berhasil post ke Status & Channel.`);

    if (tempFile && fs.existsSync(tempFile)) {
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {}
      }, 5000);
    }
  } catch (error) {
    await m.reply(
      `❌ *ᴇʀʀᴏʀ*\n\n` + `> Gagal posting ke channel.\n` + `> _${error.message}_`,
    );
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    }
  }
}

export { pluginConfig as config, handler };