import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "sw",
  alias: ["postsw", "saluran", "swchannel"],
  category: "owner",
  description: "Post teks/gambar/video ke Channel (Saluran) WA milik bot",
  usage:
    ".sw <teks> | .sw --idch <id_saluran> <teks> | reply media + .sw <caption>",
  example: ".sw Halo semua di saluran!",
  isOwner: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function downloadQuotedMedia(m, sock) {
  if (typeof m.quoted?.download === "function") {
    return await m.quoted.download();
  }
  if (typeof m.download === "function") {
    return await m.download();
  }
  if (typeof sock.downloadMediaMessage === "function") {
    return await sock.downloadMediaMessage(m.quoted || m);
  }

  const quotedMsg = m.quoted?.message
    ? m.quoted
    : {
      message: m.message?.extendedTextMessage?.contextInfo?.quotedMessage,
      key: {
        remoteJid: m.chat,
        id: m.message?.extendedTextMessage?.contextInfo?.stanzaId,
        participant: m.message?.extendedTextMessage?.contextInfo?.participant,
      },
    };
  if (!quotedMsg.message) return null;

  const pkgNames = ["@whiskeysockets/baileys", "baileys", "@adiwajshing/baileys"];
  for (const pkg of pkgNames) {
    try {
      const { downloadMediaMessage } = await import(pkg);
      return await downloadMediaMessage(
        quotedMsg,
        "buffer",
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage },
      );
    } catch {
      continue;
    }
  }

  throw new Error(
    "Nggak ketemu cara download media reply — kasih tau di plugin lain (misal sticker.js) cara m.quoted di-download.",
  );
}

function detectQuotedType(m) {
  const msg =
    m.quoted?.message ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!msg) return null;
  if (msg.imageMessage) return "image";
  if (msg.videoMessage) return "video";
  return null;
}

async function handler(m, { sock }) {
  const raw = m.text?.trim() || "";
  let chId = config?.saluran?.id;
  let chName = config?.saluran?.name || config?.bot?.name || "lyniX's";
  let caption = raw;

  const idchMatch = raw.match(/--idch\s+(\S+)/);
  if (idchMatch) {
    chId = idchMatch[1];
    chName = chId;
    caption = raw.replace(/--idch\s+\S+/, "").trim();
  }

  if (!chId)
    return m.reply(
      `❌ Saluran belum diatur. Gunakan \`--idch <id>\` atau atur \`saluran.id\` di config.js`,
    );

  const quotedType = detectQuotedType(m);

  if (!caption && !quotedType)
    return m.reply(
      `📌 *SW - POST KE SALURAN*\n\n` +
        `\`${m.prefix}sw <teks>\`\n` +
        `\`${m.prefix}sw --idch <id_saluran> <teks>\`\n` +
        `reply gambar/video + \`${m.prefix}sw <caption>\``,
    );

  m.react("🕕");
  try {
    if (quotedType === "image" || quotedType === "video") {
      const buffer = await downloadQuotedMedia(m, sock);
      if (!buffer) throw new Error("Gagal mengunduh media yang di-reply");

      await sock.sendMessage(chId, {
        [quotedType]: buffer,
        caption: caption || undefined,
      });
    } else {
      await sock.sendMessage(chId, { text: caption });
    }

    m.react("✅");
    m.reply(`✅ Berhasil diposting ke saluran *${chName}*`);
  } catch (e) {
    console.error("[SW]", e);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };