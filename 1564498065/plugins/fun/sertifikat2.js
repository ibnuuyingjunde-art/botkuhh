
import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const config = {
  name: "sertifikat2",
  alias: ["sertif2", "sertifikattolol2", "sertolol2"],
  category: "fun",
  description: "Generate sertifikat tolol dengan nama kustom",
  usage: ".sertifikat2 <nama>",
  example: ".sertifikat2 Budi Santoso",
  cooldown: 5,
  energi: 1,
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isEnabled: true,
};

const API = "https://api-xemoz-official.my.id/api/maker/sertifikat-tolol.php";

async function fetchSertifikat(text) {
  const { data } = await axios.get(API, {
    params: { text },
    timeout: 20000,
  });

  if (!data?.result?.image) throw new Error("Gagal generate sertifikat.");

  const base64 = data.result.image.replace(/^data:image\/\w+;base64,/, "");
  const mimetype = data.result.mimetype || "image/jpeg";

  return { base64, mimetype };
}

async function handler(m, { sock }) {
  const text = (m.text || m.fullArgs || "").trim();

  if (!text) {
    return m.reply(
      `╭─ 📜 *SERTIFIKAT TOLOL*\n` +
      `│· Usage  : \`${m.prefix}sertifikat2 <nama>\`\n` +
      `│· Contoh : \`${m.prefix}sertifikat2 Budi Santoso\`\n` +
      `╰───────────────────────────`,
    );
  }

  await m.react("⏳");

  try {
    const { base64, mimetype } = await fetchSertifikat(text);
    const buffer = Buffer.from(base64, "base64");

    await sock.sendMessage(
      m.chat,
      {
        image: buffer,
        mimetype,
        caption: `📜 *Sertifikat Tolol*\n> ${text}`,
      },
      { quoted: m },
    );

    await m.react("✅");

  } catch (e) {
    console.error("[sertifikat2]", e.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };