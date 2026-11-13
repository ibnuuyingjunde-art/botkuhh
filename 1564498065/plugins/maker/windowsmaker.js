import fetch from "node-fetch"; 
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "windowsmaker",
  alias: ["wm2"],
  category: "maker",
  description: "Fitur Windows Media Player Maker via Kyzo API",
  usage: ".wm <teks>",
  example: ".wm Kazs",
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
      `*Penggunaan:* ${m.prefix}${m.command} <teks>\n` +
      `*Contoh:* ${m.prefix}${m.command} Kazs`
    );
  }

  await m.react("🕕");
  try {
    const url = `${BASE_URL}/wmpmaker?text=${encodeURIComponent(arg)}&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.status || !data.output) throw new Error("Gagal generate gambar WMP Maker");

    await sock.sendMessage(
      m.chat,
      { image: { url: data.output } },
      { quoted: m }
    );
    
    await m.react("✅");
  } catch (e) {
    console.error("[WINDOWS_MAKER]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };