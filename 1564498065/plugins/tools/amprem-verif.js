import { getDatabase } from "../../src/lib/ichigo-database.js";
import { AmpremVerif } from "../../src/scraper/amprem.js";

const pluginConfig = {
  name: "amprem-verif",
  alias: ["ampverif", "amverif"],
  category: "tools",
  description: "Memverifikasi tautan Amprem berdasarkan email yang sebelumnya didaftarkan.",
  usage: ".amprem-verif <link>",
  example: ".amprem-verif https://alightcreative...",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 5,
  isEnabled: true,
};

async function handler(m) {
  const db = getDatabase();
  const targetLink = m.text?.trim();
  const userData = db.getUser(m.sender);
  const savedEmail = userData?.ampremEmail;

  if (!savedEmail) {
    m.react("❌");
    return m.reply(
      `❌ *Belum Ada Jejak Email*\n\n` +
        `> _"Kamu ingin mengikat sesuatu yang bahkan belum memiliki awal..."_\n\n` +
        `Silakan kirim email terlebih dahulu menggunakan:\n` +
        `> *${m.prefix}amprem-login <email>*`
    );
  }

  if (!targetLink) {
    m.react("❌");
    return m.reply(
      `❌ *Tautan Kosong*\n\n` +
        `> _"Mana ikatan yang harus aku satukan?"_\n\n` +
        `*Cara Penggunaan:*\n` +
        `> *${m.prefix}amprem-verif <link_verifikasi>*`
    );
  }

  m.react("🕕");
  const result = await AmpremVerif(savedEmail, targetLink);

  if (!result.status) {
    m.react("☢");
    return m.reply(`❌ *Koneksi Terputus*\n\n> Gagal memvalidasi takdir: ${result.error}`);
  }

  userData.ampremVerified = true;
  db.setUser(m.sender, userData);

  m.react("✅");
  return m.reply(
    `🔗 *Verifikasi Berhasil Disahkan!*\n\n` +
      `> 📧 Email Terkait: *${savedEmail}*\n` +
      `> 🌐 Tautan: ${targetLink}\n` +
      `> 📜 Response: \`\`\`${JSON.stringify(result.data, null, 2)}\`\`\`\n\n` +
      `_Ikatan telah sempurna. Semuanya kini berada dalam kendali..._`
  );
}

export { pluginConfig as config, handler };