import fs from "fs";
import path from "path";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "cleanjunk",
  alias: ["bersihsampah", "cleansampah", "cleantrash"],
  category: "owner",
  description: "Bersihkan file sampah (.bak, .corrupted, .tmp, .old) di seluruh project bot, termasuk folder session/storage",
  usage: ".cleanjunk [hapus]",
  example: ".cleanjunk hapus",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "assets",
]);

const SENSITIVE_DIRS = new Set([
  "session",
  "sessions",
  "auth",
  "storage",
]);

const JUNK_PATTERNS = [
  /\.bak$/i,
  /\.corrupted(\.\d+)?\.bak$/i,
  /\.corrupted(\.\d+)?$/i,
  /\.tmp$/i,
  /\.old$/i,
  /\.orig$/i,
  /^\.DS_Store$/i,
  /\.log\.\d+$/i,
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function scanDir(dir, results, root, inSensitive = false) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;

      const nowSensitive = inSensitive || SENSITIVE_DIRS.has(entry.name.toLowerCase());
      scanDir(fullPath, results, root, nowSensitive);
      continue;
    }

    if (JUNK_PATTERNS.some((p) => p.test(entry.name))) {
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch {}
      results.push({
        path: path.relative(root, fullPath),
        fullPath,
        size,
        sensitive: inSensitive,
      });
    }
  }
}

function formatRow(r) {
  return r.sensitive ? `⚠️ ${r.path}` : r.path;
}

async function handler(m, { sock }) {
  try {
    const root = process.cwd();
    const results = [];
    scanDir(root, results, root);

    if (results.length === 0) {
      await m.react("✅");
      return m.reply(`✅ Tidak ada file sampah ditemukan. Project sudah bersih!`);
    }

    const totalSize = results.reduce((s, r) => s + r.size, 0);
    const sensitiveCount = results.filter((r) => r.sensitive).length;
    const confirm = (m.args[0] || "").toLowerCase();
    const isConfirmed = confirm === "hapus" || confirm === "yes" || confirm === "confirm";

    if (!isConfirmed) {
      await m.react("🧹");

      const shown = results.slice(0, 30);
      const tableData = shown.map((r, i) => [
        (i + 1).toString(),
        formatRow(r),
        formatBytes(r.size),
      ]);

      const extra = results.length - shown.length;

      await sock.sendTable(
        m.chat,
        "Clean Junk - Preview",
        ["#", "File", "Ukuran"],
        tableData,
        m,
        {
          headerText: `Ditemukan ${results.length} file sampah | Total: ${formatBytes(totalSize)}${sensitiveCount > 0 ? `\n⚠️ ${sensitiveCount} di folder session/storage/auth` : ""}${extra > 0 ? `\n(${extra} file lainnya tidak ditampilkan)` : ""}`,
          footer: `Pilih aksi di bawah ini`,
        }
      );

      await sock.sendMessage(
        m.chat,
        {
          text: `⚠️ ${results.length} file sampah siap dihapus (${formatBytes(totalSize)}).${sensitiveCount > 0 ? `\n⚠️ Termasuk ${sensitiveCount} file di folder session/storage/auth.` : ""}\nLanjutkan?`,
          footer: "Clean Junk",
          interactiveButtons: [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🗑️ Hapus Semua",
                id: `${m.prefix}cleanjunk hapus`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔄 Scan Ulang",
                id: `${m.prefix}cleanjunk`,
              }),
            },
          ],
        },
        { quoted: m },
      );
      return;
    }

    let deleted = 0;
    let deletedSize = 0;
    let deletedSensitive = 0;
    const deletedList = [];
    const failed = [];

    for (const r of results) {
      try {
        fs.unlinkSync(r.fullPath);
        deleted++;
        deletedSize += r.size;
        if (r.sensitive) deletedSensitive++;
        deletedList.push(r);
      } catch (err) {
        failed.push(`${r.path} (${err.message})`);
      }
    }

    await m.react("✅");

    const shown = deletedList.slice(0, 30);
    const tableData = shown.map((r, i) => [
      (i + 1).toString(),
      formatRow(r),
      formatBytes(r.size),
    ]);
    const extra = deletedList.length - shown.length;

    await sock.sendTable(
      m.chat,
      "Clean Junk - Selesai",
      ["#", "File Terhapus", "Ukuran"],
      tableData,
      m,
      {
        headerText: `✅ Terhapus: ${deleted} file (${formatBytes(deletedSize)})${deletedSensitive > 0 ? ` | ⚠️ ${deletedSensitive} dari session/storage/auth` : ""}${failed.length > 0 ? ` | ❌ Gagal: ${failed.length}` : ""}${extra > 0 ? `\n(${extra} file lainnya tidak ditampilkan)` : ""}`,
        footer: failed.length > 0 ? `Gagal: ${failed.slice(0, 5).join(", ")}` : "Project sudah bersih!",
      }
    );

    await sock.sendMessage(
      m.chat,
      {
        text: `Selesai membersihkan ${deleted} file sampah.`,
        footer: "Clean Junk",
        interactiveButtons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔄 Cek Lagi",
              id: `${m.prefix}cleanjunk`,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📂 List Plugin",
              id: `${m.prefix}lpc`,
            }),
          },
        ],
      },
      { quoted: m },
    );
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };