import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";

const pluginConfig = {
  name: "fake-xnxx",
  alias: ["fxnxx", "xnxxfake"],
  category: "canvas",
  description: "Buat komentar XNXX palsu buat hiburan",
  usage: ".fake-xnxx nama | komentar | likes | dislikes",
  example: ".fake-xnxx adwan | This is a sample comment | 1.2k | 24",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api.obscuraworks.org/api/maker/fake-xnxx";
const KEY = config.APIkey.obscura;

async function handler(m, { sock }) {
  const raw = m.text?.trim();

  let input = raw || "";
  if (input.startsWith(m.prefix)) {
    input = input.split(" ").slice(1).join(" ").trim();
  }

  if (input.startsWith("|")) {
    input = input.slice(1).trim();
  }

  if (!input || !input.includes("|")) {
    return m.reply(
      `🔞 *ꜰᴀᴋᴇ xɴxxx*\n\n` +
      `- Buat komentar palsu buat hiburan 😂\n` +
      `- Format dipisah pakai |\n\n` +
      `*Format:*\n\`${m.prefix || '.'}fake-xnxx Nama | Komentar | Likes | Dislikes\`\n\n` +
      `*Contoh:*\n\`${m.prefix || '.'}fake-xnxx adwan | hai cantik | 100 | 5\``
    );
  }

  const parts = input.split("|").map((s) => s.trim());

  if (parts.length < 2) {
    return m.reply(
      `🔞 *ꜰᴏʀᴍᴀᴛ ᴋᴜʀᴀɴɢ*\n\n` +
      `- Butuh setidaknya: Nama | Komentar`
    );
  }

  m.react("🕕");

  try {
    
    const params = new URLSearchParams({
      name: parts[0],
      quote: parts[1],
      likes: parts[2] || "0",
      dislikes: parts[3] || "0",
    });

    const r = await fetch(`${API}?${params}`, {
      headers: {
        Accept: "application/json, image/*, audio/*, video/*",
        Authorization: `Bearer ${KEY}`,
      },
    });

    if (!r.ok) {
        throw new Error(`HTTP Error: ${r.status}`);
    }

    const buf = Buffer.from(await r.arrayBuffer());

    m.react("✅");
    await sock.sendMedia(m.chat, buf, null, m, { type: "image" });
  } catch (e) {
    console.log("[ERROR FAKE-XNXX]:", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };