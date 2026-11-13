import fs from "fs";
import path from "path";
import { applyZipPatch } from "../../src/lib/ichigo-zip-patch.js";
import { hotReloadPlugin } from "../../src/lib/ichigo-plugins.js";

const pluginConfig = {
  name: "applypatch",
  alias: ["patch", "terapkanpatch", "updatezip"],
  category: "owner",
  description: "Terapkan patch ZIP ke file bot (dari folder ./patch atau reply file zip)",
  usage: ".applypatch [namafile.zip | list | cek]",
  example: ".applypatch",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const PATCH_DIR = () => path.join(process.cwd(), "patch");
const APPLIED_DIR = () => path.join(PATCH_DIR(), "applied");

function listZips() {
  const dir = PATCH_DIR();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".zip"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime)
    .map((x) => x.name);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function handler(m, { sock }) {
  const dir = PATCH_DIR();
  fs.mkdirSync(dir, { recursive: true });

  const arg = (m.args?.[0] || "").trim();

  if (arg.toLowerCase() === "list") {
    const zips = listZips();
    return m.reply(
      zips.length
        ? `📦 *PATCH TERSEDIA*\n\n${zips.map((z, i) => `${i + 1}. ${z}`).join("\n")}\n\nJalankan ${m.prefix}applypatch untuk menerapkan semuanya berurutan.`
        : `📦 Tidak ada file .zip di folder *patch/*\n\nUpload zip ke folder itu, atau reply file zip dengan ${m.prefix}applypatch`,
    );
  }

  const dryRun = arg.toLowerCase() === "cek";
  let targets = [];

  // 1) Reply file zip -> simpan ke ./patch lalu terapkan
  const quoted = m.quoted;
  // serializer tidak mengisi quoted.fileName, jadi baca dari pesan dokumen aslinya
  const qMsg = quoted?.message || {};
  const qDoc =
    qMsg.documentMessage ||
    qMsg.documentWithCaptionMessage?.message?.documentMessage ||
    {};
  const qName = qDoc.fileName || quoted?.fileName || quoted?.filename || "";
  const qMime = qDoc.mimetype || quoted?.mimetype || "";
  const qIsDoc =
    !!quoted &&
    (quoted.isDocument ||
      quoted.type === "documentMessage" ||
      !!qMsg.documentMessage ||
      !!qMsg.documentWithCaptionMessage);

  if (qIsDoc) {
    try {
      const buf = await quoted.download();
      // cek isi file (magic bytes "PK"), bukan cuma nama/mimetype
      if (!buf || buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
        await m.react("❌");
        return m.reply(
          `❌ *GAGAL*\n\nFile yang di-reply bukan ZIP yang valid\n> Nama: ${qName || "-"}\n> Mimetype: ${qMime || "-"}`,
        );
      }
      const base = path.basename(qName || `patch_${stamp()}.zip`).replace(/[^\w.\-]/g, "_");
      const safe = /\.zip$/i.test(base) ? base : `${base}.zip`;
      fs.writeFileSync(path.join(dir, safe), buf);
      targets = [safe];
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ *GAGAL*\n\nGagal download zip: ${e.message}`);
    }
  } else if (arg && !dryRun) {
    // 2) Nama file tertentu di ./patch
    const safe = path.basename(arg);
    if (!fs.existsSync(path.join(dir, safe))) {
      return m.reply(`❌ File *${safe}* tidak ada di folder patch/\n\nCek dengan ${m.prefix}applypatch list`);
    }
    targets = [safe];
  } else {
    // 3) Semua zip di ./patch (urut dari yang terlama)
    targets = listZips();
  }

  if (!targets.length) {
    if (quoted) {
      return m.reply(
        `❌ *GAGAL*\n\nPesan yang di-reply tidak terbaca sebagai file ZIP\n` +
          `> Tipe: ${quoted.type || "-"}\n> Dokumen: ${quoted.isDocument ? "ya" : "bukan"}\n` +
          `> Nama: ${qName || "-"}\n> Mimetype: ${qMime || "-"}\n\n` +
          `Kirim ulang zip-nya sebagai *dokumen*, atau taruh di folder patch/ lalu jalankan ${m.prefix}applypatch`,
      );
    }
    return m.reply(
      `📦 *APPLY PATCH*\n\n` +
        `Tidak ada patch untuk diterapkan.\n\n` +
        `• Upload file .zip ke folder *patch/* lalu jalankan ${m.prefix}applypatch\n` +
        `• Atau reply file .zip dengan ${m.prefix}applypatch\n` +
        `• ${m.prefix}applypatch cek — simulasi tanpa menulis file\n` +
        `• ${m.prefix}applypatch list — lihat daftar patch`,
    );
  }

  await m.react("🕕");

  const backupDir = path.join(process.cwd(), "backup", `patch_${stamp()}`);
  const allApplied = [];
  const allSkipped = [];
  const needRestart = [];
  const hotReloaded = [];
  const failed = [];

  for (const name of targets) {
    const zipPath = path.join(dir, name);
    try {
      const buf = fs.readFileSync(zipPath);
      const res = applyZipPatch(buf, process.cwd(), { backupDir, dryRun });
      allApplied.push(...res.applied);
      allSkipped.push(...res.skipped);

      if (!dryRun) {
        for (const rel of res.applied) {
          if (/^plugins\/.+\.js$/.test(rel)) {
            try {
              const r = await hotReloadPlugin(path.join(process.cwd(), rel));
              if (r && r.success === false) needRestart.push(rel);
              else hotReloaded.push(rel);
            } catch {
              needRestart.push(rel);
            }
          } else {
            needRestart.push(rel);
          }
        }
        fs.mkdirSync(APPLIED_DIR(), { recursive: true });
        fs.renameSync(zipPath, path.join(APPLIED_DIR(), `${stamp()}_${name}`));
      }
    } catch (e) {
      failed.push(`${name}: ${e.message}`);
    }
  }

  const list = (arr, max = 15) =>
    arr.slice(0, max).map((f) => `• ${f}`).join("\n") + (arr.length > max ? `\n• ...+${arr.length - max} lainnya` : "");

  let text = dryRun ? `🔍 *SIMULASI PATCH* (belum ada file diubah)\n\n` : `✅ *PATCH DITERAPKAN*\n\n`;
  text += `📄 Zip: ${targets.join(", ")}\n📁 File: ${allApplied.length}\n`;
  if (allApplied.length) text += `\n${list(allApplied)}\n`;
  if (allSkipped.length) {
    text += `\n⚠️ *Dilewati (${allSkipped.length})*\n${list(allSkipped.map((s) => `${s.path} — ${s.reason}`), 8)}\n`;
  }
  if (failed.length) text += `\n❌ *Gagal*\n${failed.map((f) => `• ${f}`).join("\n")}\n`;
  if (!dryRun && allApplied.length) {
    text += `\n💾 Backup file lama: backup/${path.basename(backupDir)}`;
    if (needRestart.length) text += `\n🔄 Perlu restart: ${m.prefix}restart (${needRestart.length} file non-plugin)`;
    else if (hotReloaded.length) text += `\n⚡ Plugin sudah di-reload otomatis`;
  }

  await m.react(failed.length ? "⚠️" : "✅");
  return m.reply(text.trim());
}

export { pluginConfig as config, handler };