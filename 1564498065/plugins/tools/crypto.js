import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";

const pluginConfig = {
  name: "crypto",
  alias: ["coin", "bitcoin", "btc", "eth"],
  category: "tools",
  description: "Harga crypto dengan grafik",
  usage: ".crypto <coin>",
  example: ".crypto BTC",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const COIN_MAP = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin",
  SOL: "solana", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", MATIC: "matic-network", DOT: "polkadot",
  AVAX: "avalanche-2", LINK: "chainlink", UNI: "uniswap",
  LTC: "litecoin", SHIB: "shiba-inu", TRX: "tron",
};

async function handler(m, { sock }) {
  const args = m.args || [];

  if (!args[0]) {
    return m.reply(
      `💎 *CEK HARGA CRYPTO*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}crypto <coin>\`\n\n` +
      `*Coin populer:*\n` +
      `BTC, ETH, BNB, SOL, XRP, ADA, DOGE, MATIC, DOT, AVAX, LINK, LTC, SHIB, TRX`
    );
  }

  const coinInput = args[0].toUpperCase();
  const coinId = COIN_MAP[coinInput] || coinInput.toLowerCase();

  m.react("🕕");

  try {
    
    const [marketRes, histRes] = await Promise.all([
      axios.get(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=idr&ids=${coinId}&price_change_percentage=24h,7d`,
        { timeout: 15000 }
      ),
      axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=idr&days=30`,
        { timeout: 15000 }
      ),
    ]);

    const coin = marketRes.data?.[0];
    if (!coin) {
      m.react("☢");
      return m.reply(`❌ Coin *${coinInput}* tidak ditemukan.\n\n> Coba: BTC, ETH, BNB, SOL, XRP`);
    }

    const histPrices = histRes.data?.prices || [];
    const isUp = coin.price_change_percentage_24h >= 0;
    const priceColor = isUp ? "#00e676" : "#ff5252";

    const W = 900, H = 540;
    const PAD = { top: 160, right: 40, bottom: 60, left: 100 };
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 130, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(`💎 ${coin.name} (${coin.symbol.toUpperCase()})`, 40, 55);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`Rp ${coin.current_price.toLocaleString("id-ID")}`, 40, 90);

    ctx.fillStyle = priceColor;
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(
      `${isUp ? "▲" : "▼"} ${Math.abs(coin.price_change_percentage_24h).toFixed(2)}% (24h)`,
      40, 115
    );

    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px sans-serif";
    ctx.fillText(
      `High: Rp ${coin.high_24h?.toLocaleString("id-ID")}  •  Low: Rp ${coin.low_24h?.toLocaleString("id-ID")}  •  7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2)}%`,
      40, 138
    );

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `Market Cap: Rp ${(coin.market_cap / 1e12).toFixed(2)}T  •  Vol 24h: Rp ${(coin.total_volume / 1e9).toFixed(2)}B  •  Rank #${coin.market_cap_rank}`,
      40, 155
    );

    if (histPrices.length >= 2) {
      const chartW = W - PAD.left - PAD.right;
      const chartH = H - PAD.top - PAD.bottom;
      const prices = histPrices.map(p => p[1]);
      const minP = Math.min(...prices) * 0.998;
      const maxP = Math.max(...prices) * 1.002;

      const toX = (i) => PAD.left + (i / (histPrices.length - 1)) * chartW;
      const toY = (p) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;

      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (i / 4) * chartH;
        ctx.fillStyle = "#1e2130";
        ctx.fillRect(PAD.left, y, chartW, 1);
        const val = maxP - (i / 4) * (maxP - minP);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(
          val >= 1e6 ? `${(val / 1e6).toFixed(1)}M` : val >= 1e3 ? `${(val / 1e3).toFixed(1)}K` : val.toFixed(0),
          PAD.left - 5, y + 4
        );
      }

      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      grad.addColorStop(0, isUp ? "rgba(0,230,118,0.25)" : "rgba(255,82,82,0.25)");
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.moveTo(toX(0), toY(prices[0]));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(toX(i), toY(prices[i]));
      }
      ctx.lineTo(toX(prices.length - 1), PAD.top + chartH);
      ctx.lineTo(toX(0), PAD.top + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = priceColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.moveTo(toX(0), toY(prices[0]));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(toX(i), toY(prices[i]));
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(toX(prices.length - 1), toY(prices[prices.length - 1]), 5, 0, Math.PI * 2);
      ctx.fillStyle = priceColor;
      ctx.fill();

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const labelIdx = [0, Math.floor(histPrices.length / 4), Math.floor(histPrices.length / 2), Math.floor(histPrices.length * 3 / 4), histPrices.length - 1];
      for (const i of labelIdx) {
        if (histPrices[i]) {
          const d = new Date(histPrices[i][0]);
          ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, toX(i), H - 15);
        }
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.fillText("30 Hari Terakhir  •  Data: CoinGecko", PAD.left, H - 15);
    }

    const imgBuffer = canvas.toBuffer("image/png");

    const caption = [
      `💎 *${coin.name} (${coin.symbol.toUpperCase()})*`,
      ``,
      `╭─────────────────`,
      `│ 💰 Harga     : *Rp ${coin.current_price.toLocaleString("id-ID")}*`,
      `│ ${isUp ? "📈" : "📉"} 24h       : *${isUp ? "+" : ""}${coin.price_change_percentage_24h.toFixed(2)}%*`,
      `│ 📊 7 Hari    : *${coin.price_change_percentage_7d_in_currency?.toFixed(2) || "N/A"}%*`,
      `│ 🔺 High 24h  : *Rp ${coin.high_24h?.toLocaleString("id-ID")}*`,
      `│ 🔻 Low 24h   : *Rp ${coin.low_24h?.toLocaleString("id-ID")}*`,
      `│ 🏦 Mkt Cap   : *Rp ${(coin.market_cap / 1e12).toFixed(2)}T*`,
      `│ 📦 Vol 24h   : *Rp ${(coin.total_volume / 1e9).toFixed(2)}B*`,
      `│ 🏆 Rank      : *#${coin.market_cap_rank}*`,
      `╰─────────────────`,
      ``,
      `> _Data dari CoinGecko • 30 hari terakhir_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Crypto]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil data crypto.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };