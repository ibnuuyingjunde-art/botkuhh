import appConfig from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

export const config = {
  name: "korupsi",
  alias: ["corrupt", "suap"],
  category: "rpg",
  description: "Coba korupsi kas negara dan raih kekayaan — tapi awas ketahuan!",
  usage: ".korupsi",
  example: ".korupsi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 5,
  isEnabled: true,
};

const EXP_PER_LEVEL = 10000;

const KORUPSI_COOLDOWN_MS = 30 * 60 * 1000;

const MAX_KORUPSI_JUMLAH = 1_000_000_000_000;

function getPenjaraDuration(tangkapCount) {
  if (tangkapCount <= 1) return 10 * 60 * 1000;        
  if (tangkapCount <= 3) return 30 * 60 * 1000;        
  if (tangkapCount <= 5) return 60 * 60 * 1000;        
  return 3 * 60 * 60 * 1000;                            
}

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

function hitungKorupsi(level) {

  const base = 300_000;
  const growthRate = 1.18;

  const scaledCap = MAX_KORUPSI_JUMLAH / 1.4;
  const scaled = Math.min(base * Math.pow(growthRate, Math.min(level, 100)), scaledCap);

  const variasiMin = scaled * 0.6;
  const variasiMax = scaled * 1.4;
  const hasil = variasiMin + Math.random() * (variasiMax - variasiMin);

  return Math.min(Math.floor(hasil), MAX_KORUPSI_JUMLAH);
}

function hitungChanceBerhasil(level) {
  
  return 0.45 + Math.min(level / 100, 0.15);
}

function hitungDenda(jumlah) {
  return Math.floor(jumlah * 1.5);
}

export async function handler(m, { sock }) {
  const db = getDatabase();
  const sender = m.sender;
  const user = db.getUser(sender) || db.setUser(sender);

  if (!user.rpg) user.rpg = {};
  if (!user.rpg.korupsi) user.rpg.korupsi = {};

  const korupsiData = user.rpg.korupsi;
  const now = Date.now();

  if (korupsiData.penjaraUntil && now < korupsiData.penjaraUntil) {
    const sisaMs = korupsiData.penjaraUntil - now;
    return await sock.sendMessage(
      m.chat,
      {
        text:
          `🔒 *KAMU SEDANG DI PENJARA!*\n\n` +
          `Kamu sedang menjalani hukuman karena ketahuan korupsi.\n` +
          `⏳ Bebas dalam: *${formatDuration(sisaMs)}*\n\n` +
          `_"Koruptor yang ketahuan harus menanggung akibatnya."_`,
      },
      { quoted: m },
    );
  }

  if (korupsiData.lastKorupsi && now - korupsiData.lastKorupsi < KORUPSI_COOLDOWN_MS) {
    const sisaMs = KORUPSI_COOLDOWN_MS - (now - korupsiData.lastKorupsi);
    return await sock.sendMessage(
      m.chat,
      {
        text:
          `⏳ *Sabar dulu...*\n\n` +
          `Kamu baru saja melakukan korupsi. Tunggu *${formatDuration(sisaMs)}* lagi.\n\n` +
          `_"Koruptor yang baik tahu kapan harus beraksi."_`,
      },
      { quoted: m },
    );
  }

  const userExp = user.exp || 0;
  const userLevel = Math.min(Math.floor(userExp / EXP_PER_LEVEL) + 1, 100);
  const jumlahKorupsi = hitungKorupsi(userLevel);
  const chanceBerhasil = hitungChanceBerhasil(userLevel);
  const berhasil = Math.random() < chanceBerhasil;

  korupsiData.lastKorupsi = now;

  if (berhasil) {
    
    user.koin = (user.koin || 0) + jumlahKorupsi;
    korupsiData.totalBerhasil = (korupsiData.totalBerhasil || 0) + 1;
    korupsiData.totalKorupsi = (korupsiData.totalKorupsi || 0) + jumlahKorupsi;

    user.exp = (user.exp || 0) + 50;

    db.setUser(sender, user);

    const successEmoji = ["💰", "🤑", "👔", "🏛️", "📋", "🖊️"];
    const emoji = successEmoji[Math.floor(Math.random() * successEmoji.length)];

    const successMessages = [
      "Dengan muka polos dan tanda tangan palsu, kamu berhasil mencairkan dana kas negara.",
      "Proyek fiktif berhasil disetujui. Dana mengalir mulus ke kantongmu.",
      "Markup anggaran sukses besar. Tidak ada yang curiga.",
      "Kamu menyuap petugas dan lolos begitu saja.",
      "Laporan keuangan dipalsukan dengan sempurna. Audit tidak menemukan apa-apa.",
    ];
    const pesan = successMessages[Math.floor(Math.random() * successMessages.length)];

    return await sock.sendMessage(
      m.chat,
      {
        text:
          `${emoji} *KORUPSI BERHASIL!*\n\n` +
          `_${pesan}_\n\n` +
          `💵 Koin didapat: *+Rp ${formatNumber(jumlahKorupsi)}*\n` +
          `📊 Total korupsi: *Rp ${formatNumber(korupsiData.totalKorupsi)}*\n` +
          `✅ Berhasil: *${korupsiData.totalBerhasil}x*\n\n` +
          `⏳ Cooldown: *${formatDuration(KORUPSI_COOLDOWN_MS)}*\n` +
          `_"Uang rakyat, masuk kantong sendiri."_ 😈`,
      },
      { quoted: m },
    );
  } else {
    
    const denda = hitungDenda(jumlahKorupsi);
    korupsiData.tangkapCount = (korupsiData.tangkapCount || 0) + 1;
    const penjaraDuration = getPenjaraDuration(korupsiData.tangkapCount);
    korupsiData.penjaraUntil = now + penjaraDuration;
    korupsiData.totalTangkap = (korupsiData.totalTangkap || 0) + 1;

    const koinSekarang = user.koin || 0;
    user.koin = Math.max(0, koinSekarang - denda);
    const koinTerpotong = koinSekarang - user.koin;

    db.setUser(sender, user);

    const failMessages = [
      "KPK sudah mengintaimu dari tadi. Kamu digiring keluar ruangan dengan borgol di tangan.",
      "Whistleblower melaporkanmu ke pihak berwajib. Bukti sudah di tangan jaksa.",
      "CCTV merekam semuanya. Tidak ada tempat bersembunyi.",
      "Rekan kerjamu berkhianat dan melaporkanmu demi perlindungan saksi.",
      "Audit mendadak mengungkap rekening gelapmu. Selesai sudah.",
    ];
    const pesan = failMessages[Math.floor(Math.random() * failMessages.length)];

    return await sock.sendMessage(
      m.chat,
      {
        text:
          `🚨 *KETAHUAN! KPK BERGERAK!*\n\n` +
          `_${pesan}_\n\n` +
          `💸 Denda: *-Rp ${formatNumber(koinTerpotong)}* (dari kas Rp ${formatNumber(denda)})\n` +
          `🔒 Penjara: *${formatDuration(penjaraDuration)}*\n` +
          `📛 Total tertangkap: *${korupsiData.totalTangkap}x*\n\n` +
          `${korupsiData.tangkapCount >= 3 ? `⚠️ _Kamu sudah ketahuan ${korupsiData.tangkapCount}x. Hukuman makin berat!_\n\n` : ""}` +
          `_"Koruptor tidak pernah aman selamanya."_ 👮`,
      },
      { quoted: m },
    );
  }
}