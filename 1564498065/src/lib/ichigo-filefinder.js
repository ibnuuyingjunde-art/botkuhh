import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve(process.cwd());

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "backup",
  "session",
  "sessions",
  "auth",
  "tmp",
  "temp",
  ".cache",
  "database",
]);

/**
 * Pastikan hasil resolve path tetap di dalam root project (anti path traversal).
 * @param {string} relPath
 * @returns {string|null} absolute path, atau null kalau keluar dari root
 */
function resolveSafePath(relPath) {
  const cleaned = String(relPath || "").replace(/^[/\\]+/, "");
  const resolved = path.resolve(ROOT_DIR, cleaned);
  const normalizedRoot = path.normalize(ROOT_DIR + path.sep);
  if (resolved !== ROOT_DIR && !resolved.startsWith(normalizedRoot)) return null;
  return resolved;
}

function walk(dir, results) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full, results);
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
}

/**
 * Cari file di seluruh project berdasarkan nama file saja (case-insensitive).
 * @param {string} filename - nama file, misal "ichigo-builder.js"
 * @returns {string[]} daftar path relatif (dari root) yang cocok
 */
function searchFileByName(filename) {
  const target = String(filename || "").trim().toLowerCase();
  if (!target) return [];

  const all = [];
  walk(ROOT_DIR, all);

  return all
    .filter((f) => path.basename(f).toLowerCase() === target)
    .map((f) => path.relative(ROOT_DIR, f).replace(/\\/g, "/"));
}

/**
 * Resolusi "pintar": kalau relPath persis ada, langsung dipakai.
 * Kalau tidak ada DAN relPath cuma nama file (tanpa "/"), cari otomatis
 * ke seluruh project. Mengembalikan status agar handler plugin bisa
 * menampilkan pesan yang sesuai (ditemukan / ambigu / tidak ada).
 *
 * @param {string} relPath
 * @returns {{status: 'invalid'|'found'|'ambiguous'|'notfound', path?: string, relPath?: string, matches?: string[]}}
 */
function smartResolve(relPath) {
  const input = String(relPath || "").trim();
  const direct = resolveSafePath(input);

  if (direct === null) return { status: "invalid" };

  if (fs.existsSync(direct)) {
    return {
      status: "found",
      path: direct,
      relPath: path.relative(ROOT_DIR, direct).replace(/\\/g, "/") || ".",
    };
  }

  if (input.includes("/") || input.includes("\\")) {
    return { status: "notfound" };
  }

  const matches = searchFileByName(input);

  if (matches.length === 0) return { status: "notfound" };

  if (matches.length === 1) {
    const resolved = resolveSafePath(matches[0]);
    return { status: "found", path: resolved, relPath: matches[0] };
  }

  return { status: "ambiguous", matches };
}

export { ROOT_DIR, resolveSafePath, searchFileByName, smartResolve };