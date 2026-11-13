import { logger } from "./ichigo-logger.js";

const RSS_LIMIT_MB = Number(process.env.MEMORY_RSS_LIMIT_MB) || 1024;
const RSS_LIMIT = RSS_LIMIT_MB > 0 ? RSS_LIMIT_MB * 1024 * 1024 : null;
const RSS_WARN = 1.5 * 1024 * 1024 * 1024; 
const CHECK_INTERVAL = 60 * 1000;
// GC paksa tidak perlu tiap menit; cukup tiap N menit (butuh node --expose-gc).
const GC_EVERY_TICKS = Number(process.env.MEMORY_GC_EVERY_MIN) || 2;
let tick = 0;

// Log RSS hanya muncul kalau berubah >= nilai ini (MB) dari log terakhir.
// Atur lewat env MEMORY_LOG_DELTA_MB, isi 0 untuk mematikan.
const _delta = process.env.MEMORY_LOG_DELTA_MB;
const LOG_DELTA_MB = _delta !== undefined && Number.isFinite(Number(_delta)) ? Number(_delta) : 50;
const LOG_DELTA = LOG_DELTA_MB * 1024 * 1024;

let monitorTimer = null;
let lastCheck = null;
let lastMem = null;
let startRss = null;      // RSS saat monitor mulai (patokan untuk lihat kenaikan)
let lastLoggedRss = null; // RSS pada log terakhir

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + "MB";
}

function startMemoryMonitor() {
  if (monitorTimer) return;

  startRss = lastLoggedRss = process.memoryUsage().rss;

  monitorTimer = setInterval(() => {
    const mem = process.memoryUsage();
    lastCheck = Date.now();
    lastMem = mem;

    if (global.gc && ++tick % GC_EVERY_TICKS === 0) global.gc();

    if (RSS_LIMIT && mem.rss >= RSS_LIMIT) {
      logger.warn(
        "memory",
        `RSS ${formatMB(mem.rss)} exceeded ${formatMB(RSS_LIMIT)} limit, restarting`,
      );
      process.exit(1);
      return;
    }

    if (mem.rss >= RSS_WARN) {
      logger.warn(
        "memory",
        `RSS tinggi: ${formatMB(mem.rss)} (cuma warning, proses TIDAK dimatikan)`,
      );
    } else if (LOG_DELTA > 0 && Math.abs(mem.rss - lastLoggedRss) >= LOG_DELTA) {
      const up = mem.rss > lastLoggedRss;
      logger.system(
        "memory",
        `rss ${formatMB(mem.rss)} ${up ? "▲ +" : "▼ -"}${formatMB(Math.abs(mem.rss - lastLoggedRss))} · heap ${formatMB(mem.heapUsed)}/${formatMB(mem.heapTotal)} · buffer ${formatMB(mem.arrayBuffers || 0)} · ext ${formatMB(mem.external || 0)} · native-lain ${formatMB(Math.max(0, mem.rss - mem.heapTotal - (mem.external || 0)))}`,
      );
      lastLoggedRss = mem.rss;
    }

  }, CHECK_INTERVAL);

  if (monitorTimer.unref) monitorTimer.unref();
  logger.success(
    "memory",
    `monitoring active, limit ${RSS_LIMIT ? formatMB(RSS_LIMIT) : "tidak dibatasi (cuma warning di " + formatMB(RSS_WARN) + ")"}, check every ${CHECK_INTERVAL / 1000}s`,
  );
}

function stopMemoryMonitor() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

function getMemoryStats() {
  const mem = lastMem || process.memoryUsage();
  let peakRss = null;
  try {
    peakRss = process.resourceUsage().maxRSS * 1024; // maxRSS dalam KB
  } catch { }
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external ?? 0,
    arrayBuffers: mem.arrayBuffers ?? 0,
    peakRss,
    startRss,
    limit: RSS_LIMIT,
    warnAt: RSS_WARN,
    percent: RSS_LIMIT ? (mem.rss / RSS_LIMIT) * 100 : null,
    lastCheck,
    checkIntervalMs: CHECK_INTERVAL,
    active: monitorTimer !== null,
  };
}

// Versi "sekarang juga" (tidak menunggu siklus 60 detik)
function getMemoryNow() {
  const mem = process.memoryUsage();
  const base = getMemoryStats();
  return {
    ...base,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external ?? 0,
    arrayBuffers: mem.arrayBuffers ?? 0,
    percent: RSS_LIMIT ? (mem.rss / RSS_LIMIT) * 100 : null,
  };
}

export { startMemoryMonitor, stopMemoryMonitor, getMemoryStats, getMemoryNow };