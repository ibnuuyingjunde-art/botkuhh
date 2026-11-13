import moment from "moment-timezone";
import fs from "fs";
import path from "path";
import { archiver } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { logger } from "../../src/lib/ichigo-logger.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "backupsc",
  alias: ["backup", "backupscript", "backupsource"],
  category: "owner",
  description: "Backup script bot dalam bentuk zip",
  usage: ".backupsc [owner/chat/gc/all] — default kirim ke owner",
  example: ".backupsc | .backupsc owner | .backupsc chat | .backupsc gc",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 0,
  isEnabled: true,
};

const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", "storage", "storages", "tmp", "temp",
  ".cache", "logs", "sessions", "session", "auth", ".npm", ".yarn",
  "dist", "coverage", "__pycache__", "autoreply_media", "build",
  "Baileys-master", "ichigo", "ALYA V8", "DHX-pro", "RTXZY-MD-pro",
  "BETABOTZ-MD2-pro", "KazzTzyCanvs", "starseed-main",
  "IchigoGlitch-Baileys-main", "Script Lyrra MD V7", "Sky Md V2",
  "Marin Kitagawa MD V1.0 (1)", "AmbaCrash v19 Free (1)", "@blckrose",
  "backup", "backups", "animation", "_tools", "PUSHKONTAK",
  ".vscode", ".gemini", "fischit-main",
]);

const EXCLUDE_EXTENSIONS = new Set([
  ".zip", ".tar.gz", ".7z", ".mp4", ".mp3", ".wav", ".avi", ".mkv",
  ".ico", ".svg", ".traineddata", ".log", ".bak", ".lock",
]);

const EXCLUDE_FILES = new Set([
  ".env", ".env.local", "creds.json", "package-lock.json", "yarn.lock",
  ".npmrc", ".gitignore", "boot_final.log", "bot_log.txt", "error.txt",
  "changelog.txt", "UPDATE.txt", "CHANGELOG.md",
]);

// Cache yang dibuat ulang otomatis oleh bot, tidak perlu ikut backup (hemat sekitar 9 MB).
const EXCLUDE_PATHS = [
  "database/asset-cache",
  "database/lid-cache.json",
  "database/plugin-meta-cache.json",
  "data/crmdb.json", // store sementara (format lama)
  "data/crmdb.db", // store sementara, otomatis dibersihkan bot
  "data/crmdb.db-wal",
  "data/crmdb.db-shm",
];

// assets/ ikut backup. File di bawah tidak dirujuk kode/config, jadi dilewati.
const BACKUP_ASSETS = true;
const EXCLUDE_ASSET_FILES = [
  "assets/video/ichigo-mp4.mp4",
  "assets/rinchat",
  "assets/fonts/kalender.zip",
  "assets/fonts/arialnarrow.ttf",
  "assets/images/ichigo.png",
  "assets/images/ichigo2.png",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ZIP_SIZE = 95 * 1024 * 1024;
const TOTAL_STEPS = 3;

// Progress berbasis tahap: pesan cuma di-edit saat tahap berganti (maks 4x),
// bukan tiap 500ms. Jadi chat nggak berkedip dan console nggak kebanjiran log.
function createProgress(sock, jid, msgKey) {
  let lastText = "";

  const render = (step, label, detail = "") => {
    const bar = "▰".repeat(step) + "▱".repeat(TOTAL_STEPS - step);
    return (
      `*Backup Script*\n` +
      `${bar}  ${step}/${TOTAL_STEPS}\n` +
      `${label}` +
      (detail ? `\n_${detail}_` : "")
    );
  };

  const push = async (text) => {
    if (!msgKey || text === lastText) return;
    lastText = text;
    try {
      await sock.sendMessage(jid, { text, edit: msgKey });
    } catch {}
  };

  return {
    step: (step, label, detail) => push(render(step, label, detail)),
    done: (text) => push(text),
  };
}

function shouldExclude(filePath, basePath) {
  const relativePath = path.relative(basePath, filePath);
  const relPosix = relativePath.split(path.sep).join("/");
  if (EXCLUDE_PATHS.some((p) => relPosix === p || relPosix.startsWith(p + "/"))) return true;
  if (!BACKUP_ASSETS && (relPosix === "assets" || relPosix.startsWith("assets/"))) return true;
  if (EXCLUDE_ASSET_FILES.some((p) => relPosix === p || relPosix.startsWith(p + "/"))) return true;
  if (relPosix.endsWith(".migrated.bak")) return true;
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
  }
  const fileName = path.basename(filePath);
  if (EXCLUDE_FILES.has(fileName)) return true;
  const ext = path.extname(fileName).toLowerCase();
  if (EXCLUDE_EXTENSIONS.has(ext)) {
    const isAsset =
      relativePath.startsWith("assets" + path.sep) ||
      relativePath.startsWith("database" + path.sep);
    if (!isAsset) return true;
  }
  if (fileName.endsWith(".tar.gz")) return true;
  return false;
}

