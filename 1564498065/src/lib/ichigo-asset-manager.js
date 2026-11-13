import fs from 'fs';
import path from 'path';
import { logger } from './ichigo-logger.js';
import config from '../../config.js';

// Cache memori dibatasi per total byte (LRU). Asset dari link disimpan juga di
// disk (database/asset-cache) sehingga tidak perlu fetch ulang tiap restart dan
// tidak harus ditahan di RAM. Atur batas RAM lewat env ASSET_CACHE_MB (default 8).
const CACHE_DIR = path.join(process.cwd(), 'database', 'asset-cache');
const MAX_CACHE_BYTES = (Number(process.env.ASSET_CACHE_MB) || 8) * 1024 * 1024;

const memCache = new Map();
let memBytes = 0;

const assetCache = {
  get(key) {
    const buf = memCache.get(key);
    if (!buf) return undefined;
    memCache.delete(key);
    memCache.set(key, buf);
    return buf;
  },
  set(key, buf) {
    const old = memCache.get(key);
    if (old) {
      memBytes -= old.length;
      memCache.delete(key);
    }
    if (!buf || buf.length > MAX_CACHE_BYTES / 2) return; // terlalu besar, cukup dari disk
    memCache.set(key, buf);
    memBytes += buf.length;
    while (memBytes > MAX_CACHE_BYTES && memCache.size > 1) {
      const oldestKey = memCache.keys().next().value;
      memBytes -= memCache.get(oldestKey).length;
      memCache.delete(oldestKey);
    }
  },
};

const diskPath = (key) => path.join(CACHE_DIR, String(key).replace(/[^a-zA-Z0-9._-]/g, '_') + '.bin');

function diskRead(key) {
  try {
    const f = diskPath(key);
    return fs.existsSync(f) ? fs.readFileSync(f) : null;
  } catch {
    return null;
  }
}

function diskWrite(key, buf) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(diskPath(key), buf);
  } catch {}
}

const ASSET_FETCH_TIMEOUT_MS = 15000;
const MAX_ASSET_BYTES = 25 * 1024 * 1024; 

function isUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function toSources(source) {
  if (Array.isArray(source)) return source.filter((v) => typeof v === 'string' && v);
  return typeof source === 'string' && source ? [source] : [];
}

/**
 * Ambil 1 asset dari daftar sumber (link / path lokal), dicoba berurutan.
 * Contoh config: "ichigo": ["https://cdn-ichigo.web.id/i/x.jpg", "https://kappa.lol/xxxx"]
 * Link pertama yang berhasil dipakai, sisanya jadi cadangan.
 */
async function loadFromSources(key, source, attempts = 3) {
  const sources = toSources(source);
  let lastErr = new Error('tidak ada sumber');
  for (const src of sources) {
    try {
      if (isUrl(src)) {
        const fetched = await fetchWithRetry(src, key, attempts);
        diskWrite(key, fetched);
        return fetched;
      }
      const fullPath = path.resolve(process.cwd(), src);
      if (!fs.existsSync(fullPath)) throw new Error(`file tidak ditemukan: ${fullPath}`);
      return fs.readFileSync(fullPath);
    } catch (e) {
      lastErr = e;
      logger.warn('Asset', `${key}: sumber ${src} gagal (${e.message})${sources.length > 1 ? ', coba cadangan' : ''}`);
    }
  }
  // semua sumber gagal: pakai salinan terakhir di disk kalau ada
  const fromDisk = diskRead(key);
  if (fromDisk) {
    logger.warn('Asset', `${key}: pakai salinan cache disk karena semua sumber gagal`);
    return fromDisk;
  }
  throw lastErr;
}

/**
 * Download asset dari URL ke Buffer, dengan timeout & batas ukuran.
 */
async function fetchAssetBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (/text\/html/i.test(res.headers.get('content-type') || '')) {
      throw new Error('link mengembalikan halaman web, bukan file langsung');
    }

    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength && declaredLength > MAX_ASSET_BYTES) {
      throw new Error(`File terlalu besar (${(declaredLength / 1024 / 1024).toFixed(1)}MB, maks ${MAX_ASSET_BYTES / 1024 / 1024}MB)`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_ASSET_BYTES) {
      throw new Error(`File terlalu besar (${(buf.length / 1024 / 1024).toFixed(1)}MB, maks ${MAX_ASSET_BYTES / 1024 / 1024}MB)`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, key, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetchAssetBuffer(url);
    } catch (e) {
      lastErr = e;
      if (i < attempts) {
        logger.warn('Asset', `fetch ${key} gagal (${e.message}), coba lagi ${i}/${attempts - 1}`);
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
  }
  throw lastErr;
}

/**
 * Preload all assets into memory at startup. Mendukung path lokal ("./assets/...")
 * maupun link ("https://..."), link di-fetch paralel biar boot tidak molor.
 * @param {Object} configAssets - botConfig.assets atau config.assets
 */
export async function preloadAssets(configAssets) {
  if (!configAssets) return;

  let cached = 0;
  let failed = 0;
  const jobs = [];

  for (const [key, source] of Object.entries(configAssets)) {
    const srcs = toSources(source);
    if (!srcs.length) continue;
    // Asset yang punya file lokal tidak perlu di-preload: dibaca on-demand
    // oleh getAssetBuffer dan dibatasi LRU, jadi tidak menetap di RAM.
    if (srcs.some((x) => !isUrl(x) && fs.existsSync(path.resolve(process.cwd(), x)))) continue;
    jobs.push(
      loadFromSources(key, source)
        .then((buf) => {
          assetCache.set(key, buf);
          cached++;
        })
        .catch((e) => {
          failed++;
          logger.warn('Asset', `gagal muat ${key}: ${e.message}`);
        }),
    );
  }

  await Promise.all(jobs);
  logger.success('Asset', `${cached} aset link di-cache (disk+LRU)${failed ? `, ${failed} gagal` : ''}; aset lokal dibaca saat dipakai`);
}

/**
 * Get the cached asset buffer by key (e.g. 'ichigo', 'ichigo2').
 * Kalau belum ke-cache dan sumbernya file lokal, dibaca sync sebagai fallback.
 * Kalau sumbernya link dan belum ke-cache (mis. baru ditambah sebelum restart
 * berikutnya), TIDAK fetch sync di sini (biar tidak block event loop) — panggil
 * refreshAsset(key) dulu, atau tunggu next boot.
 *
 * @param {string} key - The asset key defined in config.assets
 * @param {Object} [configAssets] - Optional config.assets reference for fallback
 * @returns {Buffer | null} The asset as a Buffer, or null if missing.
 */
export function getAssetBuffer(key, configAssets = null) {
  const hit = assetCache.get(key);
  if (hit) return hit;

  const assets = configAssets || config?.assets;
  const source = assets?.[key];
  if (!source) {
    for (const ext of ['jpg', 'png']) {
      const legacy = path.resolve(process.cwd(), `./assets/images/${key}.${ext}`);
      if (fs.existsSync(legacy)) {
        const legacyBuf = fs.readFileSync(legacy);
        assetCache.set(key, legacyBuf);
        return legacyBuf;
      }
    }
    return null;
  }

  const srcList = toSources(source);
  if (srcList.some(isUrl) && !srcList.some((x) => !isUrl(x) && fs.existsSync(path.resolve(process.cwd(), x)))) {
    const onDisk = diskRead(key);
    if (onDisk) {
      assetCache.set(key, onDisk);
      return onDisk;
    }
    logger.warn('Asset', `${key} pakai link tapi belum ke-cache, panggil refreshAsset("${key}") dulu`);
    return null;
  }

  try {
    const localSrc = srcList.find((x) => !isUrl(x) && fs.existsSync(path.resolve(process.cwd(), x)));
    if (localSrc) {
      const buf = fs.readFileSync(path.resolve(process.cwd(), localSrc));
      assetCache.set(key, buf);
      return buf;
    }
  } catch (e) {
    console.error(`[AssetManager] Failed to read ${key} from disk:`, e.message);
  }

  return null;
}

/**
 * Fetch ulang 1 asset (lokal atau link) dan langsung update cache-nya.
 * Dipakai owner command setelah ganti link, biar tidak perlu restart bot
 * dulu buat lihat hasilnya.
 */
export async function refreshAsset(key, configAssets = null) {
  const assets = configAssets || config?.assets;
  const source = assets?.[key];
  if (!source) throw new Error(`Asset "${key}" tidak ditemukan di config`);

  const buf = await loadFromSources(key, source);
  assetCache.set(key, buf);
  return buf;
}

/**
 * Fetch sebuah link dan simpan ke cache di bawah key tertentu, tanpa perlu
 * link itu sudah terdaftar di config.assets. Dipakai saat proses ganti-asset
 * memvalidasi link baru sebelum config.js ditulis.
 */
export async function fetchAndCacheAsset(key, url) {
  const buf = await fetchAssetBuffer(url);
  if (config?.assets?.[key]) diskWrite(key, buf);
  assetCache.set(key, buf);
  return buf;
}

/**
 * Update an asset buffer in memory and save it to disk (useful for owner commands that change assets).
 *
 * @param {string} key - Asset key
 * @param {Buffer} buffer - New asset buffer
 * @param {string} filepath - The path where it should be saved
 */
export function updateAssetAndSave(key, buffer, filepath) {
  assetCache.set(key, buffer);
  if (filepath && !filepath.startsWith('http')) {
    try {
      const fullPath = path.resolve(process.cwd(), filepath);
      fs.writeFileSync(fullPath, buffer);
    } catch (e) {
      console.error(`[AssetManager] Failed to write updated asset ${key} to disk:`, e.message);
    }
  }
}

/**
 * Ambil asset sebagai Buffer secara async: pakai cache kalau ada, kalau belum
 * di-fetch dari link (atau dibaca dari file lokal) lalu di-cache. Return null
 * kalau gagal, jadi pemanggil tinggal kasih fallback.
 */
export async function loadAssetBuffer(key, configAssets = null) {
  const hit = assetCache.get(key);
  if (hit) return hit;
  try {
    return await refreshAsset(key, configAssets);
  } catch (e) {
    logger.warn('Asset', `gagal load ${key}: ${e.message}`);
    return null;
  }
}
