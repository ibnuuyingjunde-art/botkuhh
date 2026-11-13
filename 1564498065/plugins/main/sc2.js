import { getOwnerName } from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "sc2",
  alias: [],
  category: "main",
  description: "Menampilkan info source/script bot dengan UI AIRich",
  usage: ".sc2",
  example: ".sc2",
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
  const botName = config.bot?.name || "CloudBot";

  const ownerNumber = ownerNumbers[0] || "62882005686310";
  const rawOwnerName = config.owner?.name || getOwnerName(ownerNumber) || "Jyes";
  const cleanNumber = ownerNumber.replace(/[^0-9]/g, "");
  const ownerJid = cleanNumber + "@s.whatsapp.net";

  // Diambil dari database/plugin-check-report.json (total: 1102). Ganti config.bot.totalPlugins kalau mau override dinamis.
  const totalPlugins = config.bot?.totalPlugins || "1102";

  let coverImage = "https://i.imgur.com/TuItj4L.png";
  try {
    const url = await sock.profilePictureUrl(ownerJid, "image");
    if (url) coverImage = url;
  } catch {}

  await m.react("📄");

  const footerText =
    `- Script name : ${botName}\n` +
    `- Creator : ${rawOwnerName}\n` +
    `- Type : plugins\n` +
    `- Total plugins : ${totalPlugins}\n` +
    `- Modules : ESM\n` +
    `- Database storage : Local SQLite (better-sqlite3)\n` +
    `- Library : baileys (ichigokurosaki-baileys)\n\n` +
    `*Fetures!*\n` +
    `- ${totalPlugins} fitur\n` +
    `- Fast respon & simpel\n` +
    `- Auto reload plugin & auto add ke list menu\n` +
    `- Auto convert lid to jid\n` +
    `- Support buttons, single_select, poll, dll\n` +
    `- Sistem RPG (dungeon, marry, class, equipment, leaderboard)\n` +
    `- JadiBot multi-session\n` +
    `- Welcome message dengan profile picture member\n` +
    `- Sistem VIP & role priority\n` +
    `dll`;

  try {
    const rich = new AIRich(sock)
      .setTitle(`📄 ${botName.toUpperCase()} SOURCE INFO`)
      .setSubtitle(`@${cleanNumber}`)
      .setFooter(botName)

      .addPost({
        username: botName,
        profile_picture_url: coverImage,
        post_caption: rawOwnerName,
        source_app: "WHATSAPP",
        post_type: "IMAGE",
        thumbnail_url: coverImage,
        post_url: `https://wa.me/${cleanNumber}`
      })
      .addTip("Source info")
      .addMetadata(footerText)
      .addFooterAction(
        {
          text: "owners",
          url: `https://wa.me/${cleanNumber}`
        }
      )
      .addMetadata(`© ${botName} • Dikembangkan dengan ❤️ oleh ${rawOwnerName}`);

    rich.addSuggest([
      "menu",
      "owner",
      "script",
      "donasi"
    ]);

    await rich.send(m.chat, { quoted: m, mentions: [ownerJid] });

  } catch (error) {
    console.error("[SourceInfo Plugin Error]:", error);

    await m.reply(footerText);
  }
}

export { pluginConfig as config, handler };