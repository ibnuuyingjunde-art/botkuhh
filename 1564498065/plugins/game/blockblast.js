import fs from "fs";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import { randomUUID } from "crypto";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "blockblast",
  alias: ["bb", "blastblock"],
  category: "game",
  description: "Game Block Blast — susun dan ledakkan blok!",
  usage: ".bb",
  example: ".bb",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 2,
  isEnabled: true,
};

const GRID = 8;
const CELL = 56;
const PAD = 16;

const COLORS = {
  bg: "#0a0a0f",
  gridBg: "#111122",
  gridLine: "#1e1e3a",
  empty: "#0d0d1e",
  text: "#ffffff",
  score: "#ffd700",
  danger: "#ff4757",
  pieces: [
    { fill: "#ff6b6b", glow: "#ff0000" },
    { fill: "#ffa502", glow: "#ff6600" },
    { fill: "#ffdd59", glow: "#ffaa00" },
    { fill: "#7bed9f", glow: "#00ff88" },
    { fill: "#70a1ff", glow: "#0044ff" },
    { fill: "#a29bfe", glow: "#6600ff" },
    { fill: "#fd79a8", glow: "#ff0088" },
    { fill: "#00cec9", glow: "#00ffff" },
  ],
};

const SHAPES = [
  { name: "titik",   cells: [[0,0]] },
  { name: "–2",      cells: [[0,0],[0,1]] },
  { name: "|2",      cells: [[0,0],[1,0]] },
  { name: "–3",      cells: [[0,0],[0,1],[0,2]] },
  { name: "|3",      cells: [[0,0],[1,0],[2,0]] },
  { name: "■2x2",    cells: [[0,0],[0,1],[1,0],[1,1]] },
  { name: "L",       cells: [[0,0],[1,0],[2,0],[2,1]] },
  { name: "J",       cells: [[0,1],[1,1],[2,0],[2,1]] },
  { name: "T",       cells: [[0,0],[0,1],[0,2],[1,1]] },
  { name: "S",       cells: [[0,1],[0,2],[1,0],[1,1]] },
  { name: "Z",       cells: [[0,0],[0,1],[1,1],[1,2]] },
  { name: "–4",      cells: [[0,0],[0,1],[0,2],[0,3]] },
  { name: "|4",      cells: [[0,0],[1,0],[2,0],[3,0]] },
  { name: "+",       cells: [[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { name: "■3x3",    cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] },
];

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0));
}

function randPiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const color = Math.floor(Math.random() * COLORS.pieces.length) + 1;
  return { shape, color };
}

function canPlace(grid, shape, r, c) {
  for (const [dr, dc] of shape.cells) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID || grid[nr][nc] !== 0) return false;
  }
  return true;
}

function place(grid, shape, r, c, color) {
  const g = grid.map(row => [...row]);
  for (const [dr, dc] of shape.cells) g[r+dr][c+dc] = color;
  return g;
}

function clearLines(grid) {
  let g = grid.map(r => [...r]);
  let cleared = 0, cells = [];
  const fullRows = [], fullCols = [];

  for (let r = 0; r < GRID; r++)
    if (g[r].every(v => v)) { fullRows.push(r); }
  for (let c = 0; c < GRID; c++)
    if (g.every(r => r[c])) { fullCols.push(c); }

  const seen = new Set();
  for (const r of fullRows)
    for (let c = 0; c < GRID; c++) {
      const k = `${r},${c}`; if (!seen.has(k)) { cells.push([r,c]); seen.add(k); }
    }
  for (const c of fullCols)
    for (let r = 0; r < GRID; r++) {
      const k = `${r},${c}`; if (!seen.has(k)) { cells.push([r,c]); seen.add(k); }
    }

  cleared = fullRows.length + fullCols.length;
  for (const [r, c] of cells) g[r][c] = 0;
  return { grid: g, cleared, cells };
}

function hasMove(grid, pieces) {
  for (const p of pieces) {
    if (!p) continue;
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (canPlace(grid, p.shape, r, c)) return true;
  }
  return false;
}

function cellToRC(cellNum) {
  const idx = cellNum - 1;
  return [Math.floor(idx / GRID), idx % GRID];
}

function getValidCells(grid, shape) {
  const valid = [];
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (canPlace(grid, shape, r, c)) {
        valid.push(r * GRID + c + 1);
      }
  return valid;
}

async function renderBoard(state, hlCells = [], mode = null) {
  const previewH = 90;
  const headerH = 70;
  const W = GRID * CELL + PAD * 2;
  const H = headerH + GRID * CELL + PAD + previewH;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#0d0d1a";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 18) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
  for (let j = 0; j < H; j += 18) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }

  ctx.fillStyle = COLORS.score;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.fillText("⚡ BLOCK BLAST", PAD, 26);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px monospace";
  ctx.fillText(`Skor: ${state.score.toLocaleString()}`, PAD, 46);

  ctx.fillStyle = "#a29bfe";
  ctx.fillText(`Combo: x${state.combo}`, PAD + 130, 46);

  ctx.fillStyle = "#636e72";
  ctx.textAlign = "right";
  ctx.font = "12px monospace";
  ctx.fillText(`BEST: ${state.highScore.toLocaleString()}`, W - PAD, 26);
  ctx.fillText(`Giliran: ${state.moves}`, W - PAD, 44);
  ctx.textAlign = "left";

  const g = ctx.createLinearGradient(0, 56, W, 56);
  g.addColorStop(0,"#00ffff00"); g.addColorStop(0.5,"#00ffff"); g.addColorStop(1,"#00ffff00");
  ctx.strokeStyle = g; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 58); ctx.lineTo(W-PAD, 58); ctx.stroke();

  const oY = headerH;

  ctx.fillStyle = COLORS.gridBg;
  ctx.roundRect(PAD-3, oY-3, GRID*CELL+6, GRID*CELL+6, 8);
  ctx.fill();

  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  for (let r = 0; r <= GRID; r++) {
    ctx.beginPath(); ctx.moveTo(PAD, oY+r*CELL); ctx.lineTo(PAD+GRID*CELL, oY+r*CELL); ctx.stroke();
  }
  for (let c = 0; c <= GRID; c++) {
    ctx.beginPath(); ctx.moveTo(PAD+c*CELL, oY); ctx.lineTo(PAD+c*CELL, oY+GRID*CELL); ctx.stroke();
  }

  const hlSet = new Set((hlCells||[]).map(([r,c])=>`${r},${c}`));

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = state.grid[r][c];
      const x = PAD + c*CELL, y = oY + r*CELL;
      const hl = hlSet.has(`${r},${c}`);

      if (v) {
        const col = COLORS.pieces[(v-1) % COLORS.pieces.length];
        ctx.shadowColor = col.glow;
        ctx.shadowBlur = hl ? 22 : 10;

        const gr = ctx.createLinearGradient(x, y, x+CELL, y+CELL);
        gr.addColorStop(0, col.fill);
        gr.addColorStop(1, col.glow+"99");
        ctx.fillStyle = gr;
        ctx.roundRect(x+2, y+2, CELL-4, CELL-4, 5);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.roundRect(x+4, y+4, CELL-8, (CELL-8)/3, 3);
        ctx.fill();

        ctx.strokeStyle = hl ? "#ffffff" : col.glow;
        ctx.lineWidth = hl ? 2.5 : 1.2;
        ctx.roundRect(x+2, y+2, CELL-4, CELL-4, 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.empty;
        ctx.roundRect(x+2, y+2, CELL-4, CELL-4, 4);
        ctx.fill();
        ctx.fillStyle = "#1a1a30";
        ctx.beginPath();
        ctx.arc(x+CELL/2, y+CELL/2, 2, 0, Math.PI*2);
        ctx.fill();
      }

      if (!v && !state.gameOver && mode !== "clear") {
        const num = r * GRID + c + 1;
        ctx.fillStyle = "#ffffff18";
        ctx.font = "9px monospace";
        ctx.textAlign = "left";
        ctx.fillText(num.toString(), x+3, y+11);
        ctx.textAlign = "left";
      }
    }
  }

  if (mode === "clear" && hlCells.length > 0) {
    for (const [r, c] of hlCells) {
      const x = PAD + c*CELL + CELL/2, y = oY + r*CELL + CELL/2;
      ctx.shadowColor = "#ffdd59"; ctx.shadowBlur = 28;
      ctx.strokeStyle = "#ffdd5988"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, CELL/2-2, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#ffdd59"; ctx.shadowColor = "#ffdd59"; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI)/6 - Math.PI/2;
        const rad = i%2===0 ? 10 : 4;
        if (i===0) ctx.moveTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad);
        else ctx.lineTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad);
      }
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#ffdd59";
    ctx.font = "bold 26px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ffaa00"; ctx.shadowBlur = 20;
    ctx.fillText(`💥 BLAST! +${state.lastScore||""}`, W/2, oY + GRID*CELL + 30);
    ctx.shadowBlur = 0; ctx.textAlign = "left";
  }

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.roundRect(PAD-3, oY-3, GRID*CELL+6, GRID*CELL+6, 8);
    ctx.fill();

    ctx.fillStyle = COLORS.danger;
    ctx.font = "bold 34px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = COLORS.danger; ctx.shadowBlur = 30;
    ctx.fillText("GAME OVER", W/2, oY + GRID*CELL/2 - 15);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.score;
    ctx.font = "bold 20px monospace";
    ctx.fillText(`Skor: ${state.score.toLocaleString()}`, W/2, oY + GRID*CELL/2 + 20);
    ctx.fillStyle = "#a29bfe";
    ctx.font = "13px monospace";
    ctx.fillText(".bb new untuk main lagi", W/2, oY + GRID*CELL/2 + 48);
    ctx.textAlign = "left";
  }

  if (!state.gameOver) {
    const pY = oY + GRID*CELL + 10;
    ctx.fillStyle = "#636e72";
    ctx.font = "11px monospace";
    ctx.fillText("BLOK TERSEDIA:", PAD, pY + 12);

    let px = PAD + 110;
    for (let pi = 0; pi < state.pieces.length; pi++) {
      const p = state.pieces[pi];
      if (!p) continue;
      const col = COLORS.pieces[(p.color-1) % COLORS.pieces.length];
      const mini = 13;
      const maxC = Math.max(...p.shape.cells.map(c=>c[1]));
      const maxR = Math.max(...p.shape.cells.map(c=>c[0]));

      ctx.fillStyle = "#ffffff99";
      ctx.font = "bold 11px monospace";
      ctx.fillText(`[${pi+1}]`, px + (maxC*mini)/2 - 6, pY + 10);

      for (const [dr,dc] of p.shape.cells) {
        ctx.fillStyle = col.fill;
        ctx.shadowColor = col.glow; ctx.shadowBlur = 6;
        ctx.roundRect(px+dc*mini, pY+14+dr*mini, mini-1, mini-1, 2);
        ctx.fill(); ctx.shadowBlur = 0;
      }
      px += (maxC+1)*mini + 22;
    }
  }

  return canvas.toBuffer("image/jpeg", { quality: 92 });
}

const KEY = "blockblast2";
const KEY_HS = "blockblastHS";

function getGame(db, sender) { return (db.data[KEY]||{})[sender] || null; }
function saveGame(db, sender, state) {
  if (!db.data[KEY]) db.data[KEY] = {};
  db.data[KEY][sender] = state; db.save();
}
function delGame(db, sender) {
  if (db.data[KEY]) { delete db.data[KEY][sender]; db.save(); }
}
function getHS(db, s) { return (db.data[KEY_HS]||{})[s] || 0; }
function setHS(db, s, sc) {
  if (!db.data[KEY_HS]) db.data[KEY_HS] = {};
  if (sc > (db.data[KEY_HS][s]||0)) { db.data[KEY_HS][s] = sc; db.save(); }
}

async function send(sock, m, buf, caption) {
  const conn = sock || m.conn;
  const responseId = randomUUID();

  const ai = new AIRich(conn);
  ai.setResponseId(responseId);
  ai.setBotResponseId(responseId);
  ai.addText(caption);

  const messagePayload = await ai.build(m.chat, {
    messageId: responseId,
    forwarded: true,
    includesUnifiedResponse: true,
    includesSubmessages: true,
  });

  await conn.sendMessage(m.chat, { image: buf, caption }, { quoted: m });
  await ai.sendEdit(m.chat, responseId, { msg: messagePayload.message });
}

async function sendBlast(sock, m, state, clearedCells, caption) {
  const conn = sock || m.conn;
  const responseId = randomUUID();

  const f1 = await renderBoard(state, clearedCells, "highlight");
  await conn.sendMessage(m.chat, { image: f1 }, { quoted: m });
  await new Promise(r => setTimeout(r, 350));

  const f2 = await renderBoard(state, clearedCells, "clear");
  await conn.sendMessage(m.chat, { image: f2 }, { quoted: m });
  await new Promise(r => setTimeout(r, 350));

  const f3 = await renderBoard(state);
  
  const ai = new AIRich(conn);
  ai.setResponseId(responseId);
  ai.setBotResponseId(responseId);
  ai.addText(caption);

  const messagePayload = await ai.build(m.chat, {
    messageId: responseId,
    forwarded: true,
    includesUnifiedResponse: true,
    includesSubmessages: true,
  });

  await conn.sendMessage(m.chat, { image: f3, caption }, { quoted: m });
  await ai.sendEdit(m.chat, responseId, { msg: messagePayload.message });
}

function makeGuide(state, pieceIdx) {
  const piece = state.pieces[pieceIdx];
  if (!piece) return "Blok ini sudah dipakai.";
  
  const validCells = getValidCells(state.grid, piece.shape);
  if (validCells.length === 0) return "❌ Tidak ada posisi valid untuk blok ini!";

  const shown = validCells.slice(0, 12);
  const more = validCells.length - shown.length;

  let txt = `Blok [${pieceIdx+1}] — bentuk: *${piece.shape.name}*\n`;
  txt += `📍 Bisa ditaruh di kotak: `;
  txt += shown.join(", ");
  if (more > 0) txt += ` ...+${more} lagi`;
  txt += `\n\n`;
  txt += `Ketik: *.bb ${pieceIdx+1} [nomor kotak]*\n`;
  txt += `Contoh: *.bb ${pieceIdx+1} ${shown[0]}*`;
  return txt;
}

