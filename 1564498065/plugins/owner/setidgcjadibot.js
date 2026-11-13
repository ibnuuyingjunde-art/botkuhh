import fs from "fs";
import path from "path";
import { logger } from "../../src/lib/ichigo-logger.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "setidgcjadibot",
  alias: ["setidgcinfobot", "setgcjadibot", "setidgcinfo", "setgcinfojadibot"],
  category: "owner",
  description: "Set ID grup info/notif jadibot (config.jadibotNotif.groupId) langsung dari WhatsApp",
  usage: ".setidgcjadibot [id_grup] | .setidgcjadibot info | .setidgcjadibot del",
  example: ".setidgcjadibot | .setidgcjadibot 120363123456789012@g.us | .setidgcjadibot info",
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

function writeGroupIdToFile(newValue) {
  const configPath = path.join(process.cwd(), "config.js");
  const content = fs.readFileSync(configPath, "utf8");

  const regex = /(jadibotNotif:\s*\{[\s\S]*?groupId:\s*)(["'])[^"']*\2/;
  if (!regex.test(content)) {
    throw new Error(
      "Field `jadibotNotif.groupId` tidak ditemukan di config.js. Tambahkan dulu manual: jadibotNotif: { groupId: \"\" }",
    );
  }
  fs.writeFileSync(configPath, content.replace(regex, `$1$2${newValue}$2`), "utf8");
}

function setLive(config, value) {
  if (!config.jadibotNotif) config.jadibotNotif = {};
  config.jadibotNotif.groupId = value;
}

async function handler(m, { config }) {
  const arg = (m.args?.[0] || "").trim();
  const sub = arg.toLowerCase();

  if (["info", "check", "cek"].includes(sub)) {
    const current = config.jadibotNotif?.groupId || "";
    return m.reply(
      `📡 *SET ID GC INFO JADIBOT*\n\n` +
        `┃ Status : ${current ? "✅ Aktif" : "❌ Belum di-set"}\n` +
        `┃ ID     : \`${current || "-"}\`\n\n` +
        `> Ketik \`${m.prefix}setidgcjadibot\` di dalam grup buat jadiin grup itu tujuan notif jadibot.\n` +
        `> Tidak ikut \`idgc\` backup.`,
    );
  }

  if (["del", "reset", "hapus"].includes(sub)) {
    try {
      const old = config.jadibotNotif?.groupId || "-";
      writeGroupIdToFile("");
      setLive(config, "");
      logger.warn("SetIdgcJadibot", `groupId dikosongkan (sebelumnya ${old}) oleh ${m.sender}`);
      return m.reply(
        `✅ ID grup info jadibot dikosongkan.\n> Notif jadibot tidak dikirim sampai grup di-set lagi.`,
      );
    } catch (err) {
      console.error("[setidgcjadibot]", err);
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  }

  let target = arg;
  if (!target) {
    if (!m.isGroup) {
      return m.reply(
        `📡 *SET ID GC INFO JADIBOT*\n\n` +
          `> Jalankan di DALAM grup yang mau dijadiin tujuan notif jadibot, atau kasih ID grup manual.\n\n` +
          `*Format:*\n` +
          `\`${m.prefix}setidgcjadibot\` (di dalam grup)\n` +
          `\`${m.prefix}setidgcjadibot 120363123456789012@g.us\`\n\n` +
          `*Lainnya:*\n` +
          `\`${m.prefix}setidgcjadibot info\`\n` +
          `\`${m.prefix}setidgcjadibot del\``,
      );
    }
    target = m.chat;
  }

  const gcJid = normalizeGcJid(target);
  if (!gcJid.endsWith("@g.us")) {
    return m.reply(`❌ ID yang dikasih bukan ID grup yang valid.\n> Contoh: \`120363123456789012@g.us\``);
  }

  try {
    const old = config.jadibotNotif?.groupId || "-";
    writeGroupIdToFile(gcJid);
    setLive(config, gcJid);
    logger.success("SetIdgcJadibot", `groupId diubah: ${old} -> ${gcJid} oleh ${m.sender}`);
    m.reply(
      `✅ *ID grup info jadibot berhasil di-set!*\n\n` +
        `┃ ID grup : \`${gcJid}\`\n\n` +
        `> Notif jadibot (terhubung/putus/reconnect) sekarang masuk ke grup ini via sBPR.\n` +
        `> Pemilik jadibot & nomor jadibot harus member grup ini.`,
    );
  } catch (err) {
    console.error("[setidgcjadibot]", err);
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };