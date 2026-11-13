import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const pluginConfig = {
  name: "checkplugins",
  alias: ["cekplugin", "checkplugin", "scanplugins"],
  category: "owner",
  description: "Cek semua plugin untuk error/bug saat di-load",
  usage: ".checkplugins",
  example: ".checkplugins",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    const pluginsDir = path.join(process.cwd(), "plugins");
    const categories = fs.readdirSync(pluginsDir);

    let total = 0;
    let ok = 0;
    const errors = [];
    const nameMap = new Map();
    const duplicates = [];

    for (const category of categories) {
      const categoryPath = path.join(pluginsDir, category);
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath);
      for (const file of files) {
        if (!file.endsWith(".js") || file.startsWith("_")) continue;
        const filePath = path.join(categoryPath, file);
        const relPath = `${category}/${file}`;
        total++;

        try {
          const fileUrl = pathToFileURL(filePath).href;
          let plugin = await import(fileUrl);

          if ((!plugin.config || !plugin.handler) && plugin.default) {
            plugin = plugin.default;
          }

          if (!plugin.config) {
            errors.push(`${relPath} -> missing config export`);
            continue;
          }
          if (typeof plugin.handler !== "function") {
            errors.push(`${relPath} -> missing/invalid handler export`);
            continue;
          }

          const names = [plugin.config.name, ...(plugin.config.alias || [])]
            .filter(Boolean)
            .map((n) => String(n).toLowerCase());

          for (const n of names) {
            if (nameMap.has(n) && nameMap.get(n) !== relPath) {
              duplicates.push(`"${n}" -> ${nameMap.get(n)} & ${relPath}`);
            } else {
              nameMap.set(n, relPath);
            }
          }

          ok++;
        } catch (err) {
          errors.push(`${relPath} -> ${err.message}`);
        }
      }
    }

    let text = "🔍 *CEK PLUGIN*\n\n";
    text += `📦 Total plugin discan : ${total}\n`;
    text += `✅ Berhasil load        : ${ok}\n`;
    text += `❌ Error/bug            : ${errors.length}\n`;
    text += `⚠️ Duplikat command     : ${duplicates.length}\n`;

    if (errors.length > 0) {
      text += "\n*❌ Plugin Error (max 15):*\n";
      text += errors.slice(0, 15).map((e, i) => `${i + 1}. ${e}`).join("\n");
      if (errors.length > 15) text += `\n...dan ${errors.length - 15} lainnya`;
    }

    if (duplicates.length > 0) {
      text += "\n\n*⚠️ Duplikat Command (max 10):*\n";
      text += duplicates.slice(0, 10).map((d, i) => `${i + 1}. ${d}`).join("\n");
      if (duplicates.length > 10) text += `\n...dan ${duplicates.length - 10} lainnya`;
    }

    const reportPath = path.join(process.cwd(), "database", "plugin-check-report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ total, ok, errors, duplicates, checkedAt: new Date().toISOString() }, null, 2));
    text += "\n\n📄 Report lengkap: database/plugin-check-report.json";

    await sock.sendMessage(m.chat, { text });
  } catch (error) {
    await m.reply(`❌ Gagal cek plugin: ${error.message}`);
  }
}

export { pluginConfig as config, handler };