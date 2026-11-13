import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_ROOT = path.join(__dirname, "..");

const pluginConfig = {
  name: "cekapi",
  alias: ["cekpluginerror", "apierror", "pluginerror", "cekapierror"],
  category: "owner",
  description: "Cek API yang dipakai tiap plugin, laporin mana yang error/down",
  usage: ".cekapi <nama plugin (opsional)>",
  example: ".cekapi\n.cekapi anime",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const URL_REGEX = /https?:\/\/[^\s'"`)+\]]+/g;

const IGNORE_HOSTS = [
  "wa.me",
  "whatsapp.net",
  "web.whatsapp.com",
  "github.com",
  "raw.githubusercontent.com",
  "schema.org",
  "w3.org",
];

function extractApiUrls(sourceCode) {
  const matches = sourceCode.match(URL_REGEX) || [];
  const unique = [...new Set(matches)];
  return unique.filter((url) => {
    try {
      const host = new URL(url).hostname;
      return !IGNORE_HOSTS.some((ignored) => host.includes(ignored));
    } catch {
      return false;
    }
  });
}

async function checkUrl(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    let res;
    try {
      res = await fetch(url, { method: "HEAD", signal: controller.signal });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: "GET", signal: controller.signal });
      }
    } catch {
      res = await fetch(url, { method: "GET", signal: controller.signal });
    }
    clearTimeout(timer);
    const ms = Date.now() - start;
    if (res.ok) return { url, ok: true, status: res.status, ms };
    return { url, ok: false, status: res.status, ms, reason: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    const reason = err.name === "AbortError" ? "Timeout" : err.message || "Unknown error";
    return { url, ok: false, status: null, ms, reason };
  }
}

function getPluginFiles(dir = PLUGIN_ROOT, category = null) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      
      const nextCategory = category === null ? entry.name : category;
      results = results.concat(getPluginFiles(fullPath, nextCategory));
    } else if (entry.isFile() && entry.name.endsWith(".js") && fullPath !== __filename) {
      results.push({
        filePath: fullPath,
        category: category || "root",
        name: entry.name.replace(/\.js$/, ""),
      });
    }
  }

  return results;
}

async function scanPlugin({ filePath, category, name }) {
  const source = fs.readFileSync(filePath, "utf-8");
  const urls = extractApiUrls(source);
  if (urls.length === 0) return null;

  const results = await Promise.all(urls.map((u) => checkUrl(u)));
  return {
    plugin: name,
    category,
    results,
  };
}

async function handler(m, { sock }) {
  if (!m.isOwner) {
    return m.reply("❌ *Owner Only!*");
  }

  const target = m.args?.[0]?.trim()?.toLowerCase();
  let files = getPluginFiles();

  if (target) {
    files = files.filter((f) => f.name.toLowerCase().includes(target));
    if (files.length === 0) {
      return m.reply(`⚠️ Plugin dengan nama mengandung *"${target}"* tidak ditemukan.`);
    }
  }

  await m.reply(`🔎 Ngecek API di *${files.length} plugin*, tunggu sebentar...`);

  const scans = (await Promise.all(files.map(scanPlugin))).filter(Boolean);

  if (scans.length === 0) {
    return m.reply("📦 Gak ada URL API yang kedetect di plugin manapun.");
  }

  let text = `📡 *ᴄᴇᴋ ᴀᴘɪ ᴘʟᴜɢɪɴ*\n\n`;
  let errorCount = 0;
  let okCount = 0;

  for (const { plugin, category, results } of scans) {
    const hasError = results.some((r) => !r.ok);
    const label = `${plugin} _(${category})_`;
    text += hasError
      ? `╭┈┈⬡「 ⚠️ *${label}* 」\n`
      : `╭┈┈⬡「 ✅ *${label}* 」\n`;

    for (const r of results) {
      if (r.ok) {
        okCount++;
        text += `┃ ✅ ${r.url}\n┃    _(${r.status}, ${r.ms}ms)_\n`;
      } else {
        errorCount++;
        text += `┃ ❌ ${r.url}\n┃    _(${r.reason}, ${r.ms}ms)_\n`;
      }
    }
    text += `╰┈┈┈┈┈┈┈┈⬡\n\n`;
  }

  text += `📊 Total: *${okCount} OK*, *${errorCount} error* dari ${scans.length} plugin.`;

  await m.reply(text.trim());
}

export { pluginConfig as config, handler };