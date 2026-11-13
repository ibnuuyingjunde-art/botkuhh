import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

/**
 * SQLiteStore: penyimpanan database berbasis better-sqlite3.
 *
 * - Data tetap dipegang sebagai object JS di memori (`store.data`), jadi semua
 *   plugin yang langsung mutasi `db.data.users[jid].koin += 1` tetap jalan.
 * - Persist ke SQLite per-baris: object top-level -> 1 baris per key,
 *   array -> 1 baris tunggal. Hanya baris yang berubah yang ditulis.
 *
 * Skema:  kv(store TEXT, key TEXT, value TEXT, PRIMARY KEY(store, key))
 * Tabel sengaja pakai rowid biasa: load di-ORDER BY rowid supaya urutan key
 * (urutan insert) sama persis dengan file JSON lama.
 */

const ARRAY_KEY = "__array__";

export class SQLiteStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.sql = new Database(filePath);
    this.sql.pragma("journal_mode = WAL");
    this.sql.pragma("synchronous = NORMAL");
    // Hemat RSS: jangan map file DB ke memori, dan batasi page cache (~2 MB).
    this.sql.pragma("mmap_size = 0");
    this.sql.pragma("cache_size = -2000");
    this.sql.pragma("journal_size_limit = 4194304");
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        store TEXT NOT NULL,
        key   TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (store, key)
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    this._selectAll = this.sql.prepare("SELECT key, value FROM kv WHERE store = ? ORDER BY rowid");
    this._upsert = this.sql.prepare(
      "INSERT INTO kv (store, key, value) VALUES (?, ?, ?) " +
        "ON CONFLICT(store, key) DO UPDATE SET value = excluded.value",
    );
    this._delete = this.sql.prepare("DELETE FROM kv WHERE store = ? AND key = ?");
    this._count = this.sql.prepare("SELECT COUNT(*) AS n FROM kv WHERE store = ?");
    this._clear = this.sql.prepare("DELETE FROM kv WHERE store = ?");

    // snapshot per store: Map<key, serializedValue> untuk deteksi perubahan
    this._snap = new Map();
  }

  hasStore(name) {
    return this._count.get(name).n > 0;
  }

  getMeta(key) {
    return this.sql.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value ?? null;
  }

  setMeta(key, value) {
    this.sql
      .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, String(value));
  }

  /** Muat store dari SQLite. Return object/array, atau `defaults` kalau kosong. */
  load(name, defaults) {
    const rows = this._selectAll.all(name);
    const snap = new Map();
    let data;

    if (rows.length === 0) {
      data = structuredClone(defaults);
    } else if (rows.length === 1 && rows[0].key === ARRAY_KEY) {
      data = JSON.parse(rows[0].value);
      snap.set(ARRAY_KEY, rows[0].value);
    } else {
      data = {};
      for (const r of rows) {
        data[r.key] = JSON.parse(r.value);
        snap.set(r.key, r.value);
      }
    }
    this._snap.set(name, snap);
    return data;
  }

  /** Tulis hanya baris yang berubah (insert/update/delete) dalam 1 transaksi. */
  save(name, data) {
    const snap = this._snap.get(name) || new Map();
    const next = new Map();

    if (Array.isArray(data)) {
      next.set(ARRAY_KEY, JSON.stringify(data));
    } else {
      for (const k of Object.keys(data)) {
        const v = data[k];
        if (v === undefined) continue;
        next.set(k, JSON.stringify(v));
      }
    }

    const upserts = [];
    for (const [k, v] of next) if (snap.get(k) !== v) upserts.push([k, v]);
    const deletes = [];
    for (const k of snap.keys()) if (!next.has(k)) deletes.push(k);

    if (upserts.length || deletes.length) {
      this.sql.transaction(() => {
        for (const [k, v] of upserts) this._upsert.run(name, k, v);
        for (const k of deletes) this._delete.run(name, k);
      })();
    }
    this._snap.set(name, next);
    return { upserts: upserts.length, deletes: deletes.length };
  }

  clear(name) {
    this._clear.run(name);
    this._snap.set(name, new Map());
  }

  checkpoint() {
    try {
      this.sql.pragma("wal_checkpoint(TRUNCATE)");
    } catch {}
  }

  close() {
    try {
      this.checkpoint();
      this.sql.close();
    } catch {}
  }
}

const _opened = new Map();

/** Buka (atau pakai ulang) store untuk satu file .db. Satu koneksi per file per proses. */
export function openStore(filePath) {
  const key = path.resolve(filePath);
  let st = _opened.get(key);
  if (!st) {
    st = new SQLiteStore(key);
    _opened.set(key, st);
  }
  return st;
}

/**
 * Import sekali jalan dari file JSON lama ke store SQLite (kalau store masih kosong).
 * File JSON lama di-rename jadi *.migrated.bak, tidak dihapus.
 * Return data hasil import, atau null kalau tidak ada yang diimpor.
 */
export function importJsonOnce(store, name, jsonPath) {
  try {
    if (store.hasStore(name) || !fs.existsSync(jsonPath)) return null;
    const raw = fs.readFileSync(jsonPath, "utf-8").trim();
    if (!raw) return null;
    const data = JSON.parse(raw);
    store.load(name, Array.isArray(data) ? [] : {});
    store.save(name, data);
    fs.renameSync(jsonPath, `${jsonPath}.migrated.bak`);
    return data;
  } catch {
    return null;
  }
}
