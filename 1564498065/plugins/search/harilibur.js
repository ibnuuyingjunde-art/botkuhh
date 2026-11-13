import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "harilibur",
  alias: ["libur", "harinasional", "eventhari", "kalender"],
  category: "search",
  description: "Cek hari libur dan hari nasional Indonesia",
  usage: ".harilibur",
  example: ".harilibur",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function getEventEmoji(event) {
  if (event.includes("Kemerdekaan")) return "🇮🇩";
  if (event.includes("Natal")) return "🎄";
  if (event.includes("Pancasila")) return "🦅";
  if (event.includes("Pahlawan")) return "⚔️";
  if (event.includes("Ibu")) return "👩";
  if (event.includes("Anak")) return "👶";
  if (event.includes("Guru")) return "📚";
  if (event.includes("Buruh")) return "⚒️";
  if (event.includes("Bumi")) return "🌍";
  if (event.includes("Lingkungan")) return "🌿";
  if (event.includes("Air")) return "💧";
  if (event.includes("Musik")) return "🎵";
  if (event.includes("Film")) return "🎬";
  if (event.includes("Olahraga")) return "🏅";
  if (event.includes("Kesehatan")) return "🏥";
  if (event.includes("Pendidikan")) return "🎓";
  if (event.includes("TNI") || event.includes("Militer")) return "🎖️";
  if (event.includes("Polisi") || event.includes("Bhayangkara")) return "👮";
  if (event.includes("Anti Korupsi")) return "⚖️";
  if (event.includes("Anti Narkoba")) return "🚫";
  if (event.includes("AIDS")) return "🎗️";
  if (event.includes("Donor Darah")) return "🩸";
  if (event.includes("Pramuka")) return "⚜️";
  if (event.includes("Pers")) return "📰";
  if (event.includes("Radio")) return "📻";
  if (event.includes("Batik")) return "🎨";
  if (event.includes("Reformasi")) return "✊";
  return "📅";
}

async function handler(m, { sock }) {
  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.nexray.eu.cc/information/hari-libur`,
      { timeout: 15000 }
    );

    if (!data?.status || !data?.result) {
      m.react("☢");
      return m.reply(`❌ Gagal mengambil data hari libur.`);
    }

    const r = data.result;
    const hariIni = r.hari_ini;
    const mendatang = r.mendatang;
    const statistik = r.statistik;

    const upcomingNasional = mendatang.event_nasional.slice(0, 5);
    const upcomingLibur = mendatang.hari_libur.slice(0, 3);
    const totalRows = upcomingNasional.length + upcomingLibur.length;

    const W = 900;
    const H = 300 + totalRows * 55 + 60;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 70, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("🗓️ HARI LIBUR & NASIONAL INDONESIA", 40, 55);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(20, 100, W - 40, 60, 12);
    ctx.fill();

    const statItems = [
      { label: "Total Event", value: statistik.total_event, color: "#60a5fa" },
      { label: "Hari Libur", value: statistik.total_hari_libur, color: "#f87171" },
      { label: "Hari Nasional", value: statistik.total_hari_nasional, color: "#34d399" },
    ];

    statItems.forEach((s, i) => {
      const x = 60 + i * 280;
      ctx.fillStyle = s.color;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(s.value, x, 140);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(s.label, x, 155);
    });

    const todayY = 178;
    ctx.fillStyle = hariIni.events.length > 0 ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(20, todayY, W - 40, 55, 12);
    ctx.fill();
    ctx.strokeStyle = hariIni.events.length > 0 ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText("📅 HARI INI", 40, todayY + 22);

    ctx.fillStyle = hariIni.events.length > 0 ? "#34d399" : "#64748b";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(
      hariIni.events.length > 0
        ? hariIni.events.map(e => `${getEventEmoji(e.event)} ${e.event}`).join("  •  ")
        : "Tidak ada hari spesial hari ini",
      40, todayY + 42
    );

    let curY = todayY + 70;

    if (upcomingNasional.length > 0) {
      ctx.fillStyle = "#60a5fa";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("📌 HARI NASIONAL MENDATANG", 40, curY);
      curY += 15;

      upcomingNasional.forEach((e, i) => {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0)";
        ctx.fillRect(20, curY, W - 40, 50);

        const [month, day] = e.date.split("-");
        const dateStr = `${day}/${month}`;

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(dateStr, 40, curY + 30);

        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.fillText(`${getEventEmoji(e.event)} ${e.event}`, 110, curY + 30);

        ctx.fillStyle = "#475569";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${e.daysUntil} hari lagi`, W - 40, curY + 30);
        ctx.textAlign = "left";

        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(35, curY + 48, W - 70, 1);

        curY += 55;
      });
    }

    if (upcomingLibur.length > 0) {
      curY += 10;
      ctx.fillStyle = "#f87171";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("🔴 HARI LIBUR MENDATANG", 40, curY);
      curY += 15;

      upcomingLibur.forEach((e, i) => {
        ctx.fillStyle = "rgba(248,113,113,0.08)";
        ctx.fillRect(20, curY, W - 40, 50);

        const [month, day] = e.date.split("-");
        const dateStr = `${day}/${month}`;

        ctx.fillStyle = "#f87171";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(dateStr, 40, curY + 30);

        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.fillText(`${getEventEmoji(e.event)} ${e.event}`, 110, curY + 30);

        ctx.fillStyle = "#475569";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${e.daysUntil} hari lagi`, W - 40, curY + 30);
        ctx.textAlign = "left";

        curY += 55;
      });
    }

    ctx.fillStyle = "#334155";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Data: Wikipedia via nexray.eu.cc  •  ${data.response_time}`, 20, H - 15);

    const imgBuffer = canvas.toBuffer("image/png");

    const nasionalLines = upcomingNasional.map(e => {
      const [month, day] = e.date.split("-");
      return `│ 📅 *${day}/${month}* — ${getEventEmoji(e.event)} ${e.event} _(${e.daysUntil} hari lagi)_`;
    }).join("\n");

    const liburLines = upcomingLibur.map(e => {
      const [month, day] = e.date.split("-");
      return `│ 🔴 *${day}/${month}* — ${getEventEmoji(e.event)} ${e.event} _(${e.daysUntil} hari lagi)_`;
    }).join("\n");

    const caption = [
      `🗓️ *HARI LIBUR & NASIONAL INDONESIA*`,
      ``,
      `╭─────────────────`,
      `│ 📊 Total Event  : *${statistik.total_event}*`,
      `│ 🔴 Hari Libur   : *${statistik.total_hari_libur}*`,
      `│ 🇮🇩 Hari Nasional: *${statistik.total_hari_nasional}*`,
      `├─────────────────`,
      `│ 📅 *Hari Ini:*`,
      `│ ${hariIni.events.length > 0 ? hariIni.events.map(e => `${getEventEmoji(e.event)} ${e.event}`).join(", ") : "Tidak ada hari spesial"}`,
      `├─────────────────`,
      `│ 📌 *Hari Nasional Mendatang:*`,
      nasionalLines,
      `├─────────────────`,
      `│ 🔴 *Hari Libur Mendatang:*`,
      liburLines,
      `╰─────────────────`,
      ``,
      `> _Data Wikipedia via nexray.eu.cc_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[HariLibur]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data hari libur.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };