import FormData from "form-data";
import fetch from "node-fetch";
import mime from "mime-types";
import { fileTypeFromBuffer } from "file-type";
import { downloadMediaMessage, getContentType, prepareWAMessageMedia, generateWAMessageFromContent } from "ichigo";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "tourl",
  alias: ["upload", "catbox", "url"],
  category: "tools",
  description: "Upload media ke multiple host dan dapatkan URL",
  usage: ".tourl (reply/kirim media)",
  example: ".tourl",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const termaiKey = "AIzaBj7z2z3xBjsk"; 
const termaiDomain = "https://c.termai.cc";

async function detectExt(buffer, fallback = "bin") {
  try {
    const type = await fileTypeFromBuffer(buffer);
    return type?.ext || fallback;
  } catch {
    return fallback;
  }
}

async function uploadToTermai(buffer) {
  const ext = await detectExt(buffer, "bin");
  const form = new FormData();
  form.append("file", buffer, { filename: `file.${ext}` });

  const res = await fetch(`${termaiDomain}/api/upload?key=${termaiKey}`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    timeout: 120000,
  });

  if (!res.ok) throw new Error("Termai gagal");
  const data = await res.json();

  if (!data?.status || !data?.path) {
    throw new Error("Invalid response");
  }

  return { host: "Termai", url: data.path, expires: "Unknown" };
}

async function uploadToPone(buffer, filename) {
  const form = new FormData();
  form.append("files[]", buffer, {
    filename,
    contentType: mime.lookup(filename) || "application/octet-stream",
  });

  const res = await fetch("https://pone.rs/upload.php", {
    method: "POST",
    body: form,
    headers: {
      ...form.getHeaders(),
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      "accept": "*/*",
      "origin": "https://pone.rs",
      "referer": "https://pone.rs/",
    },
    timeout: 60000,
  });

  if (!res.ok) throw new Error("Pone gagal");
  const data = await res.json();
  const url = data?.files?.[0]?.url?.replaceAll("\\/", "/") || null;
  if (!data?.success || !url) throw new Error("Invalid response");
  return { host: "Pone", url, expires: "Permanent" };
}

async function uploadToKappa(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: mime.lookup(filename) || "application/octet-stream",
  });

  const res = await fetch("https://kappa.lol/api/upload", {
    method: "POST",
    body: form,
    headers: {
      ...form.getHeaders(),
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      "Accept": "*/*",
      "Origin": "https://kappa.lol",
      "Referer": "https://kappa.lol/",
    },
    timeout: 60000,
  });

  if (!res.ok) throw new Error("Kappa gagal");
  const raw = await res.text();
  const data = JSON.parse(raw);
  const url = data?.link || null;
  if (!url) throw new Error("Invalid response");
  return { host: "Kappa", url, expires: "Permanent" };
}

async function uploadToNekohime(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: mime.lookup(filename) || "application/octet-stream",
  });
  const res = await fetch("https://cdn.nekohime.site/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    timeout: 120000,
  });
  if (!res.ok) throw new Error("Nekohime gagal");
  const data = await res.json();
  const url = data?.files?.[0]?.url || data?.files?.url || (Array.isArray(data?.files) ? data?.files[0] : data?.files);
  if (!url) throw new Error("Nekohime gagal");
  return { host: "Nekohime", url, expires: "Permanent" };
}

// ⚠️ Sesuaikan kalau endpoint upload CDN-nya beda
const ICHIGO_CDN_BASE = "https://cdn-ichigo.web.id";
const ICHIGO_CDN_UPLOAD = `${ICHIGO_CDN_BASE}/upload`;

async function uploadToIchigoCdn(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: mime.lookup(filename) || "application/octet-stream",
  });

  const res = await fetch(ICHIGO_CDN_UPLOAD, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    timeout: 120000,
  });

  if (!res.ok) throw new Error(`Ichigo CDN gagal (${res.status})`);
  const data = await res.json();
  if (data?.success === false) throw new Error(data?.error || "Ichigo CDN gagal");

  const first = Array.isArray(data?.files) ? data.files[0] : data?.files;
  let url =
    data?.url || data?.link || data?.path ||
    data?.data?.url || data?.file?.url ||
    first?.url || (typeof first === "string" ? first : null);
  if (!url) throw new Error("Invalid response");
  if (url.startsWith("/")) url = ICHIGO_CDN_BASE + url;

  return { host: "Ichigo CDN", url, expires: "Permanent" };
}

const UPLOADERS = [
  { name: "Ichigo CDN", fn: uploadToIchigoCdn },
  { name: "Pone", fn: uploadToPone },
  { name: "Kappa", fn: uploadToKappa },
  { name: "Termai", fn: uploadToTermai },
  { name: "Nekohime", fn: uploadToNekohime },
];

function getFileExtension(mimetype) {
  const mimeMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
    "application/zip": "zip",
  };
  return mimeMap[mimetype] || "bin";
}

async function handler(m, { sock }) {
  let media = null;
  let mimetype = null;
  let filename = "file";

  if (m.quoted?.message) {
    const type = getContentType(m.quoted.message);
    if (!type || type === "conversation" || type === "extendedTextMessage") {
      return m.reply("⚠️ Kak, tolong reply ke file (gambar/video/audio/berkas) ya!");
    }

    try {
      media = await downloadMediaMessage(
        { key: m.quoted.key, message: m.quoted.message },
        "buffer",
        {},
      );
      const content = m.quoted.message[type];
      mimetype = content?.mimetype || "application/octet-stream";
      filename = content?.fileName || `file.${getFileExtension(mimetype)}`;
    } catch (e) {
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  } else if (m.message) {
    const type = getContentType(m.message);
    if (!type || type === "conversation" || type === "extendedTextMessage") {
      let txt = `📤 *MEDIA UPLOADER* 📤\n\n`;
      txt += `Halo kak! Butuh link untuk media kamu? Aku bisa bantu uploadin ke berbagai server gratisan loh!\n\n`;
      txt += `*Cara Pakai:*\n`;
      txt += `👉 Kirim media dengan caption \`${m.prefix}tourl\`\n`;
      txt += `👉 Atau reply media yang udah ada dengan \`${m.prefix}tourl\``;
      return m.reply(txt);
    }

    try {
      media = await downloadMediaMessage(
        { key: m.key, message: m.message },
        "buffer",
        {},
      );
      const content = m.message[type];
      mimetype = content?.mimetype || "application/octet-stream";
      filename = content?.fileName || `file.${getFileExtension(mimetype)}`;
    } catch (e) {
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  }

  if (!media || media.length === 0) {
    return m.reply("❌ Waduh kak, medianya nggak kebaca. Coba kirim ulang deh!");
  }

  await m.react("🕕");

  const results = [];
  const failed = [];

  for (const uploader of UPLOADERS) {
    try {
      const result = await uploader.fn(media, filename);
      results.push(result);
    } catch (e) {
      failed.push(uploader.name);
    }
  }

  if (results.length === 0) {
    await m.react("❌");
    return m.reply(`❌ Aduh kak, semuanya pada error pas upload!\n\n> Gagal di server: ${failed.join(", ")}`);
  }

  let text = `🚀 *UPLOAD BERHASIL!* 🚀\n\n`;
  text += `Yeay! Media kamu udah berhasil di-upload ke server awan. Silakan pilih linknya dan salin pakai tombol di bawah ya kak! ✨\n\n`;

  let contentTxt = "";
  results.forEach((r, i) => {
    const status = r.expires === "Permanent" ? "∞ Permanen" : r.expires;
    contentTxt += `☁️ *Server :* ${r.host}\n`;
    contentTxt += `⏳ *Expired :* ${status}\n`;
    contentTxt += `🔗 *Link :*\n`;
    contentTxt += `${r.url}`;
    if (i < results.length - 1) contentTxt += `\n\n`;
  });

  text += contentTxt.split("\n").map(line => `${line}`).join("\n");

  if (failed.length > 0) {
    text += `\n\n⚠️ _Fyi kak, ada yang gagal di server: ${failed.join(", ")}_`;
  }

  const buttons = results.slice(0, 5).map((r) => ({
    name: "cta_copy",
    buttonParamsJson: JSON.stringify({
      display_text: `📋 Salin Link ${r.host}`,
      copy_code: r.url,
    }),
  }));

  try {
    const isImage = mimetype?.startsWith("image");
    const isVideo = mimetype?.startsWith("video");
    // Jalur utama: kirim langsung sebagai interactiveMessage (native flow), tanpa lewat konversi compat
    const header = { title: "", subtitle: "", hasMediaAttachment: false };
    if (isImage || isVideo) {
      const prepared = await prepareWAMessageMedia(
        isVideo ? { video: media } : { image: media },
        { upload: sock.waUploadToServer },
      );
      header.hasMediaAttachment = true;
      if (isVideo) header.videoMessage = prepared.videoMessage;
      else header.imageMessage = prepared.imageMessage;
    }
    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {},
            interactiveMessage: {
              header,
              body: { text },
              footer: { text: config.bot?.name || "lyniX's" },
              nativeFlowMessage: { buttons, messageParamsJson: "{}" },
            },
          },
        },
      },
      { quoted: m, userJid: sock.user?.id },
    );
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
  } catch (err) {
    console.error("[tourl] Gagal kirim tombol (relay):", err.message);
    try {
      const isImage = mimetype?.startsWith("image");
      const isVideo = mimetype?.startsWith("video");
      await sock.sendButton(
        m.chat,
        isImage || isVideo ? media : null,
        text,
        m,
        { buttons, type: isVideo ? "video" : "image" },
      );
    } catch (err2) {
      console.error("[tourl] Gagal kirim tombol:", err2.message);
      await m.reply(text);
    }
  }

  await m.react("✅");
}

export { pluginConfig as config, handler };