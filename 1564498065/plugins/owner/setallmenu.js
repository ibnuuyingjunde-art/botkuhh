import fs from "fs";
import path from "path";
import config from "../../config.js";

const pluginConfig = {
  name: "setallmenu",
  alias: ["allmenuvariant", "allmenustyle"],
  category: "owner",
  description: "Mengatur variant tampilan allmenu",
  usage: ".setallmenu <v1-v10>",
  example: ".setallmenu v6",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  v1: { id: 1, name: "Simple Text",         desc: "Text biasa tanpa image/contextInfo",                        emoji: "📝" },
  v2: { id: 2, name: "Image + Context",     desc: "Image + full contextInfo + forwardedNewsletter",            emoji: "🖼️" },
  v3: { id: 3, name: "Document",            desc: "Document + jpegThumbnail + contextInfo + verified quoted",  emoji: "📄" },
  v4: { id: 4, name: "Interactive Button",  desc: "Interactive + single_select kategori + quick_reply",        emoji: "🔘" },
  v5: { id: 5, name: "NativeFlow",          desc: "NativeFlow + limited_time_offer + interactive buttons",     emoji: "✨" },
  v6: { id: 6, name: "Zanton V2 + Chunk",   desc: "Interactive modern + sections chunk per 10 + quick_reply",  emoji: "🪼" },
  v7: { id: 7, name: "Small Caps + Zanton", desc: "Semua teks small caps + NativeFlow + interactive buttons",  emoji: "✦" },
  v8: { id: 8, name: "Pilihan Menu",        desc: "buttonsMessage + single_select Pilihan Menu + quick_reply All Menu", emoji: "🪼" },
  v9: { id: 9, name: "Style 16 + Footer",   desc: "Interactive image header + list command + footer profil/sistem + tombol Menu & Support", emoji: "🌟" },
  v10: { id: 10, name: "List Menu Thumbnail", desc: "List message + thumbnail besar + banner & salam + daftar command di body + footer profil/sistem + tombol Buka Menu", emoji: "📜" },
};

async function handler(m, { sock, db }) {
  const args = m.args || [];
  let variant = args[0]?.toLowerCase();
  if (!variant && m.text) {
    const match = m.text.trim().match(/v\d{1,2}$/i);
    if (match) variant = match[0].toLowerCase();
  }

  const saluranId   = config.saluran?.id   || "120363409557700746@newsletter";
  const saluranName = config.saluran?.name || config.bot?.name || "lyniX's MD";
  const saluranLink = config.saluran?.link || "";
  const botName     = config.bot?.name     || "lyniX's MD";

  const thumbPath  = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  const imagePath  = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
  const thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : null;
  const imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;

  const current        = db.setting("allmenuVariant") || config.ui?.allmenuVariant || 2;
  const currentVariant = VARIANTS[`v${current}`];

  if (variant) {
    const selected = VARIANTS[variant];
    if (!selected) {
      return await m.reply(
        `❌ *VARIANT TIDAK VALID*\n\n> Gunakan: *v1* hingga *v10*\n> Ketik \`${m.prefix}setallmenu\` untuk lihat daftar.`,
      );
    }
    db.setting("allmenuVariant", selected.id);
    await db.save();
    try {
      await sock.sendMessage(
        m.chat,
        {
          text:
            `✅ *ALLMENU VARIANT DIUBAH*\n\n` +
            `╭─〔 ${selected.emoji} *V${selected.id} — ${selected.name}* 〕───⬣\n` +
            ` │ ${selected.desc}\n` +
            `╰───────⬣\n\n` +
            `> Tampilan \`${m.prefix}allmenu\` sudah berubah.`,
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 127,
            },
            externalAdReply: {
              title: `✅ Variant Diubah ke V${selected.id}`,
              body: selected.name,
              sourceUrl: saluranLink,
              mediaType: 1,
              renderLargerThumbnail: false,
              thumbnail: thumbBuffer,
            },
          },
        },
        { quoted: m },
      );
    } catch {
      await m.reply(`✅ Allmenu variant diubah ke *V${selected.id} — ${selected.name}*`);
    }
    return;
  }

  const bodyText =
    `╭─「 📋 *𝖲𝖾𝗍 𝖠𝗅𝗅𝗆𝖾𝗇𝗎 𝖵𝖺𝗋𝗂𝖺𝗇𝗍* 」\n` +
    `│\n` +
    `│  Variant aktif:\n` +
    `│  ${currentVariant?.emoji || "—"} *V${current}* — \`${currentVariant?.name || "Unknown"}\`\n` +
    `│\n` +
    `╰──\n\n` +
    `╭─〔 📑 *DAFTAR VARIANT* 〕───⬣\n` +
    Object.entries(VARIANTS)
      .map(([key, val]) => {
        const active = val.id === current ? " *✓ AKTIF*" : "";
        return ` │ ${val.emoji} *${key.toUpperCase()}*${active}\n │   \`${val.name}\`\n │   ${val.desc}`;
      })
      .join("\n │\n") +
    `\n╰───────⬣\n\n` +
    `> Pilih variant dari tombol di bawah 👇`;

  const rows = Object.entries(VARIANTS).map(([key, val]) => ({
    title:       `${val.emoji} ${key.toUpperCase()}${val.id === current ? " ✓" : ""} — ${val.name}`,
    description: val.desc,
    id:          `${m.prefix}setallmenu ${key}`,
  }));

  const buttons = [
    { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
    { name: "inapp_signup",  buttonParamsJson: "{}" },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "📋 Pilih Variant Allmenu",
        sections: [{ title: "✦ DAFTAR VARIANT (v1–v10)", rows }],
        has_multiple_buttons: true,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: "🏠 Kembali ke Menu", id: `${m.prefix}menu` }),
    },
  ];

  try {
    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: `📋 𝖲𝖾𝗍 𝖠𝗅𝗅𝗆𝖾𝗇𝗎 𝖵𝖺𝗋𝗂𝖺𝗇𝗍`,
          footer: bodyText,
          image: imageBuffer || thumbBuffer,
          contextInfo: { mentionedJid: [m.sender], forwardingScore: 7, isForwarded: true },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              limited_time_offer: { text: `⚙️ Owner Mode`, url: "", copy_code: "", expiration_time: null },
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 3, 999],
                list_title: "✦ Pilih variant yang kamu mau",
                button_title: "📋 Pilih Variant",
              },
              tap_target_configuration: {
                title: "✦",
                description: botName,
                canonical_url: "https://ichigo.site",
                domain: "ichigo.site",
                button_index: 0,
              },
            }),
            buttons,
          },
        },
      },
      { quoted: m },
    );
  } catch (err) {
    console.error("[SetAllMenu] error:", err.message);
    try {
      await sock.sendMessage(
        m.chat,
        {
          text: bodyText,
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 9999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 127,
            },
            externalAdReply: {
              title: "Set AllMenu Variant",
              body: `Aktif: V${current} — ${currentVariant?.name || ""}`,
              sourceUrl: saluranLink,
              mediaType: 1,
              renderLargerThumbnail: false,
              thumbnail: thumbBuffer,
            },
          },
        },
        { quoted: m },
      );
    } catch {
      await m.reply(bodyText);
    }
  }
}

export { pluginConfig as config, handler };