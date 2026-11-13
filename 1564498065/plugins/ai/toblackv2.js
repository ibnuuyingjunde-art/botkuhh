import axios from "axios";
import FormData from "form-data";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "toblackv2",
  alias: ["blackv2", "hitamv2", "tohitamv2"],
  category: "ai",
  description: "Ubah gambar ke skin tone lebih gelap (API only)",
  usage: ".toblackv2 (reply gambar)",
  example: ".toblackv2",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

const PROMPT =
  "Make this person the skin is very black, but skin tone still natural";

function isImageBuffer(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return true;
  return false;
}

function findBase64(o, depth = 0) {
  if (depth > 5 || o == null) return null;
  if (typeof o === "string") {
    const m = o.match(/^data:image\/[\w.+-]+;base64,(.+)$/s);
    if (m) return Buffer.from(m[1], "base64");
    if (o.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(o)) {
      const b = Buffer.from(o, "base64");
      return isImageBuffer(b) ? b : null;
    }
    return null;
  }
  if (Array.isArray(o)) {
    for (const v of o) {
      const b = findBase64(v, depth + 1);
      if (b) return b;
    }
    return null;
  }
  if (typeof o === "object") {
    for (const v of Object.values(o)) {
      const b = findBase64(v, depth + 1);
      if (b) return b;
    }
  }
  return null;
}

function findUrl(o, depth = 0) {
  if (depth > 5 || o == null) return null;
  if (typeof o === "string") return /^https?:\/\//i.test(o.trim()) ? o.trim() : null;
  if (Array.isArray(o)) {
    for (const v of o) {
      const u = findUrl(v, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof o === "object") {
    for (const k of ["url", "image", "result", "output", "link", "data", "images"]) {
      if (k in o) {
        const u = findUrl(o[k], depth + 1);
        if (u) return u;
      }
    }
    for (const v of Object.values(o)) {
      const u = findUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

async function uploadKappa(buf) {
  const form = new FormData();
  form.append("file", buf, { filename: "img.jpg" });
  const r = await axios.post("https://kappa.lol/api/upload", form, {
    headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  const d = r.data;
  if (typeof d === "string" && /^https?:\/\//i.test(d.trim())) return d.trim();
  const found = findUrl(d);
  if (found) return found;
  if (d?.id) return `https://kappa.lol/${d.id}${d.ext || ""}`;
  throw new Error("Upload ke kappa.lol gagal: respon tidak berisi link");
}

async function downloadImage(url) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const img = Buffer.from(r.data);
  if (!isImageBuffer(img)) throw new Error("Link hasil dari API bukan gambar valid");
  return img;
}

async function blackify(buffer) {
  const imgUrl = await uploadKappa(buffer);
  const r = await axios.get(
    `https://api-cloud.my.id/ai/nanobanana?url=${encodeURIComponent(imgUrl)}&prompt=${encodeURIComponent(PROMPT)}`,
    {
      responseType: "arraybuffer",
      timeout: 120000,
      validateStatus: () => true,
    },
  );

  const buf = Buffer.from(r.data);
  if (isImageBuffer(buf)) return buf;

  const text = buf.toString("utf8").trim();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const b64 = json ? findBase64(json) : null;
  if (b64) {
    if (!isImageBuffer(b64)) throw new Error("Data base64 dari API bukan gambar valid");
    return b64;
  }

  const url = json ? findUrl(json) : null;
  if (url) return downloadImage(url);

  throw new Error(`Respon API: ${text.slice(0, 200) || "(kosong)"}`);
}

async function handler(m, { sock }) {
  const quotedIsImage =
    m.quoted && (m.quoted.type === "imageMessage" || m.quoted.isMedia);
  const isImage = m.isImage || quotedIsImage;

  if (!isImage) {
    return m.reply(
      `🖤 *ʙʟᴀᴄᴋ sᴛʏʟᴇ ᴠ2*\n\n> Kirim/reply gambar\n\n\`${m.prefix}toblackv2\``,
    );
  }

  await m.react("⏳");

  try {
    let buffer;
    if (m.quoted?.isMedia) buffer = await m.quoted.download();
    else if (m.isMedia) buffer = await m.download();

    if (!buffer || buffer.length === 0) {
      await m.react("❌");
      return m.reply(`❌ Gagal mendownload gambar. Coba kirim ulang gambarnya.`);
    }

    if (!isImageBuffer(buffer)) {
      await m.react("❌");
      return m.reply(`❌ Format gambar tidak valid. Gunakan JPG atau PNG.`);
    }

    let result;
    try {
      result = await Promise.race([
        blackify(buffer),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 120_000),
        ),
      ]);
    } catch (err) {
      console.error("[toblackv2] gagal:", err?.message || err);
      await m.react("❌");
      if (err?.message === "timeout") {
        return m.reply(`⏱️ Request timeout. Server AI sedang lambat, coba lagi nanti.`);
      }
      return m.reply(
        `❌ AI gagal memproses gambar.\n\n*Detail:* ${err?.message || "Unknown error"}`,
      );
    }

    await m.react("✅");
    await sock.sendMedia(m.chat, result, null, m, { type: "image" });
  } catch (error) {
    console.error("[toblackv2] Error umum:", error?.message || error);
    await m.react("☢");
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };