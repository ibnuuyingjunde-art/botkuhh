import axios from "axios";

const API_BASE_URL = process.env.ALIGHT_API_BASE_URL_REACT || "https://api.theresav.eu/api/premium";
const API_KEY_ENC = "VGF5Um9vQVBJa2V5";
const API_KEY = process.env.REACTCH_API_KEY || Buffer.from(API_KEY_ENC, "base64").toString("utf-8");

const CHANNEL_REGEX = /^https?:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/\d+\/?$/i;
const EMOJI_REGEX = /^\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*$/u;

async function apiGet(endpoint, params) {
  if (!API_KEY) throw new Error("API key belum dikonfigurasi.");
  const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
    params,
    timeout: 45_000,
    headers: { "x-apikey": API_KEY },
    validateStatus: () => true,
  });
  const data = response.data || {};
  if (response.status < 200 || response.status >= 300 || data.status === false) {
    throw new Error(data.error || data.message || `API mengembalikan HTTP ${response.status}`);
  }
  return data;
}

const pluginConfig = {
  name: "reactch",
  alias: ["reactchannel", "rch"],
  category: "tools",
  description: "Kirim reaksi emoji ke postingan channel WhatsApp",
  usage: ".reactch <link_post_channel> <emoji>",
  example: ".reactch https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c/1452 🥹",
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const input = m.text?.trim();

  if (!input) {
    return m.reply(`🎭 *REACT CHANNEL*\n\nFormat:\n> ${m.prefix}reactch <link_post> <emoji>\n\nContoh:\n> ${m.prefix}reactch https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c/1452 🥹\n\n(Link harus sampai ke ID postingan, bukan hanya link channel.)`);
  }

  const parts = input.split(/\s+/);
  const url = parts[0];
  const reaction = parts.slice(1).join("");

  if (!CHANNEL_REGEX.test(url)) {
    return m.reply("❌ Link tidak valid.\n\nGunakan link postingan channel, contoh:\nhttps://whatsapp.com/channel/0029Vb.../1452");
  }
  if (!reaction) {
    return m.reply(`❌ Emoji belum diisi.\n\nContoh:\n> ${m.prefix}reactch ${url} 🥹`);
  }
  if (!EMOJI_REGEX.test(reaction)) {
    return m.reply("❌ Reaksi harus berupa satu emoji.");
  }
  if (!API_KEY) return m.reply("❌ Fitur REACTCH belum dikonfigurasi.");

  await m.react("⏳");
  try {
    await apiGet("reactch", { url, reaction });
    await m.react("✅");
    return m.reply(`✅ *REAKSI TERKIRIM*\n\n🔗 Post: ${url}\n${reaction} Reaksi: *${reaction}*`);
  } catch (error) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL MENGIRIM REAKSI*\n\n> ${error.message || "Terjadi kesalahan pada API."}`);
  }
}

export { pluginConfig as config, handler };