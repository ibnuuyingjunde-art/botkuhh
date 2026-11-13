import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const run = promisify(exec);

const pluginConfig = {
  name: "stickerly",
  alias: ["randomsticker", "stickerrandom"],
  category: "fun",
  description: "Kirim sticker random dari Sticker.ly",
  usage: ".stickerly",
  example: ".stickerly",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function toWebp(buffer, mime) {
  const tmp = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const ext = mime.includes("png") ? "png" : mime.includes("gif") ? "gif" : "jpg";
  const inp = path.join(tmp, `sticker_in_${id}.${ext}`);
  const out = path.join(tmp, `sticker_out_${id}.webp`);
  fs.writeFileSync(inp, buffer);
  try {
    await run(
      `ffmpeg -y -i "${inp}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0" -c:v libwebp -quality 80 "${out}"`,
      { timeout: 30000 },
    );
    return fs.readFileSync(out);
  } finally {
    try { fs.unlinkSync(inp); } catch {}
    try { fs.unlinkSync(out); } catch {}
  }
}

async function handler(m, { sock }) {
  m.react("🕕");
  try {
    const res = await axios.get(
      `https://api.azbry.com/api/random/stickerly?t=${Date.now()}`,
      { responseType: "arraybuffer", timeout: 15000 },
    );

    const mime = res.headers["content-type"] || "image/jpeg";
    let buffer = Buffer.from(res.data);

    if (!mime.includes("webp")) {
      buffer = await toWebp(buffer, mime);
    }

    await sock.sendMessage(m.chat, {
      sticker: buffer,
      contextInfo: { ...saluranCtx() },
    });

    m.react("✅");
  } catch (e) {
    console.error("[Stickerly]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };