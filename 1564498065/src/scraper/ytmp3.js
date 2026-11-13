import axios from "axios";
import crypto from "crypto";
import { probeMedia } from "./probe.js";

/**
 * ytmp3 - downloader MP3 tanpa yt-dlp / ffmpeg.
 * Backend (berurutan): savetube -> ytmp3.ing. Tiap link divalidasi (bukan HTML) sebelum dipakai;
 * kalau backend pertama membalas halaman HTML, otomatis lanjut ke backend berikutnya.
 * Pencarian judul TIDAK ada di sini (ditangani ytdl2.js lewat ytsearch-safe).
 */

const SAVETUBE_KEY = "C5D58EF67A7584E4A29F6C35BBC4EB12";
const REQ_MS = 15000;

function decryptSavetube(base64) {
  const raw = Buffer.from(base64, "base64");
  const d = crypto.createDecipheriv("aes-128-cbc", Buffer.from(SAVETUBE_KEY, "hex"), raw.subarray(0, 16));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(16)), d.final()]).toString("utf8"));
}

// "3:04" / "1:02:03" -> detik
function labelToSec(str) {
  if (!str || typeof str !== "string") return undefined;
  const p = str.split(":").map((n) => parseInt(n, 10));
  if (p.some(Number.isNaN)) return undefined;
  return p.reduce((a, n) => a * 60 + n, 0) || undefined;
}

async function savetube(videoUrl, quality, signal) {
  const { data: c } = await axios.get("https://media.savetube.vip/api/random-cdn", { timeout: REQ_MS, signal });
  const cdn = c?.cdn;
  if (!cdn) throw new Error("savetube: CDN tidak tersedia");

  const { data } = await axios.post(`https://${cdn}/v2/info`, { url: videoUrl }, { timeout: REQ_MS, signal });
  if (!data?.status) throw new Error(data?.message || "savetube: gagal ambil info video");
  const info = decryptSavetube(data.data);
  if (!info?.key) throw new Error("savetube: key tidak ditemukan");

  const { data: dl } = await axios.post(
    `https://${cdn}/download`,
    { downloadType: "audio", quality: String(quality), key: info.key },
    { timeout: REQ_MS, signal }
  );
  const download = dl?.data?.downloadUrl;
  if (!download) throw new Error(dl?.message || "savetube: link download kosong");

  return {
    source: "savetube",
    title: info.title,
    thumbnail: info.thumbnail,
    duration: labelToSec(info.durationLabel),
    download,
  };
}

async function ytmp3ing(videoUrl, signal) {
  const res = await axios.get("https://ytmp3.ing/", { timeout: REQ_MS, signal });
  const cookie = res.headers["set-cookie"]?.join("; ") || "";
  const csrf = String(res.data).match(/value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error("ytmp3.ing: CSRF token tidak ditemukan");

  const boundary = "----WebKitFormBoundaryAzbry";
  const body = `${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${videoUrl}\r\n${boundary}--\r\n`;

  const response = await axios.post("https://ytmp3.ing/audio", body, {
    timeout: REQ_MS,
    signal,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      "x-csrftoken": csrf,
      cookie,
    },
  });

  const enc = response.data?.url;
  if (!enc) throw new Error("ytmp3.ing: link kosong");
  return {
    source: "ytmp3.ing",
    title: response.data?.filename || undefined,
    download: Buffer.from(enc, "base64").toString("utf-8"),
    headers: { cookie },
  };
}

/**
 * @param {string} videoId
 * @param {{quality?: string|number, signal?: AbortSignal}} opts
 * @returns hasil bentuk ytdl2 (status true, download, headers, source, ...) atau throw Error
 */
export async function getMp3(videoId, opts = {}) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const quality = opts.quality || "128";
  const backends = [
    ["savetube", () => savetube(videoUrl, quality, opts.signal)],
    ["ytmp3.ing", () => ytmp3ing(videoUrl, opts.signal)],
  ];

  const errors = [];
  for (const [name, run] of backends) {
    if (opts.signal?.aborted) break;
    try {
      const r = await run();
      const probe = await probeMedia(r.download, "audio", { headers: r.headers, timeout: 10000 });
      if (!probe.ok) throw new Error(`link bukan file media (${probe.reason})`);
      return {
        status: true,
        source: r.source,
        title: r.title,
        videoId,
        url: videoUrl,
        thumbnail: r.thumbnail,
        duration: r.duration,
        format: "mp3",
        quality: `${quality} kbps`,
        file: undefined,
        download: r.download,
        headers: r.headers,
      };
    } catch (e) {
      const msg = e?.response?.status ? `HTTP ${e.response.status}` : e?.message || String(e);
      errors.push(`${name}: ${msg}`);
      console.error(`[ytmp3] ${name} gagal: ${msg}`);
    }
  }
  throw new Error(`Semua backend gagal. ${errors.join(" | ")}`);
}

export default getMp3;
