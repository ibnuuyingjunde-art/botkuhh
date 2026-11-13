import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "memejarvis",
  alias: [],
  category: "maker",
  description: "Buat meme gaya Jarvis dari teks",
  usage: ".memejarvis <teks>",
  example: ".memejarvis jarvis tolong itu anunya di anu anukan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 8,
  energi: 5,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text?.trim();

  if (!text) {
    return m.reply(`Contoh:\n${m.prefix + m.command} jarvis tolong itu anunya di anu anukan`);
  }

  await m.react("⏳");

  try {
    const apiUrl = `https://api.synoxichigo.xyz/canvas/jarvis-meme?text=${encodeURIComponent(text)}`;
    const res = await axios.get(apiUrl, { responseType: "arraybuffer" });
    const buffer = Buffer.from(res.data);

    await sock.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: "",
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: global.idSaluran || "120363420255123654@newsletter",
            serverMessageId: 1,
            newsletterName: global.namaSaluran || "lyniX's MD Channel",
          },
        },
      },
      { quoted: m }
    );

    await m.react("✅");
  } catch (error) {
    console.log("[PLUGIN MEMEJARVIS ERROR]", error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };