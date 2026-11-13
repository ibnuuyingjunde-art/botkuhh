import fs from "fs";
import path from "path";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import { ROOT_DIR, smartResolve } from "../../src/lib/ichigo-filefinder.js";

const pluginConfig = {
  name: "getfile",
  alias: ["cat", "readfile", "viewfile"],
  category: "owner",
  description:
    "Ambil isi file apa pun dari root project bot. Cukup nama filenya aja, gak perlu tahu path lengkap. Bisa tampil sebagai blok kode atau dikirim sebagai dokumen.",
  usage: ".getfile <nama_file / path> [doc]",
  example:
    ".getfile ichigo-builder.js\n.getfile config.js doc\n.getfile plugins/group/statsgc.js",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const WA_SAFE_CHAR_LIMIT = 15 * 1024;

const langMap = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".json": "json",
  ".env": "ini",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".md": "markdown",
  ".html": "html",
  ".css": "css",
  ".txt": "plaintext",
  ".sh": "bash",
  ".sql": "sql",
  ".xml": "xml",
  ".log": "plaintext",
  ".csv": "csv",
};

const TEXT_EXTS = new Set(Object.keys(langMap));

async function handler(m, { sock }) {
  try {
    const text = m.body.trim();
    const firstSpace = text.indexOf(" ");
    const argsText = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
    const args = argsText.split(/\s+/).filter(Boolean);

    if (!args.length) {
      return m.reply(
        `🔍 *Petunjuk Penggunaan*\n\n` +
          `Masukkan nama file atau path yang ingin kamu lihat.\n\n` +
          `*Contoh:*\n` +
          `> ${m.prefix}getfile ichigo-builder.js\n` +
          `> ${m.prefix}getfile config.js doc\n` +
          `> ${m.prefix}getfile plugins/group/statsgc.js`
      );
    }

    let forceDoc = false;
    if (args[args.length - 1]?.toLowerCase() === "doc") {
      forceDoc = true;
      args.pop();
    }

    if (!args.length) {
      return m.reply("❌ Ups! Nama file / path tidak boleh kosong.");
    }

    const rawInput = args.join(" ").replace(/^[/\\]+/, "");
    const resolved = smartResolve(rawInput);

    if (resolved.status === "invalid") {
      return m.reply("🚫 Akses ditolak! Kamu tidak bisa mengakses path di luar direktori bot.");
    }

    if (resolved.status === "ambiguous") {
      const list = resolved.matches.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
      return m.reply(
        `🔎 Ada ${resolved.matches.length} file bernama *"${rawInput}"*, ketik path lengkapnya:\n\n${list}\n\n` +
          `Contoh: \`${m.prefix}getfile ${resolved.matches[0]}\``
      );
    }

    if (resolved.status === "notfound") {
      return m.reply(`❓ Direktori atau file tidak ditemukan:\n\`${rawInput}\``);
    }

    const targetPath = resolved.path;
    const relPath = resolved.relPath;
    const stat = fs.statSync(targetPath);

    if (stat.isDirectory()) {
      const items = fs.readdirSync(targetPath).sort((a, b) => {
        const aDir = fs.statSync(path.join(targetPath, a)).isDirectory();
        const bDir = fs.statSync(path.join(targetPath, b)).isDirectory();
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.localeCompare(b);
      });

      const list = items
        .map((it) => {
          const isDir = fs.statSync(path.join(targetPath, it)).isDirectory();
          return `${isDir ? "📁" : "📄"} ${it}`;
        })
        .join("\n");

      return m.reply(
        `🗂️ *Mengeksplorasi Folder:*\n` +
        `📍 Path: \`/${relPath || "."}\`\n\n` +
        `${list || "✧ _Folder ini kosong_ ✧"}`
      );
    }

    m.react("🕐");

    const ext = path.extname(targetPath).toLowerCase();
    const fileName = path.basename(targetPath);
    const sizeKb = (stat.size / 1024).toFixed(2);

    const sendAsDocument = async (isAutoFallback = false) => {
      const buffer = fs.readFileSync(targetPath);
      const isText = TEXT_EXTS.has(ext);
      let contentString = "";
      
      try {
          if (isText) contentString = buffer.toString("utf-8");
      } catch (e) {}

      let caption = isAutoFallback
        ? `⚠️ *Isi teks terlalu panjang, dialihkan ke format dokumen.*\n\n`
        : `📦 *Permintaan File Selesai*\n\n`;

      caption += `🏷️ *Nama:* ${fileName}\n` +
                 `🛤️ *Lokasi:* /${relPath}\n` +
                 `⚖️ *Ukuran:* ${sizeKb} KB\n\n` +
                 `✅ Dokumen siap diunduh!`;

      const sendOptions = {
        document: buffer,
        fileName,
        mimetype: "application/octet-stream",
        caption,
      };

      if (isText && contentString && stat.size < (100 * 1024)) {
         sendOptions.footer = "🍙 Bisa tap tombol di bawah untuk menyalin isinya";
         sendOptions.interactiveButtons = [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "🥠 Copy Isi File",
                copy_code: contentString,
              }),
            }
         ];
      }

      await sock.sendMessage(m.chat, sendOptions, { quoted: m });
    };

    if (forceDoc || stat.size > WA_SAFE_CHAR_LIMIT || !TEXT_EXTS.has(ext)) {
      await sendAsDocument(!forceDoc && stat.size > WA_SAFE_CHAR_LIMIT);
      return m.react("✅");
    }

    const content = fs.readFileSync(targetPath, "utf-8");
    const lang = langMap[ext] ?? "plaintext";

    if (content.length > WA_SAFE_CHAR_LIMIT) {
      await sendAsDocument(true);
    } else {
      await new AIRich(sock)
        .addText(
          `🍿 *Source File Ditemukan!*\n\n` +
          `┌─ 📁 *Informasi File*\n` +
          `├ 🏷️ Nama: ${fileName}\n` +
          `├ 📍 Path: /${relPath}\n` +
          `└ ⚖️ Ukuran: ${sizeKb} KB\n\n` +
          `*💻 Preview:*`
        )
        .addCode(lang, content)
        .addText(`\n\n💡 _Ketik \`${m.prefix}getfile ${relPath} doc\` untuk mengunduhnya sebagai file._`)
        .send(m.chat);
    }

    m.react("✅");
  } catch (err) {
    console.error("[getfile] Error:", err);
    m.react("❌");
    m.reply(`❌ Waduh, gagal mengambil file.\n\n*Pesan Error:*\n${err.message}`);
  }
}

export { pluginConfig as config, handler };