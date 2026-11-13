import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "tictactoe",
  alias: ["ntah", "xo"],
  category: "game",
  description: "Main Tic-Tac-Toe melawan AI di WhatsApp",
  usage: ".tictactoe [easy|hard]",
  example: ".tictactoe hard",
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

/* =========================================================
 * HTML TEMPLATE GAME TIC-TAC-TOE
 * ========================================================= */
function createTicTacToeHtml(mode = 'hard') {
  const modeLabel = mode === 'easy' ? 'Mudah' : 'Sulit';
  const modeValue = mode === 'easy' ? 'easy' : 'hard';

  return `
<style>
  :root {
    --bg: #0f0a1a;
    --card-bg: #1a1128;
    --primary: #7c3aed;
    --primary-light: #a78bfa;
    --text: #f3f4f6;
    --text-muted: #9ca3af;
    --cell-bg: #2d1b4e;
    --cell-hover: #3b2363;
    --x-color: #f87171;
    --o-color: #60a5fa;
    --win-glow: #fbbf24;
  }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    background: transparent;
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }
  .game-container {
    width: 100%;
    max-width: 340px;
    background: var(--card-bg);
    border-radius: 24px;
    padding: 20px 18px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    text-align: center;
  }
  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .game-title {
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 20px;
    background: rgba(124,58,237,0.2);
    color: var(--primary-light);
    border: 1px solid rgba(124,58,237,0.4);
  }
  .status {
    font-size: 16px;
    margin: 10px 0 15px;
    color: var(--text-muted);
    min-height: 24px;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 18px;
  }
  .cell {
    aspect-ratio: 1;
    background: var(--cell-bg);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    -webkit-user-select: none;
    border: 2px solid transparent;
  }
  .cell:not(.taken):hover {
    background: var(--cell-hover);
    transform: scale(0.97);
  }
  .cell.taken {
    cursor: not-allowed;
    pointer-events: none;
  }
  .cell.x {
    color: var(--x-color);
  }
  .cell.o {
    color: var(--o-color);
  }
  .cell.win {
    border-color: var(--win-glow);
    box-shadow: 0 0 12px rgba(251,191,36,0.5);
  }
  .score {
    display: flex;
    justify-content: space-around;
    margin-bottom: 12px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .score span {
    font-weight: 600;
    color: var(--text);
  }
  .btn-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .btn {
    background: rgba(124,58,237,0.15);
    border: 1px solid rgba(124,58,237,0.4);
    color: var(--primary-light);
    padding: 8px 14px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn:hover {
    background: rgba(124,58,237,0.3);
  }
  .btn:active {
    transform: scale(0.95);
  }
  .btn.primary {
    background: var(--primary);
    color: white;
    border: none;
  }
  .btn.primary:hover {
    background: #6d28d9;
  }
  .footer {
    margin-top: 14px;
    font-size: 11px;
    color: var(--text-muted);
  }
</style>

<div class="game-container">
  <div class="game-header">
    <div class="game-title">Tic-Tac-Toe</div>
    <div class="badge" id="mode-badge">${modeLabel}</div>
  </div>
  <div class="status" id="status">Giliran kamu (X)</div>
  <div class="board" id="board">
    <div class="cell" data-index="0"></div>
    <div class="cell" data-index="1"></div>
    <div class="cell" data-index="2"></div>
    <div class="cell" data-index="3"></div>
    <div class="cell" data-index="4"></div>
    <div class="cell" data-index="5"></div>
    <div class="cell" data-index="6"></div>
    <div class="cell" data-index="7"></div>
    <div class="cell" data-index="8"></div>
  </div>
  <div class="score">
    <div>Kamu (X): <span id="player-score">0</span></div>
    <div>Seri: <span id="draw-score">0</span></div>
    <div>AI (O): <span id="ai-score">0</span></div>
  </div>
  <div class="btn-row">
    <button class="btn" id="btn-easy">Mudah</button>
    <button class="btn primary" id="btn-reset">Reset</button>
    <button class="btn" id="btn-hard">Sulit</button>
  </div>
  <div class="footer">Kamu = X, AI = O</div>
</div>

<script>
(function(){
  'use strict';

  const boardEl = document.getElementById('board');
  const cells = Array.from(document.querySelectorAll('.cell'));
  const statusEl = document.getElementById('status');
  const playerScoreEl = document.getElementById('player-score');
  const drawScoreEl = document.getElementById('draw-score');
  const aiScoreEl = document.getElementById('ai-score');
  const resetBtn = document.getElementById('btn-reset');
  const easyBtn = document.getElementById('btn-easy');
  const hardBtn = document.getElementById('btn-hard');
  const modeBadge = document.getElementById('mode-badge');

  let board = ['', '', '', '', '', '', '', '', ''];
  let gameActive = true;
  let currentMode = '${modeValue}';
  let playerScore = 0;
  let drawScore = 0;
  let aiScore = 0;
  let aiTimeout = null;

  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];

  function updateBoardUI() {
    cells.forEach((cell, i) => {
      cell.textContent = board[i];
      cell.classList.remove('x','o','win','taken');
      if (board[i] === 'X') {
        cell.classList.add('x','taken');
      } else if (board[i] === 'O') {
        cell.classList.add('o','taken');
      }
    });
  }

  function checkWinner() {
    for (let pattern of winPatterns) {
      const [a,b,c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], pattern };
      }
    }
    if (!board.includes('')) return { winner: 'draw', pattern: null };
    return null;
  }

  function highlightWinningCells(pattern) {
    if (!pattern) return;
    pattern.forEach(index => {
      cells[index].classList.add('win');
    });
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function endGame(winner, pattern) {
    gameActive = false;
    if (winner === 'X') {
      playerScore++;
      playerScoreEl.textContent = playerScore;
      setStatus('Kamu menang! 🎉');
      highlightWinningCells(pattern);
    } else if (winner === 'O') {
      aiScore++;
      aiScoreEl.textContent = aiScore;
      setStatus('AI menang! 🤖');
      highlightWinningCells(pattern);
    } else {
      drawScore++;
      drawScoreEl.textContent = drawScore;
      setStatus('Seri!');
    }
  }

  function isBoardFull() {
    return board.every(cell => cell !== '');
  }

  function getAvailableMoves() {
    return board.reduce((acc, cell, idx) => cell === '' ? acc.concat(idx) : acc, []);
  }

  function getRandomMove() {
    const moves = getAvailableMoves();
    if (!moves.length) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function minimax(boardArr, depth, isMaximizing) {
    const winner = checkWinnerOnArray(boardArr);
    if (winner === 'X') return -10 + depth;
    if (winner === 'O') return 10 - depth;
    if (winner === 'draw' || isBoardFullOnArray(boardArr)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < boardArr.length; i++) {
        if (boardArr[i] === '') {
          boardArr[i] = 'O';
          const score = minimax(boardArr, depth + 1, false);
          boardArr[i] = '';
          best = Math.max(score, best);
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < boardArr.length; i++) {
        if (boardArr[i] === '') {
          boardArr[i] = 'X';
          const score = minimax(boardArr, depth + 1, true);
          boardArr[i] = '';
          best = Math.min(score, best);
        }
      }
      return best;
    }
  }

  function checkWinnerOnArray(arr) {
    for (let pattern of winPatterns) {
      const [a,b,c] = pattern;
      if (arr[a] && arr[a] === arr[b] && arr[a] === arr[c]) {
        return arr[a];
      }
    }
    if (!arr.includes('')) return 'draw';
    return null;
  }

  function isBoardFullOnArray(arr) {
    return arr.every(cell => cell !== '');
  }

  function aiMove() {
    if (!gameActive) return;
    const available = getAvailableMoves();
    if (!available.length) return;

    let moveIndex;
    if (currentMode === 'easy') {
      moveIndex = getRandomMove();
    } else {
      // hard: minimax dengan sedikit kejutan (10% random) agar tidak selalu sempurna
      if (Math.random() < 0.1) {
        moveIndex = getRandomMove();
      } else {
        let bestScore = -Infinity;
        let bestMoves = [];
        for (let i = 0; i < board.length; i++) {
          if (board[i] === '') {
            board[i] = 'O';
            const score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
              bestScore = score;
              bestMoves = [i];
            } else if (score === bestScore) {
              bestMoves.push(i);
            }
          }
        }
        moveIndex = bestMoves[Math.floor(Math.random() * bestMoves.length)];
      }
    }

    if (moveIndex !== undefined && board[moveIndex] === '') {
      board[moveIndex] = 'O';
      updateBoardUI();
      const result = checkWinner();
      if (result) {
        endGame(result.winner, result.pattern);
        return;
      }
      setStatus('Giliran kamu (X)');
    }
  }

  function playerMove(index) {
    if (!gameActive) return;
    if (board[index] !== '') return;

    board[index] = 'X';
    updateBoardUI();

    const result = checkWinner();
    if (result) {
      endGame(result.winner, result.pattern);
      return;
    }

    setStatus('AI berpikir...');
    gameActive = false; // sementara nonaktifkan sampai AI selesai
    aiTimeout = setTimeout(() => {
      gameActive = true;
      aiMove();
    }, 500);
  }

  function resetGame() {
    if (aiTimeout) clearTimeout(aiTimeout);
    board = ['', '', '', '', '', '', '', '', ''];
    gameActive = true;
    updateBoardUI();
    setStatus('Giliran kamu (X)');
    cells.forEach(cell => cell.classList.remove('win'));
  }

  function setMode(mode) {
    currentMode = mode;
    modeBadge.textContent = mode === 'easy' ? 'Mudah' : 'Sulit';
    resetGame();
  }

  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      const index = parseInt(cell.dataset.index);
      playerMove(index);
    });
  });

  resetBtn.addEventListener('click', resetGame);
  easyBtn.addEventListener('click', () => setMode('easy'));
  hardBtn.addEventListener('click', () => setMode('hard'));

  // Inisialisasi
  resetGame();
})();
</script>`;
}

/* =========================================================
 * HANDLER
 * ========================================================= */
async function handler(m, { sock }) {
  const conn = sock || m.conn;
  const text = m.text?.trim().toLowerCase() || '';
  let mode = 'hard';
  if (text.includes('easy') || text.includes('mudah')) mode = 'easy';
  if (text.includes('hard') || text.includes('sulit')) mode = 'hard';

  await m.react('🎮');

  try {
    const html = createTicTacToeHtml(mode);
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
            submessages: [{ messageType: 2, messageText: `Game Tic-Tac-Toe (${mode === 'easy' ? 'Mudah' : 'Sulit'})` }],
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
    console.error("[TicTacToe Error]", error);
    await m.react('❌');
    m.reply(`❌ Gagal memuat game.\n\n> ${error?.message || 'Unknown error'}`);
  }
}

export { pluginConfig as config, handler };