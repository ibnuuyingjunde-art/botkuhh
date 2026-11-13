import fs from "fs";
import path from "path";

const pluginConfig = {
  name: "audioallmenu",
  alias: ["aam", "setaudioallmenu"],
  category: "owner",
  description: "Kelola audio allmenu",
  usage: ".audioallmenu set/del/info",
  example: ".audioallmenu set",
  isOwner: true,
  isPremium: false,
  isEnabled: true,
};

async function handler(m) {
  const action = (m.args?.[0] || "").toLowerCase();

  const audioDir = path.join(
    process.cwd(),
    "assets",
    "audio"
  );

  const audioPath = path.join(
    audioDir,
    "allmenu.mp3"
  );

  if (!action) {
    return m.reply(
`📀 *AUDIO ALLMENU*

• .audioallmenu set
> Reply audio untuk menyimpan

• .audioallmenu del
> Hapus audio

• .audioallmenu info
> Cek status audio`
    );
  }

  if (action === "info") {
    if (!fs.existsSync(audioPath)) {
      return m.reply("❌ Audio allmenu belum tersedia.");
    }

    const stat = fs.statSync(audioPath);

    return m.reply(
`✅ Audio allmenu tersedia

📁 File : allmenu.mp3
📦 Size : ${(stat.size / (1024 * 1024)).toFixed(2)} MB`
    );
  }

  if (action === "del") {
    if (!fs.existsSync(audioPath)) {
      return m.reply("❌ Audio allmenu tidak ditemukan.");
    }

    try {
      fs.unlinkSync(audioPath);
      return m.reply("✅ Audio allmenu berhasil dihapus.");
    } catch (err) {
      return m.reply(`❌ Gagal menghapus file: ${err.message}`);
    }
  }

  if (action === "set") {
    if (!m.quoted) {
      return m.reply(
        "Reply audio lalu ketik:\n*.audioallmenu set*"
      );
    }

    const quotedMsg = m.quoted.msg || m.quoted;
    const mime = m.quoted.mimetype || quotedMsg?.mimetype || "";
    const isAudioType = m.quoted.type === "audioMessage" || m.quoted.msgType === "audio" || !!quotedMsg?.audio;

    if (!mime.startsWith("audio/") && !isAudioType) {
      return m.reply(
        `❌ Yang direply harus berupa audio atau voice note.\nTipe terdeteksi: ${mime || m.quoted.type || "unknown"}`
      );
    }

    await m.reply("⏳ Sedang mengunduh dan menyimpan audio, mohon tunggu...");

    try {
      
      let downloadFunc = m.quoted.download || m.quoted.downloadMediaMessage || m.download;
      let buffer;

      if (typeof downloadFunc === "function") {
        buffer = await downloadFunc.call(m.quoted);
      } else if (m.msg?.download && typeof m.msg.download === "function") {
        buffer = await m.msg.download();
      }

      if (!buffer) {
        return m.reply("❌ Gagal mengunduh audio. Metode download tidak didukung oleh struktur base bot Anda.");
      }

      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, {
          recursive: true,
        });
      }

      fs.writeFileSync(audioPath, buffer);

      return m.reply(
        "✅ Audio allmenu berhasil disimpan.\nKini audio akan otomatis diputar saat menu dibuka."
      );
    } catch (error) {
      console.error(error);
      return m.reply(`❌ Terjadi kesalahan saat menyimpan audio: ${error.message}`);
    }
  }

  return m.reply(
    "❌ Pilihan tidak valid. Gunakan: *set*, *del*, atau *info*"
  );
}

export { pluginConfig as config, handler };