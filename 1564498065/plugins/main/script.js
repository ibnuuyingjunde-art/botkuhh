import { getOwnerName } from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "script",
  alias: ["hargascript", "priceupdate", "hargaupdate", "orderscript", "beliscript", "promo", "harga"],
  category: "main",
  description: "Menampilkan promo + daftar harga jasa script bot dengan UI AIRich dan Dual Product Card",
  usage: ".script",
  example: ".script",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const priceList = [
  { label: "No Update", price: "20k" },
  { label: "3x Update", price: "35k" },
  { label: "Full Update", price: "50k" },
  { label: "Reseller", price: "90k" },
  { label: "Partner", price: "120k" },
];

async function handler(m, { sock, config, db }) {
  const configOwners = config.owner?.number || [];
  const dbOwners = db?.data?.owner || [];
  const ownerNumbers = [...new Set([...configOwners, ...dbOwners])];
  const botName = config.bot?.name || "Ourin-AI";

  const ownerNumber = ownerNumbers[0] || "6281524385851";
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

  await m.react("💰");

  let priceText = `💰 *DAFTAR HARGA*\n\n`;
  for (const item of priceList) {
    priceText += `▸ ${item.label} — *Rp${item.price}*\n`;
  }
  priceText += `\n📌 _Harga bisa nego dikit, tergantung request._\n`;
  priceText += `📩 _Order langsung chat owner via tombol di bawah ya_ 🚀`;

  try {
    const rich = new AIRich(sock)
      .setTitle("🔥 JASA SCRIPT WHATSAPP BOT")
      .setSubtitle("Murah, aman, gercep respon!")
      .setFooter(botName)

      .addProduct([
        {
          title: botName,
          brand: "Script Bot WhatsApp",
          price: "Mulai Rp 20k",
          sale_price: "No Update",
          url: "https://whatsapp.com",
          image: botAvatar
        },
        {
          title: rawOwnerName,
          brand: "Order / Konsultasi",
          price: "Fast Response",
          sale_price: "Available",
          url: `https://wa.me/${cleanNumber}`,
          image: ownerAvatar
        }
      ])
      .addText(priceText)
      .addFooterAction(
        {
          text: `💬 Order / Chat ${rawOwnerName}`,
          url: `https://wa.me/${cleanNumber}`
        }
      )
      .addMetadata(`© ${botName} • Jasa Script by ${rawOwnerName}`);

    rich.addSuggest([
      "owner",
      "menu",
      "ping",
      "donasi"
    ]);

    await rich.send(m.chat, { quoted: m, mentions: [ownerJid] });

  } catch (error) {
    console.error("[Script Plugin Error]:", error);
    
    let fallback = `🔥 *JASA SCRIPT WHATSAPP BOT* 🔥\n`;
    fallback += `_Murah, aman, gercep respon!_\n\n${priceText}\n\n`;
    fallback += `👤 Owner: @${cleanNumber}`;
    await m.reply(fallback, { mentions: [ownerJid] });
  }
}

export { pluginConfig as config, handler };