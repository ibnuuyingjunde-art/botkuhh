import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "inflasi",
  alias: ["inflasiindo", "dataInflasi"],
  category: "finance",
  description: "Cek data inflasi Indonesia terbaru dari BPS",
  usage: ".inflasi",
  example: ".inflasi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const DATA_INFLASI = [
  { bulan: "Jan 2025", mtm: 0.76, yoy: 2.57, inti: 2.35 },
  { bulan: "Feb 2025", mtm: 0.48, yoy: 2.60, inti: 2.48 },
  { bulan: "Mar 2025", mtm: 1.65, yoy: 2.48, inti: 2.54 },
  { bulan: "Apr 2025", mtm: -0.33, yoy: 2.21, inti: 2.46 },
  { bulan: "Mei 2025", mtm: 0.17, yoy: 2.40, inti: 2.37 },
];

async function fetchYahoo(symbol, days = 30) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  const { data } = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${from}&period2=${now}`,
    { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const res = data?.chart?.result?.[0];
  if (!res) throw new Error("No data");
  const timestamps = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((t, i) => closes[i] != null ? {
      label: new Date(t * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      value: closes[i],
    } : null)
    .filter(Boolean);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const w of words) {
    const t = line + w + " ";
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line.trim(), x, cy);
      line = w + " ";
      cy += lh;
    } else line = t;
  }
  ctx.fillText(line.trim(), x, cy);
  return cy;
}

async function handler(m, { sock }) {
  m.react("🕕");
  try {
    
    const [idrHistory, cpoHistory] = await Promise.all([
      fetchYahoo("IDR=X", 30).catch(() => []),
      fetchYahoo("CPOAX.KL", 30).catch(() => []), 
    ]);

    const terbaru = DATA_INFLASI[DATA_INFLASI.length - 1];
    const sebelumnya = DATA_INFLASI[DATA_INFLASI.length - 2];
    const trendMtm = terbaru.mtm > sebelumnya.mtm;
    const yoyNum = terbaru.yoy;

    let statusLabel = "🟢 Normal";
    let statusColor = "#00e676";
    if (yoyNum < 1) { statusLabel = "🟡 Sangat Rendah"; statusColor = "#f59e0b"; }
    else if (yoyNum > 5) { statusLabel = "🔴 Tinggi"; statusColor = "#ef4444"; }
    else if (yoyNum > 3) { statusLabel = "🟠 Moderat"; statusColor = "#f97316"; }

    const W = 900, H = 620;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    const hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, "#065f46");
    hg.addColorStop(1, "#047857");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 115, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("📊 INFLASI INDONESIA", 40, 55);

    ctx.fillStyle = "#6ee7b7";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Data Terbaru: ${terbaru.bulan}  •  Sumber: BPS`, 40, 78);

    ctx.fillStyle = statusColor;
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(statusLabel, 40, 118);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px sans-serif";
    ctx.fillText("  (Target BI: 2.5% ±1%)", 40 + ctx.measureText(statusLabel).width + 8, 118);

    const stats = [
      { label: "MtM", val: `${terbaru.mtm > 0 ? "+" : ""}${terbaru.mtm.toFixed(2)}%`, desc: "Bulanan", color: trendMtm ? "#ef4444" : "#00e676" },
      { label: "YoY", val: `${terbaru.yoy.toFixed(2)}%`, desc: "Tahunan", color: "#f59e0b" },
      { label: "Inti", val: `${terbaru.inti.toFixed(2)}%`, desc: "Core Inflasi", color: "#93c5fd" },
    ];
    stats.forEach((s, i) => {
      const sx = W - 320 + i * 105;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.roundRect(sx, 22, 95, 100, 8);
      ctx.fill();
      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.label, sx + 47, 44);
      ctx.fillStyle = s.color;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(s.val, sx + 47, 72);
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.fillText(s.desc, sx + 47, 92);
    });

    const barY = 148;
    const barH = 160;
    ctx.fillStyle = "#1a1d2e";
    ctx.beginPath();
    ctx.roundRect(20, barY, W - 40, barH, 10);
    ctx.fill();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("📋 Riwayat Inflasi YoY (%) - 5 Bulan Terakhir", 35, barY + 22);

    const barPad = { top: 35, right: 20, bottom: 30, left: 20 };
    const barAreaW = W - 40 - barPad.left - barPad.right;
    const barAreaH = barH - barPad.top - barPad.bottom;
    const barWidth = barAreaW / DATA_INFLASI.length - 10;
    const maxYoy = Math.max(...DATA_INFLASI.map(d => d.yoy)) + 0.5;

    DATA_INFLASI.forEach((d, i) => {
      const bx = 20 + barPad.left + i * (barAreaW / DATA_INFLASI.length) + 5;
      const bh = (d.yoy / maxYoy) * barAreaH;
      const by = barY + barPad.top + barAreaH - bh;

      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, i === DATA_INFLASI.length - 1 ? "#00e676" : "#1d4ed8");
      bg.addColorStop(1, i === DATA_INFLASI.length - 1 ? "#065f46" : "#1e3a8a");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(bx, by, barWidth, bh, 4);
      ctx.fill();

      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${d.yoy.toFixed(2)}%`, bx + barWidth / 2, by - 5);

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.fillText(d.bulan.split(" ")[0], bx + barWidth / 2, barY + barH - 8);
    });

    const drawLineChart = (history, cx, cy, cw, ch, title) => {
      if (!history.length) return;
      ctx.fillStyle = "#1a1d2e";
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 10);
      ctx.fill();

      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(title, cx + 15, cy + 22);

      const vals = history.map(d => d.value);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const pad = { top: 38, right: 15, bottom: 26, left: 58 };
      const lW = cw - pad.left - pad.right;
      const lH = ch - pad.top - pad.bottom;
      const isUp = vals[vals.length - 1] >= vals[0];
      const lc = isUp ? "#ef4444" : "#00e676";

      const toX = i => cx + pad.left + (i / (history.length - 1)) * lW;
      const toY = v => cy + pad.top + lH - ((v - minV) / (maxV - minV || 1)) * lH;

      for (let i = 0; i <= 3; i++) {
        const gy = cy + pad.top + (i / 3) * lH;
        const gv = maxV - (i / 3) * (maxV - minV);
        ctx.fillStyle = "#1e2130";
        ctx.fillRect(cx + pad.left, gy, lW, 1);
        ctx.fillStyle = "#6b7280";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(gv.toLocaleString("id-ID", { maximumFractionDigits: 0 }), cx + pad.left - 4, gy + 4);
      }

      const grad = ctx.createLinearGradient(0, cy + pad.top, 0, cy + pad.top + lH);
      grad.addColorStop(0, isUp ? "rgba(239,68,68,0.3)" : "rgba(0,230,118,0.3)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < vals.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.lineTo(toX(vals.length - 1), cy + pad.top + lH);
      ctx.lineTo(toX(0), cy + pad.top + lH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = lc;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(0), toY(vals[0]));
      for (let i = 1; i < vals.length; i++) ctx.lineTo(toX(i), toY(vals[i]));
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(vals.length - 1), toY(vals[vals.length - 1]), 4, 0, Math.PI * 2);
      ctx.fillStyle = lc;
      ctx.fill();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(history[0].label, toX(0), cy + ch - 6);
      ctx.fillText(history[history.length - 1].label, toX(vals.length - 1), cy + ch - 6);
    };

    const chartY = 322;
    const chartH = 260;
    drawLineChart(idrHistory, 20, chartY, 420, chartH, "💵 USD/IDR - 30 Hari");
    drawLineChart(cpoHistory, 460, chartY, 420, chartH, "🌴 CPO/Minyak Sawit - 30 Hari");

    ctx.fillStyle = "#374151";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Data historis: Yahoo Finance  •  Data inflasi: BPS  •  bps.go.id", W / 2, H - 8);

    const imgBuffer = canvas.toBuffer("image/png");
    const caption =
      `╔══════════════════════════╗\n` +
      `║   📊 INFLASI INDONESIA   ║\n` +
      `╚══════════════════════════╝\n\n` +
      `📅 *Data Terbaru: ${terbaru.bulan}*\n\n` +
      `📈 *MtM:* ${terbaru.mtm > 0 ? "+" : ""}${terbaru.mtm.toFixed(2)}%\n` +
      `📊 *YoY:* ${terbaru.yoy.toFixed(2)}%\n` +
      `🔵 *Inti:* ${terbaru.inti.toFixed(2)}%\n\n` +
      `📌 *Status:* ${statusLabel}\n` +
      `> _Data: BPS & Yahoo Finance_`;

    await sock.sendMessage(m.chat, { image: imgBuffer, caption }, { quoted: m });
    m.react("✅");
  } catch (e) {
    console.error("[Inflasi]", e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data. Coba lagi!");
  }
}

export { pluginConfig as config, handler };