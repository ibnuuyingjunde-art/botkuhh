import fs from "fs";
import path from "path";
import zlib from "zlib";

// Pembaca ZIP tanpa dependency (hanya stored & deflate, tanpa zip64).

const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

// Path (relatif dari root bot) yang tidak boleh ditimpa oleh patch.
export const PROTECTED = [
  "node_modules",
  ".git",
  ".env",
  "sessions",
  "session",
  "storage",
  "database",
  "data",
  "db.json",
  "package-lock.json",
  "tmp",
  "temp",
  "backup",
  "patch",
];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function readZipEntries(zipBuf) {
  const minEocd = 22;
  let eocd = -1;
  const from = Math.max(0, zipBuf.length - minEocd - 65535);
  for (let i = zipBuf.length - minEocd; i >= from; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Bukan file ZIP yang valid");

  const total = zipBuf.readUInt16LE(eocd + 10);
  const cdOffset = zipBuf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff) throw new Error("ZIP64 tidak didukung");
  if (total > MAX_FILES) throw new Error(`Terlalu banyak file (maks ${MAX_FILES})`);

  const entries = [];
  let p = cdOffset;
  let totalSize = 0;

  for (let i = 0; i < total; i++) {
    if (zipBuf.readUInt32LE(p) !== 0x02014b50) throw new Error("Central directory rusak");
    const flags = zipBuf.readUInt16LE(p + 8);
    const method = zipBuf.readUInt16LE(p + 10);
    const crc = zipBuf.readUInt32LE(p + 16);
    const csize = zipBuf.readUInt32LE(p + 20);
    const usize = zipBuf.readUInt32LE(p + 24);
    const nameLen = zipBuf.readUInt16LE(p + 28);
    const extraLen = zipBuf.readUInt16LE(p + 30);
    const commentLen = zipBuf.readUInt16LE(p + 32);
    const localOffset = zipBuf.readUInt32LE(p + 42);
    const name = zipBuf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;

    if (flags & 1) throw new Error("ZIP terenkripsi tidak didukung");
    totalSize += usize;
    if (totalSize > MAX_TOTAL_BYTES) throw new Error("Ukuran ZIP terlalu besar setelah diekstrak");

    entries.push({ name, method, crc, csize, usize, localOffset });
  }
  return entries;
}

export function readEntryData(zipBuf, entry) {
  const lo = entry.localOffset;
  if (zipBuf.readUInt32LE(lo) !== 0x04034b50) throw new Error(`Header lokal rusak: ${entry.name}`);
  const nameLen = zipBuf.readUInt16LE(lo + 26);
  const extraLen = zipBuf.readUInt16LE(lo + 28);
  const start = lo + 30 + nameLen + extraLen;
  const raw = zipBuf.slice(start, start + entry.csize);

  let data;
  if (entry.method === 0) data = raw;
  else if (entry.method === 8) data = zlib.inflateRawSync(raw);
  else throw new Error(`Metode kompresi ${entry.method} tidak didukung: ${entry.name}`);

  if (data.length !== entry.usize) throw new Error(`Ukuran tidak cocok: ${entry.name}`);
  if (crc32(data) !== entry.crc) throw new Error(`CRC tidak cocok (file rusak): ${entry.name}`);
  return data;
}

export function normalizeEntryPath(name) {
  const clean = name.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!clean || clean.startsWith("/") || /^[a-zA-Z]:/.test(clean)) return null;
  const parts = clean.split("/");
  if (parts.some((s) => s === ".." || s === "")) return null;
  return parts.join("/");
}

export function isProtected(rel) {
  return PROTECTED.some((p) => rel === p || rel.startsWith(p + "/"));
}

/**
 * Terapkan patch zip ke baseDir.
 * @returns {{applied:string[], skipped:{path:string,reason:string}[], backupDir:string|null}}
 */
export function applyZipPatch(zipBuf, baseDir, { backupDir, dryRun = false } = {}) {
  const entries = readZipEntries(zipBuf);
  const applied = [];
  const skipped = [];
  const root = path.resolve(baseDir);
  let usedBackup = false;

  // __MACOSX, .DS_Store dll diabaikan diam-diam
  const files = entries.filter(
    (e) => !e.name.endsWith("/") && !e.name.startsWith("__MACOSX/") && !e.name.endsWith(".DS_Store"),
  );

  // Validasi semua dulu & baca data (atomic: gagal di tengah = belum ada yang ditulis)
  const plan = [];
  for (const e of files) {
    const rel = normalizeEntryPath(e.name);
    if (!rel) {
      skipped.push({ path: e.name, reason: "path tidak aman" });
      continue;
    }
    if (isProtected(rel)) {
      skipped.push({ path: rel, reason: "folder/file dilindungi" });
      continue;
    }
    const dest = path.resolve(root, rel);
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      skipped.push({ path: rel, reason: "di luar folder bot" });
      continue;
    }
    plan.push({ rel, dest, data: readEntryData(zipBuf, e) });
  }

  if (dryRun) return { applied: plan.map((x) => x.rel), skipped, backupDir: null };

  for (const f of plan) {
    if (backupDir && fs.existsSync(f.dest) && fs.statSync(f.dest).isFile()) {
      const b = path.join(backupDir, f.rel);
      fs.mkdirSync(path.dirname(b), { recursive: true });
      fs.copyFileSync(f.dest, b);
      usedBackup = true;
    }
    fs.mkdirSync(path.dirname(f.dest), { recursive: true });
    fs.writeFileSync(f.dest, f.data);
    applied.push(f.rel);
  }

  return { applied, skipped, backupDir: usedBackup ? backupDir : null };
}
