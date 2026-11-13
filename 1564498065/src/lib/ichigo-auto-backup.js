import fs from "fs";
import path from "path";
import { archiver } from "./ichigo-lazy.js";
import { CronJob } from "cron";
import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";
import * as timeHelper from "./ichigo-time.js";
import { logger } from "./ichigo-logger.js";

const BACKUP_STATE_FILE = path.join(
  process.cwd(),
  "database",
  "autobackup.json",
);
let sockInstance = null;
let activeCronJob = null;

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "storage",
  "storages",
  "tmp",
  "temp",
  ".cache",
  "logs",
  "sessions",
  "session",
  "auth",
  ".npm",
  ".yarn",
  "dist",
  "coverage",
  "__pycache__",
  "autoreply_media",
  "build",
  "Baileys-master",
  "ichigo",
  "ALYA V8",
  "DHX-pro",
  "RTXZY-MD-pro",
  "BETABOTZ-MD2-pro",
  "KazzTzyCanvs",
  "starseed-main",
  "IchigoGlitch-Baileys-main",
  "Script Lyrra MD V7",
  "Sky Md V2",
  "Marin Kitagawa MD V1.0 (1)",
  "AmbaCrash v19 Free (1)",
  "@blckrose",
  "backup",
  "animation",
  "_tools",
  "PUSHKONTAK",
  ".vscode",
  ".gemini",
  "fischit-main",
  ".ichigo-temp",
]);

const EXCLUDE_EXTENSIONS = new Set([
  ".zip",
  ".tar.gz",
  ".7z",
  ".mp4",
  ".mp3",
  ".wav",
  ".avi",
  ".mkv",
  ".ico",
  ".svg",
  ".traineddata",
  ".log",
  ".bak",
  ".lock",
]);

const EXCLUDE_FILES = new Set([
  ".env",
  ".env.local",
  "creds.json",
  "package-lock.json",
  "yarn.lock",
  ".npmrc",
  ".gitignore",
  "boot_final.log",
  "bot_log.txt",
  "error.txt",
  "changelog.txt",
  "UPDATE.txt",
  "CHANGELOG.md",
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function shouldExclude(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
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

function loadBackupState() {
  try {
    if (fs.existsSync(BACKUP_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_STATE_FILE, "utf8"));
    }
  } catch {}
  return {
    enabled: false,
    intervalMs: 3600000,
    intervalStr: "1h",
    lastBackup: null,
    backupCount: 0,
    target: "owner",
    targetChatId: null,
  };
}

function saveBackupState(state) {
  try {
    const dir = path.dirname(BACKUP_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKUP_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {
    logger.error("AutoBackup", `Save state failed: ${e.message}`);
  }
}

function parseInterval(str) {
  const match = str.match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  let ms = 0;
  switch (unit) {
    case "m":
      ms = value * 60 * 1000;
      break;
    case "h":
      ms = value * 60 * 60 * 1000;
      break;
    case "d":
      ms = value * 24 * 60 * 60 * 1000;
      break;
    default:
      return null;
  }
  if (ms < 60000 || ms > 7 * 24 * 60 * 60 * 1000) return null;
  return { ms, str: `${value}${unit}` };
}

function formatInterval(ms) {
  if (ms >= 24 * 60 * 60 * 1000)
    return `${Math.floor(ms / (24 * 60 * 60 * 1000))} hari`;
  if (ms >= 60 * 60 * 1000) return `${Math.floor(ms / (60 * 60 * 1000))} jam`;
  return `${Math.floor(ms / (60 * 1000))} menit`;
}

function intervalToCron(ms) {
  if (ms >= 24 * 60 * 60 * 1000) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    return `0 0 */${days} * *`;
  }
  if (ms >= 60 * 60 * 1000) {
    const hours = Math.floor(ms / (60 * 60 * 1000));
    return `0 */${hours} * * *`;
  }
  const minutes = Math.floor(ms / (60 * 1000));
  return `*/${minutes} * * * *`;
}

async function createBackup() {
  // gabungkan WAL ke ichigo.db dulu supaya backup kecil dan konsisten
  try {
    const d = getDatabase();
    d.flushAll();
    d.sqlite?.checkpoint();
  } catch {}

  return new Promise((resolve, reject) => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const backupPath = path.join(tmpDir, `backup_${timestamp}.zip`);

    const output = fs.createWriteStream(backupPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    let fileCount = 0;

    output.on("close", () => {
      resolve({
        path: backupPath,
        size: archive.pointer(),
        fileCount,
        timestamp,
      });
    });
    archive.on("error", reject);
    archive.pipe(output);

    const rootDir = process.cwd();

    async function addDirectory(dirPath) {
      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (shouldExclude(fullPath)) continue;
          if (entry.isDirectory()) {
            await addDirectory(fullPath);
          } else if (entry.isFile()) {
            try {
              const stat = await fs.promises.stat(fullPath);
              if (stat.size < MAX_FILE_SIZE) {
                const relativePath = path.relative(rootDir, fullPath);
                archive.file(fullPath, { name: relativePath });
                fileCount++;
              }
            } catch {}
          }
        }
      } catch {}
    }

    addDirectory(rootDir).then(() => {
      archive.finalize();
    }).catch(reject);
  });
}

async function sendBackupTo(jid, backupInfo) {
  if (!sockInstance || !jid) {
    logger.error("AutoBackup", !sockInstance ? "Socket not initialized" : "No destination jid provided");
    try {
      await fs.promises.unlink(backupInfo.path);
    } catch {}
    return false;
  }

  try {
    const sizeInMB = (backupInfo.size / (1024 * 1024)).toFixed(2);
    const state = loadBackupState();

    const caption =
      `🗂️ *ᴀᴜᴛᴏ ʙᴀᴄᴋᴜᴘ*\n\n` +
      `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
      `┃ 📅 Waktu: ${timeHelper.formatDateTime("DD MMMM YYYY HH:mm:ss")} WITA\n` +
      `┃ 📦 Size: ${sizeInMB} MB\n` +
      `┃ 📁 Files: ${backupInfo.fileCount}\n` +
      `┃ ⏱️ Interval: ${formatInterval(state.intervalMs)}\n` +
      `┃ #️⃣ Backup ke-${state.backupCount + 1}\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> ${config.bot?.name || "lyniX's"} Auto Backup System`;

    await sockInstance.sendMessage(jid, {
      document: { url: backupInfo.path },
      mimetype: "application/zip",
      fileName: path.basename(backupInfo.path),
      caption,
    });

    state.lastBackup = new Date().toISOString();
    state.backupCount++;
    saveBackupState(state);

    try {
      await fs.promises.unlink(backupInfo.path);
    } catch {}

    logger.success("AutoBackup", `Backup sent to ${jid} (${sizeInMB} MB)`);
    return true;
  } catch (error) {
    logger.error("AutoBackup", `Send failed: ${error.message}`);
    try {
      await fs.promises.unlink(backupInfo.path);
    } catch {}
    return false;
  }
}

function resolveDestination(opts = {}) {
  const state = loadBackupState();
  const target = opts.target || state.target || "owner";

  if (target === "group") {
    const chatId = opts.chatId || state.targetChatId;
    if (!chatId) {
      logger.error("AutoBackup", "Group target requested but no chatId available");
      return null;
    }
    return chatId;
  }

  const ownerNumbers = config.owner?.number || [];
  if (ownerNumbers.length === 0) {
    logger.error("AutoBackup", "No owner number configured");
    return null;
  }
  const ownerNumber = String(ownerNumbers[0]).replace(/[^0-9]/g, "");
  if (!ownerNumber) {
    logger.error("AutoBackup", "Invalid owner number");
    return null;
  }
  return `${ownerNumber}@s.whatsapp.net`;
}

async function doBackup(opts = {}) {
  try {
    logger.info("AutoBackup", "Starting backup...");
    const jid = resolveDestination(opts);
    if (!jid) {
      logger.error("AutoBackup", "Backup aborted: no valid destination");
      return false;
    }
    const backupInfo = await createBackup();
    return await sendBackupTo(jid, backupInfo);
  } catch (error) {
    logger.error("AutoBackup", `Backup failed: ${error.message}`);
    return false;
  }
}

function startAutoBackup(sock) {
  sockInstance = sock;
  const state = loadBackupState();

  if (!state.enabled) {
    logger.info("AutoBackup", "Auto backup is disabled");
    return;
  }

  stopAutoBackup();

  const cronExp = intervalToCron(state.intervalMs);
  activeCronJob = new CronJob(cronExp, doBackup, null, true, "Asia/Makassar");
  logger.info("backup", `aktif · tiap ${formatInterval(state.intervalMs)}`);
}

function stopAutoBackup() {
  if (activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
    logger.info("AutoBackup", "Stopped");
  }
}

function enableAutoBackup(intervalStr, sock, opts = {}) {
  const parsed = parseInterval(intervalStr);
  if (!parsed) {
    return {
      success: false,
      error: "Format interval tidak valid. Contoh: 5m, 1h, 2d",
    };
  }

  if (opts.target === "group" && !opts.chatId) {
    return {
      success: false,
      error: "Target grup butuh chatId yang valid.",
    };
  }

  sockInstance = sock;

  const state = loadBackupState();
  state.enabled = true;
  state.intervalMs = parsed.ms;
  state.intervalStr = parsed.str;
  state.target = opts.target === "group" ? "group" : "owner";
  state.targetChatId = opts.target === "group" ? opts.chatId : null;
  saveBackupState(state);

  stopAutoBackup();
  startAutoBackup(sock);

  return {
    success: true,
    interval: formatInterval(parsed.ms),
    intervalStr: parsed.str,
    target: state.target,
    targetChatId: state.targetChatId,
  };
}

function disableAutoBackup() {
  const state = loadBackupState();
  state.enabled = false;
  saveBackupState(state);
  stopAutoBackup();
  return { success: true };
}

function getBackupStatus() {
  const state = loadBackupState();
  return {
    enabled: state.enabled,
    interval: formatInterval(state.intervalMs),
    intervalStr: state.intervalStr,
    lastBackup: state.lastBackup,
    backupCount: state.backupCount,
    isRunning: activeCronJob !== null,
    target: state.target || "owner",
    targetChatId: state.targetChatId || null,
  };
}

async function triggerManualBackup(sock, opts = {}) {
  sockInstance = sock;
  const ok = await doBackup(opts);
  if (!ok) {
    throw new Error("Manual backup failed — lihat log untuk detail.");
  }
  return ok;
}

function initAutoBackup(sock) {
  sockInstance = sock;
  startAutoBackup(sock);
}

export {
  initAutoBackup,
  startAutoBackup,
  stopAutoBackup,
  enableAutoBackup,
  disableAutoBackup,
  getBackupStatus,
  triggerManualBackup,
  createBackup,
  parseInterval,
  formatInterval,
};