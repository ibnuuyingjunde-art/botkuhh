import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { handleAntiSwGc } from "../../src/lib/ichigo-group-protection.js";
import { generateWAMessage } from "ichigo";

const run = promisify(exec);
const botConfig = config;

async function toOggOpus(inputBuf) {
  const tmp = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const inp = path.join(tmp, `swgcv3_in_${id}`);
  const out = path.join(tmp, `swgcv3_out_${id}.ogg`);
  fs.writeFileSync(inp, inputBuf);
  await run(`ffmpeg -y -i "${inp}" -vn -map_metadata -1 -ac 1 -ar 48000 -c:a libopus -b:a 96k -vbr on -application audio -f ogg "${out}"`);
  const buf = fs.readFileSync(out);
  try { fs.unlinkSync(inp); } catch { }
  try { fs.unlinkSync(out); } catch { }
  return buf;
}

function generateWaveform(audioBuf, samples = 64) {
  const waveform = new Uint8Array(samples);
  const chunkSize = Math.floor(audioBuf.length / samples) || 1;
  for (let i = 0; i < samples; i++) {
    const offset = i * chunkSize;
    let sum = 0;
    const len = Math.min(chunkSize, audioBuf.length - offset);
    for (let j = 0; j < len; j++) {
      sum += Math.abs(audioBuf[offset + j] - 128);
    }
    waveform[i] = Math.min(255, Math.floor((sum / (len || 1)) * 2.5));
  }
  return waveform;
}

async function getAudioSeconds(buf) {
  const tmp = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const file = path.join(tmp, `swgcv3_dur_${id}.ogg`);
  fs.writeFileSync(file, buf);
  try {
    const { stdout } = await run(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`,
    );
    return Math.round(parseFloat(stdout)) || 0;
  } catch (e) {
    return 0;
  } finally {
    try { fs.unlinkSync(file); } catch { }
  }
}

function extractCloseFriendsFlag(rawText) {
  const text = rawText || "";
  const match = text.match(/^(cf|closefriend|close)\b\s*/i);
  if (!match) return { isCloseFriends: false, text, listName: null, listEmoji: null };

  let rest = text.slice(match[0].length);
  let listName = "Close Friends";
  let listEmoji = "💚";

  if (rest.includes("|")) {
    const segments = rest.split("|").map((s) => s.trim());
    rest = segments[0] || "";
    if (segments[1]) listName = segments[1];
    if (segments[2]) listEmoji = segments[2];
  }

  return { isCloseFriends: true, text: rest, listName, listEmoji };
}

const pluginConfig = {
  name: "swgcv3",
  alias: ["statusgrupv3"],
  category: "group",
  description: "Post Group Status V2 ke grup ini (khusus Admin Grup), support mode Close Friends",
  usage: ".swgcv3 <teks> atau reply media | .swgcv3 cf <teks> untuk mode Close Friends | .swgcv3 cf|ListName|Emoji <teks>",
  example: ".swgcv3 Halo semua! | .swgcv3 cf Halo close friends! | .swgcv3 cf|Sahabat|💚 Halo!",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, db }) {
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

    const participant = participants.find((p) => {
      const pId = p.id.includes("@") ? p.id : p.id + "@s.whatsapp.net";
      const sId = senderId.includes("@") ? senderId : senderId + "@s.whatsapp.net";
      return pId === sId;
    });

    if (participant && (participant.admin === "admin" || participant.admin === "superadmin")) {
      isAdmin = true;
    }
  } catch (e) {
    console.error("Error validasi admin:", e);
  }

  if (!isAdmin && m.isAdmin) isAdmin = true;
  if (!isAdmin && m.isGroupAdmin) isAdmin = true;

  const isOwner =
    m.sender === botConfig?.ownerNumber + "@s.whatsapp.net" ||
    m.sender === botConfig?.ownerNumber;

  if (!isAdmin && !isOwner) {
    await m.reply(
      `⚠️ *Akses Ditolak*\n\n> Hanya *Admin Grup* yang dapat menggunakan fitur ini!`,
    );
    return;
  }

  const { isCloseFriends, text, listName, listEmoji } = extractCloseFriendsFlag(m.text || "");

  let rawContent = {};
  let buffer, ext, tempFile;
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const mediaSource =
    m.quoted &&
      (m.quoted.isImage || m.quoted.isVideo || m.quoted.isAudio || m.quoted.mimetype?.startsWith("audio"))
      ? m.quoted
      : m.isImage || m.isVideo || m.isAudio || m.mimetype?.startsWith("audio")
        ? m
        : null;

  if (mediaSource) {
    try {
      buffer = await mediaSource.download();
      if (!buffer) {
        await m.reply(`❌ Gagal mengambil media.`);
        return;
      }
      const fileType = await fileTypeFromBuffer(buffer);
      ext = fileType?.ext || "bin";
      tempFile = path.join(tempDir, `swgcv3_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, buffer);

      if (mediaSource.isImage) {
        rawContent.image = buffer;
        rawContent.caption = text || "";
      } else if (mediaSource.isVideo) {
        rawContent.video = buffer;
        rawContent.caption = text || "";
      } else {
        const ptt = mediaSource.msg?.ptt || false;
        const opusBuf = await toOggOpus(buffer);
        rawContent.audio = opusBuf;
        rawContent.mimetype = "audio/ogg; codecs=opus";
        rawContent.ptt = ptt;
        rawContent.waveform = Array.from(generateWaveform(opusBuf));
        rawContent.seconds = await getAudioSeconds(opusBuf);
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
      `> \`${m.prefix}swgcv3 teks\` - Story (Semua Kontak)\n` +
      `> \`${m.prefix}swgcv3 cf teks\` - Story (Close Friends)\n` +
      `> \`${m.prefix}swgcv3 cf|ListName|Emoji teks\` - Custom list\n` +
      `> Reply gambar/video/audio + \`${m.prefix}swgcv3\` atau \`${m.prefix}swgcv3 cf\``,
    );
    return;
  }

  try {
    await m.react("🕕");

    let baseContent = {};
    if (rawContent.image) {
      baseContent = { image: rawContent.image, caption: rawContent.caption || "" };
    } else if (rawContent.video) {
      baseContent = { video: rawContent.video, caption: rawContent.caption || "" };
    } else if (rawContent.audio) {
      baseContent = {
        audio: rawContent.audio,
        mimetype: rawContent.mimetype || "audio/mpeg",
        ptt: rawContent.ptt || false,
      };
    } else if (rawContent.text) {
      baseContent = { text: rawContent.text };
    }

    const contextInfoExt = {
      isGroupStatus: true,
      statusSourceType: rawContent.text ? 4 : rawContent.audio ? 3 : rawContent.video ? 1 : 0,
      featureEligibilities: {
        canBeReshared: true,
        canBeSentToParticipants: true,
      },
      statusAttributions: [{ type: 10 }],
      statusAudienceMetadata: isCloseFriends
        ? { audienceType: 2, listName, listEmoji }
        : { audienceType: 0 },
    };

    if (rawContent.audio) {
      if (rawContent.waveform) baseContent.waveform = rawContent.waveform;
      if (rawContent.seconds) baseContent.seconds = rawContent.seconds;
    }

    const sentRaw = await sock.sendMessage(groupJid, {
      ...baseContent,
      groupStatus: true,
      contextInfo: contextInfoExt,
    });
    const sentMsg = sentRaw?.key?.id ?? sentRaw;

    if (typeof handleAntiSwGc === "function") {
      await handleAntiSwGc(sentMsg, sock, db);
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

    const modeLabel = isCloseFriends ? `Close Friends 💚 (${listName})` : "Semua Kontak 🌐";

    await m.reply(
      `✅ *ʙᴇʀʜᴀsɪʟ*\n\n> 📤 Media: *${mediaType}*\n> 🏠 Grup: *${groupName}*\n> 🎯 Mode: *${modeLabel}*`,
    );

    if (tempFile && fs.existsSync(tempFile)) {
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) { }
      }, 5000);
    }
  } catch (error) {
    await m.reply(`❌ *ᴇʀʀᴏʀ*\n\n> Gagal posting story V3.\n> _${error.message}_`);
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) { }
    }
  }
}

export { pluginConfig as config, handler };