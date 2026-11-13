/** cheerio dimuat saat pertama kali dipakai (bukan saat plugin di-import). */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let _mod;
const lib = () => (_mod ??= require("cheerio"));

export const load = (...args) => lib().load(...args);