function getBackupOutputDir(projectRoot) {
  const backupDir = path.join(projectRoot, "backups", "script");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function collectFiles(dirPath, projectRoot, fileList = []) {
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      if (shouldExclude(fullPath, projectRoot)) continue;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          collectFiles(fullPath, projectRoot, fileList);
        } else if (stat.isFile()) {
          if (stat.size > MAX_FILE_SIZE) {
            logger.warn("backupsc", `skip ${path.relative(projectRoot, fullPath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB, terlalu besar)`);
            continue;
          }
          fileList.push({
            fullPath,
            relativePath: path.relative(projectRoot, fullPath),
            size: stat.size,
          });
        }
      } catch {}
    }
  } catch {}
  return fileList;
}

async function createZip(files, zipFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { output.destroy(); } catch {}
      try { if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath); } catch {}
      reject(error);
    };

    output.on("error", fail);
    output.on("close", () => {
      if (settled) return;
      settled = true;
      if (!fs.existsSync(zipFilePath)) {
        fail(new Error("File backup tidak ditemukan setelah proses zip"));
        return;
      }
      const stats = fs.statSync(zipFilePath);
      if (stats.size <= 0) {
        fail(new Error("File backup kosong atau 0KB"));
        return;
      }
      resolve(stats.size);
    });

    archive.on("error", fail);
    archive.on("warning", (err) => { if (err?.code !== "ENOENT") fail(err); });
    archive.pipe(output);

    for (const file of files) {
      archive.file(file.fullPath, { name: file.relativePath });
    }

    if (files.length === 0) {
      fail(new Error("Tidak ada file yang masuk ke backup script"));
      return;
    }

    archive.finalize();
  });
}

async function sendZipTo(sock, jid, zipFilePath, zipFileName, caption) {
  await sock.sendMessage(jid, {
    // Kirim lewat path (di-stream dari disk), jangan readFileSync: seluruh zip masuk RAM + salinan enkripsi.
    document: { url: zipFilePath },
    fileName: zipFileName,
    mimetype: "application/zip",
    caption,
    contextInfo: {
      forwardingScore: 9999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: config.saluran?.id || "120363400911374213@newsletter",
        newsletterName: config.saluran?.name || config.bot?.name || "lyniX's",
        serverMessageId: 127,
      },
    },
  });
}

function getOwnerJids() {
  const raw = config.owner;
  let numbers = [];
  if (Array.isArray(raw)) numbers = raw;
  else if (Array.isArray(raw?.number)) numbers = raw.number;
  else if (typeof raw?.number === "string") numbers = [raw.number];
  else if (typeof raw === "string") numbers = [raw];
  return numbers
    .map((n) => `${String(n).replace(/[^0-9]/g, "")}@s.whatsapp.net`)
    .filter(Boolean);
}

function getConfiguredGcJid() {
  const raw = (config.idgc || "").trim();
  if (!raw) return "";
  return raw.includes("@") ? raw : `${raw}@g.us`;
}

