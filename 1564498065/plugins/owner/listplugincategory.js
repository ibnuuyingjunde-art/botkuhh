import fs from "fs";
import path from "path";
import { getCategories, getAllPlugins } from "../../src/lib/ichigo-plugins.js";

const pluginConfig = {
  name: "listplugincategory",
  alias: ["lpc", "plugincategory", "listcategory"],
  category: "owner",
  description: "List semua plugin berdasarkan kategori, termasuk yang error",
  usage: ".listplugincategory [kategori|refresh] [halaman]",
  example: ".listplugincategory owner",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const ICONS = {
  main: "🏠", tools: "🔧", downloader: "📥", download: "📥", sticker: "🎨",
  ai: "🤖", media: "📷", game: "🎮", rpg: "⚔️", maker: "🖼️", fun: "🎭",
  group: "👥", owner: "👑", premium: "💎", info: "📊", search: "🔍",
  canvas: "🎨", anime: "🌸", nsfw: "🔞", utility: "🛠️", economy: "💰",
  stalker: "🔎", random: "🎲", religi: "🕌", islamic: "☪️", cek: "✅",
  store: "🛒", panel: "🖥️", convert: "🔄", primbon: "🔮", tts: "🗣️",
  otp: "🔑", vps: "☁️", pushkontak: "📱", jpm: "🎰", ephoto: "📸",
  asupan: "🍽️", finance: "💵", image: "🖼️", berita: "📰", linode: "☁️",
  other: "📦",
};

const MAX_ROWS_PER_PAGE = 25;

let errorMapCache = null;
let errorMapMtime = 0;

function getErrorMap() {
  const reportPath = path.join(process.cwd(), "database", "plugin-check-report.json");

  if (!fs.existsSync(reportPath)) return {};

  try {
    const stat = fs.statSync(reportPath);
    if (errorMapCache && stat.mtimeMs === errorMapMtime) {
      return errorMapCache;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const errors = report.errors || [];
    const map = {};

    for (const entry of errors) {
      const sep = entry.indexOf(" -> ");
      if (sep === -1) continue;

      const relPath = entry.slice(0, sep).trim();
      const errMsg = entry.slice(sep + 4).trim();

      const [cat, file] = relPath.split("/");
      if (!cat || !file) continue;

      if (!map[cat]) map[cat] = [];
      map[cat].push({ file, error: errMsg });
    }

    errorMapCache = map;
    errorMapMtime = stat.mtimeMs;
    return map;
  } catch {
    return errorMapCache || {};
  }
}

let pluginsCache = null;
let pluginsCacheTime = 0;
const PLUGINS_CACHE_TTL = 30_000; 

function getCachedPlugins(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && pluginsCache && now - pluginsCacheTime < PLUGINS_CACHE_TTL) {
    return pluginsCache;
  }
  pluginsCache = getAllPlugins();
  pluginsCacheTime = now;
  return pluginsCache;
}

function groupPluginsByCategory(forceRefresh = false) {
  const all = getCachedPlugins(forceRefresh);
  const grouped = {};

  for (const p of all) {
    const cat = String(p.config?.category || "other").trim().toLowerCase();
    if (!grouped[cat]) grouped[cat] = new Set();
    grouped[cat].add(p);
  }

  const result = {};
  for (const [cat, set] of Object.entries(grouped)) {
    result[cat] = [...set];
  }
  return result;
}

async function handler(m, { sock }) {
  try {
    let target = (m.args[0] || "").toLowerCase();
    const forceRefresh = target === "refresh" || target === "reload";
    if (forceRefresh) target = "";

    const errorMap = getErrorMap();
    const grouped = groupPluginsByCategory(forceRefresh);

    if (!target) {
      
      await m.react("📂");

      const categories = new Set([
        ...getCategories(),
        ...Object.keys(grouped),
        ...Object.keys(errorMap),
      ]);

      const rows = [...categories]
        .map((cat) => {
          const plugins = grouped[cat] || [];
          const total = plugins.length;
          const enabled = plugins.filter((p) => p.config?.isEnabled !== false).length;
          const disabled = total - enabled;
          const errCount = errorMap[cat]?.length || 0;
          return { cat, total, enabled, disabled, errCount };
        })
        .filter((r) => r.total > 0 || r.errCount > 0)
        .sort((a, b) => (b.total + b.errCount) - (a.total + a.errCount));

      const grandTotal = rows.reduce((s, r) => s + r.total, 0);
      const grandError = rows.reduce((s, r) => s + r.errCount, 0);
      const grandEnabled = rows.reduce((s, r) => s + r.enabled, 0);

      const tableData = rows.map(({ cat, total, enabled, disabled, errCount }) => [
        `${ICONS[cat] || "📦"} ${cat.toUpperCase()}`,
        total.toString(),
        enabled.toString(),
        disabled > 0 ? `⛔ ${disabled}` : "—",
        errCount > 0 ? `❌ ${errCount}` : "—",
      ]);

      await sock.sendTable(
        m.chat,
        "Plugin Per Kategori",
        ["Kategori", "Total", "✅ On", "⛔ Off", "❌ Err"],
        tableData,
        m,
        {
          headerText: `Total: ${grandTotal} plugin | ${rows.length} kategori | Aktif: ${grandEnabled}${grandError > 0 ? ` | Error: ${grandError}` : ""}`,
          footer: `Ketik ${m.prefix}lpc <kategori> untuk detail`,
        }
      );

    } else {
      
      const page = Math.max(1, parseInt(m.args[1]) || 1);
      const plugins = grouped[target] || [];
      const errorFiles = errorMap[target] || [];

      if (plugins.length === 0 && errorFiles.length === 0) {
        return m.reply(`❌ Kategori *${target}* tidak ditemukan atau kosong.`);
      }

      await m.react("🔍");

      const unique = [...plugins].sort((a, b) =>
        String(a.config?.name).localeCompare(String(b.config?.name))
      );

      const enabledCount = unique.filter((p) => p.config?.isEnabled !== false).length;
      const disabledCount = unique.length - enabledCount;

      const allRows = [
        ...unique.map((p) => {
          const status = p.config?.isEnabled !== false ? "✅" : "⛔";
          const alias = p.config?.alias?.length ? p.config.alias.slice(0, 2).join(", ") : "—";
          const lock = p.config?.isOwner ? "🔒" : p.config?.isPremium ? "💎" : "—";
          return [`${status} ${p.config?.name || "?"}`, alias, lock];
        }),
        ...errorFiles.map((e) => [
          `❌ ${e.file}`,
          e.error.slice(0, 30) + (e.error.length > 30 ? "…" : ""),
          "—",
        ]),
      ];

      const totalPages = Math.max(1, Math.ceil(allRows.length / MAX_ROWS_PER_PAGE));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * MAX_ROWS_PER_PAGE;

      const tableData = allRows
        .slice(start, start + MAX_ROWS_PER_PAGE)
        .map((row, i) => [`${start + i + 1}. ${row[0]}`, row[1], row[2]]);

      await sock.sendTable(
        m.chat,
        `Plugin: ${target.toUpperCase()}`,
        ["Nama", "Alias", "Akses"],
        tableData,
        m,
        {
          headerText: `${unique.length} plugin OK | ✅ ${enabledCount} aktif | ⛔ ${disabledCount} off${errorFiles.length > 0 ? ` | ❌ ${errorFiles.length} error` : ""} | Hal ${safePage}/${totalPages}`,
          footer: totalPages > 1
            ? `${m.prefix}lpc ${target} <halaman> • ${ICONS[target] || "📦"}`
            : `Kategori ${target} • ${ICONS[target] || "📦"}`,
        }
      );
    }
  } catch (error) {
    await m.react("☢");
    await m.reply(`❌ Gagal list plugin: ${error.message}`);
  }
}

export { pluginConfig as config, handler };