import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "rejectmarry",
  alias: ["reject", "tolak-marry", "tolaknikah"],
  category: "rpg",
  description: "Menolak lamaran nikah",
  usage: ".reject",
  example: ".reject",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function getSessions() {
  if (!global.marrySessions) global.marrySessions = {};
  return global.marrySessions;
}

async function handler(m, { sock }) {
  const sessions = getSessions();

  const sessionEntry = Object.entries(sessions).find(
    ([, val]) => val.target === m.sender && val.chat === m.chat,
  );

  if (!sessionEntry) {
    return m.reply(
      `❌ Tidak ada lamaran nikah untukmu saat ini.`,
    );
  }

  const [sessionKey, session] = sessionEntry;
  const { proposer } = session;

  delete sessions[sessionKey];

  await m.react("💔");

  let txt = `💔 *LAMARAN DITOLAK!*\n\n`;
  txt += `@${m.sender.split("@")[0]} menolak lamaran dari @${proposer.split("@")[0]}\n\n`;
  txt += `Sabar ya @${proposer.split("@")[0]}, masih banyak yang lain! 😢\n\n`;
  txt += `> _"Penolakan adalah awal dari keberhasilan" - Bot Bijak_ 🥀`;

  await m.reply(txt, { mentions: [m.sender, proposer] });
}

export { pluginConfig as config, handler };