async function handler(m, { sock, config: botConfig, db }) {
  const conn = sock || m.conn;
  const raw = (m.args||[]).join(" ").trim().toLowerCase();
  const parts = raw.split(/\s+/);
  const sub = parts[0] || "";

  const sender = m.sender;

  if (!sub || sub === "new" || sub === "mulai" || sub === "baru") {
    const hs = getHS(db, sender);
    const state = {
      grid: emptyGrid(),
      pieces: [randPiece(), randPiece(), randPiece()],
      score: 0, combo: 0, moves: 0, level: 1,
      highScore: hs, gameOver: false, lastScore: 0,
    };
    saveGame(db, sender, state);

    const buf = await renderBoard(state);
    const caption =
      `🎮 *BLOCK BLAST* dimulai!\n\n` +
      `*Cara main simpel:*\n` +
      `1️⃣ Lihat 3 blok tersedia di bawah gambar\n` +
      `2️⃣ Lihat nomor kotak kecil di dalam papan (1–64)\n` +
      `3️⃣ Ketik: *.bb [blok] [kotak]*\n\n` +
      `📌 *Contoh:*\n` +
      `> *.bb 1 10* → taruh blok ke-1 di kotak 10\n` +
      `> *.bb 2 25* → taruh blok ke-2 di kotak 25\n\n` +
      `💡 Bingung mau taruh di mana?\n` +
      `> *.bb cek 1* → lihat posisi valid blok 1\n` +
      `> *.bb cek 2* → lihat posisi valid blok 2\n\n` +
      `🎯 Penuhkan 1 baris/kolom → BLAST! +skor`;

    await send(conn, m, buf, caption);
    return;
  }

  if (sub === "info" || sub === "help" || sub === "cara") {
    return m.reply(
      `🎮 *BLOCK BLAST — Cara Main*\n\n` +
      `*Perintah:*\n` +
      `• *.bb new* — mulai game baru\n` +
      `• *.bb [1/2/3] [nomor kotak]* — taruh blok\n` +
      `• *.bb cek* — lihat papan\n` +
      `• *.bb cek [1/2/3]* — cek posisi valid blok\n` +
      `• *.bb top* — high score\n` +
      `• *.bb stop* — akhiri game\n\n` +
      `*Cara baca papan:*\n` +
      `• Papan 8x8 = 64 kotak\n` +
      `• Nomor kotak 1 = pojok kiri atas\n` +
      `• Nomor kotak 64 = pojok kanan bawah\n` +
      `• Nomor urut dari kiri ke kanan, atas ke bawah\n\n` +
      `*Tujuan:*\n` +
      `• Susun blok sampai 1 baris atau kolom penuh\n` +
      `• Kalau penuh → meledak! 💥 dapat poin\n` +
      `• Makin banyak meledak sekaligus → combo!\n` +
      `• Game over kalau tidak ada tempat lagi\n\n` +
      `*Tips mudah:*\n` +
      `Bingung? Ketik *.bb cek 1* untuk lihat\n` +
      `semua posisi yang bisa ditaruh blok ke-1!`
    );
  }

  if (sub === "cek" || sub === "lihat" || sub === "papan") {
    const state = getGame(db, sender);
    if (!state) return m.reply(`❌ Belum ada game!\nKetik *.bb new* untuk mulai.`);

    const pieceArg = parseInt(parts[1]);
    if (!isNaN(pieceArg) && pieceArg >= 1 && pieceArg <= 3) {
      const guide = makeGuide(state, pieceArg - 1);
      const buf = await renderBoard(state);
      await send(conn, m, buf, `🔍 *Posisi valid untuk Blok ${pieceArg}:*\n\n${guide}`);
      return;
    }

    const buf = await renderBoard(state);
    const active = state.pieces.filter(p=>p).length;
    const caption = state.gameOver
      ? `💀 *Game Over!* Skor: *${state.score.toLocaleString()}*\n*.bb new* untuk main lagi.`
      : `🎮 *Papanmu saat ini*\n` +
        `Skor: *${state.score.toLocaleString()}* | Combo: *x${state.combo}*\n` +
        `Blok tersisa: *${active}*\n\n` +
        `*.bb cek 1* — lihat posisi valid blok 1\n` +
        `*.bb [1/2/3] [kotak]* — taruh blok`;
    await send(conn, m, buf, caption);
    return;
  }

  if (sub === "stop" || sub === "menyerah" || sub === "quit") {
    const state = getGame(db, sender);
    if (!state) return m.reply(`❌ Tidak ada game aktif.`);
    setHS(db, sender, state.score);
    delGame(db, sender);
    return m.reply(
      `🏳️ Game diakhiri.\n` +
      `📊 Skor akhir: *${state.score.toLocaleString()}*\n` +
      `🏆 High score: *${getHS(db,sender).toLocaleString()}*\n\n` +
      `*.bb new* untuk main lagi!`
    );
  }

  if (sub === "top" || sub === "hs") {
    const allHS = db.data[KEY_HS] || {};
    const sorted = Object.entries(allHS).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const medals = ["🥇","🥈","🥉"];
    let txt = `🏆 *BLOCK BLAST TOP 10*\n\n`;
    if (!sorted.length) txt += `_Belum ada skor._`;
    else for (let i=0;i<sorted.length;i++) {
      const [jid,sc] = sorted[i];
      const me = jid===sender;
      txt += `${medals[i]||`${i+1}.`} ${me?"*":""}+${jid.split("@")[0]}${me?"*":""} — ${sc.toLocaleString()}\n`;
    }
    txt += `\n📊 Skormu: *${getHS(db,sender).toLocaleString()}*`;
    return m.reply(txt);
  }

  const pieceNo = parseInt(sub);
  const cellNo = parseInt(parts[1]);

  if (!isNaN(pieceNo) && pieceNo >= 1 && pieceNo <= 3) {
    const state = getGame(db, sender);
    if (!state) return m.reply(`❌ Belum ada game!\nKetik *.bb new* untuk mulai.`);
    if (state.gameOver) return m.reply(`💀 Game sudah selesai!\n*.bb new* untuk main lagi.`);

    const pieceIdx = pieceNo - 1;
    const piece = state.pieces[pieceIdx];
    if (!piece) return m.reply(`❌ Blok ke-${pieceNo} sudah dipakai!\nPilih blok lain yang masih ada.`);

    if (isNaN(cellNo)) {
      const guide = makeGuide(state, pieceIdx);
      const buf = await renderBoard(state);
      await send(conn, m, buf, `💡 *Blok ${pieceNo} bisa ditaruh di mana?*\n\n${guide}`);
      return;
    }

    if (cellNo < 1 || cellNo > 64) {
      return m.reply(`❌ Nomor kotak harus 1–64!\nContoh: *.bb ${pieceNo} 15*`);
    }

    const [row, col] = cellToRC(cellNo);

    if (!canPlace(state.grid, piece.shape, row, col)) {
      const valid = getValidCells(state.grid, piece.shape);
      let hint = `❌ Blok ${pieceNo} tidak bisa ditaruh di kotak ${cellNo}!\n\n`;
      if (valid.length === 0) {
        hint += `Blok ini tidak punya tempat kosong sama sekali.\nCoba pakai blok lain.`;
      } else {
        hint += `💡 Coba kotak: *${valid.slice(0,8).join(", ")}*`;
        if (valid.length > 8) hint += ` ...+${valid.length-8} lagi`;
        hint += `\n\nAtau ketik *.bb cek ${pieceNo}* untuk lihat semua posisi valid.`;
      }
      return m.reply(hint);
    }

    state.grid = place(state.grid, piece.shape, row, col, piece.color);
    state.pieces[pieceIdx] = null;
    state.moves++;

    const { grid: newGrid, cleared, cells: clearedCells } = clearLines(state.grid);

    let gained = 0;
    if (cleared > 0) {
      state.combo++;
      const base = [0,100,300,600,1000];
      gained = Math.round((base[Math.min(cleared,4)] || cleared*100) * (1 + state.combo*0.5));
      state.score += gained;
      state.lastScore = gained;
      state.grid = newGrid;
      state.level = Math.floor(state.score/1000)+1;
    } else {
      state.combo = 0;
      state.lastScore = 0;
      state.grid = newGrid;
    }

    if (state.pieces.every(p=>!p)) {
      state.pieces = [randPiece(), randPiece(), randPiece()];
    }

    if (!hasMove(state.grid, state.pieces.filter(p=>p))) {
      state.gameOver = true;
      setHS(db, sender, state.score);
    }

    saveGame(db, sender, state);

    let caption = "";
    if (state.gameOver) {
      caption =
        `💀 *GAME OVER!*\n` +
        `📊 Skor akhir: *${state.score.toLocaleString()}*\n` +
        `🏆 High score: *${getHS(db,sender).toLocaleString()}*\n\n` +
        `*.bb new* untuk main lagi!`;
    } else if (cleared > 0) {
      caption =
        `💥 *BLAST! +${gained.toLocaleString()} poin!*\n` +
        `🔥 Combo: *x${state.combo}* | Terhapus: *${cleared}* baris/kolom\n` +
        `📊 Total: *${state.score.toLocaleString()}* | Level: *${state.level}*\n\n` +
        `Lanjut! *.bb cek [1/2/3]* untuk lihat posisi valid`;
    } else {
      const next = state.pieces.map((p,i)=>p?`[${i+1}]`:null).filter(Boolean).join(" ");
      caption =
        `✅ Blok ${pieceNo} ditaruh di kotak ${cellNo}\n` +
        `📊 Skor: *${state.score.toLocaleString()}* | Giliran: *${state.moves}*\n\n` +
        `Blok tersisa: ${next}\n` +
        `*.bb cek [1/2/3]* — lihat posisi valid`;
    }

    if (cleared > 0 && clearedCells.length > 0) {
      await sendBlast(conn, m, state, clearedCells, caption);
    } else {
      const buf = await renderBoard(state);
      await send(conn, m, buf, caption);
    }
    return;
  }

  const state = getGame(db, sender);
  if (state && !state.gameOver) {
    const buf = await renderBoard(state);
    await send(conn, m, buf,
      `🎮 *BLOCK BLAST*\nSkor: *${state.score.toLocaleString()}*\n\n` +
      `*.bb cek 1* — posisi valid blok 1\n` +
      `*.bb [1/2/3] [kotak]* — taruh blok\n` +
      `*.bb info* — panduan`
    );
  } else {
    await m.reply(
      `🎮 *BLOCK BLAST*\n\n` +
      `*.bb new* — mulai game\n` +
      `*.bb info* — cara main\n` +
      `*.bb top* — high score`
    );
  }
}

export default { config: pluginConfig, handler };