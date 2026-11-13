import axios from 'axios'
import FormData from 'form-data'
import config from '../../config.js'

const DEFAULT_HOSTS = [
  { name: 'cdn-ichigo', url: 'https://cdn-ichigo.web.id/upload', field: 'file' },
  { name: 'kappa', url: 'https://kappa.lol/api/upload', field: 'file' },
]

function pickUrl(data, host) {
  if (typeof data === 'string' && /^https?:\/\//i.test(data.trim())) return data.trim()
  const d = data || {}
  const found =
    d.url || d.link || d.data?.url || d.data?.link || d.result?.url || d.result?.link || d.files?.[0]?.url
  if (typeof found === 'string' && /^https?:\/\//i.test(found)) return found
  if (host.name === 'kappa' && d.id) return `https://kappa.lol/${d.id}${d.ext || ''}`
  return null
}

async function uploadToHost(host, buffer, filename) {
  const form = new FormData()
  form.append(host.field || 'file', buffer, { filename })

  const response = await axios.post(host.url, form, {
    headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  })

  const url = pickUrl(response.data, host)
  if (!url) throw new Error('respon tidak berisi link')
  return url
}

/**
 * Upload ke host berurutan (config.uploader.hosts, default cdn-ichigo lalu
 * kappa.lol). Kalau satu host gagal, lanjut ke host berikutnya.
 */
async function uploadToCdn(buffer, filename = 'image.jpg') {
  const hosts = config.uploader?.hosts?.length ? config.uploader.hosts : DEFAULT_HOSTS
  const errors = []
  for (const host of hosts) {
    try {
      return await uploadToHost(host, buffer, filename)
    } catch (e) {
      errors.push(`${host.name}: ${e.message}`)
    }
  }
  throw new Error(`Semua host upload gagal (${errors.join(' | ')})`)
}

/**
 * Upload ke SEMUA host (cdn-ichigo + kappa, sesuai config.uploader.hosts) dan
 * kembalikan semua link yang berhasil. Link pertama = utama, sisanya cadangan.
 */
async function uploadToAllHosts(buffer, filename = 'image.jpg') {
  const hosts = config.uploader?.hosts?.length ? config.uploader.hosts : DEFAULT_HOSTS
  const results = await Promise.allSettled(hosts.map((h) => uploadToHost(h, buffer, filename)))
  const urls = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  if (!urls.length) {
    const errs = results.map((r, i) => `${hosts[i].name}: ${r.reason?.message}`)
    throw new Error(`Semua host upload gagal (${errs.join(' | ')})`)
  }
  return [...new Set(urls)]
}

export const uploadImage = uploadToCdn
export const uploadToTelegraph = uploadToCdn
export const uploadTo0x0 = uploadToCdn
export const uploadToCatbox = uploadToCdn
export const uploadToTmpfiles = uploadToCdn
export const uploadToUguu = uploadToCdn

import fs from 'fs';
import path from 'path';
import { ImageUploadService } from 'node-upload-images';

import { updateAssetAndSave, fetchAndCacheAsset, loadAssetBuffer } from './ichigo-asset-manager.js';

export async function updateAssetUrl(assetKey, buffer, filename = 'image.jpg') {
  const urls = await uploadToAllHosts(buffer, filename);
  return updateAssetLink(assetKey, urls);
}

/**
 * Satu pintu untuk semua command ganti-*: terima link (langsung disimpan)
 * atau buffer (di-upload ke CDN dulu jadi link). Hasil akhirnya selalu link.
 */
export async function setAssetFromInput(assetKey, { buffer, linkUrl, filename = 'image.jpg' } = {}) {
  if (linkUrl) return updateAssetLink(assetKey, linkUrl);
  if (!buffer) throw new Error('Tidak ada media atau link');
  const urls = await uploadToAllHosts(buffer, filename);
  return updateAssetLink(assetKey, urls);
}

/**
 * Ganti asset jadi link (bukan file lokal). Link divalidasi dengan cara
 * di-fetch dulu (sekalian di-cache) SEBELUM config.js ditulis, jadi kalau
 * link mati/salah, config tidak ikut ke-update ke link yang rusak.
 *
 * @param {string} assetKey - Key asset di config.assets, mis. 'ichigo2'
 * @param {string} url - Link http(s) ke file gambar/video/audio/font
 * @returns {Promise<string>} url yang tersimpan
 */
export async function updateAssetLink(assetKey, urlOrUrls) {
  const urls = (Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls]).filter(Boolean);
  if (!urls.length || urls.some((u) => typeof u !== 'string' || !/^https?:\/\//i.test(u))) {
    throw new Error('URL harus diawali http:// atau https://');
  }

  // Validasi: minimal 1 link harus bisa di-fetch. Link yang mati dibuang dari daftar.
  const alive = [];
  let lastErr;
  for (const u of urls) {
    try {
      if (!alive.length) await fetchAndCacheAsset(assetKey, u);
      alive.push(u);
    } catch (e) {
      lastErr = e;
    }
  }
  if (!alive.length) throw lastErr || new Error('Link tidak bisa diakses');

  const value = alive.length > 1 ? alive : alive[0];
  const literal = Array.isArray(value)
    ? `[${value.map((u) => JSON.stringify(u)).join(', ')}]`
    : JSON.stringify(value);

  if (!config.assets) config.assets = {};
  config.assets[assetKey] = value;

  const configPath = path.join(process.cwd(), 'config.js');
  let configContent = fs.readFileSync(configPath, 'utf8');

  const regex = new RegExp(`("${assetKey}"\\s*:\\s*)(\\[[^\\]]*\\]|"[^"]*")`);
  if (regex.test(configContent)) {
    configContent = configContent.replace(regex, (_m, p1) => `${p1}${literal}`);
  } else {
    const assetsBlockRegex = /(assets\s*:\s*\{)([^}]*)(\})/;
    if (assetsBlockRegex.test(configContent)) {
      configContent = configContent.replace(assetsBlockRegex, (_m, p1, p2, p3) => {
        let inner = p2.trim();
        if (inner.endsWith(',')) inner = inner.slice(0, -1);
        if (inner.length > 0) return `${p1}\n    ${inner},\n    "${assetKey}": ${literal}\n  ${p3}`;
        return `${p1}\n    "${assetKey}": ${literal}\n  ${p3}`;
      });
    }
  }
  fs.writeFileSync(configPath, configContent, 'utf8');

  return alive[0];
}

/**
 * Cadangin 1 asset yang sumbernya link ke kappa.lol, lalu tambahkan link kappa
 * sebagai cadangan di config.assets[key] (jadi array). Sumber isi file:
 * link utama kalau masih hidup, kalau mati pakai file lokal assets/images/<key>.jpg|png.
 *
 * @returns {Promise<{status:'ok'|'skip', url?:string, reason?:string}>}
 */
export async function backupAssetToKappa(assetKey) {
  const raw = config.assets?.[assetKey];
  const sources = (Array.isArray(raw) ? raw : [raw]).filter((v) => typeof v === 'string' && v);
  if (!sources.length) return { status: 'skip', reason: 'tidak ada di config' };
  if (!sources.every((u) => /^https?:\/\//i.test(u))) return { status: 'skip', reason: 'file lokal (sudah aman di disk)' };
  if (sources.some((u) => /kappa\.lol/i.test(u))) return { status: 'skip', reason: 'sudah ada cadangan kappa' };

  let buffer = await loadAssetBuffer(assetKey).catch(() => null);
  let ext = (sources[0].split('?')[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  if (!buffer) {
    for (const e of ['jpg', 'png', 'jpeg', 'webp', 'mp4', 'mp3']) {
      const lp = path.resolve(process.cwd(), `./assets/images/${assetKey}.${e}`);
      if (fs.existsSync(lp)) { buffer = fs.readFileSync(lp); ext = e; break; }
    }
  }
  if (!buffer) return { status: 'skip', reason: 'link mati dan tidak ada file lokal, kirim ulang pakai command ganti-*' };

  const hosts = config.uploader?.hosts?.length ? config.uploader.hosts : DEFAULT_HOSTS;
  const host = hosts.find((h) => h.name === 'kappa') || DEFAULT_HOSTS[1];
  const url = await uploadToHost(host, buffer, `${assetKey}.${ext || 'jpg'}`);

  // Link utama yang mati otomatis dibuang updateAssetLink, kappa jadi pengganti.
  await updateAssetLink(assetKey, [...sources, url]);
  return { status: 'ok', url };
}
