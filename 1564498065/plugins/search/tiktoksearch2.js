import crypto from "crypto";
import {
  generateWAMessage,
  generateWAMessageFromContent,
  jidNormalizedUser,
} from "ichigo";
import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const config = {
  name: "tiktoksearch2",
  alias: ["ttsearch2", "carittv2", "searchtiktok2"],
  category: "search",
  description: "Cari video TikTok lalu kirim 5 video hasilnya sebagai album",
  usage: ".tiktoksearch2 <kata kunci>",
  example: ".tiktoksearch2 anime",
  cooldown: 15,
  energi: 2,
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/search/tiktok";
const LIMIT = 5;

function cut(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "-";
  return t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;
}

async function fetchTiktokSearch(query) {
  const { data } = await axios.get(API, {
    params: { query },
    timeout: 20000,
  });
  const videos = (Array.isArray(data?.result) ? data.result : [])
    .filter((v) => v?.no_watermark)
    .slice(0, LIMIT);

  if (!data?.status || !videos.length)
    throw new Error(data?.message || "Tidak ada hasil ditemukan.");
  return videos;
}

// Album WhatsApp hanya menampilkan caption item pertama,
// jadi caption itu dipakai sebagai ringkasan semua video.
function buildAlbumCaption(query, videos) {
  const build = (titleMax) => {
    let text = `🔍 *TikTok Search:* ${cut(query, 40)}\n📦 ${videos.length} video\n`;

    videos.forEach((v, i) => {
      const link =
        v.author && v.id
          ? `https://www.tiktok.com/@${v.author}/video/${v.id}`
          : "";

      text +=
        `\n*${i + 1}. @${v.author || "-"}*\n` +
        (titleMax ? `📝 ${cut(v.title, titleMax)}\n` : "") +
        `👁️ ${v.play_count ?? "0"}  ❤️ ${v.like_count ?? "0"}  ⏱️ ${v.duration || "-"}\n` +
        (link ? `🔗 ${link}\n` : "");
    });

    return text.trim();
  };

  // Caption media dibatasi ~1024 karakter, perkecil judul bila perlu
  for (const max of [45, 25, 0]) {
    const text = build(max);
    if (text.length <= 1000) return text;
  }
  return build(0).slice(0, 1000);
}

async function handler(m, { sock }) {
  const query = (m.text || m.fullArgs || "").trim();

  if (!query) {
    return m.reply(
      `╭─ 🔍 *TIKTOK SEARCH*\n` +
      `│· Usage  : \`${m.prefix}tiktoksearch2 <kata kunci>\`\n` +
      `│· Contoh : \`${m.prefix}tiktoksearch2 anime\`\n` +
      `╰───────────────────────────`,
    );
  }

  await m.react("⏳");

  try {
    const videos = await fetchTiktokSearch(query);

    // Caption hanya di video pertama (itu yang tampil di bawah album)
    const mediaList = videos.map((v, i) => ({
      video: { url: v.no_watermark },
      mimetype: "video/mp4",
      ...(i === 0 ? { caption: buildAlbumCaption(query, videos) } : {}),
    }));

    await m.react("📤");

    try {
      // Pesan pembuka album
      const opener = generateWAMessageFromContent(
        m.chat,
        {
          messageContextInfo: { messageSecret: crypto.randomBytes(32) },
          albumMessage: {
            expectedImageCount: 0,
            expectedVideoCount: mediaList.length,
          },
        },
        {
          userJid: jidNormalizedUser(sock.user.id),
          quoted: m,
          upload: sock.waUploadToServer,
        },
      );

      await sock.relayMessage(opener.key.remoteJid, opener.message, {
        messageId: opener.key.id,
      });

      // Tiap video diasosiasikan ke pesan album
      for (const content of mediaList) {
        const msg = await generateWAMessage(opener.key.remoteJid, content, {
          upload: sock.waUploadToServer,
        });

        msg.message.messageContextInfo = {
          messageSecret: crypto.randomBytes(32),
          messageAssociation: {
            associationType: 1,
            parentMessageKey: opener.key,
          },
        };

        await sock.relayMessage(msg.key.remoteJid, msg.message, {
          messageId: msg.key.id,
        });
      }
    } catch (albumErr) {
      console.error("[tiktoksearch2] Album gagal, kirim satuan:", albumErr.message);
      for (const content of mediaList) {
        try {
          await sock.sendMessage(m.chat, content, { quoted: m });
        } catch (e) {
          console.error("[tiktoksearch2] kirim satuan gagal:", e.message);
        }
      }
    }

    await m.react("✅");
  } catch (e) {
    console.error("[tiktoksearch2]", e.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };