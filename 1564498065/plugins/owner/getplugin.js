import fs from "fs";
import path from "path";
import config from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "getplugin",
  alias: ["gp", "getcode", "plugincode", "sourcecode"],
  category: "owner",
  description: "Dapatkan source code plugin (single atau multiple)",
  usage: ".getplugin <nama> | .getplugin file <nama> | .getplugin from <file> | .getplugin all <category>",
  example: ".getplugin menu | .getplugin file menu | .getplugin from index | .getplugin all utils",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const WA_SAFE_CHAR_LIMIT = 10 * 1024;

function searchPlugin(name, pluginsDir) {
  const categories = fs.readdirSync(pluginsDir).filter((f) => {
    const fullPath = path.join(pluginsDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
  });

  for (const category of categories) {
    const categoryPath = path.join(pluginsDir, category);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const baseName = file.replace(".js", "").toLowerCase();
      if (baseName === name.toLowerCase()) {
        return { path: path.join(categoryPath, file), category, file };
      }
    }
  }

  for (const category of categories) {
    const categoryPath = path.join(pluginsDir, category);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const aliasMatch = content.match(/alias:\s*\[([^\]]+)\]/);
        if (aliasMatch) {
          const aliases = aliasMatch[1].match(/['"`]([^'"`]+)['"`]/g);
          if (aliases) {
            const cleanAliases = aliases.map((a) => a.replace(/['"`]/g, "").toLowerCase());
            if (cleanAliases.includes(name.toLowerCase())) {
              return { path: filePath, category, file };
            }
          }
        }
      } catch {}
    }
  }

  return null;
}

function getSimilarPlugins(name, pluginsDir) {
  const results = [];
  const categories = fs.readdirSync(pluginsDir).filter((f) => {
    const fullPath = path.join(pluginsDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
  });

  for (const category of categories) {
    const categoryPath = path.join(pluginsDir, category);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const baseName = file.replace(".js", "").toLowerCase();
      if (baseName.includes(name.toLowerCase()) || name.toLowerCase().includes(baseName)) {
        results.push(`${category}/${file}`);
      }
    }
  }

  return results.slice(0, 5);
}

function extractPluginsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const plugins = [];

    const importMatches = content.matchAll(/import\s+(?:{[^}]+}|.*?)\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) plugins.push(match[1]);

    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) plugins.push(match[1]);

    const pathMatches = content.matchAll(/['"]\.\/([^'"]+\.js)['"]/g);
    for (const match of pathMatches) plugins.push(match[1]);

    return [...new Set(plugins)];
  } catch {
    return null;
  }
}

function getPluginsByCategory(category, pluginsDir) {
  const categoryPath = path.join(pluginsDir, category);
  if (!fs.existsSync(categoryPath)) return null;

  const files = fs
    .readdirSync(categoryPath)
    .filter((f) => f.endsWith(".js") && f !== "index.js")
    .map((f) => ({
      file: f,
      category,
      path: path.join(categoryPath, f),
    }));

  return files.length > 0 ? files : null;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

async function sendPluginAsFile(sock, m, pluginInfo, fileSize, isAutoFallback = false) {
  const codeBuffer = fs.readFileSync(pluginInfo.path);
  const codeString = codeBuffer.toString("utf-8");

  const caption = isAutoFallback
    ? `⚠️ *Kode terlalu panjang, dikirim sebagai file*\n\n` +
      `🦪 *ɢᴇᴛ ᴘʟᴜɢɪɴ (ᴀᴜᴛᴏ ғɪʟᴇ ᴍᴏᴅᴇ)*\n\n` +
      `📄 *File:* ${pluginInfo.file}\n` +
      `📁 *Category:* ${pluginInfo.category}\n` +
      `📊 *Size:* ${fileSize}\n\n` +
      `✅ File berhasil dikirim, kamu bisa download dan pakai langsung!\n` +
      `🥠 Atau tinggal tap tombol dibawah buat copy code-nya`
    : `🦪 *ɢᴇᴛ ᴘʟᴜɢɪɴ (ғɪʟᴇ ᴍᴏᴅᴇ)*\n\n` +
      `📄 *File:* ${pluginInfo.file}\n` +
      `📁 *Category:* ${pluginInfo.category}\n` +
      `📊 *Size:* ${fileSize}\n\n` +
      `✅ File berhasil dikirim, kamu bisa download dan pakai langsung!\n` +
      `🥠 Atau tinggal tap tombol dibawah buat copy code-nya`;

  return await sock.sendMessage(
    m.chat,
    {
      document: codeBuffer,
      mimetype: "text/javascript",
      fileName: pluginInfo.file,
      caption,
      footer: "🍙 Bisa copy code dibawah",
      interactiveButtons: [
        {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "🥠 Copy Code nya",
            copy_code: codeString,
          }),
        },
      ],
    },
    { quoted: m }
  );
}

