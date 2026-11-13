import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "emas",
  alias: ["gold", "hargaemas", "antam"],
  category: "tools",
  description: "Harga emas Antam dan grafik historis",
  usage: ".emas",
  example: ".emas",
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
    const from30 = now - 30 * 24 * 60 * 60;

    const [xauRes, kursRes] = await Promise.all([
      axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&period1=${from30}&period2=${now}`,
        { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
      ),
      axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/USDIDR=X?interval=1d&period1=${from30}&period2=${now}`,
        { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
      ),
    ]);

    const xauResult = xauRes.data?.chart?.result?.[0];
    const kursResult = kursRes.data?.chart?.result?.[0];

    if (!xauResult) throw new Error("Data emas tidak tersedia");

    const xauMeta = xauResult.meta;
    const kursMeta = kursResult?.meta;

    const xauPrice = xauMeta.regularMarketPrice || 0; 
    const usdIdr = kursMeta?.regularMarketPrice || 16000;
    const prevXau = xauMeta.chartPreviousClose || 0;
    const change = xauPrice - prevXau;
    const changePct = prevXau ? (change / prevXau) * 100 : 0;
    const isUp = change >= 0;

    const pricePerGramUsd = xauPrice / 31.1035;
    const pricePerGramIdr = pricePerGramUsd * usdIdr;

    const antamBeli = Math.round(pricePerGramIdr * 1.03 / 1000) * 1000;
    const antamJual = Math.round(pricePerGramIdr * 0.97 / 1000) * 1000;

    const timestamps = xauResult.timestamp || [];
    const closes = xauResult.indicators?.quote?.[0]?.close || [];
    const validData = timestamps
      .map((t, i) => ({ time: t, price: closes[i] }))
      .filter(d => d.price != null && !isNaN(d.price));

    const W = 900, H = 540;
    const PAD = { top: 150, right: 40, bottom: 60, left: 90 };
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1a1420";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 120, 12);
    ctx.fill();

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("🥇 HARGA EMAS", 40, 55);

    const priceColor = isUp ? "#00e676" : "#ff5252";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`$${xauPrice.toFixed(2)}/oz  `, 40, 88);
    ctx.fillStyle = priceColor;
    ctx.fillText(`${isUp ? "▲" : "▼"} ${Math.abs(change).toFixed(2)} (${Math.abs(changePct).toFixed(2)}%)`, 40 + ctx.measureText(`$${xauPrice.toFixed(2)}/oz  `).width, 88);

    ctx.fillStyle = "#FFD700";
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `Rp ${pricePerGramIdr.toLocaleString("id-ID", { maximumFractionDigits: 0 })}/gram  •  Kurs USD/IDR: ${usdIdr.toLocaleString("id-ID")}`,
      40, 115
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      `Est. Antam Beli: Rp ${antamBeli.toLocaleString("id-ID")}  |  Est. Antam Jual: Rp ${antamJual.toLocaleString("id-ID")}`,
      40, 138
    );

    if (validData.length >= 2) {
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;
      const prices = validData.map(d => d.price);
      const minP = Math.min(...prices) * 0.998;
      const maxP = Math.max(...prices) * 1.002;

      const toX = (i) => PAD.left + (i / (validData.length - 1)) * chartW;
      const toY = (p) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;

      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (i / 4) * chartH;
        ctx.fillStyle = "#1e2130";
        ctx.fillRect(PAD.left, y, chartW, 1);
        const val = maxP - (i / 4) * (maxP - minP);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`$${val.toFixed(0)}`, PAD.left - 5, y + 4);
      }

      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      grad.addColorStop(0, isUp ? "rgba(255,215,0,0.3)" : "rgba(255,82,82,0.3)");
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(validData[0].price));
      for (let i = 1; i < validData.length; i++) {
        ctx.lineTo(toX(i), toY(validData[i].price));
      }
      ctx.lineTo(toX(validData.length - 1), PAD.top + chartH);
      ctx.lineTo(toX(0), PAD.top + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(0), toY(validData[0].price));
      for (let i = 1; i < validData.length; i++) {
        ctx.lineTo(toX(i), toY(validData[i].price));
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(validData.length - 1), toY(validData[validData.length - 1].price), 5, 0, Math.PI * 2);
      ctx.fillStyle = "#FFD700";
      ctx.fill();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const labelIdx = [0, Math.floor(validData.length / 4), Math.floor(validData.length / 2), Math.floor(validData.length * 3 / 4), validData.length - 1];
      for (const i of labelIdx) {
        const d = new Date(validData[i].time * 1000);
        ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, toX(i), H - 15);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.fillText("30 Hari Terakhir  •  Data: Yahoo Finance (GC=F)", PAD.left, H - 15);
    }

    const imgBuffer = canvas.toBuffer("image/png");

    const caption = [
      `🥇 *HARGA EMAS*`,
      ``,
      `╭─────────────────`,
      `│ 💵 Harga Global : *$${xauPrice.toFixed(2)}/troy oz*`,
      `│ ${isUp ? "📈" : "📉"} Perubahan    : *${isUp ? "+" : ""}${change.toFixed(2)} (${isUp ? "+" : ""}${changePct.toFixed(2)}%)*`,
      `│ 💰 Per Gram     : *Rp ${pricePerGramIdr.toLocaleString("id-ID", { maximumFractionDigits: 0 })}*`,
      `│ 💱 Kurs USD/IDR : *${usdIdr.toLocaleString("id-ID")}*`,
      `├─────────────────`,
      `│ 🏅 Est. Antam Beli : *Rp ${antamBeli.toLocaleString("id-ID")}*`,
      `│ 🏅 Est. Antam Jual : *Rp ${antamJual.toLocaleString("id-ID")}*`,
      `╰─────────────────`,
      ``,
      `> _*Disclaimer:* Harga Antam adalah estimasi. Cek harga resmi di logammulia.com_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Emas]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data emas.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };