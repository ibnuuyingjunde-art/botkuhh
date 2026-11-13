import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "keripto",
  alias: ["yumkripto"],
  category: "tools",
  description: "Menampilkan harga crypto real-time dari TradingView",
  usage: ".crypto",
  example: ".crypto",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const SYMBOLS = [
  { symbol: "BTCUSD", nama: "Bitcoin" },
  { symbol: "ETHUSD", nama: "Ethereum" },
  { symbol: "SOLUSD", nama: "Solana" },
  { symbol: "DOGEUSD", nama: "Dogecoin" },
  { symbol: "XRPUSD", nama: "Ripple" },
];

async function fetchCryptoPrice(symbol, nama) {
  const url = `https://id.tradingview.com/symbols/${symbol}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const priceMatch = html.match(/"price"\s*:\s*([\d.]+)/);
    const changePctMatch = html.match(/"change_pct"\s*:\s*([-\d.]+)/);
    const changeAbsMatch = html.match(/"change_abs"\s*:\s*([-\d.]+)/);

    return {
      nama,
      symbol,
      harga: priceMatch ? parseFloat(priceMatch[1]) : null,
      perubahan_persen: changePctMatch ? parseFloat(changePctMatch[1]) : null,
      perubahan_nominal: changeAbsMatch ? parseFloat(changeAbsMatch[1]) : null,
    };
  } catch (e) {
    console.error(`[Crypto] Gagal fetch ${symbol}:`, e.message);
    return { nama, symbol, error: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function formatChange(pct) {
  if (pct === null || pct === undefined) return 'N/A';
  const sign = pct > 0 ? '+' : '';
  return sign + pct.toFixed(2) + '%';
}

function buildCryptoHtml(data) {
  // Ambil 4 koin pertama untuk stats
  const [btc, eth, sol, doge] = data;
  const topCoins = data;

  const statsHtml = `
    <div class="stat"><small>${btc?.nama || 'BTC'}</small><b>${formatPrice(btc?.harga)}</b><span class="up">${formatChange(btc?.perubahan_persen)}</span></div>
    <div class="stat"><small>${eth?.nama || 'ETH'}</small><b>${formatPrice(eth?.harga)}</b><span class="up">${formatChange(eth?.perubahan_persen)}</span></div>
    <div class="stat"><small>${sol?.nama || 'SOL'}</small><b>${formatPrice(sol?.harga)}</b><span class="up">${formatChange(sol?.perubahan_persen)}</span></div>
    <div class="stat"><small>Portfolio</small><b>$1,248</b><span class="up">▲ +2.76%</span></div>
  `;

  const marketRows = topCoins.map(coin => {
    const changeClass = coin.perubahan_persen >= 0 ? 'green' : 'red';
    const icon = coin.nama === 'Bitcoin' ? '₿' : coin.nama === 'Ethereum' ? 'Ξ' : coin.nama === 'Solana' ? 'S' : coin.nama === 'Dogecoin' ? 'Ð' : 'X';
    return `
      <div class="coin">
        <div class="coinname"><div class="icon">${icon}</div><div><b>${coin.nama}</b><small>${coin.symbol.replace('USD','')}</small></div></div>
        <div class="price">${formatPrice(coin.harga)}</div>
        <div class="change ${changeClass}">${formatChange(coin.perubahan_persen)}</div>
      </div>
    `;
  }).join('');

  return `
<style>
*{box-sizing:border-box}
body{margin:0;padding:18px;background:#09090b;color:#f5f5f5;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
.card{width:100%;max-width:620px;margin:auto;border:1px solid #25252b;border-radius:26px;overflow:hidden;background:radial-gradient(circle at 90% 0%,rgba(245,183,62,.13),transparent 28%),linear-gradient(145deg,#111116,#08080b);box-shadow:0 18px 55px rgba(0,0,0,.45)}
.header{padding:20px 22px 15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #202027}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#f7c65a,#9c6411);color:#090909;font-size:22px;font-weight:900}
.brand b{font-size:19px}
.brand small{display:block;color:#85858f;margin-top:2px}
.online{font-size:11px;color:#42df98;border:1px solid #1b6a49;padding:7px 10px;border-radius:99px}
.hero{margin:18px;padding:22px;border-radius:21px;background:radial-gradient(circle at 85% 45%,rgba(240,174,43,.22),transparent 28%),linear-gradient(135deg,#17130d,#0c0c10);border:1px solid #493719}
.tag{font-size:10px;letter-spacing:2px;color:#eab64c;font-weight:700}
.hero h1{font-size:27px;line-height:1.1;margin:10px 0 7px}
.hero p{color:#9696a0;font-size:12px;line-height:1.55;margin:0 0 16px}
.btn{display:inline-block;padding:11px 17px;border-radius:12px;color:#17120a;background:linear-gradient(135deg,#ffd66e,#d99723);font-weight:800;font-size:12px}
.btc{float:right;margin-top:-95px;margin-right:4px;width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#ffbe32,#a96409);box-shadow:0 0 30px rgba(240,170,40,.25);font-size:35px;font-weight:900;color:#fff}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 18px}
.stat{padding:14px;border:1px solid #24242a;border-radius:16px;background:#101015}
.stat small{color:#777783}.stat b{display:block;font-size:17px;margin:5px 0}.up{color:#31d98d;font-size:11px}
.section{padding:18px}
.title{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.title b{font-size:14px}.title span{color:#777783;font-size:10px}
.market{border:1px solid #24242a;border-radius:18px;overflow:hidden;background:#0e0e13}
.coin{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:14px 15px;border-bottom:1px solid #202027}
.coin:last-child{border-bottom:0}
.coinname{display:flex;gap:10px;align-items:center}
.icon{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:#25252b}
.coinname b{font-size:12px}.coinname small{display:block;color:#777783;font-size:9px;margin-top:2px}
.price{text-align:right;font-size:11px}.change{font-size:10px;text-align:right}
.green{color:#35d995}.red{color:#ff6572}
.actions{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.action{padding:13px;border:1px solid #493719;border-radius:15px;text-align:center;background:#111015}
.action b{display:block;color:#eabb51;font-size:12px}.action span{color:#777783;font-size:9px}
.footer{text-align:center;padding:0 18px 20px;color:#55555f;font-size:9px;letter-spacing:2px}
</style>
<div class="card">
  <div class="header">
    <div class="brand">
      <div class="logo">₿</div>
      <div><b>Crypto Trafic</b><small>Trade • Earn • Grow</small></div>
    </div>
    <div class="online">● ONLINE</div>
  </div>

  <div class="hero">
    <div class="tag">CRYPTO TRAFIC</div>
    <h1>Market hari ini<br><span style="color:#efb83f">siap ditrading.</span></h1>
    <p>Pantau harga crypto, lihat top gainers, dan cek portfolio kamu dalam satu tampilan.</p>
    <div class="btn">📈 Mulai Trading →</div>
    <div class="btc">₿</div>
    <div style="clear:both"></div>
  </div>

  <div class="stats">
    ${statsHtml}
  </div>

  <div class="section">
    <div class="title"><b>🔥 Top Crypto</b><span>24H CHANGE</span></div>
    <div class="market">
      ${marketRows}
    </div>
  </div>

  <div class="section" style="padding-top:0">
    <div class="title"><b>⚡ Quick Action</b><span>MENU</span></div>
    <div class="actions">
      <div class="action"><b>↗ BUY</b><span>Beli Crypto</span></div>
      <div class="action"><b>↘ SELL</b><span>Jual Crypto</span></div>
      <div class="action"><b>◈ PORTFOLIO</b><span>Aset Saya</span></div>
      <div class="action"><b>◉ MARKET</b><span>Harga Live</span></div>
    </div>
  </div>

  <div class="footer">CRYPTO TRAFIC • TRADE • EARN • GROW</div>
</div>`;
}

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  await m.react('⏳');

  try {
    // Fetch data crypto real-time dari TradingView
    const results = [];
    for (const coin of SYMBOLS) {
      const data = await fetchCryptoPrice(coin.symbol, coin.nama);
      results.push(data);
      // Delay kecil untuk hindari rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const validData = results.filter(c => !c.error);
    if (validData.length === 0) throw new Error('Gagal mengambil data crypto');

    const html = buildCryptoHtml(validData);
    const responseId = randomUUID();

    const unifiedData = JSON.stringify({
      response_id: responseId,
      sections: [{
        view_model: {
          primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] },
          __typename: "GenAISingleLayoutViewModel"
        }
      }]
    });

    const messagePayload = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: { messageDisclaimerText: "", botResponseId: responseId }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: "📈 Crypto Trafic - Live Market" }],
            unifiedResponse: { data: Buffer.from(unifiedData).toString("base64") },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
              forwardOrigin: 4
            }
          }
        }
      }
    };

    await conn.relayMessage(m.chat, messagePayload, { messageId: responseId });
    await m.react('✅');
  } catch (error) {
    console.error("[CRYPTO_ERROR]", error);
    await m.react('❌');
    m.reply(`❌ Gagal mengambil data crypto.\n\n> ${error?.message || 'Unknown error'}`);
  }
}

export { pluginConfig as config, handler };