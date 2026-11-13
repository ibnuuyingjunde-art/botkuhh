import axios from "axios";

const pluginConfig = {
  name: "tiktok4",
  alias: ["tt4", "tiktok4", "vt4"],
  category: "downloader",
  description: "Mengunduh Video, Audio, atau Foto Slide dari TikTok via API Cloud",
  usage: ".tiktok4 <url_tiktok>",
  example: ".tiktok4 https://vt.tiktok.com/ZSbFpJ7mT/",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const IMG_EXT = /\.(jpe?g|png|webp|heic|avif)(\?|$)/i;
const VID_EXT = /\.(mp4|mov|webm)(\?|$)/i;

// Ambil URL string dari berbagai bentuk item (string / object)
function pickUrl(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (Array.isArray(item)) return pickUrl(item[0]);
  return (
    item.url ||
    item.display_url ||
    item.image_url ||
    item.imageUrl ||
    item.download_url ||
    item.src ||
    item.link ||
    pickUrl(item.url_list) ||
    pickUrl(item.urlList) ||
    pickUrl(item.imageURL) ||
    pickUrl(item.display_image) ||
    null
  );
}

// Kumpulkan semua foto slide dari berbagai kemungkinan struktur respon
function extractImages(result) {
  const candidates = [
    result.images,
    result.photos,
    result.pictures,
    result.slides,
    result.slide,
    result.slideshow,
    result.image_post?.images,
    result.imagePost?.images,
    result.image_data?.no_watermark_image_list,
    result.media?.images,
    result.media?.photos,
  ];

  // media berupa array campuran -> ambil yang bertipe foto saja
  if (Array.isArray(result.media)) {
    candidates.push(
      result.media.filter((x) => {
        const t = typeof x === "object" ? String(x.type || "").toLowerCase() : "";
        const u = pickUrl(x) || "";
        return t === "image" || t === "photo" || (!t && IMG_EXT.test(u));
      })
    );
  }

  for (const c of candidates) {
    if (!c) continue;
    const arr = Array.isArray(c) ? c : [c];
    const urls = arr
      .map(pickUrl)
      .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u) && !VID_EXT.test(u));
    if (urls.length) return [...new Set(urls)];
  }
  return [];
}

function extractVideo(result) {
  const list = [
    result.video,
    result.play,
    result.nowm,
    result.no_watermark,
    result.nwm,
    result.download_url,
    result.video_data?.nwm,
    result.video_data?.wm,
    typeof result.media === "string" ? result.media : null,
    Array.isArray(result.media) ? pickUrl(result.media.find((x) => VID_EXT.test(pickUrl(x) || "")) || result.media[0]) : null,
    result.url,
  ];
  for (const v of list) {
    const u = pickUrl(v);
    if (typeof u === "string" && /^https?:\/\//i.test(u) && !IMG_EXT.test(u)) return u;
  }
  return null;
}

// Kirim gambar: coba via URL dulu, kalau gagal download jadi buffer
async function sendImage(conn, m, imgUrl, caption) {
  try {
    await conn.sendMessage(m.chat, { image: { url: imgUrl }, caption }, { quoted: m });
  } catch {
    const { data } = await axios.get(imgUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.tiktok.com/" },
    });
    await conn.sendMessage(m.chat, { image: Buffer.from(data), caption }, { quoted: m });
  }
}

async function handler(m, { sock, args, prefix, command }) {
  const conn = sock || m.conn;

  // 1. Validasi Input URL (ambil link dari teks / reply)
  const raw = args[0] || (m.quoted && (m.quoted.text || m.quoted.caption)) || "";
  const url = (raw.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/i) || [])[0];

  if (!url) {
    return m.reply(
      `❌ *URL TikTok tidak ditemukan!*\n\n` +
        `> *Penggunaan:* \`${prefix + command} <link_tiktok>\`\n` +
        `> *Contoh:* \`${prefix + command} https://vt.tiktok.com/ZSbFpJ7mT/\``
    );
  }

  await m.react("⏳");

  try {
    // 2. Request ke API Cloud
    const apiUrl = `https://api-cloud.my.id/downloader/tiktok?url=${encodeURIComponent(url)}`;
    const { data: res } = await axios.get(apiUrl, { timeout: 25000 });

    if (!res) {
      await m.react("❌");
      return m.reply("⚠️ API tidak mengembalikan respon.");
    }

    const result = res.data || res.result || res;

    const title = result.title || result.desc || result.caption || result.description || "TikTok Downloader";
    const authorRaw = result.author?.nickname || result.author?.username || result.author || result.nickname || "TikTok User";
    const author = typeof authorRaw === "object" ? authorRaw.name || "TikTok User" : authorRaw;

    // 3. FOTO / SLIDE (dicek duluan sebelum video)
    // Tentukan tipe konten dulu: video ya video, foto ya foto
    const type = String(result.type || result.media_type || result.mediaType || "").toLowerCase();
    const allImages = extractImages(result);
    const videoUrl = extractVideo(result);

    let isPhoto;
    if (/image|photo|slide|carousel/.test(type)) isPhoto = allImages.length > 0;
    else if (/video/.test(type)) isPhoto = false;
    else if (allImages.length && videoUrl) isPhoto = allImages.length > 1; // 1 gambar + video = cover, bukan slide
    else isPhoto = allImages.length > 0;

    const images = isPhoto ? allImages : [];

    if (images.length > 0) {
      await m.reply(
        `📸 *TikTok Photo Slide*\n\n> 👤 *Author:* ${author}\n> 📝 *Title:* ${title}\n\n_Mengirim ${images.length} foto..._`
      );

      let sent = 0;
      for (let i = 0; i < images.length; i++) {
        try {
          await sendImage(conn, m, images[i], `🖼️ *Slide ${i + 1}/${images.length}*`);
          sent++;
        } catch (e) {
          console.error(`[TikTok4] Gagal kirim slide ${i + 1}:`, e.message);
        }
        await new Promise((r) => setTimeout(r, 700));
      }

      // Audio / musik slide
      const musicUrl = pickUrl(result.music) || pickUrl(result.audio) || pickUrl(result.music_info?.play) || pickUrl(result.music_info?.url) || pickUrl(result.play_audio);
      if (musicUrl && /^https?:\/\//i.test(musicUrl)) {
        try {
          await conn.sendMessage(
            m.chat,
            { audio: { url: musicUrl }, mimetype: "audio/mpeg", ptt: false },
            { quoted: m }
          );
        } catch (e) {
          console.error("[TikTok4] Gagal kirim audio:", e.message);
        }
      }

      if (sent === 0) {
        await m.react("❌");
        return m.reply("❌ Gagal mengirim semua foto, coba lagi nanti.");
      }

      await m.react("✅");
      return;
    }

    // 4. VIDEO

    if (videoUrl) {
      const captionText =
        `🎵 *TIKTOK DOWNLOADER*\n\n` +
        `👤 *Author:* ${author}\n` +
        `📝 *Title:* ${title}\n\n` +
        `> _Powered by api-cloud.my.id_`;

      await conn.sendMessage(m.chat, { video: { url: videoUrl }, caption: captionText }, { quoted: m });
      await m.react("✅");
      return;
    }

    // Debug: tampilkan key respon biar gampang cek struktur API
    console.log("[TikTok4] Struktur respon tidak dikenal, keys:", Object.keys(result));
    await m.react("❌");
    return m.reply("❌ Struktur respon API berubah atau media tidak ditemukan.");
  } catch (err) {
    console.error("[TikTok4 API Error]", err);
    await m.react("❌");
    return m.reply(`⚠️ *Terjadi kesalahan sistem:*\n> ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };