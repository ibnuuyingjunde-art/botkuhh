import fs from "fs";
import path from "path";
import config from "../../config.js";
import { generateWAMessageFromContent, proto } from "ichigo";

const pluginConfig = {
  name: "setmenucat",
  alias: ["menucatvariant", "menucatstyle"],
  category: "owner",
  description: "Mengatur variant tampilan menucat",
  usage: ".setmenucat <v1-v8>",
  example: ".setmenucat v2",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  v1: { id: 1, name: "Simple Text",          desc: "Text biasa tanpa contextInfo",                          emoji: "📝" },
  v2: { id: 2, name: "Context + Newsletter", desc: "Text + contextInfo + forwardedNewsletter",             emoji: "📨" },
  v3: { id: 3, name: "Image + Caption",      desc: "Image + caption + contextInfo + forwardedNewsletter",  emoji: "📸" },
  v4: { id: 4, name: "Interactive Button",   desc: "Interactive message + single_select + quick_reply",    emoji: "🔘" },
  v5: { id: 5, name: "Dashboard Card",       desc: "Interactive + stats header + progress bar + multi-section", emoji: "🃏" },
  v6: { id: 6, name: "Pilihan Menu",         desc: "buttonsMessage + single_select Pilihan Menu + quick_reply All Menu", emoji: "🪼" },
  v7: { id: 7, name: "Style 16 + Footer",    desc: "Interactive image header + list/detail kategori + footer profil/sistem + tombol Menu & Support", emoji: "🌟" },
  v8: { id: 8, name: "List Menu Thumbnail", desc: "List message + thumbnail besar + banner & salam + daftar kategori/command di body + footer profil/sistem + tombol Buka Menu", emoji: "📜" },
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

  function buildContextInfo(title, body) {
    return {
      mentionedJid: [m.sender],
      forwardingScore: 9999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: saluranId,
        newsletterName: saluranName,
        serverMessageId: 127,
      },
      externalAdReply: {
        title: title || "Set MenuCat",
        body:  body  || botName,
        sourceUrl: saluranLink,
        mediaType: 1,
        renderLargerThumbnail: false,
        thumbnail: thumbBuffer,
      },
    };
  }

  if (variant) {
    const selected = VARIANTS[variant];
    if (!selected) {
      return await m.reply(
        `❌ *VARIANT TIDAK VALID*\n\n> Gunakan: *v1* hingga *v8*\n> Ketik \`${m.prefix}setmenucat\` untuk lihat daftar.`,
      );
    }

    db.setting("menucatVariant", selected.id);
    await db.save();

    const confirmText =
      `✅ *MENUCAT VARIANT DIUBAH*\n\n` +
      `╭─〔 ${selected.emoji} *V${selected.id} — ${selected.name}* 〕───⬣\n` +
      ` │ ${selected.desc}\n` +
      `╰───────⬣\n\n` +
      `> Tampilan \`${m.prefix}menucat\` sudah berubah.`;

    try {
      await sock.sendMessage(
        m.chat,
        { text: confirmText, contextInfo: buildContextInfo(`✅ Variant Diubah ke V${selected.id}`, selected.name) },
        { quoted: m },
      );
    } catch (e) {
      console.error("[SetMenuCat] Gagal kirim konfirmasi:", e.message);
      try { await m.reply(confirmText); } catch {}
    }
    return;
  }

  const current        = db.setting("menucatVariant") || config.ui?.menucatVariant || 2;
  const currentVariant = VARIANTS[`v${current}`];

  const bodyText =
    `🗂️ *PENGATURAN MENUCAT VARIANT*\n\n` +
    `Variant aktif: *${currentVariant?.emoji || "—"} V${current} — ${currentVariant?.name || "Unknown"}*\n\n` +
    `╭─〔 📋 *DAFTAR VARIANT* 〕───⬣\n` +
    Object.entries(VARIANTS)
      .map(([key, val]) => {
        const active = val.id === current ? " ✓ AKTIF" : "";
        return ` │ ${val.emoji} *${key.toUpperCase()}${active}*\n │   ${val.desc}`;
      })
      .join("\n │\n") +
    `\n╰───────⬣\n\n` +
    `> Pilih variant dari tombol di bawah 👇`;

  const rows = Object.entries(VARIANTS).map(([key, val]) => {
    const active = val.id === current ? " ✓" : "";
    return {
      title:       `${val.emoji} ${key.toUpperCase()}${active} — ${val.name}`,
      description: val.desc,
      id:          `${m.prefix}setmenucat ${key}`,
    };
  });

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🗂️ Pilih Variant Menucat",
        sections: [{ title: "✦ DAFTAR VARIANT (v1–v8)", rows }],
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🏠 Kembali ke Menu",
        id: `${m.prefix}menu`,
      }),
    },
  ];

  try {
    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: "",
          title: bodyText,
          footer: `© ${botName} — Owner Only`,
          image: imageBuffer || thumbBuffer,
          contextInfo: { mentionedJid: [m.sender], forwardingScore: 777, isForwarded: true },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                list_title: "Pilih variant menucat",
                button_title: "🗂️ Tap Di Sini",
              },
            }),
            buttons,
          },
        },
      },
      { quoted: m },
    );
    return;
  } catch (e1) {
    console.warn("[SetMenuCat] Metode 1 gagal:", e1.message);
  }

  try {
    const msg = generateWAMessageFromContent(
      m.chat,
      {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
          body:   proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
          footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `© ${botName} — Owner Only` }),
          header: proto.Message.InteractiveMessage.Header.fromObject({
            title: "🗂️ Set MenuCat Variant",
            hasMediaAttachment: false,
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons }),
          contextInfo: buildContextInfo("Set MenuCat Variant", `Aktif: V${current} — ${currentVariant?.name || ""}`),
        }),
      },
      { userJid: m.sender, quoted: m },
    );
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    return;
  } catch (e2) {
    console.warn("[SetMenuCat] Metode 2 gagal:", e2.message);
  }

  try {
    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body:   proto.Message.InteractiveMessage.Body.fromObject({ text: bodyText }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `© ${botName} — Owner Only` }),
              header: proto.Message.InteractiveMessage.Header.fromObject({
                title: "🗂️ Set MenuCat Variant",
                hasMediaAttachment: false,
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons }),
              contextInfo: buildContextInfo("Set MenuCat Variant", `Aktif: V${current} — ${currentVariant?.name || ""}`),
            }),
          },
        },
      },
      { userJid: m.sender, quoted: m },
    );
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    return;
  } catch (e3) {
    console.warn("[SetMenuCat] Metode 3 gagal:", e3.message);
  }

  try {
    await sock.sendMessage(
      m.chat,
      { text: bodyText, contextInfo: buildContextInfo("Set MenuCat Variant", `Aktif: V${current}`) },
      { quoted: m },
    );
  } catch {
    await m.reply(bodyText);
  }
}

export { pluginConfig as config, handler };