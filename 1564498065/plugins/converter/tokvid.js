import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const pluginConfig = {
  name: "tokvid",
  alias: ["imagetovideo", "phototovideo", "itv"],
  category: "converter",
  description: "Gabungkan foto dan lagu menjadi video",
  usage: ".tokvid (reply foto)",
  example: ".tokvid (reply foto)",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

const TMP = "./tmp";
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const waiting = new Map();

function getMime(obj) {
  if (!obj) return "";
  return (
    obj.mimetype ||
    obj.msg?.mimetype ||
    obj.message?.imageMessage?.mimetype ||
    obj.message?.audioMessage?.mimetype ||
    obj.message?.mimetype ||
    ""
  );
}

function getMsgType(obj) {
  if (!obj) return "";
  return (
    obj.mtype ||
    obj.type ||
    (obj.message ? Object.keys(obj.message)[0] : "") ||
    ""
  );
}

async function handler(m, { sock }) {
  const userId = m.sender;

  if (waiting.has(userId)) {
    const directMime = getMime(m);
    const directType = getMsgType(m);
    const quotedMime = getMime(m.quoted);
    const quotedType = getMsgType(m.quoted);

    const isDirectAudio =
      directMime.startsWith("audio/") ||
      directMime.includes("ogg") ||
      directType === "audioMessage";

    const isQuotedAudio =
      quotedMime.startsWith("audio/") ||
      quotedMime.includes("ogg") ||
      quotedType === "audioMessage";

    if (!isDirectAudio && !isQuotedAudio) {
      return m.reply("❌ Itu bukan audio! Kirim atau reply file audio/lagu ya.");
    }

    const { imgBuffer, id } = waiting.get(userId);
    waiting.delete(userId);

    m.react("🕕");

    const imgPath = path.join(TMP, `${id}_img.jpg`);
    const audPath = path.join(TMP, `${id}_aud.mp3`);
    const outPath = path.join(TMP, `${id}_out.mp4`);

    try {
      fs.writeFileSync(imgPath, imgBuffer);

      const audBuffer = isDirectAudio
        ? await m.download()
        : await m.quoted.download();
      fs.writeFileSync(audPath, audBuffer);

      const { stdout: durOut } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audPath}"`
      );
      const duration = parseFloat(durOut.trim()) || 60;

      const { stdout: dimOut } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${imgPath}"`
      );
      let [imgW, imgH] = dimOut.trim().split("x").map(Number);

      imgW = imgW % 2 === 0 ? imgW : imgW - 1;
      imgH = imgH % 2 === 0 ? imgH : imgH - 1;

      const MAX_DIM = 1280;
      if (imgW > MAX_DIM || imgH > MAX_DIM) {
        if (imgW >= imgH) {
          imgH = Math.round((imgH * MAX_DIM) / imgW / 2) * 2;
          imgW = MAX_DIM;
        } else {
          imgW = Math.round((imgW * MAX_DIM) / imgH / 2) * 2;
          imgH = MAX_DIM;
        }
      }

      await execAsync(
        `ffmpeg -y -loop 1 -i "${imgPath}" -i "${audPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -t ${duration} -vf "scale=${imgW}:${imgH}" "${outPath}"`
      );

      const videoBuffer = fs.readFileSync(outPath);

      m.react("✅");
      await sock.sendMessage(
        m.chat,
        {
          video: videoBuffer,
          caption: "🎬 *Video berhasil dibuat!*",
          mimetype: "video/mp4",
        },
        { quoted: m }
      );
    } catch (error) {
      console.error("[TOKVID]", error.message);
      m.react("☢");
      m.reply("😔 *Gagal membuat video.*\n\nPastikan ffmpeg terinstall di server.");
    } finally {
      [imgPath, audPath, outPath].forEach((f) => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    }

    return;
  }

  const quoted = m.quoted;
  if (!quoted) {
    return m.reply(
      `🎬 *ᴠɪᴅᴇᴏ ᴍᴀᴋᴇʀ*\n\n> Reply foto dulu ya!\n\n\`Contoh: ${m.prefix}tokvid\` (sambil reply foto)`
    );
  }

  const mime = getMime(quoted);
  const mtype = getMsgType(quoted);

  const isImage =
    mime.startsWith("image/") ||
    mtype === "imageMessage" ||
    mtype === "image";

  if (!isImage) {
    return m.reply("❌ Yang di-reply harus foto ya!");
  }

  const imgBuffer = await quoted.download();
  const id = Date.now();

  waiting.set(userId, { imgBuffer, id });

  setTimeout(() => {
    if (waiting.has(userId)) {
      waiting.delete(userId);
    }
  }, 2 * 60 * 1000);

  m.reply("✅ *Foto diterima!*\n\nSekarang kirim atau reply audio/lagunya ya. Kamu punya waktu *2 menit*.");
}

export { pluginConfig as config, handler };