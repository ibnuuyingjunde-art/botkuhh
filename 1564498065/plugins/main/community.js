import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";
import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";

const pluginConfig = {
  name: "community",
  alias: ["komunitas", "cc", "codecommunity"],
  category: "main",
  description: "Kirim kartu undangan Code Community dengan tombol join",
  usage: ".community",
  example: ".community",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  isBotAdmin: false,
  cooldown: 5,
  energi: 0,
  limit: 0,
  isEnabled: true,
};

const DEFAULTS = {
  image: "https://litter.catbox.moe/cenuvu.jpg",
  title: "Code Community",
  description:
    "* No Rasis\n* No 18+\n* No Spam teks/stc/sw gc\n* Promosi 1x sehari\n* Fun and Learning\n\nSilakan kenalan, sharing ilmu, dan belajar bareng.",
  joinUrl: "https://chat.whatsapp.com/IbQcd51ItVU8ABnvGMXA8q?s=cl&p=a&ilr=0",
};

async function handler(m, { sock }) {
  const cfg = { ...DEFAULTS, ...(config.community || {}) };

  await m.react("🕕");
  try {
    const ui = new A2UI();

    const image = ui.image(cfg.image, { variant: "header", fit: "cover" });
    const title = ui.text(cfg.title, { variant: "h1" });
    const description = ui.text(cfg.description, { variant: "body" });

    ui.root([image, title, description]);

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      buttons: [
        {
          name: "cta_url",
          params: {
            display_text: "Join",
            url: cfg.joinUrl,
          },
        },
      ],
      quoted: m,
    });

    await m.react("✅");
  } catch (e) {
    console.error(e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };