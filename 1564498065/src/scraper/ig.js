import axios from "axios";

/**
 * Instagram Downloader (via api.azbry.com)
 * Mengambil metadata dari API, lalu mendownload media-nya sendiri
 * ke dalam Buffer di server (bukan mengirim URL mentah ke WhatsApp),
 * supaya tidak gagal akibat proxy CDN yang butuh header khusus atau
 * token link yang cepat expired.
 *
 * @param {string} url - URL Instagram (reel/post/story)
 * @returns {Promise<{
 *   username: string,
 *   caption: string,
 *   media: Array<{ type: "video" | "image", buffer: Buffer }>
 * }>}
 */
export default async function instagramDownloader(url) {
  const api = `https://api.azbry.com/api/download/instagram?url=${encodeURIComponent(url)}`;

  const { data } = await axios.get(api, { timeout: 30_000 });

  if (!data || data.status !== true) {
    throw new Error("API sumber tidak mengembalikan data yang valid.");
  }

  const videoLinks = normalizeList(data.videos);
  const imageLinks = normalizeList(data.images || data.photos);
  const candidates = [
    ...videoLinks.map((link) => ({ type: "video", link })),
    ...imageLinks.map((link) => ({ type: "image", link })),
  ];

  if (candidates.length === 0 && data.thumb) {
    candidates.push({ type: "image", link: data.thumb });
  }

  if (candidates.length === 0) {
    throw new Error("Tidak ada link media pada response API.");
  }

  const media = [];
  for (const { type, link } of candidates) {
    const buffer = await downloadAndValidate(link, type);
    if (buffer) media.push({ type, buffer });
  }

  if (media.length === 0) {
    throw new Error(
      "Semua media gagal diunduh/divalidasi dari server sumber.",
    );
  }

  return {
    username: data.creator || data.username || "-",
    caption: data.caption || "",
    media,
  };
}

/** Ubah field API (bisa berupa string, array of string, atau array of object) jadi array of URL string. */
function normalizeList(field) {
  if (!field) return [];
  const arr = Array.isArray(field) ? field : [field];
  return arr
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return item;
      if (typeof item === "object") {
        return item.url || item.download_url || item.link || item.src || null;
      }
      return null;
    })
    .filter(Boolean);
}

/** Download satu link jadi Buffer, lalu validasi bahwa isinya benar-benar video/gambar (bukan halaman error). */
async function downloadAndValidate(link, type) {
  try {
    const res = await axios.get(link, {
      responseType: "arraybuffer",
      timeout: 30_000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    const buffer = Buffer.from(res.data);

    if (!buffer.length) {
      console.error(`[ig] Buffer kosong (${type}):`, link);
      return null;
    }

    const valid =
      type === "video" ? looksLikeVideo(buffer) : looksLikeImage(buffer);

    if (!valid) {
      console.error(
        `[ig] Buffer bukan ${type} yang valid (size=${buffer.length}, content-type=${res.headers?.["content-type"]}):`,
        link,
      );
      return null;
    }

    return buffer;
  } catch (e) {
    console.error(`[ig] Gagal download ${type}:`, link, "-", e.message);
    return null;
  }
}

function looksLikeVideo(buffer) {
  if (buffer.length < 12) return false;
  
  return buffer.toString("ascii", 0, 16).includes("ftyp");
}

function looksLikeImage(buffer) {
  if (buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isWebp = buffer.toString("ascii", 8, 12) === "WEBP";
  const isGif = buffer.toString("ascii", 0, 3) === "GIF";
  return isJpeg || isPng || isWebp || isGif;
}
