import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import {
  getCachedJid,
  isLid,
  isLidConverted,
  lidToJid,
} from "../../src/lib/ichigo-lid.js";
import config from "../../config.js";

const pluginConfig = {
  name: "daftar",
  alias: ["register", "reg"],
  category: "user",
  description: "Daftar sebagai user bot",
  usage: ".daftar",
  example: ".daftar",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
  skipRegistration: true,
};

if (!global.registrationSessions) global.registrationSessions = {};

const SESSION_TIMEOUT = 300000; 
const DEFAULT_REWARDS = { koin: 30000, energi: 300, exp: 300000 };
const REGISTRATION_IMAGE_CANDIDATES = ["ichigo-daftar", "ichigo"];

function getRegistrationContextInfo() {
  const saluranId = config.saluran?.id || "120363400911374213@newsletter";
  const saluranName = config.saluran?.name || config.bot?.name || "lyniX's";
  return {
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
    },
  };
}

function getRegistrationRewards() {
  return config.registration?.rewards || DEFAULT_REWARDS;
}

async function getRegistrationImage() {
  for (const key of REGISTRATION_IMAGE_CANDIDATES) {
    const buf = getAssetBuffer(key);
    if (buf) return buf;
  }
  return null;
}

function getRegistrationSessionKey(jid) {
  let normalized = String(jid || "").trim();
  if (!normalized) return "";
  if (isLid(normalized) || isLidConverted(normalized)) {
    normalized = getCachedJid(normalized) || lidToJid(normalized) || normalized;
  }
  const digits = normalized.replace(/[^0-9]/g, "");
  return digits || normalized.toLowerCase();
}

function getRegistrationSessionEntry(jid) {
  const sessionKey = getRegistrationSessionKey(jid);
  if (sessionKey && global.registrationSessions?.[sessionKey]) {
    return { key: sessionKey, session: global.registrationSessions[sessionKey] };
  }
  const legacyKey = String(jid || "").trim();
  if (legacyKey && global.registrationSessions?.[legacyKey]) {
    return { key: legacyKey, session: global.registrationSessions[legacyKey] };
  }
  return { key: sessionKey, session: null };
}

function clearRegistrationSession(jid) {
  const { key, session } = getRegistrationSessionEntry(jid);
  if (!session) return false;
  if (session.timeout) clearTimeout(session.timeout);
  delete global.registrationSessions[key];
  return true;
}

function createRegistrationSession(jid, chatJid, data = {}) {
  const sessionKey = getRegistrationSessionKey(jid);
  clearRegistrationSession(sessionKey);

  const session = {
    step: "form", 
    chatJid,
    promptId: null,
    startedAt: Date.now(),
    ...data,
    timeout: setTimeout(() => {
      if (global.registrationSessions[sessionKey]) {
        delete global.registrationSessions[sessionKey];
      }
    }, SESSION_TIMEOUT),
  };

  global.registrationSessions[sessionKey] = session;
  return session;
}

function shouldBypassRegistrationAnswer(m) {
  if (!m?.isCommand) return false;
  const command = String(m.command || "").toLowerCase();
  return ["daftar", "register", "reg", "bataldaftar"].includes(command);
}

function buildUserDataBlock(name, age, gender) {
  return (
    `╭┈┈⬡「 📋 *ᴅᴀᴛᴀ* 」\n` +
    `┃ 📛 Nama   : *${name || "-"}*\n` +
    `┃ 🎂 Umur   : *${age ? `${age} tahun` : "-"}*\n` +
    `┃ 👤 Gender : *${gender || "-"}*\n` +
    `╰┈┈┈┈┈┈┈┈⬡`
  );
}

function parseGender(input) {
  const low = input.trim().toLowerCase();
  if (/^(laki[-\s]?laki|cowok?|cowo|l|male|pria)$/.test(low)) return "Laki-laki";
  if (/^(perempuan|cewek?|cewe|p|female|wanita)$/.test(low)) return "Perempuan";
  return null;
}

function buildRewardBlock(alreadyClaimedReward) {
  const rewards = getRegistrationRewards();
  if (alreadyClaimedReward) {
    return (
      `╭┈┈⬡「 🎁 *ʙᴏɴᴜs* 」\n` +
      `┃ Bonus daftar sudah pernah diklaim\n` +
      `┃ Tidak ada reward tambahan kali ini\n` +
      `╰┈┈┈┈┈┈┈┈⬡`
    );
  }
  return (
    `╭┈┈⬡「 🎁 *ʀᴇᴡᴀʀᴅs* 」\n` +
    `┃ 💰 +${rewards.koin.toLocaleString("id-ID")} Koin\n` +
    `┃ ⚡ +${rewards.energi} Energi\n` +
    `┃ ⭐ +${rewards.exp.toLocaleString("id-ID")} EXP\n` +
    `╰┈┈┈┈┈┈┈┈⬡`
  );
}

function buildFormMessage(prefix, user) {
  const rewards = getRegistrationRewards();
  const rewardPreview = user?.hasClaimedRegisterReward
    ? `> Bonus daftar sudah pernah kamu klaim`
    : `> 💰 +${rewards.koin.toLocaleString("id-ID")} Koin\n> ⚡ +${rewards.energi} Energi\n> ⭐ +${rewards.exp.toLocaleString("id-ID")} EXP`;

  return (
    `👋 *sᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ ᴅɪ ᴍᴇɴᴜ ᴅᴀꜰᴛᴀʀ*\n\n` +
    `🎁 *Bonus Daftar*\n${rewardPreview}\n\n` +
    `📝 *Isi data kamu dengan format berikut:*\n\n` +
    `\`Nama, Umur, Gender\`\n\n` +
    `📌 *Contoh:*\n` +
    `> \`Kaze, 17, cowo\`\n` +
    `> \`Kaylax, 30, cewe\`\n\n` +
    `📌 *Wajib reply pesan ini*\n` +
    `> Untuk batal: \`${prefix}bataldaftar\``
  );
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (user?.isRegistered) {
    return m.reply(
      `✅ Kamu sudah terdaftar!\n\n` +
      `${buildUserDataBlock(user.regName, user.regAge, user.regGender)}\n\n` +
      `> Untuk unregister: \`${m.prefix}unreg\``,
    );
  }

  if (getRegistrationSessionEntry(m.sender).session) {
    return m.reply(
      `📝 Masih ada sesi pendaftaran aktif!\n\n` +
      `> Reply pesan terakhir bot untuk melanjutkan\n` +
      `> Atau ketik: \`${m.prefix}bataldaftar\``,
    );
  }

  const session = createRegistrationSession(m.sender, m.chat);

  const image = await getRegistrationImage();
  let sent;

  if (image) {
    sent = await sock.sendMessage(
      m.chat,
      {
        image,
        caption: buildFormMessage(m.prefix, user),
        contextInfo: getRegistrationContextInfo(),
      },
      { quoted: m },
    );
  } else {
    sent = await m.reply(buildFormMessage(m.prefix, user));
  }

  session.promptId = sent?.key?.id || null;
  await m.react("📝");
}

async function registrationAnswerHandler(m, sock) {
  if (!m.body) return false;
  if (shouldBypassRegistrationAnswer(m)) return false;

  const { session } = getRegistrationSessionEntry(m.sender);
  if (!session) return false;
  if (m.chat !== session.chatJid) return false;

  const text = m.body.trim();
  const lowText = text.toLowerCase();
  const db = getDatabase();

  if (["batal", "cancel", "batalkan"].includes(lowText)) {
    clearRegistrationSession(m.sender);
    await m.reply(
      `❌ Pendaftaran dibatalkan.\n\n> Mulai lagi dengan: \`${m.prefix}daftar\``,
    );
    return true;
  }

  if (session.step === "form") {
    const parts = text.split(",").map((s) => s.trim());

    if (parts.length < 3) {
      await m.reply(
        `❌ Format salah!\n\n` +
        `> Gunakan format: \`Nama, Umur, Gender\`\n` +
        `> Contoh: \`Kaze, 17, cowo\``,
      );
      return true;
    }

    const [rawName, rawAge, rawGender] = parts;

    const name = rawName.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 30) {
      await m.reply(`❌ Nama harus 2-30 karakter!`);
      return true;
    }

    const age = Number(rawAge);
    if (!/^\d+$/.test(rawAge) || Number.isNaN(age) || age < 1 || age > 100) {
      await m.reply(`❌ Umur tidak valid!\n\n> Masukkan angka umur dari *1 - 100* tahun`);
      return true;
    }

    const gender = parseGender(rawGender);
    if (!gender) {
      await m.reply(
        `❌ Gender tidak valid!\n\n` +
        `> Gunakan: *cowo* / *cowok* / *laki-laki* / *l*\n` +
        `> Atau: *cewe* / *cewek* / *perempuan* / *p*`,
      );
      return true;
    }

    session.name = name;
    session.age = age;
    session.gender = gender;
    session.step = "confirm";

    const user = db.getUser(m.sender) || {};
    const sent = await m.reply(
      `✅ *ᴋᴏɴꜰɪʀᴍᴀsɪ ᴅᴀᴛᴀ*\n\n` +
      `${buildUserDataBlock(name, age, gender)}\n\n` +
      `${buildRewardBlock(user?.hasClaimedRegisterReward)}\n\n` +
      `📌 *Reply pesan ini dengan:*\n` +
      `> \`ya\` untuk simpan\n` +
      `> \`batal\` untuk batalkan`,
    );

    session.promptId = sent?.key?.id || session.promptId;
    return true;
  }

  if (session.step === "confirm") {
    if (!["ya", "y", "iya", "yes", "lanjut", "confirm"].includes(lowText)) {
      await m.reply(
        `❌ Balasan tidak valid!\n\n> Reply: \`ya\` untuk simpan atau \`batal\` untuk batalkan`,
      );
      return true;
    }

    const currentUser = db.getUser(m.sender) || {};
    const rewards = getRegistrationRewards();
    const alreadyClaimedReward = Boolean(currentUser.hasClaimedRegisterReward);
    const now = new Date().toISOString();
    const registrationCount = Number(currentUser.registrationCount || 0) + 1;

    db.setUser(m.sender, {
      isRegistered: true,
      regName: session.name,
      regAge: session.age,
      regGender: session.gender,
      registeredAt: currentUser.registeredAt || now,
      lastRegisteredAt: now,
      registrationCount,
      hasClaimedRegisterReward: true,
      unregisteredAt: null,
    });

    if (!alreadyClaimedReward) {
      db.updateKoin(m.sender, rewards.koin);
      db.updateEnergi(m.sender, rewards.energi);
      db.updateExp(m.sender, rewards.exp);
    }

    await db.save();
    clearRegistrationSession(m.sender);

    await sock.sendMessage(
      m.chat,
      {
        text:
          `🎉 *ᴘᴇɴᴅᴀꜰᴛᴀʀᴀɴ ʙᴇʀʜᴀsɪʟ!*\n\n` +
          `Selamat datang, *${session.name}*!\n\n` +
          `${buildUserDataBlock(session.name, session.age, session.gender)}\n\n` +
          `${buildRewardBlock(alreadyClaimedReward)}\n\n` +
          `🚀 Akun kamu sudah aktif dan siap digunakan!\n\n` +
          `> ketik \`${m.prefix}menu\` untuk melihat menu\n` +
          `> ketik \`${m.prefix}profile\` untuk melihat profil kamu`,
        contextInfo: getRegistrationContextInfo(),
      },
      { quoted: m },
    );

    await m.react("🎉");
    return true;
  }

  return false;
}

export {
  pluginConfig as config,
  handler,
  registrationAnswerHandler,
  clearRegistrationSession,
};