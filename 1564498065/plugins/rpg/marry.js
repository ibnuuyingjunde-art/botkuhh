import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "marry",
  alias: ["nikah", "wedding", "propose"],
  category: "rpg",
  description: "Melamar player lain (maks 4 pasangan) — target harus accept dulu",
  usage: ".marry @user",
  example: ".marry @user",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 60,
  energi: 0,
  isEnabled: true,
};

const MAX_SPOUSE = 4;
const MARRIAGE_COSTS = [50000, 100000, 200000, 400000];
const PROPOSE_TIMEOUT_MS = 2 * 60 * 1000; 

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
  const db = getDatabase();
  const user = db.getUser(m.sender) || db.setUser(m.sender);

  if (!user.rpg) user.rpg = {};
  const mySpouses = getSpouseList(user.rpg);

  const target = m.mentionedJid?.[0] || m.quoted?.sender;

  if (!target) {
    const cost = MARRIAGE_COSTS[mySpouses.length] ?? null;
    let txt = `💒 *CATATAN SIPIL RPG* 💒\n\n`;

    if (mySpouses.length > 0) {
      txt += `👑 *Pasangan Kamu Saat Ini (${mySpouses.length}/${MAX_SPOUSE}):*\n`;
      mySpouses.forEach((s, i) => {
        txt += `   ${i + 1}. @${s.split("@")[0]}\n`;
      });
      txt += `\n`;
    } else {
      txt += `Mau melamar ayang? Tag orangnya di sini!\n\n`;
    }

    txt += `*Cara Melamar:*\n`;
    txt += `👉 \`${m.prefix}marry @user\`\n\n`;
    txt += `*Biaya Pernikahan:*\n`;
    MARRIAGE_COSTS.forEach((c, i) => {
      const label = i === 0 ? "Nikah 1 (pertama)" : `Nikah ${i + 1} (poligami)`;
      const mark = i === mySpouses.length ? " ◀ kamu di sini" : "";
      txt += `   ${i + 1}. ${label}: *Rp ${c.toLocaleString("id-ID")}*${mark}\n`;
    });

    if (mySpouses.length >= MAX_SPOUSE) {
      txt += `\n⛔ Kamu sudah mencapai batas maksimal *${MAX_SPOUSE} pasangan*!`;
    } else if (cost !== null) {
      txt += `\n💸 Biaya nikah berikutnya: *Rp ${cost.toLocaleString("id-ID")}*`;
    }

    return m.reply(txt, { mentions: mySpouses });
  }

  if (target === m.sender) {
    return m.reply(`Aduh kasihan banget jomblo kronis... Masa mau nikah sama diri sendiri? Cari jodoh sana! 😭💔`);
  }

  const botJid = sock.user?.id?.replace(/:.*@/, "@") || "";
  if (target === botJid) {
    return m.reply(`Bot tidak bisa dinikahi! 🤖💔`);
  }

  if (mySpouses.includes(target)) {
    return m.reply(
      `Bro... @${target.split("@")[0]} itu udah jadi pasangan kamu! 😅`,
      { mentions: [target] },
    );
  }

  if (mySpouses.length >= MAX_SPOUSE) {
    return m.reply(
      `🚫 Cukup bro! Kamu udah punya *${MAX_SPOUSE} pasangan*.\n` +
      `Cerai dulu pakai \`.divorce @user\` kalau mau ganti! 😤`,
      { mentions: mySpouses },
    );
  }

  const partner = db.getUser(target) || db.setUser(target);
  if (!partner.rpg) partner.rpg = {};
  const partnerSpouses = getSpouseList(partner.rpg);

  if (partnerSpouses.includes(m.sender)) {
    return m.reply(
      `Aneh... @${target.split("@")[0]} juga udah punya kamu sebagai pasangan di database. Hubungi owner untuk fix data!`,
      { mentions: [target] },
    );
  }

  if (partnerSpouses.length >= MAX_SPOUSE) {
    return m.reply(
      `😔 @${target.split("@")[0]} udah punya *${MAX_SPOUSE} pasangan* dan sudah penuh!\n💔`,
      { mentions: [target] },
    );
  }

  const marriageCost = MARRIAGE_COSTS[mySpouses.length];

  if ((user.koin || 0) < marriageCost) {
    return m.reply(
      `Astaga... miskin kok nekat mau poligami? 🤦‍♂️\n` +
      `Biaya nikah ke-${mySpouses.length + 1}: *Rp ${marriageCost.toLocaleString("id-ID")}*\n` +
      `Duit kamu: *Rp ${(user.koin || 0).toLocaleString("id-ID")}*\n` +
      `Kerja keras dulu bang!`,
    );
  }

  const sessions = getSessions();
  const existingKey = Object.keys(sessions).find(
    (k) => sessions[k].proposer === m.sender && sessions[k].target === target,
  );
  if (existingKey) {
    return m.reply(
      `⏳ Kamu udah melamar @${target.split("@")[0]}!\n` +
      `Tunggu dia accept/reject dulu ya.`,
      { mentions: [target] },
    );
  }

  const sessionKey = `${m.chat}_${m.sender}_${target}`;
  sessions[sessionKey] = {
    proposer: m.sender,
    target,
    chat: m.chat,
    cost: marriageCost,
    createdAt: Date.now(),
  };

  setTimeout(() => {
    if (sessions[sessionKey]) {
      delete sessions[sessionKey];
      
      sock.sendMessage(m.chat, {
        text: `⏰ Lamaran @${m.sender.split("@")[0]} ke @${target.split("@")[0]} sudah kadaluarsa.`,
        mentions: [m.sender, target],
      }).catch(() => {});
    }
  }, PROPOSE_TIMEOUT_MS);

  await m.react("💍");

  const isPoligami = mySpouses.length > 0 || partnerSpouses.length > 0;
  let txt = `💍 *LAMARAN PERNIKAHAN!*\n\n`;
  txt += `@${m.sender.split("@")[0]} melamar @${target.split("@")[0]}`;
  if (isPoligami) txt += ` *(Poligami ke-${mySpouses.length + 1})*`;
  txt += `\n\n`;
  txt += `💸 Biaya: *Rp ${marriageCost.toLocaleString("id-ID")}*\n\n`;
  txt += `@${target.split("@")[0]}, kamu punya *2 menit* untuk menjawab:\n`;
  txt += `✅ Ketik \`.accept\` untuk menerima\n`;
  txt += `❌ Ketik \`.reject\` untuk menolak`;

  await m.reply(txt, { mentions: [m.sender, target] });
}

export { pluginConfig as config, handler };