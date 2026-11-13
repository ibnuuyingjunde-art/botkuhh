import axios from "axios";
import config from "../../config.js";
import FormData from "form-data";

const OBS_KEY = config.APIkey.obscura;

function isImageBuffer(b) {
  if (!Buffer.isBuffer(b) || b.length < 12) return false;
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return true;
  return false;
}

async function uploadBuf(buf) {
  const form = new FormData();
  form.append("file", buf, { filename: "img.jpg" });
  const r = await axios.post("https://kappa.lol/api/upload", form, {
    headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  const d = r.data;
  if (typeof d === "string" && /^https?:\/\//i.test(d.trim())) return d.trim();
  const found =
    d?.url || d?.link || d?.data?.url || d?.data?.link || d?.result?.url || d?.files?.[0]?.url;
  if (typeof found === "string" && /^https?:\/\//i.test(found)) return found;
  if (d?.id) return `https://kappa.lol/${d.id}${d.ext || ""}`;
  throw new Error("Upload ke kappa.lol gagal: respon tidak berisi link");
}

function findBase64(o, depth = 0) {
  if (depth > 5 || o == null) return null;
  if (typeof o === "string") {
    const m = o.match(/^data:image\/[\w.+-]+;base64,(.+)$/s);
    if (m) return Buffer.from(m[1], "base64");
    if (o.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(o)) {
      const b = Buffer.from(o, "base64");
      return isImageBuffer(b) ? b : null;
    }
    return null;
  }
  if (Array.isArray(o)) {
    for (const v of o) {
      const b = findBase64(v, depth + 1);
      if (b) return b;
    }
    return null;
  }
  if (typeof o === "object") {
    for (const v of Object.values(o)) {
      const b = findBase64(v, depth + 1);
      if (b) return b;
    }
  }
  return null;
}

function findUrl(o, depth = 0) {
  if (depth > 5 || o == null) return null;
  if (typeof o === "string") {
    return /^https?:\/\//i.test(o.trim()) ? o.trim() : null;
  }
  if (Array.isArray(o)) {
    for (const v of o) {
      const u = findUrl(v, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof o === "object") {
    const keys = ["url", "image", "result", "output", "link", "data", "images"];
    for (const k of keys) {
      if (k in o) {
        const u = findUrl(o[k], depth + 1);
        if (u) return u;
      }
    }
    for (const v of Object.values(o)) {
      const u = findUrl(v, depth + 1);
      if (u) return u;
    }
  }
  return null;
}

async function resolveImage(data) {
  const buf = Buffer.from(data);
  if (isImageBuffer(buf)) return buf;

  const text = buf.toString("utf8").trim();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  const b64 = json ? findBase64(json) : null;
  if (b64) {
    if (!isImageBuffer(b64)) throw new Error("Data base64 dari API bukan gambar valid");
    return b64;
  }

  const url = json ? findUrl(json) : null;
  if (url) {
    const r = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const img = Buffer.from(r.data);
    if (isImageBuffer(img)) return img;
    throw new Error("Link hasil dari API bukan gambar valid");
  }

  throw new Error(`Respon API: ${text.slice(0, 200) || "(kosong)"}`);
}

async function fromNanobanana(imageBuffer, prompt) {
  const imgUrl = await uploadBuf(imageBuffer);
  const r = await axios.get(
    `https://api-cloud.my.id/ai/nanobanana?url=${encodeURIComponent(imgUrl)}&prompt=${encodeURIComponent(prompt)}`,
    {
      responseType: "arraybuffer",
      timeout: 120000,
      validateStatus: () => true,
    },
  );
  return resolveImage(r.data);
}

async function live3d(
  imageBuffer,
  prompt = "Make this person the skin is very black, but skin tone still natural",
) {
  const image = await fromNanobanana(imageBuffer, prompt);
  return { image };
}

async function fluxImage(message, ratio = "1:1") {
  const r = await axios.post(
    "https://api.yuulabs.web.id/api/ai/flux-img",
    {
      message,
      ratio,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    },
  );

  const data = r.data;
  if (!data?.status || !data?.result?.url) {
    throw new Error(data?.message || data?.error || "Gagal membuat gambar");
  }

  return data.result;
}

export { live3d, fluxImage };