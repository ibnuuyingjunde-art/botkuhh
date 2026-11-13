import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { hotReloadPlugin, getPlugin, pluginStore } from "../../src/lib/ichigo-plugins.js";

const pluginConfig = {
  name: "reload",
  alias: ["rl"],
  category: "owner",
  description: "Reload plugin tertentu atau semua plugin tanpa restart bot",
  usage: ".reload <nama_file/command>\n.reload all",
  example: ".reload tiktok.js",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

const PLUGINS_DIR = path.join(process.cwd(), "plugins");
const SELF_FILE = path.resolve(fileURLToPath(import.meta.url));

function findPluginFile(target) {
  const targetBase = target.replace(/\.js$/i, "").toLowerCase();

  const existing = getPlugin(targetBase);
  if (existing?.filePath && fs.existsSync(existing.filePath)) {
    return existing.filePath;
  }

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const base = entry.name.replace(/\.js$/i, "").toLowerCase();
        if (base === targetBase || entry.name.toLowerCase() === target.toLowerCase()) {
          return fullPath;
        }
      }
    }
    return null;
  }

  return walk(PLUGINS_DIR);
}

function getAllPluginFiles(dir = PLUGINS_DIR) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getAllPluginFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

async function reloadAll(files, concurrency = 5) {
  const results = { success: [], failed: [] };
  let i = 0;

  async function worker() {
    while (i < files.length) {
      const filePath = files[i++];
      try {
        
        const result = await Promise.race([
          hotReloadPlugin(filePath),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        if (result?.success) {
          results.success.push({ filePath, name: result.name });
        } else {
          results.failed.push({ filePath, error: result?.error || "unknown error" });
        }
      } catch (err) {
        results.failed.push({ filePath, error: err.message });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
  );

  return results;
}

async function handler(m, { sock, db }) {

  const body = (m.body || m.text || "").trim();
  
  const target = body.replace(/^[^\s]+\s*/, "").trim();

  if (!target) {
    return m.reply(
      `📌 Contoh: *${m.prefix || "."}reload tiktok.js*\n` +
      `Atau *${m.prefix || "."}reload all* untuk reload semua plugin.\n` +
      `Bisa pakai nama file (.js) atau nama command.`
    );
  }

  if (["all", "semua", "*"].includes(target.toLowerCase())) {
    m.react("🔄");

    const files = getAllPluginFiles().filter((f) => path.resolve(f) !== SELF_FILE);

    if (files.length === 0) {
      m.react("❌");
      return m.reply("❌ Tidak ada file plugin ditemukan di folder plugins/");
    }

    const startedAt = Date.now();
    const { success, failed } = await reloadAll(files);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    let text =
      `🔄 *Reload All Plugin*\n\n` +
      `✅ Berhasil: ${success.length}\n` +
      `❌ Gagal: ${failed.length}\n` +
      `📦 Total file: ${files.length}\n` +
      `⏱️ Waktu: ${elapsed}s\n` +
      `ℹ️ ${path.basename(SELF_FILE)} dilewati (sedang berjalan)`;

    if (failed.length > 0) {
      const list = failed
        .slice(0, 15)
        .map((f) => `• ${path.relative(PLUGINS_DIR, f.filePath)} → ${f.error}`)
        .join("\n");
      text += `\n\n*Detail error:*\n${list}`;
      if (failed.length > 15) {
        text += `\n... dan ${failed.length - 15} lainnya`;
      }
    }

    m.react(failed.length === 0 ? "✅" : "⚠️");
    return m.reply(text);
  }

  m.react("🕕");

  const filePath = findPluginFile(target);
  if (!filePath) {
    m.react("❌");
    return m.reply(`❌ Plugin *${target}* tidak ditemukan di folder plugins/`);
  }

  const result = await hotReloadPlugin(filePath);

  if (result.success) {
    m.react("✅");
    const relPath = path.relative(PLUGINS_DIR, filePath);
    return m.reply(
      `✅ Plugin berhasil di-reload!\n` +
      `📄 File: ${relPath}\n` +
      `⚡ Command: *${m.prefix || "."}${result.name}*`
    );
  } else {
    m.react("❌");
    return m.reply(`❌ Gagal reload: ${result.error}`);
  }
}

export { pluginConfig as config, handler };