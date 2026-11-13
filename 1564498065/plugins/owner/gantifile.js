import fs from "fs";
import path from "path";
import { hotReloadPlugin } from "../../src/lib/ichigo-plugins.js";
import te from "../../src/lib/ichigo-error.js";
import { ROOT_DIR, smartResolve, resolveSafePath } from "../../src/lib/ichigo-filefinder.js";

const pluginConfig = {
  name: "gantifile",
  alias: ["replacefile", "editfile", "updatefile"],
  category: "owner",
  description: "Ganti isi file apapun di project langsung dari WhatsApp (gak perlu ke panel, cukup nama filenya aja)",
  usage: ".gantifile <nama_file / path>",
  example: ".gantifile config.js",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const TEXT_EXTS = [
  ".js", ".mjs", ".cjs", ".json", ".txt", ".md",
  ".html", ".css", ".env", ".yml", ".yaml", ".ts",
];

function getQuotedText(quoted) {
  if (!quoted) return "";
  return (
    quoted.text ||
    quoted.body ||
    quoted.caption ||
    quoted.message?.conversation ||
    quoted.message?.extendedTextMessage?.text ||
    quoted.message?.imageMessage?.caption ||
    quoted.message?.documentMessage?.caption ||
    ""
  );
}

function getQuotedDocInfo(quoted) {
  if (!quoted) return null;
  const filename =
    quoted.filename ||
    quoted.fileName ||
    quoted.message?.documentMessage?.fileName ||
    quoted.message?.documentWithCaptionMessage?.message?.documentMessage?.fileName ||
    null;
  const mimetype =
    quoted.mimetype ||
    quoted.message?.documentMessage?.mimetype ||
    quoted.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype ||
    null;
  if (!filename && !mimetype) return null;
  return { filename, mimetype };
}

async function downloadQuoted(quoted) {
  if (typeof quoted.download === "function") return await quoted.download();
  if (typeof quoted.downloadMedia === "function") return await quoted.downloadMedia();
  if (typeof quoted.toBuffer === "function") return await quoted.toBuffer();
  throw new Error("Tidak ada method download yang tersedia");
}

function formatBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}

async function handler(m, { sock }) {
  const quoted = m.quoted;
  const rawInput = (m.args?.[0] || "").trim();

  if (!rawInput) {
    return m.reply(
      `📝 *GANTI FILE*\n\n` +
      `Reply file baru / teks isi file, dengan caption:\n` +
      `\`${m.prefix}gantifile <nama_file / path>\`\n\n` +
      `📎 *Contoh:*\n` +
      `• \`${m.prefix}gantifile config.js\`\n` +
      `• \`${m.prefix}gantifile ichigo-builder.js\`\n` +
      `• \`${m.prefix}gantifile plugins/tools/botactive.js\`\n` +
      `• \`${m.prefix}gantifile database/prefix.json\`\n\n` +
      `📌 *Support:*\n` +
      `• Reply file apapun (dokumen)\n` +
      `• Reply teks berisi isi file baru\n` +
      `• Cukup nama filenya aja (tanpa path), bot cari otomatis kalau filenya sudah ada di project\n\n` +
      `⚠️ File lama otomatis di-backup sebelum ditimpa.\n` +
      `⚠️ File di luar folder \`plugins/\` (mis. \`config.js\`, \`src/handler.js\`) butuh *restart bot* setelah diganti.`,
    );
  }

  if (!quoted) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nReply file atau teks yang isinya mau dipakai sebagai isi file baru.`);
  }

  const resolved = smartResolve(rawInput);

  if (resolved.status === "invalid") {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nPath tidak valid / mencoba keluar dari folder project.`);
  }

  if (resolved.status === "ambiguous") {
    await m.react("❌");
    const list = resolved.matches.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
    return m.reply(
      `🔎 Ada ${resolved.matches.length} file bernama *"${rawInput}"*, ketik path lengkapnya:\n\n${list}\n\n` +
        `Contoh: \`${m.prefix}gantifile ${resolved.matches[0]}\``
    );
  }

  let targetPath;
  let relPath;

  if (resolved.status === "found") {
    targetPath = resolved.path;
    relPath = resolved.relPath;
  } else {
    
    targetPath = resolveSafePath(rawInput);
    if (!targetPath) {
      await m.react("❌");
      return m.reply(`❌ *GAGAL*\n\nPath tidak valid / mencoba keluar dari folder project.`);
    }
    relPath = rawInput;
  }

  await m.react("🕕");

  let content; 
  const docInfo = getQuotedDocInfo(quoted);

  try {
    if (docInfo) {
      content = await downloadQuoted(quoted);
    } else {
      const txt = getQuotedText(quoted);
      if (!txt) {
        await m.react("❌");
        return m.reply(`❌ *GAGAL*\n\nReply-nya gak ada isi file / dokumennya (kosong).`);
      }
      content = txt;
    }
  } catch (e) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL DOWNLOAD*\n\nError saat mengambil isi: ${e.message}`);
  }

  const ext = path.extname(targetPath).toLowerCase();

  if (typeof content === "string" && TEXT_EXTS.includes(ext)) {
    content = content
      .replace(/^```(?:[a-z]+)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
  }

  if (!content || content.length === 0) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nIsi file kosong, dibatalkan.`);
  }

  try {
    const isNewFile = !fs.existsSync(targetPath);
    let backupPath = null;
    let oldSize = 0;

    if (!isNewFile) {
      oldSize = fs.statSync(targetPath).size;

      const backupDir = path.join(ROOT_DIR, "backup", "files");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const flatName = relPath.replace(/[\\/]/g, "_");
      backupPath = path.join(backupDir, `${flatName}_${timestamp}${ext || ""}`);
      fs.copyFileSync(targetPath, backupPath);
    } else {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(targetPath, content);
    } else {
      fs.writeFileSync(targetPath, content, "utf-8");
    }

    const newSize = fs.statSync(targetPath).size;

    const relFromRoot = path.relative(ROOT_DIR, targetPath).replace(/\\/g, "/");
    const isPluginFile = relFromRoot.startsWith("plugins/") && /\.m?js$/i.test(ext);

    let reloadNote;
    if (isPluginFile) {
      let reloadResult = { success: false };
      try {
        reloadResult = (await hotReloadPlugin(targetPath)) || { success: true };
      } catch {}
      reloadNote = reloadResult.success ? "✅ Sukses (hot reload)" : "⚠️ Gagal, butuh restart";
    } else {
      reloadNote = "⚠️ Butuh restart bot";
    }

    await m.react("✅");

    let replyText =
      `✅ *FILE ${isNewFile ? "DIBUAT" : "DIGANTI"}*\n\n` +
      `╭─〔 *DETAIL* 〕───⬣\n` +
      `│ 📄 Path   : \`${relFromRoot}\`\n` +
      `│ 📦 Size   : \`${formatBytes(newSize)}\`\n`;

    if (!isNewFile) {
      replyText += `│ 🗂 Old    : \`${formatBytes(oldSize)}\`\n`;
    }

    replyText += `│ 🔄 Reload : ${reloadNote}\n` + `╰───────⬣\n`;

    if (backupPath) {
      const relBackup = path.relative(ROOT_DIR, backupPath);
      replyText += `\n💾 *Backup:* \`${relBackup}\``;
    }

    replyText += `\n\n> File sudah diperbarui langsung dari WhatsApp! 🎉`;

    return m.reply(replyText);
  } catch (error) {
    await m.react("☢");
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };