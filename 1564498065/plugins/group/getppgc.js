const pluginConfig = {
  name: "getppgc",
  alias: ["ppgc", "fotogrup", "profilepicgc"],
  category: "group",
  description: "Mengambil foto profil grup",
  usage: ".getppgc",
  example: ".getppgc",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  try {
    let ppUrl = null;

    try {
      ppUrl = await sock.profilePictureUrl(m.chat, "image");
    } catch (e) {
      return m.reply("❌ Grup ini tidak memiliki foto profil atau bot tidak bisa mengaksesnya.");
    }

    if (!ppUrl) {
      return m.reply("❌ Foto profil grup tidak ditemukan.");
    }

    const groupMeta = await sock.groupMetadata(m.chat).catch(() => null);
    const groupName = groupMeta?.subject || "Grup";

    await sock.sendMessage(
      m.chat,
      {
        image: { url: ppUrl },
        caption: `📸 *Foto Profil Grup*\n\n> 👥 Nama: *${groupName}*`,
        contextInfo: {
          mentionedJid: [m.sender],
        },
      },
      { quoted: m }
    );
  } catch (error) {
    console.error("[getppgc] Error:", error.message);
    await m.reply("❌ Gagal mengambil foto profil grup.\n> " + error.message);
  }
}

export default {
  config: pluginConfig,
  handler,
};