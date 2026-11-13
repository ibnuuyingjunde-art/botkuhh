import crypto from "crypto";
import {
  generateWAMessage,
  generateWAMessageFromContent,
  jidNormalizedUser,
} from "ichigo";
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "tiktoksearch3",
  alias: ["ttsearch3", "carittv3", "searchtiktok3"],
  category: "search",
  description: "Cari video TikTok lalu kirim 5 video hasilnya sebagai album",
  usage: ".tiktoksearch3 <kata kunci>",
  example: ".tiktoksearch3 jj ff",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/search/tiktok2";
const LIMIT = 5;

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n) => compact.format(Number(n) || 0);

const getUrl = (v) => v?.link || v?.watermarkLink || "";

function cut(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;
}

// Album WhatsApp hanya menampilkan caption item pertama,
// jadi caption itu dipakai sebagai ringkasan semua video.
function buildAlbumCaption(query, videos) {
  const build = (titleMax) => {
    let text = `🔍 *TikTok Search:* ${cut(query, 40)}\n📦 ${videos.length} video\n`;

    videos.forEach((v, i) => {
      const s = v.stats || {};
      const user = v.author?.nickname;
      const link = user && v.id ? `https://www.tiktok.com/@${user}/video/${v.id}` : "";

      text +=
        `\n*${i + 1}. @${user || "-"}*\n` +
        (titleMax ? `📝 ${cut(v.title, titleMax) || "-"}\n` : "") +
        `👁️ ${fmt(s.plays)}  ❤️ ${fmt(s.likes)}  💬 ${fmt(s.comments)}\n` +
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
      `🔍 *ᴛɪᴋᴛᴏᴋ sᴇᴀʀᴄʜ (ᴠ3)*\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} jj ff\``,
    );
  }

  await m.react("🕕");

  try {
    const res = await f(`${API}?query=${encodeURIComponent(query)}`);
    const videos = (Array.isArray(res?.result) ? res.result : [])
      .filter((v) => getUrl(v))
      .slice(0, LIMIT);

    if (!res?.status || !videos.length) {
      await m.react("❌");
      return m.reply(`❌ Video untuk *${query}* tidak ditemukan.`);
    }

    // Caption hanya di video pertama (itu yang tampil di bawah album)
    const mediaList = videos.map((v, i) => ({
      video: { url: getUrl(v) },
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
      console.error("[TikTokSearch3] Album gagal, kirim satuan:", albumErr.message);
      for (const content of mediaList) {
        try {
          await sock.sendMessage(m.chat, content, { quoted: m });
        } catch (e) {
          console.error("[TikTokSearch3] kirim satuan gagal:", e.message);
        }
      }
    }

    await m.react("✅");
  } catch (err) {
    console.error("[TikTokSearch3] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };