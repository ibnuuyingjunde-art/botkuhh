import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setnativeflow",
  alias: ["nativeflow", "nfcompat"],
  category: "owner",
  description: "On/off konversi interactiveButtons ke nativeFlow (compat @itsliaaa/baileys)",
  usage: ".setnativeflow <on|off>",
  example: ".setnativeflow off",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { db }) {
  const database = db || getDatabase();
  const arg = String(m.text || "").trim().toLowerCase();
  const current = database.setting("nativeFlowCompat") === true;

  if (!arg) {
    return m.reply(
      `🔘 *NATIVEFLOW COMPAT*\n\n` +
      `Status: *${current ? "ON ✅" : "OFF ❌"}*\n\n` +
      `• OFF (disarankan untuk ichigokurosaki-baileys): tombol dikirim apa adanya\n` +
      `• ON (hanya untuk @itsliaaa/baileys): interactiveButtons diubah ke nativeFlow\n\n` +
      `Gunakan: *${m.prefix}setnativeflow on* / *off*`,
    );
  }

  if (!["on", "off", "true", "false"].includes(arg)) {
    return m.reply(`❌ Gunakan: *${m.prefix}setnativeflow on* atau *off*`);
  }

  const value = arg === "on" || arg === "true";
  database.setting("nativeFlowCompat", value);
  await database.save();

  return m.reply(
    `✅ *NATIVEFLOW COMPAT ${value ? "ON" : "OFF"}*\n\n` +
    `Berlaku langsung tanpa restart.${value ? "\n\n⚠ Jika tombol hilang, matikan lagi dengan *.setnativeflow off*." : ""}`,
  );
}

export { pluginConfig as config, handler };