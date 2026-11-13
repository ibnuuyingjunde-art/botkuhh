import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "acceptmarry",
  alias: ["accept", "terima-marry", "terimanikah"],
  category: "rpg",
  description: "Menerima lamaran nikah",
  usage: ".accept",
  example: ".accept",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function getSpouseList(rpg) {
  if (!rpg.spouses) {
    rpg.spouses = rpg.spouse ? [rpg.spouse] : [];
    delete rpg.spouse;
  }
  return rpg.spouses;
}

function getSessions() {
  if (!global.marrySessions) global.marrySessions = {};
  return global.marrySessions;
}

async function handler(m, { sock }) {
  const sessions = getSessions();

  const sessionEntry = Object.entries(sessions).find(
    ([, val]) => val.target === m.sender && val.chat === m.chat,
  );

  if (!sessionEntry) {
    return m.reply(
      `❌ Tidak ada lamaran nikah untukmu saat ini.\n` +
      `Minta dia lamar dulu dengan \`.marry @kamu\``,
    );
  }

  const [sessionKey, session] = sessionEntry;
  const { proposer, cost } = session;

  const db = getDatabase();
  const proposerUser = db.getUser(proposer) || db.setUser(proposer);
  const targetUser = db.getUser(m.sender) || db.setUser(m.sender);

  if (!proposerUser.rpg) proposerUser.rpg = {};
  if (!targetUser.rpg) targetUser.rpg = {};

  const proposerSpouses = getSpouseList(proposerUser.rpg);
  const targetSpouses = getSpouseList(targetUser.rpg);

  if (proposerSpouses.length >= 4) {
    delete sessions[sessionKey];
    return m.reply(
      `❌ Gagal! @${proposer.split("@")[0]} sudah punya 4 pasangan.`,
      { mentions: [proposer] },
    );
  }

  if (targetSpouses.length >= 4) {
    delete sessions[sessionKey];
    return m.reply(`❌ Gagal! Kamu sudah punya 4 pasangan.`);
  }

  if ((proposerUser.koin || 0) < cost) {
    delete sessions[sessionKey];
    return m.reply(
      `❌ Gagal! @${proposer.split("@")[0]} tidak punya cukup koin lagi.\n` +
      `(Butuh: Rp ${cost.toLocaleString("id-ID")})`,
      { mentions: [proposer] },
    );
  }

  proposerUser.koin -= cost;

  proposerSpouses.push(m.sender);
  proposerUser.rpg.spouses = proposerSpouses;
  proposerUser.rpg.marriedAt = proposerUser.rpg.marriedAt || Date.now();

  targetSpouses.push(proposer);
  targetUser.rpg.spouses = targetSpouses;
  targetUser.rpg.marriedAt = targetUser.rpg.marriedAt || Date.now();

  db.setUser(proposer, proposerUser);
  db.setUser(m.sender, targetUser);
  db.save();

  delete sessions[sessionKey];

  await m.react("💍");

  const isPoligami = proposerSpouses.length > 1 || targetSpouses.length > 1;
  const nikahKe = proposerSpouses.length;

  let txt = isPoligami
    ? `👑 *PERNIKAHAN POLIGAMI!!* 👑\n\n`
    : `💒 *PENGUMUMAN PERNIKAHAN!!* 💒\n\n`;

  txt += `Segenap penghuni server mengucapkan selamat kepada:\n\n`;
  txt += `👰 @${proposer.split("@")[0]}\n`;
  txt += `       💖 dengan 💖\n`;
  txt += `👰 @${m.sender.split("@")[0]}\n\n`;

  if (isPoligami) {
    txt += `🔔 Ini adalah pernikahan ke-*${nikahKe}* dari @${proposer.split("@")[0]}!\n\n`;
    txt += `👨‍👩‍👧‍👦 *Total Pasangan (${proposerSpouses.length}/4):*\n`;
    proposerSpouses.forEach((s, i) => {
      txt += `   ${i + 1}. @${s.split("@")[0]}\n`;
    });
    txt += `\n`;
  } else {
    txt += `🎉 *MEREKA RESMI MENJADI PASANGAN!* 🎉\n\n`;
  }

  txt += `💍 Biaya Resepsi: *Rp -${cost.toLocaleString("id-ID")}*\n\n`;
  txt += `> _"${isPoligami ? "Sultan baru telah lahir di server ini!" : "Semoga langgeng sampai akhir hayat server ini!"}" - Pendeta Bot_ 🥺💕`;

  await m.reply(txt, { mentions: [proposer, m.sender, ...proposerSpouses] });
}

export { pluginConfig as config, handler };