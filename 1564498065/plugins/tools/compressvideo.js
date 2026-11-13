import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";

const pluginConfig = {
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

async function handler(m, { sock }) {
  const quoted = m.quoted;

  if (!quoted?.mimetype?.startsWith("video")) {
    return m.reply("❌ Reply video yang ingin dikompres.");
  }

  const sizeMB = ((quoted.fileLength || 0) / (1024 * 1024)).toFixed(2);
  if (parseFloat(sizeMB) > 100) {
    return m.reply("❌ Ukuran video maksimal 100MB.");
  }

  await m.reply(`⏳ Mengunduh video (${sizeMB}MB)...`);

  let inputPath, outputPath;

  try {
    
    const buffer = await sock.downloadMediaMessage(quoted);
    inputPath  = `${os.tmpdir()}/input_${Date.now()}.mp4`;
    outputPath = `${os.tmpdir()}/output_${Date.now()}.mp4`;
    fs.writeFileSync(inputPath, buffer);

    await m.reply("⚙️ Mengompres video, harap tunggu...");

    await new Promise((resolve, reject) => {
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
    });

    const inputSize  = (fs.statSync(inputPath).size  / (1024 * 1024)).toFixed(2);
    const outputSize = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    const saved      = (((inputSize - outputSize) / inputSize) * 100).toFixed(1);

    const resultBuffer = fs.readFileSync(outputPath);

    await sock.sendMessage(m.chat, {
      video: resultBuffer,
      caption: `✅ *Video berhasil dikompres!*\n\n` +
               `📥 Sebelum : *${inputSize}MB*\n` +
               `📤 Sesudah : *${outputSize}MB*\n` +
               `💾 Hemat   : *${saved}%*`,
      mimetype: "video/mp4",
    }, { quoted: m });

  } catch (err) {
    console.error("CompressVid Error:", err);
    await m.reply("❌ Gagal mengompres video. Pastikan ffmpeg terinstall di server.");
  } finally {
    
    if (inputPath  && fs.existsSync(inputPath))  fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
}

export { pluginConfig as config, handler };