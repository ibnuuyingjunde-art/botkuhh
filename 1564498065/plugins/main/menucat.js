import * as botmodePlugin from "../group/botmode.js";
import { getCasesByCategory } from "../../case/ichigo.js";
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from "ichigo";
import { sharp as _sharp } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import { getTimeGreeting, formatUptime } from "../../src/lib/ichigo-formatter.js";
import {
  getCommandsByCategory,
  getCategories,
} from "../../src/lib/ichigo-plugins.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getAssetBuffer as getCachedAsset } from "../../src/lib/ichigo-asset-manager.js";
import fs from "fs";
import path from "path";
import { attachMenuSticker } from "../../src/lib/ichigo-sticker-annotation.js";

function getSharp() {
  return _sharp;
}

const pluginConfig = {
  name: "menucat",
  alias: ["mc", "category", "cat"],
  category: "main",
  description: "Menampilkan commands dalam kategori tertentu",
  usage: ".menucat <kategori>",
  example: ".menucat tools",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const CATEGORY_EMOJIS = {
  owner: "👑",
  main: "🏠",
  utility: "🔧",
  fun: "🎮",
  group: "👥",
  download: "📥",
  search: "🔍",
  tools: "🛠️",
  sticker: "🖼️",
  ai: "🤖",
  game: "🎯",
  media: "🎬",
  info: "ℹ️",
  religi: "☪️",
  panel: "🖥️",
  user: "📊",
  jpm: "📢",
  pushkontak: "📱",
  ephoto: "🎨",
  store: "🛒",
};

function toMonoUpperBold(text) {
  return text.toUpperCase();
}

function toSmallCaps(text) {
  return text.toUpperCase();
}

const toSC = (text) => {
  const sc = {
    a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",
    k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"s",t:"ᴛ",
    u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ",
    " ":" ","0":"0","1":"1","2":"2","3":"3","4":"4",
    "5":"5","6":"6","7":"7","8":"8","9":"9",
    ".":".","-":"-","_":"_",
  };
  return text.toLowerCase().split("").map(c => sc[c] || c).join("");
};

let cachedThumb = null;
try {
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  if (fs.existsSync(thumbPath)) cachedThumb = fs.readFileSync(thumbPath);
} catch (e) {}

function getContextInfo() {
  const saluranId = config.saluran?.id || "120363409557700746@newsletter";
  const saluranName = config.saluran?.name || config.bot?.name || "lyniX's MD";
  const botName = config.bot?.name || "lyniX's MD";
  return {
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
    },
    externalAdReply: {
      title: `Kategori Menu`,
      body: botName,
      sourceUrl: config.saluran?.link || "",
      mediaType: 1,
      renderLargerThumbnail: false,
      thumbnail: cachedThumb,
    },
  };
}

// ===== Style 16 (interactive + native flow + footer) — dipakai allmenu v9 & menucat v7 =====
const _s16Sans = (text) =>
  String(text).split("").map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCodePoint(0x1d5a0 + (c.charCodeAt(0) - 65));
    if (c >= "a" && c <= "z") return String.fromCodePoint(0x1d5ba + (c.charCodeAt(0) - 97));
    return c;
  }).join("");

const _s16Bold = (text) =>
  String(text).toUpperCase().split("").map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCodePoint(0x1d5d4 + (c.charCodeAt(0) - 65));
    return c;
  }).join("");

function _s16Banner(botConfig) {
  return [
    `━━━━━━━━⊱⋆⊰━━━━━━━━`,
    `  ${_s16Sans(botConfig.bot?.name || "Bot")} ${_s16Sans("Assistant")} - ${new Date().getFullYear()}`,
    `━━━━━━━━⊱⋆⊰━━━━━━━━`,
  ].join("\n");
}

function _s16Box(emoji, title, lines = []) {
  return [
    `┌-------○ 「 ${emoji} ${_s16Bold(title)} 」`,
    ...lines.map((l) => `| ${l}`),
    `└-------○`,
  ].join("\n");
}

