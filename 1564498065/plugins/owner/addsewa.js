import te from "../../src/lib/ichigo-error.js";
import { addSewaGroup, formatDuration } from "../../src/lib/ichigo-sewa.js";

const pluginConfig = {
  name: "addsewa",
  alias: ["sewaadd", "tambahsewa"],
  category: "owner",
  description: "Tambah grup ke whitelist sewa + auto join",
  usage: ".addsewa <link/id grup> <durasi>",
  example: ".addsewa https://chat.whatsapp.com/xxx 30d",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const args = m.args;
  if (args.length < 2) {
    return m.reply(
      `📝 *TAMBAH SEWA*\n\n` +
      `Format: *${m.prefix}addsewa <link/id> <durasi>*\n\n` +
      `*FORMAT DURASI:*\n` +
      `• 30i = 30 menit\n` +
      `• 12h = 12 jam\n` +
      `• 7d = 7 hari\n` +
      `• 1m = 1 bulan (30 hari)\n` +
      `• 1y = 1 tahun\n` +
      `• lifetime = Permanent\n\n` +
      `*INPUT GRUP:*\n` +
      `• Link  : https://chat.whatsapp.com/xxx\n` +
      `• ID    : 120363xxx@g.us atau 120363xxx\n\n` +
      `*CONTOH:*\n` +
      `• ${m.prefix}addsewa https://chat.whatsapp.com/xxx 30d\n` +
      `• ${m.prefix}addsewa 120363408577012139 7d\n\n` +
      `💡 Kalau bot sudah ada di grup, pakai ID langsung tanpa perlu link invite!`
    );
  }

  const [input, durationStr] = args;

  await m.react("🕕");

  try {
    const result = await addSewaGroup({
      sock,
      input,
      durationStr,
      addedBy: m.sender,
    });

    const expiredStr = result.isLifetime
      ? "Permanent"
      : new Date(result.expiredAt).toLocaleString("id-ID");

    let text = `✅ *SEWA BERHASIL DITAMBAHKAN*\n\n`;
    text += `╭─〔 Detail 〕\n`;
    text += `│ Grup    : *${result.groupName}*\n`;
    text += `│ ID      : ${result.groupId.split("@")[0]}\n`;
    text += `│ Durasi  : *${formatDuration(durationStr)}*\n`;
    text += `│ Expired : *${expiredStr}*\n`;
    text += `╰──\n\n`;

    text += result.joined
      ? `✅ ${result.joinReason}`
      : `⚠️ *Auto-join gagal*\n${result.joinReason}`;

    await m.react("✅");
    return m.reply(text);
  } catch (error) {
    await m.react("☢");
    console.error("[addsewa] Error:", error.message);
    if (error.message.includes("durasi") || error.message.includes("ditemukan")) {
      return m.reply(`❌ ${error.message}`);
    }
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };