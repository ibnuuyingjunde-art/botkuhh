import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "divorce",
  alias: ["cerai", "pisah"],
  category: "rpg",
  description: "Bercerai dari pasangan",
  usage: ".divorce @user",
  example: ".divorce @628xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 0,
  isEnabled: true,
};

const MAX_SPOUSE = 4;
const DIVORCE_COST = 25000;

function getSpouseList(rpg) {
  if (!rpg.spouses) {
    rpg.spouses = rpg.spouse ? [rpg.spouse] : [];
    delete rpg.spouse;
  }
  return rpg.spouses;
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  const mySpouses = getSpouseList(user.rpg);

  if (mySpouses.length === 0) {
    return m.reply(
      `Halu tingkat tinggi... Nikah aja belum masa udah mau cerai? 😂💔\n` +
      `Cari pasangan dulu pake \`.marry @user\``,
    );
  }

  const target = m.mentionedJid?.[0] || m.quoted?.sender;

  if (!target && mySpouses.length > 1) {
    let txt = `💔 *PILIH PASANGAN YANG MAU DICERAI*\n\n`;
    txt += `Kamu punya *${mySpouses.length}* pasangan. Tag siapa yang mau dicerai:\n\n`;
    mySpouses.forEach((s, i) => {
      txt += `   ${i + 1}. @${s.split("@")[0]}\n`;
    });
    txt += `\n👉 \`.divorce @user\``;
    return m.reply(txt, { mentions: mySpouses });
  }

  const spouseJid = target || mySpouses[0];

  if (!mySpouses.includes(spouseJid)) {
    return m.reply(
      `❌ @${spouseJid.split("@")[0]} bukan pasangan kamu!`,
      { mentions: [spouseJid] },
    );
  }

  if ((user.koin || 0) < DIVORCE_COST) {
    return m.reply(
      `Aduh, biaya pengacara buat cerai mahal bos! 😭\n` +
      `Butuh *Rp ${DIVORCE_COST.toLocaleString("id-ID")}* buat tanda tangan surat cerai, ` +
      `duit lu cuma *Rp ${(user.koin || 0).toLocaleString("id-ID")}*.\n` +
      `Tahan dulu aja berantemnya!`,
    );
  }

  user.koin -= DIVORCE_COST;
  user.rpg.spouses = mySpouses.filter((s) => s !== spouseJid);
  if (user.rpg.spouses.length === 0) user.rpg.marriedAt = null;

  const partner = db.getUser(spouseJid);
  if (partner) {
    if (!partner.rpg) partner.rpg = {};
    const partnerSpouses = getSpouseList(partner.rpg);
    partner.rpg.spouses = partnerSpouses.filter((s) => s !== m.sender);
    if (partner.rpg.spouses.length === 0) partner.rpg.marriedAt = null;
    db.setUser(spouseJid, partner);
  }

  db.setUser(m.sender, user);
  db.save();

  await m.react("💔");

  const sisaPasangan = user.rpg.spouses;
  let txt = `⛈️ *SIDANG PERCERAIAN SELESAI* ⛈️\n\n`;
  txt += `Palu telah diketuk. Dengan berat hati, hubungan antara:\n`;
  txt += `💔 @${m.sender.split("@")[0]}\n`;
  txt += `         -- PUTUS DENGAN --\n`;
  txt += `💔 @${spouseJid.split("@")[0]}\n\n`;
  txt += `😭 *RESMI BERAKHIR! KINI KALIAN KEMBALI JOMBLO SATU SAMA LAIN!* 😭\n\n`;
  txt += `💸 Biaya Pengacara/Sidang: *Rp -${DIVORCE_COST.toLocaleString("id-ID")}*\n`;

  if (sisaPasangan.length > 0) {
    txt += `\n👑 *Pasangan Tersisa (${sisaPasangan.length}/${MAX_SPOUSE}):*\n`;
    sisaPasangan.forEach((s, i) => {
      txt += `   ${i + 1}. @${s.split("@")[0]}\n`;
    });
  }

  txt += `\n> _"Sudah sudah... nangisnya di pojokan aja. Life must go on..." - Hakim Bot_ 🥀🚬`;

  await m.reply(txt, { mentions: [m.sender, spouseJid, ...sisaPasangan] });
}

export { pluginConfig as config, handler };