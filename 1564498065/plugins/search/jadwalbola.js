import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "jadwalbola",
  alias: ["jbola", "fixtur", "fixture", "schedulebol"],
  category: "search",
  description: "Jadwal pertandingan bola hari ini dan besok",
  usage: ".jadwalbola",
  example: ".jadwalbola",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function groupByDate(matches) {
  const grouped = {};
  for (const match of matches) {
    const parts = match.split(" - ");
    const date = parts[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({
      time: parts[1],
      teams: parts[2],
      competition: parts[3] || "",
    });
  }
  return grouped;
}

function getCompEmoji(comp) {
  if (comp.includes("Piala Duni")) return "🏆";
  if (comp.includes("Champions")) return "⭐";
  if (comp.includes("Premier")) return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (comp.includes("La Liga")) return "🇪🇸";
  if (comp.includes("Serie")) return "🇮🇹";
  if (comp.includes("Bundesliga")) return "🇩🇪";
  if (comp.includes("Ligue")) return "🇫🇷";
  return "⚽";
}

async function handler(m, { sock }) {
  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.nexray.eu.cc/information/jadwalbola`,
      { timeout: 15000 }
    );

    if (!data?.status || !data?.result?.length) {
      m.react("☢");
      return m.reply(`❌ Gagal mengambil jadwal bola.`);
    }

    const grouped = groupByDate(data.result);
    const dates = Object.keys(grouped).slice(0, 4);

    const rowH = 38;
    const headerH = 80;
    const dateH = 35;
    let totalRows = 0;
    dates.forEach(d => { totalRows += grouped[d].length; });
    const H = headerH + dates.length * dateH + totalRows * rowH + 40;
    const W = 900;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a1628");
    bg.addColorStop(1, "#0d1f3c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 55, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("⚽ JADWAL PERTANDINGAN BOLA", 40, 50);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${data.response_time}  •  nexray.eu.cc`, W - 40, 50);
    ctx.textAlign = "left";

    let curY = headerH + 10;

    for (const date of dates) {
      const matches = grouped[date];

      ctx.fillStyle = "rgba(59,130,246,0.2)";
      ctx.beginPath();
      ctx.roundRect(20, curY, W - 40, dateH - 5, 8);
      ctx.fill();

      ctx.fillStyle = "#60a5fa";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`📅 ${date}`, 35, curY + 20);

      ctx.fillStyle = "#475569";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${matches.length} pertandingan`, W - 35, curY + 20);
      ctx.textAlign = "left";

      curY += dateH + 3;

      matches.forEach((match, i) => {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0)";
        ctx.fillRect(20, curY, W - 40, rowH - 2);

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(match.time, 35, curY + 24);

        ctx.fillStyle = "#ffffff";
        ctx.font = "14px sans-serif";
        ctx.fillText(match.teams, 120, curY + 24);

        const emoji = getCompEmoji(match.competition);
        ctx.fillStyle = "#64748b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${emoji} ${match.competition}`, W - 35, curY + 24);
        ctx.textAlign = "left";

        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(35, curY + rowH - 3, W - 70, 1);

        curY += rowH;
      });

      curY += 8;
    }

    const imgBuffer = canvas.toBuffer("image/png");

    let captionLines = [];
    for (const date of dates) {
      captionLines.push(`\n📅 *${date}*`);
      grouped[date].forEach(match => {
        captionLines.push(`│ 🕐 *${match.time}* — ${match.teams} ${getCompEmoji(match.competition)}`);
      });
    }

    const caption = [
      `⚽ *JADWAL PERTANDINGAN BOLA*`,
      ``,
      ...captionLines,
      ``,
      `> _Data via nexray.eu.cc_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[JadwalBola]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil jadwal bola.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };