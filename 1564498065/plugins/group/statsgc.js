import moment from "moment-timezone";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";

const BG_PATH = "/home/container/assets/images/bg-welcome.jpg";

async function buildStatsCard(groupName, stats, now) {
  const W = 1280, H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  try {
    const bgImg = await loadImage((await loadAssetBuffer("bg-welcome")) || BG_PATH);
    ctx.drawImage(bgImg, 0, 0, W, H);
  } catch {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   "#020818");
    bgGrad.addColorStop(0.4, "#050f2e");
    bgGrad.addColorStop(0.7, "#071230");
    bgGrad.addColorStop(1,   "#030a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, W, H);

  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0,   "#1a5fff");
  borderGrad.addColorStop(0.5, "#4d8aff");
  borderGrad.addColorStop(1,   "#1a5fff");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth   = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  ctx.strokeStyle = "rgba(77, 138, 255, 0.2)";
  ctx.lineWidth   = 1;
  ctx.strokeRect(22, 22, W - 44, H - 44);

  const cSize = 20, cPad = 14;
  ctx.fillStyle = "#4d8aff";
  ctx.fillRect(cPad, cPad, cSize, 2.5);
  ctx.fillRect(cPad, cPad, 2.5, cSize);
  ctx.fillRect(W - cPad - cSize, cPad, cSize, 2.5);
  ctx.fillRect(W - cPad - 2.5, cPad, 2.5, cSize);
  ctx.fillRect(cPad, H - cPad - 2.5, cSize, 2.5);
  ctx.fillRect(cPad, H - cPad - cSize, 2.5, cSize);
  ctx.fillRect(W - cPad - cSize, H - cPad - 2.5, cSize, 2.5);
  ctx.fillRect(W - cPad - 2.5, H - cPad - cSize, 2.5, cSize);

  const hY = 14, hH = 62;
  const hGrad = ctx.createLinearGradient(14, hY, W - 14, hY);
  hGrad.addColorStop(0,   "rgba(26, 95, 255, 0.0)");
  hGrad.addColorStop(0.5, "rgba(26, 95, 255, 0.35)");
  hGrad.addColorStop(1,   "rgba(26, 95, 255, 0.0)");
  ctx.fillStyle = hGrad;
  ctx.fillRect(14, hY, W - 28, hH);

  const divGrad = ctx.createLinearGradient(14, 0, W - 14, 0);
  divGrad.addColorStop(0,   "rgba(77, 138, 255, 0)");
  divGrad.addColorStop(0.5, "rgba(77, 138, 255, 0.8)");
  divGrad.addColorStop(1,   "rgba(77, 138, 255, 0)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(14, hY + hH);
  ctx.lineTo(W - 14, hY + hH);
  ctx.stroke();

  ctx.font      = "bold 17px sans-serif";
  ctx.fillStyle = "#7aaeff";
  ctx.textAlign = "center";
  ctx.fillText("◈   S T A T I S T I K   G R U P   ◈", W / 2, hY + 40);

  const fY = H - 14 - 50;
  const fGrad = ctx.createLinearGradient(14, fY, W - 14, fY);
  fGrad.addColorStop(0,   "rgba(26, 95, 255, 0.0)");
  fGrad.addColorStop(0.5, "rgba(26, 95, 255, 0.3)");
  fGrad.addColorStop(1,   "rgba(26, 95, 255, 0.0)");
  ctx.fillStyle = fGrad;
  ctx.fillRect(14, fY, W - 28, 50);

  const fDivGrad = ctx.createLinearGradient(14, 0, W - 14, 0);
  fDivGrad.addColorStop(0,   "rgba(77, 138, 255, 0)");
  fDivGrad.addColorStop(0.5, "rgba(77, 138, 255, 0.6)");
  fDivGrad.addColorStop(1,   "rgba(77, 138, 255, 0)");
  ctx.strokeStyle = fDivGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(14, fY);
  ctx.lineTo(W - 14, fY);
  ctx.stroke();

  ctx.fillStyle = "rgba(122, 174, 255, 0.7)";
  ctx.font      = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`◈ ${config.bot?.name || "LYNIX STRIFE"} ◈  •  ${now.format("DD/MM/YYYY HH:mm")} WITA`, W / 2, fY + 32);

  const titleY = hY + hH + 52;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 10;
  ctx.font        = "bold 34px sans-serif";
  ctx.fillStyle   = "#ffffff";
  ctx.textAlign   = "center";
  const shortGroup = groupName.length > 40 ? groupName.slice(0, 40) + "…" : groupName;
  ctx.fillText(`🏠 ${shortGroup}`, W / 2, titleY);
  ctx.shadowBlur  = 0;

  const dY = titleY + 18;
  const dGrad = ctx.createLinearGradient(W / 2 - 300, 0, W / 2 + 300, 0);
  dGrad.addColorStop(0,   "rgba(77, 138, 255, 0)");
  dGrad.addColorStop(0.5, "rgba(77, 138, 255, 0.6)");
  dGrad.addColorStop(1,   "rgba(77, 138, 255, 0)");
  ctx.strokeStyle = dGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 300, dY);
  ctx.lineTo(W / 2 + 300, dY);
  ctx.stroke();

  const cards = [
    { icon: "👥", label: "Total Member",    value: stats.totalMember.toString() },
    { icon: "👑", label: "Admin",           value: stats.totalAdmin.toString() },
    { icon: "👤", label: "Member Biasa",    value: stats.totalBiasa.toString() },
    { icon: "💬", label: "Pesan Hari Ini",  value: stats.msgToday.toString() },
    { icon: "📊", label: "Total Pesan",     value: stats.msgTotal.toString() },
    { icon: "📅", label: "Dibuat",          value: stats.createdAt },
    { icon: "🔒", label: "Restrict",        value: stats.restrict ? "ON" : "OFF" },
    { icon: "📢", label: "Announce",        value: stats.announce ? "ON" : "OFF" },
  ];

  const cardW   = 340;
  const cardH   = 80;
  const cols    = 3;
  const gapX    = 30;
  const gapY    = 18;
  const startX  = (W - (cols * cardW + (cols - 1) * gapX)) / 2;
  const startY  = dY + 28;

  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = startX + col * (cardW + gapX);
    const y   = startY + row * (cardH + gapY);

    const cardGrad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
    cardGrad.addColorStop(0,   "rgba(10, 30, 80, 0.75)");
    cardGrad.addColorStop(1,   "rgba(5, 15, 50, 0.75)");
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(77, 138, 255, 0.35)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 12);
    ctx.stroke();

    const accentGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    accentGrad.addColorStop(0, "#1a5fff");
    accentGrad.addColorStop(1, "#4d8aff");
    ctx.fillStyle = accentGrad;
    ctx.beginPath();
    ctx.roundRect(x, y + 10, 3, cardH - 20, 2);
    ctx.fill();

    ctx.font      = "22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(card.icon, x + 18, y + cardH / 2 + 4);

    ctx.font      = "12px sans-serif";
    ctx.fillStyle = "rgba(180, 210, 255, 0.7)";
    ctx.fillText(card.label, x + 52, y + cardH / 2 - 10);

    ctx.font      = "bold 20px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur  = 4;
    ctx.fillText(card.value, x + 52, y + cardH / 2 + 14);
    ctx.shadowBlur  = 0;
  });

  return canvas.toBuffer("image/jpeg", { quality: 94 });
}

function calcStats(groupMeta, groupData) {
  const participants = groupMeta?.participants || [];
  const totalMember  = participants.length;
  const totalAdmin   = participants.filter(p => p.admin === "admin" || p.admin === "superadmin").length;
  const totalBiasa   = Math.max(0, totalMember - totalAdmin);

  const now      = moment().tz("Asia/Makassar");
  const todayKey = now.format("YYYY-MM-DD");
  const msgStats = groupData?.msgStats || {};
  const msgToday = msgStats[todayKey] || 0;
  const msgTotal = Object.values(msgStats).reduce((a, b) => a + b, 0);

  const createdAt = groupMeta?.creation
    ? moment.unix(groupMeta.creation).tz("Asia/Makassar").format("DD/MM/YYYY")
    : "Tidak diketahui";

  return {
    totalMember,
    totalAdmin,
    totalBiasa,
    msgToday,
    msgTotal,
    createdAt,
    restrict: groupMeta?.restrict || false,
    announce: groupMeta?.announce || false,
  };
}

function trackGroupMessage(groupJid) {
  try {
    const db       = getDatabase();
    const groupData = db.getGroup(groupJid) || {};
    const todayKey  = moment().tz("Asia/Makassar").format("YYYY-MM-DD");
    const msgStats  = groupData.msgStats || {};
    msgStats[todayKey] = (msgStats[todayKey] || 0) + 1;

    const keys = Object.keys(msgStats).sort();
    if (keys.length > 30) {
      keys.slice(0, keys.length - 30).forEach(k => delete msgStats[k]);
    }

    db.setGroup(groupJid, { msgStats });
  } catch (e) {
    console.error("[statsgc] trackGroupMessage error:", e.message);
  }
}