function resolveTargets(arg, ownerJids, chatJid, gcJid) {
  const a = (arg || "").trim().toLowerCase();

  if (a === "owner") {
    return { targets: [...ownerJids] };
  }
  if (a === "gc") {
    if (!gcJid) return { targets: [] };
    return { targets: [gcJid] };
  }
  if (a === "chat") {
    return { targets: [chatJid] };
  }
  if (a === "all") {
    const targets = [...ownerJids];
    if (gcJid && !targets.includes(gcJid)) targets.push(gcJid);
    if (!targets.includes(chatJid)) targets.push(chatJid);
    return { targets };
  }

  // Default (tanpa argumen): kirim ke OWNER / peminta — JANGAN ke grup.
  // Prioritas: ownerJids → fallback ke chat pemanggil.
  if (ownerJids.length > 0) {
    return { targets: [...ownerJids] };
  }
  return { targets: [chatJid] };
}

function describeTargets(targets, ownerJids, chatJid, gcJid) {
  const toOwner = targets.some(t => ownerJids.includes(t));
  const toGc = gcJid && targets.includes(gcJid);
  const toChat = targets.includes(chatJid) && chatJid !== gcJid;

  const parts = [];
  if (toOwner) parts.push(`${ownerJids.length} owner`);
  if (toGc) parts.push(toGc && chatJid === gcJid ? "GC ini (idgc)" : "GC (idgc)");
  if (toChat) parts.push("GC ini");

  return parts.length ? parts.join(" + ") : "target yang dipilih";
}

async function handler(m, { sock }) {
  await m.react("🕕");

  const initMsg = await sock.sendMessage(m.chat, {
    text: `*Backup Script*\n▱▱▱  0/${TOTAL_STEPS}\nMenyiapkan backup`,
  }, { quoted: m });
  const progress = createProgress(sock, m.chat, initMsg?.key);

  // Satu-satunya jalur selesai: ubah pesan progress jadi hasil akhir (tanpa pesan baru).
  const finish = async (reaction, text) => {
    await m.react(reaction);
    if (initMsg?.key) await progress.done(text);
    else await m.reply(text);
  };

  try {
    const projectRoot = process.cwd();
    const timestamp = moment().tz("Asia/Makassar").format("YYYY-MM-DD_HH-mm-ss");
    const botName = config.bot?.name?.replace(/[^a-zA-Z0-9]/g, "") || "IchigoBot";
    const backupDir = getBackupOutputDir(projectRoot);
    const ownerJids = getOwnerJids();
    const gcJid = getConfiguredGcJid();

    const arg = m.text?.trim().toLowerCase() || "";
    const { targets } = resolveTargets(arg, ownerJids, m.chat, gcJid);

    const needsOwner = arg === "owner" || arg === "all";
    if (needsOwner && ownerJids.length === 0) {
      return finish("❌", `Tidak ada nomor owner di config.js`);
    }

    if (arg === "gc" && !gcJid) {
      return finish("❌", `\`idgc\` belum di-set di config.js`);
    }

    if (targets.length === 0) {
      return finish(
        "❌",
        arg === ""
          ? `\`idgc\` belum di-set di config.js dan gagal fallback ke chat ini`
          : `Tidak ada target penerima backup`,
      );
    }

    const targetDesc = describeTargets(targets, ownerJids, m.chat, gcJid);

    await progress.step(1, "Mengumpulkan file");
    // gabungkan WAL ke ichigo.db dulu supaya backup kecil dan konsisten
    try {
      const d = getDatabase();
      d.flushAll();
      d.sqlite?.checkpoint();
    } catch {}

    const allFiles = collectFiles(projectRoot, projectRoot);

    if (allFiles.length === 0) {
      return finish("❌", `Tidak ada file yang bisa di-backup`);
    }

    const totalSize = allFiles.reduce((acc, f) => acc + f.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    const needSplit = totalSize > MAX_ZIP_SIZE;

    if (!needSplit) {
      const zipFileName = `${botName}_backup_${timestamp}.zip`;
      const zipFilePath = path.join(backupDir, zipFileName);

      await progress.step(2, "Mengompresi file", `${allFiles.length} file, sekitar ${totalSizeMB} MB`);
      const zipSize = await createZip(allFiles, zipFilePath);
      const zipSizeMB = (zipSize / 1024 / 1024).toFixed(2);

      await progress.step(3, "Mengirim backup", `tujuan: ${targetDesc}`);

      const caption =
        `✅ *ʙᴀᴄᴋᴜᴘ sᴇʟᴇsᴀɪ*\n\n` +
        `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
        `┃ 📝 ɴᴀᴍᴀ: \`${zipFileName}\`\n` +
        `┃ 📊 sɪᴢᴇ: \`${zipSizeMB} MB\`\n` +
        `┃ 📁 ꜰɪʟᴇ: \`${allFiles.length}\`\n` +
        `┃ 📅 ᴛᴀɴɢɢᴀʟ: \`${moment().tz("Asia/Makassar").format("DD/MM/YYYY HH:mm")}\`\n` +
        `╰┈┈⬡`;

      for (const jid of targets) {
        try {
          await sendZipTo(sock, jid, zipFilePath, zipFileName, caption);
        } catch (e) {
          logger.error("backupsc", `gagal kirim ke ${jid.split("@")[0]}: ${e.message}`);
        }
      }

      try { fs.unlinkSync(zipFilePath); } catch {}

      await finish("✅", `Backup berhasil dikirim ke *${targetDesc}*\n_${allFiles.length} file, ${zipSizeMB} MB_`);

    } else {
      const parts = [];
      let chunkFiles = [];
      let chunkSizeAccum = 0;

      for (const file of allFiles) {
        if (chunkSizeAccum + file.size > MAX_ZIP_SIZE && chunkFiles.length > 0) {
          parts.push([...chunkFiles]);
          chunkFiles = [];
          chunkSizeAccum = 0;
        }
        chunkFiles.push(file);
        chunkSizeAccum += file.size;
      }
      if (chunkFiles.length > 0) parts.push(chunkFiles);

      for (let i = 0; i < parts.length; i++) {
        const zipFileName = `${botName}_backup_${timestamp}_part${i + 1}of${parts.length}.zip`;
        const zipFilePath = path.join(backupDir, zipFileName);

        await progress.step(2, `Mengompresi part ${i + 1}/${parts.length}`, `${parts[i].length} file`);
        const zipSize = await createZip(parts[i], zipFilePath);
        const zipSizeMB = (zipSize / 1024 / 1024).toFixed(2);

        await progress.step(3, `Mengirim part ${i + 1}/${parts.length}`, `tujuan: ${targetDesc}`);

        const caption =
          `✅ *ʙᴀᴄᴋᴜᴘ ᴘᴀʀᴛ ${i + 1}/${parts.length}*\n\n` +
          `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
          `┃ 📝 ɴᴀᴍᴀ: \`${zipFileName}\`\n` +
          `┃ 📊 sɪᴢᴇ: \`${zipSizeMB} MB\`\n` +
          `┃ 📁 ꜰɪʟᴇ: \`${parts[i].length}\`\n` +
          `┃ 📅 ᴛᴀɴɢɢᴀʟ: \`${moment().tz("Asia/Makassar").format("DD/MM/YYYY HH:mm")}\`\n` +
          `╰┈┈⬡`;

        for (const jid of targets) {
          try {
            await sendZipTo(sock, jid, zipFilePath, zipFileName, caption);
          } catch (e) {
            logger.error("backupsc", `gagal kirim ke ${jid.split("@")[0]}: ${e.message}`);
          }
        }

        try { fs.unlinkSync(zipFilePath); } catch {}
      }

      await finish("✅", `Semua *${parts.length} bagian* berhasil dikirim ke *${targetDesc}*`);
    }

  } catch (error) {
    logger.error("backupsc", error?.message || error);
    await m.react("☢");
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };