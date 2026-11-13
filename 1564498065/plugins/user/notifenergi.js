import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "notifenergi",
  alias: ["notifenergy", "notiflimit", "energinotif"],
  category: "user",
  description: "Toggle notifikasi pengurangan energi setiap pakai command",
  usage: ".notifenergi",
  example: ".notifenergi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender) || db.setUser(m.sender);

  const current = user.notifEnergi ?? false;
  const updated = !current;

  db.setUser(m.sender, { notifEnergi: updated });

  const status = updated ? "✅ *ON*" : "❌ *OFF*";
  const desc = updated
    ? "Setiap kamu pakai command yang butuh energi, kamu akan dapat notif pengurangan energi."
    : "Notifikasi pengurangan energi dimatikan.";

  await m.reply(
    `⚡ *NOTIF ENERGI*\n\n` +
    `Status: ${status}\n\n` +
    `> ${desc}`
  );
}

export { pluginConfig as config, handler };