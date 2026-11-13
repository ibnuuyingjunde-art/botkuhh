import appConfig from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getConnectionState, getUptime } from "../../src/connection.js";
import os from "os";
import fs from "fs";
import path from "path";

export const config = {
  name: "ceksession",
  alias: ["session", "ceksesi", "botstatus", "botinfo"],
  category: "info",
  description: "Cek informasi session & status koneksi WhatsApp bot",
  usage: ".ceksession",
  example: ".ceksession",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}h`);
  if (h > 0) parts.push(`${h}j`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}d`);
  return parts.join(" ");
}

const APP_TIMEZONE = "Asia/Makassar";

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: APP_TIMEZONE,
  }) + " WITA";
}

function getCpuModel() {
  const cpus = os.cpus();
  return cpus?.[0]?.model?.trim() || "Unknown";
}

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return (100 - (totalIdle / totalTick) * 100).toFixed(1);
}

function getSessionFiles(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return { exists: false, count: 0, size: 0 };
    const files = fs.readdirSync(dirPath);
    let totalSize = 0;
    for (const file of files) {
      try {
        const stat = fs.statSync(path.join(dirPath, file));
        if (stat.isFile()) totalSize += stat.size;
      } catch {}
    }
    return { exists: true, count: files.length, size: totalSize };
  } catch {
    return { exists: false, count: 0, size: 0 };
  }
}

function getJadibotList(basePath) {
  try {
    if (!fs.existsSync(basePath)) return [];
    return fs.readdirSync(basePath).filter(name => {
      const full = path.join(basePath, name);
      return fs.statSync(full).isDirectory();
    });
  } catch {
    return [];
  }
}

export async function handler(m, { sock }) {
  const db = getDatabase();
  const now = Date.now();

  const botJid = sock.user?.id?.replace(/:.*@/, "@") || "Unknown";
  const botName = sock.user?.name || appConfig.botName || "Bot";
  const botNumber = botJid.split("@")[0];

  const connState = getConnectionState();
  const wsLabel = connState.isReady
    ? "🟢 Connected"
    : connState.isConnected
      ? "🟡 Connecting (belum ready)"
      : "🔴 Disconnected";

  const connectionUptimeMs = getUptime(); 
  const reconnectAttempts = connState.reconnectAttempts ?? 0;

  const botUptime = process.uptime();

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const cpuModel = getCpuModel();
  const cpuCount = os.cpus().length;
  const cpuUsage = getCpuUsage();

  const platform = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;

  let totalUsers = 0;
  let totalGroups = 0;
  try {
    const allUsers = db.getAllUsers?.() ?? [];
    const allGroups = db.getAllGroups?.() ?? [];
    totalUsers = Array.isArray(allUsers) ? allUsers.length : Object.keys(allUsers).length;
    totalGroups = Array.isArray(allGroups) ? allGroups.length : Object.keys(allGroups).length;
  } catch {}

  const SESSION_UTAMA_PATH = "./storage/session";
  const JADIBOT_BASE_PATH = "./session/jadibot";

  const sessionUtama = getSessionFiles(SESSION_UTAMA_PATH);
  const jadibotList = getJadibotList(JADIBOT_BASE_PATH);
  const totalJadibot = jadibotList.length;

  let jadibotTotalFiles = 0;
  let jadibotTotalSize = 0;
  for (const nomor of jadibotList) {
    const info = getSessionFiles(path.join(JADIBOT_BASE_PATH, nomor));
    jadibotTotalFiles += info.count;
    jadibotTotalSize += info.size;
  }

  const sessionId = sock.authState?.creds?.me?.id || botJid;
  const platform_wa = sock.authState?.creds?.platform || "Unknown";
  const registered = sock.authState?.creds?.registered ?? null;

  const corner = "▣";
  const bullet = "-";
  const top    = `╭─${corner}「 🤖 *SESSION INFO* 」`;
  const div    = `├────────────────────${corner}`;
  const bottom = `╰────────────────────${corner}`;
  const r = (label, val) => `│${bullet} *${label}* : ${val}`;

  let text = `${top}\n`;

  text += `${r("Nama Bot", botName)}\n`;
  text += `${r("Nomor Bot", `+${botNumber}`)}\n`;
  text += `${r("Session ID", `...${sessionId.slice(-12)}`)}\n`;
  text += `${r("WA Platform", platform_wa)}\n`;
  if (registered !== null) {
    text += `${r("Terdaftar", registered ? "✅ Ya" : "❌ Belum")}\n`;
  }
  text += `${div}\n`;

  text += `│🔌 *STATUS KONEKSI*\n`;
  text += `${r("Status", wsLabel)}\n`;
  text += `${r("Uptime Koneksi", connState.connectedAt ? formatUptime(connectionUptimeMs / 1000) : "Belum connect")}\n`;
  text += `${r("Uptime Proses", formatUptime(botUptime))}\n`;
  if (reconnectAttempts > 0) {
    text += `${r("Reconnect Attempts", `${reconnectAttempts}x`)}\n`;
  }
  text += `${r("Waktu Sekarang", formatDate(now))}\n`;
  text += `${div}\n`;

  text += `│💻 *SISTEM*\n`;
  text += `${r("OS", `${platform} (${arch})`)}\n`;
  text += `${r("CPU", `${cpuModel}`)}\n`;
  text += `${r("CPU Core", `${cpuCount} core (${cpuUsage}% usage)`)}\n`;
  text += `${r("RAM", `${formatBytes(memUsage.heapUsed)} / ${formatBytes(totalMem)}`)}\n`;
  text += `${r("RAM Sistem", `${formatBytes(usedMem)} used / ${formatBytes(freeMem)} free`)}\n`;
  text += `${r("Node.js", nodeVersion)}\n`;
  text += `${div}\n`;

  text += `│🗄️ *DATABASE*\n`;
  text += `${r("Total User", `${totalUsers.toLocaleString("id-ID")} user`)}\n`;
  text += `${r("Total Grup", `${totalGroups.toLocaleString("id-ID")} grup`)}\n`;
  text += `${div}\n`;

  text += `│📁 *SESSION FILES*\n`;
  text += `${r("Bot Utama", sessionUtama.exists
    ? `${sessionUtama.count} file (${formatBytes(sessionUtama.size)})`
    : "❌ Folder tidak ditemukan")}\n`;
  text += `${div}\n`;

  text += `│🤖 *JADIBOT*\n`;
  text += `${r("Total Jadibot", `${totalJadibot} nomor aktif`)}\n`;
  text += `${r("Total File", `${jadibotTotalFiles} file (${formatBytes(jadibotTotalSize)})`)}\n`;
  if (jadibotList.length > 0) {
    text += `│📋 Daftar nomor:\n`;
    jadibotList.slice(0, 10).forEach((nomor, i) => {
      const info = getSessionFiles(path.join(JADIBOT_BASE_PATH, nomor));
      text += `│  ${i + 1}. +${nomor} (${info.count} file)\n`;
    });
    if (jadibotList.length > 10) {
      text += `│  ... +${jadibotList.length - 10} lainnya\n`;
    }
  }
  text += `${bottom}`;

  await sock.sendMessage(
    m.chat,
    { text },
    { quoted: m },
  );
}