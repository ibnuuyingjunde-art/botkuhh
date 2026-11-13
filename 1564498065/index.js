import "./src/lib/ichigo-sharp-tuning.js";
import path from "path";
import fs from "fs";
import config from "./config.js";
import { startConnection } from "./src/connection.js";
import {
  messageHandler,
  groupHandler,
  messageUpdateHandler,
  groupSettingsHandler,
  handleAntiRemoveFromUpsert,
} from "./src/handler.js";
import { loadPlugins, pluginStore } from "./src/lib/ichigo-plugins.js";
import { initDatabase, getDatabase } from "./src/lib/ichigo-database.js";
import {
  initScheduler,
  loadScheduledMessages,
  startGroupScheduleChecker,
  startSewaChecker,
} from "./src/lib/ichigo-scheduler.js";
import { handleAntiTagSW } from "./src/lib/ichigo-group-protection.js";
import { initSholatScheduler } from "./src/lib/ichigo-sholat-scheduler.js";
import { initNotifScheduler } from "./src/lib/ichigo-notif-scheduler.js";
import { initAutoJpmScheduler } from "./src/lib/ichigo-auto-jpm.js";
import { startMemoryMonitor } from "./src/lib/ichigo-memory-monitor.js";
import { startTempCleaner } from "./src/lib/ichigo-temp-cleaner.js";
import { startDailyPruner } from "./src/lib/ichigo-data-pruner.js";
import { preloadAssets } from "./src/lib/ichigo-asset-manager.js";
import { startOrderPoller } from "./src/lib/ichigo-order-poller.js";
import {
  logger,
  c,
  playBootSequence,
  spinText,
  logConnection,
  logErrorBox,
  divider,
} from "./src/lib/ichigo-logger.js";

await import("./src/lib/ichigo-agent.js")
  .then((m) => m.initializeAgent())
  .catch(() => { });

const LOG_NOISE = new Set([
  "Closing",
  "Opening",
  "prekey",
  "_chains",
  "registrationId",
  "chainKey",
  "ephemeralKeyPair",
  "rootKey",
  "indexInfo",
  "pendingPreKey",
  "currentRatchet",
  "baseKey",
  "privKey",
  "Session already",
  "SessionEntry",
]);

function _isNoise(args) {
  const first = typeof args[0] === "string" ? args[0] : "";
  for (const noise of LOG_NOISE) {
    if (first.includes(noise)) return true;
  }
  return false;
}

const _log = console.log;
const _info = console.info;
const _warn = console.warn;

console.log = (...args) => {
  if (_isNoise(args)) return;
  _log.apply(console, args);
};

console.info = (...args) => {
  if (_isNoise(args)) return;
  _info.apply(console, args);
};

console.warn = (...args) => {
  if (_isNoise(args)) return;
  _warn.apply(console, args);
};

const startTime = Date.now();

let pluginWatcher = null;
const reloadDebounce = new Map();
const fileStatCache = new Map();

function startDevWatcher(pluginsPath) {
  if (pluginWatcher) pluginWatcher.close();

  logger.system("dev", "Hot-Reload watcher active for plugins");

  pluginWatcher = fs.watch(
    pluginsPath,
    { recursive: true },
    (eventType, filename) => {
      if (!filename || !filename.endsWith(".js")) return;

      const existingTimeout = reloadDebounce.get(filename);
      if (existingTimeout) clearTimeout(existingTimeout);

      const timeout = setTimeout(async () => {
        reloadDebounce.delete(filename);
        const fullPath = path.join(pluginsPath, filename);

        if (!fs.existsSync(fullPath)) {
          fileStatCache.delete(fullPath);
          const pluginName = path.basename(filename, ".js");
          const { unloadPlugin } = await import("./src/lib/ichigo-plugins.js");
          const result = unloadPlugin(pluginName);
          if (result.success) logger.warn("plugin", `removed ${filename}`);
          return;
        }

        try {
          const stats = fs.statSync(fullPath);
          const cached = fileStatCache.get(fullPath);
          const changed =
            !cached ||
            cached.mtimeMs !== stats.mtimeMs ||
            cached.size !== stats.size;
          if (!changed) return;

          fileStatCache.set(fullPath, {
            mtimeMs: stats.mtimeMs,
            size: stats.size,
          });

          const { hotReloadPlugin } =
            await import("./src/lib/ichigo-plugins.js");
          const result = await hotReloadPlugin(fullPath);
          if (!result.success) {
            logger.error(
              "plugin",
              `reload failed: ${filename}: ${result.error}`,
            );
          }
        } catch (error) {
          logger.error(
            "plugin",
            `reload failed: ${filename}: ${error.message}`,
          );
        }
      }, 500);

      reloadDebounce.set(filename, timeout);
    },
  );

  logger.debug("dev", `Monitoring directory: ${pluginsPath}`);
}

let srcWatcher = null;

function startSrcWatcher(srcPath) {
  if (srcWatcher) srcWatcher.close();

  logger.system("dev", "Pantauan hot-reload buat src udah jalan bosku");

  srcWatcher = fs.watch(srcPath, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith(".js")) return;

    const existingTimeout = reloadDebounce.get("src_" + filename);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeout = setTimeout(() => {
      reloadDebounce.delete("src_" + filename);
      const fullPath = path.join(srcPath, filename);
      if (!fs.existsSync(fullPath)) {
        logger.warn("dev", `src file removed: ${filename}`);
        return;
      }
      logger.success("dev", `src changed: ${filename}`);
    }, 500);

    reloadDebounce.set("src_" + filename, timeout);
  });

  logger.debug("dev", `Monitoring directory: ${srcPath}`);
}

function setupAntiCrash() {
  process.on("uncaughtException", (error, origin) => {
    const ignoredErrors = [
      "write EOF",
      "ECONNRESET",
      "EPIPE",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
      "read ECONNRESET",
    ];
    const isIgnored = ignoredErrors.some(
      (msg) => error.message?.includes(msg) || error.code === msg,
    );
    if (isIgnored) return;

    logErrorBox("uncaught exception", error.message);
    console.error(c.gray(error.stack));
    logger.system("system", "Engine is still running");
  });

  process.on("unhandledRejection", (reason, promise) => {
    logErrorBox("unhandled rejection", String(reason));
    console.error(c.gray("Promise:"), promise);
    logger.system("system", "Engine is still running");
  });

  process.on("warning", (warning) => {
    logger.warn("system", `${warning.name}: ${warning.message}`);
  });

  async function gracefulShutdown(signalName) {
    console.log("");
    logger.system("system", `Received ${signalName}`);

    try {
      const { stopAllJadibots } = await import(
        "./src/lib/ichigo-jadibot-manager.js"
      );
      logger.info("JADIBOT", "Menutup semua sesi jadibot...");
      await Promise.race([
        stopAllJadibots(),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
      logger.success("JADIBOT", "Semua sesi jadibot ditutup");
    } catch (error) {
      logger.warn("JADIBOT", `Gagal menutup sesi jadibot: ${error.message}`);
    }

    logger.info("database", "Saving data to local storage...");
    try {
      const db = getDatabase();
      await db.save();
      logger.success("database", "All data successfully saved");
    } catch (error) {
      logger.warn("database", `save failed: ${error.message}`);
    }
    logger.info("system", "Engine stopped safely");
    process.exit(0);
  }

  process.on("SIGINT", () => gracefulShutdown("STOP signal (SIGINT)"));
  process.on("SIGTERM", () => gracefulShutdown("TERMINATE signal (SIGTERM)"));

  logger.success("system", "Sistem anti-crash nyala, aman terkendali 😎");
}

async function main() {
  await playBootSequence({
    name: config.bot?.name || "Ourin-AI",
    version: config.bot?.version || "1.0.0",
    developer: config.bot?.developer || "Developer",
    mode: config.mode || "public",
  });
  setupAntiCrash();

  const dbPath = path.join(
    process.cwd(),
    config.database?.path || "./database/main",
  );
  await initDatabase(dbPath);
  const db = getDatabase();

  await spinText("system", "Lagi muat aset lokal bentar...", { tone: "accent" });
  await preloadAssets(config.assets);

  const savedMode = db.setting("botMode");
  if (savedMode && (savedMode === "self" || savedMode === "public"))
    config.mode = savedMode;
  const savedPremium = db.setting("premiumUsers");
  if (Array.isArray(savedPremium)) config.premiumUsers = savedPremium;
  const savedBanned = db.setting("bannedUsers");
  if (Array.isArray(savedBanned)) config.bannedUsers = savedBanned;

  const pCount = Array.isArray(savedPremium) ? savedPremium.length : 0;
  const bCount = Array.isArray(savedBanned) ? savedBanned.length : 0;
  logger.success(
    "database",
    `Database sukses ke-load | Mode: ${config.mode} | Premium: ${pCount} | Banned: ${bCount}`,
  );

  const pluginsPath = path.join(process.cwd(), "plugins");
  const pluginCount = await loadPlugins(pluginsPath);
  logger.success("plugin", `Sukses muat ${pluginCount} plugin!`);

  if (config.dev?.enabled && config.dev?.watchPlugins)
    startDevWatcher(pluginsPath);
  if (config.dev?.enabled && config.dev?.watchSrc) {
    const srcPath = path.join(process.cwd(), "src");
    startSrcWatcher(srcPath);
  }

  initScheduler(config);

  const bootTime = Date.now() - startTime;
  logger.success("boot", `Bot nyala mantap dalam ${bootTime}ms 🚀`);
  divider();
  await spinText("network", "Opening WhatsApp connection tunnel...", {
    duration: 900,
    tone: "accent",
  });
  logConnection("connecting", "menghubungi WhatsApp");
  console.log("");

  await startConnection({
    onRawMessage: async (msg, sock) => {
      try {
        const db = getDatabase();
        await handleAntiTagSW(msg, sock, db);
      } catch (error) { }
    },

    onMessage: async (msg, sock) => {
      try {
        const handlerPromise = messageHandler(msg, sock);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Handler timeout")), 60000),
        );
        await Promise.race([handlerPromise, timeoutPromise]);
      } catch (error) {
        if (error.message !== "Handler timeout") {
          logger.error("HANDLER", error.message);
          if (config.dev?.debugLog) console.error(c.gray(error.stack));
        }
      }
    },

    onGroupUpdate: async (update, sock) => {
      try {
        await groupHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onMessageUpdate: async (updates, sock) => {
      try {
        await messageUpdateHandler(updates, sock);
      } catch (error) {
        logger.error("MSG", error.message);
      }
    },

    onGroupSettingsUpdate: async (update, sock) => {
      try {
        await groupSettingsHandler(update, sock);
      } catch (error) {
        logger.error("GROUP", error.message);
      }
    },

    onStubMessage: async (msg, sock) => {
      try {
        const db = getDatabase();
        await handleAntiRemoveFromUpsert(msg, sock, db);
      } catch (error) {
        logger.error("ANTIDELETE", error.message);
      }
    },

    onConnectionUpdate: async (update, sock) => {
      if (update.connection === "open") {
        logConnection("connected", sock.user?.name || "Bot");
        startGroupScheduleChecker(sock);
        startSewaChecker(sock);
        initScheduler(config, sock);
        initAutoJpmScheduler(sock);
        initSholatScheduler(sock);
        initNotifScheduler(sock);
        try {
          startOrderPoller(sock);
        } catch (e) {
          logger.error("OrderPoller", `Gagal start: ${e.message}`);
        }
        try {
          const { startOtpPoller: _startOtp } =
            await import("./src/lib/ichigo-otp-poller.js");
          _startOtp(sock);
        } catch { }

        try {
          const { startBroadcastPuller } =
            await import("./src/lib/ichigo-broadcast-puller.js");
          startBroadcastPuller(sock);
        } catch (e) {
          logger.error("Broadcast", `Gagal start penarik: ${e.message}`);
        }

        try {
          const { getAllJadibotSessions, restartJadibotSession, startJadibotAccessChecker } =
            await import("./src/lib/ichigo-jadibot-manager.js");
          const sessions = getAllJadibotSessions();
          if (sessions.length > 0) {
            logger.info("JADIBOT", `Restoring ${sessions.length} session(s)`);
            for (const session of sessions) {
              try {
                await restartJadibotSession(sock, session.id);
                await new Promise((r) => setTimeout(r, 3000));
              } catch (e) {
                logger.error(
                  "JADIBOT",
                  `Failed restore ${session.id}: ${e.message}`,
                );
              }
            }
          }
          startJadibotAccessChecker();
        } catch (e) {
          logger.error("JADIBOT", `Gagal memulihkan: ${e.message}`);
        }

        try {
          const { resumePendingPurchases } = await import(
            "./src/lib/ichigo-jadibot-purchase.js"
          );
          resumePendingPurchases(sock);
        } catch (e) {
          logger.error(
            "JADIBOT",
            `Gagal melanjutkan transaksi jadibot pending: ${e.message}`,
          );
        }

        const devLabel = config.dev?.enabled ? ` ${c.yellow("• dev")}` : "";
        startMemoryMonitor();
        startTempCleaner();
        startDailyPruner();
        logger.success("YEYYYY", `Semua sistem udah jalan mantap, langsug saja🚀`);
        logger.success("NOTE", `Kalau ada error. mohon dimaklumi, soalnnya bukan bot bagus :)`);
        divider();
      }
    },
  });
}

main().catch((error) => {
  logErrorBox("Fatal Error", error.message);
  console.error(c.gray(error.stack));
  process.exit(1);
});