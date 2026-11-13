import te from "../../src/lib/ichigo-error.js";
import cfg from "../../config.js";

const config = {
  name: "remini",
  alias: ["hd", "enhance", "upscale"],
  category: "tools",
  description: "Enhance gambar jadi HD",
  usage: ".remini (reply gambar)",
  example: ".remini",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api.obscuraworks.org/api/v2/tools/upscale";
const KEY = cfg.APIkey.obscura;

async function up(buf) {
  const f = new FormData();
  f.append("image", new Blob([buf], { type: "image/jpeg" }), "img.jpg");

  const r = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
    },
    body: f,
  });

  if (!r.ok) throw new Error(`Upscale API error: ${r.status} ${await r.text()}`);

  const result = Buffer.from(await r.arrayBuffer());
  if (!result || result.length < 100) throw new Error("Result buffer kosong");

  return result;
}

async function handler(m, { sock }) {
  const img = m.isImage || (m.quoted && m.quoted.type === "imageMessage");

  if (!img) {
    return m.reply(
      `*🪁 HD IMAGE*\n> Reply gambar\n\n\`\`\`${m.prefix}remini\`\`\``,
    );
  }

  m.react("🕕");

  try {
    let b = m.quoted?.isMedia ? await m.quoted.download() : await m.download();
    if (!b || b.length < 100) throw new Error("Download gambar gagal");

    const r = await up(b);

    m.react("✅");

    await sock.sendMedia(m.chat, r, null, m, { type: "image" });
  } catch (e) {
    console.log("[remini error]", e.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };