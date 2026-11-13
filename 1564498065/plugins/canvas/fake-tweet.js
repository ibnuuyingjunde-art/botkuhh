import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";
import { ImageUploadService } from "node-upload-images";

const pluginConfig = {
  name: "fake-tweet",
  alias: ["ftweet", "tweetfake"],
  category: "canvas",
  description: "Buat tweet palsu untuk hiburan",
  usage: ".fake-tweet | nama | username | teks",
  example:
    ".fake-tweet | Penguin Torvalds | linux_enjoyer | Just setting up my twttr",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api.obscuraworks.org/api/maker/tweet";
const KEY = config.APIkey.obscura;

async function handler(m, { sock }) {
  const raw = m.text?.trim();
  if (!raw || !raw.includes("|")) {
    return m.reply(
      `🐦 *ꜰᴀᴋᴇ ᴛᴡᴇᴇᴛ*\n\n` +
        `- Buat tweet palsu buat hiburan 😂\n` +
        `- Format dipisah pakai |\n\n` +
        `- Bisa pakai reply gambar` +
        `\`${m.prefix}fake-tweet | Nama | Username | Teks tweet\``,
    );
  }

  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length < 4) {
    return m.reply(
      `🐦 *ꜰᴏʀᴍᴀᴛ ᴋᴜʀᴀɴɢ*\n\n` + `- Butuh: Nama | Username | Teks tweet`,
    );
  }

  m.react("🕕");

  try {
    const avatar =
      m.isImage || m.quoted?.isImage
        ? await uploadPhoto(m)
        : await sock?.profilePictureUrl?.(m.sender, "image") || "https://img1.pixhost.to/images/10801/670256545_upload.jpg"

    const body = {
      text: parts[3],
      avatar,
      name: parts[1],
      username: parts[2],
      theme: "dim",
      verified: "true",
      retweets: "0",
      likes: "0",
      client: "Twitter for iPhone",
    };

    const r = await fetch(API, {
      method: "POST",
      headers: {
        Accept: "application/json, image/*, audio/*, video/*",
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const buf = Buffer.from(await r.arrayBuffer());

    m.react("✅");
    await sock.sendMedia(m.chat, buf, null, m, { type: "image" });
  } catch (e) {
    console.log(e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

async function uploadPhoto(m) {
  try {
    const service = new ImageUploadService("pixhost.to");
    const b = m.quoted?.isMedia
      ? await m.quoted.download()
      : await m.download();
    let { directLink } = await service.uploadFromBinary(b, "img.jpg");
    return directLink;
  } catch {}
}

export { pluginConfig as config, handler };