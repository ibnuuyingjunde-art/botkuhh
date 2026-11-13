import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";

/**
 * Autoread maksimal:
 * - Dipanggil paling awal di connection.js (sebelum filter handler), jadi pesan yang
 *   tidak sampai ke handler (grup banned, debounce, umur pesan, dsb) tetap terbaca.
 * - Dibatch: kumpulkan pesan ~120ms lalu kirim satu receipt untuk semuanya.
 * - Dedupe per pesan (handler & connection boleh sama-sama memanggil).
 * - Retry otomatis kalau gagal kirim.
 * - Mode: all | private | group (setting `autoReadMode`), on/off lewat `autoRead`.
 */

const FLUSH_DELAY = 120;
const CHUNK_SIZE = 50;
const RETRY_DELAY = 1500;
const DEDUPE_TTL = 10 * 60 * 1000;
const DEDUPE_MAX = 10000;

export const AUTOREAD_MODES = ["all", "private", "group"];

const seen = new Map(); // dedupeKey -> timestamp
const queues = new Map(); // sockId -> { sock, keys: [] , timer }

function sockId(sock) {
  return sock?.user?.id?.split(":")[0]?.split("@")[0] || "main";
}

function pruneSeen() {
  if (seen.size < DEDUPE_MAX) return;
  const now = Date.now();
  for (const [k, t] of seen) {
    if (now - t > DEDUPE_TTL) seen.delete(k);
  }
  // masih kebanyakan -> buang yang paling lama
  if (seen.size >= DEDUPE_MAX) {
    let n = Math.floor(DEDUPE_MAX / 4);
    for (const k of seen.keys()) {
      seen.delete(k);
      if (--n <= 0) break;
    }
  }
}

export function getAutoReadMode() {
  const db = getDatabase();
  const enabled = db.setting("autoRead") ?? config.features?.autoRead ?? false;
  if (!enabled) return "off";
  const mode = db.setting("autoReadMode");
  return AUTOREAD_MODES.includes(mode) ? mode : "all";
}

export function setAutoReadMode(mode) {
  const db = getDatabase();
  if (mode === "off") {
    db.setting("autoRead", false);
    return;
  }
  db.setting("autoRead", true);
  db.setting("autoReadMode", AUTOREAD_MODES.includes(mode) ? mode : "all");
}

function shouldRead(key, mode) {
  if (mode === "off") return false;
  if (!key?.id || !key.remoteJid) return false;
  if (key.fromMe) return false;
  const jid = key.remoteJid;
  // status ditangani autoreadsw, channel/broadcast tidak butuh read receipt
  if (jid === "status@broadcast" || jid.endsWith("@broadcast")) return false;
  if (jid.endsWith("@newsletter")) return false;
  const isGroup = jid.endsWith("@g.us");
  if (mode === "private" && isGroup) return false;
  if (mode === "group" && !isGroup) return false;
  return true;
}

async function sendKeys(sock, keys, attempt = 0) {
  try {
    await sock.readMessages(keys);
  } catch (e) {
    if (attempt < 1) {
      setTimeout(() => {
        sendKeys(sock, keys, attempt + 1).catch(() => {});
      }, RETRY_DELAY);
    }
  }
}

async function flush(id) {
  const q = queues.get(id);
  if (!q) return;
  queues.delete(id);
  clearTimeout(q.timer);
  const keys = q.keys;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    await sendKeys(q.sock, keys.slice(i, i + CHUNK_SIZE));
  }
}

/**
 * Masukkan pesan ke antrean autoread.
 * @returns {boolean} true kalau pesan diantrekan
 */
export function queueRead(sock, key) {
  try {
    if (!sock) return false;
    const mode = getAutoReadMode();
    if (!shouldRead(key, mode)) return false;

    const id = sockId(sock);
    const dk = `${id}|${key.remoteJid}|${key.id}`;
    if (seen.has(dk)) return false;
    pruneSeen();
    seen.set(dk, Date.now());

    let q = queues.get(id);
    if (!q) {
      q = { sock, keys: [], timer: null };
      q.timer = setTimeout(() => flush(id).catch(() => {}), FLUSH_DELAY);
      queues.set(id, q);
    }
    q.sock = sock;
    q.keys.push({
      remoteJid: key.remoteJid,
      id: key.id,
      participant: key.participant,
      fromMe: false,
    });
    return true;
  } catch {
    return false;
  }
}