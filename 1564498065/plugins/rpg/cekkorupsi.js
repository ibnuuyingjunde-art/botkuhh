import { getDatabase } from "../../src/lib/ichigo-database.js";

export const config = {
  name: "cekkorupsi",
  alias: ["korupsistats", "statkorupsi", "riwayatkorupsi"],
  category: "rpg",
  description: "Cek statistik & riwayat korupsi kamu",
  usage: ".cekkorupsi [@user]",
  example: ".cekkorupsi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatNumber(num) {
  return num?.toLocaleString("id-ID") || "0";
}

function formatDuration(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const jam = Math.floor(totalSec / 3600);
  const menit = Math.floor((totalSec % 3600) / 60);
  const detik = totalSec % 60;
  if (jam > 0) return `${jam} jam ${menit} menit`;
  if (menit > 0) return `${menit} menit ${detik} detik`;
  return `${detik} detik`;
}

const APP_TIMEZONE = "Asia/Makassar";

function formatDate(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }) + " WITA";
}

const KORUPSI_COOLDOWN_MS = 30 * 60 * 1000;

function getGelar(totalKorupsi, totalTangkap) {
  if (!totalKorupsi || totalKorupsi === 0) return "🧑 Warga Jujur";
  if (totalTangkap === 0 && totalKorupsi > 0) return "😈 Koruptor Licin";
  const ratio = (totalTangkap || 0) / ((totalKorupsi || 0) + (totalTangkap || 0));
  if (totalKorupsi >= 500_000_000_000) return "👑 Raja Koruptor";
  if (totalKorupsi >= 100_000_000_000) return "🏛️ Pejabat Rakus";
  if (totalKorupsi >= 10_000_000_000) return "💼 Birokrat Busuk";
  if (totalKorupsi >= 1_000_000_000) return "🖊️ Penggarong Anggaran";
  if (totalKorupsi >= 50_000_000) return "🤏 Koruptor Berpengalaman";
  if (ratio > 0.5) return "🚨 Koruptor Ceroboh";
  return "🤏 Koruptor Pemula";
}

export async function handler(m, { sock }) {
  const db = getDatabase();

  const botJid = sock.user?.id?.replace(/:.*@/, "@") || "";
  const mentionedTarget = m.mentionedJid?.[0];
  const target = (mentionedTarget && mentionedTarget !== botJid) ? mentionedTarget : m.sender;

  const user = db.getUser(target) || db.setUser(target);
  if (!user.rpg) user.rpg = {};
  if (!user.rpg.korupsi) user.rpg.korupsi = {};

  const k = user.rpg.korupsi;
  const now = Date.now();
  const nama = user.name || (target === m.sender ? m.pushName : null) || "Unknown";
  const nomorTag = target.split("@")[0];

  const diPenjara = k.penjaraUntil && now < k.penjaraUntil;
  const sisaPenjara = diPenjara ? k.penjaraUntil - now : 0;

  const onCooldown = k.lastKorupsi && (now - k.lastKorupsi) < KORUPSI_COOLDOWN_MS;
  const sisaCooldown = onCooldown ? KORUPSI_COOLDOWN_MS - (now - k.lastKorupsi) : 0;

  const totalBerhasil = k.totalBerhasil || 0;
  const totalTangkap = k.totalTangkap || 0;
  const totalAksi = totalBerhasil + totalTangkap;
  const totalKorupsi = k.totalKorupsi || 0;
  const winRate = totalAksi > 0 ? ((totalBerhasil / totalAksi) * 100).toFixed(1) : "0.0";

  const gelar = getGelar(totalKorupsi, totalTangkap);

  let statusBadge;
  if (diPenjara) {
    statusBadge = `🔒 *DI PENJARA* (bebas dalam ${formatDuration(sisaPenjara)})`;
  } else if (onCooldown) {
    statusBadge = `⏳ *Cooldown* (${formatDuration(sisaCooldown)} lagi)`;
  } else {
    statusBadge = `✅ *Siap beraksi!*`;
  }

  const corner = "▣";
  const bullet = "-";
  const top    = `╭─${corner}「 🏛️ *CEK KORUPSI* 」`;
  const div    = `├────────────────────${corner}`;
  const bottom = `╰────────────────────${corner}`;
  const r = (label, val) => `│${bullet} *${label}* : ${val}`;

  let text = `${top}\n`;
  text += `│👤 *${nama}* (@${nomorTag})\n`;
  text += `│🎖️ Gelar: ${gelar}\n`;
  text += `${div}\n`;
  text += `${r("Status", statusBadge)}\n`;
  text += `${div}\n`;
  text += `${r("Total Aksi", `${formatNumber(totalAksi)}x`)}\n`;
  text += `${r("✅ Berhasil", `${formatNumber(totalBerhasil)}x`)}\n`;
  text += `${r("🚨 Tertangkap", `${formatNumber(totalTangkap)}x`)}\n`;
  text += `${r("📊 Win Rate", `${winRate}%`)}\n`;
  text += `${div}\n`;
  text += `${r("💰 Total Dikorupsi", `Rp ${formatNumber(totalKorupsi)}`)}\n`;
  text += `${r("📅 Korupsi Terakhir", formatDate(k.lastKorupsi))}\n`;

  if (k.tangkapCount >= 3) {
    text += `${div}\n`;
    text += `│⚠️ *Peringatan Residivis*\n`;
    text += `│  Sudah ketahuan *${k.tangkapCount}x* — hukuman makin berat!\n`;
  }

  text += `${bottom}`;

  await sock.sendMessage(
    m.chat,
    { text, mentions: [target] },
    { quoted: m },
  );
}