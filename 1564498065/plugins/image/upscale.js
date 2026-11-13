const pluginConfig = {
  name: "upscale",
  alias: ["hd", "enhance", "upscaler"],
  category: "image",
  description: "Perbesar resolusi & pertajam gambar (super-resolution)",
  usage: ".upscale [reply gambar] atau .upscale <url_gambar>",
  example: ".upscale https://contoh.com/gambar.jpg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 3,
  isEnabled: true,
};

const API_URL = "https://ai-services.visual-paradigm.com/api/super-resolution/file";
const UGUU_URL = "https://uguu.se/upload";

function detectExt(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "webp";
  return "jpg";
}

async function getInputBuffer(m) {
  
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mediaType || "";
  if (/image/.test(mime)) {
    const buffer = await q.download();
    if (buffer) return { buffer, mime };
  }

  const args = m.text?.split(" ").slice(1) || [];
  const url = args[0];
  if (url && /^https?:\/\//i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal ambil gambar dari URL (status ${res.status})`);
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const mime = res.headers.get("content-type") || "image/jpeg";
    return { buffer, mime };
  }

  return null;
}

async function upscale(buffer, mime) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), "image." + (mime.split("/")[1] || "png"));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { accept: "*/*" },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upscale gagal (status ${res.status})${text ? ` - ${text}` : ""}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function uploadToUguu(buffer) {
  const ext = detectExt(buffer);
  const form = new FormData();
  form.append("files[]", new Blob([buffer]), `upscaled_${Date.now()}.${ext}`);

  const res = await fetch(UGUU_URL, {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!data || !data.success) throw new Error("Upload hasil ke uguu.se gagal");
  return data.files[0];
}

async function handler(m, { sock, config: botConfig }) {
  try {
    const input = await getInputBuffer(m);

    if (!input) {
      return m.reply(
        `❌ Reply gambar atau kirim URL gambar\n*Contoh:* ${botConfig.command?.prefix || "."}upscale https://contoh.com/gambar.jpg`
      );
    }

    await m.reply("⏳ Memperbesar resolusi gambar, tunggu sebentar...");

    const result = await upscale(input.buffer, input.mime);
    if (!result || result.length < 1000) throw new Error("Hasil gambar tidak valid");

    await sock.sendMessage(
      m.chat,
      {
        image: result,
        caption: `✨ *Berhasil di-upscale!*`,
      },
      { quoted: m }
    );
  } catch (e) {
    console.error(e);
    await m.reply(`❌ Error: ${e.message}`);
  }
}

export default {
  config: pluginConfig,
  handler,
};