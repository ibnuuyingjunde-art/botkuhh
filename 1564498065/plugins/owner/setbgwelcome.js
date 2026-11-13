import fs from "fs";
import path from "path";

const pluginConfig = {
  name: "setbgwelcome",
  alias: ["bgwelcome", "changebgwelcome"],
  category: "owner",
  description: "Ganti background welcome/goodbye/statsgc",
  usage: ".setbgwelcome set/del/info/reset",
  example: ".setbgwelcome set",
  isOwner: true,
  isPremium: false,
  isEnabled: true,
};

const BG_DIR = path.join(process.cwd(), "assets", "images");
const BG_PATH = path.join(BG_DIR, "bg-welcome.jpg");
const BG_BACKUP_PATH = path.join(BG_DIR, "bg-welcome.backup.jpg");

async function handler(m) {
  const action = (m.args?.[0] || "").toLowerCase();

  if (!action) {
    return m.reply(
`🖼️ *SET BG WELCOME*

• .setbgwelcome set
> Reply gambar untuk mengganti background welcome/goodbye/statsgc

• .setbgwelcome info
> Cek status background saat ini

• .setbgwelcome del
> Hapus background (fallback ke error/kosong)

• .setbgwelcome reset
> Kembalikan ke background sebelumnya (backup terakhir)`
    );
  }

  if (action === "info") {
    if (!fs.existsSync(BG_PATH)) {
      return m.reply("❌ Background welcome belum tersedia.");
    }

    const stat = fs.statSync(BG_PATH);
    const hasBackup = fs.existsSync(BG_BACKUP_PATH);

    return m.reply(
`✅ Background welcome tersedia

📁 File   : bg-welcome.jpg
📦 Size   : ${(stat.size / (1024 * 1024)).toFixed(2)} MB
🗓️ Diubah : ${stat.mtime.toLocaleString("id-ID")}
🔄 Backup : ${hasBackup ? "ada" : "tidak ada"}`
    );
  }

  if (action === "del") {
    if (!fs.existsSync(BG_PATH)) {
      return m.reply("❌ Background welcome tidak ditemukan.");
    }

    try {
      fs.unlinkSync(BG_PATH);
      return m.reply("✅ Background welcome berhasil dihapus.");
    } catch (err) {
      return m.reply(`❌ Gagal menghapus file: ${err.message}`);
    }
  }

  if (action === "reset") {
    if (!fs.existsSync(BG_BACKUP_PATH)) {
      return m.reply("❌ Tidak ada backup background sebelumnya.");
    }

    try {
      fs.copyFileSync(BG_BACKUP_PATH, BG_PATH);
      return m.reply("✅ Background welcome dikembalikan ke versi sebelumnya.");
    } catch (err) {
      return m.reply(`❌ Gagal reset background: ${err.message}`);
    }
  }

  if (action === "set") {
    if (!m.quoted) {
      return m.reply(
        "Reply gambar lalu ketik:\n*.setbgwelcome set*"
      );
    }

    const quotedMsg = m.quoted.msg || m.quoted;
    const mime = m.quoted.mimetype || quotedMsg?.mimetype || "";
    const isImageType =
      m.quoted.type === "imageMessage" ||
      m.quoted.msgType === "image" ||
      !!quotedMsg?.image;

    if (!mime.startsWith("image/") && !isImageType) {
      return m.reply(
        `❌ Yang direply harus berupa gambar (jpg/png).\nTipe terdeteksi: ${mime || m.quoted.type || "unknown"}`
      );
    }

    await m.reply("⏳ Sedang mengunduh dan menyimpan background baru, mohon tunggu...");

    try {
      let downloadFunc = m.quoted.download || m.quoted.downloadMediaMessage || m.download;
      let buffer;

      if (typeof downloadFunc === "function") {
        buffer = await downloadFunc.call(m.quoted);
      } else if (m.msg?.download && typeof m.msg.download === "function") {
        buffer = await m.msg.download();
      }

      if (!buffer) {
        return m.reply("❌ Gagal mengunduh gambar. Metode download tidak didukung oleh struktur base bot Anda.");
      }

      if (!fs.existsSync(BG_DIR)) {
        fs.mkdirSync(BG_DIR, { recursive: true });
      }

      if (fs.existsSync(BG_PATH)) {
        fs.copyFileSync(BG_PATH, BG_BACKUP_PATH);
      }

      fs.writeFileSync(BG_PATH, buffer);

      return m.reply(
        "✅ Background welcome berhasil diganti.\nBerlaku otomatis untuk fitur welcome, goodbye, dan statsgc.\n\nGunakan *.setbgwelcome reset* jika ingin kembali ke background sebelumnya."
      );
    } catch (error) {
      console.error(error);
      return m.reply(`❌ Terjadi kesalahan saat menyimpan background: ${error.message}`);
    }
  }

  return m.reply(
    "❌ Pilihan tidak valid. Gunakan: *set*, *del*, *info*, atau *reset*"
  );
}

export { pluginConfig as config, handler };