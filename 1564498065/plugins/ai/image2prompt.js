import te from "../../src/lib/ichigo-error.js";
import { Agent, fetch as undiciFetch } from "undici";

const pluginConfig = {
  name: "image2prompt",
  alias: ["img2prompt", "i2p"],
  category: "ai",
  description: "Generate prompt/deskripsi dari gambar pakai AI",
  usage: ".image2prompt (reply gambar)",
  example: ".image2prompt",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api.covenant.sbs/api/ai/image2prompt";
const KEY = "cov_live_4f4f3c990cba17587578cd13b7a5c53ae912ae93b91a272f";

const agent = new Agent({
  headersTimeout: 60000,
  bodyTimeout: 60000,
  connectTimeout: 20000,
});

async function callAPI(buf, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 60000);

      const formData = new FormData();
      formData.append("file", new Blob([buf], { type: "image/jpeg" }), "image.jpg");

      const r = await undiciFetch(API, {
        method: "POST",
        headers: { "x-api-key": KEY },
        body: formData,
        signal: ac.signal,
        dispatcher: agent,
      });

      clearTimeout(tid);

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        throw new Error(`API status ${r.status}: ${errText}`);
      }

      const contentType = r.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Response bukan JSON (kemungkinan endpoint salah/down)");
      }

      const json = await r.json();

      if (!json.status) {
        throw new Error(json.message || "Request gagal, status false");
      }

      const result = json.data?.result;
      if (!result) {
        throw new Error("Response tidak ada data.result");
      }

      return String(result);
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

async function handler(m) {
  const img =
    m.isImage ||
    (m.quoted && (m.quoted.isImage || m.quoted.type === "imageMessage"));

  if (!img) {
    return m.reply(
      `🖼️ *ɪᴍᴀɢᴇ ᴛᴏ ᴘʀᴏᴍᴘᴛ*\n\n` +
        `- Generate deskripsi/prompt dari gambar pakai AI\n` +
        `- Reply gambar yang mau di-deskripsiin\n\n` +
        `\`${m.prefix}image2prompt\``,
    );
  }

  m.react("🕕");

  try {
    let b = m.quoted?.isMedia ? await m.quoted.download() : await m.download();
    const prompt = await callAPI(b);

    m.react("✅");
    await m.reply(`🖼️ *ʜᴀsɪʟ ᴘʀᴏᴍᴘᴛ*\n\n${prompt}`);
  } catch (e) {
    console.log(e);
    m.react("☢");

    const isTimeout =
      e.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
      e.cause?.code === "UND_ERR_BODY_TIMEOUT" ||
      e.name === "AbortError";

    if (isTimeout) {
      m.reply("⚠️ Server lagi lemot/down, coba lagi beberapa menit lagi ya.");
    } else {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

export { pluginConfig as config, handler };