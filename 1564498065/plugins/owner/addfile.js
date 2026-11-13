import fs from "fs";
import path from "path";
import te from "../../src/lib/ichigo-error.js";
import { searchFileByName } from "../../src/lib/ichigo-filefinder.js";

const pluginConfig = {
  name: "addfile",
  alias: ["addf", "uploadfile", "tambahfile"],
  category: "owner",
  description: "Upload file/media atau simpan teks langsung ke server",
  usage: ".addfile <path> [isi teks] / reply file atau teks",
  example: ".addfile src/data/catatan.txt Halo dunia",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const BLOCKED_ROOTS = [
  ".git",
  "node_modules",
  ".env",
  ".config",
  "config.js",
  "package.json",
  "package-lock.json",
];

const MAX_SIZE = 25 * 1024 * 1024;

function guessExtFromMime(mimetype = "") {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "font/ttf": ".ttf",
    "font/otf": ".otf",
  };
  return map[mimetype] || "";
}

function safeResolve(baseDir, targetPath) {
  const resolved = path.resolve(baseDir, targetPath);
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

function isQuotedFile(quoted) {
  const filename = quoted.filename || quoted.fileName || "";
  const mimetype = quoted.mimetype || quoted.mimeType || "";
  return (
    !!filename ||
    (mimetype && !mimetype.startsWith("text/")) ||
    quoted.type === "document" ||
    quoted.type === "image" ||
    quoted.type === "video" ||
    quoted.type === "audio"
  );
}

async function handler(m, { sock }) {
  const quoted = m.quoted;
  const rawArgs = m.args.filter((a) => a !== "--force");
  const force = m.args.includes("--force");

  let dest = "";
  let buf = null;
  let originalName = "";
  let mimetype = "";
  let isTextMode = false;

  if (quoted && isQuotedFile(quoted)) {
    
    dest = (rawArgs[0] || "").trim();
    mimetype = quoted.mimetype || quoted.mimeType || "";
    originalName =
      quoted.filename || quoted.fileName || `file_${Date.now()}${guessExtFromMime(mimetype)}`;

    await m.react("🕕");
    try {
      buf = await quoted.download();
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ *GAGAL*\n\nGagal download file: ${e.message}`);
    }
  } else if (quoted) {
    
    const textContent = quoted.text || quoted.body || quoted.caption || "";
    dest = (rawArgs[0] || "").trim();

    if (!dest) {
      return m.reply(
        `📁 *ADD FILE (TEXT)*\n\nWajib isi path tujuan.\nContoh: ${m.prefix}addfile src/data/catatan.txt`,
      );
    }
    if (!textContent.trim()) {
      return m.reply(`❌ *GAGAL*\n\nPesan yang di-reply tidak mengandung teks`);
    }

    await m.react("🕕");
    isTextMode = true;
    buf = Buffer.from(textContent, "utf-8");
    originalName = path.basename(dest);
  } else if (m.text && m.text.trim()) {

    const match = m.text.match(/^(\S+)([\s\S]*)$/);
    if (!match) {
      return m.reply(
        `📁 *ADD FILE (TEXT)*\n\nFormat: ${m.prefix}addfile <path> <isi teks>\nAtau reply file/pesan teks dengan ${m.prefix}addfile <path>`,
      );
    }
    dest = match[1].trim();
    const textContent = match[2].replace(/^\s*\n|^\s+/, "").trimEnd();

    if (!textContent) {
      return m.reply(`❌ *GAGAL*\n\nIsi teks kosong. Format: ${m.prefix}addfile <path> <isi teks>`);
    }

    await m.react("🕕");
    isTextMode = true;
    buf = Buffer.from(textContent, "utf-8");
    originalName = path.basename(dest);
  } else {
    return m.reply(
      `📁 *ADD FILE*\n\n` +
        `*Upload file/media:*\n` +
        `Reply gambar/video/audio/dokumen dengan\n` +
        `${m.prefix}addfile <path/tujuan>\n\n` +
        `*Simpan teks:*\n` +
        `${m.prefix}addfile <path> <isi teks>\n` +
        `Atau reply pesan teks dengan ${m.prefix}addfile <path>\n` +
        `Bisa multi-baris juga\n\n` +
        `Contoh:\n` +
        `${m.prefix}addfile assets/images/banner.png\n` +
        `${m.prefix}addfile src/data/catatan.txt Halo dunia\n` +
        `${m.prefix}addfile database/cpanel/backup.json --force\n\n` +
        `Bisa ke folder mana aja di project (assets, src, database, dll)\n` +
        `Jika upload file tanpa path, nama file asli dipakai dan disimpan di assets/\n\n` +
        `💡 Kalau nama file sudah ada di lokasi lain, bot bakal ngingetin (biar gak nyasar bikin duplikat)`,
    );
  }

  if (!buf || !buf.length) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nFile/isi kosong atau tidak bisa dibaca`);
  }

  if (buf.length > MAX_SIZE) {
    await m.react("❌");
    return m.reply(
      `❌ *GAGAL*\n\nFile terlalu besar (${(buf.length / 1024 / 1024).toFixed(2)}MB)\nMax: ${MAX_SIZE / 1024 / 1024}MB`,
    );
  }

  let targetPath = dest;
  if (!targetPath) {
    targetPath = path.join("assets", originalName);
  } else if (targetPath.endsWith("/")) {
    targetPath = path.join(targetPath, originalName);
  } else if (!isTextMode && !path.extname(targetPath)) {
    
    targetPath = path.join(targetPath, originalName);
  }

  const rootDir = process.cwd();
  const fullPath = safeResolve(rootDir, targetPath);

  if (!fullPath) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nPath tidak valid (terdeteksi path traversal)`);
  }

  const normalizedSegments = targetPath.split(/[\\/]/).filter(Boolean);
  const hitsBlocked = normalizedSegments.some((seg) =>
    BLOCKED_ROOTS.includes(seg),
  );
  if (hitsBlocked) {
    await m.react("❌");
    return m.reply(
      `❌ *GAGAL*\n\nPath menyentuh folder/file terlarang (${BLOCKED_ROOTS.join(", ")})\n` +
        `Pilih tujuan lain, misal: ${m.prefix}addfile assets/gambar.png`,
    );
  }

  try {
    const folderPath = path.dirname(fullPath);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const exists = fs.existsSync(fullPath);
    if (exists && !force) {
      await m.react("❌");
      return m.reply(
        `❌ *GAGAL*\n\n` +
          `File sudah ada di: ${path.relative(rootDir, fullPath)}\n\n` +
          `Tambahkan --force di akhir command untuk timpa file lama`,
      );
    }

    if (!exists && !force) {
      const baseNameToCheck = path.basename(fullPath);
      const duplicates = searchFileByName(baseNameToCheck).filter(
        (rel) => path.resolve(rootDir, rel) !== fullPath,
      );

      if (duplicates.length > 0) {
        await m.react("❌");
        const list = duplicates.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
        return m.reply(
          `⚠️ *ADA FILE SERUPA*\n\n` +
            `Sudah ada file bernama \`${baseNameToCheck}\` di lokasi lain:\n\n${list}\n\n` +
            `Kalau maksudnya mau EDIT file itu, pakai:\n` +
            `> ${m.prefix}gantifile ${baseNameToCheck}\n\n` +
            `Kalau memang mau bikin file baru terpisah di \`${path.relative(rootDir, fullPath)}\`, tambahkan --force di akhir command.`,
        );
      }
    }

    fs.writeFileSync(fullPath, buf);

    await m.react("✅");
    return m.reply(
      `✅ *FILE DITAMBAH*\n\n` +
        `╭─〔 *DETAIL* 〕───⬣\n` +
        `│ Nama    : ${path.basename(fullPath)}\n` +
        `│ Path    : ${path.relative(rootDir, fullPath)}\n` +
        `│ Size    : ${(buf.length / 1024).toFixed(2)} KB\n` +
        `│ Mode    : ${isTextMode ? "📝 Teks" : `📄 File (${mimetype || "unknown"})`}\n` +
        `│ Status  : ${exists ? "♻️ Ditimpa (overwrite)" : "🆕 Baru"}\n` +
        `╰───────⬣`,
    );
  } catch (error) {
    await m.react("☢");
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };