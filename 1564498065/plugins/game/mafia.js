/**
 * ╔══════════════════════════════════════╗
 * ║     PLUGIN GAME MAFIA - WA BOT       ║
 * ║  Solo (vs Bot) & Multiplayer (Grup)  ║
 * ╚══════════════════════════════════════╝
 *
 * PERINTAH:
 *  .mafia          → Buat lobby / lihat status game
 *  .mafia join     → Gabung ke lobby (multiplayer)
 *  .mafia start    → Mulai game (host/owner)
 *  .mafia stop     → Hentikan game paksa
 *  .mafia solo     → Langsung main solo vs bot
 *  .mafia vote @x  → Vote eliminasi pemain (siang)
 *  .mafia kill @x  → Mafia memilih korban (malam, via DM)
 *  .mafia save @x  → Dokter menyelamatkan (malam, via DM)
 *  .mafia check @x → Detektif investigasi (malam, via DM)
 *  .mafia status   → Lihat status pemain saat ini
 */

const GAMES = new Map();

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 10;
const LOBBY_TIMEOUT = 3 * 60 * 1000;   
const NIGHT_TIMEOUT = 90 * 1000;        
const DAY_TIMEOUT   = 120 * 1000;

const ROLE_TABLE = {
  4:  { mafia: 1, detective: 1, doctor: 1, citizen: 1 },
  5:  { mafia: 1, detective: 1, doctor: 1, citizen: 2 },
  6:  { mafia: 2, detective: 1, doctor: 1, citizen: 2 },
  7:  { mafia: 2, detective: 1, doctor: 1, citizen: 3 },
  8:  { mafia: 2, detective: 1, doctor: 1, citizen: 4 },
  9:  { mafia: 3, detective: 1, doctor: 1, citizen: 4 },
  10: { mafia: 3, detective: 1, doctor: 1, citizen: 5 },
};

const ROLE_EMOJI = {
  mafia:    "🔪",
  detective:"🔍",
  doctor:   "💉",
  citizen:  "👤",
};

const ROLE_DESC = {
  mafia:    "Kamu adalah *Mafia* 🔪\nMalam ini kamu bisa membunuh satu warga.\nGunakan: `.mafia kill @nama`",
  detective:"Kamu adalah *Detektif* 🔍\nMalam ini kamu bisa investigasi satu pemain.\nGunakan: `.mafia check @nama`",
  doctor:   "Kamu adalah *Dokter* 💉\nMalam ini kamu bisa menyelamatkan satu pemain.\nGunakan: `.mafia save @nama`",
  citizen:  "Kamu adalah *Warga* 👤\nBertahan hidup dan bantu temukan Mafia!\nSaat siang: `.mafia vote @nama`",
};

const BOT_NAMES = ["Andi", "Budi", "Cici", "Dedi"];
const BOT_JID_PREFIX = "bot_";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getName(jid, game) {
  if (jid.startsWith(BOT_JID_PREFIX)) {
    return game.players[jid]?.name || jid;
  }
  return game.players[jid]?.name || jid.split("@")[0];
}

function isBot(jid) {
  return jid.startsWith(BOT_JID_PREFIX);
}

function getAlivePlayers(game) {
  return Object.entries(game.players)
    .filter(([, p]) => p.alive)
    .map(([jid]) => jid);
}

function getAliveByRole(game, role) {
  return Object.entries(game.players)
    .filter(([, p]) => p.alive && p.role === role)
    .map(([jid]) => jid);
}

function buildPlayerList(game) {
  const alive = [];
  const dead  = [];
  for (const [jid, p] of Object.entries(game.players)) {
    const isB = isBot(jid);
    const name = getName(jid, game);
    const tag  = isB ? `🤖 ${name}` : `👤 ${name}`;
    if (p.alive) alive.push(`┃  ✅ ${tag}`);
    else         dead.push(`┃  💀 ${tag} ─ ${ROLE_EMOJI[p.role]} ${p.role}`);
  }
  return { alive, dead };
}

function checkWinCondition(game) {
  const aliveMafia   = getAliveByRole(game, "mafia").length;
  const aliveGood    = getAlivePlayers(game).filter(j => game.players[j].role !== "mafia").length;

  if (aliveMafia === 0) return "citizen";
  if (aliveMafia >= aliveGood) return "mafia";
  return null;
}

async function sendDM(sock, jid, text) {
  if (isBot(jid)) return; 
  try {
    await sock.sendMessage(jid, { text });
  } catch (_) {}
}

function createGame(chatId, hostJid, hostName, isSolo = false) {
  return {
    chatId,
    hostJid,
    isSolo,
    phase: "lobby",       
    round: 0,
    players: {
      [hostJid]: { name: hostName, role: null, alive: true, voted: null }
    },
    nightActions: {},     
    votes: {},            
    lobbyTimer: null,
    phaseTimer: null,
    lastResult: null,
  };
}

function assignRoles(game) {
  const jids = Object.keys(game.players);
  const n = jids.length;
  const table = ROLE_TABLE[Math.min(n, 10)] || ROLE_TABLE[10];

  const roleList = [];
  for (const [role, count] of Object.entries(table)) {
    for (let i = 0; i < count; i++) roleList.push(role);
  }

  const shuffled = shuffle(roleList);
  const shuffledJids = shuffle(jids);

  shuffledJids.forEach((jid, i) => {
    game.players[jid].role = shuffled[i] || "citizen";
  });
}

function botNightAction(game) {
  const alivePlayers = getAlivePlayers(game);

  const botMafia = getAliveByRole(game, "mafia").filter(isBot);
  if (botMafia.length > 0 && !game.nightActions.mafia) {
    const targets = alivePlayers.filter(j => game.players[j].role !== "mafia");
    if (targets.length > 0) {
      game.nightActions.mafia = targets[Math.floor(Math.random() * targets.length)];
    }
  }

  const botDoctor = getAliveByRole(game, "doctor").filter(isBot);
  if (botDoctor.length > 0 && !game.nightActions.doctor) {
    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    game.nightActions.doctor = target;
  }

  const botDetective = getAliveByRole(game, "detective").filter(isBot);
  if (botDetective.length > 0 && !game.nightActions.detective) {
    const nonDetective = alivePlayers.filter(j => game.players[j].role !== "detective");
    if (nonDetective.length > 0) {
      game.nightActions.detective = nonDetective[Math.floor(Math.random() * nonDetective.length)];
    }
  }
}

function botDayVote(game) {
  const alivePlayers = getAlivePlayers(game);
  for (const jid of alivePlayers) {
    if (!isBot(jid)) continue;
    if (game.votes[jid]) continue;
    const targets = alivePlayers.filter(j => j !== jid);
    if (targets.length > 0) {
      game.votes[jid] = targets[Math.floor(Math.random() * targets.length)];
    }
  }
}

function resolveNight(game) {
  const killed   = game.nightActions.mafia   || null;
  const saved    = game.nightActions.doctor  || null;
  const checked  = game.nightActions.detective || null;
  const checkedRole = checked ? game.players[checked]?.role : null;

  let result = { killed: null, saved: false, checked, checkedRole };

  if (killed && killed !== saved) {
    game.players[killed].alive = false;
    result.killed = killed;
  } else if (killed && killed === saved) {
    result.saved = true;
  }

  game.nightActions = {};
  return result;
}

function resolveVote(game) {
  const tally = {};
  for (const target of Object.values(game.votes)) {
    tally[target] = (tally[target] || 0) + 1;
  }

  let maxVote = 0;
  let eliminated = null;

  for (const [jid, count] of Object.entries(tally)) {
    if (count > maxVote) { maxVote = count; eliminated = jid; }
  }

  const topCount = Object.values(tally).filter(c => c === maxVote).length;
  if (topCount > 1) eliminated = null;

  if (eliminated) game.players[eliminated].alive = false;

  game.votes = {};
  return { eliminated, tally };
}

const pluginConfig = {
  name: "mafia",
  alias: ["mafiaGame", "mafgame"],
  category: "game",
  description: "Game Mafia seru! Solo vs bot atau multiplayer di grup (min 4 orang)",
  usage: ".mafia [join|start|stop|solo|vote|kill|save|check|status]",
  example: ".mafia solo | .mafia join | .mafia vote @pemain",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
  skipRegistration: false,
};

async function handler(m, { sock, args }) {
  const sub     = (args[0] || "").toLowerCase().trim();
  const chatId  = m.chat;
  const senderJid = m.sender;
  const senderName = m.pushName || senderJid.split("@")[0];

  const game = GAMES.get(chatId);

  if (sub === "solo") {
    if (game && game.phase !== "ended") {
      return m.reply(`⚠️ Sudah ada game aktif di chat ini!\nGunakan \`.mafia stop\` untuk menghentikannya.`);
    }

    const newGame = createGame(chatId, senderJid, senderName, true);
    GAMES.set(chatId, newGame);

    BOT_NAMES.forEach((name, i) => {
      const botJid = `${BOT_JID_PREFIX}${i}`;
      newGame.players[botJid] = { name, role: null, alive: true, voted: null };
    });

    await m.reply(
      `🎮 *ɢᴀᴍᴇ ᴍᴀꜰɪᴀ - sᴏʟᴏ ᴍᴏᴅᴇ*\n\n` +
      `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ* 」\n` +
      `┃  🧑 ${senderName} (Kamu)\n` +
      BOT_NAMES.map(n => `┃  🤖 ${n} (Bot)`).join("\n") + "\n" +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Memulai game dalam 3 detik...`
    );

    await sleep(3000);
    await startGame(newGame, sock, m);
    return;
  }

  if (!sub || sub === "buat" || sub === "create" || sub === "new") {
    if (game && game.phase !== "ended") {
      return m.reply(
        `⚠️ Sudah ada game aktif!\n\n` +
        `Gunakan \`.mafia join\` untuk bergabung\n` +
        `atau \`.mafia status\` untuk lihat kondisi game.`
      );
    }

    const newGame = createGame(chatId, senderJid, senderName, false);
    GAMES.set(chatId, newGame);

    newGame.lobbyTimer = setTimeout(async () => {
      const g = GAMES.get(chatId);
      if (!g || g.phase !== "lobby") return;
      const count = Object.keys(g.players).length;
      if (count < MIN_PLAYERS) {
        GAMES.delete(chatId);
        await sock.sendMessage(chatId, {
          text: `⏰ *Lobby ditutup otomatis*\n\nTidak cukup pemain (${count}/${MIN_PLAYERS}).\nGame dibatalkan.`
        });
      } else {
        await startGame(g, sock, m);
      }
    }, LOBBY_TIMEOUT);

    await m.reply(
      `🃏 *ʟᴏʙʙʏ ɢᴀᴍᴇ ᴍᴀꜰɪᴀ*\n\n` +
      `╭┈┈⬡「 📋 *ɪɴꜰᴏ* 」\n` +
      `┃ 🎯 Host   : *${senderName}*\n` +
      `┃ 👥 Pemain : *1/${MAX_PLAYERS}*\n` +
      `┃ ⏳ Timeout: *3 menit*\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `╭┈┈⬡「 📌 *ᴘᴇʀɪɴᴛᴀʜ* 」\n` +
      `┃ Gabung  : \`.mafia join\`\n` +
      `┃ Mulai   : \`.mafia start\` (host)\n` +
      `┃ Batal   : \`.mafia stop\` (host)\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Min ${MIN_PLAYERS} pemain untuk memulai!`
    );
    return;
  }

  if (sub === "join" || sub === "gabung") {
    if (!game || game.phase === "ended") {
      return m.reply(`❌ Tidak ada lobby aktif!\nBuat lobby baru: \`.mafia\``);
    }
    if (game.phase !== "lobby") {
      return m.reply(`❌ Game sudah berjalan! Tunggu ronde berikutnya.`);
    }
    if (game.players[senderJid]) {
      return m.reply(`⚠️ Kamu sudah ada di lobby!`);
    }
    if (Object.keys(game.players).length >= MAX_PLAYERS) {
      return m.reply(`❌ Lobby penuh! (${MAX_PLAYERS}/${MAX_PLAYERS})`);
    }

    game.players[senderJid] = { name: senderName, role: null, alive: true, voted: null };
    const count = Object.keys(game.players).length;

    await m.reply(
      `✅ *${senderName}* bergabung ke lobby!\n\n` +
      `👥 Pemain: *${count}/${MAX_PLAYERS}*\n` +
      (count >= MIN_PLAYERS
        ? `> Host bisa ketik \`.mafia start\` untuk memulai!`
        : `> Butuh ${MIN_PLAYERS - count} pemain lagi`)
    );
    return;
  }

  if (sub === "start" || sub === "mulai") {
    if (!game || game.phase === "ended") {
      return m.reply(`❌ Tidak ada lobby aktif! Buat dulu: \`.mafia\``);
    }
    if (game.phase !== "lobby") {
      return m.reply(`⚠️ Game sudah berjalan!`);
    }
    if (senderJid !== game.hostJid) {
      return m.reply(`❌ Hanya *host* yang bisa memulai game!`);
    }

    const count = Object.keys(game.players).length;
    if (count < MIN_PLAYERS) {
      return m.reply(`❌ Pemain kurang! Butuh min *${MIN_PLAYERS}* orang. (Sekarang: ${count})`);
    }

    clearTimeout(game.lobbyTimer);
    await startGame(game, sock, m);
    return;
  }

  if (sub === "stop" || sub === "batal" || sub === "end") {
    if (!game || game.phase === "ended") {
      return m.reply(`❌ Tidak ada game aktif!`);
    }
    if (senderJid !== game.hostJid) {
      return m.reply(`❌ Hanya *host* yang bisa menghentikan game!`);
    }

    clearTimeout(game.lobbyTimer);
    clearTimeout(game.phaseTimer);
    game.phase = "ended";
    GAMES.delete(chatId);

    await m.reply(
      `🛑 *Game Mafia dihentikan!*\n\n` +
      `> Dihentikan oleh host: *${senderName}*`
    );
    return;
  }

  if (sub === "status" || sub === "info") {
    if (!game || game.phase === "ended") {
      return m.reply(`❌ Tidak ada game aktif di chat ini.\nMulai dengan: \`.mafia\` atau \`.mafia solo\``);
    }

    const { alive, dead } = buildPlayerList(game);
    const phaseText = game.phase === "lobby" ? "⏳ Lobby" :
                      game.phase === "night"  ? "🌙 Malam" :
                      game.phase === "day"    ? "☀️ Siang" : "-";

    await m.reply(
      `🃏 *sTᴀᴛᴜs ɢᴀᴍᴇ ᴍᴀꜰɪᴀ*\n\n` +
      `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
      `┃ 🎯 Fase   : *${phaseText}*\n` +
      `┃ 🔄 Ronde  : *${game.round}*\n` +
      `┃ 👥 Hidup  : *${alive.length}*\n` +
      `┃ 💀 Mati   : *${dead.length}*\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `╭┈┈⬡「 ✅ *ᴍᴀsɪʜ ʜɪᴅᴜᴘ* 」\n` +
      (alive.length ? alive.join("\n") : "┃  (kosong)") + "\n" +
      `╰┈┈┈┈┈┈┈┈⬡` +
      (dead.length
        ? `\n\n╭┈┈⬡「 💀 *sᴜᴅᴀʜ ᴍᴀᴛɪ* 」\n` + dead.join("\n") + "\n╰┈┈┈┈┈┈┈┈⬡"
        : "")
    );
    return;
  }

  if (sub === "vote" || sub === "pilih") {
    if (!game || game.phase !== "day") {
      return m.reply(`❌ Voting hanya bisa dilakukan saat *fase siang*!`);
    }
    if (!game.players[senderJid] || !game.players[senderJid].alive) {
      return m.reply(`❌ Kamu tidak bisa vote (sudah mati atau bukan pemain).`);
    }
    if (game.votes[senderJid]) {
      return m.reply(`⚠️ Kamu sudah vote *${getName(game.votes[senderJid], game)}*!`);
    }

    const mentioned = m.mentionedJid?.[0] || args[1]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const targetJid = mentioned;

    if (!targetJid || !game.players[targetJid]) {
      return m.reply(`❌ Pemain tidak ditemukan! Tag pemain yang valid.\nContoh: \`.mafia vote @pemain\``);
    }
    if (!game.players[targetJid].alive) {
      return m.reply(`❌ *${getName(targetJid, game)}* sudah mati!`);
    }
    if (targetJid === senderJid) {
      return m.reply(`❌ Tidak bisa vote diri sendiri!`);
    }

    game.votes[senderJid] = targetJid;

    const totalAlive = getAlivePlayers(game).length;
    const totalVoted = Object.keys(game.votes).length;

    await m.reply(
      `🗳️ *${senderName}* vote untuk *${getName(targetJid, game)}*!\n\n` +
      `┃ Vote masuk: *${totalVoted}/${totalAlive}*`
    );

    botDayVote(game);

    const allVoted = getAlivePlayers(game).every(j => game.votes[j]);
    if (allVoted) {
      clearTimeout(game.phaseTimer);
      await resolveDayPhase(game, sock, chatId);
    }
    return;
  }

  if (sub === "kill" || sub === "bunuh") {
    if (!game || game.phase !== "night") {
      return m.reply(`❌ Aksi ini hanya bisa dilakukan saat *malam hari*!`);
    }
    const player = game.players[senderJid];
    if (!player || !player.alive) return m.reply(`❌ Kamu bukan pemain aktif!`);
    if (player.role !== "mafia")  return m.reply(`❌ Hanya *Mafia* yang bisa melakukan ini!`);
    if (game.nightActions.mafia)  return m.reply(`⚠️ Mafia sudah memilih target malam ini!`);

    const mentioned = m.mentionedJid?.[0] || args[1]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const targetJid = mentioned;

    if (!targetJid || !game.players[targetJid]) {
      return m.reply(`❌ Target tidak ditemukan! Gunakan: \`.mafia kill @nama\``);
    }
    if (!game.players[targetJid].alive)  return m.reply(`❌ Target sudah mati!`);
    if (targetJid === senderJid)         return m.reply(`❌ Tidak bisa membunuh diri sendiri!`);
    if (game.players[targetJid].role === "mafia") return m.reply(`❌ Tidak bisa membunuh sesama Mafia!`);

    game.nightActions.mafia = targetJid;
    await sendDM(sock, senderJid, `🔪 Kamu memilih *${getName(targetJid, game)}* sebagai target malam ini!`);
    await m.reply(`✅ Target dipilih! Tunggu subuh...`);

    await checkNightComplete(game, sock, chatId);
    return;
  }

  if (sub === "save" || sub === "selamatkan") {
    if (!game || game.phase !== "night") {
      return m.reply(`❌ Aksi ini hanya bisa dilakukan saat *malam hari*!`);
    }
    const player = game.players[senderJid];
    if (!player || !player.alive)  return m.reply(`❌ Kamu bukan pemain aktif!`);
    if (player.role !== "doctor")  return m.reply(`❌ Hanya *Dokter* yang bisa melakukan ini!`);
    if (game.nightActions.doctor)  return m.reply(`⚠️ Dokter sudah memilih target malam ini!`);

    const mentioned = m.mentionedJid?.[0] || args[1]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const targetJid = mentioned;

    if (!targetJid || !game.players[targetJid]) {
      return m.reply(`❌ Target tidak ditemukan! Gunakan: \`.mafia save @nama\``);
    }
    if (!game.players[targetJid].alive) return m.reply(`❌ Target sudah mati!`);

    game.nightActions.doctor = targetJid;
    await sendDM(sock, senderJid, `💉 Kamu memilih menyelamatkan *${getName(targetJid, game)}* malam ini!`);
    await m.reply(`✅ Pilihan tersimpan! Tunggu subuh...`);

    await checkNightComplete(game, sock, chatId);
    return;
  }

  if (sub === "check" || sub === "selidiki") {
    if (!game || game.phase !== "night") {
      return m.reply(`❌ Aksi ini hanya bisa dilakukan saat *malam hari*!`);
    }
    const player = game.players[senderJid];
    if (!player || !player.alive)      return m.reply(`❌ Kamu bukan pemain aktif!`);
    if (player.role !== "detective")   return m.reply(`❌ Hanya *Detektif* yang bisa melakukan ini!`);
    if (game.nightActions.detective)   return m.reply(`⚠️ Detektif sudah melakukan investigasi malam ini!`);

    const mentioned = m.mentionedJid?.[0] || args[1]?.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const targetJid = mentioned;

    if (!targetJid || !game.players[targetJid]) {
      return m.reply(`❌ Target tidak ditemukan! Gunakan: \`.mafia check @nama\``);
    }
    if (!game.players[targetJid].alive) return m.reply(`❌ Target sudah mati!`);
    if (targetJid === senderJid)        return m.reply(`❌ Tidak bisa menyelidiki diri sendiri!`);

    game.nightActions.detective = targetJid;
    const targetRole = game.players[targetJid].role;
    const isMafia    = targetRole === "mafia";

    await sendDM(sock, senderJid,
      `🔍 *Hasil Investigasi*\n\n` +
      `Pemain: *${getName(targetJid, game)}*\n` +
      `Status: ${isMafia ? "🔴 *MAFIA!* Dia adalah anggota Mafia!" : "🟢 *BUKAN Mafia.* Dia warga biasa."}`
    );
    await m.reply(`✅ Investigasi selesai! Cek DM/PM kamu untuk hasilnya.`);

    await checkNightComplete(game, sock, chatId);
    return;
  }

  await m.reply(
    `🃏 *ɢᴀᴍᴇ ᴍᴀꜰɪᴀ*\n\n` +
    `╭┈┈⬡「 📌 *ᴘᴇʀɪɴᴛᴀʜ* 」\n` +
    `┃ 🎮 Solo      : \`.mafia solo\`\n` +
    `┃ 🏠 Buat Lobby: \`.mafia\`\n` +
    `┃ 🚪 Gabung    : \`.mafia join\`\n` +
    `┃ ▶️ Mulai     : \`.mafia start\`\n` +
    `┃ 🛑 Stop      : \`.mafia stop\`\n` +
    `┃ 📊 Status    : \`.mafia status\`\n` +
    `┃ 🗳️ Vote      : \`.mafia vote @x\`\n` +
    `┃ 🔪 Kill      : \`.mafia kill @x\` (Mafia)\n` +
    `┃ 💉 Save      : \`.mafia save @x\` (Dokter)\n` +
    `┃ 🔍 Check     : \`.mafia check @x\` (Detektif)\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `╭┈┈⬡「 👥 *ᴘᴇʀᴀɴ* 」\n` +
    `┃ 🔪 Mafia     : Bunuh warga tiap malam\n` +
    `┃ 🔍 Detektif  : Selidiki 1 pemain per malam\n` +
    `┃ 💉 Dokter    : Selamatkan 1 pemain per malam\n` +
    `┃ 👤 Warga     : Temukan & eliminasi Mafia!\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `> Min *${MIN_PLAYERS}* pemain · Max *${MAX_PLAYERS}* pemain`
  );
}

async function startGame(game, sock, m) {
  assignRoles(game);
  game.phase = "night";
  game.round = 1;

  const chatId = game.chatId;

  await sock.sendMessage(chatId, {
    text:
      `🎉 *ɢᴀᴍᴇ ᴍᴀꜰɪᴀ ᴅɪᴍᴜʟᴀɪ!*\n\n` +
      `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ (${Object.keys(game.players).length})* 」\n` +
      Object.values(game.players).map(p =>
        `┃  ${isBot(Object.entries(game.players).find(([,v])=>v===p)?.[0] || "") ? "🤖" : "👤"} ${p.name}`
      ).join("\n") + "\n" +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Peran sudah dibagikan lewat DM/PM!\n> Malam pertama dimulai... 🌙`
  });

  await sleep(1500);

  for (const [jid, p] of Object.entries(game.players)) {
    if (isBot(jid)) continue;
    await sendDM(sock, jid,
      `🃏 *ᴘᴇʀᴀɴᴍᴜ ᴅɪ ɢᴀᴍᴇ ᴍᴀꜰɪᴀ*\n\n` +
      `${ROLE_EMOJI[p.role]} ${ROLE_DESC[p.role]}\n\n` +
      `> Jangan beritahu peranmu ke siapapun! 🤫`
    );
  }

  await startNightPhase(game, sock, chatId);
}

async function startNightPhase(game, sock, chatId) {
  game.phase = "night";
  game.nightActions = {};

  await sock.sendMessage(chatId, {
    text:
      `🌙 *ᴍᴀʟᴀᴍ ʜᴀʀɪ - ʀᴏɴᴅᴇ ${game.round}*\n\n` +
      `╭┈┈⬡「 🌑 *ᴀᴋsɪ ᴍᴀʟᴀᴍ* 」\n` +
      `┃ 🔪 Mafia    → \`.mafia kill @x\`\n` +
      `┃ 💉 Dokter   → \`.mafia save @x\`\n` +
      `┃ 🔍 Detektif → \`.mafia check @x\`\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `⏳ Waktu: *${NIGHT_TIMEOUT / 1000} detik*\n` +
      `> Semua aksi dikirim lewat chat ini atau DM!`
  });

  botNightAction(game);

  clearTimeout(game.phaseTimer);
  game.phaseTimer = setTimeout(async () => {
    const g = GAMES.get(chatId);
    if (!g || g.phase !== "night") return;
    
    botNightAction(g);
    await resolveDayPhase(g, sock, chatId, true);
  }, NIGHT_TIMEOUT);

  await checkNightComplete(game, sock, chatId);
}

async function checkNightComplete(game, sock, chatId) {
  const aliveMafia    = getAliveByRole(game, "mafia");
  const aliveDoctor   = getAliveByRole(game, "doctor");
  const aliveDetective = getAliveByRole(game, "detective");

  const mafiaReal    = aliveMafia.filter(j => !isBot(j));
  const doctorReal   = aliveDoctor.filter(j => !isBot(j));
  const detectiveReal = aliveDetective.filter(j => !isBot(j));

  const mafiaOk    = game.nightActions.mafia    || aliveMafia.length === 0;
  const doctorOk   = game.nightActions.doctor   || aliveDoctor.length === 0;
  const detectiveOk = game.nightActions.detective || aliveDetective.length === 0;

  const needMafia    = !game.nightActions.mafia    && mafiaReal.length > 0;
  const needDoctor   = !game.nightActions.doctor   && doctorReal.length > 0;
  const needDetective = !game.nightActions.detective && detectiveReal.length > 0;

  if (!needMafia && !needDoctor && !needDetective) {
    clearTimeout(game.phaseTimer);
    await sleep(1000);
    await resolveNightAndStartDay(game, sock, chatId);
  }
}

async function resolveNightAndStartDay(game, sock, chatId) {
  
  botNightAction(game);

  const result = resolveNight(game);

  let nightReport = `🌅 *sᴜʙᴜʜ ᴛɪʙᴀ - ʀᴏɴᴅᴇ ${game.round}*\n\n`;
  nightReport += `╭┈┈⬡「 🌙 *ʜᴀsɪʟ ᴍᴀʟᴀᴍ* 」\n`;

  if (result.killed) {
    const killedName = getName(result.killed, game);
    const killedRole = game.players[result.killed]?.role;
    nightReport += `┃ 💀 *${killedName}* dibunuh Mafia!\n`;
    nightReport += `┃ 🔖 Perannya: ${ROLE_EMOJI[killedRole]} *${killedRole}*\n`;
  } else if (result.saved) {
    nightReport += `┃ 💉 Seseorang diselamatkan Dokter!\n`;
    nightReport += `┃ 🌙 Tidak ada korban malam ini!\n`;
  } else {
    nightReport += `┃ 🌙 Tidak ada korban malam ini!\n`;
  }
  nightReport += `╰┈┈┈┈┈┈┈┈⬡`;

  await sock.sendMessage(chatId, { text: nightReport });

  const winner = checkWinCondition(game);
  if (winner) {
    await endGame(game, sock, chatId, winner);
    return;
  }

  await sleep(2000);
  await startDayPhase(game, sock, chatId);
}

async function startDayPhase(game, sock, chatId) {
  game.phase = "day";
  game.votes  = {};

  const { alive } = buildPlayerList(game);
  const alivePlayers = getAlivePlayers(game);

  let playerList = alivePlayers.map((jid, i) => {
    const name = getName(jid, game);
    const tag  = isBot(jid) ? `🤖 ${name}` : `👤 ${name}`;
    return `┃ ${i + 1}. ${tag}`;
  }).join("\n");

  await sock.sendMessage(chatId, {
    text:
      `☀️ *ꜰᴀsᴇ sɪᴀɴɢ - ʀᴏɴᴅᴇ ${game.round}*\n\n` +
      `Diskusikan siapa yang mencurigakan!\n` +
      `Lalu vote untuk eliminasi.\n\n` +
      `╭┈┈⬡「 👥 *ᴘᴇᴍᴀɪɴ ʜɪᴅᴜᴘ* 」\n` +
      playerList + "\n" +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `🗳️ Vote: \`.mafia vote @nama\`\n` +
      `⏳ Waktu: *${DAY_TIMEOUT / 1000} detik*`
  });

  await sleep(3000);
  botDayVote(game);

  clearTimeout(game.phaseTimer);
  game.phaseTimer = setTimeout(async () => {
    const g = GAMES.get(chatId);
    if (!g || g.phase !== "day") return;
    botDayVote(g); 
    await resolveDayPhase(g, sock, chatId, true);
  }, DAY_TIMEOUT);

  await checkDayComplete(game, sock, chatId);
}

async function checkDayComplete(game, sock, chatId) {
  const alivePlayers = getAlivePlayers(game);
  const allVoted     = alivePlayers.every(j => game.votes[j]);
  if (allVoted) {
    clearTimeout(game.phaseTimer);
    await resolveDayPhase(game, sock, chatId);
  }
}

async function resolveDayPhase(game, sock, chatId, timeout = false) {
  botDayVote(game); 
  const { eliminated, tally } = resolveVote(game);

  let tallyText = Object.entries(tally)
    .sort(([,a],[,b]) => b - a)
    .map(([jid, count]) => `┃ ${getName(jid, game)}: ${count} vote`)
    .join("\n");

  let dayReport = `🗳️ *ʜᴀsɪʟ ᴠᴏᴛɪɴɢ - ʀᴏɴᴅᴇ ${game.round}*\n\n`;
  dayReport += `╭┈┈⬡「 📊 *ʀᴇᴋᴀᴘ ᴠᴏᴛᴇ* 」\n`;
  dayReport += tallyText + "\n";
  dayReport += `╰┈┈┈┈┈┈┈┈⬡\n\n`;

  if (eliminated) {
    const elimName = getName(eliminated, game);
    const elimRole = game.players[eliminated]?.role;
    dayReport += `╭┈┈⬡「 💀 *ᴇʟɪᴍɪɴᴀsɪ* 」\n`;
    dayReport += `┃ *${elimName}* dieliminasi warga!\n`;
    dayReport += `┃ Perannya: ${ROLE_EMOJI[elimRole]} *${elimRole}*\n`;
    dayReport += `╰┈┈┈┈┈┈┈┈⬡`;
    if (timeout) dayReport += "\n\n> ⏰ Waktu habis! Pemain dengan vote terbanyak dieliminasi.";
  } else {
    dayReport += `╭┈┈⬡「 🤝 *sᴇʀɪ* 」\n`;
    dayReport += `┃ Vote seri! Tidak ada yang dieliminasi.\n`;
    dayReport += `╰┈┈┈┈┈┈┈┈⬡`;
  }

  await sock.sendMessage(chatId, { text: dayReport });

  const winner = checkWinCondition(game);
  if (winner) {
    await sleep(1500);
    await endGame(game, sock, chatId, winner);
    return;
  }

  game.round++;
  await sleep(3000);
  await startNightPhase(game, sock, chatId);
}

async function endGame(game, sock, chatId, winner) {
  game.phase = "ended";
  clearTimeout(game.phaseTimer);

  const { alive, dead } = buildPlayerList(game);

  const winnerText = winner === "mafia"
    ? "🔪 *ᴍᴀꜰɪᴀ ᴍᴇɴᴀɴɢ!*\n\nMafia berhasil menguasai kota!"
    : "🏙️ *ᴡᴀʀɢᴀ ᴍᴇɴᴀɴɢ!*\n\nSemua Mafia berhasil ditemukan & dieliminasi!";

  const reveal = Object.entries(game.players)
    .map(([jid, p]) => `┃ ${ROLE_EMOJI[p.role]} ${getName(jid, game)} → *${p.role}*`)
    .join("\n");

  await sock.sendMessage(chatId, {
    text:
      `🎊 *ɢᴀᴍᴇ sᴇʟᴇsᴀɪ!*\n\n` +
      winnerText + "\n\n" +
      `╭┈┈⬡「 📋 *ʀᴇᴠᴇᴀʟ sᴇᴍᴜᴀ ᴘᴇʀᴀɴ* 」\n` +
      reveal + "\n" +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `╭┈┈⬡「 📊 *sᴛᴀᴛɪsᴛɪᴋ* 」\n` +
      `┃ 🔄 Total Ronde : *${game.round}*\n` +
      `┃ ✅ Selamat     : *${alive.length} pemain*\n` +
      `┃ 💀 Gugur       : *${dead.length} pemain*\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Mainkan lagi: \`.mafia\` atau \`.mafia solo\``
  });

  GAMES.delete(chatId);
}

export { pluginConfig as config, handler };
