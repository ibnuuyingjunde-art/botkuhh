import { delay } from "ichigo";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "dmsg",
  alias: ["deletemsg", "delmsg"],
  category: "owner",
  description: "Menghapus pesan orang lain tanpa role admin",
  usage: ".dmsg",
  example: ".dmsg (sambil reply pesan target)",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  if (!m.quoted) {
    return m.reply("❌ Reply pesan yang ingin diproses (dihapus).");
  }

  await m.react("🕕");
  try {
    const chatId = m.chat;
    const stanzaId = m.quoted.id;

    const tempId = await sock.relayMessage(
      chatId,
      {
        groupStatusMessageV2: {
          message: {
            extendedTextMessage: {
              text: "",
              contextInfo: {
                isGroupStatus: true,
              },
            },
          },
        },
      },
      {}
    );

    const tempId2 = await sock.relayMessage(
      chatId,
      {
        protocolMessage: {
          key: {
            remoteJid: chatId,
            fromMe: true,
            id: tempId,
          },
          type: 14,
          editedMessage: {
            extendedTextMessage: {
              text: "\0",
              contextInfo: {
                isGroupStatus: false,
              },
            },
          },
        },
      },
      {
        messageId: stanzaId,
      }
    );

    await delay(100);

    await Promise.allSettled([
      sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          id: tempId,
          fromMe: true,
        },
      }),
      sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          id: tempId2,
          fromMe: true,
        },
      }),
    ]);

    await m.react("✅");
  } catch (e) {
    console.error("[DMSG]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };