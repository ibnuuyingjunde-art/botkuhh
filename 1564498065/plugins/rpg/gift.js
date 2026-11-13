import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "gift",
  alias: ["kasih", "hadiah"],
  category: "rpg",
  description: "Beri hadiah ke pasangan untuk meningkatkan love",
  usage: ".gift <item> <jumlah> [@user]",
  example: ".gift diamond 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
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

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  const mySpouses = getSpouseList(user.rpg);

  if (mySpouses.length === 0) {
    return m.reply(
      `❌ *ʙᴇʟᴜᴍ ᴍᴇɴɪᴋᴀʜ*\n\n` +
      `> Kamu belum menikah!\n` +
      `> Nikah dulu dengan \`.marry @user\``,
    );
  }

  const args = m.args || [];
  const itemKey = args[0]?.toLowerCase();
  const amount = parseInt(args[1]) || 1;

  const targetMention = m.mentionedJid?.[0] || m.quoted?.sender;
  let spouseJid = null;

  if (targetMention) {
    if (!mySpouses.includes(targetMention)) {
      return m.reply(
        `❌ @${targetMention.split("@")[0]} bukan pasangan kamu!`,
        { mentions: [targetMention] },
      );
    }
    spouseJid = targetMention;
  } else if (mySpouses.length === 1) {
    spouseJid = mySpouses[0];
  } else {
    
    let txt = `🎁 *ᴘɪʟɪʜ ᴘᴀsᴀɴɢᴀɴ*\n\n`;
    txt += `Kamu punya *${mySpouses.length}* pasangan. Tag siapa yang mau dikasih hadiah:\n\n`;
    mySpouses.forEach((s, i) => {
      txt += `   ${i + 1}. @${s.split("@")[0]}\n`;
    });
    txt += `\n👉 \`.gift ${itemKey || "<item>"} ${amount} @user\``;
    return m.reply(txt, { mentions: mySpouses });
  }

  if (!itemKey) {
    return m.reply(
      `🎁 *ɢɪꜰᴛ*\n\n` +
      `> Pilih item untuk diberikan\n` +
      `> \`.gift <item> <jumlah>\`\n` +
      `> Contoh: \`.gift diamond 1\``,
    );
  }

  user.inventory = user.inventory || {};

  if ((user.inventory[itemKey] || 0) < amount) {
    return m.reply(
      `❌ *ɪᴛᴇᴍ ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ*\n\n` +
      `> Item *${itemKey}* kamu: ${user.inventory[itemKey] || 0}\n` +
      `> Butuh: ${amount}`,
    );
  }

  const partner = db.getUser(spouseJid);
  if (!partner) {
    return m.reply(`❌ *ᴘᴀsᴀɴɢᴀɴ ɴᴏᴛ ꜰᴏᴜɴᴅ*\n\n> Pasangan tidak ditemukan di database!`);
  }

  if (!partner.rpg) partner.rpg = {};
  partner.inventory = partner.inventory || {};

  user.inventory[itemKey] -= amount;
  if (user.inventory[itemKey] <= 0) delete user.inventory[itemKey];

  partner.inventory[itemKey] = (partner.inventory[itemKey] || 0) + amount;
  user.rpg.love = (user.rpg.love || 0) + amount * 10;
  partner.rpg.love = (partner.rpg.love || 0) + amount * 10;

  db.setUser(m.sender, user);
  db.setUser(spouseJid, partner);
  db.save();

  let txt = `🎁 *ɢɪꜰᴛ sᴜᴋsᴇs*\n\n`;
  txt += `> 💝 Kamu memberikan ${amount}x ${itemKey}\n`;
  txt += `> 👤 Untuk: @${spouseJid.split("@")[0]}\n`;
  txt += `> 💕 Love: +${amount * 10}\n\n`;
  txt += `> _So sweet! 💖_`;

  await m.reply(txt, { mentions: [spouseJid] });
}

export { pluginConfig as config, handler };