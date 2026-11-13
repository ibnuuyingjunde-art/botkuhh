import { normalizeMessageContent, getContentType } from "ichigo";

// Cache status@broadcast (story WA) di memori supaya bisa diambil lagi lewat .getsw.
// Yang disimpan cuma metadata pesan (kecil); media baru di-download saat dibutuhkan.
// Cache otomatis dihapus: tiap entry hidup 2 menit, dibersihkan timer tiap 30 detik.
const TTL = 2 * 60 * 1000;
const SWEEP_INTERVAL = 30 * 1000;
const MAX_ENTRIES = 300;
const byId = new Map();

const SUPPORTED = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "extendedTextMessage",
  "conversation",
]);

const digits = (v) =>
  String(v || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

function prune() {
  const now = Date.now();
  for (const [id, e] of byId) if (now - e.cachedAt > TTL) byId.delete(id);
  while (byId.size > MAX_ENTRIES) byId.delete(byId.keys().next().value);
}

// Timer pembersih otomatis (unref biar tidak menahan proses saat shutdown)
const sweeper = setInterval(prune, SWEEP_INTERVAL);
sweeper.unref?.();

function cacheStatus(msg) {
  try {
    const id = msg?.key?.id;
    if (!id || !msg.message) return false;

    const content = normalizeMessageContent(msg.message);
    if (!content) return false;
    const type = getContentType(content);
    if (!SUPPORTED.has(type)) return false;

    const tsRaw = Number(msg.messageTimestamp);
    byId.set(id, {
      id,
      type,
      content,
      key: msg.key,
      number: digits(msg.key.participant || msg.participant),
      pushName: msg.pushName || "",
      cachedAt: Date.now(), // dipakai buat hitung umur cache (bukan waktu posting status)
      ts: Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw * 1000 : Date.now(),
    });
    prune();
    return true;
  } catch {
    return false;
  }
}

function getStatusById(id) {
  prune();
  return byId.get(id) || null;
}

function getStatusesByNumber(number) {
  prune();
  const n = digits(number);
  if (!n) return [];
  return [...byId.values()]
    .filter(
      (e) => e.number && (e.number === n || e.number.endsWith(n) || n.endsWith(e.number)),
    )
    .sort((a, b) => b.ts - a.ts);
}

function swCacheSize() {
  prune();
  return byId.size;
}

export { cacheStatus, getStatusById, getStatusesByNumber, swCacheSize };