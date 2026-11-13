import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const API_BASE = "https://api.azbry.com/api/download/allinonev2";

const pluginConfig = {
  name: "aio",
  alias: ["allinone", "download", "dl"],
  category: "downloader",
  description:
    "All in one downloader (IG, TikTok, FB, Twitter, YouTube, Pinterest, CapCut, dll)",
  usage: ".aio <url>",
  example: ".aio https://instagram.com/p/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function pickByLabel(downloads, patterns) {
  for (const pattern of patterns) {
    const found = downloads.find((d) => pattern.test(d.label || ""));
    if (found?.url) return found;
  }
  return null;
}

async function fetchAio(url) {
  const endpoint = `${API_BASE}?url=${encodeURIComponent(url)}`;

  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.status) throw new Error("API mengembalikan status gagal");
  return json;
}

async function handler(m, { sock }) {
  const url = m.text?.trim();

  if (!url) {
    return m.reply(
      `📥 *ᴀʟʟ ɪɴ ᴏɴᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
        `> Download dari berbagai platform!\n\n` +
        `╭┈┈⬡「 🌐 *ᴘʟᴀᴛꜰᴏʀᴍ* 」\n` +
        `┃ • Instagram\n` +
        `┃ • TikTok\n` +
        `┃ • Facebook\n` +
        `┃ • Twitter/X\n` +
        `┃ • YouTube\n` +
        `┃ • Pinterest\n` +
        `┃ • CapCut\n` +
        `┃ • Threads / Reddit\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> *Contoh:* ${m.prefix}aio https://instagram.com/p/xxx`,
    );
  }

  if (!url.startsWith("http")) {
    return m.reply(`❌ URL tidak valid! Harus dimulai dengan http/https`);
  }

  await m.react("🕕");

  try {
    const json = await fetchAio(url);
    const result = json?.result;
    const downloads = Array.isArray(result?.downloads) ? result.downloads : [];

    if (!result || !downloads.length) {
      await m.react("❌");
      return m.reply(`❌ Gagal mengambil media. Pastikan URL valid.`);
    }

    const ctxInfo = saluranCtx();
    const caption = result.title || null;

    const imageItems = downloads.filter((d) => /image|foto|photo/i.test(d.label || ""));
    const audioItem = pickByLabel(downloads, [/mp3/i, /audio/i]);
    const videoItem = pickByLabel(downloads, [
      /hd.*no.?watermark/i,
      /no.?watermark/i,
      /hd/i,
      /^(?!.*(mp3|audio|image|foto|photo)).*$/i,
    ]);

    if (imageItems.length) {
      for (const img of imageItems) {
        await sock.sendMedia(m.chat, img.url, caption, m, {
          type: "image",
          contextInfo: ctxInfo,
        });
      }
    } else if (videoItem) {
      await sock.sendMedia(m.chat, videoItem.url, caption, m, {
        type: "video",
        contextInfo: ctxInfo,
      });
    } else if (audioItem) {
      await sock.sendMessage(
        m.chat,
        {
          audio: { url: audioItem.url },
          mimetype: "audio/mpeg",
          contextInfo: ctxInfo,
        },
        { quoted: m },
      );
    } else {
      await m.react("❌");
      return m.reply(`❌ Tidak ada media yang bisa diunduh dari URL ini.`);
    }

    await m.react("✅");
  } catch (error) {
    console.error("[aio] error:", error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };