import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "spotplay",
  alias: ["splay", "sp"],
  category: "search",
  description: "Putar musik dari Spotify",
  usage: ".spotplay <query>",
  example: ".spotplay neffex grateful",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const query = m.text?.trim();
  if (!query)
    return m.reply(`⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n> \`${m.prefix}spotplay <query>\``);

  await m.react("🕕");

  try {
    const { data } = await axios.get(
      "https://api-cloud.my.id/downloader/spotify2",
      { params: { query }, timeout: 30000 },
    );

    const result = data?.result;

    if (!data?.status || !result?.download_url) {
      await m.react("❌");
      return m.reply("❌ Lagu Spotify tidak ditemukan atau gagal diambil.");
    }

    await sock.sendMedia(m.chat, result.download_url, null, m, {
      type: "audio",
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${result.artist || "Spotify"} - ${result.title || "audio"}.mp3`,
    });

    await m.react("✅");
  } catch (e) {
    console.error("[Spotplay Error]", e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };