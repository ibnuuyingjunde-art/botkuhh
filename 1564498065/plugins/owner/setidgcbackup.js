import fs from "fs";
import path from "path";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "setidgcbackup",
  alias: ["setidgc", "setgcbackup"],
  category: "owner",
  description: "Set ID grup tujuan .backup (config.idgc) langsung dari WhatsApp",
  usage: ".setidgcbackup [id_grup] | .setidgcbackup info | .setidgcbackup del",
  example: ".setidgcbackup | .setidgcbackup 120363123456789012@g.us | .setidgcbackup info",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function normalizeGcJid(raw) {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (cleaned.includes("@")) return cleaned;
  const digits = cleaned.replace(/[^0-9-]/g, "");
  if (!digits) return "";
  return `${digits}@g.us`;
}

function writeIdgcToFile(newValue) {
  const configPath = path.join(process.cwd(), "config.js");
  const content = fs.readFileSync(configPath, "utf8");

  const idgcRegex = /idgc:\s*["'][^"']*["']/;
  if (!idgcRegex.test(content)) {
    throw new Error(
      "Field `idgc` tidak ditemukan di config.js. Tambahkan dulu manual: idgc: \"\","
    );
  }

  const updated = content.replace(idgcRegex, `idgc: "${newValue}"`);
  fs.writeFileSync(configPath, updated, "utf8");
}

async function handler(m, { config }) {
  const arg = (m.args?.[0] || "").trim();
  const sub = arg.toLowerCase();

  if (sub === "info" || sub === "check" || sub === "cek") {
    const current = config.idgc || "";
    return m.reply(
      `📡 *SET ID GC BACKUP*\n\n` +
      `┃ Status : ${current ? "✅ Aktif" : "❌ Belum di-set"}\n` +
      `┃ ID     : \`${current || "-"}\`\n\n` +
      `> Ketik \`${m.prefix}setidgcbackup\` di dalam grup buat jadiin grup itu tujuan backup.`
    );
  }

  if (sub === "del" || sub === "reset" || sub === "hapus") {
    try {
      writeIdgcToFile("");
      config.idgc = "";
      return m.reply(
        `✅ \`idgc\` berhasil dikosongkan.\n> \`${m.prefix}backup\` bakal fallback kirim ke chat biasa lagi.`
      );
    } catch (err) {
      console.error("[setidgcbackup]", err);
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  }

  let target = arg;
  if (!target) {
    if (!m.isGroup) {
      return m.reply(
        `📡 *SET ID GC BACKUP*\n\n` +
        `> Jalankan command ini di DALAM grup yang mau dijadiin tujuan backup, atau kasih ID grup manual.\n\n` +
        `*Format:*\n` +
        `\`${m.prefix}setidgcbackup\` (dipakai di dalam grup)\n` +
        `\`${m.prefix}setidgcbackup 120363123456789012@g.us\`\n\n` +
        `*Lainnya:*\n` +
        `\`${m.prefix}setidgcbackup info\`\n` +
        `\`${m.prefix}setidgcbackup del\``
      );
    }
    target = m.chat;
  }

  const gcJid = normalizeGcJid(target);
  if (!gcJid.endsWith("@g.us")) {
    return m.reply(
      `❌ ID yang dikasih bukan ID grup yang valid.\n> Contoh: \`120363123456789012@g.us\``
    );
  }

  try {
    writeIdgcToFile(gcJid);
    config.idgc = gcJid;

    m.reply(
      `✅ *idgc berhasil di-set!*\n\n` +
      `┃ ID grup : \`${gcJid}\`\n\n` +
      `> Sekarang \`${m.prefix}backup\` bakal langsung ngirim ke grup ini.`
    );
  } catch (err) {
    console.error("[setidgcbackup]", err);
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };