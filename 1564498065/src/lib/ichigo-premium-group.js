import path from "path";
import { fileURLToPath } from "url";
import { openStore, importJsonOnce } from "./ichigo-sqlite-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "../../database/main/ichigo.db");
const LEGACY_JSON = path.join(__dirname, "../../database/main/premium_groups.json");
const STORE = "premium_groups";

let cache = null;
let sql = null;

function load() {
  if (cache) return cache;
  try {
    sql = openStore(DB_FILE);
    importJsonOnce(sql, STORE, LEGACY_JSON);
    const data = sql.load(STORE, {});
    cache = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (e) {
    console.error("[premium-group] gagal load:", e.message);
    cache = {};
  }
  return cache;
}

function save() {
  try {
    if (!sql) load();
    sql.save(STORE, cache || {});
  } catch (e) {
    console.error("[premium-group] gagal simpan:", e.message);
  }
}

export function normalizeGroupId(id) {
  const s = String(id || "").trim();
  if (!s) return "";
  return s.includes("@g.us") ? s : s.replace(/[^0-9-]/g, "") + "@g.us";
}

function isExpiredEntry(data) {
  if (!data) return true;
  if (data.isLifetime) return false;
  return !data.expiredAt || data.expiredAt <= Date.now();
}

/** Cek apakah grup premium (aktif). Entry yang sudah expired otomatis dihapus. */
export function isPremiumGroup(groupId) {
  if (!groupId || !String(groupId).endsWith("@g.us")) return false;
  const db = load();
  const data = db[groupId];
  if (!data) return false;
  if (isExpiredEntry(data)) {
    delete db[groupId];
    save();
    return false;
  }
  return true;
}

export function getPremiumGroup(groupId) {
  return load()[groupId] || null;
}

/**
 * Tambah / perpanjang premium grup.
 * @param {number} expiredAt timestamp ms, atau Infinity untuk lifetime
 * @returns {{extended: boolean, data: object}}
 */
export function addPremiumGroup({ groupId, name, expiredAt, durationMs, addedBy }) {
  const db = load();
  const now = Date.now();
  const existing = db[groupId];
  const extended = !!existing && !isExpiredEntry(existing);
  const lifetime = expiredAt === Infinity;

  let finalExpired = 0;
  if (!lifetime) {
    if (extended && !existing.isLifetime && durationMs) {
      finalExpired = existing.expiredAt + durationMs;
    } else if (extended && existing.isLifetime) {
      finalExpired = expiredAt;
    } else {
      finalExpired = expiredAt;
    }
  }

  db[groupId] = {
    name: name || existing?.name || "Unknown",
    addedAt: existing?.addedAt || now,
    updatedAt: now,
    expiredAt: lifetime ? 0 : finalExpired,
    isLifetime: lifetime,
    addedBy: addedBy || existing?.addedBy || null,
  };
  save();
  scheduleTick();
  return { extended, data: db[groupId] };
}

export function removePremiumGroup(groupId) {
  const db = load();
  if (!db[groupId]) return null;
  const old = db[groupId];
  delete db[groupId];
  save();
  return old;
}

/** Daftar semua grup premium (termasuk yang sudah expired, supaya owner bisa lihat). */
export function listPremiumGroups() {
  const db = load();
  return Object.entries(db).map(([id, data]) => ({ id, ...data }));
}

/** Hapus semua entry expired, return jumlah yang dihapus. */
export function pruneExpired() {
  const db = load();
  let n = 0;
  for (const [id, data] of Object.entries(db)) {
    if (isExpiredEntry(data)) {
      delete db[id];
      n++;
    }
  }
  if (n) save();
  return n;
}

export function formatRemaining(data) {
  if (data.isLifetime) return "Permanent";
  const diff = (data.expiredAt || 0) - Date.now();
  if (diff <= 0) return "EXPIRED";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const mnt = Math.floor((diff % 3600000) / 60000);
  const sec = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${mnt}m ${sec}s`;
  if (h > 0) return `${h}h ${mnt}m ${sec}s`;
  if (mnt > 0) return `${mnt}m ${sec}s`;
  return `${sec}s`;
}

let watcherSock = null;
let watcherTimer = null;
const MAX_WAIT = 30 * 1000; // tetap cek file tiap 30 detik (deteksi edit manual)

async function expireDue() {
  const db = load();
  const due = Object.entries(db).filter(([, d]) => isExpiredEntry(d));
  for (const [id, data] of due) {
    delete db[id];
    save();
    try {
      await watcherSock.sendMessage(id, {
        text:
          `⏰ *PREMIUM GRUP BERAKHIR*\n\n` +
          `Masa premium grup *${data.name || "ini"}* sudah habis.\n` +
          `Hubungi owner untuk perpanjang.`,
      });
    } catch {}
  }
}

async function tick() {
  watcherTimer = null;
  try {
    await expireDue();
  } catch (e) {
    console.error("[premium-group] watcher error:", e.message);
  }
  scheduleTick();
}

// Jadwalkan pengecekan tepat di detik expired terdekat (maks 30 detik)
function scheduleTick() {
  if (!watcherSock) return;
  if (watcherTimer) clearTimeout(watcherTimer);
  const now = Date.now();
  let wait = MAX_WAIT;
  for (const d of Object.values(load())) {
    if (d.isLifetime || !d.expiredAt) continue;
    wait = Math.min(wait, Math.max(d.expiredAt - now, 0) + 50);
  }
  watcherTimer = setTimeout(tick, wait);
  if (watcherTimer.unref) watcherTimer.unref();
}

/**
 * Watcher realtime: grup dicabut tepat saat expired dan grupnya dikabari.
 * Cukup dipanggil sekali (aman dipanggil berulang).
 */
export function startPremiumGroupWatcher(sock) {
  if (watcherSock || !sock) return;
  watcherSock = sock;
  scheduleTick();
}