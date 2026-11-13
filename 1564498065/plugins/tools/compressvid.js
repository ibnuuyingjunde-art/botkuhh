import { ffmpeg } from "../../src/lib/ichigo-lazy.js";
import fs from "fs";
import os from "os";

export const config = {
  name: "compressvid",
  alias: ["cvid", "compress"],
  category: "tools",
  description: "Kompres video agar ukurannya lebih kecil",
  usage: ".compressvid [reply video]",
  example: ".compressvid",
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

export async function handler(m, { sock }) {
  const quoted = m.quoted;

  const mimetype =
    quoted?.mimetype ||
    quoted?.msg?.mimetype ||
    quoted?.message?.videoMessage?.mimetype ||
    quoted?.message?.documentMessage?.mimetype ||
    "";

  const isVideo =
    mimetype.startsWith("video") ||
    !!quoted?.message?.videoMessage ||
    !!quoted?.msg?.videoMessage;

  if (!quoted || !isVideo) {
    return m.reply("❌ Reply video yang ingin dikompres.");
  }

  const fileLength =
    quoted?.fileLength ||
    quoted?.msg?.fileLength ||
    quoted?.message?.videoMessage?.fileLength ||
    0;

  const sizeMB = Number((fileLength / (1024 * 1024)).toFixed(2));

  if (sizeMB > 100) {
    return m.reply("❌ Ukuran video maksimal 100MB.");
  }

  if (sizeMB > 0 && sizeMB < 1) {
    return m.reply("ℹ️ Video sudah sangat kecil, tidak perlu dikompres.");
  }

  await m.reply(`⏳ Mengunduh video (${sizeMB}MB)...`);

  let inputPath, outputPath;

  try {
    const buffer = await quoted.download();

    if (!buffer || buffer.length < 1024) {
      throw new Error("Buffer kosong atau terlalu kecil, gagal mendownload video.");
    }

    inputPath  = `${os.tmpdir()}/cvid_in_${Date.now()}.mp4`;
    outputPath = `${os.tmpdir()}/cvid_out_${Date.now()}.mp4`;
    fs.writeFileSync(inputPath, buffer);

    await m.reply("⚙️ Mengompres video, harap tunggu...");

    await Promise.race([
      new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-crf 28",
            "-preset fast",
            "-vf scale=-2:720",
            "-movflags +faststart",
          ])
          .output(outputPath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout: ffmpeg melebihi 5 menit.")), 5 * 60 * 1000)
      ),
    ]);

    const inputSize  = Number((fs.statSync(inputPath).size  / (1024 * 1024)).toFixed(2));
    const outputSize = Number((fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2));

    if (outputSize >= inputSize) {
      await m.reply(
        `ℹ️ Video tidak dapat dikompres lebih kecil.\n` +
        `Ukuran tetap: *${inputSize}MB*`
      );
      return;
    }

    const saved = (((inputSize - outputSize) / inputSize) * 100).toFixed(1);
    const resultBuffer = fs.readFileSync(outputPath);

    await sock.sendMessage(
      m.chat,
      {
        video: resultBuffer,
        caption:
          `✅ *Video berhasil dikompres!*\n\n` +
          `📥 Sebelum : *${inputSize}MB*\n` +
          `📤 Sesudah : *${outputSize}MB*\n` +
          `💾 Hemat   : *${saved}%*`,
        mimetype: "video/mp4",
      },
      { quoted: m }
    );

  } catch (err) {
    console.error("[CompressVid Error]", err.message);
    const msg = err.message.includes("Timeout")
      ? "❌ Gagal: proses ffmpeg terlalu lama (timeout 5 menit)."
      : "❌ Gagal mengompres video. Pastikan ffmpeg terinstall di server.";
    await m.reply(msg);
  } finally {
    if (inputPath  && fs.existsSync(inputPath))  fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}