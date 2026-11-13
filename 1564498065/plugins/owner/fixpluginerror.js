import fs from "fs";
import path from "path";
import { hotReloadPlugin } from "../../src/lib/ichigo-plugins.js";
import { ClaudeHaiku } from "../../src/scraper/claudehaiku.js";

const pluginConfig = {
  name: "fixpluginerror",
  alias: ["fixplugerror", "fixerrorplugin"],
  category: "owner",
  description: "Coba perbaiki plugin yang error pakai AI berdasarkan hasil .checkplugins",
  usage: ".fixpluginerror [jumlah]",
  example: ".fixpluginerror 5",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 0,
  isEnabled: true,
};

function extractCode(text) {
  const match = text.match(/```(?:javascript|js)?\n?([\s\S]*?)```/i);
  if (match) return match[1].trim();
  return text.trim();
}

async function handler(m, { sock }) {
  try {
    const reportPath = path.join(process.cwd(), "database", "plugin-check-report.json");

    if (!fs.existsSync(reportPath)) {
      return m.reply(`❌ Belum ada report.\n\nJalankan ${m.prefix}checkplugins dulu.`);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const errors = report.errors || [];

    if (errors.length === 0) {
      return m.reply(`✅ Tidak ada plugin yang error untuk diperbaiki.`);
    }

    const limit = parseInt(m.args[0]) || 5;
    const targets = errors.slice(0, limit);
    const pluginsDir = path.join(process.cwd(), "plugins");

    await m.react("⏳");
    await m.reply(`🔧 Mencoba perbaiki ${targets.length} plugin error, mohon tunggu...`);

    const fixed = [];
    const stillError = [];

    for (const entry of targets) {
      const sep = entry.indexOf(" -> ");
      const relPath = entry.slice(0, sep).trim();
      const errorMsg = entry.slice(sep + 4).trim();
      const filePath = path.join(pluginsDir, relPath);

      if (!fs.existsSync(filePath)) {
        stillError.push(`${relPath} (file tidak ada)`);
        continue;
      }

      const originalCode = fs.readFileSync(filePath, "utf-8");
      const backupPath = `${filePath}.bak`;

      try {
        const prompt = `Perbaiki kode plugin JavaScript (ESM, untuk bot WhatsApp Baileys) berikut ini.

Error saat di-load:
${errorMsg}

Kode:
${originalCode}

INSTRUKSI:
- Perbaiki error di atas tanpa mengubah fungsi/fitur utama plugin
- Pastikan tetap export "pluginConfig as config" dan "handler" (atau format export aslinya)
- Jangan tambah penjelasan atau komentar tambahan
- Kembalikan HANYA kode JavaScript lengkap hasil perbaikan, tanpa markdown code fence`;

        const result = await ClaudeHaiku(prompt);

        if (!result.status || !result.answer) {
          stillError.push(`${relPath} (AI gagal merespon)`);
          continue;
        }

        const fixedCode = extractCode(result.answer);

        if (!fixedCode || fixedCode.length < 50) {
          stillError.push(`${relPath} (hasil AI tidak valid)`);
          continue;
        }

        fs.writeFileSync(backupPath, originalCode, "utf-8");
        fs.writeFileSync(filePath, fixedCode, "utf-8");

        const reloadResult = await hotReloadPlugin(filePath);

        if (reloadResult && reloadResult.success) {
          fixed.push(relPath);
          
          report.errors = report.errors.filter((e) => !e.startsWith(relPath + " -> "));
        } else {
          
          fs.writeFileSync(filePath, originalCode, "utf-8");
          fs.unlinkSync(backupPath);
          stillError.push(`${relPath} (masih error setelah diperbaiki)`);
        }
      } catch (err) {
        stillError.push(`${relPath} (${err.message})`);
      }
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    let text = `🔧 *FIX PLUGIN ERROR*\n\n`;
    text += `✅ Berhasil diperbaiki : ${fixed.length}\n`;
    text += `❌ Masih error         : ${stillError.length}\n`;
    text += `📋 Sisa di report      : ${report.errors.length}\n`;

    if (fixed.length > 0) {
      text += `\n*✅ Diperbaiki:*\n`;
      text += fixed.map((f, i) => `${i + 1}. ${f}`).join("\n");
    }

    if (stillError.length > 0) {
      text += `\n\n*❌ Masih error:*\n`;
      text += stillError.map((f, i) => `${i + 1}. ${f}`).join("\n");
    }

    if (report.errors.length > 0) {
      text += `\n\nJalankan lagi ${m.prefix}fixpluginerror untuk lanjut perbaiki sisanya.`;
    }

    await m.react("✅");
    await sock.sendMessage(m.chat, { text });
  } catch (error) {
    await m.react("❌");
    await m.reply(`❌ Gagal fix plugin error: ${error.message}`);
  }
}

export { pluginConfig as config, handler };