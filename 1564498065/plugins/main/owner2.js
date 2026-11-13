import { getOwnerName } from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "owner2",
  alias: ["creator2", "dev2", "developer2"],
  category: "main",
  description: "Menampilkan kontak developer secara ringkas dengan UI AIRich",
  usage: ".owner2",
  example: ".owner2",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const DEV_IMAGE = "https://u.pone.rs/yqorzxru.jpg";

async function handler(m, { sock, config, db }) {
  const configOwners = config.owner?.number || [];
  const dbOwners = db.data.owner || [];
  const ownerNumbers = [...new Set([...configOwners, ...dbOwners])];
  const botName = config.bot?.name || "Ourin-AI";

  const ownerNumber = ownerNumbers[0] || "62882005686310";
  const rawOwnerName = config.owner?.name || getOwnerName(ownerNumber) || "Owner";
  const cleanNumber = ownerNumber.replace(/[^0-9]/g, "");
  const ownerJid = cleanNumber + "@s.whatsapp.net";

  await m.react("👑");

  try {
    const rich = new AIRich(sock);

    const developerSection = AIRich.newLayout("Single", {
      __typename: "GenAICompactEntityPrimitive",
      title: rawOwnerName,
      subtitle: "Developer",
      secondary_subtitle: botName,
      entity_id: Number(cleanNumber),
      entity_url: `https://wa.me/${cleanNumber}`,
      entity_type: "PERSON",
      action_type: "MESSAGE",
      is_verified: true,
      image: { url: DEV_IMAGE },
    });

    const submessage = {
      messageType: 2,
      messageText: `Kontak Developer ${botName}`,
    };

    rich._addContent(developerSection, submessage);

    rich.addImage(DEV_IMAGE, { resolveUrl: true });

    rich.addSuggest(["menu", "ping", "donasi"]);

    await rich.send(m.chat, { quoted: m, mentions: [ownerJid] });
  } catch (error) {
    console.error("[owner2 Plugin Error]:", error);

    await m.reply(`❌ Gagal memuat kontak developer secara interaktif.\n\nSilahkan hubungi langsung: wa.me/${cleanNumber}`);
  }
}

export { pluginConfig as config, handler };