import fetch from "node-fetch"; 
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "iqcmaker",
  alias: ["iqcm"], 
  category: "maker",
  description: "Fitur IQC Fake Quote Maker via Kyzo API",
  usage: ".iqcm <teks>|<replysender>|<replytext>",
  example: ".iqcm gmau|wlee|dih",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const API_KEY = "kyzo_f0e476030972b564";
const BASE_URL = "https://kyzorohan.web.id/api";

async function handler(m, { sock }) {
  const arg = m.args.join(" ").trim();

  if (!arg) {
    return m.reply(
      `❌ *Parameter teks tidak ditemukan.*\n\n` +
      `*Penggunaan:* ${m.prefix}${m.command} <teks>|<replysender>|<replytext>\n` +
      `*Contoh:* ${m.prefix}${m.command} gmau|wlee|dih`
    );
  }

  await m.react("🕕");
  try {
    
    const [teks, replysender = "User", replytext = "Pesan"] = arg.split("|");

    const url = `${BASE_URL}/iqc?teks=${encodeURIComponent(teks.trim())}&replysender=${encodeURIComponent(replysender.trim())}&replytext=${encodeURIComponent(replytext.trim())}&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.status || !data.output) throw new Error("Gagal generate gambar IQC");

    await sock.sendMessage(
      m.chat,
      { image: { url: data.output } },
      { quoted: m }
    );
    
    await m.react("✅");
  } catch (e) {
    console.error("[IQC_MAKER]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };