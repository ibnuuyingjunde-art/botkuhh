import * as botmodePlugin from "../group/botmode.js";
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from "ichigo";
import { sharp as _sharp } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import {
  formatUptime,
  getTimeGreeting,
} from "../../src/lib/ichigo-formatter.js";
import {
  getCommandsByCategory,
  getCategories,
  getPluginCount,
  getPlugin,
  getPluginsByCategory,
} from "../../src/lib/ichigo-plugins.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getCasesByCategory, getCaseCount } from "../../case/ichigo.js";
import { getAssetBuffer as getCachedAsset } from "../../src/lib/ichigo-asset-manager.js";
import fs from "fs";
import path from "path";
import { attachMenuSticker } from "../../src/lib/ichigo-sticker-annotation.js";

function getSharp() {
  return _sharp;
}

const pluginConfig = {
  name: "allmenu",
  alias: ["fullmenu", "am", "allcommand", "semua", "v", "vip"],
  category: "main",
  description: "Menampilkan semua command lengkap per kategori",
  usage: ".allmenu",
  example: ".allmenu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  isBotAdmin: false,
  cooldown: 5,
  energi: 0,
  limit: 0,
  isEnabled: true,
};

const CATEGORY_EMOJIS = {
  owner: "୨ৎ",
  main: "୨ৎ",
  utility: "୨ৎ",
  fun: "୨ৎ",
  group: "୨ৎ",
  download: "୨ৎ",
  search: "୨ৎ",
  tools: "୨ৎ",
  sticker: "୨ৎ",
  ai: "୨ৎ",
  game: "୨ৎ",
  media: "୨ৎ",
  info: "୨ৎ",
  religi: "୨ৎ",
  panel: "୨ৎ",
  user: "୨ৎ",
  linode: "୨ৎ",
  random: "୨ৎ",
  canvas: "୨ৎ",
  vps: "୨ৎ",
  store: "୨ৎ",
  premium: "୨ৎ",
  convert: "୨ৎ",
  economy: "୨ৎ",
  cek: "୨ৎ",
  ephoto: "୨ৎ",
  jpm: "୨ৎ",
  pushkontak: "୨ৎ",
};

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

function toSmallCaps(text) {
  return text.toUpperCase();
}

function createBracketBox(emoji, title, lines = []) {
  const header = `『 ${emoji} ${title} 』`;
  const top = `╭──${header}──╮`;
  const barLength = Math.max([...top].length - 2, 10);
  let text = `${top}\n`;
  for (const line of lines) {
    text += `│ • ${line}\n`;
  }
  text += `╰${"─".repeat(barLength)}╯\n\n`;
  return text;
}

function createBracketBoxSC(emoji, title, lines = []) {
  const header = `『 ${emoji} ${toSC(title)} 』`;
  const top = `╭──${header}──╮`;
  const barLength = Math.max([...top].length - 2, 10);
  let text = `${top}\n`;
  for (const line of lines) {
    text += `│ • ${line}\n`;
  }
  text += `╰${"─".repeat(barLength)}╯\n\n`;
  return text;
}

function getCommandSymbols(cmdName) {
  const plugin = getPlugin(cmdName);
  if (!plugin || !plugin.config) return "";
  const symbols = [];
  if (plugin.config.isOwner) symbols.push("Ⓞ");
  if (plugin.config.isPremium) symbols.push("ⓟ");
  if (plugin.config.limit && plugin.config.limit > 0) symbols.push("Ⓛ");
  if (plugin.config.isAdmin) symbols.push("Ⓐ");
  return symbols.length > 0 ? " " + symbols.join(" ") : "";
}

function getContextInfo(botConfig, m, thumbBuffer) {
  const saluranId = botConfig.saluran?.id || "120363409557700746@newsletter";
  const saluranName = botConfig.saluran?.name || botConfig.bot?.name || "lyniX's MD";
  const saluranLink = botConfig.saluran?.link || "";
  return {
    mentionedJid: [m.sender],
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
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

async function allmenuHandler(m, { sock, config: botConfig, db, uptime }) {
  const prefix = botConfig.command?.prefix || ".";
  const user = db.getUser(m.sender);
  const groupData = m.isGroup ? db.getGroup(m.chat) || {} : {};
  const botMode = groupData.botMode || "md";
  const categories = getCategories();
  const commandsByCategory = getCommandsByCategory();
  const casesByCategory = getCasesByCategory();

  let totalCommands = 0;
  for (const category of categories) {
    totalCommands += (commandsByCategory[category] || []).length;
  }
  const totalCases = getCaseCount();
  const totalFeatures = totalCommands + totalCases;

  let userRole = "User", roleEmoji = "👤";
  if (m.isOwner) { userRole = "Owner"; roleEmoji = "👑"; }
  else if (m.isPremium) { userRole = "Premium"; roleEmoji = "💎"; }

  const greeting = getTimeGreeting();

  const greetingHeader = `✦ ʜᴇʏ, @${m.pushName || "User"}! 🪸\nᴀsɪᴋ ʙᴀɴɢᴇᴛ ᴋᴀᴍᴜ ᴅᴀᴛᴇɴɢ~ ɪɴɪ ${botConfig.bot?.name || "lyniX's MD"}, ᴛᴇᴍᴇɴ sᴇᴛɪᴀ ᴋᴀᴍᴜ ᴅɪ ᴡʜᴀᴛsᴀᴘᴘ ʏᴀɴɢ sɪᴀᴘ ᴏɴ 24/7 ᴛᴀɴᴘᴀ ᴄᴀᴘᴇᴋ.\nʏᴜᴋ ʟɪʜᴀᴛ-ʟɪʜᴀᴛ ꜰɪᴛᴜʀɴʏᴀ, sɪᴀᴘᴀ ᴛᴀᴜ ᴀᴅᴀ ʏᴀɴɢ ʟᴀɴɢsᴜɴɢ ʙɪᴋɪɴ ᴋᴀᴍᴜ sᴜᴋᴀ! 🎉\n\n`;
  // txtBody = konten menu tanpa baris salam (dipakai di case yang salamnya
  // sudah ditampilkan terpisah di contentText, biar gak dobel)
  let txtBody = createBracketBox("🤖", "KETERANGAN", [
    "Ⓞ = Khusus Owner",
    "ⓟ = Khusus Premium",
    "Ⓥ = Khusus VIP",
    "Ⓛ = Butuh Limit",
    "Ⓐ = Khusus Admin",
  ]);

  const categoryOrder = [
    "owner", "main", "utility", "tools", "fun", "game", "download",
    "search", "sticker", "media", "ai", "group", "religi", "info",
    "cek", "economy", "user", "canvas", "random", "premium",
  ];

  const sortedCategories = [...categories].sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  let modeAllowedMap = {
    md: null,
    store: ["main", "group", "sticker", "owner", "store"],
    pushkontak: ["main", "group", "sticker", "owner", "pushkontak"],
  };
  let modeExcludeMap = {
    md: ["panel", "pushkontak", "store"],
    store: null,
    pushkontak: null,
  };

  try {
    if (botmodePlugin && botmodePlugin.MODES) {
      const modes = botmodePlugin.MODES;
      modeAllowedMap = {};
      modeExcludeMap = {};
      for (const [key, val] of Object.entries(modes)) {
        modeAllowedMap[key] = val.allowedCategories;
        modeExcludeMap[key] = val.excludeCategories;
      }
    }
  } catch (e) {}

  const allowedCategories = modeAllowedMap[botMode];
  const excludeCategories = modeExcludeMap[botMode] || [];

  for (const category of sortedCategories) {
    if (category === "owner" && !m.isOwner) continue;
    if (allowedCategories && !allowedCategories.includes(category.toLowerCase())) continue;
    if (excludeCategories && excludeCategories.includes(category.toLowerCase())) continue;
    const pluginCmds = commandsByCategory[category] || [];
    const caseCmds = casesByCategory[category] || [];
    const allCmds = [...pluginCmds, ...caseCmds];
    if (allCmds.length === 0) continue;
    const emoji = CATEGORY_EMOJIS[category] || "📋";
    const categoryName = toSmallCaps(category);
    const commandLines = allCmds.map((cmd) => {
      const symbols = getCommandSymbols(cmd);
      return `${prefix}${cmd}${symbols}`;
    });
    txtBody += createBracketBox(emoji, categoryName, commandLines);
  }

  txtBody += `\n✦ © ${botConfig.bot?.name || "lyniX's MD"} ${new Date().getFullYear()} — All Rights Reserved\n`;
  txtBody += `✦ ᴅᴇᴠᴇʟᴏᴘᴇʀ: ${botConfig.bot?.developer || "Kazee"} • ᴅɪʙᴜᴀᴛ ᴅᴇɴɢᴀɴ ❤️`;

  const txt = greetingHeader + txtBody;

  const imagePath = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  let imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
  let thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : null;

  const savedVariant = db.setting("allmenuVariant");
  const allmenuVariant = savedVariant || botConfig.ui?.allmenuVariant || 2;

  const saluranId = botConfig.saluran?.id || "120363409557700746@newsletter";
  const saluranName = botConfig.saluran?.name || botConfig.bot?.name || "lyniX's MD";
  const saluranLink = botConfig.saluran?.link || "";

  const fullContextInfo = {
    mentionedJid: [m.sender],
    forwardingScore: 9999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: saluranId,
      newsletterName: saluranName,
      serverMessageId: 127,
    },
    externalAdReply: {
      title: botConfig.bot?.name || "lyniX's MD",
      body: `✦ Owner: ${botConfig.owner?.name || "Kazee"}`,
      sourceUrl: saluranLink,
      mediaType: 1,
      thumbnail: imageBuffer,
      renderLargerThumbnail: true,
    },
  };

  const filterCat = (cat) => {
    if (cat === "owner" && !m.isOwner) return false;
    if (allowedCategories && !allowedCategories.includes(cat.toLowerCase())) return false;
    if (excludeCategories && excludeCategories.includes(cat.toLowerCase())) return false;
    const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
    return cmds.length > 0;
  };

  const usedAlias = (m.body || "").trim().slice(prefix.length).split(/\s+/)[0]?.toLowerCase();
  const isVipVariant = usedAlias === "v" || usedAlias === "vip";

  if (isVipVariant) {
    const vipCategories = ["premium", "owner", "economy", "user"];

    let txtV = `✦ ʜᴇʏ @${m.pushName || "User"}! ʙᴇʀᴀᴅᴀ ᴅɪ ᴢᴏɴᴀ ᴇᴋsᴋʟᴜsɪꜰ — ɪɴɪ ᴅᴀꜰᴛᴀʀ ꜰɪᴛᴜʀ ʟᴇɴɢᴋᴀᴘ ʙᴜᴀᴛ ᴋᴀᴍᴜ! 👑\n\n`;

    txtV += createBracketBox("💎", "VIP ACCESS", [
      "Ⓞ = Khusus Owner",
      "ⓟ = Khusus Premium",
      "Ⓥ = Khusus VIP",
      "Ⓛ = Butuh Limit",
      "Ⓐ = Khusus Admin",
      "⭐ = Fitur Eksklusif VIP",
    ]);

    const vipSortedCats = [...categories].filter((cat) => {
      if (cat === "owner" && !m.isOwner) return false;
      const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
      return cmds.length > 0;
    });

    const vipFirst = vipSortedCats.filter((c) => vipCategories.includes(c));
    const vipRest = vipSortedCats.filter((c) => !vipCategories.includes(c));
    const vipOrdered = [...vipFirst, ...vipRest];

    for (const category of vipOrdered) {
      if (allowedCategories && !allowedCategories.includes(category.toLowerCase())) continue;
      if (excludeCategories && excludeCategories.includes(category.toLowerCase())) continue;
      const pluginCmds = commandsByCategory[category] || [];
      const caseCmds = casesByCategory[category] || [];
      const allCmds = [...pluginCmds, ...caseCmds];
      if (allCmds.length === 0) continue;
      const emoji = CATEGORY_EMOJIS[category] || "📋";
      const isVipCat = vipCategories.includes(category);
      const categoryLabel = `${isVipCat ? "⭐ " : ""}${toSmallCaps(category)}`;
      const commandLines = allCmds.map((cmd) => {
        const symbols = getCommandSymbols(cmd);
        return `${prefix}${cmd}${symbols}`;
      });
      txtV += createBracketBox(isVipCat ? "💎" : emoji, categoryLabel, commandLines);
    }

    txtV += `\n✦ © ${botConfig.bot?.name || "lyniX's MD"} ${new Date().getFullYear()} — VIP Zone\n`;
    txtV += `✦ ᴅᴇᴠᴇʟᴏᴘᴇʀ: ${botConfig.bot?.developer || "Kazee"} • ᴅɪʙᴜᴀᴛ ᴅᴇɴɢᴀɴ ❤️`;

    const vipContextInfo = {
      mentionedJid: [m.sender],
      forwardingScore: 9999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: saluranId,
        newsletterName: saluranName,
        serverMessageId: 127,
      },
      externalAdReply: {
        title: `💎 VIP ZONE — ${botConfig.bot?.name || "lyniX's MD"}`,
        body: `✦ Owner: ${botConfig.owner?.name || "Kazee"}`,
        sourceUrl: saluranLink,
        mediaType: 1,
        thumbnail: imageBuffer,
        renderLargerThumbnail: true,
      },
    };

    try {
      if (imageBuffer) {
        await sock.sendMessage(m.chat, { image: imageBuffer, caption: txtV, contextInfo: vipContextInfo }, { quoted: m });
      } else {
        await sock.sendMessage(m.chat, { text: txtV, contextInfo: vipContextInfo }, { quoted: m });
      }
    } catch (e) {
      await m.reply(txtV);
    }

    const audioPath = path.join(process.cwd(), "assets", "audio", "allmenu.mp3");
    try {
      if (fs.existsSync(audioPath)) {
        await sock.sendMessage(m.chat, { audio: fs.readFileSync(audioPath), mimetype: "audio/mpeg", ptt: false }, { quoted: m });
      }
    } catch {}
    return;
  }

  try {
    switch (allmenuVariant) {
      case 1:
        await m.reply(txt);
        break;

      case 2:
        if (imageBuffer) {
          await sock.sendMessage(m.chat, { image: imageBuffer, caption: txt, contextInfo: fullContextInfo }, { quoted: m });
        } else {
          await sock.sendMessage(m.chat, { text: txt, contextInfo: fullContextInfo }, { quoted: m });
        }
        break;

      case 3: {
        let resizedThumb = thumbBuffer;
        if (thumbBuffer) {
          try {
            resizedThumb = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
          } catch { resizedThumb = thumbBuffer; }
        }
        await sock.sendMessage(
          m.chat,
          {
            document: imageBuffer || Buffer.from(""),
            mimetype: "image/png",
            fileLength: 999999999999,
            fileSize: 999999999999,
            fileName: `${toSmallCaps(botConfig.bot?.name || "lyniX's MD")} — ᴀʟʟ ᴍᴇɴᴜ`,
            caption: txt,
            jpegThumbnail: resizedThumb,
            contextInfo: fullContextInfo,
          },
          { quoted: m },
        );
        break;
      }

      case 4: {
        const categoryRows = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return { title: `${emoji} ${toSmallCaps(cat)}`, description: `${cmds.length} commands`, id: `${prefix}menucat ${cat}` };
        });

        const buttons = [
          { name: "single_select", buttonParamsJson: JSON.stringify({ title: "🪼 ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ", sections: [{ title: "📋 PILIH KATEGORI", rows: categoryRows }] }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏠 ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴍᴇɴᴜ ᴜᴛᴀᴍᴀ", id: `${prefix}menu` }) },
        ];

        let headerMedia = null;
        if (imageBuffer) {
          try { headerMedia = await prepareWAMessageMedia({ image: imageBuffer }, { upload: sock.waUploadToServer }); } catch {}
        }

        const msg = generateWAMessageFromContent(
          m.chat,
          {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                  body: proto.Message.InteractiveMessage.Body.fromObject({ text: txt }),
                  footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `© ${botConfig.bot?.name || "lyniX's MD"}` }),
                  header: proto.Message.InteractiveMessage.Header.fromObject({ title: botConfig.bot?.name || "lyniX's MD", hasMediaAttachment: !!headerMedia, ...(headerMedia || {}) }),
                  nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons }),
                  contextInfo: fullContextInfo,
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
        const catRowsV5 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return { title: `${emoji} ${toSmallCaps(cat)}`, description: `${cmds.length} commands tersedia`, id: `${prefix}menucat ${cat}` };
        });

        const zantonV5 = [
          { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
          { name: "inapp_signup", buttonParamsJson: "{}" },
          { name: "single_select", buttonParamsJson: JSON.stringify({ title: "🪼 Pilih Kategori Menu", sections: [{ title: "📋 PILIH KATEGORI", rows: catRowsV5 }], has_multiple_buttons: true }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🪼 Lihat Semua Menu", id: `${prefix}allmenu` }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏠 Kembali Ke Menu Utama", id: `${prefix}menu` }) },
        ];

        await sock.sendMessage(
          m.chat,
          {
            interactiveMessage: {
              header: ``,
              title: txt,
              footer: ``,
              image: imageBuffer || thumbBuffer,
              contextInfo: { mentionedJid: [m.sender], forwardingScore: 777, isForwarded: true },
              nativeFlowMessage: {
                messageParamsJson: JSON.stringify({
                  limited_time_offer: { text: `🌿 Halo ${m.pushName}!`, url: "https://ichigo.site", copy_code: "", expiration_time: null },
                  bottom_sheet: { in_thread_buttons_limit: 2, divider_indices: [1, 2, 3, 4, 5, 999], list_title: "Pilih menu yang kamu mau", button_title: "🪼 Tap Di Sini" },
                  tap_target_configuration: { title: " X ", description: botConfig.bot?.name || "lyniX's MD", canonical_url: "https://ichigo.site", domain: "ichigo.site", button_index: 0 },
                }),
                buttons: zantonV5,
              },
            },
          },
          { quoted: m },
        );
        break;
      }

      case 6: {
        const catRowsV6 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return { title: `${emoji} ${toSmallCaps(cat)}`, description: `${cmds.length} commands tersedia`, id: `${prefix}menucat ${cat}` };
        });

        const chunkSize = 10;
        const catSections = [];
        for (let i = 0; i < catRowsV6.length; i += chunkSize) {
          catSections.push({
            title: i === 0 ? "📋 PILIH KATEGORI" : `📋 KATEGORI LANJUTAN ${Math.floor(i / chunkSize) + 1}`,
            rows: catRowsV6.slice(i, i + chunkSize),
          });
        }

        const buttons6 = [
          { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
          { name: "inapp_signup", buttonParamsJson: "{}" },
          { name: "single_select", buttonParamsJson: JSON.stringify({ title: "🪼 Pilih Kategori Menu", sections: catSections, has_multiple_buttons: true }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🪼 Lihat Semua Menu", id: `${prefix}allmenu` }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏠 Kembali Ke Menu Utama", id: `${prefix}menu` }) },
        ];

        await sock.sendMessage(
          m.chat,
          {
            interactiveMessage: {
              header: ``,
              title: txt,
              footer: ``,
              image: imageBuffer || thumbBuffer,
              contextInfo: { mentionedJid: [m.sender], forwardingScore: 777, isForwarded: true },
              nativeFlowMessage: {
                messageParamsJson: JSON.stringify({
                  limited_time_offer: { text: `🌿 Halo ${m.pushName}!`, url: "https://ichigo.site", copy_code: "", expiration_time: null },
                  bottom_sheet: { in_thread_buttons_limit: 2, divider_indices: [1, 2, 3, 4, 5, 999], list_title: "✦ Pilih kategori yang kamu mau", button_title: "🪼 Tap Di Sini" },
                  tap_target_configuration: { title: " X ", description: botConfig.bot?.name || "lyniX's MD", canonical_url: "https://ichigo.site", domain: "ichigo.site", button_index: 0 },
                }),
                buttons: buttons6,
              },
            },
          },
          { quoted: m },
        );
        break;
      }

      case 7: {
        let txt7 = createBracketBoxSC("🤖", "KETERANGAN", [
          `Ⓞ = ${toSC("Khusus Owner")}`,
          `ⓟ = ${toSC("Khusus Premium")}`,
          `Ⓥ = ${toSC("Khusus VIP")}`,
          `Ⓛ = ${toSC("Butuh Limit")}`,
          `Ⓐ = ${toSC("Khusus Admin")}`,
        ]);

        for (const category of sortedCategories) {
          if (!filterCat(category)) continue;
          const pluginCmds = commandsByCategory[category] || [];
          const caseCmds = casesByCategory[category] || [];
          const allCmds = [...pluginCmds, ...caseCmds];
          if (allCmds.length === 0) continue;
          const emoji = CATEGORY_EMOJIS[category] || "📋";
          const commandLines = allCmds.map((cmd) => {
            const symbols = getCommandSymbols(cmd);
            return `${toSC(prefix + cmd)}${symbols}`;
          });
          txt7 += createBracketBoxSC(emoji, category, commandLines);
        }

        txt7 += `\n　　⊹ ࣪˖ ⋆｡˚ 𝜗𝜚˚｡⋆ ࣪˖ ⊹\n`;
        txt7 += `✦ © ${toSC(botConfig.bot?.name || "lyniX's MD")} ${new Date().getFullYear()} — ${toSC("all rights reserved")} ✦\n`;
        txt7 += `✧ ${toSC("developer")}: ${toSC(botConfig.bot?.developer || "Kazee")} • ${toSC("dibuat dengan")} ❤️ ✧\n`;
        txt7 += `　　⊹ ࣪˖ ⋆｡˚ 𝜗𝜚˚｡⋆ ࣪˖ ⊹`;

        const catRowsV7 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return {
            title: `${emoji} ${toSC(cat)}`,
            description: `${toSC(`${cmds.length} perintah tersedia`)}`,
            id: `${prefix}menucat ${cat}`,
          };
        });

        const chunkSize7 = 10;
        const catSections7 = [];
        for (let i = 0; i < catRowsV7.length; i += chunkSize7) {
          catSections7.push({
            title: i === 0
              ? `📋 ${toSC("pilih kategori")}`
              : `📋 ${toSC(`kategori lanjutan ${Math.floor(i / chunkSize7) + 1}`)}`,
            rows: catRowsV7.slice(i, i + chunkSize7),
          });
        }

        const paramsJson7 = JSON.stringify({
          title: `✦ ${toSC("pilih kategori menu")}`,
          sections: catSections7,
        });

        const _now7 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jam7 = `${String(_now7.getHours()).padStart(2, "0")}:${String(_now7.getMinutes()).padStart(2, "0")}`;
        const _t0_7 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
        const pingWA7 = Math.max(1, Date.now() - _t0_7);

        let thumb7 = thumbBuffer;
        if (thumbBuffer) {
          try {
            thumb7 = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
          } catch { thumb7 = thumbBuffer; }
        }

        await sock.relayMessage(
          m.chat,
          {
            buttonsMessage: {
              buttons: [
                {
                  buttonId: "kategori",
                  buttonText: { displayText: `☰ ${toSC("select")}` },
                  type: 1,
                  nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: paramsJson7,
                  },
                },
              ],
              locationMessage: {
                name: `──「 ${botConfig.bot?.name || "lyniX's MD"} 」──`,
                address: `⏱ ${formatUptime(process.uptime() * 1000)}  ·  ◷ ${jam7} WITA  ·  ⌁ ${pingWA7}ms`,
                jpegThumbnail: thumb7,
              },
              contentText: `${toSC("haii")} @${m.sender.split("@")[0]}\n${toSC(greeting)} ☀️`,
              footerText: txt7,
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
        break;
      }

      case 8: {
        const catRowsV8 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return { title: `${emoji} ${toSmallCaps(cat)}`, description: `${cmds.length} commands tersedia`, id: `${prefix}menucat ${cat}` };
        });

        const chunkSize8 = 10;
        const catSections8 = [];
        for (let i = 0; i < catRowsV8.length; i += chunkSize8) {
          catSections8.push({
            title: i === 0 ? "📋 PILIH KATEGORI" : `📋 KATEGORI LANJUTAN ${Math.floor(i / chunkSize8) + 1}`,
            rows: catRowsV8.slice(i, i + chunkSize8),
          });
        }

        const paramsJson8 = JSON.stringify({
          title: "🪼 Menu",
          sections: catSections8,
        });

        const _now8 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jam8 = `${String(_now8.getHours()).padStart(2, "0")}:${String(_now8.getMinutes()).padStart(2, "0")}`;
        const _t0_8 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
        const pingWA8 = Math.max(1, Date.now() - _t0_8);

        let thumb8 = thumbBuffer;
        if (thumbBuffer) {
          try {
            thumb8 = await (await getSharp())(thumbBuffer).resize(300, 300, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
          } catch { thumb8 = thumbBuffer; }
        }

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
                    paramsJson: paramsJson8,
                  },
                },
              ],
              locationMessage: {
                name: `──「 ${botConfig.bot?.name || "lyniX's MD"} 」──`,
                address: `⏱ ${formatUptime(process.uptime() * 1000)}  ·  ◷ ${jam8} WITA  ·  ⌁ ${pingWA8}ms`,
                jpegThumbnail: thumb8,
              },
              contentText: `ʜᴀʟᴏ, @${m.sender.split("@")[0]} ⋆｡⋆\n${greeting} ☀️, sᴇᴍᴏɢᴀ ʜᴀʀɪᴍᴜ ᴍᴇɴʏᴇɴᴀɴɢᴋᴀɴ ☀️`,
              footerText: txtBody,
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
        break;
      }

      case 9: {
        const legend9 = _s16Box("🤖", "keterangan", [
          `Ⓞ = ${toSC("Khusus Owner")}`,
          `ⓟ = ${toSC("Khusus Premium")}`,
          `Ⓥ = ${toSC("Khusus VIP")}`,
          `Ⓛ = ${toSC("Butuh Limit")}`,
          `Ⓐ = ${toSC("Khusus Admin")}`,
        ]);

        const boxes9 = [];
        for (const category of sortedCategories) {
          if (!filterCat(category)) continue;
          const allCmds9 = [...(commandsByCategory[category] || []), ...(casesByCategory[category] || [])];
          if (allCmds9.length === 0) continue;
          const emoji9 = CATEGORY_EMOJIS[category] || "📋";
          const lines9 = allCmds9.map((cmd) => `\`${prefix}${cmd}\`${getCommandSymbols(cmd)}`);
          boxes9.push(_s16Box(emoji9, category, lines9));
        }

        const bodyText9 = [legend9, "", ...boxes9.flatMap((b) => [b, ""])].join("\n").trimEnd();

        const catRows9 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return {
            title: `${emoji} ${toSC(cat)}`,
            description: toSC(`${cmds.length} commands available`),
            id: `${prefix}menucat ${cat}`,
          };
        });

        await sendStyle16(sock, m, {
          botConfig,
          db,
          prefix,
          bodyText: bodyText9,
          categoryRows: catRows9,
          totalCmds: totalFeatures,
          imageBuffer,
          thumbBuffer,
        });
        break;
      }

      case 10: {
        const legend10 = _s16Box("🤖", "keterangan", [
          `Ⓞ = ${toSC("Khusus Owner")}`,
          `ⓟ = ${toSC("Khusus Premium")}`,
          `Ⓥ = ${toSC("Khusus VIP")}`,
          `Ⓛ = ${toSC("Butuh Limit")}`,
          `Ⓐ = ${toSC("Khusus Admin")}`,
        ]);

        const boxes10 = [];
        for (const category of sortedCategories) {
          if (!filterCat(category)) continue;
          const allCmds10 = [...(commandsByCategory[category] || []), ...(casesByCategory[category] || [])];
          if (allCmds10.length === 0) continue;
          const emoji10 = CATEGORY_EMOJIS[category] || "📋";
          const lines10 = allCmds10.map((cmd) => `\`${prefix}${cmd}\`${getCommandSymbols(cmd)}`);
          boxes10.push(_s16Box(emoji10, category, lines10));
        }

        const extraBody10 = [legend10, "", ...boxes10.flatMap((b) => [b, ""])].join("\n").trimEnd();

        const catRows10 = sortedCategories.filter(filterCat).map((cat) => {
          const cmds = [...(commandsByCategory[cat] || []), ...(casesByCategory[cat] || [])];
          const emoji = CATEGORY_EMOJIS[cat] || "📋";
          return {
            title: `${emoji} ${toSC(cat)}`,
            description: toSC(`${cmds.length} commands available`),
            id: `${prefix}menucat ${cat}`,
          };
        });

        await sendStyle17(sock, m, {
          botConfig,
          db,
          prefix,
          categoryRows: catRows10,
          totalCmds: totalFeatures,
          imageBuffer,
          thumbBuffer,
          extraBody: extraBody10,
          heading: "All Menu",
        });
        break;
      }

      default:
        if (imageBuffer) {
          await sock.sendMessage(m.chat, { image: imageBuffer, caption: txt, contextInfo: fullContextInfo }, { quoted: m });
        } else {
          await sock.sendMessage(m.chat, { text: txt, contextInfo: fullContextInfo }, { quoted: m });
        }
    }
  } catch (error) {
    console.error("[AllMenu] Error:", error.message);
    if (imageBuffer) {
      await sock.sendMessage(m.chat, { image: imageBuffer, caption: txt, contextInfo: getContextInfo(botConfig, m) }, { quoted: m });
    } else {
      await m.reply(txt);
    }
  }

  const audioPath = path.join(process.cwd(), "assets", "audio", "allmenu.mp3");
  try {
    if (fs.existsSync(audioPath)) {
      await sock.sendMessage(
        m.chat,
        {
          audio: fs.readFileSync(audioPath),
          mimetype: "audio/mpeg",
          ptt: false, 
        },
        { quoted: m }
      );
    }
  } catch (audioErr) {
    console.error("[AllMenu] Gagal memutar audio:", audioErr.message);
  }
  
}

async function handler(m, ctx) {
  const result = await allmenuHandler(m, ctx);
  await attachMenuSticker(ctx.sock, m, config);
  return result;
}

export { pluginConfig as config, handler };