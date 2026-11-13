import fs from "fs";
import path from "path";
import { logger } from "./ichigo-logger.js";
import { openStore, importJsonOnce } from "./ichigo-sqlite-store.js";

const DEFAULT_LOG_PATH = path.join(process.cwd(), "database", "main", "plugin_events.json");
const DEFAULT_POLL_INTERVAL = 5000; 
const DEFAULT_MAX_EVENTS = 500;

const LOG_STORE = "plugin_events";

function logDb(logPath) {
  return openStore(path.join(path.dirname(logPath), "ichigo.db"));
}

function loadLog(logPath) {
  try {
    const st = logDb(logPath);
    importJsonOnce(st, LOG_STORE, logPath);
    const data = st.load(LOG_STORE, {});
    return {
      events: Array.isArray(data.events) ? data.events : [],
      snapshot: data.snapshot && typeof data.snapshot === "object" ? data.snapshot : {},
    };
  } catch {
    return { events: [], snapshot: {} };
  }
}

function saveLog(logPath, data) {
  try {
    logDb(logPath).save(LOG_STORE, { events: data.events, snapshot: data.snapshot });
  } catch {}
}

function scanPlugins(pluginsDir) {
  const map = {};
  if (!fs.existsSync(pluginsDir)) return map;

  let categories = [];
  try {
    categories = fs.readdirSync(pluginsDir).filter((f) => {
      try {
        return fs.statSync(path.join(pluginsDir, f)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return map;
  }

  for (const category of categories) {
    const categoryPath = path.join(pluginsDir, category);
    let files = [];
    try {
      files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      try {
        const stat = fs.statSync(filePath);
        map[`${category}/${file}`] = {
          category,
          file,
          name: file.replace(".js", ""),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      } catch { }
    }
  }

  return map;
}

let watcherHandle = null;

/**
 * Nyalain watcher realtime buat plugin directory.
 * Aman dipanggil berkali-kali, cuma jalan sekali per proses (interval gak numpuk).
 */
export function initPluginWatcher(options = {}) {
  if (watcherHandle) return;
  // Polling tiap 5 detik ke ratusan file plugin itu boros. Default MATI.
  // Nyalakan hanya kalau perlu: set env PLUGIN_WATCHER=on
  if (process.env.PLUGIN_WATCHER !== "on") return;

  const pluginsDir = options.pluginsDir || path.join(process.cwd(), "plugins");
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const interval = options.interval || DEFAULT_POLL_INTERVAL;
  const maxEvents = options.maxEvents || DEFAULT_MAX_EVENTS;

  let { events, snapshot } = loadLog(logPath);
  const isFirstRun = Object.keys(snapshot).length === 0 && events.length === 0;

  const currentScan = scanPlugins(pluginsDir);

  if (isFirstRun) {
    for (const key of Object.keys(currentScan)) {
      events.push({ event: "existing", ...currentScan[key], time: Date.now() });
    }
    snapshot = currentScan;
    saveLog(logPath, { events, snapshot });
    logger.debug("Watcher", `baseline direkam: ${Object.keys(currentScan).length} plugin`);
  }

  watcherHandle = setInterval(() => {
    try {
      const newScan = scanPlugins(pluginsDir);
      const oldKeys = Object.keys(snapshot);
      const newKeys = Object.keys(newScan);
      let changed = false;

      for (const key of newKeys) {
        if (!snapshot[key]) {
          events.push({ event: "added", ...newScan[key], time: Date.now() });
          changed = true;
        } else if (
          snapshot[key].mtimeMs !== newScan[key].mtimeMs ||
          snapshot[key].size !== newScan[key].size
        ) {
          events.push({ event: "modified", ...newScan[key], time: Date.now() });
          changed = true;
        }
      }

      for (const key of oldKeys) {
        if (!newScan[key]) {
          events.push({ event: "removed", ...snapshot[key], time: Date.now() });
          changed = true;
        }
      }

      if (changed) {
        snapshot = newScan;
        if (events.length > maxEvents) {
          events = events.slice(events.length - maxEvents);
        }
        saveLog(logPath, { events, snapshot });
      }
    } catch (e) {
      logger.error("Watcher", `error scan: ${e.message}`);
    }
  }, interval);
  if (watcherHandle?.unref) watcherHandle.unref();

  logger.system("Watcher", `aktif, cek perubahan plugin tiap ${interval / 1000} detik`);
}

/**
 * Ambil semua event yang udah kedeteksi watcher (dibaca langsung dari disk,
 * jadi selalu fresh walau dipanggil dari proses/reload yang beda).
 */
export function getPluginEvents(options = {}) {
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const { events } = loadLog(logPath);
  return events;
}
