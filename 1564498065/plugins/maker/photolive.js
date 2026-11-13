import { prepareWAMessageMedia, generateWAMessageFromContent } from "ichigo";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const execAsync = promisify(exec);

const pluginConfig = {
  name: "photolive",
  alias: ["livephoto", "fotolive"],
  category: "maker",
  description: "Membuat efek Live Photo (Foto Live iOS) dari video yang direply.",
  usage: ".photolive [reply video]",
  example: "Balas video dengan .photolive",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

// Fungsi untuk mengekstrak frame pertama dari video sebagai gambar Live Photo
function extractFirstFrame(videoBuffer) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const randomName = crypto.randomBytes(6).toString("hex");
    const videoPath = path.join(tempDir, `photolive_${randomName}.mp4`);
    const imagePath = path.join(tempDir, `photolive_${randomName}.jpg`);

    fs.writeFile(videoPath, videoBuffer, async (err) => {
      if (err) return reject(err);

      const cmd = `ffmpeg -i "${videoPath}" -vframes 1 -q:v 2 -y "${imagePath}"`;

      try {
        const { stderr } = await execAsync(cmd);
        if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
          throw new Error(`ffmpeg menghasilkan output kosong. stderr: ${stderr}`);
        }
        const imageBuffer = fs.readFileSync(imagePath);
        resolve(imageBuffer);
      } catch (e) {
        reject(e);
      } finally {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    });
  });
}

async function handler(m, { sock }) {
  // quoted.mimetype gak ada langsung di object quoted (lihat ichigo-serialize.js),
  // mimetype aslinya nempel di quoted.message[quoted.type].mimetype (field proto WA).
  const quotedMimetype = m.quoted?.message?.[m.quoted?.type]?.mimetype || "";
  const isQuotedVideo = !!m.quoted && quotedMimetype.includes("video");

  if (!isQuotedVideo) {
    return m.reply(
      `📸 *Live Photo Maker*\n\n` +
        `Silakan balas (reply) sebuah video dengan perintah \`${m.prefix}${m.command}\` untuk menjadikannya Foto Live.`
    );
  }

  await m.react("⏳");

  try {
    // 1. Download video dari pesan yang direply
    const videoBuffer = await m.quoted.download();
    if (!videoBuffer) throw new Error("Gagal mengunduh video.");

    // 2. Ekstrak gambar dari video buffer
    const imageBuffer = await extractFirstFrame(videoBuffer);

    // 3. Persiapkan media (upload ke server WA)
    const imageMedia = await prepareWAMessageMedia(
      { image: imageBuffer },
      { upload: sock.waUploadToServer }
    );

    const videoMedia = await prepareWAMessageMedia(
      { video: videoBuffer },
      { upload: sock.waUploadToServer }
    );

    // 4. Generate & kirim pesan gambar (Paired Media 5)
    const msg = generateWAMessageFromContent(
      m.chat,
      {
        imageMessage: {
          ...imageMedia.imageMessage,
          contextInfo: {
            pairedMediaType: 5,
            statusSourceType: 0,
          },
        },
      },
      {}
    );

    await sock.relayMessage(m.chat, msg.message, {
      messageId: msg.key.id,
    });

    // 5. Generate & kirim pesan video (Paired Media 6 yang diasosiasikan)
    await sock.relayMessage(
      m.chat,
      {
        videoMessage: {
          ...videoMedia.videoMessage,
          contextInfo: {
            pairedMediaType: 6,
            statusSourceType: 0,
          },
        },
        messageContextInfo: {
          messageAssociation: {
            associationType: 12,
            parentMessageKey: msg.key,
          },
        },
      },
      {}
    );

    await m.react("✅");
  } catch (error) {
    console.error("[PhotoLive Plugin Error]:", error);
    await m.react("❌");
    m.reply(`Maaf *${m.pushName}*, terjadi kesalahan saat membuat Foto Live: ${error.message || error}`);
  }
}

export { pluginConfig as config, handler };