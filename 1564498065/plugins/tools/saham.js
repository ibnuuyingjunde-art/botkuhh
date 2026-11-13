import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "saham",
  alias: ["stock", "idx", "emiten"],
  category: "tools",
  description: "Harga saham IDX dengan grafik",
  usage: ".saham <kode>",
  example: ".saham BBCA",
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
  const args = m.args || [];

  if (!args[0]) {
    return m.reply(
      `📊 *CEK SAHAM IDX*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}saham <kode>\`\n\n` +
      `*Contoh saham populer:*\n` +
      `\`${m.prefix}saham BBCA\` — Bank BCA\n` +
      `\`${m.prefix}saham TLKM\` — Telkom\n` +
      `\`${m.prefix}saham BBRI\` — Bank BRI\n` +
      `\`${m.prefix}saham ASII\` — Astra\n` +
      `\`${m.prefix}saham GOTO\` — GoTo\n` +
      `\`${m.prefix}saham BREN\` — Barito Renewables`
    );
  }

  const kode = args[0].toUpperCase();
  const symbol = `${kode}.JK`;

  m.react("🕕");

  try {
    const now = Math.floor(Date.now() / 1000);
    const from30 = now - 30 * 24 * 60 * 60;

    const { data } = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${from30}&period2=${now}`,
      { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const result = data?.chart?.result?.[0];
    if (!result) {
      m.react("☢");
      return m.reply(`❌ Saham *${kode}* tidak ditemukan.\n\n> Pastikan kode saham benar (contoh: BBCA, TLKM, BBRI)`);
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const currentPrice = meta.regularMarketPrice || closes[closes.length - 1] || 0;
    const prevClose = meta.chartPreviousClose || closes[closes.length - 2] || 0;
    const change = currentPrice - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const isUp = change >= 0;
    const dayHigh = meta.regularMarketDayHigh || 0;
    const dayLow = meta.regularMarketDayLow || 0;
    const volume = meta.regularMarketVolume || volumes[volumes.length - 1] || 0;
    const marketCap = meta.marketCap || 0;
    const name = meta.longName || meta.shortName || kode;

    const validData = timestamps
      .map((t, i) => ({ time: t, price: closes[i] }))
      .filter(d => d.price != null && !isNaN(d.price));

    const W = 900, H = 540;
    const PAD = { top: 155, right: 40, bottom: 60, left: 90 };
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 125, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`📊 ${kode} — ${name.substring(0, 35)}`, 40, 52);

    const priceColor = isUp ? "#00e676" : "#ff5252";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`Rp ${currentPrice.toLocaleString("id-ID")}  `, 40, 88);
    ctx.fillStyle = priceColor;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(
      `${isUp ? "▲" : "▼"} ${Math.abs(change).toFixed(0)} (${Math.abs(changePct).toFixed(2)}%)`,
      40 + 200, 88
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      `High: ${dayHigh.toLocaleString("id-ID")}  •  Low: ${dayLow.toLocaleString("id-ID")}  •  Vol: ${(volume / 1e6).toFixed(2)}M`,
      40, 115
    );

    if (marketCap > 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "12px sans-serif";
      ctx.fillText(
        `Market Cap: Rp ${(marketCap / 1e12).toFixed(2)}T  •  Prev Close: ${prevClose.toLocaleString("id-ID")}`,
        40, 135
      );
    }

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
        ctx.fillText(val.toFixed(0), PAD.left - 5, y + 4);
      }

      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      grad.addColorStop(0, isUp ? "rgba(0,230,118,0.25)" : "rgba(255,82,82,0.25)");
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
      ctx.strokeStyle = priceColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(0), toY(validData[0].price));
      for (let i = 1; i < validData.length; i++) {
        ctx.lineTo(toX(i), toY(validData[i].price));
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(validData.length - 1), toY(validData[validData.length - 1].price), 5, 0, Math.PI * 2);
      ctx.fillStyle = priceColor;
      ctx.fill();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const labelIdx = [0, Math.floor(validData.length / 4), Math.floor(validData.length / 2), Math.floor(validData.length * 3 / 4), validData.length - 1];
      for (const i of labelIdx) {
        if (validData[i]) {
          const d = new Date(validData[i].time * 1000);
          ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, toX(i), H - 15);
        }
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.fillText("30 Hari Terakhir  •  Data: Yahoo Finance", PAD.left, H - 15);
    }

    const imgBuffer = canvas.toBuffer("image/png");

    const caption = [
      `📊 *SAHAM ${kode}*`,
      ``,
      `╭─────────────────`,
      `│ 🏢 Nama      : *${name.substring(0, 30)}*`,
      `│ 💰 Harga     : *Rp ${currentPrice.toLocaleString("id-ID")}*`,
      `│ ${isUp ? "📈" : "📉"} Perubahan : *${isUp ? "+" : ""}${change.toFixed(0)} (${isUp ? "+" : ""}${changePct.toFixed(2)}%)*`,
      `│ 🔺 High      : *Rp ${dayHigh.toLocaleString("id-ID")}*`,
      `│ 🔻 Low       : *Rp ${dayLow.toLocaleString("id-ID")}*`,
      `│ 📦 Volume    : *${(volume / 1e6).toFixed(2)}M lot*`,
      ...(marketCap > 0 ? [`│ 🏦 Mkt Cap   : *Rp ${(marketCap / 1e12).toFixed(2)}T*`] : []),
      `╰─────────────────`,
      ``,
      `> _Data dari Yahoo Finance • 30 hari terakhir_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Saham]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data saham *${kode}*.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };