import axios from 'axios';

const pluginConfig = {
  name: "iqc",
  alias: ["fakechat", "fc"],
  category: "maker",
  description: "Bikin fake chat style iMessage/WhatsApp iPhone",
  usage: ".iqc <teks>",
  example: ".iqc halo",
  isEnabled: true,
};

const API_URL = 'https://api-cloud.my.id/maker/iqc';

async function handler(m, { conn, sock, client, text, prefix, command }) {
  const bot = conn || sock || client;
  const msgText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");

  if (!msgText) {
    return m.reply(`Contoh: *${prefix}${command} halo*`);
  }

  await m.react("⏳");

  try {
    const { data } = await axios.get(API_URL, {
      params: { text: msgText },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!data || !data.status || !data.result) {
      throw new Error('Respons API tidak valid');
    }

    // result berupa data URI: "data:image/png;base64,...."
    const base64 = String(data.result).replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64, 'base64');

    await bot.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
    await m.react("✅");
  } catch (error) {
    console.error("[IQC Error]:", error);
    await m.react("❌");
    await m.reply("❌ *GAGAL*\n\n> " + error.message);
  }
}

export { pluginConfig as config, handler };