import axios from "axios";

const pluginConfig = {
  name: "tebaklogo",
  alias: ["tlogo", "guesslogo"],
  category: "game",
  description: "Tebak logo brand/aplikasi",
  usage: ".tebaklogo",
  example: ".tebaklogo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const sessions = {};

async function handler(m, { sock, db }) {
  const chatId = m.chat;

  if (sessions[chatId]) {
    const session = sessions[chatId];
    const jawaban = m.text?.trim().toLowerCase();
    const correct = session.jawaban.toLowerCase();

    if (
      jawaban === correct ||
      correct.includes(jawaban) ||
      jawaban.includes(correct)
    ) {
      delete sessions[chatId];

      try {
        const userData = db.getUser(m.sender) || {};
        userData.exp = (userData.exp || 0) + 50;
        userData.koin = (userData.koin || 0) + 10;
        db.setUser(m.sender, userData);
        await db.save();
      } catch {}

      return await sock.sendMessage(
        m.chat,
        {
          text: [
            `✅ *BENAR!*`,
            ``,
            `🎉 @${m.sender.split("@")[0]} berhasil menebak!`,
            ``,
            `│ 🏷️ Jawaban : *${session.jawaban}*`,
            `│ ⭐ EXP     : *+50*`,
            `│ 🪙 Koin    : *+10*`,
            ``,
            `> Ketik *.tebaklogo* untuk main lagi!`,
          ].join("\n"),
          mentions: [m.sender],
        },
        { quoted: m }
      );
    }

    if (!m.text?.startsWith(m.prefix)) {
      return await sock.sendMessage(
        m.chat,
        {
          text: `❌ Salah! Coba lagi atau ketik *.skip* untuk skip.`,
        },
        { quoted: m }
      );
    }
  }

  if (m.command === "skip" && sessions[chatId]) {
    const session = sessions[chatId];
    delete sessions[chatId];
    return await sock.sendMessage(
      m.chat,
      {
        text: `⏭️ *SKIP!*\n\nJawaban: *${session.jawaban}*\n\n> Ketik *.tebaklogo* untuk main lagi!`,
      },
      { quoted: m }
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.siputzx.my.id/api/games/tebaklogo`,
      { timeout: 15000 }
    );

    if (!data?.status || !data?.data?.data) {
      m.react("☢");
      return m.reply(`❌ Gagal mengambil soal.\n\n> Coba lagi nanti.`);
    }

    const soal = data.data.data;

    sessions[chatId] = {
      jawaban: soal.jawaban,
      startTime: Date.now(),
    };

    setTimeout(() => {
      if (sessions[chatId]?.startTime === sessions[chatId]?.startTime) {
        delete sessions[chatId];
      }
    }, 60000);

    const imgRes = await axios.get(soal.image, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    await sock.sendMessage(
      m.chat,
      {
        image: Buffer.from(imgRes.data),
        caption: [
          `🏷️ *TEBAK LOGO*`,
          ``,
          `❓ Logo brand/aplikasi apakah ini?`,
          ``,
          `│ ⏱️ Waktu  : *60 detik*`,
          `│ ⭐ Hadiah : *+50 EXP, +10 Koin*`,
          ``,
          `> Ketik jawaban langsung di chat!`,
          `> Ketik *.skip* untuk lewati soal`,
        ].join("\n"),
      },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[TebakLogo]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil soal.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };