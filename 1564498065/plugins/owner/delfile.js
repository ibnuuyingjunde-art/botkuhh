import fs from "fs";
import path from "path";
import { unloadPlugin } from "../../src/lib/ichigo-plugins.js";
import te from "../../src/lib/ichigo-error.js";
import { ROOT_DIR, smartResolve } from "../../src/lib/ichigo-filefinder.js";

const pluginConfig = {
  name: "delfile",
  alias: ["hapusfile", "removefile", "rmfile"],
  category: "owner",
  description:
    "Hapus file apapun di project langsung dari WhatsApp. Cukup nama filenya aja, gak perlu tahu path lengkap. File otomatis di-backup dulu sebelum dihapus.",
  usage: ".delfile <nama_file / path> confirm",
  example: ".delfile ichigo-builder.js confirm",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}

async function handler(m, { sock }) {
  const args = [...(m.args || [])];
  const lastArg = (args[args.length - 1] || "").toLowerCase();
  const isConfirmed = lastArg === "confirm" || lastArg === "yes" || lastArg === "ya";
  if (isConfirmed) args.pop();

  const rawInput = args.join(" ").trim();

  if (!rawInput) {
    return m.reply(
      `🗑️ *DEL FILE*\n\n` +
        `Hapus file apapun dari project langsung dari WhatsApp.\n\n` +
        `*Usage:*\n` +
        `\`${m.prefix}delfile <nama_file / path> confirm\`\n\n` +
        `*Contoh:*\n` +
        `• \`${m.prefix}delfile ichigo-builder.js confirm\`\n` +
        `• \`${m.prefix}delfile plugins/tools/oldfeature.js confirm\`\n\n` +
        `📌 Cukup nama filenya aja (tanpa path), bot cari otomatis di seluruh project.\n` +
        `⚠️ File otomatis di-backup ke \`backup/files\` sebelum dihapus.\n` +
        `⚠️ Wajib tambahkan \`confirm\` di akhir supaya gak ke-hapus gak sengaja.`,
    );
  }

  const resolved = smartResolve(rawInput);

  if (resolved.status === "invalid") {
    return m.reply("🚫 Akses ditolak! Kamu tidak bisa mengakses path di luar direktori bot.");
  }

  if (resolved.status === "notfound") {
    return m.reply(`❓ File tidak ditemukan:\n\`${rawInput}\``);
  }

  if (resolved.status === "ambiguous") {
    const list = resolved.matches.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
    return m.reply(
      `🔎 Ada ${resolved.matches.length} file bernama *"${rawInput}"*, ketik path lengkapnya:\n\n${list}\n\n` +
        `Contoh: \`${m.prefix}delfile ${resolved.matches[0]} confirm\``,
    );
  }

  const targetPath = resolved.path;
  const relPath = resolved.relPath;

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    return m.reply(
      `🚫 \`${relPath}\` adalah folder, bukan file. Plugin ini cuma bisa hapus file.`,
    );
  }

  if (!isConfirmed) {
    return m.reply(
      `⚠️ *KONFIRMASI HAPUS FILE*\n\n` +
        `╭─〔 *DETAIL* 〕───⬣\n` +
        `│ 📄 Path : \`${relPath}\`\n` +
        `│ ⚖️ Size : \`${formatBytes(stat.size)}\`\n` +
        `╰───────⬣\n\n` +
        `File akan di-backup dulu sebelum dihapus, tapi tetap pastikan ini benar.\n\n` +
        `Ketik ulang dengan menambahkan \`confirm\`:\n` +
        `> \`${m.prefix}delfile ${relPath} confirm\``,
    );
  }

  await m.react("🕕");

  try {
    const backupDir = path.join(ROOT_DIR, "backup", "files");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const flatName = relPath.replace(/[\\/]/g, "_");
    const ext = path.extname(targetPath);
    const backupPath = path.join(backupDir, `${flatName}_${timestamp}${ext || ""}`);
    fs.copyFileSync(targetPath, backupPath);

    const relFromRoot = path.relative(ROOT_DIR, targetPath).replace(/\\/g, "/");
    const isPluginFile = relFromRoot.startsWith("plugins/") && /\.m?js$/i.test(ext);

    let unloadNote = "-";
    if (isPluginFile) {
      try {
        const result = unloadPlugin(targetPath) || { success: true };
        unloadNote = result.success ? "✅ Sukses" : "⚠️ Gagal (mungkin masih nyangkut sampai restart)";
      } catch {
        unloadNote = "⚠️ Gagal (mungkin masih nyangkut sampai restart)";
      }
    }

    fs.unlinkSync(targetPath);

    await m.react("✅");

    let replyText =
      `✅ *FILE DIHAPUS*\n\n` +
      `╭─〔 *DETAIL* 〕───⬣\n` +
      `│ 📄 Path   : \`${relPath}\`\n` +
      `│ ⚖️ Size   : \`${formatBytes(stat.size)}\`\n`;

    if (isPluginFile) {
      replyText += `│ 🔄 Unload : ${unloadNote}\n`;
    }

    replyText += `╰───────⬣\n\n` + `💾 *Backup:* \`${path.relative(ROOT_DIR, backupPath)}\`\n\n`;

    if (!isPluginFile) {
      replyText += `⚠️ File di luar folder \`plugins/\` mungkin butuh *restart bot* agar perubahan sepenuhnya terasa.`;
    } else {
      replyText += `> File sudah dihapus dan dinonaktifkan dari bot! 🎉`;
    }

    return m.reply(replyText);
  } catch (error) {
    await m.react("☢");
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };