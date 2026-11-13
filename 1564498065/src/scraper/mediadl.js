import axios from "axios";
import dns from "node:dns";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const API_URL = "https://mediadownloader.web.id/api/download";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
};

/**
 * Generic media downloader (YouTube, TikTok, dll — tergantung platform yang
 * di-support oleh mediadownloader.web.id).
 *
 * @param {string} url - URL media yang mau didownload
 * @returns {Promise<{
 *   platform: string,
 *   title: string,
 *   description: string,
 *   owner: string,
 *   thumbnail: string|null,
 *   duration: string|number|null,
 *   kind: string,
 *   sourceUrl: string,
 *   downloads: Array<{ label: string, quality: string, type: string, url: string }>
 * }>}
 */
export async function fetchMediaBuffer(url, referer = "https://mediadownloader.web.id/") {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    maxContentLength: 200 * 1024 * 1024,
    maxBodyLength: 200 * 1024 * 1024,
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      Referer: referer,
    },
  });
  return Buffer.from(res.data);
}

export default async function mediaDownloader(url) {
  if (!url || typeof url !== "string") {
    throw new Error("URL tidak valid");
  }

  let data;
  try {
    const res = await axios.post(
      API_URL,
      { url },
      { headers: HEADERS, timeout: 30000 },
    );
    data = res.data;
  } catch (err) {
    
    try {
      const res2 = await axios.post(
        API_URL.replace("https://", "https://www."),
        { url },
        { headers: HEADERS, timeout: 30000 },
      );
      data = res2.data;
    } catch (err2) {
      const msg = err2.response?.data?.message || err2.message || err.message;
      throw new Error(`Gagal menghubungi API: ${msg}`);
    }
  }

  if (!data?.success || !data?.result) {
    throw new Error(data?.message || "Response API tidak valid");
  }

  const r = data.result;

  if (!Array.isArray(r.downloads) || r.downloads.length === 0) {
    throw new Error("Tidak ada link download yang tersedia untuk URL ini");
  }

  const resolveUrl = (u) => {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    const base = new URL(API_URL).origin;
    return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
  };

  return {
    platform: r.platform || "-",
    title: r.title || "-",
    description: r.description || "-",
    owner: r.owner || "-",
    thumbnail: resolveUrl(r.thumbnail) || null,
    duration: r.duration ?? null,
    kind: r.kind || "video",
    sourceUrl: r.sourceUrl || url,
    downloads: r.downloads.map((d) => ({
      label: d.label || d.quality || "Download",
      quality: d.quality || d.label || "-",
      type: (d.type || "video").toLowerCase(),
      url: resolveUrl(d.url),
    })),
  };
}
