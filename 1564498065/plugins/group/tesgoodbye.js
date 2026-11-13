import config from "../../config.js";
import { sendGoodbyeMessage } from "./goodbye.js";

const pluginConfig = {
  name: "tesgoodbye",
  alias: ["testgoodbye", "tesgb", "cekgoodbye"],
  category: "group",
  description: "Preview/test tampilan goodbye message di grup ini",
  usage: ".tesgoodbye [@user]",
  example: ".tesgoodbye @user",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    const mentioned = m.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted    = m.quoted?.sender || m.quoted?.participant;
    const target     = mentioned || quoted || m.sender;

    m.react("🕕");

    const groupMeta = await sock.groupMetadata(m.chat);

    const ok = await sendGoodbyeMessage(sock, m.chat, target, groupMeta, { force: true });

    if (ok) {
      m.react("✅");
    } else {
      m.react("☢");
      return m.reply(
        `╔═══════════════════╗\n║  ⚠️ *ᴛᴇs ɢᴀɢᴀʟ*\n╚═══════════════════╝\n\n` +
        `> Gagal mengirim tes goodbye. Cek console untuk detail error.`,
      );
    }
  } catch (error) {
    console.error("TesGoodbye Error:", error);
    m.react("☢");
    return m.reply(
      `╔═══════════════════╗\n║  ⚠️ *ᴇʀʀᴏʀ*\n╚═══════════════════╝\n\n` +
      `> Terjadi kesalahan saat menjalankan tes: ${error.message}`,
    );
  }
}

export { pluginConfig as config, handler };