async function sendPluginAsCode(sock, m, pluginInfo, fileSize) {
  const codeString = fs.readFileSync(pluginInfo.path, "utf-8");

  if (codeString.length > WA_SAFE_CHAR_LIMIT) {
    return await sendPluginAsFile(sock, m, pluginInfo, fileSize, true);
  }

  await new AIRich(sock)
    .addText(
      `🍿 Hallo Ownerku ${m.pushName}, berikut source code plugin yang kamu minta\n\n` +
      `┌─ *📋 Plugin Info*\n` +
      `├ 📄 Nama: ${pluginInfo.file}\n` +
      `├ 📁 Kategori: ${pluginInfo.category}\n` +
      `└ 📊 Ukuran: ${fileSize}\n\n`
    )
    .addCode("javascript", codeString)
    .addText(
      `\n\nℹ️ *Tip:* Gunakan \`.getplugin file ${pluginInfo.file.replace(".js", "")}\` untuk download sebagai file`
    )
    .send(m.chat);
}

async function sendMultiplePlugins(sock, m, pluginInfos, isFileMode) {
  if (pluginInfos.length === 0) {
    return m.reply("❌ Tidak ada plugin yang ditemukan");
  }

  if (pluginInfos.length === 1) {
    const fileSize = formatBytes(fs.statSync(pluginInfos[0].path).size);
    if (isFileMode) {
      return await sendPluginAsFile(sock, m, pluginInfos[0], fileSize, false);
    } else {
      return await sendPluginAsCode(sock, m, pluginInfos[0], fileSize);
    }
  }

  let totalSize = 0;
  let infoText = `📦 *Multiple Plugins (${pluginInfos.length} files)*\n\n`;

  for (const plugin of pluginInfos) {
    const size = fs.statSync(plugin.path).size;
    totalSize += size;
    infoText += `✓ ${plugin.file} (${formatBytes(size)})\n`;
  }

  infoText += `\n📊 Total: ${formatBytes(totalSize)}`;
  await m.reply(infoText);

  for (const plugin of pluginInfos) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const codeBuffer = fs.readFileSync(plugin.path);
    await sock.sendMessage(
      m.chat,
      {
        document: codeBuffer,
        mimetype: "text/javascript",
        fileName: plugin.file,
        caption: `📄 ${plugin.category}/${plugin.file}`,
      },
      { quoted: m }
    );
  }
}

async function handler(m, { sock }) {
  if (!config.isOwner(m.sender)) {
    return m.reply("❌ *Owner Only!*");
  }

  const isFileMode = m.args?.[0]?.toLowerCase() === "file";
  const isFromMode = m.args?.[0]?.toLowerCase() === "from";
  const isAllMode = m.args?.[0]?.toLowerCase() === "all";

  let pluginName = null;
  let mode = "code";

  if (isFileMode) {
    mode = "file";
    pluginName = m.args?.[1]?.trim();
  } else if (isFromMode) {
    mode = "from";
    pluginName = m.args?.[1]?.trim();
  } else if (isAllMode) {
    mode = "all";
    pluginName = m.args?.[1]?.trim();
  } else {
    pluginName = m.args?.[0]?.trim();
  }

  if (!pluginName && mode === "code") {
    return m.reply(
      `📦 *ɢᴇᴛ ᴘʟᴜɢɪɴ*\n\n` +
      `> Dapatkan source code plugin dengan berbagai mode\n\n` +
      `╭┈┈⬡「 📋 *ᴍᴏᴅᴇ* 」\n` +
      `┃ .getplugin <nama> - Tampilkan kode\n` +
      `┃ .getplugin file <nama> - Download file\n` +
      `┃ .getplugin from <file> - Ambil dari index file\n` +
      `┃ .getplugin all <category> - Ambil semua kategori\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `*Contoh:*\n` +
      `> .getplugin menu\n` +
      `> .getplugin file sticker\n` +
      `> .getplugin from index\n` +
      `> .getplugin all utils`
    );
  }

  const pluginsDir = path.join(process.cwd(), "plugins");

  if (mode === "from") {
    const indexFilePath = path.join(
      pluginsDir,
      pluginName.endsWith(".js") ? pluginName : `${pluginName}.js`
    );

    if (!fs.existsSync(indexFilePath)) {
      return m.reply(`❌ File \`${pluginName}\` tidak ditemukan di plugins directory`);
    }

    const extractedPlugins = extractPluginsFromFile(indexFilePath);
    if (!extractedPlugins || extractedPlugins.length === 0) {
      return m.reply(`❌ Tidak ada plugin yang ditemukan di \`${pluginName}\``);
    }

    const resolvedPlugins = [];
    for (const pluginPath of extractedPlugins) {
      const fullPath = path.resolve(path.dirname(indexFilePath), pluginPath);
      if (fs.existsSync(fullPath)) {
        resolvedPlugins.push({
          path: fullPath,
          file: path.basename(fullPath),
          category: path.basename(path.dirname(fullPath)),
        });
      }
    }

    if (resolvedPlugins.length === 0) {
      return m.reply(`❌ Tidak ada plugin yang valid di \`${pluginName}\``);
    }

    return await sendMultiplePlugins(sock, m, resolvedPlugins, false);
  }

  if (mode === "all") {
    const categoryPlugins = getPluginsByCategory(pluginName, pluginsDir);
    if (!categoryPlugins) {
      return m.reply(`❌ Category \`${pluginName}\` tidak ditemukan atau kosong`);
    }
    return await sendMultiplePlugins(sock, m, categoryPlugins, false);
  }

  let pluginInfo = null;

  if (pluginName.includes("/")) {
    const [category, file] = pluginName.split("/");
    const filePath = path.join(
      pluginsDir,
      category,
      file.endsWith(".js") ? file : `${file}.js`
    );
    if (fs.existsSync(filePath)) {
      pluginInfo = {
        path: filePath,
        category,
        file: file.endsWith(".js") ? file : `${file}.js`,
      };
    }
  } else {
    pluginInfo = searchPlugin(pluginName, pluginsDir);
  }

  if (!pluginInfo) {
    const similar = getSimilarPlugins(pluginName, pluginsDir);
    let text = `❌ *ᴘʟᴜɢɪɴ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n`;
    text += `> Plugin \`${pluginName}\` tidak ditemukan\n\n`;
    if (similar.length > 0) {
      text += `*Mungkin maksud kamu:*\n`;
      similar.forEach((s) => { text += `> • \`${s}\`\n`; });
    }
    return m.reply(text);
  }

  const fileSize = formatBytes(fs.statSync(pluginInfo.path).size);

  if (mode === "file") {
    return await sendPluginAsFile(sock, m, pluginInfo, fileSize, false);
  } else {
    return await sendPluginAsCode(sock, m, pluginInfo, fileSize);
  }
}

export { pluginConfig as config, handler };