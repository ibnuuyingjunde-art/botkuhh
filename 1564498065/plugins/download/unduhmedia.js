import { unduhmedia } from "../../src/scraper/unduhmedia.js";

const pluginConfig = {
  name: "unduhmedia",
  alias: ["udm"],
  category: "download",
  description: "Download media TikTok, Instagram, Threads, Spotify, X, Pinterest, Facebook, SoundCloud",
  usage: ".unduhmedia <url>",
  example: ".unduhmedia https://www.tiktok.com/@user/video/123",
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

const MAX_MEDIA = 10;

async function handler(m, { sock }) {
  const url = (m.text || "").trim().split(/\s+/)[0];
  if (!url)
    return m.reply(`Contoh: ${m.prefix}unduhmedia https://www.tiktok.com/@user/video/123`);
  if (!/^https?:\/\//i.test(url)) return m.reply("❌ Masukkan link yang valid");

  m.react("🕕");

  try {
    const r = await unduhmedia(url);
    if (!r.status) {
      m.react("❌");
      return m.reply(r.error);
    }

    const files = r.media.filter((x) => x.download_url && x.type !== "thumbnail");
    if (!files.length) {
      m.react("❌");
      return m.reply("Tidak ada media yang bisa diunduh dari link ini.");
    }

    const caption = [
      `*${r.kind || r.platform}*`,
      r.author ? `👤 ${r.author}` : null,
      r.text ? `📝 ${r.text.slice(0, 500)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const list = files.slice(0, MAX_MEDIA);
    const hasCover = list.some((x) => x.type !== "image");
    let first = true;

    for (const f of list) {
      if (f.type === "image" && f.label === "Cover" && hasCover) continue;
      const opts = { type: f.type };
      if (f.type === "audio") {
        opts.mimetype = "audio/mpeg";
        opts.ptt = false;
        opts.fileName = r.platform + ".mp3";
      }
      await sock.sendMedia(m.chat, f.download_url, first ? caption : null, m, opts);
      first = false;
    }

    if (files.length > MAX_MEDIA)
      await m.reply(`Hanya ${MAX_MEDIA} dari ${files.length} media yang dikirim.`);

    m.react("✅");
  } catch (err) {
    console.error("[UNDUHMEDIA]", err);
    m.react("❌");
    m.reply("Gagal mengunduh media.");
  }
}

export { pluginConfig as config, handler };