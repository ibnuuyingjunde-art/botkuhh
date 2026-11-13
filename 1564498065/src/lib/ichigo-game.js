import { getAssetBuffer } from "./ichigo-asset-manager.js";
import {
  getRandomItem,
  createSession,
  getSession,
  endSession,
  checkAnswerAdvanced,
  getHint,
  hasActiveSession,
  setSessionTimer,
  getRemainingTime,
  formatRemainingTime,
  isSurrender,
  isReplyToGame,
  getRandomReward,
  getProgressiveHint,
} from "./ichigo-game-data.js";
import { getDatabase } from "./ichigo-database.js";
import { addExpWithLevelCheck } from "./ichigo-level.js";
import {
  getGameContextInfo,
  sendGamePreview,
  checkFastAnswer,
} from "./ichigo-context.js";
import config from "../../config.js";
import fs from "fs";
import { sharp } from "./ichigo-lazy.js";
let fetchBuffer;
try {
  fetchBuffer = (await import("./ichigo-utils.js")).fetchBuffer;
} catch { }

const WIN_MESSAGES = [
  "🌟 *GG WP! Otakmu encer!*",
  "✨ *KEREN ABIS! Lu emang pinter!*",
  "🎉 *MANTAPPPP! Jawaban sempurna!*",
  "💫 *EPIC! Gak ada lawan lu!*",
  "🏆 *NGERI! Otak lu kayak Google!*",
  "🔥 *LEGEND! Jawab kek gak ada beban!*",
];

const TIMEOUT_MESSAGES = [
  "⏱️ *Yah telat, waktu habis!*",
  "⏱️ *WAKTU HABIS!*",
  "⏱️ *Telat bro, waktu dah abis!*",
];

const SURRENDER_MESSAGES = [
  "🏳️ *Yahhh nyerah deh...*",
  "🏳️ *MENYERAH!*",
  "🏳️ *Yah sayang banget nyerah...*",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

class IchigoGames {
  constructor() {
    this.registry = new Map();
  }

  register(gameType, cfg) {
    const defaults = {
      mode: "qa", 
      dataFile: `${gameType}.json`,
      questionField: "soal",
      answerField: "jawaban",
      emoji: "🎮",
      title: gameType.toUpperCase(),
      description: `Game ${gameType}`,
      timeout: 60000,
      cooldown: 5,
      hasImage: false,
      imageField: "img",
      alias: [],
      hintCount: 2,
      
      turnTimeout: 30000,
      minWordLength: 3,
      allowConsecutiveSamePlayer: false,
      rewardDivisor: 4,
    };
    this.registry.set(gameType, { ...defaults, ...cfg, gameType });
  }

  get(gameType) {
    return this.registry.get(gameType);
  }

  createHandler(gameType) {
    const cfg = this.registry.get(gameType);
    if (!cfg) throw new Error(`Game "${gameType}" not registered`);

    if (cfg.mode === "chain") return this.createChainHandler(gameType, cfg);

    const handler = async (m, { sock }) => {
      const chatId = m.chat;

      if (hasActiveSession(chatId)) {
        const session = getSession(chatId);
        if (session && session.gameType === gameType) {
          const remaining = getRemainingTime(chatId);
          const answer = session.question[cfg.answerField];
          let text = `⚠️ *Eh ada game jalan nih, jawab dulu!*\n\n`;
          if (cfg.questionField && session.question[cfg.questionField]) {
            text += `\`\`\`${session.question[cfg.questionField]}\`\`\`\n\n`;
          }
          text += `💡 Hint: *${getHint(answer, cfg.hintCount)}*\n`;
          text += `⏱️ Sisa: *${formatRemainingTime(remaining)}*\n\n`;
          text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;
          await sock.sendPreview(
            m.chat,
            {
              caption: `${config.info.website}\n\n${text}`,
              url: `${config.info.website}`,
              title: cfg.title,
              description: cfg.description,
              jpegThumbnail: await sharp(getAssetBuffer("ichigo2")).resize(300, 300).toBuffer(),
              previewType: 0,
            },
          );
          return;
        }
      }

      const question = getRandomItem(cfg.dataFile);
      if (!question) {
        await m.reply(
          "❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Data game tidak tersedia!",
        );
        return;
      }

      const answer = question[cfg.answerField];
      let sentMsg;

      if (cfg.hasImage && fetchBuffer) {
        let imageBuffer;
        try {
          imageBuffer = await fetchBuffer(question[cfg.imageField]);
        } catch {
          await m.reply("❌ *ɢᴀɢᴀʟ ᴍᴇᴍᴜᴀᴛ ɢᴀᴍʙᴀʀ*\n\n> Coba lagi nanti!");
          return;
        }

        let caption = `${cfg.emoji} *${cfg.title}*\n\n`;
        if (cfg.questionField && question[cfg.questionField]) {
          caption += `> ${question[cfg.questionField]}\n`;
        }
        caption += `💡 Hint: *${getHint(answer, cfg.hintCount)}*\n`;
        caption += `⏱️ Waktu: *${cfg.timeout / 1000} detik*\n`;
        caption += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
        caption += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;

        sentMsg = await sock.sendMessage(
          chatId,
          {
            image: imageBuffer,
            caption,
            contextInfo: getGameContextInfo(),
          },
          { quoted: m },
        );
      } else {
        let text = `${cfg.emoji} *${cfg.title}*\n\n`;
        if (cfg.questionField && question[cfg.questionField]) {
          text += `\`\`\`${question[cfg.questionField]}\`\`\`\n\n`;
        }
        text += `💡 Hint: *${getHint(answer, cfg.hintCount)}*\n`;
        text += `⏱️ Waktu: *${cfg.timeout / 1000} detik*\n`;
        text += `🎁 Hadiah: *Limit, Koin, EXP (random)*\n\n`;
        text += `_Jawab langsung atau ketik "nyerah"\nSetiap salah, hint akan bertambah_`;

        sentMsg = await sendGamePreview(
          sock,
          chatId,
          text,
          `${cfg.emoji} ${cfg.title}`,
          "Jawab pertanyaan!",
          { quoted: m },
        );
      }

      createSession(chatId, gameType, question, sentMsg.key, cfg.timeout);

      setSessionTimer(chatId, async () => {
        let text = `${pick(TIMEOUT_MESSAGES)}\n\n`;
        text += `Jawaban: *${answer}*\n\n`;
        text += `_Gak ada yang bisa jawab nih~_`;
        await m.reply(text);
      });
    };

    const answerHandler = async (m, sock) => {
      const chatId = m.chat;
      const session = getSession(chatId);

      if (!session || session.gameType !== gameType) return false;

      const userAnswer = (m.body || "").trim();
      if (!userAnswer || userAnswer.startsWith(".")) return false;

      if (isSurrender(userAnswer)) {
        endSession(chatId);
        const answer = session.question[cfg.answerField];
        let text = `${pick(SURRENDER_MESSAGES)}\n\n`;
        text += `Jawaban: *${answer}*\n\n`;
        text += `_@${m.sender.split("@")[0]} menyerah_`;
        await m.reply(text, { mentions: [m.sender] });
        return true;
      }

      if (!isReplyToGame(m, session)) return false;

      session.attempts++;

      const answer = session.question[cfg.answerField];
      const result = checkAnswerAdvanced(answer, userAnswer);

      if (result.status === "correct") {
        endSession(chatId);

        const db = getDatabase();
        const user = db.getUser(m.sender);

        let totalLimit = 0;
        let totalBalance = 0;
        let totalExp = 0;

        if (cfg.rewards === false || cfg.rewards === null) {
          
        } else if (cfg.rewards) {
          totalLimit = cfg.rewards.limit || cfg.rewards.energi || 0;
          totalBalance = cfg.rewards.koin || cfg.rewards.balance || 0;
          totalExp = cfg.rewards.exp || 0;
        } else {
          const reward = getRandomReward();
          totalLimit = reward.limit;
          totalBalance = reward.koin;
          totalExp = reward.exp;
        }

        let bonusText = "";

        const fastResult = checkFastAnswer(session);
        if (
          fastResult.isFast &&
          cfg.rewards !== false &&
          cfg.rewards !== null
        ) {
          totalLimit += fastResult.bonus.limit;
          totalBalance += fastResult.bonus.koin;
          totalExp += fastResult.bonus.exp;
          bonusText = `\n\n${fastResult.praise}\n⚡ *BONUS KILAT:* +${fastResult.bonus.limit} Limit, +${fastResult.bonus.koin} Koin\n⏱️ Waktu: *${(fastResult.elapsed / 1000).toFixed(1)}s*`;
        }

        if (totalLimit > 0) db.updateEnergi(m.sender, totalLimit);
        if (totalBalance > 0) db.updateKoin(m.sender, totalBalance);

        if (totalExp > 0) {
          if (!user.rpg) user.rpg = {};
          await addExpWithLevelCheck(sock, m, db, user, totalExp);
        }
        db.save();

        let text = `${pick(WIN_MESSAGES)}\n\n`;
        text += `Jawaban: *${answer}*\n`;
        text += `Pemenang: *@${m.sender.split("@")[0]}*\n`;
        text += `Percobaan: *${session.attempts}x*\n\n`;

        if (totalLimit > 0 || totalBalance > 0 || totalExp > 0) {
          let parts = [];
          if (totalLimit > 0) parts.push(`+${totalLimit} Limit`);
          if (totalBalance > 0) parts.push(`+${totalBalance} Koin`);
          if (totalExp > 0) parts.push(`+${totalExp} EXP`);
          text += `🎁 ${parts.join(", ")}`;
        }
        text += bonusText;

        await m.reply(text, { mentions: [m.sender] });
        return true;
      }

      if (result.status === "close") {
        const remaining = getRemainingTime(chatId);
        const percent = Math.round(result.similarity * 100);
        await m.react("🔥");
        await m.reply(
          `🔥 *Hampir!* Jawabanmu *${percent}%* mirip!\n_Sisa waktu: *${formatRemainingTime(remaining)}*_`,
        );
        return false;
      }

      const remaining = getRemainingTime(chatId);
      if (remaining > 0 && session.attempts < 10) {
        await m.react("❌");
        const hint = getProgressiveHint(answer, session.attempts);
        await m.reply(
          `❌ Belum bener! Hint: *${hint}*\n_Sisa: *${formatRemainingTime(remaining)}*_`,
        );
      }

      return false;
    };

    return { handler, answerHandler };
  }

  createChainHandler(gameType, cfg) {
    const scheduleTurnTimeout = (chatId, sock) => {
      const session = getSession(chatId);
      if (!session || session.gameType !== gameType) return;

      if (session.timer) clearTimeout(session.timer);
      session.endTime = Date.now() + cfg.turnTimeout;

      session.timer = setTimeout(async () => {
        const current = getSession(chatId);
        if (!current || current !== session) return;

        endSession(chatId);
        const text = buildChainSummary(current, `${pick(TIMEOUT_MESSAGES)}\n\n`);
        try {
          await sock.sendMessage(chatId, { text });
        } catch { }
      }, cfg.turnTimeout);
    };

    const buildChainLeaderboard = (session) => {
      const entries = Object.entries(session.scores || {}).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) return "";
      let text = `🏆 *Papan Skor:*\n`;
      entries.forEach(([sender, score], i) => {
        text += `${i + 1}. @${sender.split("@")[0]} - ${score} kata\n`;
      });
      return text;
    };

    const buildChainSummary = (session, header) => {
      let text = header;
      text += `Kata terakhir: *${session.currentWord}*\n`;
      text += `Total kata tersambung: *${session.usedWords.length}*\n\n`;
      text += buildChainLeaderboard(session);
      text += `\n_Main lagi: *.${gameType} start*_`;
      return text;
    };

    const normalizeWord = (word) =>
      (word || "").toLowerCase().trim().replace(/[^a-z]/g, "");

    const handler = async (m, { sock }) => {
      const chatId = m.chat;
      const args = (m.body || "").trim().split(/\s+/).slice(1);
      const command = args[0]?.toLowerCase() || "start";

      if (command === "stop" || command === "berhenti") {
        const session = getSession(chatId);
        if (!session || session.gameType !== gameType) {
          return m.reply(`❌ Nggak ada sesi ${cfg.title} yang lagi jalan kak.`);
        }
        endSession(chatId);
        await m.reply(buildChainSummary(session, `🏳️ *${cfg.title} DIHENTIKAN*\n\n`));
        return;
      }

      if (hasActiveSession(chatId)) {
        const session = getSession(chatId);
        if (session && session.gameType === gameType) {
          const remaining = getRemainingTime(chatId);
          await m.reply(
            `⚠️ *${cfg.title} MASIH JALAN!*\n\n` +
            `Kata terakhir: *${session.currentWord}*\n` +
            `Lanjutkan dengan kata berawalan huruf *${session.currentWord.slice(-1).toUpperCase()}*\n` +
            `Sisa waktu: *${formatRemainingTime(remaining)}* ⏳\n\n` +
            `_Reply pesan bot dengan katamu, atau ketik ".${gameType} stop"_`
          );
          return;
        }
      }

      const startWord = normalizeWord(getRandomItem(cfg.dataFile));
      if (!startWord) {
        await m.reply(`❌ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴛᴇʀsᴇᴅɪᴀ*\n\n> Data ${cfg.title} tidak tersedia!`);
        return;
      }

      const text =
        `${cfg.emoji} *${cfg.title} DIMULAI!*\n\n` +
        `Kata pertama: *${startWord}*\n\n` +
        `Aturan main:\n` +
        `├ Kata berikutnya wajib diawali huruf *${startWord.slice(-1).toUpperCase()}*\n` +
        `├ Kata belum pernah dipakai sebelumnya\n` +
        `├ Minimal ${cfg.minWordLength} huruf\n` +
        (cfg.allowConsecutiveSamePlayer ? "" : `├ Gantian! Gaboleh nyambung sendiri 2x berturut-turut\n`) +
        `╰ Waktu tiap giliran: *${cfg.turnTimeout / 1000} detik*\n\n` +
        `_Reply pesan ini dengan katamu. Ketik ".${gameType} stop" buat berhenti._`;

      const sentMsg = await sendGamePreview(
        sock,
        chatId,
        text,
        `${cfg.emoji} ${cfg.title}`,
        "Balas pesan ini buat main!",
        { quoted: m }
      );

      const session = createSession(chatId, gameType, { word: startWord }, sentMsg.key, cfg.turnTimeout);
      session.currentWord = startWord;
      session.usedWords = [startWord];
      session.lastPlayer = null;
      session.scores = {};

      scheduleTurnTimeout(chatId, sock);
    };

    const answerHandler = async (m, sock) => {
      const chatId = m.chat;
      const session = getSession(chatId);

      if (!session || session.gameType !== gameType) return false;
      if (!isReplyToGame(m, session)) return false;

      const rawInput = (m.body || "").trim();
      if (!rawInput || rawInput.startsWith(".")) return false;

      if (isSurrender(rawInput)) {
        endSession(chatId);
        await m.reply(buildChainSummary(session, `${pick(SURRENDER_MESSAGES)}\n\n`));
        return true;
      }

      const word = normalizeWord(rawInput);

      if (!word || word !== rawInput.toLowerCase().trim()) {
        await m.react("⚠️");
        await m.reply("Cuma boleh 1 kata (huruf aja, tanpa spasi/angka/simbol) ya kak!");
        return true;
      }

      if (word.length < cfg.minWordLength) {
        await m.react("❌");
        await m.reply(`Kata minimal ${cfg.minWordLength} huruf ya kak!`);
        return true;
      }

      const requiredLetter = session.currentWord.slice(-1);
      if (word[0] !== requiredLetter) {
        await m.react("❌");
        await m.reply(
          `Salah kak! Kata harus diawali huruf *${requiredLetter.toUpperCase()}* ` +
          `(dari kata *${session.currentWord}*)`
        );
        return true;
      }

      if (session.usedWords.includes(word)) {
        await m.react("⚠️");
        await m.reply(`Kata *${word}* udah pernah dipakai kak! Cari yang lain 😂`);
        return true;
      }

      if (!cfg.allowConsecutiveSamePlayer && session.lastPlayer === m.sender) {
        await m.react("⏳");
        await m.reply("Gantian dulu kak, tunggu pemain lain jawab! 😄");
        return true;
      }

      session.usedWords.push(word);
      session.currentWord = word;
      session.lastPlayer = m.sender;
      session.scores[m.sender] = (session.scores[m.sender] || 0) + 1;

      if (cfg.rewards !== false && cfg.rewards !== null) {
        const db = getDatabase();
        const user = db.getUser(m.sender);
        const reward = getRandomReward();
        if (!user.rpg) user.rpg = {};
        await addExpWithLevelCheck(sock, m, db, user, Math.round(reward.exp / cfg.rewardDivisor));
        db.updateKoin(m.sender, Math.round(reward.koin / cfg.rewardDivisor));
        db.save();
      }

      await m.react("✅");
      await m.reply(
        `✅ *${word}*\n\n` +
        `@${m.sender.split("@")[0]} lanjut! Kata berikutnya diawali huruf *${word.slice(-1).toUpperCase()}*\n` +
        `Total kata tersambung: *${session.usedWords.length}*`,
        { mentions: [m.sender] }
      );

      scheduleTurnTimeout(chatId, sock);
      return true;
    };

    return { handler, answerHandler };
  }

  createPlugin(gameType, overrides = {}) {
    const cfg = this.registry.get(gameType);
    if (!cfg) throw new Error(`Game "${gameType}" not registered`);

    const { handler, answerHandler } = this.createHandler(gameType);

    return {
      config: {
        name: gameType,
        alias: cfg.alias,
        category: "game",
        description: cfg.description,
        usage: `.${gameType}`,
        example: `.${gameType}`,
        isOwner: false,
        isPremium: false,
        isGroup: cfg.mode === "chain" ? true : false,
        isPrivate: false,
        cooldown: cfg.cooldown,
        energi: 0,
        isEnabled: true,
        ...overrides,
      },
      handler,
      answerHandler,
    };
  }
}

const games = new IchigoGames();

export { IchigoGames, games };