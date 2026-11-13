import { getDatabase } from "../../src/lib/ichigo-database.js";
import { AmpremSend } from "../../src/scraper/amprem.js";

const pluginConfig = {
  name: "amprem-login",
  alias: ["amplogin", "amlogin"],
  category: "tools",
  description: "Mengirim pemicu login/email Amprem ke target.",
  usage: ".amprem-login <email>",
  example: ".amprem-login target@example.com",
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
  const targetEmail = m.text?.trim();

  if (!targetEmail) {
    return m.reply(
      `🕯️ *AMPREM LOGIN SERVICE* 🕯️\n\n` +
        `> _"Sediakan wadah emailnya, biarkan benih kepalsuan ini dikirim..."_\n\n` +
        `*Cara Penggunaan:*\n` +
        `> *${m.prefix}amprem-login <email>*`
    );
  }

  m.react("🕕");
  const result = await AmpremSend(targetEmail);

  if (!result.status) {
    m.react("☢");
    return m.reply(`❌ *Koneksi Terputus*\n\n> Gagal menyentuh server: ${result.error}`);
  }

  const userData = db.getUser(m.sender) || {};
  userData.ampremEmail = targetEmail;
  userData.ampremVerified = false; 
  db.setUser(m.sender, userData);

  m.react("✅");
  return m.reply(
    `📨 *Pemicu Berhasil Dikirim!*\n\n` +
      `> 📬 Email: *${targetEmail}*\n` +
      `> 📜 Response: \`\`\`${JSON.stringify(result.data, null, 2)}\`\`\`\n\n` +
      `_Pesan telah meluncur. Segera cek kotak masuk, lalu verifikasi menggunakan *${m.prefix}amprem-verif <link>*_`
  );
}

export { pluginConfig as config, handler };