import { getDatabase } from '../../src/lib/ichigo-database.js'
import { parseMention, delay } from '../../src/lib/ichigo-utils.js'

const pluginConfig = {
  name: "tictactoe",
  alias: ["ttt", "xo"],
  category: "game",
  description: "Main TicTacToe dengan player lain",
  usage: ".tictactoe [room name] atau .ttt",
  example: ".tictactoe",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const boardSymbols = {
  X: "❌",
  O: "⭕",
  1: "1️⃣", 2: "2️⃣", 3: "3️⃣",
  4: "4️⃣", 5: "5️⃣", 6: "6️⃣",
  7: "7️⃣", 8: "8️⃣", 9: "9️⃣",
};

class TicTacToe {
  constructor(playerX = "x", playerO = "o") {
    this.playerX = playerX;
    this.playerO = playerO;
    this._currentTurn = false;
    this._x = 0;
    this._o = 0;
    this.turns = 0;
  }

  get board() { return this._x | this._o; }
  get currentTurn() { return this._currentTurn ? this.playerO : this.playerX; }
  get enemyTurn() { return this._currentTurn ? this.playerX : this.playerO; }

  static check(state) {
    for (let combo of [7, 56, 73, 84, 146, 273, 292, 448])
      if ((state & combo) === combo) return true;
    return false;
  }

  static toBinary(x = 0, y = 0) {
    if (x < 0 || x > 2 || y < 0 || y > 2) throw new Error("invalid position");
    return 1 << (x + 3 * y);
  }

  turn(player = 0, x = 0, y) {
    if (this.board === 511) return -3;
    let pos = 0;
    if (y == null) {
      if (x < 0 || x > 8) return -1;
      pos = 1 << x;
    } else {
      if (x < 0 || x > 2 || y < 0 || y > 2) return -1;
      pos = TicTacToe.toBinary(x, y);
    }
    if (this._currentTurn ^ player) return -2;
    if (this.board & pos) return 0;
    this[this._currentTurn ? "_o" : "_x"] |= pos;
    this._currentTurn = !this._currentTurn;
    this.turns++;
    return 1;
  }

  static render(boardX = 0, boardO = 0) {
    let x = parseInt(boardX.toString(2), 4);
    let y = parseInt(boardO.toString(2), 4) * 2;
    return [...(x + y).toString(4).padStart(9, "0")]
      .reverse()
      .map((value, index) => (value == 1 ? "X" : value == 2 ? "O" : ++index));
  }

  render() { return TicTacToe.render(this._x, this._o); }

  get winner() {
    let x = TicTacToe.check(this._x);
    let o = TicTacToe.check(this._o);
    return x ? this.playerX : o ? this.playerO : false;
  }
}

if (!global.tictactoeGames) global.tictactoeGames = {};
if (!global.tictactoeLocks) global.tictactoeLocks = new Set();

function isRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("rate-overlimit") || message.includes("rate overlimit") ||
    message.includes("ratelimit") || message.includes("rate limit");
}

function normalizeMentions(text, extraMentions = []) {
  const mentionRegex = /@(\d+)/g;
  const parsed = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    parsed.push(`${match[1]}@s.whatsapp.net`);
  }
  const all = [...parsed, ...(extraMentions || [])].filter(Boolean);
  return [...new Set(all)];
}

async function sendWithRetry(action) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === 2) throw error;
      await delay(1200 * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

async function safeReply(m, text, options = {}) {
  const mentions = normalizeMentions(text, options.mentions || []);
  const replyOptions = { ...options, mentions };
  try {
    return await sendWithRetry(() => m.reply(text, replyOptions));
  } catch (error) {
    if (isRateLimitError(error)) return null;
    throw error;
  }
}

async function safeReact(m, emoji) {
  try {
    await sendWithRetry(() => m.react(emoji));
  } catch (error) {}
}

async function animateBoard(sock, chat, msgKey, game, highlightPos = null) {
  const frames = ["⬜", "🔲", "⬛"];

  for (const frame of frames) {
    const animBoard = renderBoard(game.render(), highlightPos, frame);
    try {
      await sock.sendMessage(chat, {
        text: animBoard,
        edit: msgKey,
      });
    } catch {}
    await delay(300);
  }

  const finalBoard = renderBoard(game.render(), highlightPos);
  try {
    await sock.sendMessage(chat, {
      text: finalBoard,
      edit: msgKey,
    });
  } catch {}
}

function renderBoard(arr, highlightPos = null, animFrame = null) {
  const cells = arr.map((cell, index) => {
    if (animFrame && index === highlightPos) return animFrame;
    return boardSymbols[String(cell)] || cell;
  });
  return `┌───┬───┬───┐\n│ ${cells[0]} │ ${cells[1]} │ ${cells[2]} │\n├───┼───┼───┤\n│ ${cells[3]} │ ${cells[4]} │ ${cells[5]} │\n├───┼───┼───┤\n│ ${cells[6]} │ ${cells[7]} │ ${cells[8]} │\n└───┴───┴───┘`;
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const args = m.args || [];
  const roomName = args.join(" ").trim();

  const existingRoom = Object.values(global.tictactoeGames).find(
    (room) =>
      room.id.startsWith("ttt_") &&
      [room.game.playerX, room.game.playerO].filter(Boolean).includes(m.sender),
  );

  if (existingRoom) {
    return safeReply(m,
      `❌ Kamu masih dalam game!\n\n` +
      `> Selesaikan game atau ketik *nyerah* untuk menyerah.`
    );
  }

  let room = Object.values(global.tictactoeGames).find(
    (r) => r.state === "WAITING" && r.chat === m.chat &&
      (roomName ? r.name === roomName : true),
  );

  if (room) {
    
    room.game.playerO = m.sender;
    room.state = "PLAYING";

    const board = renderBoard(room.game.render());
    const txt =
      `🎮 *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ*\n\n` +
      `Partner ditemukan!\n\n` +
      `❌ @${room.game.playerX.split("@")[0]}\n` +
      `⭕ @${room.game.playerO.split("@")[0]}\n\n` +
      `${board}\n\n` +
      `> Giliran: @${room.game.currentTurn.split("@")[0]}\n` +
      `> Reply pesan ini dengan angka 1-9\n` +
      `> Ketik *nyerah* untuk menyerah`;

    await safeReact(m, "🎮");
    const sent = await safeReply(m, txt, {
      mentions: [room.game.playerX, room.game.playerO],
    });

    if (sent?.key) room.boardMsgKey = sent.key;

  } else {
    
    const roomId = "ttt_" + Date.now();

    global.tictactoeGames[roomId] = {
      id: roomId,
      chat: m.chat,
      name: roomName || null,
      game: new TicTacToe(m.sender, null),
      state: "WAITING",
      createdAt: Date.now(),
      boardMsgKey: null,
    };

    await safeReact(m, "🕕");
    await safeReply(m,
      `🎮 *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ*\n\n` +
      `Room dibuat! Menunggu partner...\n\n` +
      `> Ketik \`.tictactoe${roomName ? " " + roomName : ""}\` untuk join\n` +
      `> Room expired dalam 5 menit`
    );

    setTimeout(() => {
      if (global.tictactoeGames[roomId]?.state === "WAITING") {
        delete global.tictactoeGames[roomId];
      }
    }, 300000);
  }
}

async function answerHandler(m, sock) {
  if (!m.body) return false;

  const text = m.body.trim().toLowerCase();

  const room = Object.values(global.tictactoeGames).find(
    (r) =>
      r.state === "PLAYING" &&
      r.chat === m.chat &&
      [r.game.playerX, r.game.playerO].filter(Boolean).includes(m.sender),
  );

  if (!room) return false;

  const db = getDatabase();

  if (["nyerah", "surrender", "give up"].includes(text)) {
    const winner = m.sender === room.game.playerX ? room.game.playerO : room.game.playerX;
    const loser = m.sender;

    const winnerData = db.getUser(winner) || {};
    winnerData.koin = (winnerData.koin || 0) + 500;
    db.setUser(winner, winnerData);

    await safeReact(m, "🏳️");
    await safeReply(m,
      `🏳️ *MENYERAH!*\n\n` +
      `@${loser.split("@")[0]} menyerah!\n` +
      `@${winner.split("@")[0]} menang! +Rp 500`,
      { mentions: [winner, loser] }
    );

    delete global.tictactoeGames[room.id];
    return true;
  }

  const move = parseInt(text);
  if (isNaN(move) || move < 1 || move > 9) return false;

  if (global.tictactoeLocks.has(room.id)) {
    await safeReply(m, "⏳ Tunggu sebentar...");
    return true;
  }
  global.tictactoeLocks.add(room.id);

  try {

  if (room.game.currentTurn !== m.sender) {
    global.tictactoeLocks.delete(room.id);
    await safeReply(m, "❌ Bukan giliranmu!");
    return true;
  }

  const player = room.game.playerX === m.sender ? 0 : 1;
  const result = room.game.turn(player, move - 1);

  if (result === 0) {
    global.tictactoeLocks.delete(room.id);
    await safeReply(m, "❌ Posisi sudah terisi!");
    return true;
  }
  if (result === -1) {
    global.tictactoeLocks.delete(room.id);
    await safeReply(m, "❌ Posisi tidak valid!");
    return true;
  }

  const highlightPos = move - 1;
  const winner = room.game.winner;
  const isTie = room.game.board === 511 && !winner;

  const boardFinal = renderBoard(room.game.render());
  const sent = await safeReply(m,
    `🎮 *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ*\n\n${boardFinal}`,
    { mentions: [room.game.playerX, room.game.playerO] }
  );

  const reactFrames = ["🔲", "⬛", "✅"];
  for (const emoji of reactFrames) {
    try { await m.react(emoji); } catch {}
    await delay(300);
  }

  await delay(400);

  if (winner) {
    const loser = winner === room.game.playerX ? room.game.playerO : room.game.playerX;

    const winnerData = db.getUser(winner) || {};
    winnerData.koin = (winnerData.koin || 0) + 1000;
    db.setUser(winner, winnerData);

    await safeReact(m, "🎉");
    await safeReply(m,
      `🎉 *GAME OVER!*\n\n` +
      `${renderBoard(room.game.render())}\n\n` +
      `🏆 @${winner.split("@")[0]} menang! +Rp 1.000`,
      { mentions: [winner, loser] }
    );

    global.tictactoeLocks.delete(room.id);
    delete global.tictactoeGames[room.id];
    return true;
  }

  if (isTie) {
    await safeReact(m, "🤝");
    await safeReply(m,
      `🤝 *SERI!*\n\n` +
      `${renderBoard(room.game.render())}\n\n` +
      `> Tidak ada pemenang!`,
      { mentions: [room.game.playerX, room.game.playerO] }
    );

    global.tictactoeLocks.delete(room.id);
    delete global.tictactoeGames[room.id];
    return true;
  }

  await safeReply(m,
    `🎮 *ᴛɪᴄ ᴛᴀᴄ ᴛᴏᴇ*\n\n${renderBoard(room.game.render())}\n\n> Giliran: @${room.game.currentTurn.split("@")[0]}`,
    { mentions: [room.game.currentTurn] }
  );

  } finally {
    global.tictactoeLocks.delete(room.id);
  }

  return true;
}

export { pluginConfig as config, handler, answerHandler }