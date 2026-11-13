import fs from "fs";
import path from "path";
import { resolveMediaOrLink, hasLinkInput } from "../../src/lib/ichigo-media-input.js";

const pluginConfig = {
  name: "gantiichigo",
  alias: ["ganti-ichigo", "setvideo19", "changevideo19"],
  category: "owner",
  description: "Ganti file ichigo.mp4 untuk menu variant 19",
  usage: ".gantiichigo (reply video) atau .gantiichigo <url>",
  example: ".gantiichigo https://contoh.com/video.mp4",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const quoted = m.quoted;
  const videoPath = path.join(process.cwd(), "assets", "video", "ichigo.mp4");
  const hasLink = hasLinkInput(m);

  const isVideo = quoted?.message?.videoMessage;
  if (!quoted && !hasLink) {
    const exists = fs.existsSync(videoPath);
    return m.reply(
      exists
        ? `✅ *ichigo.mp4 sudah ada*\n\nReply video + .gantiichigo untuk menggantinya, atau kirim link: .gantiichigo <url>`
        : `❌ ichigo.mp4 belum ada.\n\nReply video lalu ketik *.gantiichigo*, atau kirim link: .gantiichigo <url>`
    );
  }
  if (!isVideo && !hasLink) return m.reply("❌ Reply video dulu, atau kirim link!");

  try {
    const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m);

    if (!buffer) {
      return m.reply(`❌ Gagal mendownload video${isLink ? ' dari link' : ''}`);
    }

    const dir = path.dirname(videoPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(videoPath, buffer);

    await m.reply(`✅ *ichigo.mp4 berhasil diganti!*\n\nMenu v19 akan otomatis pakai video baru.${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`);
  } catch (e) {
    console.error("[gantiichigo]", e.message);
    await m.reply("❌ Gagal mengganti video: " + e.message);
  }
}

export { pluginConfig as config, handler };
