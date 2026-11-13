import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import {
  removeJadibotOwner,
  getJadibotOwners,
} from "../../src/lib/ichigo-jadibot-database.js";
import fs from "fs";
import path from "path";
import { getGroupMode } from "../group/botmode.js";

const pluginConfig = {
  name: "delallowner",
  alias: ["hapusallowner", "delownerall", "clearowner", "resetowner"],
  category: "owner",
  description: "Hapus semua owner yang ditambahkan lewat .addowner",
  usage: ".delallowner ya",
  example: ".delallowner ya",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

// Sama seperti savePanelConfig di addowner.js: tulis ulang ownerPanels ke config.js
function saveOwnerPanels() {
  try {
    const configPath = path.join(process.cwd(), "config.js");
    let content = fs.readFileSync(configPath, "utf8");
    const str = JSON.stringify(config.pterodactyl.ownerPanels || []);
    content = content.replace(/ownerPanels:\s*\[.*?\]/s, `ownerPanels: ${str}`);
    fs.writeFileSync(configPath, content, "utf8");
    return true;
  } catch (e) {
    console.error("[DelAllOwner] Gagal simpan config panel:", e.message);
    return false;
  }
}

const digits = (v) => String(v || "").replace(/[^0-9]/g, "");
const toJid = (v) => (digits(v) ? `${digits(v)}@s.whatsapp.net` : null);

async function handler(m, { jadibotId, isJadibot }) {
  const db = getDatabase();
  if (!db) return m.reply("❌ Database belum siap, coba lagi.");

  const confirmed = ["ya", "yes", "confirm", "y"].includes(
    (m.args[0] || "").toLowerCase(),
  );

  const groupMode = m.isGroup ? getGroupMode(m.chat, db) : "private";
  const isCpanelMode = m.isGroup && groupMode === "cpanel";

  // ── Tentukan daftar yang akan dihapus sesuai mode ──
  let targets = [];
  let label = "full owner";

  if (isJadibot && jadibotId) {
    targets = [...getJadibotOwners(jadibotId)];
    label = "owner jadibot";
  } else if (isCpanelMode) {
    if (!config.pterodactyl) config.pterodactyl = {};
    targets = [...(config.pterodactyl.ownerPanels || [])];
    label = "owner panel";
  } else {
    if (!db.data.owner) db.data.owner = [];
    targets = [...db.data.owner];
  }

  if (targets.length === 0) {
    return m.reply(`❌ Tidak ada ${label} hasil addowner yang bisa dihapus.`);
  }

  const mentions = targets.map(toJid).filter(Boolean);
  const list = targets.map((n, i) => `${i + 1}. @${digits(n)}`).join("\n");

  if (!confirmed) {
    return m.reply(
      `⚠️ *HAPUS SEMUA ${label.toUpperCase()}*\n\n${list}\n\n` +
        `Total: *${targets.length}*\n` +
        (isJadibot || isCpanelMode
          ? ""
          : `> Owner utama dari config.js tidak ikut terhapus.\n`) +
        `\nKetik \`${m.prefix}${m.command} ya\` untuk lanjut.`,
      { mentions },
    );
  }

  // ── Eksekusi ──
  if (isJadibot && jadibotId) {
    targets.forEach((n) => removeJadibotOwner(jadibotId, n));
  } else if (isCpanelMode) {
    config.pterodactyl.ownerPanels = [];
    if (!saveOwnerPanels()) {
      config.pterodactyl.ownerPanels = targets;
      return m.reply("❌ Gagal menyimpan ke config.js, tidak ada yang dihapus.");
    }
  } else {
    db.data.owner = [];
    const nameMap = db.setting("ownerNames") || {};
    targets.forEach((n) => delete nameMap[n]);
    db.setting("ownerNames", nameMap);
    db.save();
  }

  await m.react("✅");
  return m.reply(
    `✅ *BERHASIL*\n\nMenghapus *${targets.length}* ${label}:\n${list}`,
    { mentions },
  );
}

export { pluginConfig as config, handler };