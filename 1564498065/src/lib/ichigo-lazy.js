/**
 * Library native/berat yang baru di-require saat pertama kali dipakai,
 * bukan saat bot start. Dipakai seperti import biasa:
 *   import { sharp, ffmpeg, archiver } from "./ichigo-lazy.js";
 *   await sharp(buf).resize(...).toBuffer();
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { sharpTuning } from "./ichigo-sharp-tuning.js";

const require = createRequire(import.meta.url);

// ── Sharp mode ringan ───────────────────────────────────────────────────────
// Disimpan di database/sharpmode.json supaya tetap aktif setelah restart.
// Aktif   : sharp.cache(false) + sharp.concurrency(1)  (paling hemat RAM/CPU)
// Nonaktif: kembali ke tuning bawaan bot (ichigo-sharp-tuning.js:
//           cache 16 MB / 32 item, 1 thread; bisa diubah lewat env SHARP_*)
// Default (file belum ada) = aktif. Atur lewat perintah .sharpmode on/off.
const SHARP_MODE_FILE = path.join(process.cwd(), "database", "sharpmode.json");

export function getSharpMode() {
  try {
    const data = JSON.parse(fs.readFileSync(SHARP_MODE_FILE, "utf8"));
    return data.light !== false;
  } catch {
    return true;
  }
}

function applySharpMode(sharpModule, light = getSharpMode()) {
  try {
    if (light) {
      sharpModule.cache(false);
      sharpModule.concurrency(1);
    } else {
      sharpModule.cache({
        memory: sharpTuning.cacheMb,
        files: 0,
        items: sharpTuning.cacheItems,
      });
      sharpModule.concurrency(sharpTuning.threads);
    }
  } catch {}
}

let _sharpModule = null;

// Simpan pilihan ke file, lalu langsung terapkan kalau sharp sudah termuat.
export function setSharpMode(light) {
  fs.mkdirSync(path.dirname(SHARP_MODE_FILE), { recursive: true });
  fs.writeFileSync(
    SHARP_MODE_FILE,
    JSON.stringify({ light: !!light, updatedAt: Date.now() }, null, 2),
  );
  applySharpMode(_sharpModule || require("sharp"), !!light);
  return !!light;
}

function lazyRequire(load) {
  let mod;
  const get = () => (mod ??= load());
  return new Proxy(function () {}, {
    apply: (_t, thisArg, args) => Reflect.apply(get(), thisArg, args),
    construct: (_t, args) => Reflect.construct(get(), args),
    get: (_t, prop) => {
      const m = get();
      const v = m[prop];
      return typeof v === "function" ? v.bind(m) : v;
    },
    set: (_t, prop, value) => {
      get()[prop] = value;
      return true;
    },
    has: (_t, prop) => prop in get(),
  });
}

export const sharp = lazyRequire(() => {
  _sharpModule = require("sharp");
  applySharpMode(_sharpModule);
  return _sharpModule;
});

export const archiver = lazyRequire(() => require("archiver"));

// @napi-rs/canvas (Skia): baru dimuat saat createCanvas/loadImage pertama dipanggil
export const canvasLib = lazyRequire(() => require("@napi-rs/canvas"));

// fluent-ffmpeg: path binary ffmpeg di-set sekali saat pertama dipakai
export const ffmpeg = lazyRequire(() => {
  const f = require("fluent-ffmpeg");
  try {
    f.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);
  } catch {}
  return f;
});

// ssh2: hanya dipakai plugin panel (installtema*), jadi baru dimuat saat `new Client()` dipanggil
export const ssh2Client = lazyRequire(() => require("ssh2").Client);
