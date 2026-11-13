import axios from "axios";

const TIKWM = "https://www.tikwm.com";
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

// Semua bentuk link: tiktok.com (www/vm/vt/m, /t/xxx) dan tt.site
const TT_URL_REGEX = /https?:\/\/(?:[\w-]+\.)?(?:tiktok\.com|tt\.site)\/[^\s]+/i;

function extractTikTokUrl(input) {
  const match = String(input || "").match(TT_URL_REGEX);
  return match ? match[0].replace(/[)\]}>.,!?]+$/, "") : null;
}

// Ikuti redirect link pendek (tt.site, vt, vm, /t/) ke link aslinya
async function resolveTikTokUrl(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

function abs(u) {
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : TIKWM + u;
}

function formatNumber(n = 0) {
  return Number(parseInt(n) || 0)
    .toLocaleString()
    .replace(/,/g, ".");
}

function formatDate(n, locale = "en") {
  return new Date(n).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

/*
============================
  SUMBER DATA
============================
Keduanya dinormalisasi ke bentuk yang sama:
{ title, region, taken_at, duration, durations, data:[{type,url}],
  music_info:{title,author,url}, stats:{...}, author:{nickname,fullname} }
*/

// PRIMARY : TIKWM
async function fetchTikwm(url) {
  const res = (
    await axios.post(
      TIKWM + "/api/",
      {},
      {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: TIKWM,
          Referer: TIKWM + "/",
          "User-Agent": UA,
          "X-Requested-With": "XMLHttpRequest",
        },
        params: { url, count: 12, cursor: 0, web: 1, hd: 1 },
        timeout: 30000,
      },
    )
  ).data?.data;

  if (!res) return null;

  const images = Array.isArray(res.images) ? res.images : [];
  const isPhoto = images.length > 0;

  const data = isPhoto
    ? images.map((u) => ({ type: "photo", url: u }))
    : [
        { type: "nowatermark_hd", url: abs(res.hdplay) },
        { type: "nowatermark", url: abs(res.play) },
        { type: "watermark", url: abs(res.wmplay) },
      ].filter((v) => v.url);

  if (!data.length) return null;

  return {
    title: res.title,
    region: res.region || "-",
    taken_at: res.create_time ? formatDate(res.create_time * 1000) : "-",
    durations: isPhoto ? 0 : res.duration || 0,
    duration: (isPhoto ? 0 : res.duration || 0) + " Seconds",
    data,
    music_info: {
      title: res.music_info?.title || "-",
      author: res.music_info?.author || "-",
      url: abs(res.music) || abs(res.music_info?.play),
    },
    stats: {
      views: formatNumber(res.play_count),
      likes: formatNumber(res.digg_count),
      comment: formatNumber(res.comment_count),
      share: formatNumber(res.share_count),
      download: formatNumber(res.download_count),
    },
    author: {
      fullname: res.author?.unique_id || "-",
      nickname: res.author?.nickname || "-",
    },
  };
}

// FALLBACK : SIPUTZX
async function fetchSiputzx(url) {
  const res = (
    await axios.get("https://api.siputzx.my.id/api/d/tiktok", {
      params: { url },
      timeout: 30000,
    })
  ).data?.data;

  if (!res) return null;

  const images = res.images || res.photo || res.images_url || [];
  const isPhoto = Array.isArray(images) && images.length > 0;
  const videoUrl = res.video || res.no_watermark || res.play;

  const data = isPhoto
    ? images.map((u) => ({ type: "photo", url: u }))
    : videoUrl
      ? [{ type: "nowatermark", url: videoUrl }]
      : [];

  if (!data.length) return null;

  const stats = res.stats || {};

  return {
    title: res.title || res.desc,
    region: res.region || "-",
    taken_at: "-",
    durations: isPhoto ? 0 : res.duration || 1,
    duration: (isPhoto ? 0 : res.duration || 1) + " Seconds",
    data,
    music_info: {
      title: res.music_info?.title || "-",
      author: res.music_info?.author || "-",
      url: res.music || res.audio || res.music_url || res.music_info?.url || null,
    },
    stats: {
      views: formatNumber(stats.playCount || res.play_count),
      likes: formatNumber(stats.diggCount || res.digg_count || res.like_count),
      comment: formatNumber(stats.commentCount || res.comment_count),
      share: formatNumber(stats.shareCount || res.share_count),
      download: formatNumber(res.download_count),
    },
    author: {
      fullname: res.author?.unique_id || res.author?.uniqueId || "-",
      nickname: res.author?.nickname || res.author?.name || "-",
    },
  };
}

async function fetchTikTok(url) {
  for (const source of [fetchTikwm, fetchSiputzx]) {
    try {
      const result = await source(url);
      if (result) return result;
    } catch (e) {
      console.error(`[tt] ${source.name} gagal:`, e.message);
    }
  }
  return null;
}

// Coba link asli dulu; kalau gagal, resolve link pendek lalu coba lagi
async function getTikTok(url) {
  const data = await fetchTikTok(url);
  if (data) return data;

  const resolved = await resolveTikTokUrl(url);
  if (resolved && resolved !== url) return fetchTikTok(resolved);

  return null;
}

/*
============================
  KIRIM VIDEO (bar musik + tombol)
============================
*/
async function sendVideo(sock, m, videoUrl, caption, music, musicButton) {
  try {
    return await sock.sendMessage(
      m.chat,
      {
        video: { url: videoUrl },
        mimetype: "video/mp4",
        caption,
        interactiveButtons: [musicButton],
        streamingSidecar: Buffer.from("Omw4hLediba3yg==", "base64"),
        annotations: [
          {
            polygonVertices: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 1000 },
              { x: 0, y: 1000 },
            ],
            shouldSkipConfirmation: true,
            embeddedContent: {
              embeddedMusic: {
                musicContentMediaId: "1409620227516822",
                songId: "244215252974958",
                author: music.author,
                title: music.title,
                artistAttribution:
                  "https://whatsapp.com/channel/0029VbDvzjlDzgTJY34zxT1H",
                countryBlocklist: "",
                isExplicit: false,
              },
            },
            embeddedAction: true,
          },
        ],
      },
      { quoted: m },
    );
  } catch (e) {
    console.error("[tt] gagal kirim dengan bar musik, fallback sendButton:", e.message);
    return sock.sendButton(m.chat, videoUrl, caption, m, {
      type: "video",
      buttons: [musicButton],
    });
  }
}

const pluginConfig = {
  name: ["tiktok", "tt", "ttmp4"],
  alias: ["tiktokdl", "ttdown"],
  category: "download",
  description: "Download video/slide TikTok tanpa watermark",
  usage: ".tiktok <url>",
  example: ".tiktok https://vt.tiktok.com/xxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const prefix = m.prefix;
  const command = m?.command;
  const input = m.text?.trim() || m.quoted?.text || "";

  if (!input) {
    m.react("❌");
    return m.reply(
      `📌 Contoh: *${prefix + command} https://vt.tiktok.com/...*`,
    );
  }

  const url = extractTikTokUrl(input);
  if (!url) {
    m.react("❌");
    return m.reply(`❌ Link TikTok tidak valid.`);
  }

  m.react("🕕");
  try {
    const result = await getTikTok(url);

    if (!result) {
      m.react("❌");
      return m.reply(
        "Gagal mengambil data. Coba lagi nanti, atau bisa coba " +
          prefix +
          "tt2",
      );
    }

    const musicButton = {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎵 Ambil Music",
        id: `${prefix}ttmp3 ${url}`,
      }),
    };

    const isPhoto = result.data[0]?.type === "photo";

    if (!isPhoto) {
      const videoItem =
        result.data.find(
          (e) => e.type === "nowatermark_hd" || e.type === "nowatermark",
        ) || result.data[0];

      const caption =
        `🎵 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Duration: ${result.duration}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Video:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      await sendVideo(
        sock,
        m,
        videoItem.url,
        caption,
        result.music_info,
        musicButton,
      );
    } else {
      const caption =
        `📸 *𝗧 𝗜 𝗞 𝗧 𝗢 𝗞  -  𝗗 𝗢 𝗪 𝗡 𝗟 𝗢 𝗔 𝗗 𝗘 𝗥*\n\n` +
        `- Author: *${result.author.nickname}* (${result.author.fullname})\n` +
        `- Caption: ${result.title || "-"}\n` +
        `- Music: ${result.music_info.title} - ${result.music_info.author}\n` +
        `- Uploaded: ${result.taken_at}\n` +
        `- Region: ${result.region}\n\n` +
        `*Statistik Konten:*\n` +
        `- Views: *${result.stats.views}*\n` +
        `- Likes: *${result.stats.likes}*\n` +
        `- Comments: *${result.stats.comment}*\n` +
        `- Shares: *${result.stats.share}*\n` +
        `- Downloads: *${result.stats.download}*`;

      const slides = result.data.map((zan, idx) => ({
        image: { url: zan.url },
        caption: idx === 0 ? caption : "",
      }));

      await sock.sendMessage(
        m.chat,
        { albumMessage: slides },
        { quoted: m },
      );

      await sock.sendButton(
        m.chat,
        null,
        `📸 Slide berhasil dikirim!\nTekan tombol di bawah untuk ambil music.`,
        m,
        { buttons: [musicButton] },
      );
    }
    m.react("✅");
  } catch (e) {
    console.error("[tt] gagal:", e);
    m.react("❌");
    m.reply("Coba lagi nanti, atau bisa coba " + prefix + "tt2");
  }
}

export { pluginConfig as config, handler };