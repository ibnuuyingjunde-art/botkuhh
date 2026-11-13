import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "redbluememe",
  alias: [],
  category: "maker",
  description: "Buat meme red pill vs blue pill dari teks",
  usage: ".redbluememe <pertanyaan>|<pilihan kiri>|<pilihan kanan>",
  example: ".redbluememe Pilih spek cewe rambut apaa?|short hair|long hair",
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

  if (!text || !text.includes("|")) {
    return m.reply(
      `Contoh:\n${m.prefix + m.command} Pilih spek cewe rambut apaa?|short hair|long hair`
    );
  }

  const [atas, kiri, kanan] = text.split("|").map((v) => (v || "").trim());

  if (!atas || !kiri || !kanan) {
    return m.reply(
      `Format salah.\nContoh:\n${m.prefix + m.command} Pilih spek cewe rambut apaa?|short hair|long hair`
    );
  }

  await m.react("⏳");

  try {
    const apiUrl = `https://api.synoxichigo.xyz/canvas/red&blue-pill-meme?atas=${encodeURIComponent(atas)}&kiri=${encodeURIComponent(kiri)}&kanan=${encodeURIComponent(kanan)}`;
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
    console.log("[PLUGIN REDBLUEMEME ERROR]", error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };