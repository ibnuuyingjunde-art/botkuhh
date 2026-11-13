import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;

const pluginConfig = {
    name: 'tetris',
    alias: ['tetrisgame', 'game', 'ttris'],
    category: 'game',
    description: 'Game Tetris Klasik Full Kontrol Tombol & Level',
    usage: '.tetris',
    cooldown: 5,
    isEnabled: true
};

const HTML_TETRIS = `<style>
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0b0e14; color: #e1e2e6; font-family: 'Rajdhani', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 4px; touch-action: none; user-select: none; }

/* Wrapper ukuran pas kayak versi 1 */
.wrapper { width: 100%; max-width: 320px; background: linear-gradient(145deg, #181c25, #0b0e14); border: 1px solid #2a3143; border-radius: 12px; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; }

/* Header Info */
.top-info { display: flex; justify-content: space-between; width: 100%; margin-bottom: 6px; gap: 4px; }
.stat-box { background: #12151c; border: 1px solid #262c3b; border-radius: 6px; padding: 4px; text-align: center; flex: 1; }
.stat-label { font-size: 8px; color: #5a6b8c; text-transform: uppercase; font-weight: bold; }
.stat-val { font-size: 14px; color: #ffcc00; font-weight: bold; text-shadow: 1px 1px 0 #000; }

.sub-info { display: flex; justify-content: space-between; width: 100%; font-size: 10px; color: #8a92a1; margin-bottom: 6px; font-weight: bold; padding: 0 2px; }

/* Arena Board (Ukuran dikembalikan ke 22px agar muat) */
.board-container { background: #05070a; border: 2px solid #323a4d; border-radius: 6px; padding: 3px; margin-bottom: 6px; }
.board { display: grid; grid-template-columns: repeat(10, 1fr); gap: 1px; background: #1a1f2b; }
.cell { width: 22px; height: 22px; background: #05070a; border-radius: 2px; }

/* Controls */
.controls { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; width: 100%; margin-bottom: 4px; }
.btn-ctrl { background: linear-gradient(180deg, #2a3143, #1a1f2b); border: 1px solid #3a445d; border-radius: 6px; color: #fff; height: 34px; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 0 #0d1017; }
.btn-ctrl:active { transform: translateY(3px); box-shadow: 0 0 0 #0d1017; background: #1a1f2b; }

.btn-action { width: 100%; background: linear-gradient(180deg, #d32f2f, #b71c1c); border: 1px solid #ff5252; border-radius: 6px; color: #fff; height: 32px; font-size: 12px; font-weight: bold; cursor: pointer; margin-bottom: 4px; letter-spacing: 2px; box-shadow: 0 3px 0 #7f0000; }
.btn-action:active { transform: translateY(3px); box-shadow: 0 0 0 #7f0000; }

.bottom-row { display: flex; gap: 4px; width: 100%; }
.btn-sub { flex: 1; background: #1a1f2b; border: 1px solid #2a3143; border-radius: 6px; color: #a0a6b5; height: 28px; font-size: 10px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 0 #0d1017; text-transform: uppercase; }
.btn-sub:active { transform: translateY(2px); box-shadow: 0 0 0 #0d1017; }

/* Neon Blocks */
.b-I { background: #00e5ff; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-J { background: #2979ff; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-L { background: #ff9100; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-O { background: #ffea00; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-S { background: #00e676; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-T { background: #d500f9; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.b-Z { background: #ff1744; box-shadow: inset 0 0 4px rgba(255,255,255,0.6); }
.empty { background: #05070a; }
</style>

<div class="wrapper">
  <div class="top-info">
    <div class="stat-box"><div class="stat-label">SKOR</div><div class="stat-val" id="score">0</div></div>
    <div class="stat-box"><div class="stat-label">BARIS</div><div class="stat-val" id="lines">0</div></div>
    <div class="stat-box"><div class="stat-label">LEVEL</div><div class="stat-val" id="level">1</div></div>
  </div>

  <div class="sub-info">
    <div>NEXT ⇨</div>
    <div id="targetTxt">TARGET: 1500</div>
  </div>

  <div class="board-container">
    <div class="board" id="board"></div>
  </div>

  <div class="controls">
    <button class="btn-ctrl" onclick="move(-1)">◀</button>
    <button class="btn-ctrl" onclick="rotate()">⟳</button>
    <button class="btn-ctrl" onclick="move(1)">▶</button>
    <button class="btn-ctrl" onclick="dropFast()">▼</button>
  </div>

  <button class="btn-action" onclick="hardDrop()">DROP!</button>

  <div class="bottom-row">
    <button class="btn-sub" onclick="togglePause()" id="pauseBtn">PAUSE</button>
    <button class="btn-sub" onclick="initGame()">RESTART</button>
  </div>
</div>

<script>
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score'), linesEl = document.getElementById('lines'), levelEl = document.getElementById('level');
const pauseBtn = document.getElementById('pauseBtn');
const COLS = 10, ROWS = 18;
let board = [], score = 0, lines = 0, level = 1, isPaused = false, gameOver = false, dropInterval = 600, dropTimer = null, audioCtx = null;

const SHAPES = [
  { shape: [[1,1,1,1]], class: 'b-I' },
  { shape: [[1,0,0],[1,1,1]], class: 'b-J' },
  { shape: [[0,0,1],[1,1,1]], class: 'b-L' },
  { shape: [[1,1],[1,1]], class: 'b-O' },
  { shape: [[0,1,1],[1,1,0]], class: 'b-S' },
  { shape: [[0,1,0],[1,1,1]], class: 'b-T' },
  { shape: [[1,1,0],[0,1,1]], class: 'b-Z' }
];

let currentPiece = null;

function getAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function playSound(f,d,t='square'){try{let ctx=getAudio(),o=ctx.createOscillator(),g=ctx.createGain();o.type=t;o.frequency.value=f;g.gain.setValueAtTime(0.08,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+d);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+d)}catch(e){}}

function initGame(){
    board = Array(ROWS).fill(0).map(()=>Array(COLS).fill(null));
    score = 0; lines = 0; level = 1; isPaused = false; gameOver = false; dropInterval = 600;
    scoreEl.innerText = score; linesEl.innerText = lines; levelEl.innerText = level;
    pauseBtn.innerText = 'PAUSE';
    spawnPiece();
    if(dropTimer) clearInterval(dropTimer);
    dropTimer = setInterval(gameLoop, dropInterval);
    draw();
}

function spawnPiece(){
    let rand = SHAPES[Math.floor(Math.random()*SHAPES.length)];
    currentPiece = {
        shape: rand.shape, class: rand.class, row: 0, col: Math.floor(COLS/2) - Math.floor(rand.shape[0].length/2)
    };
    if(checkCollision(currentPiece.row, currentPiece.col, currentPiece.shape)){
        gameOver = true; clearInterval(dropTimer); playSound(120, 0.4, 'sawtooth'); alert('GAME OVER! SCORE: ' + score);
    }
}

function checkCollision(r, c, shape){
    for(let i=0; i<shape.length; i++){
        for(let j=0; j<shape[i].length; j++){
            if(shape[i][j]){
                let nr = r + i, nc = c + j;
                if(nc < 0 || nc >= COLS || nr >= ROWS) return true;
                if(nr >= 0 && board[nr][nc] !== null) return true;
            }
        }
    } return false;
}

function mergePiece(){
    for(let i=0; i<currentPiece.shape.length; i++){
        for(let j=0; j<currentPiece.shape[i].length; j++){
            if(currentPiece.shape[i][j]){
                let nr = currentPiece.row + i, nc = currentPiece.col + j;
                if(nr >= 0) board[nr][nc] = currentPiece.class;
            }
        }
    }
    clearLines(); spawnPiece();
}

function clearLines(){
    let cleared = 0;
    for(let r = ROWS - 1; r >= 0; r--){
        if(board[r].every(cell => cell !== null)){
            board.splice(r, 1); board.unshift(Array(COLS).fill(null)); cleared++; r++;
        }
    }
    if(cleared > 0){
        playSound(700, 0.2); lines += cleared; score += cleared * 100 * level;
        level = Math.floor(lines / 5) + 1;
        scoreEl.innerText = score; linesEl.innerText = lines; levelEl.innerText = level;
    }
}

function move(dir){
    if(isPaused || gameOver) return;
    if(!checkCollision(currentPiece.row, currentPiece.col + dir, currentPiece.shape)){
        currentPiece.col += dir; playSound(300, 0.04); draw();
    }
}

function dropFast(){
    if(isPaused || gameOver) return;
    if(!checkCollision(currentPiece.row + 1, currentPiece.col, currentPiece.shape)){
        currentPiece.row++; score += 1; scoreEl.innerText = score; draw();
    } else { mergePiece(); draw(); }
}

function hardDrop(){
    if(isPaused || gameOver) return;
    while(!checkCollision(currentPiece.row + 1, currentPiece.col, currentPiece.shape)){
        currentPiece.row++; score += 2;
    }
    playSound(450, 0.1); scoreEl.innerText = score; mergePiece(); draw();
}

function rotate(){
    if(isPaused || gameOver) return;
    let shape = currentPiece.shape;
    let rows = shape.length, cols = shape[0].length;
    let rotated = Array(cols).fill(0).map(()=>Array(rows).fill(0));
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++) rotated[c][rows - 1 - r] = shape[r][c];
    }
    if(!checkCollision(currentPiece.row, currentPiece.col, rotated)){
        currentPiece.shape = rotated; playSound(500, 0.05); draw();
    }
}

function togglePause(){
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? 'RESUME' : 'PAUSE';
}

function gameLoop(){
    if(isPaused || gameOver) return;
    if(!checkCollision(currentPiece.row + 1, currentPiece.col, currentPiece.shape)) currentPiece.row++;
    else mergePiece();
    draw();
}

function draw(){
    boardEl.innerHTML = '';
    let renderBoard = board.map(row => [...row]);
    if(currentPiece){
        for(let i=0; i<currentPiece.shape.length; i++){
            for(let j=0; j<currentPiece.shape[i].length; j++){
                if(currentPiece.shape[i][j]){
                    let nr = currentPiece.row + i, nc = currentPiece.col + j;
                    if(nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) renderBoard[nr][nc] = currentPiece.class;
                }
            }
        }
    }
    for(let r=0; r<ROWS; r++){
        for(let c=0; c<COLS; c++){
            let cell = document.createElement('div');
            cell.className = 'cell ' + (renderBoard[r][c] ? renderBoard[r][c] : 'empty');
            boardEl.appendChild(cell);
        }
    }
}

initGame();
</script>`;

async function handler(m, { sock }) {
    await m.react('⏳');
    
    const rich = new AIRich(sock)
        .setTitle('🕹️ Tetris Arcade Arena')
        .setFooter('Kontrol Arcade Interaktif & Sistem Level');

    try {
        await rich.send(m.chat, { quoted: m });
        await new Promise(r => setTimeout(r, 400));
        
        rich.addSection({
            view_model: {
                __typename: 'GenAISingleLayoutViewModel',
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    trusted_sources: ['whatsapp.com'],
                    payload: HTML_TETRIS
                }
            }
        });
        
        await rich.sendEdit();
        await m.react('🎮');
    } catch (e) {
        m.reply(`❌ *Gagal memuat Tetris:* ${e.message}`);
    }
}

export { pluginConfig as config, handler };