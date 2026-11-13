import axios from "axios";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const pluginConfig = {
  name: "fakta",
  alias: ["randomfakta", "fact"],
  category: "fun",
  description: "Kirim fakta random",
  usage: ".fakta",
  example: ".fakta",
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
    const { data } = await axios.get("https://api.azbry.com/api/random/fakta", {
      timeout: 10000,
    });

    const fakta = data?.result?.fakta;
    const total = data?.result?.total;

    if (!fakta) {
      m.react("☢");
      return m.reply(`❌ *Gagal mendapatkan fakta*\n\n> Coba lagi nanti.`);
    }

    await m.reply(
      `💡 *FAKTA RANDOM*\n\n` +
      `_${fakta}_\n\n` +
      `> 📚 Total fakta: ${total || "?"}\n`
    );

    m.react("✅");
  } catch (e) {
    console.error("[Fakta]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };