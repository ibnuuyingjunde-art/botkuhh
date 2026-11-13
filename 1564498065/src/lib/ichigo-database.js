import moment from "moment-timezone";
import fs from "fs";
import path from "path";
import config from "../../config.js";
import { logger } from "./ichigo-logger.js";
import { openStore } from "./ichigo-sqlite-store.js";
const FLUSH_INTERVAL_MS = 5000;

const defaultUsers = {};
const defaultGroups = {};
const defaultSettings = { selfMode: false };
const defaultStats = {};
const defaultSewa = { enabled: false, groups: {} };

const FILE_MAP = {
  users: { file: "users.json", defaults: defaultUsers },
  groups: { file: "groups.json", defaults: defaultGroups },
  settings: { file: "settings.json", defaults: defaultSettings },
  stats: { file: "stats.json", defaults: defaultStats },
  sewa: { file: "sewa.json", defaults: defaultSewa },
  premium: { file: "premium.json", defaults: [] },
  owner: { file: "owner.json", defaults: [] },
  partner: { file: "partner.json", defaults: [] },
};
const SQLITE_FILE = "ichigo.db";

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.stores = {};
    this.dirty = {
      users: false,
      groups: false,
      settings: false,
      stats: false,
      sewa: false,
    };
    this.db = {
      data: {
        users: {},
        groups: {},
        settings: {},
        stats: {},
        sewa: { enabled: false, groups: {} },
      },
    };
    this.ready = false;
    this.flushTimer = null;
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  migrateFromOldPath() {
    const oldPath = path.join(process.cwd(), "src", "database");
    if (oldPath === this.dbPath) return;
    if (!fs.existsSync(oldPath)) return;

    const oldFiles = fs.readdirSync(oldPath).filter((f) => f.endsWith(".json"));
    if (oldFiles.length === 0) return;

    const newFiles = fs.existsSync(this.dbPath)
      ? fs.readdirSync(this.dbPath).filter((f) => f.endsWith(".json"))
      : [];
    if (newFiles.length > 0) return;

    logger.info(
      "database",
      `migrasi ${oldFiles.length} file dari src/database ke ${path.relative(process.cwd(), this.dbPath)}/`,
    );
    this.ensureDir();

    for (const file of oldFiles) {
      const src = path.join(oldPath, file);
      const dest = path.join(this.dbPath, file);
      try {
        fs.copyFileSync(src, dest);
      } catch (e) {
        logger.error("database", `gagal migrasi ${file}: ${e.message}`);
      }
    }
    logger.success("database", "migrasi path selesai");
  }

  async init() {
    try {
      this.migrateFromOldPath();
      await this.migrateFromSingleFile();

      this.sqlite = openStore(path.join(this.dbPath, SQLITE_FILE));
      this.importLegacyJson();

      for (const [key, { defaults }] of Object.entries(FILE_MAP)) {
        let data = this.sqlite.load(key, defaults);
        if (Array.isArray(defaults)) {
          if (!Array.isArray(data)) data = structuredClone(defaults);
        } else {
          data = { ...structuredClone(defaults), ...data };
        }
        this.stores[key] = { name: key, data };
        this.sqlite.save(key, data);
      }

      this.db.data = {
        users: this.stores.users.data,
        groups: this.stores.groups.data,
        settings: this.stores.settings.data,
        stats: this.stores.stats.data,
        sewa: this.stores.sewa.data,
        premium: this.stores.premium.data,
        owner: this.stores.owner.data,
        partner: this.stores.partner.data,
      };

      this.db.write = () => this.flushAll();
      this.db.read = () => this.readAll();

      this.startFlushTimer();
      this.registerShutdownHooks();

      const currentDefault = config.energi?.default ?? 25;
      const currentPremium = config.energi?.premium ?? 100;
      const lastDefault = this.db.data.settings._lastEnergiDefault;
      const lastPremium = this.db.data.settings._lastEnergiPremium;

      if (lastDefault !== currentDefault || lastPremium !== currentPremium) {
        const users = this.db.data.users;
        let synced = 0;
        for (const jid in users) {
          const u = users[jid];
          if (u.energi === -1) continue;
          if (u.isPremium) {
            u.energi = currentPremium;
          } else {
            u.energi = currentDefault;
          }
          synced++;
        }
        this.db.data.settings._lastEnergiDefault = currentDefault;
        this.db.data.settings._lastEnergiPremium = currentPremium;
        this.markDirty("users");
        this.markDirty("settings");
        if (synced > 0) {
          logger.info(
            "database",
            `energi sync ${synced} user di-update (default: ${currentDefault}, premium: ${currentPremium})`,
          );
        }
      }

      this.ready = true;
      logger.success(
        "database",
        "SQLite database siap (debounced write setiap 5s)",
      );
      return this;
    } catch (error) {
      logger.error("database", `gagal inisialisasi: ${error.message}`);
      this.db = {
        data: {
          users: {},
          groups: {},
          settings: { selfMode: false },
          stats: {},
          sewa: { enabled: false, groups: {} },
        },
        write: () => {},
        read: () => {},
      };
      this.ready = true;
      return this;
    }
  }

  startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flushDirty(), FLUSH_INTERVAL_MS);
    if (this.flushTimer.unref) this.flushTimer.unref();

    // checkpoint WAL tiap 1 jam supaya ichigo.db-wal tidak menumpuk
    if (this.checkpointTimer) clearInterval(this.checkpointTimer);
    this.checkpointTimer = setInterval(() => {
      try {
        this.sqlite?.checkpoint();
      } catch {}
    }, 60 * 60 * 1000);
    if (this.checkpointTimer.unref) this.checkpointTimer.unref();
  }

  registerShutdownHooks() {
    const flush = () => {
      try {
        this.flushAll();
      } catch {}
    };
    process.on("exit", flush);
    process.on("beforeExit", flush);
  }

  markDirty(key) {
    this.dirty[key] = true;
  }

  flushDirty() {
    for (const key of Object.keys(this.dirty)) {
      if (this.dirty[key] && this.stores[key]) {
        this._asyncWrite(key).catch(() => {});
      }
    }
  }

  async _asyncWrite(key) {
    if (!this.stores[key]) return;
    if (this._writing?.has(key)) {
      this._pendingWrite?.add(key);
      return;
    }
    if (!this._writing) this._writing = new Set();
    if (!this._pendingWrite) this._pendingWrite = new Set();
    if (!this._writeFailedKeys) this._writeFailedKeys = new Set();
    this._writing.add(key);
    try {
      this.ensureDir();
      this.sqlite.save(key, this.stores[key].data);
      this.dirty[key] = false;
      if (this._writeFailedKeys.has(key)) {
        this._writeFailedKeys.delete(key);
        logger.success("Database", `tulis "${key}" pulih normal lagi`);
      }
    } catch (e) {
      
      if (!this._writeFailedKeys.has(key)) {
        this._writeFailedKeys.add(key);
        logger.error("Database", `gagal tulis "${key}": ${e.message} (bakal terus dicoba ulang tiap ${FLUSH_INTERVAL_MS / 1000}s)`);
      }
    }
    this._writing.delete(key);
    if (this._pendingWrite.has(key)) {
      this._pendingWrite.delete(key);
      this._asyncWrite(key).catch(() => {});
    }
  }

  flushAll() {
    this.ensureDir();
    for (const key of Object.keys(this.stores)) {
      try {
        this.sqlite.save(key, this.stores[key].data);
        this.dirty[key] = false;
      } catch (e) {
        logger.error("Database", `flushAll gagal tulis "${key}": ${e.message}`);
      }
    }
  }

  readAll() {
    for (const [key, { defaults }] of Object.entries(FILE_MAP)) {
      try {
        const store = this.stores[key];
        if (!store) continue;
        store.data = this.sqlite.load(key, defaults);
        this.db.data[key] = store.data;
      } catch {}
    }
  }

  /**
   * Import sekali jalan dari file JSON lama ke SQLite.
   * Hanya dijalankan untuk store yang masih kosong di SQLite.
   * File JSON asli TIDAK dihapus, hanya di-rename jadi *.json.migrated.bak.
   */
  importLegacyJson() {
    let imported = 0;
    for (const [key, { file, defaults }] of Object.entries(FILE_MAP)) {
      if (this.sqlite.hasStore(key)) continue;
      const filePath = path.join(this.dbPath, file);
      if (!fs.existsSync(filePath)) continue;
      try {
        const raw = fs.readFileSync(filePath, "utf-8").trim();
        if (!raw) continue;
        let data = JSON.parse(raw);
        if (Array.isArray(defaults) !== Array.isArray(data)) data = structuredClone(defaults);
        this.sqlite.load(key, defaults);
        this.sqlite.save(key, data);
        fs.renameSync(filePath, `${filePath}.migrated.bak`);
        imported++;
        logger.info("database", `import ${file} -> SQLite (${Array.isArray(data) ? data.length + " item" : Object.keys(data).length + " key"})`);
      } catch (e) {
        logger.warn("database", `${file} gagal di-import ke SQLite: ${e.message} (file dibiarkan apa adanya)`);
      }
    }
    if (imported > 0) logger.success("database", `migrasi JSON -> SQLite selesai (${imported} store)`);
  }

  async migrateFromSingleFile() {
    const oldFile = path.join(this.dbPath, "energis.json");
    if (!fs.existsSync(oldFile)) return;

    try {
      const content = fs.readFileSync(oldFile, "utf-8").trim();
      if (!content) return;
      const data = JSON.parse(content);

      const files = {
        "users.json": data.users || {},
        "groups.json": data.groups || {},
        "settings.json": data.settings || { selfMode: false },
        "stats.json": data.stats || {},
        "sewa.json": data.sewa || { enabled: false, groups: {} },
      };

      for (const [file, fileData] of Object.entries(files)) {
        const target = path.join(this.dbPath, file);
        if (!fs.existsSync(target)) {
          fs.writeFileSync(target, JSON.stringify(fileData, null, 2), "utf-8");
        }
      }

      const backupPath = path.join(
        this.dbPath,
        `energis.json.migrated.${Date.now()}.bak`,
      );
      fs.renameSync(oldFile, backupPath);
      logger.success(
        "database",
        `migrasi dari energis.json selesai, backup: ${path.basename(backupPath)}`,
      );
    } catch (e) {
      logger.error("database", `gagal migrasi energis.json: ${e.message}`);
    }
  }

  async save() {
    try {

      const keys = Object.keys(this.stores);
      await Promise.all(keys.map((key) => this._asyncWrite(key)));
      return true;
    } catch (error) {
      logger.error("database", `gagal menyimpan: ${error.message}`);
      return false;
    }
  }

  getUser(jid) {
    if (!jid) return null;
    const cleanJid = jid.replace(/@.+/g, "");
    if (cleanJid.length > 15 || cleanJid.startsWith("120")) return null;
    const u = this.db.data.users[cleanJid] || null;
    if (u) this._refreshEnergi(u);
    return u;
  }

  // ── Energi realtime ──────────────────────────────────────────
  // Batas reset terakhir (mis. 00:00 Asia/Makassar). Di-cache 30 detik.
  _lastResetBoundary() {
    const now = Date.now();
    if (this._boundaryCache && now - this._boundaryCache.at < 30000) {
      return this._boundaryCache.value;
    }
    const tz = "Asia/Makassar";
    const h = config.scheduler?.resetHour ?? 0;
    const mnt = config.scheduler?.resetMinute ?? 0;
    const cur = moment.tz(tz);
    const boundary = moment.tz(tz).hour(h).minute(mnt).second(0).millisecond(0);
    if (boundary.isAfter(cur)) boundary.subtract(1, "day");
    this._boundaryCache = { at: now, value: boundary.valueOf() };
    return this._boundaryCache.value;
  }

  // Reset energi per-user saat diakses, jadi tetap akurat walau bot sempat mati
  // di jam reset (cron saja tidak mengejar reset yang terlewat).
  _refreshEnergi(user) {
    if (!user || user.energi === -1) return;
    if (user.energiResetAt === undefined) {
      user.energiResetAt = Date.now();
      return;
    }
    if (user.energiResetAt < this._lastResetBoundary()) {
      const def = config.energi?.default ?? 25;
      const prem = config.energi?.premium ?? -1;
      user.energi = user.isPremium ? prem : def;
      user.energiResetAt = Date.now();
      this.markDirty("users");
    }
  }

  setUser(jid, data = {}) {
    if (!jid) return null;
    const cleanJid = jid.replace(/@.+/g, "");
    if (cleanJid.length > 15 || cleanJid.startsWith("120")) return null;
    const existing = this.db.data.users[cleanJid] || {};

    const existingBalance =
      existing.balance !== undefined ? existing.balance : 0;
    if (existing.balance !== undefined) delete existing.balance;
    const existingLimit =
      existing.limit !== undefined
        ? existing.limit
        : config.energi?.default || 25;
    if (existing.limit !== undefined) delete existing.limit;

    this.db.data.users[cleanJid] = {
      ...existing,
      ...data,
      jid: cleanJid,
      name: data.name || existing.name || "Unknown",
      number: cleanJid,
      energi: data.energi ?? existing.energi ?? existingLimit,
      isPremium: data.isPremium ?? existing.isPremium ?? false,
      isBanned: data.isBanned ?? existing.isBanned ?? false,
      exp: data.exp ?? existing.exp ?? 0,
      level: data.level ?? existing.level ?? 1,
      koin: data.koin ?? existing.koin ?? existingBalance,
      saldo: data.saldo ?? existing.saldo ?? 0,
      unlockedFeatures:
        data.unlockedFeatures ?? existing.unlockedFeatures ?? [],
      registeredAt: data.registeredAt ?? existing.registeredAt ?? null,
      lastRegisteredAt:
        data.lastRegisteredAt ?? existing.lastRegisteredAt ?? null,
      registrationCount:
        data.registrationCount ?? existing.registrationCount ?? 0,
      hasClaimedRegisterReward:
        data.hasClaimedRegisterReward ??
        existing.hasClaimedRegisterReward ??
        false,
      unregisteredAt: data.unregisteredAt ?? existing.unregisteredAt ?? null,
      lastSeen: new Date().toISOString(),
      cooldowns: data.cooldowns ?? existing.cooldowns ?? {},
      clanId: data.clanId ?? existing.clanId ?? null,
      isRegistered: data.isRegistered ?? existing.isRegistered ?? false,
      regName: data.regName ?? existing.regName ?? null,
      regAge: data.regAge ?? existing.regAge ?? null,
      regGender: data.regGender ?? existing.regGender ?? null,
      rpg: { ...(existing.rpg || {}), ...(data.rpg || {}) },
      inventory: { ...(existing.inventory || {}), ...(data.inventory || {}) },
      access: data.access || existing.access || [],
    };

    this.markDirty("users");
    return this.db.data.users[cleanJid];
  }

  deleteUser(jid) {
    if (!jid) return false;
    const cleanJid = jid.replace(/@.+/g, "");
    if (this.db.data.users[cleanJid]) {
      delete this.db.data.users[cleanJid];
      this.markDirty("users");
      return true;
    }
    return false;
  }

  getAllUsers() {
    return this.db.data.users || {};
  }

  getUserCount() {
    return Object.keys(this.db.data.users || {}).length;
  }

  updateEnergi(jid, amount) {
    const user = this.getUser(jid) || this.setUser(jid);
    if (!user) return 0;
    if (user.energi === -1) return -1;

    try {
      const ownerEnergi = config.energi?.owner ?? -1;
      const premiumEnergi = config.energi?.premium ?? -1;
      const isOwnerUser = config.isOwner(jid);
      const isPremiumUser = config.isPremium(jid);
      if (isOwnerUser && ownerEnergi === -1) return -1;
      if (isPremiumUser && premiumEnergi === -1) return -1;
    } catch {}

    user.energi = Math.max(0, (user.energi ?? 0) + amount);
    this.setUser(jid, user);
    // tulis ke SQLite sekarang juga (ter-coalesce), bukan nunggu flush 5 detik
    this._asyncWrite("users").catch(() => {});
    return user.energi;
  }

  updateKoin(jid, amount) {
    const user = this.getUser(jid) || this.setUser(jid);
    if (!user) return 0;
    if (user.koin === -1) return -1;
    const MAX_KOIN = 9000000000000;
    user.koin = Math.max(0, Math.min(MAX_KOIN, (user.koin ?? 0) + amount));
    this.setUser(jid, user);
    return user.koin;
  }

  updateSaldo(jid, amount) {
    const user = this.getUser(jid) || this.setUser(jid);
    if (!user) return 0;
    user.saldo = Math.max(0, (user.saldo ?? 0) + amount);
    this.setUser(jid, user);
    return user.saldo;
  }

  updateExp(jid, amount) {
    const user = this.getUser(jid) || this.setUser(jid);
    if (!user) return 0;
    if (user.exp === -1) return -1;
    const MAX_EXP = 9000000000;
    user.exp = Math.max(0, Math.min(MAX_EXP, (user.exp ?? 0) + amount));
    this.setUser(jid, user);
    return user.exp;
  }

  getTopUsers(field, limit = 10) {
    const users = Object.values(this.db.data.users || {});
    return users
      .filter((u) => (u[field] || 0) > 0)
      .sort((a, b) => (b[field] || 0) - (a[field] || 0))
      .slice(0, limit);
  }

  checkCooldown(jid, command, seconds) {
    let user = this.getUser(jid);
    if (!user) {
      this.setUser(jid);
      user = this.getUser(jid);
    }
    if (!user) return false;
    if (!user.cooldowns || typeof user.cooldowns !== "object") {
      user.cooldowns = {};
      this.setUser(jid, { cooldowns: {} });
    }
    const now = Date.now();
    const cooldownEnd = user.cooldowns[command] || 0;
    if (now < cooldownEnd) {
      return Math.ceil((cooldownEnd - now) / 1000);
    }
    return false;
  }

  setCooldown(jid, command, seconds) {
    let user = this.getUser(jid);
    if (!user) user = this.setUser(jid, { cooldowns: {} });
    if (!user) return;
    if (!user.cooldowns || typeof user.cooldowns !== "object")
      user.cooldowns = {};
    user.cooldowns[command] = Date.now() + seconds * 1000;
    this.setUser(jid, { cooldowns: user.cooldowns });
  }

  getGroup(jid) {
    if (!jid) return null;
    return this.db.data.groups[jid] || null;
  }

  setGroup(jid, data = {}) {
    if (!jid) return null;
    const existing = this.db.data.groups[jid] || {};

    let cfg;
    cfg = config;
    const welcomeDefault = cfg.welcome?.defaultEnabled ?? false;
    const goodbyeDefault = cfg.goodbye?.defaultEnabled ?? false;

    this.db.data.groups[jid] = {
      ...existing,
      ...data,
      jid,
      name: data.name || existing.name || "Unknown Group",
      welcome: data.welcome ?? existing.welcome ?? welcomeDefault,
      leave: data.leave ?? existing.leave ?? goodbyeDefault,
      goodbye: data.goodbye ?? existing.goodbye ?? goodbyeDefault,
      antilink: data.antilink ?? existing.antilink ?? false,
      antitoxic: data.antitoxic ?? existing.antitoxic ?? false,
      mute: data.mute ?? existing.mute ?? false,
      game: data.game ?? existing.game ?? true,
      rpg: data.rpg ?? existing.rpg ?? true,
      warnings: data.warnings ?? existing.warnings ?? [],
      welcomeMsg: data.welcomeMsg ?? existing.welcomeMsg,
      goodbyeMsg: data.goodbyeMsg ?? existing.goodbyeMsg,
      intro: data.intro ?? existing.intro,
      chat: existing.chat ?? {},
    };

    this.markDirty("groups");
    return this.db.data.groups[jid];
  }

  getAllGroups() {
    return this.db.data.groups || {};
  }

  setting(key, value = undefined) {
    if (value !== undefined) {
      this.db.data.settings[key] = value;
      this.markDirty("settings");
    }
    return this.db.data.settings[key];
  }

  getSettings() {
    return this.db.data.settings || {};
  }

  incrementStat(key, increment = 1) {
    if (!this.db.data.stats[key]) this.db.data.stats[key] = 0;
    this.db.data.stats[key] += increment;
    this.markDirty("stats");
    return this.db.data.stats[key];
  }

  getStats(key) {
    if (key) return this.db.data.stats[key] || 0;
    return this.db.data.stats || {};
  }

  resetAllEnergi(defaultEnergi = 25, premiumEnergi = -1) {
    let count = 0;
    for (const jid of Object.keys(this.db.data.users)) {
      const user = this.db.data.users[jid];
      user.energi = user.isPremium ? premiumEnergi : defaultEnergi;
      user.energiResetAt = Date.now();
      count++;
    }
    this.markDirty("users");
    return count;
  }

  resetToDefaults() {
    this.flushAll();

    const backupDir = path.join(this.dbPath, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFolder = path.join(backupDir, `pre-reset-${ts}`);
    fs.mkdirSync(backupFolder, { recursive: true });

    // backup lengkap: file .db (setelah checkpoint WAL) + dump JSON per store
    this.sqlite.checkpoint();
    try {
      fs.copyFileSync(
        path.join(this.dbPath, SQLITE_FILE),
        path.join(backupFolder, SQLITE_FILE),
      );
    } catch {}

    let resetCount = 0;
    for (const [key, { file, defaults }] of Object.entries(FILE_MAP)) {
      try {
        fs.writeFileSync(
          path.join(backupFolder, file),
          JSON.stringify(this.stores[key].data, null, 2),
          "utf-8",
        );
      } catch {}
      this.stores[key].data = structuredClone(defaults);
      this.sqlite.clear(key);
      this.sqlite.save(key, this.stores[key].data);
      resetCount++;
    }

    this.db.data = {
      users: this.stores.users.data,
      groups: this.stores.groups.data,
      settings: this.stores.settings.data,
      stats: this.stores.stats.data,
      sewa: this.stores.sewa.data,
      premium: this.stores.premium.data,
      owner: this.stores.owner.data,
      partner: this.stores.partner.data,
    };

    this.dirty = {
      users: false,
      groups: false,
      settings: false,
      stats: false,
      sewa: false,
    };

    return {
      resetCount,
      total: Object.keys(FILE_MAP).length,
      backupFolder: `backups/pre-reset-${ts}`,
    };
  }

  backup() {
    this.flushAll();
    const backupDir = path.join(this.dbPath, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const combined = {
      users: this.db.data.users,
      groups: this.db.data.groups,
      settings: this.db.data.settings,
      stats: this.db.data.stats,
      sewa: this.db.data.sewa,
      premium: this.db.data.premium,
      owner: this.db.data.owner,
    };
    const backupPath = path.join(backupDir, `backup-${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(combined, null, 2), "utf-8");
    return backupPath;
  }
  get engine() {
    return "SQLite";
  }
  get users() {
    return this.db.data.users;
  }
  get groups() {
    return this.db.data.groups;
  }
  get settings() {
    return this.db.data.settings;
  }
  get stats() {
    return this.db.data.stats;
  }
  get sewa() {
    return this.db.data.sewa;
  }
  get premium() {
    return this.db.data.premium;
  }
  get owner() {
    return this.db.data.owner;
  }
  get partner() {
    return this.db.data.partner;
  }

  get data() {
    return this.db.data;
  }

  set data(val) {
    this.db.data = val;
  }
}

let dbInstance = null;

async function initDatabase(dbPath) {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    await dbInstance.init();
  }
  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    throw new Error(
      "Database belum diinisialisasi. Panggil initDatabase terlebih dahulu.",
    );
  }
  return dbInstance;
}

export { Database, initDatabase, getDatabase };