async function sendStyle16(sock, m, o) {
  const { botConfig, db, prefix, bodyText, categoryRows, totalCmds, imageBuffer, thumbBuffer } = o;

  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const jam = `${pad(now.getHours())}.${pad(now.getMinutes())}`;

  const userData = db.getUser(m.sender) || {};
  const isVip = db.isVipActive
    ? db.isVipActive(m.sender)
    : (userData?.isVip && (!userData.vipExpired || userData.vipExpired === -1 || Date.now() < userData.vipExpired));
  const userRole = m.isOwner ? "Owner" : (isVip || m.isPremium) ? "Premium" : "Free User";
  const statusEmoji = m.isOwner ? "👑" : (isVip || m.isPremium) ? "💎" : "🆓";
  const userEnergi = m.isOwner || m.isPremium || isVip ? "∞" : (userData.energi ?? 25);

  const saluranLink = botConfig.saluran?.link || "";
  let saluranLabel = saluranLink;
  try { if (saluranLink.includes("://")) saluranLabel = new URL(saluranLink).hostname; } catch {}

  const thumbRaw = getCachedAsset("ichigo") || imageBuffer || thumbBuffer || null;
  let media = null;
  try {
    if (thumbRaw && thumbRaw.length > 0) {
      media = await prepareWAMessageMedia({ image: thumbRaw }, { upload: sock.waUploadToServer });
    }
  } catch (eMedia) {
    console.error("[Style16] Gagal siapkan gambar header:", eMedia.message);
  }

  const buttons = [
    { name: "" },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "Menu",
        sections: [
          {
            title: `🏠 ${_s16Bold("Main Menu")}`,
            highlight_label: _s16Bold("Popular"),
            rows: [
              { title: toSC("all features"), description: toSC(`show all ${totalCmds} bot commands`), id: `${prefix}allmenu` },
              { title: toSC("my profile"), description: toSC("view your account stats"), id: `${prefix}profile` },
              { title: toSC("bot guide"), description: toSC("how to use the bot"), id: `${prefix}guide` },
              { title: toSC("owner contact"), description: toSC("developer contact info"), id: `${prefix}owner` },
            ],
          },
          {
            title: `📂 ${_s16Bold("Bot Feature Categories")}`,
            highlight_label: _s16Bold("More Features"),
            rows: categoryRows,
          },
          {
            title: `\u200b                     © ${botConfig.bot?.developer || botConfig.bot?.name || "Bot"}`,
            highlight_label: saluranLabel,
            rows: [],
          },
        ],
        icon: "DEFAULT",
      }),
    },
    { name: "" },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "Support",
        sections: [
          {
            title: toSC("support the owner"),
            rows: [
              { title: toSC("contact owner"), description: toSC("chat directly with the developer"), id: `${prefix}owner` },
              { title: toSC("donate"), description: toSC("support bot development"), id: `${prefix}donasi` },
            ],
          },
        ],
        icon: "REVIEW",
      }),
    },
  ];

  const h = now.getHours();
  const greeting =
    h >= 4 && h < 12 ? "Good Morning 🌅"
    : h >= 12 && h < 15 ? "Good Afternoon ☀️"
    : h >= 15 && h < 18 ? "Good Evening 🌇"
    : "Good Night 🌙";
  const priceTag = botConfig.bot?.priceTag || "$9.99 USD";

  const footer = [
    _s16Sans(`Hi @${m.sender.split("@")[0]} | *${userRole}* !!, ${greeting}`),
    _s16Sans(`How can I help you today? 🍃`),
    ``,
    `   \`ᑭᖇOᖴIᒪᗴ\``,
    `     ▸ 𝖴𝗌𝖾𝗋𝗇𝖺𝗆𝖾   : \`${m.pushName || "User"}\``,
    `     ▸ 𝖲𝗍𝖺𝗍𝗎𝗌     : ${statusEmoji} \`${userRole}\``,
    `     ▸ 𝖫𝗂𝗆𝗂𝗍      : \`${userEnergi}\``,
    ``,
    `   \`ՏYՏTᗴᗰ\``,
    `     ▸ 𝖡𝗈𝗍 𝖭𝖺𝗆𝖾    : \`${botConfig.bot?.name || "Bot"}\``,
    `     ▸ 𝖮𝗐𝗇𝖾𝗋       : \`${botConfig.owner?.name || "Owner"}\``,
    `     ▸ 𝖵𝖾𝗋𝗌𝗂𝗈𝗇     : \`v${botConfig.bot?.version || "1.0.0"}\``,
    `     ▸ 𝖣𝖺𝗍𝖺𝖻𝖺𝗌𝖾    : \`${db?.engine || "SQLite"}\``,
    `     ▸ 𝖳𝗈𝗍𝖺𝗅 𝖥𝖾𝖺𝗍𝗎𝗋𝖾 : \`${totalCmds}\``,
    `     ▸ 𝖳𝗂𝗆𝖾        : \`${jam} WITA\``,
    `     ▸ 𝖠𝖼𝗍𝗂𝗏𝖾 𝗌𝗂𝗇𝖼𝖾 : \`${formatUptime(process.uptime() * 1000)}\``,
    ``,
    bodyText,
    ``,
    `> Enjoy the bot's features`,
  ].join("\n");

  const ownerNum = String(
    Array.isArray(botConfig.owner?.number) ? botConfig.owner.number[0] : (botConfig.owner?.number || ""),
  ).replace(/[^0-9]/g, "");

  const msg = generateWAMessageFromContent(
    m.chat,
    {
      interactiveMessage: {
        header: {
          hasMediaAttachment: true,
          ...(media ? { imageMessage: media.imageMessage } : {}),
        },
        body: { text: _s16Banner(botConfig) },
        footer: { text: footer },
        nativeFlowMessage: {
          buttons,
          messageParamsJson: JSON.stringify({
            limited_time_offer: {
              text: priceTag,
              url: `https://wa.me/${ownerNum}`,
              copy_code: botConfig.bot?.name || "Bot",
            },
          }),
        },
        contextInfo: {
          participant: "0@s.whatsapp.net",
          remoteJid: "status@broadcast",
          quotedMessage: {
            contactMessage: {
              displayName: "🪸 lyniX's MD",
              vcard: "BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD",
            },
          },
          mentionedJid: [m.sender],
          forwardingScore: 1,
          isForwarded: true,
        },
      },
    },
    { userJid: sock.user.jid },
  );

  await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

// ===== Style 17 (listMessage + thumbnail + salam/banner di body + profil di footer) — dipakai allmenu v10 & menucat v8 =====
async function sendStyle17(sock, m, o) {
  const {
    botConfig, db, prefix, categoryRows = [], totalCmds = 0,
    imageBuffer, thumbBuffer, extraBody = "", heading = "Menu",
  } = o;

  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const jam = `${pad(now.getHours())}.${pad(now.getMinutes())}`;
  const hour = now.getHours();
  const salamWaktu =
    hour >= 4 && hour < 11 ? "Selamat pagi"
    : hour >= 11 && hour < 15 ? "Selamat siang"
    : hour >= 15 && hour < 18 ? "Selamat sore"
    : "Selamat malam";

  const botName = botConfig.bot?.name || "Bot";
  const saluranLink = botConfig.saluran?.link || "";

  const userData = db.getUser(m.sender) || {};
  const isVip = db.isVipActive
    ? db.isVipActive(m.sender)
    : (userData?.isVip && (!userData.vipExpired || userData.vipExpired === -1 || Date.now() < userData.vipExpired));
  const userRole = m.isOwner ? "Owner" : (isVip || m.isPremium) ? "Premium" : "Free User";
  const userEnergi = m.isOwner || m.isPremium || isVip ? "∞" : (userData.energi ?? 25);

  // Thumbnail diperkecil supaya ringan dipakai sebagai externalAdReply
  let thumbnail;
  const thumbRaw = getCachedAsset("ichigo") || imageBuffer || thumbBuffer || null;
  if (thumbRaw && thumbRaw.length > 0) {
    try {
      thumbnail = await getSharp()(thumbRaw).resize(640, 640, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
    } catch {
      thumbnail = thumbRaw;
    }
  }

  const banner = [
    `╭──────────────⊱⋆⊰──────────────╮`,
    `   ${_s16Sans(botName)} ${_s16Sans(heading)}`,
    `╰──────────────⊱⋆⊰──────────────╯`,
  ].join("\n");

  const salam = [
    `${salamWaktu}, @${m.sender.split("@")[0]}`,
    `Silakan pilih menu lewat tombol di bawah.`,
  ].join("\n");

  const description = [banner, "", salam, ...(extraBody ? ["", extraBody] : [])].join("\n");

  const footerText = [
    `╭─ ${_s16Bold("profil")}`,
    `│ ▸ ${_s16Sans("Nama")}   : ${m.pushName || "User"}`,
    `│ ▸ ${_s16Sans("Status")} : ${userRole}`,
    `│ ▸ ${_s16Sans("Limit")}  : ${userEnergi}`,
    `├─ ${_s16Bold("sistem")}`,
    `│ ▸ ${_s16Sans("Bot")}    : ${botName}`,
    `│ ▸ ${_s16Sans("Owner")}  : ${botConfig.owner?.name || "Owner"}`,
    `│ ▸ ${_s16Sans("Versi")}  : v${botConfig.bot?.version || "1.0.0"}`,
    `│ ▸ ${_s16Sans("Fitur")}  : ${totalCmds}`,
    `│ ▸ ${_s16Sans("Waktu")}  : ${jam} WITA`,
    `│ ▸ ${_s16Sans("Aktif")}  : ${formatUptime(process.uptime() * 1000)}`,
    `╰─ © ${botConfig.bot?.developer || botName}`,
  ].join("\n");

  const sections = [
    {
      title: _s16Bold("menu utama"),
      rows: [
        { title: toSC("all features"), description: toSC(`show all ${totalCmds} bot commands`), rowId: `${prefix}allmenu` },
        { title: toSC("my profile"), description: toSC("view your account stats"), rowId: `${prefix}profile` },
        { title: toSC("bot guide"), description: toSC("how to use the bot"), rowId: `${prefix}guide` },
        { title: toSC("owner contact"), description: toSC("developer contact info"), rowId: `${prefix}owner` },
      ],
    },
  ];
  if (categoryRows.length) {
    sections.push({
      title: _s16Bold("kategori fitur"),
      rows: categoryRows.map((r) => ({ title: r.title, description: r.description, rowId: r.id })),
    });
  }
  sections.push({
    title: _s16Bold("dukungan"),
    rows: [{ title: toSC("donate"), description: toSC("support bot development"), rowId: `${prefix}donasi` }],
  });

  const msg = generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          listMessage: {
            title: `✦ ${botName.toUpperCase()} ✦`,
            description,
            buttonText: "Buka Menu",
            listType: 1,
            sections,
            footerText,
            contextInfo: {
              mentionedJid: [m.sender],
              externalAdReply: {
                title: botName,
                body: `Owner: ${botConfig.owner?.name || "Owner"}`,
                mediaType: 1,
                renderLargerThumbnail: true,
                showAdAttribution: false,
                ...(thumbnail ? { thumbnail } : {}),
                ...(saluranLink ? { sourceUrl: saluranLink } : {}),
              },
            },
          },
        },
      },
    },
    { userJid: sock.user.jid },
  );

  await sock.relayMessage(m.chat, msg.message, {
    messageId: msg.key.id,
    additionalNodes: [
      {
        tag: "biz",
        attrs: {},
        content: [{ tag: "list", attrs: { v: "2", type: "product_list" } }],
      },
    ],
  });
}

async function menucatHandler(m, { sock, db }) {
  const prefix = config.command?.prefix || ".";
  const args = m.args || [];
  const categoryArg = args[0]?.toLowerCase();
  const categories = getCategories();
  const commandsByCategory = getCommandsByCategory();
  const casesByCategory = getCasesByCategory();
  const savedVariant = db.setting("menucatVariant");
  const menucatVariant = savedVariant || config.ui?.menucatVariant || 2;
  const saluranId = config.saluran?.id || "120363409557700746@newsletter";
  const saluranName = config.saluran?.name || config.bot?.name || "lyniX's MD";
  const saluranLink = config.saluran?.link || "";
  const botName = config.bot?.name || "lyniX's MD";
  const imagePath = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  let imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
  let thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : null;
  const greeting = getTimeGreeting();

  const _s16Order = [
    "owner", "main", "utility", "tools", "fun", "game", "download",
    "search", "sticker", "media", "ai", "group", "religi", "info",
    "cek", "economy", "user", "canvas", "random", "premium",
    "jpm", "pushkontak", "panel", "ephoto", "store",
  ];
  const getVisibleCatsS16 = () => {
    const groupData = m.isGroup ? db.getGroup(m.chat) || {} : {};
    const botMode = groupData.botMode || "md";
    let exMap = {
      md: ["panel", "pushkontak", "store"],
      store: ["panel", "pushkontak", "jpm", "ephoto", "cpanel"],
      pushkontak: ["panel", "store", "jpm", "ephoto", "cpanel"],
      cpanel: ["pushkontak", "store", "jpm", "ephoto"],
    };
    try {
      if (botmodePlugin && botmodePlugin.MODES) {
        exMap = {};
        for (const [key, val] of Object.entries(botmodePlugin.MODES)) {
          if (val.excludeCategories) exMap[key] = val.excludeCategories;
        }
      }
    } catch (e) {}
    const excl = exMap[botMode] || exMap.md || [];
    return [...new Set([...categories, ...Object.keys(casesByCategory)])]
      .sort((a, b) => {
        const ia = _s16Order.indexOf(a);
        const ib = _s16Order.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .filter((cat) => {
        if (cat === "owner" && !m.isOwner) return false;
        if (excl.includes(cat.toLowerCase())) return false;
        return (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length > 0;
      });
  };
  const countAllS16 = () =>
    [...new Set([...categories, ...Object.keys(casesByCategory)])].reduce(
      (n, cat) => n + (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length,
      0,
    );
  const buildCatRowsS16 = (cats) =>
    cats.map((cat) => {
      const n = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length;
      return {
        title: `${CATEGORY_EMOJIS[cat] || "📁"} ${toSC(cat)}`,
        description: toSC(`${n} commands available`),
        id: `${prefix}menucat ${cat}`,
      };
    });

  function buildFullContextInfo(title, body) {
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
        title: title || "Kategori Menu",
        body: body || botName,
        sourceUrl: saluranLink,
        mediaType: 1,
        renderLargerThumbnail: false,
        thumbnail: thumbBuffer || cachedThumb,
      },
    };
  }

  if (!categoryArg) {
    const groupData = m.isGroup ? db.getGroup(m.chat) || {} : {};
    const botMode = groupData.botMode || "md";
    let modeExcludeMap = {
      md: ["panel", "pushkontak", "store"],
      store: ["panel", "pushkontak", "jpm", "ephoto", "cpanel"],
      pushkontak: ["panel", "store", "jpm", "ephoto", "cpanel"],
      cpanel: ["pushkontak", "store", "jpm", "ephoto"],
    };
    try {
      if (botmodePlugin && botmodePlugin.MODES) {
        const modes = botmodePlugin.MODES;
        modeExcludeMap = {};
        for (const [key, val] of Object.entries(modes)) {
          if (val.excludeCategories)
            modeExcludeMap[key] = val.excludeCategories;
        }
      }
    } catch (e) {}

    const excludeCategories = modeExcludeMap[botMode] || modeExcludeMap.md;

    let txt = `📂 *${toMonoUpperBold("DAFTAR KATEGORI")}*\n\n`;
    txt += `> Ketik \`${prefix}menucat <kategori>\`\n\n`;

    const categoryOrder = [
      "owner", "main", "utility", "tools", "fun", "game", "download",
      "search", "sticker", "media", "ai", "group", "religi", "info",
      "cek", "economy", "user", "canvas", "random", "premium",
      "jpm", "pushkontak", "panel", "ephoto", "store",
    ];

    const allCats = [
      ...new Set([...categories, ...Object.keys(casesByCategory)]),
    ];
    const sortedCats = allCats.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const visibleCats = sortedCats.filter((cat) => {
      if (cat === "owner" && !m.isOwner) return false;
      if (excludeCategories.includes(cat.toLowerCase())) return false;
      const total =
        (commandsByCategory[cat] || []).length +
        (casesByCategory[cat] || []).length;
      return total > 0;
    });

    txt += `╭─〔 📋 *KATEGORI* 〕───⬣\n`;
    for (const cat of visibleCats) {
      const pluginCmds = commandsByCategory[cat] || [];
      const caseCmds = casesByCategory[cat] || [];
      const totalCmds = pluginCmds.length + caseCmds.length;
      const emoji = CATEGORY_EMOJIS[cat] || "📁";
      txt += ` │ ${emoji} ${cat.toUpperCase()} │ \`${totalCmds}\` cmds\n`;
    }
    txt += `╰───────⬣\n\n`;
    txt += `_Contoh: \`${prefix}menucat tools\`_`;

    try {
      switch (menucatVariant) {
        case 1:
          return await m.reply(txt);
        case 2:
          return await sock.sendMessage(
            m.chat,
            {
              text: txt,
              contextInfo: buildFullContextInfo(
                "Daftar Kategori",
                `${visibleCats.length} kategori tersedia`,
              ),
            },
            { quoted: m },
          );
        case 3:
          if (imageBuffer) {
            return await sock.sendMessage(
              m.chat,
              {
                image: imageBuffer,
                caption: txt,
                contextInfo: buildFullContextInfo(
                  "Daftar Kategori",
                  `${visibleCats.length} kategori tersedia`,
                ),
              },
              { quoted: m },
            );
          }
          return await sock.sendMessage(
            m.chat,
            {
              text: txt,
              contextInfo: buildFullContextInfo(
                "Daftar Kategori",
                `${visibleCats.length} kategori tersedia`,
              ),
            },
            { quoted: m },
          );
        case 4: {
          const catRows = visibleCats.map((cat) => {
            const total =
              (commandsByCategory[cat] || []).length +
              (casesByCategory[cat] || []).length;
            const emoji = CATEGORY_EMOJIS[cat] || "📁";
            return {
              title: `${emoji} ${cat.toUpperCase()}`,
              description: `${total} commands`,
              id: `${prefix}menucat ${cat}`,
            };
          });
          const buttons = [
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "📂 ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ",
                sections: [{ title: "📋 PILIH KATEGORI", rows: catRows }],
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🏠 ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴍᴇɴᴜ",
                id: `${prefix}menu`,
              }),
            },
          ];
          const msg = generateWAMessageFromContent(
            m.chat,
            {
              viewOnceMessage: {
                message: {
                  messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                  },
                  interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({ text: txt }),
                    footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `© ${botName}` }),
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                      title: "📂 Daftar Kategori",
                      subtitle: `${visibleCats.length} kategori`,
                      hasMediaAttachment: false,
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons }),
                    contextInfo: buildFullContextInfo("Daftar Kategori", `${visibleCats.length} kategori tersedia`),
                  }),
                },
              },
            },
            { userJid: m.sender, quoted: m },
          );
          return await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
        }
        case 5: {
          const catRows5 = visibleCats.map((cat) => {
            const total =
              (commandsByCategory[cat] || []).length +
              (casesByCategory[cat] || []).length;
            const emo = CATEGORY_EMOJIS[cat] || "📁";
            return {
              title: `${emo} ${cat.toUpperCase()}`,
              description: `✦ ${total} commands tersedia`,
              id: `${prefix}menucat ${cat}`,
            };
          });
          const mid5 = Math.ceil(catRows5.length / 2);
          const totalCmds5 = visibleCats.reduce(
            (sum, cat) =>
              sum +
              (commandsByCategory[cat] || []).length +
              (casesByCategory[cat] || []).length,
            0,
          );
          
          const paramsJson5 = JSON.stringify({
            title: "✦ Pilih Kategori",
            sections: [
              { title: "✦ Kategori Utama", rows: catRows5.slice(0, mid5) },
              ...(catRows5.slice(mid5).length > 0
                ? [{ title: "✦ Kategori Lainnya", rows: catRows5.slice(mid5) }]
                : []),
            ],
          });
          
          const dashTxt =
            `╭─〔 📂 *DAFTAR KATEGORI* 〕───⬣\n` +
            visibleCats.map((cat) => {
              const total =
                (commandsByCategory[cat] || []).length +
                (casesByCategory[cat] || []).length;
              const emo = CATEGORY_EMOJIS[cat] || "📁";
              return ` │ ${emo} *${cat.toUpperCase()}* — \`${total}\` cmds`;
            }).join("\n") +
            `\n╰───────⬣\n\n` +
            `　　°𖥔 ˚ ⊹ . ˚ 🎐 ˚ . ⊹ ˚𖥔°\n` +
            `📊 *${totalCmds5}* commands dalam *${visibleCats.length}* kategori ⋆｡°✩\n` +
            `Pilih kategori dari tombol di bawah ini yaa~ 🌷`;

          const _now5 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam5 = `${String(_now5.getHours()).padStart(2, "0")}:${String(_now5.getMinutes()).padStart(2, "0")}`;
          const _t0_5 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
          const pingWA5 = Math.max(1, Date.now() - _t0_5);

          let thumb5 = thumbBuffer;
          if (thumbBuffer) {
            try {
              thumb5 = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
            } catch { thumb5 = thumbBuffer; }
          }

          try {
            await sock.relayMessage(
              m.chat,
              {
                buttonsMessage: {
                  buttons: [
                    {
                      buttonId: "kategori",
                      buttonText: { displayText: "☰ SELECT" },
                      type: 1,
                      nativeFlowInfo: {
                        name: "single_select",
                        paramsJson: paramsJson5,
                      },
                    },
                  ],
                  locationMessage: {
                    name: `──「 ${botName} 」──`,
                    address: `⏱ ◷ ${jam5} WITA  ·  ⌁ ${pingWA5}ms`,
                    jpegThumbnail: thumb5,
                  },
                  contentText: `Haii @${m.sender.split("@")[0]}\n📂 Daftar Kategori`,
                  footerText: dashTxt,
                  contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 7,
                    groupMentions: [],
                    statusAttributions: [],
                  },
                  headerType: 6,
                  messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                  },
                },
              },
              {},
            );
          } catch (err5) {
            console.error("[MenuCat V5] List error:", err5.message);
            return await sock.sendMessage(
              m.chat,
              {
                text: dashTxt,
                contextInfo: buildFullContextInfo("Daftar Kategori", `${visibleCats.length} kategori`),
              },
              { quoted: m },
            );
          }
          return;
        }
        case 6: {
          const catRowsV6 = visibleCats.map((cat) => {
            const total =
              (commandsByCategory[cat] || []).length +
              (casesByCategory[cat] || []).length;
            const emo = CATEGORY_EMOJIS[cat] || "📁";
            return {
              title: `${emo} ${cat.toUpperCase()}`,
              description: `✦ ${total} commands tersedia`,
              id: `${prefix}menucat ${cat}`,
            };
          });

          const chunkSize6 = 10;
          const catSections6 = [];
          for (let i = 0; i < catRowsV6.length; i += chunkSize6) {
            catSections6.push({
              title: i === 0 ? "📋 PILIH KATEGORI" : `📋 KATEGORI LANJUTAN ${Math.floor(i / chunkSize6) + 1}`,
              rows: catRowsV6.slice(i, i + chunkSize6),
            });
          }

          const paramsJson6 = JSON.stringify({
            title: "🪼 Pilih",
            sections: catSections6,
          });

          const totalCmds6 = visibleCats.reduce(
            (sum, cat) =>
              sum +
              (commandsByCategory[cat] || []).length +
              (casesByCategory[cat] || []).length,
            0,
          );

          const _now6 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam6 = `${String(_now6.getHours()).padStart(2, "0")}:${String(_now6.getMinutes()).padStart(2, "0")}`;
          const _t0_6 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
          const pingWA6 = Math.max(1, Date.now() - _t0_6);

          let thumb6 = thumbBuffer;
          if (thumbBuffer) {
            try {
              thumb6 = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
            } catch { thumb6 = thumbBuffer; }
          }

          const footerTxt6 =
            `╭──『 📂 *DAFTAR KATEGORI* 』──╮\n` +
            visibleCats.map((cat) => {
              const total =
                (commandsByCategory[cat] || []).length +
                (casesByCategory[cat] || []).length;
              const emo = CATEGORY_EMOJIS[cat] || "📁";
              return ` │ ${emo} *${cat.toUpperCase()}* — \`${total}\` cmds`;
            }).join("\n") +
            `\n╰──────────────────────╯\n\n` +
            `📊 *${totalCmds6}* commands dalam *${visibleCats.length}* kategori`;

          try {
            await sock.relayMessage(
              m.chat,
              {
                buttonsMessage: {
                  buttons: [
                    {
                      buttonId: "pilihan_menu",
                      buttonText: { displayText: "☰ Menu" },
                      type: 1,
                      nativeFlowInfo: {
                        name: "single_select",
                        paramsJson: paramsJson6,
                      },
                    },
                  ],
                  locationMessage: {
                    name: `──「 ${botName} 」──`,
                    address: `⏱ ◷ ${jam6} WITA  ·  ⌁ ${pingWA6}ms`,
                    jpegThumbnail: thumb6,
                  },
                  contentText: `ʜᴀʟᴏ, @${m.sender.split("@")[0]} ⋆｡⋆\n${toSC(greeting)} ☀️, sᴇᴍᴏɢᴀ ʜᴀʀɪᴍᴜ ᴍᴇɴʏᴇɴᴀɴɢᴋᴀɴ ☀️`,
                  footerText: footerTxt6,
                  contextInfo: {
                    mentionedJid: [m.sender],
                    isForwarded: true,
                    forwardingScore: 777,
                    groupMentions: [],
                    statusAttributions: [],
                  },
                  headerType: 6,
                  messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                  },
                },
              },
              {},
            );
          } catch (err6) {
            console.error("[MenuCat V6] List error:", err6.message);
            return await sock.sendMessage(
              m.chat,
              {
                text: footerTxt6,
                contextInfo: buildFullContextInfo("Daftar Kategori", `${visibleCats.length} kategori`),
              },
              { quoted: m },
            );
          }
          return;
        }
        case 7: {
          const rowsList7 = visibleCats.map((cat) => {
            const n = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length;
            return `${CATEGORY_EMOJIS[cat] || "📁"} ${toSC(cat)} : \`${n} cmds\``;
          });
          const bodyList7 = [
            _s16Box("📋", "daftar kategori", rowsList7),
            "",
            `> ${_s16Sans("Ketik")} \`${prefix}menucat <kategori>\``,
          ].join("\n");
          return await sendStyle16(sock, m, {
            botConfig: config,
            db,
            prefix,
            bodyText: bodyList7,
            categoryRows: buildCatRowsS16(visibleCats),
            totalCmds: countAllS16(),
            imageBuffer,
            thumbBuffer,
          });
        }
        case 8: {
          const rowsList8 = visibleCats.map((cat) => {
            const n = (commandsByCategory[cat] || []).length + (casesByCategory[cat] || []).length;
            return `${CATEGORY_EMOJIS[cat] || "📁"} ${toSC(cat)} : \`${n} cmds\``;
          });
          const extraList8 = [
            _s16Box("📋", "daftar kategori", rowsList8),
            "",
            `> ${_s16Sans("Ketik")} \`${prefix}menucat <kategori>\``,
          ].join("\n");
          return await sendStyle17(sock, m, {
            botConfig: config,
            db,
            prefix,
            categoryRows: buildCatRowsS16(visibleCats),
            totalCmds: countAllS16(),
            imageBuffer,
            thumbBuffer,
            extraBody: extraList8,
            heading: "Kategori",
          });
        }
        default:
          return await sock.sendMessage(
            m.chat,
            {
              text: txt,
              contextInfo: buildFullContextInfo("Daftar Kategori", `${visibleCats.length} kategori tersedia`),
            },
            { quoted: m },
          );
      }
    } catch (err) {
      console.error("[MenuCat] List error:", err.message);
      return await sock.sendMessage(
        m.chat,
        { text: txt, contextInfo: getContextInfo() },
        { quoted: m },
      );
    }
  }

  const allCategories = [
    ...new Set([...categories, ...Object.keys(casesByCategory)]),
  ];
  const matchedCat = allCategories.find((c) => c.toLowerCase() === categoryArg);

  if (!matchedCat) {
    await m.reply(
      `❌ *KATEGORI TIDAK DITEMUKAN*\n\n> Kategori \`${categoryArg}\` tidak ada.\n> Ketik \`${prefix}menucat\` untuk list kategori.`,
    );
    return false;
  }

  if (matchedCat === "owner" && !m.isOwner) {
    await m.reply(`❌ *AKSES DITOLAK*\n\n> Kategori ini hanya untuk owner.`);
    return false;
  }

  const pluginCommands = commandsByCategory[matchedCat] || [];
  const caseCommands = casesByCategory[matchedCat] || [];
  const allCommands = [...pluginCommands, ...caseCommands];

  if (allCommands.length === 0) {
    await m.reply(
      `❌ *KOSONG*\n\n> Kategori \`${matchedCat}\` tidak memiliki command.`,
    );
    return false;
  }

  const emoji = CATEGORY_EMOJIS[matchedCat] || "📁";
  let txt = `╭─〔 ${emoji} *${matchedCat.toUpperCase()}* 〕───⬣\n`;
  for (const cmd of allCommands) {
    txt += ` │ \`${prefix}${cmd}\`\n`;
  }
  txt += `╰───────⬣\n\n`;
  txt += `Total: \`${allCommands.length}\` commands\n`;
  if (caseCommands.length > 0) {
    txt += `(${pluginCommands.length} plugin + ${caseCommands.length} case)`;
  }

  try {
    switch (menucatVariant) {
      case 1:
        await m.reply(txt);
        break;
      case 2:
        await sock.sendMessage(
          m.chat,
          {
            text: txt,
            contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
          },
          { quoted: m },
        );
        break;
      case 3:
        if (imageBuffer) {
          await sock.sendMessage(
            m.chat,
            {
              image: imageBuffer,
              caption: txt,
              contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
            },
            { quoted: m },
          );
        } else {
          await sock.sendMessage(
            m.chat,
            {
              text: txt,
              contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
            },
            { quoted: m },
          );
        }
        break;
      case 4: {
        const cmdRows = allCommands.map((cmd) => ({
          title: `${prefix}${toSmallCaps(cmd)}`,
          description: `Command ${matchedCat}`,
          id: `${prefix}${cmd}`,
        }));
        const chunkSize = 10;
        const sections = [];
        for (let i = 0; i < cmdRows.length; i += chunkSize) {
          const chunk = cmdRows.slice(i, i + chunkSize);
          const partNum = Math.floor(i / chunkSize) + 1;
          sections.push({
            title: `${emoji} ${matchedCat.toUpperCase()} — Part ${partNum}`,
            rows: chunk,
          });
        }
        const buttons = [
          ...sections.map((sec) => ({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `${emoji} ᴘɪʟɪʜ ᴄᴏᴍᴍᴀɴᴅ`,
              sections: [sec],
            }),
          })),
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "✦ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴋᴀᴛᴇɢᴏʀɪ",
              id: `${prefix}menucat`,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "✦ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴍᴇɴᴜ",
              id: `${prefix}menu`,
            }),
          },
        ];
        const msg = generateWAMessageFromContent(
          m.chat,
          {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                  body: proto.Message.InteractiveMessage.Body.fromObject({ text: txt }),
                  footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `© ${botName}` }),
                  header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: `${emoji} ${matchedCat.toUpperCase()}`,
                    subtitle: `${allCommands.length} commands`,
                    hasMediaAttachment: false,
                  }),
                  nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons }),
                  contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
                }),
              },
            },
          },
          { userJid: m.sender, quoted: m },
        );
        await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
        break;
      }
      case 5: {
        const cmdRows5 = allCommands.map((cmd) => ({
          title: `${prefix}${cmd.toUpperCase()}`,
          description: `✦ Command ${matchedCat}`,
          id: `${prefix}${cmd}`,
        }));
        const chunkSize5 = 10;
        const sections5 = [];
        for (let i = 0; i < cmdRows5.length; i += chunkSize5) {
          const chunk = cmdRows5.slice(i, i + chunkSize5);
          const part = Math.floor(i / chunkSize5) + 1;
          const totalParts = Math.ceil(cmdRows5.length / chunkSize5);
          sections5.push({
            title: `${emoji} ${matchedCat.toUpperCase()}${totalParts > 1 ? ` (${part}/${totalParts})` : ""}`,
            rows: chunk,
          });
        }
        const buttons5d = [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `${emoji} Pilih Command`,
              sections: sections5,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "✦ Semua Kategori",
              id: `${prefix}menucat`,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "✦ Menu Utama",
              id: `${prefix}menu`,
            }),
          },
        ];
        const detailTxt =
          `╭─〔 ${emoji} *${matchedCat.toUpperCase()}* 〕───⬣\n` +
          allCommands.map((cmd) => ` │ \`${prefix}${cmd}\``).join("\n") +
          `\n╰───────⬣\n\n` +
          `✦ *${allCommands.length}* commands` +
          (caseCommands.length > 0
            ? ` _(${pluginCommands.length} plugin + ${caseCommands.length} case)_`
            : "") +
          `\n> Pilih command dari tombol di bawah`;
        try {
          await sock.sendMessage(
            m.chat,
            {
              interactiveMessage: {
                header: ``,
                title: `${emoji} 𝗞𝗮𝘁𝗲𝗴𝗼𝗿𝗶 ${matchedCat.toUpperCase()}`,
                footer: detailTxt,
                image: imageBuffer || undefined,
                contextInfo: {
                  mentionedJid: [m.sender],
                  forwardingScore: 7,
                  isForwarded: true,
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 999],
                      list_title: "Pilih Command",
                      button_title: "✦ Lihat Command",
                    },
                  }),
                  buttons: buttons5d,
                },
              },
            },
            { quoted: m },
          );
        } catch (err5) {
          console.error("[MenuCat V5] Detail error:", err5.message);
          await sock.sendMessage(
            m.chat,
            {
              text: detailTxt,
              contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
            },
            { quoted: m },
          );
        }
        break;
      }
      case 6: {
        const cmdRows6 = allCommands.map((cmd) => ({
          title: `${prefix}${cmd.toUpperCase()}`,
          description: `✦ Command ${matchedCat}`,
          id: `${prefix}${cmd}`,
        }));
        const chunkSize6b = 10;
        const sections6b = [];
        for (let i = 0; i < cmdRows6.length; i += chunkSize6b) {
          const chunk = cmdRows6.slice(i, i + chunkSize6b);
          const part = Math.floor(i / chunkSize6b) + 1;
          const totalParts = Math.ceil(cmdRows6.length / chunkSize6b);
          sections6b.push({
            title: `${emoji} ${matchedCat.toUpperCase()}${totalParts > 1 ? ` (${part}/${totalParts})` : ""}`,
            rows: chunk,
          });
        }
        const paramsJson6b = JSON.stringify({
          title: "🪼 Pilihan Menu",
          sections: sections6b,
        });

        const _now6b = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jam6b = `${String(_now6b.getHours()).padStart(2, "0")}:${String(_now6b.getMinutes()).padStart(2, "0")}`;
        const _t0_6b = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
        const pingWA6b = Math.max(1, Date.now() - _t0_6b);

        let thumb6b = thumbBuffer;
        if (thumbBuffer) {
          try {
            thumb6b = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
          } catch { thumb6b = thumbBuffer; }
        }

        const footerTxt6b =
          `╭──『 ${emoji} *${matchedCat.toUpperCase()}* 』──╮\n` +
          allCommands.map((cmd) => ` │ \`${prefix}${cmd}\``).join("\n") +
          `\n╰──────────────────────╯\n\n` +
          `✦ *${allCommands.length}* commands` +
          (caseCommands.length > 0
            ? ` _(${pluginCommands.length} plugin + ${caseCommands.length} case)_`
            : "");

        try {
          await sock.relayMessage(
            m.chat,
            {
              buttonsMessage: {
                buttons: [
                  {
                    buttonId: "pilihan_menu",
                    buttonText: { displayText: "☰ Pilihan Menu" },
                    type: 1,
                    nativeFlowInfo: {
                      name: "single_select",
                      paramsJson: paramsJson6b,
                    },
                  },
                ],
                locationMessage: {
                  name: `──「 ${botName} 」──`,
                  address: `⏱ ◷ ${jam6b} WITA  ·  ⌁ ${pingWA6b}ms`,
                  jpegThumbnail: thumb6b,
                },
                contentText: `ʜᴀʟᴏ, @${m.sender.split("@")[0]} ⋆｡⋆\n${toSC(getTimeGreeting())} ☀️, sᴇᴍᴏɢᴀ ʜᴀʀɪᴍᴜ ᴍᴇɴʏᴇɴᴀɴɢᴋᴀɴ ☀️`,
                footerText: footerTxt6b,
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 777,
                  groupMentions: [],
                  statusAttributions: [],
                },
                headerType: 6,
                messageContextInfo: {
                  deviceListMetadata: {},
                  deviceListMetadataVersion: 2,
                },
              },
            },
            {},
          );
        } catch (err6b) {
          console.error("[MenuCat V6] Detail error:", err6b.message);
          await sock.sendMessage(
            m.chat,
            {
              text: footerTxt6b,
              contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
            },
            { quoted: m },
          );
        }
        break;
      }
      case 7: {
        const bodyDetail7 = [
          _s16Box(emoji, matchedCat, allCommands.map((cmd) => `\`${prefix}${cmd}\``)),
          "",
          `> ${_s16Sans("Total")}: \`${allCommands.length}\` ${_s16Sans("commands")}` +
            (caseCommands.length > 0 ? ` (${pluginCommands.length} plugin + ${caseCommands.length} case)` : ""),
        ].join("\n");
        await sendStyle16(sock, m, {
          botConfig: config,
          db,
          prefix,
          bodyText: bodyDetail7,
          categoryRows: buildCatRowsS16(getVisibleCatsS16()),
          totalCmds: countAllS16(),
          imageBuffer,
          thumbBuffer,
        });
        break;
      }
      case 8: {
        const extraDetail8 = [
          _s16Box(emoji, matchedCat, allCommands.map((cmd) => `\`${prefix}${cmd}\``)),
          "",
          `> ${_s16Sans("Total")}: \`${allCommands.length}\` ${_s16Sans("commands")}` +
            (caseCommands.length > 0 ? ` (${pluginCommands.length} plugin + ${caseCommands.length} case)` : ""),
        ].join("\n");
        await sendStyle17(sock, m, {
          botConfig: config,
          db,
          prefix,
          categoryRows: buildCatRowsS16(getVisibleCatsS16()),
          totalCmds: countAllS16(),
          imageBuffer,
          thumbBuffer,
          extraBody: extraDetail8,
          heading: matchedCat,
        });
        break;
      }
      default:
        await sock.sendMessage(
          m.chat,
          {
            text: txt,
            contextInfo: buildFullContextInfo(`${emoji} ${matchedCat}`, `${allCommands.length} commands`),
          },
          { quoted: m },
        );
    }
  } catch (err) {
    console.error("[MenuCat] Detail error:", err.message);
    await sock.sendMessage(
      m.chat,
      { text: txt, contextInfo: getContextInfo() },
      { quoted: m },
    );
  }
}

async function handler(m, ctx) {
  const result = await menucatHandler(m, ctx);
  // false = jalur error (kategori tidak ada / akses ditolak / kosong): jangan tempel stiker.
  if (result === false) return result;
  await attachMenuSticker(ctx.sock, m, config);
  return result;
}

export { pluginConfig as config, handler };