const pluginConfig = {
  name: "statsgc",
  alias: ["statsgroup", "groupstats", "gcstats", "infogc"],
  category: "group",
  description: "Lihat statistik lengkap grup dengan card visual",
  usage: ".statsgc",
  example: ".statsgc",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    m.react("🕐");

    const db        = getDatabase();
    const groupData = db.getGroup(m.chat) || {};

    let groupMeta;
    try {
      groupMeta = await sock.groupMetadata(m.chat);
    } catch {
      return m.reply("❌ Gagal mengambil data grup.");
    }

    const now   = moment().tz("Asia/Makassar");
    const stats = calcStats(groupMeta, groupData);

    const cardBuffer = await buildStatsCard(groupMeta?.subject || "Grup", stats, now);

    const dayNames = {
      Sunday: "Minggu", Monday: "Senin", Tuesday: "Selasa",
      Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu",
    };
    const dayId = dayNames[now.format("dddd")] || now.format("dddd");

    const caption =
      `◈──────────────◈\n` +
      `   📊 *STATISTIK GRUP*\n` +
      `◈──────────────◈\n\n` +
      `🏠 *${groupMeta?.subject || "Grup"}*\n\n` +
      `*◈── MEMBER ──◈*\n` +
      `› 👥 Total Member : *${stats.totalMember}*\n` +
      `› 👑 Admin        : *${stats.totalAdmin}*\n` +
      `› 👤 Member Biasa : *${stats.totalBiasa}*\n\n` +
      `*◈── AKTIVITAS ──◈*\n` +
      `› 💬 Pesan Hari Ini : *${stats.msgToday}*\n` +
      `› 📊 Total Pesan    : *${stats.msgTotal}*\n\n` +
      `*◈── INFO ──◈*\n` +
      `› 📅 Dibuat   : *${stats.createdAt}*\n` +
      `› 🗓️ Sekarang : *${dayId}, ${now.format("DD/MM/YYYY")}*\n` +
      `› 🕐 Waktu    : *${now.format("HH:mm")} WITA*\n` +
      `› 🔒 Restrict : *${stats.restrict ? "✅ ON" : "❌ OFF"}*\n` +
      `› 📢 Announce : *${stats.announce ? "✅ ON" : "❌ OFF"}*\n\n` +
      `◈ ${config.bot?.name || "LYNIX STRIFE"} ◈`;

    await sock.sendMessage(m.chat, {
      image: cardBuffer,
      caption,
      contextInfo: { ...saluranCtx() },
    });

    m.react("✅");
  } catch (err) {
    console.error("[statsgc] Error:", err);
    m.react("❌");
    m.reply("❌ Gagal mengambil statistik grup.");
  }
}

export { pluginConfig as config, handler, trackGroupMessage };