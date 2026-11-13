/**
 * @napi-rs/canvas dimuat saat pertama kali dipakai, bukan saat plugin di-import.
 * Dipakai sebagai pengganti: import { createCanvas, loadImage, GlobalFonts } from "../../src/lib/ichigo-canvas-lazy.js"
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let _mod;
const lib = () => (_mod ??= require("@napi-rs/canvas"));

export const createCanvas = (...args) => lib().createCanvas(...args);
export const loadImage = (...args) => lib().loadImage(...args);
export const GlobalFonts = new Proxy(
  {},
  {
    get: (_t, prop) => {
      const v = lib().GlobalFonts[prop];
      return typeof v === "function" ? v.bind(lib().GlobalFonts) : v;
    },
  },
);

// Pengganti `import * as _canvas from "@napi-rs/canvas"`: namespace dimuat saat pertama diakses
// (mis. `const { createCanvas, Path2D } = _canvas` di dalam handler).
export const canvasNs = new Proxy(
  {},
  {
    get: (_t, prop) => {
      const v = lib()[prop];
      return typeof v === "function" && !/^[A-Z]/.test(String(prop)) ? v.bind(lib()) : v;
    },
    has: (_t, prop) => prop in lib(),
  },
);
