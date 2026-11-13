import { RedditDL } from "../../src/scraper/reddit.js";

const pluginConfig = {
  name: "redditdl",
  alias: ["reddit", "reddl"],
  category: "download",
  description: "Download video/image dari Reddit",
  usage: ".redditdl <url>",
  example: ".redditdl https://www.reddit.com/r/xxx/comments/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.text?.trim();
  if (!text) {
    m.react("❌");
    return m.reply(
      `📱 *Reddit Downloader*\n\n` +
        `Download video atau gambar dari Reddit.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}redditdl <link>*\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}redditdl https://www.reddit.com/r/xxx/comments/xxx*`,
    );
  }

  m.react("🕕");

  try {
    const result = await RedditDL(text);

    if (!result.status) {
      m.react("☢");
      return m.reply(`❌ *Reddit Gagal*\n\n> ${result.error}`);
    }

    let caption =
      `📱 *Reddit*\n\n` +
      `> 📌 ${result.title}\n` +
      `> 📁 ${result.results.length} media ditemukan`;

    if (result.results.length === 0) {
      m.react("☢");
      return m.reply("❌ Nggak ada media yang bisa di-download dari post itu");
    }

    for (const media of result.results) {
      if (media.type === "video") {
        await sock.sendMedia(m.chat, media.download_url, caption, m, {
          type: "video",
        });
      } else {
        await sock.sendMedia(m.chat, media.download_url, caption, m, {
          type: "image",
        });
      }
    }

    m.react("✅");
  } catch (e) {
    console.error(e);
    m.react("☢");
    m.reply("❌ Gagal mengambil data Reddit, coba lagi nanti");
  }
}

export { pluginConfig as config, handler };
