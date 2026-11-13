import { delay } from "ichigo";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "fakemsg1",
  alias: ["fake1"],
  category: "owner",
  description: "Mengedit/memalsukan isi pesan yang di-reply",
  usage: ".fakemsg1 <teks pengganti>",
  example: ".fakemsg1 Wkwk kena edit",
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
    return m.reply("❌ Reply pesan yang ingin diproses.");
  }

  const text = m.args.join(" ").trim();
  if (!text) {
    return m.reply(
      `❌ *Teks pengganti tidak boleh kosong.*\n\n` +
      `*Penggunaan:* ${m.prefix}${m.command} <teks pengganti>\n` +
      `*Contoh:* ${m.prefix}${m.command} Halo dari pesan palsu`
    );
  }

  const stanzaId = m.quoted.id; 

  await m.react("🕕");
  try {
    
    const tempId = await sock.relayMessage(
      m.chat,
      {
        extendedTextMessage: {
          text: "",
          contextInfo: {
            isGroupStatus: true,
          },
        },
      },
      {}
    );

    const tempId2 = await sock.relayMessage(
      m.chat,
      {
        protocolMessage: {
          key: {
            remoteJid: m.chat,
            fromMe: true,
            id: tempId,
          },
          type: 14,
          editedMessage: {
            extendedTextMessage: {
              text: text,
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
      sock.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          id: tempId,
          fromMe: true,
        },
      }),
      sock.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          id: tempId2,
          fromMe: true,
        },
      }),
    ]);

    await m.react("✅");
  } catch (e) {
    console.error("[FAKEMSG1]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };