import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import fs from "fs";

const pluginConfig = {
  name: "ihsg",
  alias: ["saham", "idx", "bursa"],
  category: "tools",
  description: "Grafik dan info IHSG terkini",
  usage: ".ihsg",
  example: ".ihsg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  m.react("🕕");

  try {
    
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60; 

    const { data: histData } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=1d&period1=${from}&period2=${now}`,
      {
        timeout: 15000,
        headers: { "User-Agent": "Mozilla/5.0" },
      }
    );

    const result = histData?.chart?.result?.[0];
    if (!result) {
      m.react("☢");
      return m.reply("❌ Gagal mengambil data IHSG.");
    }

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.closes ||
                   result.indicators?.quote?.[0]?.close || [];
    const meta = result.meta || {};

    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1] || 0;
    const prevClose = meta.chartPreviousClose || closes[closes.length - 2] || 0;
    const change = currentPrice - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const isUp = change >= 0;

    const dayHigh = meta.regularMarketDayHigh || Math.max(...closes.filter(Boolean));
    const dayLow = meta.regularMarketDayLow || Math.min(...closes.filter(Boolean));

    const validData = timestamps
      .map((t, i) => ({ time: t, price: closes[i] }))
      .filter(d => d.price != null && !isNaN(d.price));

    const W = 900, H = 500;
    const PAD = { top: 80, right: 40, bottom: 60, left: 80 };
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("IHSG — IDX Composite", PAD.left, 45);

    const priceColor = isUp ? "#00e676" : "#ff5252";
    ctx.fillStyle = priceColor;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(
      `${currentPrice.toLocaleString("id-ID", { minimumFractionDigits: 2 })}  ${isUp ? "▲" : "▼"} ${Math.abs(change).toFixed(2)} (${Math.abs(changePct).toFixed(2)}%)`,
      PAD.left, 72
    );

    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;
    const prices = validData.map(d => d.price);
    const minP = Math.min(...prices) * 0.998;
    const maxP = Math.max(...prices) * 1.002;

    const toX = (i) => PAD.left + (i / (validData.length - 1)) * chartW;
    const toY = (p) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;

    ctx.strokeStyle = "#1e2130";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PAD.top + (i / 5) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();

      const val = maxP - (i / 5) * (maxP - minP);
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px sans-serif";
      ctx.fillText(val.toLocaleString("id-ID", { maximumFractionDigits: 0 }), 5, y + 4);
    }

    const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    gradient.addColorStop(0, isUp ? "rgba(0,230,118,0.3)" : "rgba(255,82,82,0.3)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(validData[0].price));
    for (let i = 1; i < validData.length; i++) {
      ctx.lineTo(toX(i), toY(validData[i].price));
    }
    ctx.lineTo(toX(validData.length - 1), PAD.top + chartH);
    ctx.lineTo(toX(0), PAD.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = priceColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.moveTo(toX(0), toY(validData[0].price));
    for (let i = 1; i < validData.length; i++) {
      ctx.lineTo(toX(i), toY(validData[i].price));
    }
    ctx.stroke();

    const lastX = toX(validData.length - 1);
    const lastY = toY(validData[validData.length - 1].price);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = priceColor;
    ctx.fill();

    const labelIdx = [0, Math.floor(validData.length / 2), validData.length - 1];
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    for (const i of labelIdx) {
      const d = new Date(validData[i].time * 1000);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillText(label, toX(i), H - 15);
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.fillText(
      `High: ${dayHigh.toLocaleString("id-ID", { minimumFractionDigits: 2 })}   Low: ${dayLow.toLocaleString("id-ID", { minimumFractionDigits: 2 })}   Data: Yahoo Finance   30 Hari Terakhir`,
      PAD.left, H - 15
    );

    const imgBuffer = canvas.toBuffer("image/png");

    const caption = [
      `📊 *IHSG — IDX Composite*`,
      ``,
      `╭─────────────────`,
      `│ 💰 Harga   : *${currentPrice.toLocaleString("id-ID", { minimumFractionDigits: 2 })}*`,
      `│ ${isUp ? "📈" : "📉"} Perubahan : *${isUp ? "+" : ""}${change.toFixed(2)} (${isUp ? "+" : ""}${changePct.toFixed(2)}%)*`,
      `│ 🔺 High    : *${dayHigh.toLocaleString("id-ID", { minimumFractionDigits: 2 })}*`,
      `│ 🔻 Low     : *${dayLow.toLocaleString("id-ID", { minimumFractionDigits: 2 })}*`,
      `│ 📅 Periode : *30 Hari Terakhir*`,
      `│ 🕐 Update  : *Real-time*`,
      `╰─────────────────`,
      ``,
      `> _Data dari Yahoo Finance_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[IHSG]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data IHSG.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };