import axios from "axios";

const PROBE_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36";

/**
 * Cek apakah sebuah URL download benar-benar file media (bukan halaman HTML
 * landing / JSON error). Hanya membaca beberapa byte pertama lalu menutup koneksi.
 *
 * @param {string} url
 * @param {"audio"|"video"} kind
 * @param {{headers?: object, timeout?: number, minBytes?: number}} opts
 * @returns {Promise<{ok:boolean, reason?:string, contentType?:string, size?:number|null}>}
 */
export async function probeMedia(url, kind = "video", opts = {}) {
  const minBytes = opts.minBytes ?? (kind === "video" ? 100_000 : 20_000);
  let res;
  try {
    res = await axios.get(url, {
      responseType: "stream",
      timeout: opts.timeout || 15000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { "User-Agent": PROBE_UA, Range: "bytes=0-2047", ...(opts.headers || {}) },
    });
  } catch (e) {
    return { ok: false, reason: `probe gagal: ${e.message}` };
  }

  const ct = String(res.headers["content-type"] || "").toLowerCase();
  const range = String(res.headers["content-range"] || "");
  const total = Number(range.split("/")[1]) || Number(res.headers["content-length"]) || null;

  let head = Buffer.alloc(0);
  try {
    head = await new Promise((resolve, reject) => {
      const chunks = [];
      let len = 0;
      const done = () => {
        res.data.destroy();
        resolve(Buffer.concat(chunks));
      };
      res.data.on("data", (c) => {
        chunks.push(c);
        len += c.length;
        if (len >= 64) done();
      });
      res.data.on("end", () => resolve(Buffer.concat(chunks)));
      res.data.on("error", reject);
      setTimeout(done, 8000).unref?.();
    });
  } catch {
    /* abaikan, putuskan dari header saja */
  }

  if (res.status >= 400) return { ok: false, reason: `HTTP ${res.status}`, contentType: ct, size: total };
  if (/text\/|json|xml|html/.test(ct))
    return { ok: false, reason: `bukan media (content-type: ${ct})`, contentType: ct, size: total };
  const first = head.toString("utf8", 0, 16).trimStart();
  if (first.startsWith("<") || first.startsWith("{"))
    return { ok: false, reason: "isi file berupa HTML/JSON", contentType: ct, size: total };
  if (total !== null && total < minBytes)
    return { ok: false, reason: `file terlalu kecil (${total} byte)`, contentType: ct, size: total };
  return { ok: true, contentType: ct, size: total };
}

export default probeMedia;
