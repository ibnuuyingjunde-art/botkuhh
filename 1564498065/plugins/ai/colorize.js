import te from "../../src/lib/ichigo-error.js";
import { ImageUploadService } from "node-upload-images";
import { Agent, fetch as undiciFetch } from "undici";

const pluginConfig = {
  name: "colorize",
  alias: ["warnai"],
  category: "ai",
  description: "Warnai foto hitam-putih jadi berwarna pakai AI",
  usage: ".colorize (reply gambar)",
  example: ".colorize",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

const API = "https://api.covenant.sbs/api/ai/nanana";
const KEY = "cov_live_4f4f3c990cba17587578cd13b7a5c53ae912ae93b91a272f";

const agent = new Agent({
  headersTimeout: 90000,
  bodyTimeout: 90000,
  connectTimeout: 20000,
});

async function ul(buf) {
  const service = new ImageUploadService("pixhost.to");
  let { directLink } = await service.uploadFromBinary(buf, "test.png");
  return directLink;
}

async function callColorizeAPI(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 100000);

      const r = await undiciFetch(API, {
        method: "POST",
        headers: {
          Accept: "application/json, image/*, audio/*, video/*",
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
        signal: ac.signal,
        dispatcher: agent,
      });

      clearTimeout(tid);

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        throw new Error(`API status ${r.status}: ${errText}`);
      }

      const contentType = r.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const json = await r.json();
        const resultUrl = json.result || json.url || json.data?.url;
        if (!resultUrl) throw new Error("Response JSON tidak ada URL hasil");
        const imgRes = await undiciFetch(resultUrl, { dispatcher: agent });
        if (!imgRes.ok) throw new Error("Gagal download hasil colorize");
        return Buffer.from(await imgRes.arrayBuffer());
      }

      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      const isTimeout =
        e.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
        e.cause?.code === "UND_ERR_BODY_TIMEOUT" ||
        e.name === "AbortError";

      if (attempt < retries && isTimeout) continue;
      throw e;
    }
  }
}

async function handler(m, { sock }) {
  const img =
    m.isImage ||
    (m.quoted && (m.quoted.isImage || m.quoted.type === "imageMessage"));

  if (!img) {
    return m.reply(
      `🎨 *ᴄᴏʟᴏʀɪᴢᴇ*\n\n` +
        `- Ubah foto hitam-putih jadi berwarna 🖼️\n` +
        `- Reply gambar yang mau diwarnai\n\n` +
        `\`${m.prefix}colorize\``,
    );
  }

  m.react("🕕");

  try {
    let b = m.quoted?.isMedia ? await m.quoted.download() : await m.download();
    const u = await ul(b);
    const result = await callColorizeAPI(u);

    m.react("✅");
    await sock.sendMedia(m.chat, result, null, m, { type: "image" });
  } catch (e) {
    console.log(e);
    m.react("☢");

    const isTimeout =
      e.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
      e.cause?.code === "UND_ERR_BODY_TIMEOUT" ||
      e.name === "AbortError";

    if (isTimeout) {
      m.reply("⚠️ Server colorize lagi lemot/down, coba lagi beberapa menit lagi ya.");
    } else {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

export { pluginConfig as config, handler };