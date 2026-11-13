const pluginConfig = {
  name: "afterread",
  alias: [],
  category: "tools",
  description: "Mengirim pesan teks yang akan hancur beberapa detik setelah dibaca",
  usage: ".afterread <detik> <pesan>",
  example: ".afterread 10 pesan rahasia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock, args, text, prefix, command }) {
  const conn = sock || m.conn;

  if (!text) {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `> *Penggunaan:* \`${prefix + command} <detik> <pesan>\`\n` +
      `> *Contoh:* \`${prefix + command} 10 Halo, ini pesan rahasia\``
    );
  }

  let duration = 5; // Default 5 detik
  let messageText = text;

  if (args.length > 0 && !isNaN(args[0])) {
    duration = parseInt(args[0], 10);
    messageText = args.slice(1).join(" ");
  }

  if (!messageText) {
    messageText = "this message will disappear.";
  }

  try {
    await conn.relayMessage(
      m.chat,
      {
        extendedTextMessage: {
          text: messageText,
          previewType: 0,
          contextInfo: {
            expiration: 0,
            ephemeralSettingTimestamp: Date.now(),
            disappearingMode: {
              initiator: 0,
              trigger: 1
            },
            afterReadDuration: duration
          },
          inviteLinkGroupTypeV2: 0
        }
      },
      {}
    );
  } catch (err) {
    console.error("[AfterRead Error]", err);
    return m.reply(`⚠️ *Gagal mengirim pesan afterread:* ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };