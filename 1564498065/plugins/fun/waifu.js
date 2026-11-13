import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const pluginConfig = {
  name: "waifu",
  alias: ["randomwaifu"],
  category: "fun",
  description: "Kirim gambar waifu random",
  usage: ".waifu",
  example: ".waifu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  m.react("🕕");
  try {
    const imageUrl = `https://api.azbry.com/api/random/waifu?t=${Date.now()}`;

    await sock.sendMedia(m.chat, imageUrl, `🌸 *WAIFU RANDOM*`, m, {
      type: "image",
      contextInfo: {
        ...saluranCtx(),
      },
    });

    m.react("✅");
  } catch (e) {
    console.error("[Waifu]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };