import fs from "fs";
import path from "path";

const pluginConfig = {
  name: "delpluginerror",
  alias: ["delplugerror", "delerrorplugin", "clearpluginerror"],
  category: "owner",
  description: "Hapus semua plugin yang error berdasarkan hasil .checkplugins",
  usage: ".delpluginerror",
  example: ".delpluginerror",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    const reportPath = path.join(process.cwd(), "database", "plugin-check-report.json");

    if (!fs.existsSync(reportPath)) {
      return m.reply(`❌ Belum ada report.\n\nJalankan ${m.prefix}checkplugins dulu.`);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const errors = report.errors || [];

    if (errors.length === 0) {
      return m.reply(`✅ Tidak ada plugin yang error. Tidak ada yang dihapus.`);
    }

    const pluginsDir = path.join(process.cwd(), "plugins");
    const deleted = [];
    const failed = [];

    for (const entry of errors) {
      const relPath = entry.split(" -> ")[0].trim();
      const filePath = path.join(pluginsDir, relPath);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted.push(relPath);
        } else {
          failed.push(`${relPath} (file tidak ditemukan)`);
        }
      } catch (err) {
        failed.push(`${relPath} (${err.message})`);
      }
    }

    report.errors = [];
    report.deletedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    let text = `🗑️ *HAPUS PLUGIN ERROR*\n\n`;
    text += `✅ Berhasil dihapus : ${deleted.length}\n`;
    text += `❌ Gagal dihapus    : ${failed.length}\n`;

    if (deleted.length > 0) {
      text += `\n*🗑️ Dihapus (max 15):*\n`;
      text += deleted.slice(0, 15).map((d, i) => `${i + 1}. ${d}`).join("\n");
      if (deleted.length > 15) text += `\n...dan ${deleted.length - 15} lainnya`;
    }

    if (failed.length > 0) {
      text += `\n\n*❌ Gagal (max 10):*\n`;
      text += failed.slice(0, 10).map((d, i) => `${i + 1}. ${d}`).join("\n");
    }

    await sock.sendMessage(m.chat, { text });
  } catch (error) {
    await m.reply(`❌ Gagal hapus plugin error: ${error.message}`);
  }
}

export { pluginConfig as config, handler };