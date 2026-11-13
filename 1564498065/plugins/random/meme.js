import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const pluginConfig = {
  name: "meme",
  alias: ["randommeme", "memes"],
  category: "fun",
  description: "Kirim meme random",
  usage: ".meme",
  example: ".meme",
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
    const imageUrl = `https://api.azbry.com/api/random/meme?t=${Date.now()}`;

    await sock.sendMedia(m.chat, imageUrl, `😂 *MEME RANDOM*`, m, {
      type: "image",
      contextInfo: {
        ...saluranCtx(),
      },
    });

    m.react("✅");
  } catch (e) {
    console.error("[Meme]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };