import fs from "fs";
import path from "path";
import { hotReloadPlugin } from "../../src/lib/ichigo-plugins.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "addplugin",
  alias: ["addpl", "tambahplugin"],
  category: "owner",
  description: "Tambah plugin baru dari code yang di-reply atau file .js",
  usage: ".addplugin [namafile] [folder]",
  example: ".addplugin bliblidl download",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function extractPluginInfo(code) {
  const info = { name: null, category: null };
  const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/i);
  if (nameMatch) info.name = nameMatch[1];
  const categoryMatch = code.match(/category:\s*['"`]([^'"`]+)['"]/i);
  if (categoryMatch) info.category = categoryMatch[1];
  return info;
}

async function handler(m, { sock }) {
  const quoted = m.quoted;

  if (!quoted) {
    return m.reply(
      `📦 *ADD PLUGIN*\n\n` +
        `Kirim file .js atau code plugin, lalu reply dengan:\n` +
        `${m.prefix}addplugin — Auto detect nama & folder\n` +
        `${m.prefix}addplugin namafile — Custom nama\n` +
        `${m.prefix}addplugin namafile folder — Custom nama + folder`,
    );
  }

  await m.react("🕕");

  let code = "";
  const args = m.args;

  const quotedDoc =
    quoted.message?.documentMessage ||
    quoted.message?.documentWithCaptionMessage?.message?.documentMessage ||
    null;
  const quotedFilename =
    quoted.filename || quoted.fileName || quotedDoc?.fileName || "";
  const quotedMime =
    quoted.mimetype || quoted.mimeType || quotedDoc?.mimetype || "";

  const isFile =
    !!quotedDoc ||
    quoted.isDocument === true ||
    quoted.type === "documentMessage" ||
    quoted.type === "document" ||
    /\.(m?js|cjs)$/i.test(quotedFilename) ||
    quotedMime.includes("javascript");

  if (isFile) {
    
    try {
      const buf = await quoted.download();
      code = buf.toString("utf-8");
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ *GAGAL*\n\nGagal download file: ${e.message}`);
    }
  } else {
    
    code =
      quoted.text ||
      quoted.body ||
      quoted.caption ||
      quoted.message?.conversation ||
      quoted.message?.extendedTextMessage?.text ||
      "";
    
    code = code.replace(/^```(?:js|javascript)?\n?/i, "").replace(/\n?```$/i, "").trim();
  }

  if (!code || code.length < 50) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nCode terlalu pendek atau tidak valid`);
  }

  const hasExport = code.includes("module.exports") || code.includes("export ");
  const hasConfig = code.includes("pluginConfig") || code.includes("config");
  if (!hasExport || !hasConfig) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nCode bukan format plugin yang valid\nHarus ada export dan config`);
  }

  const extracted = extractPluginInfo(code);

  let fileName = args[0] || null;
  let folderName = args[1] || null;

  if (!fileName && /\.(m?js|cjs)$/i.test(quotedFilename)) {
    fileName = quotedFilename.replace(/\.(m?js|cjs)$/i, "");
  }
  if (!fileName) fileName = extracted.name;
  if (!folderName) folderName = extracted.category;

  if (!fileName) {
    await m.react("❌");
    return m.reply(
      `❌ *GAGAL*\n\nTidak bisa mendeteksi nama plugin\nGunakan ${m.prefix}addplugin <namafile>`,
    );
  }

  if (!folderName) folderName = "other";

  fileName = fileName.toLowerCase().replace(/[^a-z0-9\-_]/g, "");
  folderName = folderName.toLowerCase().replace(/[^a-z0-9\-_]/g, "");

  if (!fileName) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL*\n\nNama file tidak valid`);
  }

  try {
    const pluginsDir = path.join(process.cwd(), "plugins");
    const folderPath = path.join(pluginsDir, folderName);
    const filePath = path.join(folderPath, `${fileName}.js`);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      await m.react("❌");
      return m.reply(
        `❌ *GAGAL*\n\n` +
          `File ${fileName}.js sudah ada di folder ${folderName}\n\n` +
          `Gunakan ${m.prefix}ganticode ${fileName} ${folderName} untuk mengganti`,
      );
    }

    fs.writeFileSync(filePath, code, "utf-8");

    let reloadResult = { success: false };
    try {
      reloadResult = (await hotReloadPlugin(filePath)) || { success: true };
    } catch {}

    await m.react("✅");
    return m.reply(
      `✅ *PLUGIN DITAMBAH*\n\n` +
        `╭─〔 *DETAIL* 〕───⬣\n` +
        `│ File   : ${fileName}.js\n` +
        `│ Folder : ${folderName}\n` +
        `│ Size   : ${code.length} bytes\n` +
        `│ Source : ${isFile ? "📄 File .js" : "💬 Text/Code"}\n` +
        `│ Reload : ${reloadResult.success ? "✅ Sukses" : "⚠️ Pending restart"}\n` +
        `╰───────⬣\n\n` +
        `Plugin sudah aktif dan siap digunakan!`,
    );
  } catch (error) {
    await m.react("☢");
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };