import { getOwnerName } from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "owner",
  alias: ["creator", "dev", "developer"],
  category: "main",
  description: "Menampilkan kontak owner bot dengan UI AIRich dan Dual Product Card",
  usage: ".owner",
  example: ".owner",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, config, db }) {
  const configOwners = config.owner?.number || [];
  const dbOwners = db.data.owner || [];
  const ownerNumbers = [...new Set([...configOwners, ...dbOwners])];
  const botName = config.bot?.name || "Ourin-AI";

  const ownerNumber = ownerNumbers[0] || "62882005686310";
  const rawOwnerName = config.owner?.name || getOwnerName(ownerNumber) || "Owner";
  const cleanNumber = ownerNumber.replace(/[^0-9]/g, "");
  const ownerJid = cleanNumber + "@s.whatsapp.net";

  let ownerAvatar = "https://i.imgur.com/TuItj4L.png";
  try {
    const url = await sock.profilePictureUrl(ownerJid, "image");
    if (url) ownerAvatar = url;
  } catch {}

  let botAvatar = "https://i.imgur.com/TuItj4L.png";
  try {
    const botJid = sock.user?.id;
    if (botJid) {
      const url = await sock.profilePictureUrl(botJid, "image");
      if (url) botAvatar = url;
    }
  } catch {}

  const formatRuntime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let result = "";
    if (d > 0) result += `${d} hari `;
    if (h > 0 || d > 0) result += `${h} jam `;
    result += `${min} menit ${s} detik`;
    return result;
  };

  const botRuntime = formatRuntime(process.uptime());
  const footerText = `© ${botName} • Dikembangkan dengan ❤️ oleh ${rawOwnerName}`;

  await m.react("👑");

  const infoText =
    `👑 *INFORMASI OWNER*\n\n` +
    `▸ Nama — *[${rawOwnerName}](https://wa.me/${cleanNumber})*\n` +
    `▸ Bot — *${botName}*\n` +
    `▸ Status — 🟢 Online & Aktif\n` +
    `▸ Runtime — ${botRuntime}\n\n` +
    `_Punya kendala, request fitur, atau tertarik sewa/beli bot?_\n` +
    `_Langsung chat owner lewat tombol di bawah, insyaAllah fast response_ 🚀\n\n` +
    `${footerText}`;

  try {
    const rich = new AIRich(sock)
      .setTitle("👑 OWNER INFORMATION")
      .setSubtitle(`@${cleanNumber}`)
      .setFooter(botName)

      .addProduct([
        {
          title: rawOwnerName,
          brand: "Lead Developer",
          price: "Owner Contact",
          sale_price: "Available",
          url: `https://wa.me/${cleanNumber}`,
          image: ownerAvatar
        },
        {
          title: botName,
          brand: "Official Bot",
          price: "Active System",
          sale_price: `Node ${process.version}`,
          url: "https://whatsapp.com",
          image: botAvatar
        }
      ])
      .addText(infoText)
      .addFooterAction(
        {
          text: `💬 Chat Langsung ke ${rawOwnerName}`,
          url: `https://wa.me/${cleanNumber}`
        }
      )
      .addMetadata(footerText);

    rich.addSuggest([
      "menu",
      "ping",
      "script",
      "donasi"
    ]);

    await rich.send(m.chat, { quoted: m, mentions: [ownerJid] });

  } catch (error) {
    console.error("[Owner Plugin Error]:", error);
    
    await m.reply(`❌ Gagal memuat informasi owner secara interaktif.\n\nSilahkan hubungi langsung: wa.me/${cleanNumber}`);
  }
}

export { pluginConfig as config, handler };