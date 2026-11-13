import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "yumnf",
  alias: ["nf", "netflix", "nftoken"],
  category: "tools",
  description: "Generate Netflix Premium Token (NfToken)",
  usage: ".yumnf",
  example: ".yumnf",
  cooldown: 30,
  energi: 1,
  isEnabled: true,
};

const API_URL = 'https://nftoken.zone.id/api/auto-generate';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
  'Referer': 'https://nftoken.zone.id/',
  'Accept': 'application/json'
};

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchNFToken() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({}),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (!data.success || !data.token) {
      throw new Error(data.error || 'Token tidak ditemukan dalam respons');
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: Request melebihi 30 detik');
    }
    throw error;
  }
}

function buildLinks(token) {
  const encoded = encodeURIComponent(token);
  return {
    pc: `https://netflix.com/?nftoken=${encoded}`,
    android: `https://netflix.com/unsupported?nftoken=${encoded}`,
    tv: `https://netflix.com/tv2?nftoken=${encoded}`,
    tv8: `https://netflix.com/tv8?nftoken=${encoded}`
  };
}

function formatExpiry(expiryStr) {
  if (!expiryStr || expiryStr === 'Tidak diketahui') return 'Tidak diketahui';
  try {
    const [datePart, timePart] = expiryStr.split(', ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart.replace(/\./g, ':').split(':');
    const date = new Date(year, month - 1, day, hour, minute, second);
    return date.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' });
  } catch {
    return expiryStr;
  }
}

function createNFTHtml(data) {
  const token = data.token;
  const links = buildLinks(token);
  const expiry = data.expiry || 'Tidak diketahui';
  const country = data.profile?.country || 'Tidak diketahui';
  const plan = data.profile?.plan || 'Tidak diketahui';
  const type = data.type || 'cookie';

  const expiryFormatted = formatExpiry(expiry);

  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  .nft-wrapper {
    font-family: 'Quicksand', sans-serif;
    background: linear-gradient(180deg, #fdfaff 0%, #f3e8ff 30%, #e9d5ff 70%, #fdfaff 100%);
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 15px;
    position: relative;
    overflow: hidden;
    border-radius: 16px;
  }
  .lightning {
    position: absolute;
    pointer-events: none;
    z-index: 0;
    opacity: 0.12;
    animation: flash 6s infinite ease-in-out;
  }
  .lightning:nth-child(1) { top: -5%; left: 5%; width: 90px; height: 180px; animation-delay: 0s; }
  .lightning:nth-child(2) { top: -2%; right: 10%; width: 70px; height: 150px; animation-delay: 1.8s; }
  .lightning:nth-child(3) { top: 40%; left: 2%; width: 60px; height: 130px; animation-delay: 3.2s; }
  .lightning:nth-child(4) { top: 60%; right: 5%; width: 80px; height: 170px; animation-delay: 0.6s; }
  @keyframes flash {
    0%, 90%, 100% { opacity: 0.08; }
    92% { opacity: 0.4; }
    94% { opacity: 0.15; }
    96% { opacity: 0.35; }
  }
  .container {
    position: relative;
    z-index: 1;
  }
  .header {
    text-align: center;
    margin-bottom: 15px;
  }
  .logo {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: #2d1b4e;
    font-weight: 700;
    letter-spacing: 3px;
    line-height: 1;
  }
  .subtitle {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    color: #7c3aed;
    margin-top: 4px;
    letter-spacing: 2px;
  }
  .card {
    background: rgba(255,255,255,0.92);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 15px;
    box-shadow: 0 8px 30px rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.15);
    backdrop-filter: blur(10px);
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(124,58,237,0.08);
  }
  .info-label {
    font-size: 11px;
    color: #7c3aed;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .info-value {
    font-size: 13px;
    color: #2d1b4e;
    font-weight: 600;
    text-align: right;
    word-break: break-all;
    max-width: 65%;
  }
  .token-box {
    background: rgba(124,58,237,0.05);
    border: 1px dashed rgba(124,58,237,0.3);
    border-radius: 8px;
    padding: 10px;
    margin: 10px 0;
    font-size: 12px;
    word-break: break-all;
    color: #4c1d95;
    max-height: 80px;
    overflow-y: auto;
  }
  .btn {
    display: inline-block;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: white;
    border: none;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 3px 10px rgba(124,58,237,0.25);
  }
  .btn:hover {
    background: linear-gradient(135deg, #9333ea, #6d28d9);
  }
  .btn:active {
    transform: scale(0.95);
  }
  .links-section {
    margin-top: 10px;
  }
  .link-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(124,58,237,0.08);
  }
  .link-text {
    font-size: 12px;
    color: #2d1b4e;
    word-break: break-all;
    flex: 1;
  }
  .copy-btn {
    background: none;
    border: 1px solid rgba(124,58,237,0.3);
    color: #7c3aed;
    cursor: pointer;
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 4px;
    transition: 0.2s;
    font-weight: 600;
  }
  .copy-btn:hover {
    background: rgba(124,58,237,0.1);
  }
  .footer {
    text-align: center;
    font-size: 11px;
    color: #a78bfa;
    padding-top: 10px;
    border-top: 1px dashed #e9d5ff;
  }
  @media (max-width: 480px) {
    .nft-wrapper { padding: 12px; }
    .logo { font-size: 24px; }
    .info-row { flex-direction: column; align-items: flex-start; gap: 2px; }
    .info-value { max-width: 100%; }
  }
</style>
<div class="nft-wrapper">
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#a855f7"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#9333ea"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>

  <div class="container">
    <div class="header">
      <div class="logo">NETFLIX</div>
      <div class="subtitle">Premium Token Generator</div>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value" style="color:#16a34a;">✅ BERHASIL</span>
      </div>
      <div class="info-row">
        <span class="info-label">Kadaluarsa</span>
        <span class="info-value">${escapeHtml(expiryFormatted)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Negara</span>
        <span class="info-value">${escapeHtml(country)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${escapeHtml(plan)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tipe</span>
        <span class="info-value">${escapeHtml(type)}</span>
      </div>

      <div style="margin-top:12px;">
        <span class="info-label">Token</span>
        <div class="token-box" id="token-box">${escapeHtml(token)}</div>
        <button class="btn" onclick="copyText('${escapeHtml(token)}', this)">Salin Token</button>
      </div>
    </div>

    <div class="card links-section">
      <span class="info-label">Links</span>
      <div class="link-item">
        <span class="link-text" id="link-pc">${escapeHtml(links.pc)}</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(links.pc)}', this)">Salin</button>
      </div>
      <div class="link-item">
        <span class="link-text" id="link-android">${escapeHtml(links.android)}</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(links.android)}', this)">Salin</button>
      </div>
      <div class="link-item">
        <span class="link-text" id="link-tv">${escapeHtml(links.tv)}</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(links.tv)}', this)">Salin</button>
      </div>
      <div class="link-item">
        <span class="link-text" id="link-tv8">${escapeHtml(links.tv8)}</span>
        <button class="copy-btn" onclick="copyText('${escapeHtml(links.tv8)}', this)">Salin</button>
      </div>
    </div>

    <div class="footer">• NfToken by Bayu Official •</div>
  </div>
</div>

<script>
  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Tersalin!';
        btn.style.color = '#16a34a';
        setTimeout(() => {
          btn.textContent = original;
          btn.style.color = '';
        }, 1500);
      }).catch(() => fallbackCopy(text, btn));
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      const original = btn.textContent;
      btn.textContent = 'Tersalin!';
      btn.style.color = '#16a34a';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.color = '';
      }, 1500);
    } catch (e) {
      alert('Gagal menyalin, silakan salin manual');
    }
    document.body.removeChild(textarea);
  }
</script>`;
}

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  await m.react('⏳');

  try {
    const data = await fetchNFToken();
    const html = createNFTHtml(data);
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
            submessages: [{ messageType: 2, messageText: "Netflix Premium Token" }],
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
    console.error("[YUMNF_ERROR]", error);
    await m.react('❌');
    m.reply(`❌ Gagal mengambil token Netflix.\n\n> ${error?.message || 'Unknown error'}`);
  }
}

export { pluginConfig as config, handler };