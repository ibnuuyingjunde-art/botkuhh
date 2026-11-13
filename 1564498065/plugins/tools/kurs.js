import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "kurs",
  alias: ["currency", "convert"],
  category: "search",
  description: "Konversi mata uang dengan grafik",
  usage: ".kurs <jumlah> <dari> <ke>",
  example: ".kurs 100 USD IDR",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const args = m.args || [];

  if (!args.length) {
    return m.reply(
      `💱 *KONVERSI MATA UANG*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}kurs <jumlah> <dari> <ke>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}kurs 100 USD IDR\`\n` +
      `\`${m.prefix}kurs 1 EUR IDR\`\n` +
      `\`${m.prefix}kurs 50000 IDR USD\`\n\n` +
      `_Gunakan kode mata uang ISO 4217 (USD, IDR, EUR, JPY, dll)_`,
    );
  }

  let amount, from, to;

  if (args.length === 3) {
    amount = parseFloat(args[0]);
    from   = args[1].toUpperCase();
    to     = args[2].toUpperCase();
  } else if (args.length === 2) {
    amount = 1;
    from   = args[0].toUpperCase();
    to     = args[1].toUpperCase();
  } else {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `Gunakan: \`${m.prefix}kurs <jumlah> <dari> <ke>\`\n` +
      `Contoh: \`${m.prefix}kurs 100 USD IDR\``,
    );
  }

  if (isNaN(amount) || amount <= 0) {
    return m.reply(`❌ *Jumlah tidak valid!*\n\n> Masukkan angka yang benar.`);
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.azbry.com/api/search/kurs?from=${from}&to=${to}&amount=${amount}`,
      { timeout: 10000 },
    );

    if (!data?.status || !data?.result) {
      m.react("☢");
      return m.reply(`❌ *Gagal mengambil data kurs*\n\n> Pastikan kode mata uang benar.`);
    }

    const r = data.result;

    let histPrices = [];
    let histDates = [];
    try {
      const now = Math.floor(Date.now() / 1000);
      const from7 = now - 7 * 24 * 60 * 60;
      const symbol = `${from}${to}=X`;
      const { data: yahooData } = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${from7}&period2=${now}`,
        { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const res = yahooData?.chart?.result?.[0];
      if (res) {
        const timestamps = res.timestamp || [];
        const closes = res.indicators?.quote?.[0]?.close || [];
        timestamps.forEach((t, i) => {
          if (closes[i] != null) {
            const d = new Date(t * 1000);
            histDates.push(`${d.getDate()}/${d.getMonth() + 1}`);
            histPrices.push(closes[i]);
          }
        });
      }
    } catch {}

    const W = 900, H = 520;
    const PAD = { top: 130, right: 40, bottom: 60, left: 80 };
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1a1d2e";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 100, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`💱 ${from} → ${to}`, 40, 52);

    ctx.fillStyle = "#00e676";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(
      `${r.amount} ${r.from} = ${r.formatted} ${r.to}`,
      40, 85
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px sans-serif";
    ctx.fillText(`1 ${r.from} = ${r.rate.toLocaleString("id-ID")} ${r.to}  •  ${r.from_name} → ${r.to_name}`, 40, 108);

    if (histPrices.length >= 2) {
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;
      const minP = Math.min(...histPrices) * 0.998;
      const maxP = Math.max(...histPrices) * 1.002;
      const isUp = histPrices[histPrices.length - 1] >= histPrices[0];
      const lineColor = isUp ? "#00e676" : "#ff5252";

      const toX = (i) => PAD.left + (i / (histPrices.length - 1)) * chartW;
      const toY = (p) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;

      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (i / 4) * chartH;
        const val = maxP - (i / 4) * (maxP - minP);
        ctx.fillStyle = "#1e2130";
        ctx.fillRect(PAD.left, y, chartW, 1);
        ctx.fillStyle = "#6b7280";
        ctx.fillText(val.toFixed(2), PAD.left - 5, y + 4);
      }

      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      grad.addColorStop(0, isUp ? "rgba(0,230,118,0.25)" : "rgba(255,82,82,0.25)");
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(histPrices[0]));
      for (let i = 1; i < histPrices.length; i++) {
        ctx.lineTo(toX(i), toY(histPrices[i]));
      }
      ctx.lineTo(toX(histPrices.length - 1), PAD.top + chartH);
      ctx.lineTo(toX(0), PAD.top + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(0), toY(histPrices[0]));
      for (let i = 1; i < histPrices.length; i++) {
        ctx.lineTo(toX(i), toY(histPrices[i]));
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(histPrices.length - 1), toY(histPrices[histPrices.length - 1]), 5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      histDates.forEach((d, i) => {
        ctx.fillText(d, toX(i), H - 15);
      });

      ctx.textAlign = "left";
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.fillText("7 Hari Terakhir  •  Data: Yahoo Finance", PAD.left, H - 15);
    } else {
      
      ctx.fillStyle = "#6b7280";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Data historis tidak tersedia", W / 2, (PAD.top + H - PAD.bottom) / 2);
    }

    const imgBuffer = canvas.toBuffer("image/png");

    const caption = [
      `💱 *KONVERSI MATA UANG*`,
      ``,
      `╭─────────────────`,
      `│ 💵 Dari   : *${r.amount} ${r.from}* (${r.from_name})`,
      `│ 💴 Ke     : *${r.to}* (${r.to_name})`,
      `│ 📊 Kurs   : *1 ${r.from} = ${r.rate.toLocaleString("id-ID")} ${r.to}*`,
      `│ ✅ Hasil  : *${r.formatted} ${r.to}*`,
      `╰─────────────────`,
      ``,
      `> _Data dari azbry.com & Yahoo Finance_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Kurs]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };