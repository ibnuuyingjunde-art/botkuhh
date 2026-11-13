import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "yumakinator",
  alias: ["hutao"],
  category: "game",
  description: "Main Akinator Hu Tao tebak karakter",
  usage: ".akinator",
  example: ".akinator",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const BASE = 'https://hutaonator.satriadeveloperz.workers.dev';
const BOT_NUMBER = '62882019406225';

const gameSessions = new Map();

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function startGame(userId) {
  const data = await apiPost('/api/game/start', { childMode: false });
  gameSessions.set(userId, {
    gameId: data.game.id,
    status: data.game.status,
    step: data.game.step,
    data: data.game
  });
  return data.game;
}

async function answerGame(userId, answer) {
  const session = gameSessions.get(userId);
  if (!session) throw new Error('Tidak ada sesi game aktif');
  const data = await apiPost(`/api/game/${session.gameId}/answer`, { answer });
  session.status = data.game.status;
  session.step = data.game.step;
  session.data = data.game;
  return data.game;
}

async function confirmGuess(userId) {
  const session = gameSessions.get(userId);
  if (!session) throw new Error('Tidak ada sesi game aktif');
  const data = await apiPost(`/api/game/${session.gameId}/confirm`, {});
  session.status = data.game.status;
  session.step = data.game.step;
  session.data = data.game;
  return data.game;
}

async function rejectGuess(userId) {
  const session = gameSessions.get(userId);
  if (!session) throw new Error('Tidak ada sesi game aktif');
  const data = await apiPost(`/api/game/${session.gameId}/reject`, {});
  session.status = data.game.status;
  session.step = data.game.step;
  session.data = data.game;
  return data.game;
}

function createAkinatorHtml(game, botNumber) {
  if (!game) return `<div>Tidak ada game aktif. Ketik .akinator untuk mulai.</div>`;

  let body = '';
  if (game.status === 'playing') {
    body = `
      <div class="question">Pertanyaan #${game.step + 1}: ${escapeHtml(game.question)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${game.progression || 0}%"></div></div>
      <div class="buttons">
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator yes')}">Iya</a>
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator no')}">Tidak</a>
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator idk')}">Tidak Tahu</a>
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator probably')}">Mungkin</a>
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator probably not')}">Mungkin Tidak</a>
      </div>
      <div class="manual-hint">Kalau tombol tidak berfungsi, ketik manual: <code>.akinator [yes/no/idk/probably/probably not]</code></div>`;
  } else if (game.status === 'guessing') {
    const guess = game.guess || {};
    body = `
      <div class="question">Apakah ini tebakannya?</div>
      <div class="guess-section">
        ${guess.photo ? `<img class="guess-photo" src="${escapeHtml(guess.photo)}" alt="">` : ''}
        <div class="guess-name">${escapeHtml(guess.name || 'Tidak diketahui')}</div>
        <div class="guess-desc">${escapeHtml(guess.description || '')}</div>
        <a class="btn primary" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator confirm')}">Benar</a>
        <a class="btn" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator reject')}">Salah</a>
      </div>
      <div class="manual-hint">Kalau tombol tidak berfungsi, ketik manual: <code>.akinator confirm</code> atau <code>.akinator reject</code></div>`;
  } else if (game.status === 'won') {
    body = `
      <div class="result-section">
        <div class="result-title">Hu Tao menang!</div>
        <div class="result-detail">
          Nama: ${escapeHtml(game.guess?.name || '')}<br>
          Deskripsi: ${escapeHtml(game.guess?.description || '')}<br>
          Ditebak dalam ${game.step || 0} pertanyaan${game.wrongGuesses ? ` (${game.wrongGuesses} tebakan meleset)` : ''}
        </div>
        <a class="btn primary" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator')}">Main Lagi</a>
      </div>`;
  } else if (game.status === 'lost') {
    body = `
      <div class="result-section">
        <div class="result-title">Kamu menang!</div>
        <div class="result-detail">Hu Tao menyerah setelah ${game.step || 0} pertanyaan.</div>
        <a class="btn primary" href="https://wa.me/${botNumber}?text=${encodeURIComponent('.akinator')}">Main Lagi</a>
      </div>`;
  }

  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  .akinator-wrapper {
    font-family: 'Quicksand', sans-serif;
    background: linear-gradient(180deg, #fdfaff 0%, #f3e8ff 30%, #e9d5ff 70%, #fdfaff 100%);
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 15px;
    border-radius: 16px;
    position: relative;
    overflow: hidden;
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
  .container { position: relative; z-index: 1; }
  .header { text-align: center; margin-bottom: 15px; }
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
  .question { font-size: 16px; color: #2d1b4e; font-weight: 600; margin-bottom: 12px; text-align: center; }
  .progress-bar { height: 8px; background: #e9d5ff; border-radius: 4px; overflow: hidden; margin-bottom: 15px; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #a855f7, #7c3aed); border-radius: 4px; transition: width 0.3s ease; }
  .buttons { display: flex; flex-direction: column; gap: 8px; }
  .btn {
    display: block;
    background: rgba(124,58,237,0.08);
    border: 1px solid rgba(124,58,237,0.25);
    color: #5b21b6;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    text-decoration: none;
  }
  .btn:hover { background: rgba(124,58,237,0.15); }
  .btn:active { transform: scale(0.97); }
  .btn.primary {
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(124,58,237,0.3);
  }
  .btn.primary:hover { background: linear-gradient(135deg, #9333ea, #6d28d9); }
  .guess-section { text-align: center; padding: 10px 0; }
  .guess-photo { max-width: 150px; max-height: 150px; border-radius: 8px; margin-bottom: 10px; border: 2px solid #e9d5ff; }
  .guess-name { font-size: 18px; color: #2d1b4e; font-weight: 700; margin-bottom: 5px; }
  .guess-desc { font-size: 13px; color: #6b21a8; margin-bottom: 15px; }
  .result-section { text-align: center; padding: 10px 0; }
  .result-title { font-size: 20px; color: #2d1b4e; font-weight: 700; margin-bottom: 10px; }
  .result-detail { font-size: 14px; color: #5b21b6; margin-bottom: 15px; line-height: 1.5; }
  .manual-hint { margin-top: 10px; font-size: 11px; color: #a78bfa; text-align: center; }
  .footer { text-align: center; font-size: 11px; color: #a78bfa; padding-top: 10px; border-top: 1px dashed #e9d5ff; }
  @media (max-width: 480px) {
    .akinator-wrapper { padding: 12px; }
    .logo { font-size: 24px; }
    .question { font-size: 15px; }
  }
</style>
<div class="akinator-wrapper">
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#a855f7"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#9333ea"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>

  <div class="container">
    <div class="header">
      <div class="logo">AKINATOR</div>
      <div class="subtitle">— Hu Tao Tebak Karakter —</div>
    </div>
    <div class="card">
      ${body}
    </div>
    <div class="footer">• Akinator by Bayu Official •</div>
  </div>
</div>`;
}

async function sendHtml(conn, chat, html, text) {
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
          submessages: [{ messageType: 2, messageText: text }],
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

  await conn.relayMessage(chat, messagePayload, { messageId: responseId });
}

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  const text = m.text?.trim().toLowerCase() || '';
  const userId = m.sender;

  // Nomor bot: dari conn.user.id jika tersedia, selain itu fallback
  let botNumber = BOT_NUMBER;
  try {
    const rawId = conn.user?.id || conn.user?.jid || '';
    const cleaned = rawId.split(':')[0].replace(/[^0-9]/g, '');
    if (cleaned) botNumber = cleaned;
  } catch {}

  await m.react('🎮');

  try {
    if (!text || text === 'akinator') {
      const game = await startGame(userId);
      const html = createAkinatorHtml(game, botNumber);
      await sendHtml(conn, m.chat, html, '🎮 Akinator Hu Tao - Tebak Karakter');
      return;
    }

    const args = text.split(' ');
    if (args[0] !== 'akinator') return;

    const action = args[1] || '';

    if (['yes','no','idk','probably','probably not'].includes(action)) {
      const game = await answerGame(userId, action);
      const html = createAkinatorHtml(game, botNumber);
      await sendHtml(conn, m.chat, html, '🎮 Akinator');
    } else if (action === 'confirm') {
      const game = await confirmGuess(userId);
      const html = createAkinatorHtml(game, botNumber);
      await sendHtml(conn, m.chat, html, '🎮 Akinator');
    } else if (action === 'reject') {
      const game = await rejectGuess(userId);
      const html = createAkinatorHtml(game, botNumber);
      await sendHtml(conn, m.chat, html, '🎮 Akinator');
    } else {
      await m.reply('Perintah tidak dikenal. Gunakan .akinator untuk mulai.');
    }
  } catch (error) {
    console.error("[AKINATOR_ERROR]", error);
    await m.react('❌');
    m.reply(`❌ Gagal memproses game.\n\n> ${error?.message || error}`);
  }
}

export { pluginConfig as config, handler };