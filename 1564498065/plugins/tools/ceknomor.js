const pluginConfig = {
  name: "ceknomor",
  alias: ["cekwa", "cekno", "isnomor"],
  category: "tools",
  description: "Cek apakah nomor WhatsApp aktif/terdaftar",
  usage: ".ceknomor <nomor>",
  example: ".ceknomor 628123456789",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(input) {
  let num = input.replace(/[\s\-().+]/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  if (!num.startsWith("62") && num.length <= 11) num = "62" + num;
  return num;
}

function isValidNumber(num) {
  return /^\d{7,15}$/.test(num);
}

const FRAMES = [
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ ᴡᴀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Menghubungi server WA...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ ᴡᴀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Memverifikasi nomor...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ ᴡᴀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Mengambil info profil...\n╰┈┈┈┈┈┈┈┈⬡",
];

async function handler(m, { sock }) {
  const args = m.text?.trim().split(/\s+/) || [];
  const input = args[0];

  if (!input) {
    return m.reply(
      `⚠️ *ᴍᴀsᴜᴋᴋᴀɴ ɴᴏᴍᴏʀ*\n\n` +
      `> \`${m.prefix}ceknomor <nomor>\`\n\n` +
      `*ᴄᴏɴᴛᴏʜ:*\n` +
      `> \`${m.prefix}ceknomor 08123456789\`\n` +
      `> \`${m.prefix}ceknomor 628123456789\`\n` +
      `> \`${m.prefix}ceknomor +62 812-3456-789\``
    );
  }

  const num = parseNumber(input);

  if (!isValidNumber(num)) {
    return m.reply(
      `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
      `> \`${input}\` bukan format nomor yang valid.\n` +
      `> Pastikan hanya berisi angka, 7-15 digit.`
    );
  }

  let sent;
  try {
    sent = await sock.sendMessage(m.chat, { text: FRAMES[0] }, { quoted: m });
  } catch {
    return m.reply("❌ Gagal mengirim pesan.");
  }

  const jid = `${num}@s.whatsapp.net`;

  const [results, profileName, profilePic] = await Promise.all([
    sock.onWhatsApp(num).catch(() => null),

    sock.fetchStatus(jid).catch(() => null),

    sock.profilePictureUrl(jid, "image").catch(() => null),

    (async () => {
      for (let i = 1; i < FRAMES.length; i++) {
        await sleep(700);
        try {
          await sock.sendMessage(m.chat, { text: FRAMES[i], edit: sent.key });
        } catch { break; }
      }
    })(),
  ]);

  await sleep(400);

  const isRegistered = Array.isArray(results) && results.length > 0 && results[0]?.exists;
  const displayNum = `+${num}`;

  if (!isRegistered) {
    const finalText =
      `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴛᴇʀᴅᴀꜰᴛᴀʀ ᴅɪ ᴡᴀ*\n\n` +
      `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
      `┃ 🔴 Status : *Tidak Aktif / Tidak Terdaftar*\n` +
      `┃ 📱 Nomor  : ${displayNum}\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Nomor ini tidak terdaftar di WhatsApp.`;
    try {
      await sock.sendMessage(m.chat, { text: finalText, edit: sent.key });
    } catch {
      await m.reply(finalText);
    }
    return;
  }

  const resultJid  = results[0]?.jid || jid;
  const status     = profileName?.status || "Tidak ada status";
  const hasPic     = !!profilePic;

  const caption =
    `✅ *ɴᴏᴍᴏʀ ᴛᴇʀᴅᴀꜰᴛᴀʀ ᴅɪ ᴡᴀ*\n\n` +
    `╭┈┈⬡「 📋 *ᴘʀᴏꜰɪʟ* 」\n` +
    `┃ 🟢 Status WA : *Aktif*\n` +
    `┃ 📱 Nomor     : ${displayNum}\n` +
    `┃ 🔗 JID       : ${resultJid}\n` +
    `┃ 💬 Info      : ${status}\n` +
    `┃ 🖼️ Foto      : ${hasPic ? "Ada" : "Tidak ada / privat"}\n` +
    `╰┈┈┈┈┈┈┈┈⬡`;

  try {
    if (hasPic) {
      
      await sock.sendMessage(m.chat, { delete: sent.key });
      await sleep(300);
      await sock.sendMessage(
        m.chat,
        {
          image: { url: profilePic },
          caption,
        },
        { quoted: m }
      );
    } else {
      await sock.sendMessage(m.chat, { text: caption, edit: sent.key });
    }
  } catch {
    await m.reply(caption);
  }
}

export { pluginConfig as config, handler }