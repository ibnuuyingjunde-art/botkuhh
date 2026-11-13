import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "cuaca",
  alias: ["weather", "bmkg", "prakiraan"],
  category: "search",
  description: "Cek cuaca kota di Indonesia",
  usage: ".cuaca <kota>",
  example: ".cuaca Makassar",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const CUACA_EMOJI = {
  "Cerah": "☀️",
  "Cerah Berawan": "🌤️",
  "Berawan": "☁️",
  "Berawan Tebal": "☁️",
  "Hujan Ringan": "🌦️",
  "Hujan Sedang": "🌧️",
  "Hujan Lebat": "⛈️",
  "Hujan Petir": "⛈️",
  "Kabut": "🌫️",
  "Asap": "🌫️",
};

function getCuacaEmoji(cuaca) {
  for (const [key, emoji] of Object.entries(CUACA_EMOJI)) {
    if (cuaca.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return "🌡️";
}

function getSuhuNum(suhu) {
  return parseInt(suhu.replace("°C", "")) || 0;
}

async function handler(m, { sock }) {
  const kota = m.args?.join(" ") || "";

  if (!kota) {
    return m.reply(
      `🌤️ *CEK CUACA*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}cuaca <kota>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}cuaca Makassar\`\n` +
      `\`${m.prefix}cuaca Jakarta\`\n` +
      `\`${m.prefix}cuaca Surabaya\``
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.nexray.eu.cc/information/cuaca`,
      {
        params: { kota },
        timeout: 15000,
      }
    );

    if (!data?.status || !data?.result) {
      m.react("☢");
      return m.reply(`❌ Kota *${kota}* tidak ditemukan.\n\n> Coba nama kota lain.`);
    }

    const r = data.result;
    const loc = r.location;
    const forecasts = r.forecasts || [];
    const first = forecasts[0] || {};

    const W = 900, H = 420 + Math.ceil(forecasts.length / 2) * 110;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a1628");
    bg.addColorStop(1, "#1a2a4a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(20, 20, W - 40, 130, 16);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText(`📍 ${loc.desa}, ${loc.kecamatan}, ${loc.provinsi}`, 40, 55);

    const emoji = getCuacaEmoji(first.cuaca || "");
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(`${emoji} ${first.cuaca || "—"}`, 40, 100);

    ctx.fillStyle = "#60a5fa";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(first.suhu || "—", W - 40, 110);
    ctx.textAlign = "left";

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      `💧 ${first.kelembaban}   💨 ${first.kecepatan_angin} ${first.arah_angin}   👁️ ${first.visibilitas}`,
      40, 138
    );

    const cardW = (W - 60) / 2;
    forecasts.forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 20 + col * (cardW + 20);
      const cy = 170 + row * 110;

      ctx.fillStyle = i === 0 ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, 95, 12);
      ctx.fill();

      ctx.strokeStyle = i === 0 ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#60a5fa";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`🕐 ${f.waktu.substring(0, 5)}`, cx + 15, cy + 25);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${getCuacaEmoji(f.cuaca)} ${f.cuaca}`, cx + 15, cy + 50);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(`🌡️ ${f.suhu}  💧 ${f.kelembaban}  💨 ${f.kecepatan_angin}`, cx + 15, cy + 75);
    });

    const footY = H - 25;
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Data: BMKG via nexray.eu.cc  •  ${data.response_time}`, 20, footY);

    const imgBuffer = canvas.toBuffer("image/png");

    const forecastLines = forecasts.map(f =>
      `│ 🕐 *${f.waktu.substring(0, 5)}* — ${getCuacaEmoji(f.cuaca)} ${f.cuaca} ${f.suhu} 💧${f.kelembaban}`
    ).join("\n");

    const caption = [
      `🌤️ *CUACA ${kota.toUpperCase()}*`,
      ``,
      `╭─────────────────`,
      `│ 📍 ${loc.desa}, ${loc.kecamatan}`,
      `│ 🌏 ${loc.provinsi}`,
      `├─────────────────`,
      `│ ${getCuacaEmoji(first.cuaca)} *${first.cuaca}* — ${first.suhu}`,
      `│ 💧 Kelembaban : *${first.kelembaban}*`,
      `│ 💨 Angin      : *${first.kecepatan_angin} ${first.arah_angin}*`,
      `│ 👁️ Visibilitas: *${first.visibilitas}*`,
      `├─────────────────`,
      `│ 📅 Prakiraan:`,
      forecastLines,
      `╰─────────────────`,
      ``,
      `> _Data BMKG • ${data.response_time}_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Cuaca]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data cuaca.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };