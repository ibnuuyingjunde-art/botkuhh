import mediaDownloader, { fetchMediaBuffer } from "../../src/scraper/mediadl.js";

const pluginConfig = {
  name: ["mediadl", "mediadlget"],
  alias: ["mdl", "alldl", "universaldl"],
  category: "download",
  description: "Download media dari berbagai platform (YouTube, TikTok, dll)",
  usage: ".mediadl <url>",
  example: ".mediadl https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const mediaDlSessions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of mediaDlSessions) {
    if (now - val.ts > 15 * 60 * 1000) mediaDlSessions.delete(key);
  }
}, 5 * 60 * 1000);

function genKey() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function pickBestDownload(downloads) {
  const rank = (d) => {
    const l = `${d.label} ${d.quality} ${d.type}`.toLowerCase();
    if (l.includes("hd") && l.includes("no_watermark")) return 0;
    if (l.includes("no_watermark") || l.includes("nowatermark")) return 1;
    if (d.type === "video" && l.includes("1080")) return 2;
    if (d.type === "video") return 3;
    if (d.type === "unknown") return 4;
    return 5;
  };
  return [...downloads].sort((a, b) => rank(a) - rank(b))[0];
}

function inferKindLabel(dl) {
  if (dl.type === "audio") return "audio";
  if (dl.type === "photo" || dl.type === "image") return "foto";
  return "video";
}

function buildCaption({ platform, title, owner, duration }, dl) {
  let caption = `╭─「 ✦ *Media Downloader* ✦ 」\n`;
  caption += `│  🌐  ${platform}\n`;
  if (title && title !== "-") caption += `│  📝  ${title.length > 60 ? title.slice(0, 60) + "..." : title}\n`;
  if (owner && owner !== "-") caption += `│  👤  ${owner}\n`;
  if (duration) caption += `│  ⏱️  ${duration}\n`;
  caption += `│  🎞️  ${inferKindLabel(dl)}\n`;
  caption += `╰────────────────────────`;
  return caption;
}

async function sendByType(m, sock, dl, caption, buttons) {
  const extra = buttons?.length ? { interactiveButtons: buttons } : {};

  const buffer = await fetchMediaBuffer(dl.url);

  if (dl.type === "audio") {
    await sock.sendMessage(
      m.chat,
      { audio: buffer, mimetype: "audio/mpeg", ptt: false },
      { quoted: m },
    );
  } else if (dl.type === "photo" || dl.type === "image") {
    await sock.sendMessage(
      m.chat,
      { image: buffer, caption, ...extra },
      { quoted: m },
    );
  } else {
    
    await sock.sendMessage(
      m.chat,
      { video: buffer, caption, ...extra },
      { quoted: m },
    );
  }
}

async function handler(m, { sock }) {
  const prefix = m.prefix || ".";
  const command = m?.command?.toLowerCase() || "mediadl";
  const args = (m.text || "").trim();

  if (command === "mediadlget") {
    const [key, idxStr] = args.split("|");
    const idx = parseInt(idxStr, 10);
    const session = mediaDlSessions.get(key);

    if (!session) {
      return m.reply("❌ Sesi sudah kadaluarsa, kirim ulang link-nya ya.");
    }
    const dl = session.downloads[idx];
    if (!dl) {
      return m.reply("❌ Opsi tidak ditemukan.");
    }

    await m.react("🕕");
    try {
      const caption = buildCaption(session.info, dl);
      await sendByType(m, sock, dl, caption);
      await m.react("✅");
    } catch (err) {
      await m.react("❌");
      await m.reply(`❌ Gagal mengunduh: ${err.message}`);
    }
    return;
  }

  const url = args;

  if (!url) {
    return m.reply(
      `🌐 *ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
        `Download video/audio dari berbagai platform (YouTube, TikTok, dll).\n\n` +
        `> \`${prefix}${command} <url>\`\n\n` +
        `*ᴄᴏɴᴛᴏʜ:*\n` +
        `> \`${prefix}${command} https://vt.tiktok.com/xxx\`\n` +
        `> \`${prefix}${command} https://youtube.com/watch?v=xxx\``,
    );
  }

  if (!/^https?:\/\//i.test(url)) {
    return m.reply(`❌ URL tidak valid.`);
  }

  await m.react("🕕");

  try {
    const result = await mediaDownloader(url);

    if (!result.downloads.length) {
      await m.react("❌");
      return m.reply(`❌ Tidak ada media yang bisa diunduh dari link ini.`);
    }

    const key = genKey();
    mediaDlSessions.set(key, {
      ts: Date.now(),
      downloads: result.downloads,
      info: {
        platform: result.platform,
        title: result.title,
        owner: result.owner,
        duration: result.duration,
        kind: result.kind,
      },
    });

    const best = pickBestDownload(result.downloads);
    const bestIndex = result.downloads.indexOf(best);
    const caption = buildCaption(result, best);

    const audioIdx = result.downloads.findIndex((d) => d.type === "audio");
    const buttons =
      audioIdx !== -1 && audioIdx !== bestIndex
        ? [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🎵 Download MP3",
                id: `${prefix}mediadlget ${key}|${audioIdx}`,
              }),
            },
          ]
        : [];

    await sendByType(m, sock, best, caption, buttons);

    await m.react("✅");
  } catch (err) {
    await m.react("❌");
    return m.reply(`❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴜɴᴅᴜʜ*\n\n> ${err.message}`);
  }
}

export { pluginConfig as config, handler };