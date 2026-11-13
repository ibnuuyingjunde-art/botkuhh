import axios from "axios";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "portofolio",
  alias: ["porto", "portfolio", "investasi"],
  category: "tools",
  description: "Simulasi portofolio saham & crypto",
  usage: ".portofolio <add/remove/cek/reset> <kode> <jumlah> <harga beli>",
  example: ".portofolio add BBCA 100 9500",
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
  const db = getDatabase();
  const args = m.args || [];
  const cmd = args[0]?.toLowerCase();
  const sender = m.sender;

  if (!db.data.portofolio) db.data.portofolio = {};
  if (!db.data.portofolio[sender]) db.data.portofolio[sender] = [];

  const porto = db.data.portofolio[sender];

  if (!cmd) {
    return m.reply(
      `📈 *PORTOFOLIO SAHAM & CRYPTO*\n\n` +
      `*Perintah:*\n` +
      `\`${m.prefix}portofolio add <kode> <lot/coin> <harga beli>\`\n` +
      `\`${m.prefix}portofolio remove <kode>\`\n` +
      `\`${m.prefix}portofolio cek\`\n` +
      `\`${m.prefix}portofolio reset\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}portofolio add BBCA 100 9500\` _(100 lot saham BBCA beli di 9500)_\n` +
      `\`${m.prefix}portofolio add BTC 0.5 800000000\` _(0.5 BTC beli di 800jt)_\n` +
      `\`${m.prefix}portofolio cek\` _(lihat portofolio)_`
    );
  }

  if (cmd === "add") {
    const kode = args[1]?.toUpperCase();
    const jumlah = parseFloat(args[2]);
    const hargaBeli = parseFloat(args[3]);

    if (!kode || isNaN(jumlah) || isNaN(hargaBeli)) {
      return m.reply(`❌ Format salah!\n\nContoh: \`${m.prefix}portofolio add BBCA 100 9500\``);
    }

    const existing = porto.findIndex(p => p.kode === kode);
    if (existing >= 0) {
      porto[existing].jumlah = jumlah;
      porto[existing].hargaBeli = hargaBeli;
    } else {
      if (porto.length >= 10) {
        return m.reply("❌ Maksimal 10 aset dalam portofolio!");
      }
      porto.push({ kode, jumlah, hargaBeli, addedAt: Date.now() });
    }

    db.data.portofolio[sender] = porto;
    await db.save();

    return m.reply(`✅ *${kode}* berhasil ditambahkan!\n\n> ${jumlah} unit @ Rp ${hargaBeli.toLocaleString("id-ID")}`);
  }

  if (cmd === "remove") {
    const kode = args[1]?.toUpperCase();
    if (!kode) return m.reply(`❌ Masukkan kode aset!\n\nContoh: \`${m.prefix}portofolio remove BBCA\``);

    const idx = porto.findIndex(p => p.kode === kode);
    if (idx < 0) return m.reply(`❌ *${kode}* tidak ada di portofolio!`);

    porto.splice(idx, 1);
    db.data.portofolio[sender] = porto;
    await db.save();

    return m.reply(`✅ *${kode}* berhasil dihapus dari portofolio!`);
  }

  if (cmd === "reset") {
    db.data.portofolio[sender] = [];
    await db.save();
    return m.reply("✅ Portofolio berhasil direset!");
  }

  if (cmd === "cek" || cmd === "check") {
    if (porto.length === 0) {
      return m.reply(
        `📈 Portofolio kamu masih kosong!\n\n` +
        `Tambah aset dengan:\n` +
        `\`${m.prefix}portofolio add BBCA 100 9500\``
      );
    }

    m.react("🕕");

    const COIN_MAP = {
      BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin",
      SOL: "solana", XRP: "ripple", ADA: "cardano",
      DOGE: "dogecoin", MATIC: "matic-network", DOT: "polkadot",
    };

    const results = [];
    for (const item of porto) {
      try {
        const coinId = COIN_MAP[item.kode];
        let hargaSekarang = 0;

        if (coinId) {
          
          const { data } = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=idr`,
            { timeout: 10000 }
          );
          hargaSekarang = data[coinId]?.idr || 0;
        } else {
          
          const symbol = `${item.kode}.JK`;
          const now = Math.floor(Date.now() / 1000);
          const { data } = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${now - 86400}&period2=${now}`,
            { timeout: 10000, headers: { "User-Agent": "Mozilla/5.0" } }
          );
          hargaSekarang = data?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
          
        }

        const isCrypto = !!COIN_MAP[item.kode];
        const nilaiModal = item.jumlah * item.hargaBeli * (isCrypto ? 1 : 100);
        const nilaiSekarang = item.jumlah * hargaSekarang * (isCrypto ? 1 : 100);
        const pl = nilaiSekarang - nilaiModal;
        const plPct = nilaiModal ? (pl / nilaiModal) * 100 : 0;

        results.push({
          kode: item.kode,
          jumlah: item.jumlah,
          hargaBeli: item.hargaBeli,
          hargaSekarang,
          nilaiModal,
          nilaiSekarang,
          pl,
          plPct,
          isCrypto,
        });
      } catch {
        results.push({
          kode: item.kode,
          jumlah: item.jumlah,
          hargaBeli: item.hargaBeli,
          hargaSekarang: 0,
          nilaiModal: item.jumlah * item.hargaBeli,
          nilaiSekarang: 0,
          pl: 0,
          plPct: 0,
          isCrypto: false,
          error: true,
        });
      }
    }

    const totalModal = results.reduce((a, b) => a + b.nilaiModal, 0);
    const totalNilai = results.reduce((a, b) => a + b.nilaiSekarang, 0);
    const totalPL = totalNilai - totalModal;
    const totalPLPct = totalModal ? (totalPL / totalModal) * 100 : 0;
    const isProfit = totalPL >= 0;

    const W = 900;
    const rowH = 55;
    const H = 180 + results.length * rowH + 100;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1a1d2e";
    ctx.beginPath();
    ctx.roundRect(20, 15, W - 40, 100, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`📈 PORTOFOLIO — ${m.pushName}`, 40, 52);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Total Modal: Rp ${totalModal.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`, 40, 80);

    const plColor = isProfit ? "#00e676" : "#ff5252";
    ctx.fillStyle = plColor;
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(
      `Total Nilai: Rp ${totalNilai.toLocaleString("id-ID", { maximumFractionDigits: 0 })}  ${isProfit ? "▲" : "▼"} ${Math.abs(totalPLPct).toFixed(2)}%`,
      40, 105
    );

    const tableY = 130;
    ctx.fillStyle = "#1e2130";
    ctx.fillRect(20, tableY, W - 40, 35);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("KODE", 35, tableY + 22);
    ctx.fillText("JUMLAH", 150, tableY + 22);
    ctx.fillText("BELI", 270, tableY + 22);
    ctx.fillText("SEKARANG", 390, tableY + 22);
    ctx.fillText("NILAI", 540, tableY + 22);
    ctx.fillText("P/L", 700, tableY + 22);

    results.forEach((r, i) => {
      const y = tableY + 35 + i * rowH;
      ctx.fillStyle = i % 2 === 0 ? "#111827" : "#0f1117";
      ctx.fillRect(20, y, W - 40, rowH);

      const rowPLColor = r.pl >= 0 ? "#00e676" : "#ff5252";

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(r.kode, 35, y + 20);

      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px sans-serif";
      ctx.fillText(r.isCrypto ? `${r.jumlah} coin` : `${r.jumlah} lot`, 150, y + 20);
      ctx.fillText(r.hargaBeli.toLocaleString("id-ID", { maximumFractionDigits: 0 }), 270, y + 20);
      ctx.fillStyle = r.error ? "#6b7280" : "#ffffff";
      ctx.fillText(r.error ? "N/A" : r.hargaSekarang.toLocaleString("id-ID", { maximumFractionDigits: 0 }), 390, y + 20);
      ctx.fillText(`Rp ${(r.nilaiSekarang / 1e6).toFixed(1)}M`, 540, y + 20);

      ctx.fillStyle = rowPLColor;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(
        `${r.pl >= 0 ? "+" : ""}${r.plPct.toFixed(1)}%`,
        700, y + 20
      );

      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.fillText(
        `Modal: Rp ${(r.nilaiModal / 1e6).toFixed(1)}M  •  P/L: Rp ${(r.pl / 1e6).toFixed(1)}M`,
        35, y + 38
      );
    });

    const footerY = tableY + 35 + results.length * rowH + 15;
    ctx.fillStyle = "#1e2130";
    ctx.fillRect(20, footerY, W - 40, 50);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Total P/L: `, 35, footerY + 30);
    ctx.fillStyle = plColor;
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(
      `Rp ${totalPL.toLocaleString("id-ID", { maximumFractionDigits: 0 })}  (${isProfit ? "+" : ""}${totalPLPct.toFixed(2)}%)`,
      130, footerY + 30
    );

    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Data: Yahoo Finance & CoinGecko", W - 30, footerY + 42);

    const imgBuffer = canvas.toBuffer("image/png");

    let captionRows = results.map(r => {
      const plStr = r.error ? "N/A" : `${r.pl >= 0 ? "+" : ""}${r.plPct.toFixed(2)}%`;
      return `│ ${r.kode.padEnd(6)} ${r.jumlah} ${r.isCrypto ? "coin" : "lot"} → *${plStr}*`;
    });

    const caption = [
      `📈 *PORTOFOLIO — ${m.pushName}*`,
      ``,
      `╭─────────────────`,
      ...captionRows,
      `├─────────────────`,
      `│ 💰 Modal   : *Rp ${(totalModal / 1e6).toFixed(2)}M*`,
      `│ 💎 Nilai   : *Rp ${(totalNilai / 1e6).toFixed(2)}M*`,
      `│ ${isProfit ? "📈" : "📉"} P/L     : *${isProfit ? "+" : ""}Rp ${(totalPL / 1e6).toFixed(2)}M (${isProfit ? "+" : ""}${totalPLPct.toFixed(2)}%)*`,
      `╰─────────────────`,
      ``,
      `> _Data real-time dari Yahoo Finance & CoinGecko_`,
    ].join("\n");

    await sock.sendMessage(
      m.chat,
      { image: imgBuffer, caption },
      { quoted: m }
    );

    m.react("✅");
    return;
  }

  return m.reply(`❌ Perintah tidak dikenal!\n\nGunakan: add, remove, cek, reset`);
}

export { pluginConfig as config, handler };