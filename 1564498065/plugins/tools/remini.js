import te from "../../src/lib/ichigo-error.js";

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

const API = "https://api-cloud.my.id/tools/imglarger";

// API butuh URL gambar publik, jadi gambar diupload dulu ke hosting sementara.
const UPLOADERS = [
  async (buf) => {
    const f = new FormData();
    f.append("reqtype", "fileupload");
    f.append("fileToUpload", new Blob([buf], { type: "image/jpeg" }), "img.jpg");
    const r = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: f,
      signal: AbortSignal.timeout(30000),
    });
    const t = (await r.text()).trim();
    if (!r.ok || !/^https?:\/\//.test(t)) throw new Error(`catbox: ${t.slice(0, 100)}`);
    return t;
  },
  async (buf) => {
    const f = new FormData();
    f.append("files[]", new Blob([buf], { type: "image/jpeg" }), "img.jpg");
    const r = await fetch("https://uguu.se/upload", {
      method: "POST",
      body: f,
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json();
    const url = j?.files?.[0]?.url;
    if (!r.ok || !url) throw new Error("uguu: upload gagal");
    return url;
  },
];

async function uploadImage(buf) {
  let lastErr;
  for (const up of UPLOADERS) {
    try {
      return await up(buf);
    } catch (e) {
      lastErr = e;
      console.error("[remini] upload gagal:", e.message);
    }
  }
  throw lastErr || new Error("Upload gambar gagal");
}

async function up(buf) {
  const url = await uploadImage(buf);

  const r = await fetch(`${API}?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`Upscale API error: ${r.status} ${await r.text()}`);

  const data = await r.json();
  const out = data?.result?.output || data?.result?.outputs?.[0];
  if (!data?.status || !out) throw new Error(`Upscale gagal: ${JSON.stringify(data).slice(0, 200)}`);

  const img = await fetch(out, { signal: AbortSignal.timeout(60000) });
  if (!img.ok) throw new Error(`Download hasil gagal: ${img.status}`);

  const result = Buffer.from(await img.arrayBuffer());
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