import { getCaseCount, getCasesByCategory } from "../../case/ichigo.js";
import { getAssetBuffer as getCachedAsset, loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  proto,
} from "ichigo";
import { createCanvas, loadImage, GlobalFonts } from "../../src/lib/ichigo-canvas-lazy.js";
import { sharp as _sharp } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import {
  formatUptime,
  getTimeGreeting,
} from "../../src/lib/ichigo-formatter.js";
import {
  getCommandsByCategory,
  getCategories,
  getAllPlugins,
} from "../../src/lib/ichigo-plugins.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import { MODES } from '../group/botmode.js'
import { Button, ButtonV2 } from '../../src/lib/ichigo-builder.js';
import { getUserStatusLabel } from '../../src/lib/ichigo-level.js'
import { performance } from "perf_hooks";
import { attachMenuSticker } from "../../src/lib/ichigo-sticker-annotation.js";
const PANEL_INFO = [
  "✦ INFO SNIPPET",
  "https://codequh.ynlx.eu.cc/",
  "> snippet code · update · tools LyniX's",
].join("\n");
const PANEL_FOOT = "\n\n" + PANEL_INFO;

function getSharp() {
  return _sharp;
}
const pluginConfig = {
  name: "menu",
  alias: ["help", "bantuan", "commands", "m"],
  category: "main",
  description: "Menampilkan menu utama bot",
  usage: ".menu",
  example: ".menu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
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
};
function toSmallCaps(text) {
  const smallCaps = {
    a: "ᴀ",
    b: "ʙ",
    c: "ᴄ",
    d: "ᴅ",
    e: "ᴇ",
    f: "ꜰ",
    g: "ɢ",
    h: "ʜ",
    i: "ɪ",
    j: "ᴊ",
    k: "ᴋ",
    l: "ʟ",
    m: "ᴍ",
    n: "ɴ",
    o: "ᴏ",
    p: "ᴘ",
    q: "ǫ",
    r: "ʀ",
    s: "s",
    t: "ᴛ",
    u: "ᴜ",
    v: "ᴠ",
    w: "ᴡ",
    x: "x",
    y: "ʏ",
    z: "ᴢ",
  };
  return text
    .toLowerCase()
    .split("")
    .map((c) => smallCaps[c] || c)
    .join("");
}
function toItalicFont(text) {
  const italic = {
    a: "𝘢", b: "𝘣", c: "𝘤", d: "𝘥", e: "𝘦", f: "𝘧", g: "𝘨", h: "𝘩", i: "𝘪", j: "𝘫",
    k: "𝘬", l: "𝘭", m: "𝘮", n: "𝘯", o: "𝘰", p: "𝘱", q: "𝘲", r: "𝘳", s: "𝘴", t: "𝘵",
    u: "𝘶", v: "𝘷", w: "𝘸", x: "𝘹", y: "𝘺", z: "𝘻",
    A: "𝘈", B: "𝘉", C: "𝘊", D: "𝘋", E: "𝘌", F: "𝘍", G: "𝘎", H: "𝘏", I: "𝘐", J: "𝘑",
    K: "𝘒", L: "𝘓", M: "𝘔", N: "𝘕", O: "𝘖", P: "𝘗", Q: "𝘘", R: "𝘙", S: "𝘚", T: "𝘛",
    U: "𝘜", V: "𝘝", W: "𝘞", X: "𝘟", Y: "𝘠", Z: "𝘡",
  };
  return text
    .split("")
    .map((c) => italic[c] || c)
    .join("");
}

function toSansSerif(text) {
  return text
    .split("")
    .map((c) => {
      if (c >= "A" && c <= "Z") return String.fromCodePoint(0x1d5a0 + (c.charCodeAt(0) - 65));
      if (c >= "a" && c <= "z") return String.fromCodePoint(0x1d5ba + (c.charCodeAt(0) - 97));
      return c;
    })
    .join("");
}
function toSansSerifBold(text) {
  return text
    .split("")
    .map((c) => {
      if (c >= "A" && c <= "Z") return String.fromCodePoint(0x1d5d4 + (c.charCodeAt(0) - 65));
      if (c >= "a" && c <= "z") return String.fromCodePoint(0x1d5ee + (c.charCodeAt(0) - 97));
      return c;
    })
    .join("");
}
const toMonoUpperBold = (text) => {
  const chars = {

    A: "𝗔",
    B: "𝗕",
    C: "𝗖",
    D: "𝗗",
    E: "𝗘",
    F: "𝗙",
    G: "𝗚",
    H: "𝗛",
    I: "𝗜",
    J: "𝗝",
    K: "𝗞",
    L: "𝗟",
    M: "𝗠",
    N: "𝗡",
    O: "𝗢",
    P: "𝗣",
    Q: "𝗤",
    R: "𝗥",
    S: "𝗦",
    T: "𝗧",
    U: "𝗨",
    V: "𝗩",
    W: "𝗪",
    X: "𝗫",
    Y: "𝗬",
    Z: "𝗭",
  };
  return text
    .toUpperCase()
    .split("")
    .map((c) => chars[c] || c)
    .join("");
};
function getSortedCategories(m, botMode) {
  const categories = getCategories();
  const commandsByCategory = getCommandsByCategory();
  const categoryOrder = [
    "owner",
    "main",
    "utility",
    "tools",
    "fun",
    "game",
    "download",
    "search",
    "sticker",
    "media",
    "ai",
    "group",
    "religi",
    "info",
    "cek",
    "economy",
    "user",
    "canvas",
    "random",
    "premium",
    "ephoto",
    "jpm",
    "pushkontak",
    "panel",
    "store",
  ];
  const modeConfig = MODES[botMode] || MODES.md
  const allowedCats = modeConfig.allowedCategories
  const excludeCats = modeConfig.excludeCategories || []
  const sortedCats = [...categories].sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
  const result = [];
  for (const cat of sortedCats) {
    if (cat === "owner" && !m.isOwner) continue;
    if (allowedCats && !allowedCats.includes(cat.toLowerCase())) continue;
    if (excludeCats && excludeCats.includes(cat.toLowerCase())) continue;
    const cmds = commandsByCategory[cat] || [];
    if (cmds.length === 0) continue;
    const emoji = CATEGORY_EMOJIS[cat] || "୨ৎ";
    result.push({ cat, cmds, emoji });
  }

  const totalCmds = getAllPlugins().length;
  return { sorted: result, totalCmds, commandsByCategory };
}
async function formatTime(date) {
  const timeHelper = await import("../../src/lib/ichigo-time.js");
  return timeHelper.formatTime("HH:mm");
}
async function formatDateShort(date) {
  const timeHelper = await import("../../src/lib/ichigo-time.js");
  return timeHelper.formatFull("dddd, DD MMMM YYYY");
}
async function buildMenuText(
  m,
  botConfig,
  db,
  uptime,
  botMode = "md",
  useBracketBoxStyle = false,
) {
  const prefix = botConfig.command?.prefix || ".";
  const user = db.getUser(m.sender);
  const timeHelper = await import("../../src/lib/ichigo-time.js");
  const timeStr = timeHelper.formatTime("HH:mm");
  const dateStr = timeHelper.formatFull("dddd, DD MMMM YYYY");
  const categories = getCategories();
  const commandsByCategory = getCommandsByCategory();
  let totalCommands = 0;
  for (const category of categories) {
    totalCommands += (commandsByCategory[category] || []).length;
  }
  const totalCases = getCaseCount();
  const casesByCategory = getCasesByCategory();
  const totalFeatures = totalCommands + totalCases;
  
  const _isVipActive = db.isVipActive
    ? db.isVipActive(m.sender)
    : (() => { const _u = db.getUser(m.sender); return _u?.isVip && (!_u.vipExpired || _u.vipExpired === -1 || Date.now() < _u.vipExpired); })();
  const { label: userRole, emoji: roleEmoji } = getUserStatusLabel({
    isOwner: m.isOwner,
    isVip: _isVipActive,
    isPremium: m.isPremium,
  });
  const greeting = getTimeGreeting();
  // Pakai process.uptime() (waktu sejak proses bot start), bukan param `uptime`
  // yang berasal dari getUptime() di connection.js — itu waktu sejak koneksi WA
  // terakhir terbuka, jadi ke-reset tiap kali WA reconnect walau proses tetap jalan.
  const uptimeFormatted = formatUptime(process.uptime() * 1000);
  const totalUsers = db.getUserCount();
  const _greetHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" })).getHours();
  const _greetIcon = _greetHour >= 4 && _greetHour < 11 ? "🌅" : _greetHour >= 11 && _greetHour < 15 ? "☀️" : _greetHour >= 15 && _greetHour < 18 ? "🌇" : _greetHour >= 18 && _greetHour < 21 ? "🌆" : "🌙";
  let txt = `${_greetIcon} *${greeting}, ${m.pushName || "User"}!*

> ✦ *${botConfig.bot?.name || "Mizee-Bot"}* hadir untuk membantu kamu — dari download, AI, RPG, hingga tools serbaguna. Semua bisa diakses langsung di WhatsApp.
> 💡 Ketik *${prefix}help <perintah>* untuk info lebih lanjut.`;
  const botInfoLines = [
    `🖐 ɴᴀᴍᴀ     : ${botConfig.bot?.name || "Mizee-Bot"}`,
    `🔑 ᴠᴇʀsɪ    : v${botConfig.bot?.version || "1.2.0"}`,
    `⚙️ ᴍᴏᴅᴇ     : ${(botConfig.mode || "public").toUpperCase()}`,
    `🧶 ᴘʀᴇꜰɪx    : [ ${prefix} ]`,
    `⏱ ᴜᴘᴛɪᴍᴇ   : ${uptimeFormatted}`,
    `👥 ᴛᴏᴛᴀʟ    : ${totalUsers} Users`,
    `🏷 ɢʀᴏᴜᴘ     : ${botMode.toUpperCase()}`,
    `👑 ᴏᴡɴᴇʀ    : ${botConfig.owner?.name || "Mizee-Bot"}`,
  ];
  const userInfoLines = [
    `🙋 ɴᴀᴍᴀ     : ${m.pushName}`,
    `🎭 ʀᴏʟᴇ     : ${roleEmoji} ${userRole}`,
    `🎟 ᴇɴᴇʀɢɪ   : ${m.isOwner || _isVipActive || m.isPremium ? "∞ Unlimited" : (user?.energi ?? 25)}`,
    `⚡ ʟᴇᴠᴇʟ    : ${Math.floor((user?.exp || 0) / 10000) + 1}`,
    `✨ ᴇxᴘ       : ${(user?.exp ?? 0).toLocaleString()}`,
    `💰 ᴋᴏɪɴ      : ${(user?.koin ?? 0).toLocaleString()}`,
  ];
  const rpg = user?.rpg || {};
  if (rpg.health !== undefined) {
    userInfoLines.push(
      `❤️ ʜᴘ        : ${rpg.health}/${rpg.maxHealth || rpg.health}`,
    );
    userInfoLines.push(`🔮 ᴍᴀɴᴀ      : ${rpg.mana}/${rpg.maxMana || rpg.mana}`);
    userInfoLines.push(
      `🏃 sᴛᴀᴍɪɴᴀ   : ${rpg.stamina}/${rpg.maxStamina || rpg.stamina}`,
    );
  }
  const inv = user?.inventory || {};
  const invCount = Object.values(inv).reduce(
    (a, b) => a + (typeof b === "number" ? b : 0),
    0,
  );
  if (invCount > 0) userInfoLines.push(`🎒 ɪɴᴠᴇɴᴛᴏʀʏ : ${invCount} items`);
  userInfoLines.push(`🕒 ᴡᴀᴋᴛᴜ    : ${timeStr} WITA`);
  userInfoLines.push(`📅 ᴛᴀɴɢɢᴀʟ  : ${dateStr}`);

  if (useBracketBoxStyle) {
    txt += `\n\n`;
    txt += createBracketBox("BOT INFO", botInfoLines);
    txt += createBracketBox("USER INFO", userInfoLines);
  } else {
    txt += `\n\n┌──〔 🤖 ʙᴏᴛ ɪɴꜰᴏ 〕──⊱\n`;
    txt += `│  ✦ ɴᴀᴍᴀ     › *${botConfig.bot?.name || "Mizee-Bot"}*\n`;
    txt += `│  ✦ ᴠᴇʀsɪ    › *v${botConfig.bot?.version || "1.2.0"}*\n`;
    txt += `│  ✦ ᴍᴏᴅᴇ     › *${(botConfig.mode || "public").toUpperCase()}*\n`;
    txt += `│  ✦ ᴘʀᴇꜰɪx    › *[ ${prefix} ]*\n`;
    txt += `│  ✦ ᴜᴘᴛɪᴍᴇ   › *${uptimeFormatted}*\n`;
    txt += `│  ✦ ᴜsᴇʀ      › *${totalUsers} Pengguna*\n`;
    txt += `│  ✦ ɢʀᴜᴘ      › *${botMode.toUpperCase()}*\n`;
    txt += `│  ✦ ᴏᴡɴᴇʀ    › *${botConfig.owner?.name || "Mizee-Bot"}*\n`;
    txt += `└──────────────────⊱\n\n`;
    txt += `┌──〔 👤 ᴜsᴇʀ ɪɴꜰᴏ 〕──⊱\n`;
    txt += `│  ✦ ɴᴀᴍᴀ     › *${m.pushName}*\n`;
    txt += `│  ✦ ʀᴏʟᴇ     › *${roleEmoji} ${userRole}*\n`;
    txt += `│  ✦ ᴇɴᴇʀɢɪ   › *${m.isOwner || _isVipActive || m.isPremium ? "∞ Unlimited" : (user?.energi ?? 25)}*\n`;
    txt += `│  ✦ ʟᴇᴠᴇʟ    › *${Math.floor((user?.exp || 0) / 10000) + 1}*\n`;
    txt += `│  ✦ ᴇxᴘ       › *${(user?.exp ?? 0).toLocaleString()}*\n`;
    txt += `│  ✦ ᴋᴏɪɴ      › *${(user?.koin ?? 0).toLocaleString()}*\n`;
    if (rpg.health !== undefined) {
      txt += `│  ✦ ʜᴘ        › *${rpg.health}/${rpg.maxHealth || rpg.health}*\n`;
      txt += `│  ✦ ᴍᴀɴᴀ      › *${rpg.mana}/${rpg.maxMana || rpg.mana}*\n`;
      txt += `│  ✦ sᴛᴀᴍɪɴᴀ   › *${rpg.stamina}/${rpg.maxStamina || rpg.stamina}*\n`;
    }
    if (invCount > 0) txt += `│  ✦ ɪɴᴠᴇɴᴛᴏʀʏ › *${invCount} item*\n`;
    txt += `│  ✦ ᴊᴀᴍ       › *${timeStr} WITA*\n`;
    txt += `│  ✦ ᴛᴀɴɢɢᴀʟ  › *${dateStr}*\n`;
    txt += `└──────────────────⊱\n\n`;
  }
  const categoryOrder = [
    "owner",
    "main",
    "utility",
    "tools",
    "fun",
    "game",
    "download",
    "search",
    "sticker",
    "media",
    "ai",
    "group",
    "religi",
    "info",
    "cek",
    "economy",
    "user",
    "canvas",
    "random",
    "premium",
    "ephoto",
    "jpm",
    "pushkontak",
    "panel",
    "store",
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
    const botmodePlugin = await import("../group/botmode.js");
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
  const categoryLines = [];
  for (const category of sortedCategories) {
    if (category === "owner" && !m.isOwner) continue;
    if (
      allowedCategories &&
      !allowedCategories.includes(category.toLowerCase())
    )
      continue;
    if (excludeCategories && excludeCategories.includes(category.toLowerCase()))
      continue;
    const pluginCmds = commandsByCategory[category] || [];
    const caseCmds = casesByCategory[category] || [];
    const totalCmds = pluginCmds.length + caseCmds.length;
    if (totalCmds === 0) continue;
    const emoji = CATEGORY_EMOJIS[category] || "📁";
    categoryLines.push(`${prefix}menucat ${category} ${emoji}`);
  }
  if (useBracketBoxStyle) {
    txt += createBracketBox("LIST CATEGORY", categoryLines);
  } else {
    txt += `┌──〔 📂 ᴅᴀꜰᴛᴀʀ ᴋᴀᴛᴇɢᴏʀɪ 〕──⊱\n`;
    for (const line of categoryLines) {
      txt += `│  ⌦ \`${toSmallCaps(line)}\`\n`;
    }
    txt += `└──────────────────⊱\n`;
    txt += `\n> 💬 _Ketik perintah di atas untuk melihat list command per kategori_`;
  }
  return txt;
}

function createBracketBox(title, lines = [], emoji = "🤖") {
  let text = `┌──〔 ${emoji} *${title}* 〕──⊱\n`;
  for (const line of lines) {
    text += `│  ✦ *${line}*\n`;
  }
  text += `└──────────────────⊱\n\n`;
  return text;
}

function getVerifiedQuoted(botConfig) {
  return {
    key: {
      participant: `0@s.whatsapp.net`,
      remoteJid: `status@broadcast`,
    },
    message: {
      contactMessage: {
        displayName: `🪸 ${botConfig.bot?.name}`,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;ttname,;;;\nFN:ttname\nitem1.TEL;waid=13135550002:+1 (313) 555-0002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
        sendEphemeral: true,
      },
    },
  };
}
async function sendFallback(
  m,
  sock,
  text,
  imageBuffer,
  thumbBuffer,
  botConfig,
  errorName,
) {
  if (errorName) console.error(`[Menu Error] ${errorName}`);
  const fallbackMsg = {
    contextInfo: { mentionedJid: [m.sender], forwardingScore: 9, isForwarded: true },
  };
  let fallbackText = text;
  if (errorName === "V5") {
    const { sorted } = getSortedCategories(m, "md");
    let catText = `📋 *ᴋᴀᴛᴇɢᴏʀɪ ᴍᴇɴᴜ*\n\n`;
    for (const { cat, cmds, emoji } of sorted)
      catText += `> ${emoji} \`${botConfig.command?.prefix || "."}menucat ${cat}\` - ${toMonoUpperBold(cat)} (${cmds.length})\n`;
    catText += `\n_Ketik perintah kategori untuk melihat command_`;
    fallbackText = text + "\n\n" + catText;
  }
  if (imageBuffer) {
    fallbackMsg.image = imageBuffer;
    fallbackMsg.caption = fallbackText;
  } else {
    fallbackMsg.text = fallbackText;
  }
  await sock.sendMessage(m.chat, fallbackMsg, {
    quoted: getVerifiedQuoted(botConfig),
  });
}
async function menuHandler(m, { sock, config: botConfig, db, uptime }) {
  const _menuExecStart = performance.now();
  const savedVariant = db.setting("menuVariant");
  const menuVariant = savedVariant || botConfig.ui?.menuVariant || 1;
  const groupData = m.isGroup ? db.getGroup(m.chat) || {} : {};
  const botMode = groupData.botMode || "md";

  const user = db.getUser(m.sender) || {
    level: 0,
    exp: 0,
    energi: 0,
    koin: 0,
    isRegistered: false,
  };
  
  const _menuTextBase = await buildMenuText(
    m,
    botConfig,
    db,
    uptime,
    botMode,
    menuVariant === 5,
  );
  const text = _menuTextBase + PANEL_FOOT;

  const imagePath = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  const videoPath = path.join(process.cwd(), "assets", "video", "ichigo.mp4");
  let imageBuffer = fs.existsSync(imagePath)
    ? fs.readFileSync(imagePath)
    : null;
  let thumbBuffer = fs.existsSync(thumbPath)
    ? fs.readFileSync(thumbPath)
    : null;
  let videoBuffer = fs.existsSync(videoPath)
    ? fs.readFileSync(videoPath)
    : null;
  const prefix = botConfig.command?.prefix || ".";
  const saluranId = botConfig.saluran?.id || "120363409557700746@newsletter";
  const saluranName =
    botConfig.saluran?.name || botConfig.bot?.name || "Mizee-Bot";
  const saluranLink =
    botConfig.saluran?.link ||
    "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t";
  const {
    sorted: menuSorted,
    totalCmds,
    commandsByCategory,
  } = getSortedCategories(m, botMode);
  const greeting = getTimeGreeting();
  // Sama seperti di buildMenuText: pakai uptime proses asli, bukan uptime koneksi WA.
  const uptimeFormatted = formatUptime(process.uptime() * 1000);
  try {
    switch (menuVariant) {
      case 1:
        if (imageBuffer) {
          await sock.sendMessage(m.chat, { image: imageBuffer, caption: text });
        } else {
          await m.reply(text);
        }
        break;
      case 2: {
        const sharp = getSharp();
        const getAssetBuffer = (name) => {
          const buf = getCachedAsset(name);
          if (buf) return buf;
          throw new Error(`Asset ${name} tidak tersedia`);
        };

        const userData4 = db.getUser(m.sender) || {};
        const userRole4 = m.isOwner ? "👑 ᴏᴡɴᴇʀ" : m.isPremium ? "💎 ᴘʀᴇᴍɪᴜᴍ" : "✦ ᴍᴇᴍʙᴇʀ";
        const userLevel4 = Math.floor((userData4.exp || 0) / 10000) + 1;
        const userEnergi4 = m.isOwner || m.isPremium ? "∞" : (userData4.energi ?? 25);
        const userKoin4 = userData4.koin || 0;
        const rpg4 = userData4.rpg || {};

        const rank4 =
          userLevel4 >= 50 ? "🏆 ʟᴇɢᴇɴᴅ" :
          userLevel4 >= 30 ? "💠 ᴍᴀsᴛᴇʀ" :
          userLevel4 >= 20 ? "🥇 ᴇxᴘᴇʀᴛ" :
          userLevel4 >= 10 ? "🥈 ᴀᴅᴠᴀɴᴄᴇᴅ" :
          userLevel4 >= 5  ? "🥉 ɪɴᴛᴇʀᴍᴇᴅɪᴀᴛᴇ" :
          "🌱 ɴᴇᴡʙɪᴇ";

        const _pad4 = (n) => String(n).padStart(2, "0");
        const _now4 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jamWita4 = `${_pad4(_now4.getHours())}:${_pad4(_now4.getMinutes())}`;
        const hariList4 = ["ᴍɪɴɢɢᴜ","sᴇɴɪɴ","sᴇʟᴀsᴀ","ʀᴀʙᴜ","ᴋᴀᴍɪs","ᴊᴜᴍᴀᴛ","sᴀʙᴛᴜ"];
        const hariIni4 = hariList4[_now4.getDay()];
        const tanggal4 = `${_pad4(_now4.getDate())}/${_pad4(_now4.getMonth() + 1)}/${_now4.getFullYear()}`;
        const waktuHour4 = _now4.getHours();
        const waktu4 =
          waktuHour4 >= 4  && waktuHour4 < 11 ? "ᴘᴀɢɪ" :
          waktuHour4 >= 11 && waktuHour4 < 14 ? "sɪᴀɴɢ" :
          waktuHour4 >= 14 && waktuHour4 < 17 ? "sᴏʀᴇ" :
          waktuHour4 >= 17 && waktuHour4 < 19 ? "ᴘᴇᴛᴀɴɢ" :
          waktuHour4 >= 19 ? "ᴍᴀʟᴀᴍ" : "ᴅɪɴɪ ʜᴀʀɪ";

        let cuaca4 = "—";
        let sunrise4 = "06:03";
        let sunset4 = "17:52";
        try {
          const _r4 = await fetch(
            "https://api.open-meteo.com/v1/forecast?latitude=-5.56&longitude=120.19&current=temperature_2m,weathercode&daily=sunrise,sunset&timezone=Asia%2FMakassar",
            { signal: AbortSignal.timeout(5000) }
          );
          if (_r4.ok) {
            const _d4 = await _r4.json();
            const suhu4 = _d4.current?.temperature_2m;
            const kode4 = _d4.current?.weathercode;
            const icon4 = kode4 <= 1 ? "☀️" : kode4 <= 3 ? "⛅" : kode4 <= 67 ? "🌧️" : "🌩️";
            cuaca4 = `ʙᴜʟᴜᴋᴜᴍʙᴀ ${suhu4}°ᴄ ${icon4}`;
            const sr = _d4.daily?.sunrise?.[0];
            const ss = _d4.daily?.sunset?.[0];
            if (sr) sunrise4 = sr.split("T")[1]?.slice(0, 5) || sunrise4;
            if (ss) sunset4 = ss.split("T")[1]?.slice(0, 5) || sunset4;
          }
        } catch {}

        const cmdStats4 = db.data.cmdStats || {};
        const top10_4 = Object.entries(cmdStats4)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        const top10Lines4 = top10_4.length
          ? top10_4.map(([cmd, count], i) =>
              `  ${i + 1}. ${prefix}${cmd} — ${count}x`
            )
          : [`  *(ʙᴇʟᴜᴍ ᴀᴅᴀ ᴅᴀᴛᴀ)*`];

        const footer4 = [
          `⌯ ˚₊·────── ᴘʀᴏꜰɪʟ ──────·₊˚ ⌯`,
          `╸ ɴᴀᴍᴀ › ${m.pushName}`,
          `╸ ʀᴏʟᴇ › ${userRole4}`,
          `╸ ʀᴀɴᴋ › ${rank4}`,
          `╸ ʟᴇᴠᴇʟ › ${userLevel4}`,
          `╸ ᴋᴏɪɴ › ${userKoin4.toLocaleString()} ᴋᴏɪɴ`,
          `╸ ᴇɴᴇʀɢɪ › ${userEnergi4}`,
          `╸ ʜᴘ › ${rpg4.health ?? 0}／${rpg4.maxHealth ?? 100}`,
          `╸ ᴍᴀɴᴀ › ${rpg4.mana ?? 0}／${rpg4.maxMana ?? 100}`,
          `╸ sᴛᴀᴍɪɴᴀ › ${rpg4.stamina ?? 0}／${rpg4.maxStamina ?? 100}`,
          ``,
          `⌯ ˚₊·────── ɪɴꜰᴏ ʙᴏᴛ ──────·₊˚ ⌯`,
          `╸ ɴᴀᴍᴀ › ${botConfig.bot?.name || "Mizee-Bot"}`,
          `╸ ᴠᴇʀsɪ › v${botConfig.bot?.version || "2.1.0"}`,
          `╸ ᴍᴏᴅᴇ › ${(botConfig.mode || "public").toUpperCase()}`,
          `╸ ꜰɪᴛᴜʀ › ${totalCmds} ᴘᴇʀɪɴᴛᴀʜ`,
          `╸ ᴜᴘᴛɪᴍᴇ › ${uptimeFormatted}`,
          `╸ ᴜsᴇʀ › ${db.getUserCount()} ᴏʀᴀɴɢ`,
          `╸ ᴘʀᴇꜰɪx › [ ${prefix} ]`,
          `╸ ᴏᴡɴᴇʀ › ${botConfig.owner?.name || "Owner"}`,
          ``,
          `⌯ ˚₊·────── ᴡᴀᴋᴛᴜ ──────·₊˚ ⌯`,
          `╸ ʜᴀʀɪ › ${hariIni4}，${tanggal4}`,
          `╸ ᴊᴀᴍ › ${jamWita4} ᴡɪᴛᴀ`,
          `╸ sᴜᴀsᴀɴᴀ › ${waktu4}`,
          `╸ ᴄᴜᴀᴄᴀ › ${cuaca4}`,
          `╸ ᴛᴇʀʙɪᴛ › ${sunrise4} ᴡɪᴛᴀ`,
          `╸ ᴛᴇʀʙᴇɴᴀᴍ › ${sunset4} ᴡɪᴛᴀ`,
          ``,
          `⌯ ˚₊·────── ᴛᴏᴘ ꜰɪᴛᴜʀ ──────·₊˚ ⌯`,
          ...top10Lines4,
          `·───────────────────────·`,
          `  ⌯ ${botConfig.bot?.name || "Mizee-Bot"} ⌯`,
        ].join("\n") + PANEL_FOOT;

        const catRows4 = menuSorted.map(({ cat, emoji }) => ({
          title: `${emoji} ${toMonoUpperBold(cat)}`,
          description: `ᴋᴀᴛᴇɢᴏʀɪ ${cat}`,
          id: `${prefix}menucat ${cat}`,
        }));

        const buttons4 = [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }),
          },
          {
            name: "inapp_signup",
            buttonParamsJson: "{}",
          },
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "✦ ʙᴜᴋᴀ ᴍᴇɴᴜ",
              sections: [
                {
                  title: "✦ ᴍᴇɴᴜ ᴜᴛᴀᴍᴀ",
                  rows: [
                    {
                      title: "✦ sᴇᴍᴜᴀ ꜰɪᴛᴜʀ",
                      description: "ᴛᴀᴍᴘɪʟᴋᴀɴ sᴇʟᴜʀᴜʜ ʟɪsᴛ ᴘᴇʀɪɴᴛᴀʜ ʙᴏᴛ",
                      id: `${prefix}allmenu`,
                    },
                    {
                      title: "✦ ᴋᴏɴᴛᴀᴋ ᴏᴡɴᴇʀ",
                      description: "ɪɴꜰᴏ ᴋᴏɴᴛᴀᴋ ᴘᴇɴɢᴇᴍʙᴀɴɢ ʙᴏᴛ",
                      id: `${prefix}owner`,
                    },
                    {
                      title: "✦ ᴘᴀɴᴅᴜᴀɴ ʙᴏᴛ",
                      description: "ᴄᴀʀᴀ ᴘᴀᴋᴀɪ ʙᴏᴛ, ᴀᴛᴜʀᴀɴ, ᴅᴀɴ ɪɴꜰᴏ ꜰɪᴛᴜʀ",
                      id: `${prefix}guide`,
                    },
                    {
                      title: "✦ ᴘʀᴏꜰɪʟ sᴀʏᴀ",
                      description: "ʟɪʜᴀᴛ sᴛᴀᴛɪsᴛɪᴋ ᴀᴋᴜɴ ᴋᴀᴍᴜ",
                      id: `${prefix}profile`,
                    },
                  ],
                },
                {
                  title: "✦ ᴋᴀᴛᴇɢᴏʀɪ ꜰɪᴛᴜʀ ʙᴏᴛ",
                  rows: catRows4,
                },
              ],
              has_multiple_buttons: true,
            }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ ᴏᴡɴᴇʀ", id: `${prefix}owner` }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ sᴇᴍᴜᴀ ᴍᴇɴᴜ", id: `${prefix}allmenu` }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘᴀɴᴅᴜᴀɴ", id: `${prefix}guide` }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘɪɴɢ", id: `${prefix}ping` }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ ʀᴜʟᴇs ʙᴏᴛ", id: `${prefix}rules` }),
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘʀᴏꜰɪʟ", id: `${prefix}profile` }),
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "✦ sᴀʟᴜʀᴀɴ ᴏᴡɴᴇʀ",
              url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
              merchant_url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
            }),
          },
        ];

        const ppss = getAssetBuffer("ichigo2");
        const thumbnail = await sharp(ppss).resize(300, 300).toBuffer();
        const qvideo = {
          key: { fromMe: false, participant: m.sender },
          message: {
            videoMessage: {
              caption: botConfig.bot.name,
              seconds: 999999999,
              mimetype: "video/mp4",
              jpegThumbnail: thumbnail,
              fileLength: "9999999",
            },
          },
        };
        const media4 = await prepareWAMessageMedia(
          { video: await loadAssetBuffer("ichigo-mp4"), gifPlayback: true },
          { upload: sock.waUploadToServer },
        );

        const msg4 = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: {
                  title: "",
                  subtitle: "",
                  hasMediaAttachment: true,
                  videoMessage: media4.videoMessage,
                },
                footer: { text: footer4 },
                body: { text: `*${greeting}、${m.pushName}* ✦\nわたし は *${botConfig.bot.name}*、どうぞよろしく ⌯`, },
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: `✦ ${greeting}, ${m.pushName}!`,
                      url: "",
                      copy_code: "",
                      expiration_time: null,
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "ꜱɪʟᴀʜᴋᴀɴ ᴘɪʟɪʜ ᴍᴇɴᴜ ʏᴀɴɢ ᴋᴀᴍᴜ ɪɴɢɪɴᴋᴀɴ",
                      button_title: "ᴛᴀᴘ ᴅɪsɪɴɪ",
                    },
                    tap_target_configuration: {
                      title: "✦",
                      description: "ichigo-v4",
                      canonical_url: "https://ichigo.site",
                      domain: "ichigo.site",
                      button_index: 0,
                    },
                  }),
                  buttons: buttons4,
                },
              },
            },
          },
        }, { quoted: qvideo, userJid: sock.user.jid });

        await sock.relayMessage(m.chat, msg4.message, {
          messageId: msg4.key.id,
        });
        break;
      }

      case 3:
        try {
          const catRows = menuSorted.map(({ cat, emoji }) => ({
            title: `[ ${emoji} ] - ${toMonoUpperBold(`${cat} MENU`)}`,
            description: `Klik untuk membuka ${cat}`,
            id: `${prefix}menucat ${cat}`,
          }));
          let pp;
          try {
            pp = Buffer.from(
              (
                await axios.get(
                  await sock.profilePictureUrl(m.sender, "image"),
                  { responseType: "arraybuffer" },
                )
              ).data,
            );
          } catch (error) {
            pp = getCachedAsset("pp-kosong");
          }
          const zanton = [
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                has_multiple_buttons: true,
              }),
            },
            {
              name: "call_permission_request",
              buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }),
            },
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "✦ ᴅᴀꜰᴛᴀʀ ᴋᴀᴛᴇɢᴏʀɪ ᴍᴇɴᴜ",
                sections: [
                  {
                    title: "𓍢ִ໋ ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ ʏᴀɴɢ ᴋᴀᴍᴜ ɪɴɢɪɴᴋᴀɴ",
                    rows: catRows,
                  },
                ],
                has_multiple_buttons: true,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "</> sᴇᴍᴜᴀ ᴄᴏᴍᴍᴀɴᴅ",
                id: `${prefix}allmenu`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "ⓘ sᴛᴀᴛᴜs ʙᴏᴛ",
                id: `${prefix}ping`,
              }),
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "♔ ᴏᴡɴᴇʀ",
                id: `${prefix}owner`,
              }),
            },
          ];
          const ftroliQuoted = {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: "status@broadcast",
            },
            message: {
              orderMessage: {
                orderId: "44444444444444",
                thumbnail:
                  (await (await getSharp())(getCachedAsset("ichigo2"))
                    .resize({ width: 300, height: 300 })
                    .toBuffer()) || null,
                itemCount: totalCmds,
                status: "INQUIRY",
                surface: "CATALOG",
                message: `★ ${config.bot.name}`,
                orderTitle: `📋 ${totalCmds} Commands`,
                sellerJid: botConfig.botNumber
                  ? `${botConfig.botNumber}@s.whatsapp.net`
                  : m.sender,
                token: "ichigo-menu-v8",
                totalAmount1000: 3333333,
                totalCurrencyCode: "IDR",
                contextInfo: {
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              },
            },
          };
          const userRole = m.isOwner ? "OWNER" : m.isPremium ? "PREMIUM" : (db.getUser(m.sender)?.role || "MEMBER").toUpperCase();
          const _pad = (n) => String(n).padStart(2, "0");
          const _now = new Date();
          const _wib = new Date(_now.getTime() + 7 * 60 * 60 * 1000);
          const jamWib = `${_pad(_wib.getUTCHours())}.${_pad(_wib.getUTCMinutes())} WIB`;
          const _wita = new Date(_now.getTime() + 8 * 60 * 60 * 1000);
          const jamWita = `${_pad(_wita.getUTCHours())}.${_pad(_wita.getUTCMinutes())} WITA`;
          let cuacaBulukumba = "Tidak tersedia";
          try {
            const _res = await fetch(
              "https://wttr.in/Bulukumba,SulawesiSelatan?format=%C+%t",
            );
            cuacaBulukumba = (await _res.text()).trim();
          } catch {}
          await sock.sendMessage(
            m.chat,
            {
              interactiveMessage: {
                header: ``,
                title: `ʜᴀʟᴏ, @${m.sender.split("@")[0]} 👋
sᴇɴᴀɴɢ ʙᴇʀᴛᴇᴍᴜ ᴅᴇɴɢᴀɴᴍᴜ.

┌ ʙᴏᴛ ɪɴғᴏ
│ ɴᴀᴍᴇ     : ${config.bot.name}
│ ᴏᴡɴᴇʀ    : ${config.bot.developer || config.owner?.name || "ynliniX's"}
│ ᴜᴘᴛɪᴍᴇ   : ${uptimeFormatted}
│ ᴄᴏᴍᴍᴀɴᴅ : ${totalCmds} commands
└

ɢᴜɴᴀᴋᴀɴ ᴅᴇɴɢᴀɴ ʙɪᴊᴀᴋ`,
                footer: `╭─「 *USER PROFILE* 」\n│ • Name      : *${m.pushName}*\n│ • Role      : *${userRole}*\n│ • Level     : *${Math.floor(((db.getUser(m.sender) || {}).exp || 0) / 10000) + 1}*\n│ • Exp       : *${((db.getUser(m.sender) || {}).exp || 0).toLocaleString()}*\n│ • Energi    : *${m.isOwner || m.isPremium ? "∞ Unlimited" : ((db.getUser(m.sender) || {}).energi ?? 25)}*\n│ • Koin      : *${((db.getUser(m.sender) || {}).koin || 0).toLocaleString()}*\n╰─「 *BOT INFO* 」\n│ • Version   : *v${botConfig.bot?.version || "2.1.0"}*\n│ • Mode      : *${(botConfig.mode || "public").toUpperCase()}*\n│ • Prefix    : *[ ${prefix} ]*\n╰─「 *WAKTU & CUACA* 」\n│ • WIB       : *${jamWib}*\n│ • WITA      : *${jamWita}*\n│ • Cuaca     : *${cuacaBulukumba}*\n╰──${PANEL_FOOT}`,
                image: getCachedAsset("ichigo"),
                contextInfo: {
                  mentionedJid: [m.sender],
                  forwardingScore: 7,
                  isForwarded: true,
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: `ꜱᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ ᴅɪ ${config.bot.name} !`,
                      url: "",
                      copy_code: `${config.bot.name} ✨`,
                      expiration_time: null,
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "ᴘɪʟɪʜ ᴋᴀᴛᴇɢᴏʀɪ ᴍᴇɴᴜ",
                      button_title: "ᴊᴇʟᴀᴊᴀʜɪ ᴍᴇɴᴜ ꜱᴇᴋᴀʀᴀɴɢ",
                    },
                    tap_target_configuration: {
                      title: " X ",
                      description: "bomboclard",
                      canonical_url: "https://ichigo.site",
                      domain: "shop.example.com",
                      button_index: 0,
                    },
                  }),
                  buttons: zanton,
                },
              },
            },
            { quoted: ftroliQuoted },
          );
        } catch (v16Error) {
          console.log(v16Error);
          await sendFallback(
            m,
            sock,
            text,
            imageBuffer,
            thumbBuffer,
            botConfig,
            "V16",
          );
        }
        break;
      case 4:
  try {
    const catRows = menuSorted.map(({ cat, emoji }) => ({
      title: `${emoji} ${toMonoUpperBold(cat)}`,
      description: `✦ ${cat} — Tap untuk eksplorasi`,
      id: `${prefix}menucat ${cat}`,
    }));

    let pp;
    try {
      pp = Buffer.from(
        (await axios.get(await sock.profilePictureUrl(m.sender, "image"), {
          responseType: "arraybuffer",
        })).data,
      );
    } catch {
      pp = getCachedAsset("pp-kosong");
    }

    const userRole = m.isOwner ? "OWNER" : m.isPremium ? "PREMIUM" : (db.getUser(m.sender)?.role || "MEMBER").toUpperCase();
    const userData = db.getUser(m.sender) || {};
    const userExp = userData.exp || 0;
    const userLevel = Math.floor(userExp / 10000) + 1;
    const userKoin = userData.koin || 0;
    const userEnergi = m.isOwner || m.isPremium ? "∞" : (userData.energi ?? 25);

    const _pad = (n) => String(n).padStart(2, "0");
    const _now = new Date();
    const _wib = new Date(_now.getTime() + 7 * 60 * 60 * 1000);
    const jamWib = `${_pad(_wib.getUTCHours())}.${_pad(_wib.getUTCMinutes())}`;
    const _wita = new Date(_now.getTime() + 8 * 60 * 60 * 1000);
    const jamWita = `${_pad(_wita.getUTCHours())}.${_pad(_wita.getUTCMinutes())}`;

    let cuacaBulukumba = "—";
try {
  const _res = await fetch("https://wttr.in/Bulukumba,SulawesiSelatan?format=%t");
  cuacaBulukumba = (await _res.text()).trim().replace("+", "");
} catch {}

    const expProgress = userExp % 10000;
    const expMax = 10000;
    const barFilled = Math.round((expProgress / expMax) * 10);
    const expBar = "█".repeat(barFilled) + "░".repeat(10 - barFilled);

    const roleBadge = {
      OWNER: "👑 OWNER",
      ADMIN: "🛡️ ADMIN",
      PREMIUM: "💎 PREMIUM",
      MEMBER: "🌿 MEMBER",
    }[userRole] || "🌿 MEMBER";

    const buttons17 = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪼 Semua Menu",
          id: `${m.prefix}allmenu`,
        }),
      },
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🪼 Pilih Kategori",
          sections: [
            {
              title: "✦ KATEGORI MENU ✦",
              rows: catRows,
            },
          ],
          has_multiple_buttons: true,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪼  Statistik Saya",
          id: `${m.prefix}profile`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📞 Hubungi Owner",
          id: `${m.prefix}owner`,
        }),
      },
    ];

    const ftroliQuoted17 = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast",
      },
      message: {
        orderMessage: {
          orderId: "77777777777777",
          thumbnail:
            (await (await getSharp())(getCachedAsset("ichigo2"))
              .resize({ width: 300, height: 300 })
              .toBuffer()) || null,
          itemCount: totalCmds,
          status: "INQUIRY",
          surface: "CATALOG",
          message: `✦ ${config.bot.name} ✦`,
          orderTitle: `✦ ${totalCmds} Fitur Tersedia`,
          sellerJid: botConfig.botNumber
            ? `${botConfig.botNumber}@s.whatsapp.net`
            : m.sender,
          token: "ichigo-menu-v17",
          totalAmount1000: 1700000,
          totalCurrencyCode: "IDR",
          contextInfo: {
            isForwarded: true,
            forwardingScore: 17,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 217,
            },
          },
        },
      },
    };

    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: `✦ 𝗛𝗮𝗹𝗼, ${m.pushName}! 𝗦𝗲𝗹𝗮𝗺𝗮𝘁 𝗗𝗮𝘁𝗮𝗻𝗴 ✦`,
          footer: [
            `┌─「 ✦ *DASHBOARD* ✦ 」`,
            `│`,
            `│  • *${m.pushName}*`,
            `│  ${roleBadge}`,
            `│`,
            `│  • Level   : *${userLevel}*`,
            `│  ${expBar} *${expProgress}/${expMax} EXP*`,
            `│  • Koin    : *${userKoin.toLocaleString()}*`,
            `│  • Energi  : *${userEnergi}*`,
            `│`,
            `├─「 🤖 *BOT INFO* 」`,
            `│  • Ver     : *v${botConfig.bot?.version || "2.1.0"}*`,
            `│  • Mode    : *${(botConfig.mode || "public").toUpperCase()}*`,
            `│  • Prefix  : *[ ${prefix} ]*`,
            `│  • Fitur    : *${totalCmds} Perintah*`,
            `│`,
            `├─「 🕐 *WAKTU & CUACA* 」`,
            `│  • WIB     : *${jamWib}*`,
            `│  • WITA    : *${jamWita}*`,
            `│  • Cuaca   : *${cuacaBulukumba}*`,
            `│`,
            `└── ✦ *${greeting}* ✦`,
          ].join("\n") + PANEL_FOOT,
          image: getCachedAsset("ichigo"),
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 17,
            isForwarded: true,
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              limited_time_offer: {
                text: `🌿 ${greeting}, ${m.pushName}!`,
                url: "",
                copy_code: "",
                expiration_time: null,
              },
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 3, 999],
                list_title: "✦ Pilih aksi yang kamu mau",
                button_title: "✦ Buka Menu",
              },
              tap_target_configuration: {
                title: "✦",
                description: "ichigo-v17",
                canonical_url: "https://ichigo.site",
                domain: "ichigo.site",
                button_index: 0,
              },
            }),
            buttons: buttons17,
          },
        },
      },
      { quoted: ftroliQuoted17 },
    );
  } catch (v17Error) {
    console.log(v17Error);
    await sendFallback(
      m,
      sock,
      text,
      imageBuffer,
      thumbBuffer,
      botConfig,
      "V17",
    );
  }
        break;
      case 5:
  try {
    
    const mainRows = [
      {
        title: `✦ Semua Fitur`,
        description: `Menampilkan seluruh list perintah bot`,
        id: `${prefix}allmenu`,
      },
      {
        title: `✦ Menu Owner`,
        description: `Perintah khusus untuk pemilik bot`,
        id: `${prefix}menucat owner`,
      },
      {
        title: `✦ Panduan`,
        description: `Cara pakai bot, aturan, dan info fitur`,
        id: `${prefix}guide`,
      },
      {
        title: `✦    Kontak Owner`,
        description: `Informasi kontak pengembang bot`,
        id: `${prefix}owner`,
      },
    ];

    const priorityCats = ["owner", "group"];
    const filteredMenu = menuSorted.filter(
      ({ cat }) => !priorityCats.includes(cat.toLowerCase())
    );

    const catRows18 = filteredMenu.map(({ cat, emoji }) => ({
      title: `${emoji} ${toMonoUpperBold(cat)}`,
      description: `✦ ${cat} — Tap untuk eksplorasi`,
      id: `${prefix}menucat ${cat}`,
    }));

    const chunkSize = 10;
    const catSections = [];
    for (let i = 0; i < catRows18.length; i += chunkSize) {
      catSections.push({
        title: i === 0
          ? "Kategori Fitur Bot"
          : `📂 Kategori Lanjutan ${Math.floor(i / chunkSize) + 1}`,
        rows: catRows18.slice(i, i + chunkSize),
      });
    }

    let pp;
    try {
      pp = Buffer.from(
        (await axios.get(await sock.profilePictureUrl(m.sender, "image"), {
          responseType: "arraybuffer",
        })).data,
      );
    } catch {
      pp = getCachedAsset("pp-kosong");
    }

    const userRole = m.isOwner ? "OWNER" : m.isPremium ? "PREMIUM" : (db.getUser(m.sender)?.role || "MEMBER").toUpperCase();
    const userData = db.getUser(m.sender) || {};
    const userKoin = userData.koin || 0;
    const userEnergi = m.isOwner || m.isPremium ? "∞" : (userData.energi ?? 25);

    const _pad = (n) => String(n).padStart(2, "0");
    const _now = new Date();
    const _wib = new Date(_now.getTime() + 7 * 60 * 60 * 1000);
    const jamWib = `${_pad(_wib.getUTCHours())}.${_pad(_wib.getUTCMinutes())}`;
    const _wita = new Date(_now.getTime() + 8 * 60 * 60 * 1000);
    const jamWita = `${_pad(_wita.getUTCHours())}.${_pad(_wita.getUTCMinutes())}`;
    const tanggal = `${_pad(_wib.getUTCDate())}/${_pad(_wib.getUTCMonth() + 1)}/${_wib.getUTCFullYear()}`;
    const hariList = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const hariIni = hariList[_wib.getUTCDay()];

    let cuacaBulukumba = "—";
    try {
      const _res = await fetch("https://wttr.in/Bulukumba,SulawesiSelatan?format=%t");
      cuacaBulukumba = (await _res.text()).trim().replace("+", "");
    } catch {}

    const roleBadge = {
      OWNER: "👑 ᴏᴡɴᴇʀ",
      ADMIN: "🛡️ ᴀᴅᴍɪɴ",
      PREMIUM: "💎 ᴘʀᴇᴍɪᴜᴍ",
      MEMBER: "🌿 ᴍᴇᴍʙᴇʀ",
    }[userRole] || "🌿 ᴍᴇᴍʙᴇʀ";

    const cmdStats = db.data.cmdStats || {};
    const top10 = Object.entries(cmdStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const top10Lines = top10.length
      ? top10.map(([cmd, count], i) =>
          `│  ${i + 1}. ${prefix}${cmd} *— ${count}x*`
        )
      : [`│  *(belum ada data)*`];

    const buttons18 = [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "✦ Menu",
          sections: [
            {
              title: "✦ Menu Utama",
              rows: mainRows,
            },
            ...catSections,
          ],
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "✦ Semua Menu",
          id: `${m.prefix}allmenu`,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "✦ Panduan",
          id: `${m.prefix}guide`,
        }),
      },
      {
          name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "✦ Kontak Owner",
          id: `${m.prefix}owner`,
         }),
        },
      ];  
    
    const ftroliQuoted18 = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast",
      },
      message: {
        orderMessage: {
          orderId: "88888888888888",
          thumbnail:
            (await (await getSharp())(getCachedAsset("ichigo2"))
              .resize({ width: 300, height: 300 })
              .toBuffer()) || null,
          itemCount: totalCmds,
          status: "INQUIRY",
          surface: "CATALOG",
          message: `✦ ${config.bot.name} ✦`,
          orderTitle: `✦ ${totalCmds} Fitur Tersedia`,
          sellerJid: botConfig.botNumber
            ? `${botConfig.botNumber}@s.whatsapp.net`
            : m.sender,
          token: "ichigo-menu-v18",
          totalAmount1000: 1800000,
          totalCurrencyCode: "IDR",
          contextInfo: {
            isForwarded: true,
            forwardingScore: 18,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 218,
            },
          },
        },
      },
    };

    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: `✧ ʜᴀʟᴏ ${m.pushName}! ᴀᴋᴜ ${botConfig.bot?.name || "Mizee-Bot"}, siaᴘ ᴍᴇᴍʙᴀɴᴛᴜᴍᴜ ✧`,
          footer: [
            `┌─「 *𝖴𝗌𝖾𝗋* 」`,
            `│  • ɴᴀᴍᴀ    : *${m.pushName}*`,
            `│  • ʀᴏʟᴇ    : *${roleBadge}*`,
            `│  • ᴋᴏɪɴ   : *${userKoin.toLocaleString()}*`,
            `│  • ᴇɴᴇʀɢɪ  : *${userEnergi}*`,
            `├─「 *𝖡𝗈𝗍* 」`,
            `│  • ᴠᴇʀsɪ    : *v${botConfig.bot?.version || "2.1.0"}*`,
            `│  • ᴍᴏᴅᴇ    : *${(botConfig.mode || "public").toUpperCase()}*`,
            `│  • ᴘʀᴇғɪx  : *[ ${prefix} ]*`,
            `│  • ғɪᴛᴜʀ   : *${totalCmds} ᴘᴇʀɪɴᴛᴀʜ*`,
            `├─「 *𝖶𝖺𝗄𝗍𝗎* 」`,
            `│  • ʜᴀʀɪ    : *${hariIni}*`,
            `│  • ᴛᴀɴɢɢᴀʟ : *${tanggal}*`,
            `│  • ᴡɪʙ     : *${jamWib}*`,
            `│  • ᴡɪᴛᴀ    : *${jamWita}*`,
            `│  • ᴄᴜᴀᴄᴀ  : *ʙᴜʟᴜᴋᴜᴍʙᴀ - ${cuacaBulukumba}*`,
            `├─「 *🔥 ᴛᴏᴘ ғɪᴛᴜʀ* 」`,
            ...top10Lines,
            `└──✧`,
          ].join("\n") + PANEL_FOOT,
          image: getCachedAsset("ichigo"),
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 18,
            isForwarded: true,
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              limited_time_offer: {
                text: `✧ ${greeting}, ${m.pushName}!`,
                url: "",
                copy_code: "",
                expiration_time: null,
              },
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 3, 4, 999],
                list_title: "Pilih Menu Yang Kalian Mau",
                button_title: "✦ Pilih Opsi",
              },
              tap_target_configuration: {
                title: "✦",
                description: "ichigo-v18",
                canonical_url: "https://ichigo.site",
                domain: "ichigo.site",
                button_index: 0,
              },
            }),
            buttons: buttons18,
          },
        },
      },
      { quoted: ftroliQuoted18 },
    );
  } catch (v18Error) {
    console.log(v18Error);
    await sendFallback(
      m,
      sock,
      text,
      imageBuffer,
      thumbBuffer,
      botConfig,
      "V18",
    );
  }
       break;
      case 6:
  try {
    const catDesc19 = {
      owner:      "ᴘᴇʀɪɴᴛᴀʜ ᴋʜᴜsᴜs ᴜɴᴛᴜᴋ ᴘᴇᴍɪʟɪᴋ ʙᴏᴛ",
      anime:      "ᴀɴɪᴍᴇ ᴅᴀɴ ᴍᴀɴɢᴀ ꜰᴀᴠᴏʀɪᴛᴇ ᴋᴀᴍᴜ",
      asupan:     "ᴋᴏɴᴛᴇɴ ᴀsᴜᴘᴀɴ ʜᴀʀɪᴀɴ",
      clan:       "sɪsᴛᴇᴍ ᴋʟᴀɴ ᴅᴀɴ ᴋᴏᴍᴜɴɪᴛᴀs",
      convert:    "ᴋᴏɴᴠᴇʀsɪ ꜰɪʟᴇ ᴅᴀɴ ꜰᴏʀᴍᴀᴛ",
      downloader: "ᴜɴᴅᴜʜ ᴅᴀʀɪ ʙᴇʀʙᴀɢᴀɪ ᴘʟᴀᴛꜰᴏʀᴍ",
      berita:     "ʙᴇʀɪᴛᴀ ᴅᴀɴ ɪɴꜰᴏʀᴍᴀsɪ ᴛᴇʀᴋɪɴɪ",
      islamic:    "ᴋᴏɴᴛᴇɴ ɪsʟᴀᴍɪ ᴅᴀɴ ʀᴇʟɪɢɪ",
      rpg:        "ᴘᴇᴛᴜᴀʟᴀɴɢᴀɴ ʀᴏʟᴇᴘʟᴀʏ ɢᴀᴍᴇ",
      linode:     "ᴍᴀɴᴀᴊᴇᴍᴇɴ ʟɪɴᴏᴅᴇ ᴠᴘs",
      primbon:    "ᴘʀɪᴍʙᴏɴ ᴅᴀɴ ʀᴀᴍᴀʟᴀɴ ᴊᴀᴡᴀ",
      cecan:      "ꜰɪᴛᴜʀ ᴄᴇᴄᴀɴ ᴅᴀɴ ᴄᴏᴍᴇᴅʏ",
      stalker:    "ᴄᴇᴋ ᴘʀᴏꜰɪʟ ᴅᴀɴ ᴅᴀᴛᴀ sᴏsɪᴀʟ",
      tts:        "ᴛᴇxᴛ ᴛᴏ sᴘᴇᴇᴄʜ ᴅᴀɴ ꜱᴜᴀʀᴀ",
      vps:        "ᴍᴀɴᴀᴊᴇᴍᴇɴ ᴠᴘs ᴅᴀɴ sᴇʀᴠᴇʀ",
      main:       "ᴍᴇɴᴜ ᴜᴛᴀᴍᴀ ᴅᴀɴ ɪɴꜰᴏʀᴍᴀsɪ ʙᴏᴛ",
      utility:    "ᴀʟᴀᴛ ʙᴀɴᴛᴜ ᴅᴀɴ ᴜᴛɪʟɪᴛᴀs ᴜᴍᴜᴍ",
      tools:      "ᴛᴏᴏʟs ʟᴇɴɢᴋᴀᴘ ᴜɴᴛᴜᴋ ʙᴇʀʙᴀɢᴀɪ ᴋᴇʙᴜᴛᴜʜᴀɴ",
      fun:        "ʜɪʙᴜʀᴀɴ ᴅᴀɴ ᴋᴏɴᴛᴇɴ sᴇʀᴜ",
      game:       "ᴋᴜᴍᴘᴜʟᴀɴ ᴘᴇʀᴍᴀɪɴᴀɴ sᴇʀᴜ",
      download:   "ᴜɴᴅᴜʜ ᴠɪᴅᴇᴏ, ᴍᴜsɪᴋ, ᴅᴀɴ ᴍᴇᴅɪᴀ sᴏsᴍᴇᴅ",
      search:     "ᴘᴇɴᴄᴀʀɪᴀɴ ɪɴꜰᴏʀᴍᴀsɪ sᴇᴄᴀʀᴀ ɢʟᴏʙᴀʟ",
      sticker:    "ʙᴜᴀᴛ ᴅᴀɴ ᴄᴀʀɪ sᴛɪᴋᴇʀ ᴋᴇʀᴇɴ",
      media:      "ᴏʟᴀʜ ᴅᴀɴ ᴇᴅɪᴛ ᴍᴇᴅɪᴀ",
      ai:         "ꜰɪᴛᴜʀ ᴋᴇᴄᴇʀᴅᴀsᴀɴ ʙᴜᴀᴛᴀɴ",
      group:      "ᴍᴀɴᴀᴊᴇᴍᴇɴ ᴅᴀɴ ᴘᴇɴɢᴀᴛᴜʀᴀɴ ɢʀᴜᴘ",
      religi:     "ᴋᴏɴᴛᴇɴ ɪsʟᴀᴍɪ ᴅᴀɴ ᴊᴀᴅᴡᴀʟ sʜᴏʟᴀᴛ",
      info:       "ɪɴꜰᴏʀᴍᴀsɪ ᴅᴀɴ ʙᴇʀɪᴛᴀ ᴛᴇʀᴋɪɴɪ",
      cek:        "ᴄᴇᴋ ʙᴇʀʙᴀɢᴀɪ ɪɴꜰᴏʀᴍᴀsɪ",
      economy:    "ꜰɪᴛᴜʀ ᴇᴋᴏɴᴏᴍɪ ᴅᴀɴ ᴛʀᴀɴsᴀᴋsɪ",
      user:       "ᴘʀᴏꜰɪʟ ᴅᴀɴ sᴛᴀᴛɪsᴛɪᴋ ᴘᴇɴɢɢᴜɴᴀ",
      canvas:     "ʙᴜᴀᴛ ɢᴀᴍʙᴀʀ ᴅᴀɴ ᴅᴇsᴀɪɴ ᴋʀᴇᴀᴛɪꜰ",
      random:     "ᴋᴏɴᴛᴇɴ ᴀᴄᴀᴋ ᴅᴀɴ ᴜɴɪᴋ",
      premium:    "ꜰɪᴛᴜʀ ᴇᴋsᴋʟᴜsɪꜰ ᴘᴇɴɢɢᴜɴᴀ ᴘʀᴇᴍɪᴜᴍ",
      panel:      "ᴘᴀɴᴇʟ ᴋᴏɴᴛʀᴏʟ ᴅᴀɴ ᴘᴇɴɢᴀᴛᴜʀᴀɴ",
      store:      "ᴅᴀꜰᴛᴀʀ ᴘʀᴏᴅᴜᴋ ᴅᴀɴ ʟᴀʏᴀɴᴀɴ ᴅɪɢɪᴛᴀʟ",
    };

    const catRows19 = menuSorted.map(({ cat, emoji }) => ({
      title: `${emoji} ${toMonoUpperBold(cat)}`,
      description: catDesc19[cat] || `ᴋᴀᴛᴇɢᴏʀɪ ${cat}`,
      id: `${prefix}menucat ${cat}`,
    }));

    const userData19 = db.getUser(m.sender) || {};
    const _isVipActive19 = db.isVipActive
      ? db.isVipActive(m.sender)
      : (userData19?.isVip && (!userData19.vipExpired || userData19.vipExpired === -1 || Date.now() < userData19.vipExpired));

    const userRole19 = m.isOwner
      ? "OWNER"
      : _isVipActive19
      ? "VIP"
      : m.isPremium
      ? "PREMIUM"
      : m.isPartner
      ? "PARTNER"
      : (userData19?.role || "MEMBER").toUpperCase();

    const userExp19    = userData19.exp    || 0;
    const userLevel19  = Math.floor(userExp19 / 20000) + 1;
    const userEnergi19 = m.isOwner || _isVipActive19 || m.isPremium ? "∞" : (userData19.energi ?? 25);

    const roleBadge19 = {
      OWNER:   "👑 ᴏᴡɴᴇʀ",
      VIP:     "🔷 ᴠɪᴘ",
      ADMIN:   "🛡️ ᴀᴅᴍɪɴ",
      PREMIUM: "💎 ᴘʀᴇᴍɪᴜᴍ",
      PARTNER: "🤝 ᴘᴀʀᴛɴᴇʀ",
      MEMBER:  "✦ ᴍᴇᴍʙᴇʀ",
    }[userRole19] || "✦ ᴍᴇᴍʙᴇʀ";

    const rank19 =
      userLevel19 >= 50 ? "🏆 ʟᴇɢᴇɴᴅ" :
      userLevel19 >= 30 ? "💠 ᴍᴀsᴛᴇʀ" :
      userLevel19 >= 20 ? "🥇 ᴇxᴘᴇʀᴛ" :
      userLevel19 >= 10 ? "🥈 ᴀᴅᴠᴀɴᴄᴇᴅ" :
      userLevel19 >= 5  ? "🥉 ɪɴᴛᴇʀᴍᴇᴅɪᴀᴛᴇ" :
      "🌱 ɴᴇᴡʙɪᴇ";

    const _pad19  = (n) => String(n).padStart(2, "0");
    const _now19  = new Date();
    const _wita19 = new Date(_now19.getTime() + 8 * 60 * 60 * 1000);
    const jamWita19 = `${_pad19(_wita19.getUTCHours())}:${_pad19(_wita19.getUTCMinutes())}`;

    const witaHour19 = _wita19.getUTCHours();
    const waktu19 =
      witaHour19 >= 4  && witaHour19 < 11 ? "🌤️ ᴘᴀɢɪ" :
      witaHour19 >= 11 && witaHour19 < 14 ? "☀️ sɪᴀɴɢ" :
      witaHour19 >= 14 && witaHour19 < 17 ? "🌤️ sᴏʀᴇ" :
      witaHour19 >= 17 && witaHour19 < 19 ? "🌆 ᴘᴇᴛᴀɴɢ" :
      witaHour19 >= 19 && witaHour19 < 24 ? "🌙 ᴍᴀʟᴀᴍ" :
      "🌌 ᴅɪɴɪ ʜᴀʀɪ";

    const hariList19 = ["ᴍɪɴɢɢᴜ","sᴇɴɪɴ","sᴇʟᴀsᴀ","ʀᴀʙᴜ","ᴋᴀᴍɪs","ᴊᴜᴍᴀᴛ","sᴀʙᴛᴜ"];
    const hariIni19  = hariList19[_wita19.getUTCDay()];
    const tanggal19  = `${_pad19(_wita19.getUTCDate())}/${_pad19(_wita19.getUTCMonth() + 1)}/${_wita19.getUTCFullYear()}`;

    const _os19 = await import("os");
    const _memUsed19  = ((_os19.totalmem() - _os19.freemem()) / 1024 / 1024 / 1024).toFixed(2);
    const _memTotal19 = (_os19.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const _memPct19   = (((_os19.totalmem() - _os19.freemem()) / _os19.totalmem()) * 100).toFixed(0);
    const nodeVer19   = process.version;

    const buttons19 = [
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }),
      },
      {
        name: "inapp_signup",
        buttonParamsJson: "{}",
      },
      {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "✦ ʙᴜᴋᴀ ᴍᴇɴᴜ",
          sections: [
            {
              title: "✦ ᴍᴇɴᴜ ᴜᴛᴀᴍᴀ",
              rows: [
                {
                  title: "✦ sᴇᴍᴜᴀ ꜰɪᴛᴜʀ",
                  description: "ᴛᴀᴍᴘɪʟᴋᴀɴ sᴇʟᴜʀᴜʜ ʟɪsᴛ ᴘᴇʀɪɴᴛᴀʜ ʙᴏᴛ",
                  id: `${prefix}allmenu`,
                },
                {
                  title: "✦ ᴋᴏɴᴛᴀᴋ ᴏᴡɴᴇʀ",
                  description: "ɪɴꜰᴏ ᴋᴏɴᴛᴀᴋ ᴘᴇɴɢᴇᴍʙᴀɴɢ ʙᴏᴛ",
                  id: `${prefix}owner`,
                },
                {
                  title: "✦ ᴘᴀɴᴅᴜᴀɴ ʙᴏᴛ",
                  description: "ᴄᴀʀᴀ ᴘᴀᴋᴀɪ ʙᴏᴛ, ᴀᴛᴜʀᴀɴ, ᴅᴀɴ ɪɴꜰᴏ ꜰɪᴛᴜʀ",
                  id: `${prefix}guide`,
                },
                {
                  title: "✦ ᴘʀᴏꜰɪʟ sᴀʏᴀ",
                  description: "ʟɪʜᴀᴛ sᴛᴀᴛɪsᴛɪᴋ ᴀᴋᴜɴ ᴋᴀᴍᴜ",
                  id: `${prefix}profile`,
                },
              ],
            },
            {
              title: "✦ ᴋᴀᴛᴇɢᴏʀɪ ꜰɪᴛᴜʀ ʙᴏᴛ",
              rows: catRows19,
            },
          ],
          has_multiple_buttons: true,
        }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ ᴏᴡɴᴇʀ", id: `${prefix}owner` }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ sᴇᴍᴜᴀ ᴍᴇɴᴜ", id: `${prefix}allmenu` }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘᴀɴᴅᴜᴀɴ", id: `${prefix}guide` }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘɪɴɢ", id: `${prefix}ping` }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ ʀᴜʟᴇs ʙᴏᴛ", id: `${prefix}rules` }),
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "✦ ᴘʀᴏꜰɪʟ", id: `${prefix}profile` }),
      },
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "✦ sᴀʟᴜʀᴀɴ ᴏᴡɴᴇʀ",
          url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
          merchant_url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
        }),
      },
    ];

    const ftroliQuoted19 = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast",
      },
      message: {
        orderMessage: {
          orderId: "77777777777777",
          thumbnail: (await (await getSharp())(getCachedAsset("ichigo2"))
            .resize({ width: 300, height: 300 })
            .toBuffer()) || null,
          itemCount: totalCmds,
          status: "INQUIRY",
          surface: "CATALOG",
          message: `✦ ${botConfig.bot?.name || "ᴄʟᴏᴜᴅ sᴛʀɪꜰᴇ"} ✦`,
          orderTitle: `✦ ${totalCmds} ꜰɪᴛᴜʀ ᴛᴇʀsᴇᴅɪᴀ`,
          sellerJid: botConfig.botNumber
            ? `${botConfig.botNumber}@s.whatsapp.net`
            : m.sender,
          token: "ichigo-menu-v19",
          totalAmount1000: 1700000,
          totalCurrencyCode: "IDR",
          contextInfo: {
            isForwarded: true,
            forwardingScore: 17,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 217,
            },
          },
        },
      },
    };

    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: `✦ ʜᴀʟᴏ ${m.pushName}! ꜱᴇɴᴀɴɢ ʙᴇʀᴛᴇᴍᴜ ᴅᴇɴɢᴀɴᴍᴜ~ ᴀᴋᴜ ${botConfig.bot?.name || "ᴄʟᴏᴜᴅ sᴛʀɪꜰᴇ"}, ʙᴏᴛ ᴘɪɴᴛᴀʀᴍᴜ ʏᴀɴɢ sɪᴀᴘ ᴍᴇᴍʙᴀɴᴛᴜ ᴋᴀᴘᴀɴ sᴀᴊᴀ ✦`,
          footer: [
            `「 ᴜsᴇʀ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 」`,
            `▸ ɴᴀᴍᴀ    : ${m.pushName}`,
            `▸ ʀᴏʟᴇ    : ${roleBadge19}`,
            `▸ ʀᴀɴᴋ    : ${rank19}`,
            `▸ ʟᴇᴠᴇʟ   : ${userLevel19}`,
            `▸ ᴇɴᴇʀɢɪ  : ${userEnergi19}`,
            ``,
            `「 ʙᴏᴛ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 」`,
            `▸ ᴠᴇʀsɪ   : v${botConfig.bot?.version || "2.1.0"}`,
            `▸ ᴘʀᴇꜰɪx  : [ ${prefix} ]`,
            `▸ ᴜᴘᴛɪᴍᴇ  : ${uptimeFormatted}`,
            `▸ ᴏᴡɴᴇʀ   : ${botConfig.owner?.name || "Ichigo Strife"}`,
            ``,
            `「 sʏsᴛᴇᴍ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 」`,
            `▸ ᴡᴀᴋᴛᴜ    : ${waktu19}, ${hariIni19} ${tanggal19}`,
            `▸ ᴊᴀᴍ ᴡɪᴛᴀ : ${jamWita19}`,
            `▸ ʟɪʙʀᴀʀʏ  : ichigo-baileys`,
            `▸ ɴᴏᴅᴇ.ᴊs  : ${nodeVer19}`,
            `▸ ʀᴀᴍ      : ${_memUsed19}GB / ${_memTotal19}GB (${_memPct19}%)`,
          ].join("\n") + PANEL_FOOT,
          image: getCachedAsset("ichigo"),
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 19,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: "120363409557700746@newsletter",
              newsletterName: "kazeey77",
              serverMessageId: 219,
            },
            stanzaId: m.key?.id,
            participant: m.key?.participant || m.sender,
            remoteJid: m.chat,
            quotedMessage: m.message,
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              limited_time_offer: {
                text: `✦ ${greeting}, ${m.pushName}!`,
                url: "",
                copy_code: "",
                expiration_time: null,
              },
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 3, 4, 5, 999],
                list_title: "ꜱɪʟᴀʜᴋᴀɴ ᴘɪʟɪʜ ᴍᴇɴᴜ ʏᴀɴɢ ᴋᴀᴍᴜ ɪɴɢɪɴᴋᴀɴ",
                button_title: "ᴛᴀᴘ ᴅɪsɪɴɪ",
              },
              tap_target_configuration: {
                title: "✦",
                description: "ichigo-v19",
                canonical_url: "https://ichigo.site",
                domain: "ichigo.site",
                button_index: 0,
              },
            }),
            buttons: buttons19,
          },
        },
      },
      { quoted: ftroliQuoted19 },
    );
  } catch (v19Error) {
    console.log(v19Error);
    await sendFallback(
      m,
      sock,
      text,
      imageBuffer,
      thumbBuffer,
      botConfig,
      "V19",
    );
  }
      break;
      case 7: {
        const sharp = getSharp();
        const getAssetBuffer = (name) => {
          const buf = getCachedAsset(name);
          if (!buf) throw new Error(`Asset ${name} tidak tersedia`);
          return buf;
        };

        const body11 = `🥞 *Hello Brother*

Welcome to ${config.bot?.name}, Our bot will help you

🍅 *BOT INFORMATION*
> 🤖 *Name*: ${config.bot?.name}
> ⚙️ *Version*: ${config.bot?.version}
> 👨‍💻 *Developer*: ${config.bot?.developer}
> 🧩 *Library*: \`ichigo-baileys\`

🍅 *USER INFORMATION*
> 🧑 *Name*: ${m.pushName}
> 🥐 *Role*: ${m?.isOwner ? "🔥 Owner" : m?.isPremium ? "👑 Premium" : "😊 User"}
> 🧀 *Level*: ${user.level || 0}
> 🍗 *Exp*: ${user.exp || 0}
> 🥩 *Energi*: ${user.energi || 0}
> 🎏 *Koin*: ${user.koin || 0}
> 🍬 *Register*: ${user.isRegistered ? "Sudah" : "Belum"}`;

        const footer11 = '🍔 Silahkan pilih dari salah satu tombol di bawah' + PANEL_FOOT;

        try {
          const btn11 = new Button(sock);
          btn11.setImage(await sharp(await loadAssetBuffer("ichigo")).resize(300, 170).toBuffer());
          btn11
            .setBody(body11)
            .setFooter(footer11)
            .setContextInfo({ mentionedJid: [m.sender] })
            .addButton('quick_reply', { display_text: '🧀 Owner', id: `${prefix}owner` })
            .addButton('quick_reply', { display_text: '💐 Allmenu', id: `${prefix}allmenu` });

          await btn11.send(m.chat, { quoted: m });
        } catch (e11) {
          console.error('[Menu Case 11 ERROR]', e11);
          await m.reply(`${body11}\n\n${footer11}`);
        }
        break;
      }

      case 8: {
        const sharp = getSharp();
        const getAssetBuffer = (name) => {
          const buf = getCachedAsset(name);
          if (!buf) throw new Error(`Asset ${name} tidak tersedia`);
          return buf;
        };

        const categories = getSortedCategories(m, botMode);
        const prefix = config.command?.prefix || ".";

        let s = ""
        categories.sorted.map(({ cat, cmds, emoji }) => {
          s += `╭─☰ ${toMonoUpperBold(cat)}\n`
          cmds.map((cmd) => {
            s += `> ${m.prefix}${cmd}\n`
          })
          s += "╰─⬣\n\n"
        });
        const media = await prepareWAMessageMedia({
          image: await loadAssetBuffer("ichigo")
        }, { upload: sock.waUploadToServer })
        const readmore = String.fromCharCode(8206).repeat(4001)
        const greeting = getTimeGreeting();
        
        await sock.relayMessage(
          m.chat,
          {
            viewOnceMessage: {
              message: {
                messageContextInfo: {},
                interactiveMessage: {
                  header: {
                    title: "",
                    subtitle: "",
                    hasMediaAttachment: true,
                    imageMessage: media.imageMessage
                  },
                  body: {
                    text: `🥞 *Hello Brother*

Welcome to ${config.bot?.name}, Our bot will help you

🍅 *BOT INFORMATION*
> 🤖 *Name*: ${config.bot?.name}
> ⚙️ *Version*: ${config.bot?.version}
> 👨‍💻 *Developer*: ${config.bot?.developer}
> 🧩 *Library*: \`ichigo-baileys\`

🍅 *USER INFORMATION*
> 🧑 *Name*: ${m.pushName}
> 🥐 *Role*: ${m?.isOwner ? "🔥 Owner" : m?.isPremium ? "👑 Premium" : "😊 User"}
> 🧀 *Level*: ${user.level || 0}
> 🍗 *Exp*: ${user.exp || 0}
> 🥩 *Energi*: ${user.energi || 0}
> 🎏 *Koin*: ${user.koin || 0}
> 🍬 *Register*: ${user.isRegistered ? "Sudah" : "Belum"}

${readmore}${s}`
                  },
                  footer: {
                    text: "Pilih tombol dibawah untuk info lebih lanjut" + PANEL_FOOT
                  },
                  contextInfo: {
                    isForwarded: true,
                    fprwardingScore: 9,
                    participant: "0@s.whatsapp.net",
                    quotedMessage: {
                      conversation: `${config.bot?.name}`
                    },
                    mentionedJid: [
                      `${m.sender}`
                    ]
                  },
                  nativeFlowMessage: {
                    messageParamsJson: JSON.stringify({
                      limited_time_offer: {
                        text: `${greeting}`,
                        url: "Hai",
                        copy_code: "Dibuat oleh " + config.bot?.developer,
                        expiration_time: Date.now() + 1000000,
                      },
                      bottom_sheet: {
                        in_thread_buttons_limit: 2,
                        divider_indices: [1, 2, 3, 4, 5, 999],
                        list_title: "Silahkan pilih menu yang kamu inginkan",
                        button_title: "🍅 Selengkapnya",
                      },
                      tap_target_configuration: {
                        title: " X ",
                        description: "bomboclard",
                        canonical_url: "https://ichigo.site",
                        domain: "shop.example.com",
                        button_index: 0,
                      },
                    }),
                    buttons: [
                      {
                        name: "single_select",
                        buttonParamsJson: JSON.stringify({
                          has_multiple_buttons: true
                        })
                      },
                      {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                          display_text: "🍫 Owner Kami",
                          url: `https://wa.me/${botConfig.owner?.number?.[0]}`,
                          merchant_url: `https://wa.me/${config.owner?.number?.[0]}`,
                        })
                      },
                      {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                          display_text: "🍛 Dapatkan Script ( Gratis )",
                          id: `${m.prefix}sc`
                        })
                      }
                    ]
                  }
                }
              }
            }
          },
          {}
        );
        break;
      }
       case 9: {
  const sharp = getSharp();

  const userData13 = db.getUser(m.sender) || {};
  const userRole13 = m.isOwner ? "👑 ᴏᴡɴᴇʀ" : m.isPremium ? "💎 ᴘʀᴇᴍɪᴜᴍ" : "✦ ᴍᴇᴍʙᴇʀ";
  const userEnergi13 = m.isOwner || m.isPremium ? "∞" : (userData13.energi ?? 25);
  const userKoin13 = userData13.koin || 0;

  const _pad13 = (n) => String(n).padStart(2, "0");
  const _now13 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const jamWita13 = `${_pad13(_now13.getHours())}:${_pad13(_now13.getMinutes())}`;
  const hariList13 = ["ᴍɪɴɢɢᴜ","sᴇɴɪɴ","sᴇʟᴀsᴀ","ʀᴀʙᴜ","ᴋᴀᴍɪs","ᴊᴜᴍᴀᴛ","sᴀʙᴛᴜ"];
  const hariIni13 = hariList13[_now13.getDay()];
  const tanggal13 = `${_pad13(_now13.getDate())}/${_pad13(_now13.getMonth() + 1)}/${_now13.getFullYear()}`;
  const waktuHour13 = _now13.getHours();
  const waktu13 =
    waktuHour13 >= 4  && waktuHour13 < 11 ? "ᴘᴀɢɪ" :
    waktuHour13 >= 11 && waktuHour13 < 14 ? "sɪᴀɴɢ" :
    waktuHour13 >= 14 && waktuHour13 < 17 ? "sᴏʀᴇ" :
    waktuHour13 >= 17 && waktuHour13 < 19 ? "ᴘᴇᴛᴀɴɢ" :
    waktuHour13 >= 19 ? "ᴍᴀʟᴀᴍ" : "ᴅɪɴɪ ʜᴀʀɪ";

  let cuaca13 = "—";
  let sunrise13 = "06:03";
  let sunset13 = "17:52";
  try {
    const _r13 = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-5.56&longitude=120.19&current=temperature_2m,weathercode&daily=sunrise,sunset&timezone=Asia%2FMakassar",
      { signal: AbortSignal.timeout(5000) }
    );
    if (_r13.ok) {
      const _d13 = await _r13.json();
      const suhu13 = _d13.current?.temperature_2m;
      const kode13 = _d13.current?.weathercode;
      const icon13 = kode13 <= 1 ? "☀️" : kode13 <= 3 ? "⛅" : kode13 <= 67 ? "🌧️" : "🌩️";
      cuaca13 = `ʙᴜʟᴜᴋᴜᴍʙᴀ ${suhu13}°ᴄ ${icon13}`;
      const sr = _d13.daily?.sunrise?.[0];
      const ss = _d13.daily?.sunset?.[0];
      if (sr) sunrise13 = sr.split("T")[1]?.slice(0, 5) || sunrise13;
      if (ss) sunset13 = ss.split("T")[1]?.slice(0, 5) || sunset13;
    }
  } catch {}

  const catRows13 = menuSorted.map(({ cat, emoji, cmds }) => ({
    header: emoji,
    title: toSmallCaps(cat),
    description: `${cmds.length} ${toSmallCaps('perintah')}`,
    id: `${prefix}menucat ${cat}`,
  }));

  const salam13 =
    waktu13 === "ᴘᴀɢɪ"   ? "sᴇʟᴀᴍᴀᴛ ᴘᴀɢɪ" :
    waktu13 === "sɪᴀɴɢ"  ? "sᴇʟᴀᴍᴀᴛ sɪᴀɴɢ" :
    waktu13 === "sᴏʀᴇ"   ? "sᴇʟᴀᴍᴀᴛ sᴏʀᴇ" :
    waktu13 === "ᴘᴇᴛᴀɴɢ" ? "sᴇʟᴀᴍᴀᴛ ᴘᴇᴛᴀɴɢ" :
    "sᴇʟᴀᴍᴀᴛ ᴍᴀʟᴀᴍ";

  const body13 = `✦ ${salam13} ${m.pushName}! ᴀᴋᴜ ${botConfig.bot?.name || "ᴍɪᴢᴇᴇ ʙᴏᴛ"}, sɪᴀᴘ ᴍᴇᴍʙᴀɴᴛᴜᴍᴜ ᴋᴀᴘᴀɴ sᴀᴊᴀ ✦`;

  const footer13 = [
    `〔 ᴘʀᴏꜰɪʟ 〕`,
    `ɴᴀᴍᴀ    : ${m.pushName}`,
    `ʀᴏʟᴇ    : ${userRole13}`,
    `ᴋᴏɪɴ    : ${userKoin13.toLocaleString()}`,
    `ᴇɴᴇʀɢɪ  : ${userEnergi13}`,
    ``,
    `〔 ɪɴꜰᴏ ʙᴏᴛ 〕`,
    `ᴠᴇʀsɪ   : ${botConfig.bot?.version || "2.1.0"}`,
    `ꜰɪᴛᴜʀ   : ${totalCmds} ᴘᴇʀɪɴᴛᴀʜ`,
    `ᴜᴘᴛɪᴍᴇ  : ${uptimeFormatted}`,
    `ᴜsᴇʀ    : ${db.getUserCount()} ᴏʀᴀɴɢ`,
    ``,
    `〔 ᴡᴀᴋᴛᴜ 〕`,
    `${hariIni13}, ${tanggal13}`,
    `${waktu13} — ${jamWita13} ᴡɪᴛᴀ`,
    `ᴄᴜᴀᴄᴀ   : ${cuaca13}`,
    `ᴛᴇʀʙɪᴛ  : ${sunrise13} — ᴛᴇʀʙᴇɴᴀᴍ : ${sunset13}`,
  ].join("\n") + PANEL_FOOT;

  try {
    const btn13 = new Button(sock);
    if (imageBuffer) btn13.setImage(imageBuffer);

    btn13
      .setTitle(`✦ ${botConfig.bot?.name || "Mizee-Bot"}`)
      .setSubtitle(`${waktu13} — ${hariIni13}, ${tanggal13} — ${jamWita13} ᴡɪᴛᴀ`)
      .setBody(body13)
      .setFooter(footer13)
      .setContextInfo({
        mentionedJid: [m.sender],
        isForwarded: true,
        forwardingScore: 9,
        forwardedNewsletterMessageInfo: {
          newsletterJid: saluranId,
          newsletterName: saluranName,
          serverMessageId: 127,
        },
      })
      
      .addSelection(`✦ ${toSmallCaps('pilih menu')}`)
      .makeSection(`✦ ${toSmallCaps('menu utama')}`)
      .makeRow('🏠', toSmallCaps('semua fitur'), toSmallCaps('tampilkan seluruh list perintah'), `${prefix}allmenu`)
      .makeRow('👤', toSmallCaps('profil saya'), toSmallCaps('lihat statistik akun kamu'), `${prefix}profile`)
      .makeRow('📞', toSmallCaps('kontak owner'), toSmallCaps('info kontak pengembang bot'), `${prefix}owner`)
      .makeSection(`✦ ${toSmallCaps('kategori fitur')}`);

    const chunkSize13 = 10;
    for (let i = 0; i < catRows13.length; i++) {
      if (i > 0 && i % chunkSize13 === 0) {
        btn13.makeSection(`✦ ${toSmallCaps('lainnya')}`);
      }
      const row = catRows13[i];
      btn13.makeRow(row.header, row.title, row.description, row.id);
    }

    btn13
      .addReply(`✦ ${toSmallCaps('semua menu')}`, `${prefix}allmenu`)
      .addReply(`✦ ${toSmallCaps('support bot')}`, `${prefix}owner`)
      .setParams({
        bottom_sheet: {
          in_thread_buttons_limit: 2,
          divider_indices: [1, 2, 999],
          list_title: toSmallCaps('silahkan pilih menu'),
          button_title: toSmallCaps('tap disini'),
        },
      });

    await btn13.send(m.chat, { quoted: m });

  } catch (e13) {
    console.error('[Menu Case 13 ERROR]', e13);

    if (imageBuffer) {
      await sock.sendMessage(m.chat, {
        image: imageBuffer,
        caption: `${body13}\n\n${footer13}`,
      }, { quoted: m });
    } else {
      await m.reply(`${body13}\n\n${footer13}`);
    }
  }
  break;
       }
      case 10: {
        const sharp14 = getSharp();
        
        const userData14 = db.getUser(m.sender) || {};
        const _vip14 = db.isVipActive ? db.isVipActive(m.sender) : (userData14.isVip && (!userData14.vipExpired || userData14.vipExpired === -1 || Date.now() < userData14.vipExpired));
        const userRole14 = m.isOwner ? "👑 ᴏᴡɴᴇʀ" : _vip14 ? "💎 ᴠɪᴘ" : m.isPremium ? "🌟 ᴘʀᴇᴍɪᴜᴍ" : "✦ ᴍᴇᴍʙᴇʀ";
        const _pad14 = (n) => String(n).padStart(2, "0");
        const _now14 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jam14 = `${_pad14(_now14.getHours())}:${_pad14(_now14.getMinutes())}`;
        const tgl14 = `${_pad14(_now14.getDate())}/${_pad14(_now14.getMonth() + 1)}/${_now14.getFullYear()}`;

        const tglDaftar14 = userData14.registeredAt
          ? (() => {
              const d = new Date(userData14.registeredAt);
              return `${_pad14(d.getDate())}/${_pad14(d.getMonth() + 1)}/${d.getFullYear()}`;
            })()
          : "-";

        const footer14 = [
          `┌─「 ᴜsᴇʀ 」`,
          `│ @${m.sender.split("@")[0]}`,
          `│ ʀᴏʟᴇ : ${userRole14}`,
          `│ ᴅᴀꜰᴛᴀʀ : ${tglDaftar14}`,
          `├─「 ʙᴏᴛ 」`,
          `│ ${botConfig.bot?.name || "lyniX's MD"}  ·  v${botConfig.bot?.version || "2.1.0"}`,
          `│ ${totalCmds} ᴘᴇʀɪɴᴛᴀʜ  ·  ${db.getUserCount()} ᴜsᴇʀ`,
          `│ ᴜᴘᴛɪᴍᴇ ${uptimeFormatted}`,
          `└─「 ᴄʟᴏᴜᴅ sᴛʀɪғᴇ · ${tgl14.slice(0, 5)} ${jam14} 」`,
        ].join("\n") + PANEL_FOOT;

        const ppss14 = getCachedAsset("ichigo2");
        const thumbnail14 = await sharp14(ppss14).resize(300, 300).toBuffer();
        const _hour14 = _now14.getHours();
        const _greet14 = _hour14 >= 4 && _hour14 < 11 ? "🌅 Selamat Pagi" : _hour14 >= 11 && _hour14 < 15 ? "☀️ Selamat Siang" : _hour14 >= 15 && _hour14 < 18 ? "🌇 Selamat Sore" : "🌙 Selamat Malam";
        const titleText14 = `◈ *Halo, @${m.sender.split("@")[0]}!*\n${_greet14} ✦`;

        const catRows14 = menuSorted.map(({ cat, emoji, cmds }) => ({
          title: `${emoji} ${toSmallCaps(cat)}`,
          description: `${cmds.length} ᴘᴇʀɪɴᴛᴀʜ`,
          id: `${m.prefix}menucat ${cat}`,
        }));

        const qvideo14 = {
          key: { fromMe: false, participant: m.sender },
          message: {
            videoMessage: {
              caption: botConfig.bot?.name || "Mizee-Bot",
              seconds: 999999999,
              mimetype: "video/mp4",
              jpegThumbnail: thumbnail14,
              fileLength: "9999999",
            },
          },
        };

        const media14 = await prepareWAMessageMedia(
          { video: getCachedAsset("ichigo-mp4"), gifPlayback: true },
          { upload: sock.waUploadToServer },
        );

        const msg14 = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: {
                  title: "",
                  subtitle: "",
                  hasMediaAttachment: true,
                  videoMessage: media14.videoMessage,
                },
                body: { text: titleText14 },
                footer: { text: footer14 },
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
                nativeFlowMessage: {
                  buttons: [
                    {
                      name: "single_select",
                      buttonParamsJson: JSON.stringify({
                        title: "✦ ᴘɪʟɪʜ ᴍᴇɴᴜ",
                        sections: [
                          {
                            title: toSmallCaps("menu utama"),
                            rows: [
                              { title: `✦ ${toSmallCaps("semua fitur")}`, description: "ᴛᴀᴍᴘɪʟᴋᴀɴ sᴇʟᴜʀᴜʜ ʟɪsᴛ ᴘᴇʀɪɴᴛᴀʜ", id: `${m.prefix}allmenu` },
                              { title: `✦ ${toSmallCaps("profil saya")}`, description: "ʟɪʜᴀᴛ sᴛᴀᴛɪsᴛɪᴋ ᴀᴋᴜɴ", id: `${m.prefix}profile` },
                              { title: `✦ ${toSmallCaps("panduan bot")}`, description: "ᴄᴀʀᴀ ᴘᴀᴋᴀɪ ʙᴏᴛ", id: `${m.prefix}guide` },
                            ],
                          },
                          {
                            title: toSmallCaps("kategori fitur"),
                            rows: catRows14,
                          },
                        ],
                      }),
                    },
                    {
                      name: "cta_url",
                      buttonParamsJson: JSON.stringify({
                        display_text: "✦ sᴜᴘᴘᴏʀᴛ ʙᴏᴛ",
                        url: `https://wa.me/${botConfig.owner?.number?.[0]}`,
                        merchant_url: `https://wa.me/${botConfig.owner?.number?.[0]}`,
                      }),
                    },
                  ],
                },
              },
            },
          },
        }, { quoted: qvideo14, userJid: sock.user.jid });

        await sock.relayMessage(m.chat, msg14.message, {
          messageId: msg14.key.id,
        });

        const audioPath14 = path.join(process.cwd(), "assets", "audio", "ichigo.mp3");
        if (fs.existsSync(audioPath14)) {
          let thumb14 = null;
          try {
            thumb14 = await sharp14(ppss14)
              .resize({ width: 300, height: 300 })
              .toBuffer();
          } catch {}

          const orderQuoted14 = {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: "status@broadcast",
            },
            message: {
              orderMessage: {
                orderId: "14141414141414",
                thumbnail: thumb14,
                itemCount: 1,
                status: "INQUIRY",
                surface: "CATALOG",
                message: `♪ ᴍᴇᴍᴜᴛᴀʀ ʟᴀɢᴜ...`,
                orderTitle: `◈ ${botConfig.bot?.name || "lyniX's MD"}`,
                sellerJid: botConfig.botNumber
                  ? `${botConfig.botNumber}@s.whatsapp.net`
                  : m.sender,
                token: "ichigo-menu-v14",
                totalAmount1000: 0,
                totalCurrencyCode: "IDR",
                contextInfo: {
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              },
            },
          };

          try {
            await sock.sendMessage(
              m.chat,
              { audio: fs.readFileSync(audioPath14), mimetype: "audio/mpeg" },
              { quoted: orderQuoted14 },
            );
          } catch {
            await sock.sendMessage(
              m.chat,
              { audio: fs.readFileSync(audioPath14), mimetype: "audio/mp4" },
              { quoted: getVerifiedQuoted(botConfig) },
            );
          }
        }
        break;
      }
        case 11: {
        const weatherCode15 = {
          0: "☀️ ᴄᴇʀᴀʜ", 1: "🌤️ ᴄᴇʀᴀʜ ʙᴇʀᴀᴡᴀɴ", 2: "⛅ ʙᴇʀᴀᴡᴀɴ", 3: "☁️ ᴍᴇɴᴅᴜɴɢ",
          45: "🌫️ ʙᴇʀᴋᴀʙᴜᴛ", 48: "🌫️ ᴋᴀʙᴜᴛ ᴛᴇʙᴀʟ", 51: "🌦️ ɢᴇʀɪᴍɪs",
          61: "🌧️ ʜᴜᴊᴀɴ ʀɪɴɢᴀɴ", 63: "🌧️ ʜᴜᴊᴀɴ", 65: "⛈️ ʜᴜᴊᴀɴ ʟᴇʙᴀᴛ",
          80: "🌦️ ʜᴜᴊᴀɴ ʟᴏᴋᴀʟ", 95: "⛈️ ʙᴀᴅᴀɪ ᴘᴇᴛɪʀ",
        };

        async function weatherMenu15(city = "Jakarta") {
          try {
            const geo = await axios.get(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
            );
            const loc = geo.data.results?.[0];
            if (!loc) return toSmallCaps("cuaca tidak tersedia");
            const res = await axios.get(
              `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`
            );
            const current = res.data.current;
            const kondisi = weatherCode15[current.weather_code] || "🌍 Tidak diketahui";
            return `${kondisi} | 🌡️ ${Math.round(current.temperature_2m)}°ᴄ · ${toSmallCaps(loc.name)}`;
          } catch {
            return toSmallCaps("cuaca tidak tersedia");
          }
        }

        const _pad15 = (n) => String(n).padStart(2, "0");
        const _now15 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
        const jam15 = `${_pad15(_now15.getHours())}:${_pad15(_now15.getMinutes())}`;
        const tgl15 = `${_pad15(_now15.getDate())}/${_pad15(_now15.getMonth() + 1)}/${_now15.getFullYear()}`;
        
        const userData15 = db.getUser(m.sender) || {};
        const userLevel15 = Math.floor((userData15.exp || 0) / 10000) + 1;
        const userRole15 = m.isOwner ? "ᴏᴡɴᴇʀ" : m.isPremium ? "ᴘʀᴇᴍɪᴜᴍ" : "ᴍᴇᴍʙᴇʀ";

        const cuacaStr15 = await weatherMenu15("Bulukumba");

        const bodyText15 = `${toSmallCaps("hai")} @${m.sender.split("@")[0]}, ${toSmallCaps("saya " + (botConfig.bot?.name || "Ichigo Strife AI") + " siap melayani")} ✦`;

        const _t0_15 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
        const pingWA15 = Math.max(1, Date.now() - _t0_15);
        const pingBot15 = Math.round(performance.now() - _menuExecStart);
        const tglDaftar15 = userData15.registeredAt
          ? (() => {
              const d = new Date(userData15.registeredAt);
              return `${_pad15(d.getDate())}/${_pad15(d.getMonth() + 1)}/${d.getFullYear()}`;
            })()
          : "-";

        const footer15 = [
          `╭╮ ⊹₊˚ 𝗨𝘀𝗲𝗿 𝗜𝗻𝗳𝗼 ˚₊⊹`,
          `││  ◎˅ ${toItalicFont("Nama")} : ${toItalicFont(`@${m.sender.split("@")[0]}`)}`,
          `││  ◎˅ ${toItalicFont("Role")} : ${toItalicFont(userRole15)}`,
          `││  ◎˅ ${toItalicFont("Daftar")} : ${toItalicFont(tglDaftar15)}`,
          `╰╯`,
          ``,
          `╭╮ ⊹₊˚ 𝗕𝗼𝘁 𝗜𝗻𝗳𝗼 ˚₊⊹`,
          `││  ◎˅ ${toItalicFont("Nama")} : ${toItalicFont(botConfig.bot?.name || "lyniX's MD")}`,
          `││  ◎˅ ${toItalicFont("Versi")} : ${toItalicFont(`v${botConfig.bot?.version || "2.1.0"}`)}`,
          `││  ◎˅ ${toItalicFont("Fitur")} : ${toItalicFont(`${totalCmds} perintah`)}`,
          `││  ◎˅ ${toItalicFont("Owner")} : ${toItalicFont(botConfig.owner?.name || "Owner")}`,
          `││  ◎˅ ${toItalicFont("User")} : ${toItalicFont(String(db.getUserCount()))}`,
          `╰╯`,
          `⋆｡ﾟ✧ ${toItalicFont("Terima kasih sudah menggunakan bot ini")} ✧ﾟ｡⋆`,
        ].join("\n") + PANEL_FOOT;

        const catRows15 = menuSorted.map(({ cat, emoji, cmds }) => ({
          title: `${emoji} ${toSmallCaps(cat)}`,
          description: `${cmds.length} ${toSmallCaps("perintah")}`,
          id: `${prefix}menucat ${cat}`,
        }));

        const buttons15 = [
          { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
          { name: "inapp_signup", buttonParamsJson: "{}" },
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `✦ ${toSmallCaps("buka menu")}`,
              sections: [
                {
                  title: `✦ ${toSmallCaps("menu utama")}`,
                  rows: [
                    { title: `✦ ${toSmallCaps("semua fitur")}`, description: toSmallCaps("tampilkan seluruh list perintah bot"), id: `${prefix}allmenu` },
                    { title: `✦ ${toSmallCaps("profil saya")}`, description: toSmallCaps("lihat statistik akun kamu"), id: `${prefix}profile` },
                    { title: `✦ ${toSmallCaps("panduan bot")}`, description: toSmallCaps("cara pakai bot, aturan, dan info fitur"), id: `${prefix}guide` },
                    { title: `✦ ${toSmallCaps("kontak owner")}`, description: toSmallCaps("info kontak pengembang bot"), id: `${prefix}owner` },
                  ],
                },
                { title: `✦ ${toSmallCaps("kategori fitur")}`, rows: catRows15 },
              ],
              has_multiple_buttons: true,
            }),
          },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `✦ ${toSmallCaps("ping")}`, id: `${prefix}ping` }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `✦ ${toSmallCaps("profil")}`, id: `${prefix}profile` }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `✦ ${toSmallCaps("semua menu")}`, id: `${prefix}allmenu` }) },
          { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: `✦ ${toSmallCaps("panduan")}`, id: `${prefix}guide` }) },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `✦ ${toSmallCaps("saluran owner")}`,
              url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c",
              merchant_url: botConfig.saluran?.link || "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c",
            }),
          },
        ];

        const sharp = getSharp();
        let thumbnailBuf = thumbBuffer || imageBuffer || (getCachedAsset("ichigo2") || Buffer.alloc(0));
        let finalThumb15 = undefined;
        try {
          if (thumbnailBuf && thumbnailBuf.length > 0) {
          finalThumb15 = await sharp(thumbnailBuf)
  .resize(300, 300, { fit: 'cover' })
  .toBuffer();
          }
        } catch (e) {
          console.error("Gagal resize thumb menu case 11:", e);
        }

        const msg15 = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: {
                  hasMediaAttachment: true,
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                    name: botConfig.bot?.name || "lyniX's MD",
                    address: `${cuacaStr15}`,
                    jpegThumbnail: finalThumb15, 
                  },
                },
                body: { text: bodyText15 },
                footer: { text: footer15 },
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: { text: `✦ ${greeting}, ${m.pushName}!`, url: "", copy_code: "", expiration_time: null },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: toSmallCaps("silahkan pilih menu yang kamu inginkan"),
                      button_title: toSmallCaps("tap disini"),
                    },
                    tap_target_configuration: { title: "✦", description: "ichigo-v15", canonical_url: botConfig.saluran?.link || "https://ichigo.site", domain: "ichigo.site", button_index: 0 },
                  }),
                  buttons: buttons15,
                },
              },
            },
          },
        }, { quoted: m, userJid: sock.user.jid });

        await sock.relayMessage(m.chat, msg15.message, { messageId: msg15.key.id });

        const audioPath15 = path.join(process.cwd(), "assets", "audio", "ichigo.mp3");
        if (fs.existsSync(audioPath15)) {
          const textQuoted15 = {
            key: { fromMe: true, participant: sock.user.jid, remoteJid: m.chat },
            message: { conversation: `♪ ${toSmallCaps("memutar lagu")}...` },
          };
          try {
            await sock.sendMessage(m.chat, { audio: fs.readFileSync(audioPath15), mimetype: "audio/mpeg" }, { quoted: textQuoted15 });
          } catch {
            await sock.sendMessage(m.chat, { audio: fs.readFileSync(audioPath15), mimetype: "audio/mp4" }, { quoted: textQuoted15 });
          }
        }
        break;
      }
      case 12: {
        try {
          const _pad12 = (n) => String(n).padStart(2, "0");
          const _now12 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam12 = `${_pad12(_now12.getHours())}:${_pad12(_now12.getMinutes())}`;
          const tgl12 = `${_pad12(_now12.getDate())}-${_pad12(_now12.getMonth() + 1)}-${_now12.getFullYear()}`;
          const runtime12 = formatUptime(process.uptime() * 1000);
          const userRole12 = m.isOwner ? "Owner" : m.isPremium ? "Premium" : "User";
          const _t0_12 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
          const pingWA12 = Math.max(1, Date.now() - _t0_12);

          const _hour12 = _now12.getHours();
          const greetingEN12 =
            _hour12 < 11 ? "Good Morning" : _hour12 < 15 ? "Good Afternoon" : _hour12 < 19 ? "Good Evening" : "Good Night";

          const footer12 = [
            `┌ ${toItalicFont("『")} ${toMonoUpperBold("User Info")} ${toItalicFont("』")}`,
            `├◇ ${toSmallCaps("Name")}    : ${toSmallCaps(m.pushName || "User")}`,
            `├◇ ${toSmallCaps("Number")}  : ${toSmallCaps(m.sender.split("@")[0])}`,
            `├◇ ${toSmallCaps("Role")}    : ${toSmallCaps(userRole12)}`,
            `├◇ ${toSmallCaps("Date")}    : ${toSmallCaps(tgl12)}`,
            `├◇ ${toSmallCaps("Time")}    : ${toSmallCaps(`${jam12} WITA`)}`,
            `└◈───────────◈`,
            ``,
            `┌ ${toItalicFont("『")} ${toMonoUpperBold("Bot Info")} ${toItalicFont("』")}`,
            `├◇ ${toSmallCaps("Name")}    : ${toSmallCaps(botConfig.bot?.name || "Bot")}`,
            `├◇ ${toSmallCaps("Owner")}   : ${toSmallCaps(botConfig.bot?.developer || "-")}`,
            `├◇ ${toSmallCaps("Version")} : ${toSmallCaps(`v${botConfig.bot?.version || "1.0.0"}`)}`,
            `├◇ ${toSmallCaps("Library")} : ${toSmallCaps("ichigo-baileys")}`,
            `├◇ ${toSmallCaps("Features")}: ${toSmallCaps(String(totalCmds))} command`,
            `├◇ ${toSmallCaps("Ping")}    : ${toSmallCaps(`${pingWA12}ms`)}`,
            `└◈───────────◈`,
            ``,
            `↓ ${toItalicFont("tap the menu button below to see the features")}`,
          ].join("\n") + PANEL_FOOT;

          const catRows12 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `${emoji} ${toSmallCaps(cat)}`,
            description: `${toSmallCaps("contains")} ${cmds.length} ${toSmallCaps("commands")}`,
            id: `${prefix}menucat ${cat}`,
          }));

          const paramsJson12 = JSON.stringify({
            title: `⌥ ${toSmallCaps("menu")}`,
            sections: [
              {
                title: `✦ ${toSmallCaps("general")}`,
                rows: [
                  {
                    title: `⌥ ${toSmallCaps("all commands")}`,
                    description: `${toSmallCaps(`show all ${totalCmds} commands`)}`,
                    id: `${prefix}allmenu`,
                  },
                ],
              },
              { title: `✦ ${toSmallCaps("feature categories")}`, rows: catRows12 },
            ],
          });

          let thumb12 = undefined;
          try {
            const sharp12 = getSharp();
            const thumbPath12 = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
            if (fs.existsSync(thumbPath12)) {
              thumb12 = await sharp12(fs.readFileSync(thumbPath12))
                .resize(300, 300, { fit: "cover" })
                .toBuffer();
            }
          } catch (eThumb12) {
            console.error("Gagal load thumb case 12:", eThumb12.message);
          }

          await sock.relayMessage(
            m.chat,
            {
              buttonsMessage: {
                buttons: [
                  {
                    buttonId: "kategori",
                    buttonText: { displayText: `⌥ ${toSmallCaps("menu")}` },
                    type: 1,
                    nativeFlowInfo: {
                      name: "single_select",
                      paramsJson: paramsJson12,
                    },
                  },
                  {
                    buttonId: `${prefix}owner`,
                    buttonText: { displayText: `⎋ ${toSmallCaps("owner")}` },
                    type: 1,
                  },
                ],
                locationMessage: {
                  name: `✦ ${botConfig.bot?.name || "Bot"} ✦`,
                  address: `⏱ ${runtime12} · ◷ ${jam12} WITA · ⌁ ${pingWA12}ms`,
                  jpegThumbnail: thumb12,
                },
                contentText: `${toSmallCaps("hello")}, @${m.sender.split("@")[0]} ⋆｡⋆\n${toSmallCaps(greetingEN12)}, ${toSmallCaps("have a nice day")} ☀️`,
                footerText: footer12,
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 999,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
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
            {}
          );
        } catch (e12) {
          console.error("[Menu Case 12]", e12.message);
          await m.reply(text);
        }
        break;
      }
      case 13: {
        try {
          const _pad13 = (n) => String(n).padStart(2, "0");
          const _now13 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam13 = `${_pad13(_now13.getHours())}:${_pad13(_now13.getMinutes())}`;
          const tgl13 = `${_pad13(_now13.getDate())}-${_pad13(_now13.getMonth() + 1)}-${_now13.getFullYear()}`;
          const userData13 = db.getUser(m.sender);
          const _vip13 = db.isVipActive
            ? db.isVipActive(m.sender)
            : (userData13?.isVip && (!userData13.vipExpired || userData13.vipExpired === -1 || Date.now() < userData13.vipExpired));
          const userRole13 = m.isOwner ? "Owner" : _vip13 ? "VIP" : m.isPremium ? "Premium" : "User";
          const _t0_13 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
          const pingWA13 = Math.max(1, Date.now() - _t0_13);

          const catRows13 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `${emoji} ${toSmallCaps(cat)}`,
            description: `${toSmallCaps("contains")} ${cmds.length} ${toSmallCaps("commands")}`,
            id: `${prefix}menucat ${cat}`,
          }));

          const buttons13 = [
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: `${toSmallCaps("menu")}`,
                sections: [
                  {
                    title: `✦ ${toSmallCaps("general")}`,
                    rows: [
                      {
                        title: `⎋ ${toSmallCaps("all commands")}`,
                        description: `${toSmallCaps(`show all ${totalCmds} commands`)}`,
                        id: `${prefix}allmenu`,
                      },
                      {
                        title: `⌥ ${toSmallCaps("owner")}`,
                        description: `${toSmallCaps("contact the bot owner")}`,
                        id: `${prefix}owner`,
                      },
                    ],
                  },
                  { title: `☰ ${toSmallCaps("feature categories")}`, rows: catRows13 },
                ],
              }),
            },
          ];

          const footer13 = [
            `┌ ${toItalicFont("『")} ${toMonoUpperBold("User Info")} ${toItalicFont("』")}`,
            `├◇ ${toSmallCaps("Name")}    : ${toSmallCaps(m.pushName || "User")}`,
            `├◇ ${toSmallCaps("Number")}  : ${toSmallCaps(m.sender.split("@")[0])}`,
            `├◇ ${toSmallCaps("Role")}    : ${toSmallCaps(userRole13)}`,
            `├◇ ${toSmallCaps("Date")}    : ${toSmallCaps(tgl13)}`,
            `├◇ ${toSmallCaps("Time")}    : ${toSmallCaps(`${jam13} WITA`)}`,
            `└◈───────────◈`,
            ``,
            `┌ ${toItalicFont("『")} ${toMonoUpperBold("Bot Info")} ${toItalicFont("』")}`,
            `├◇ ${toSmallCaps("Name")}    : ${toSmallCaps(botConfig.bot?.name || "Bot")}`,
            `├◇ ${toSmallCaps("Owner")}   : ${toSmallCaps(botConfig.bot?.developer || "-")}`,
            `├◇ ${toSmallCaps("Version")} : ${toSmallCaps(`v${botConfig.bot?.version || "1.0.0"}`)}`,
            `├◇ ${toSmallCaps("Library")} : ${toSmallCaps("ichigo-baileys")}`,
            `├◇ ${toSmallCaps("Features")}: ${toSmallCaps(String(totalCmds))} command`,
            `├◇ ${toSmallCaps("Ping")}    : ${toSmallCaps(`${pingWA13}ms`)}`,
            `└◈───────────◈`,
            ``,
            `↓ ${toItalicFont("tap the menu button below to see the features")}`,
          ].join("\n") + PANEL_FOOT;

          const _hour13 = _now13.getHours();
          const greetingEN13 =
            _hour13 < 11 ? "Good Morning" : _hour13 < 15 ? "Good Afternoon" : _hour13 < 19 ? "Good Evening" : "Good Night";

          await sock.sendMessage(
            m.chat,
            {
              interactiveMessage: {
                header: ``,
                title: ``,
                footer: footer13,
                image: fs.readFileSync(path.join(process.cwd(), "assets", "images", "ichigo.jpg")),
                contextInfo: {
                  mentionedJid: [m.sender],
                  forwardingScore: 7,
                  isForwarded: true,
                },
                nativeFlowMessage: {
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: `${botConfig.bot?.name || "Ichigo Asisten"} · ${greetingEN13}`,
                      url: "",
                      copy_code: "",
                      expiration_time: null,
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "Please choose a menu",
                      button_title: "Tap Here",
                    },
                  }),
                  buttons: buttons13,
                },
              },
            },
            { quoted: m },
          );
        } catch (e13) {
          console.error("[Menu Case 13]", e13.message);
          await m.reply(text);
        }
        break;
      }
      case 14: {
        try {
          const _pad14 = (n) => String(n).padStart(2, "0");
          const _now14 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
          const jam14 = `${_pad14(_now14.getHours())}.${_pad14(_now14.getMinutes())}`;
          const tgl14 = _now14.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

          const userData14 = db.getUser(m.sender) || {};
          const _vip14 = db.isVipActive
            ? db.isVipActive(m.sender)
            : (userData14?.isVip && (!userData14.vipExpired || userData14.vipExpired === -1 || Date.now() < userData14.vipExpired));
          const userRole14 = m.isOwner ? "Owner" : (_vip14 || m.isPremium) ? "Premium" : "Free User";

          const _t0_14 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
          const pingWA14 = Math.max(1, Date.now() - _t0_14);

          const sharp14 = getSharp();
          let thumbRaw14 = thumbBuffer || imageBuffer || (getCachedAsset("ichigo2") || Buffer.alloc(0));
          let finalThumb14 = undefined;
          try {
            if (thumbRaw14 && thumbRaw14.length > 0) {
              finalThumb14 = await sharp14(thumbRaw14).resize(300, 300, { fit: "cover" }).toBuffer();
            }
          } catch (eThumb14) {
            console.error("Gagal resize thumb menu case 14:", eThumb14.message);
          }

          const catRows14 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `ও ${toSansSerif(cat.charAt(0).toUpperCase() + cat.slice(1))}`,
            description: `${cmds.length} ${toSansSerif("perintah")}`,
            id: `${prefix}menucat ${cat}`,
          }));

          const buttons14 = [
            { name: "" },
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "Menu",
                sections: [
                  {
                    title: `🏠 ${toSansSerifBold("Menu Utama")}`,
                    highlight_label: toSansSerifBold("Populer"),
                    rows: [
                      { title: `ও ${toSansSerif("Semua Fitur")}`, description: `Menampilkan seluruh ${totalCmds} perintah bot`, id: `${prefix}allmenu` },
                      { title: `ও ${toSansSerif("Profil Saya")}`, description: "Lihat statistik akun kamu", id: `${prefix}profile` },
                      { title: `ও ${toSansSerif("Panduan Bot")}`, description: "Cara pakai bot, aturan, dan info fitur", id: `${prefix}guide` },
                      { title: `ও ${toSansSerif("Kontak Owner")}`, description: "Info kontak pengembang bot", id: `${prefix}owner` },
                    ],
                  },
                  { title: `📂 ${toSansSerifBold("Kategori Fitur Bot")}`, rows: catRows14 },
                ],
                icon: "DOCUMENT",
              }),
            },
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Owner",
                url: `https://wa.me/${String(Array.isArray(botConfig.owner?.number) ? botConfig.owner.number[0] : (botConfig.owner?.number || "")).replace(/[^0-9]/g, "")}`,
                webview_interaction: true,
                icon: "REVIEW",
              }),
            },
          ];

          const bodyText14 = `「 *${botConfig.bot?.name || "Ichigo Asisten"}* ${toSansSerifBold("MENU")} 」`;

          const footer14 = [
            `> 𖨆  ${toSansSerif("User")} : ${m.pushName || "User"}`,
            `> ☏︎ ${toSansSerif("Number")} : ${m.sender.split("@")[0]}`,
            `> ㋛︎ ${toSansSerif("Level")} : ${userData14.level || 0} • ${toSansSerif("Exp")}: ${userData14.exp || 0}`,
            `> ꨄ︎ ${toSansSerif("Status")} : ${userRole14}`,
            `> ۞ ${toSansSerif("Version")} : v${botConfig.bot?.version || "1.0.0"}`,
            `> ☀︎︎ ${toSansSerif("Ping")} : ${pingWA14}ms`,
            `> ❁ ${toSansSerif("Uptime Bot")} : ${uptimeFormatted}`,
            `> ⇱ ${toSansSerif("Waktu")} : ${tgl14} | ${jam14} WIB`,
            ``,
            `${toSansSerif(botConfig.bot?.name || "Ichigo Asisten")} ☃︎`,
          ].join("\n") + PANEL_FOOT;

          const msg14 = generateWAMessageFromContent(
            m.chat,
            {
              interactiveMessage: {
                header: {
                  hasMediaAttachment: true,
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                    name: botConfig.bot?.name || "Ichigo Asisten",
                    address: `📅 ${tgl14} | ${jam14} WIB`,
                    jpegThumbnail: finalThumb14,
                  },
                },
                body: { text: bodyText14 },
                footer: { text: footer14 },
                nativeFlowMessage: {
                  buttons: buttons14,
                  messageParamsJson: "",
                },
                contextInfo: {
                  mentionedJid: [m.sender],
                  isForwarded: true,
                  forwardingScore: 9,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: saluranId,
                    newsletterName: saluranName,
                    serverMessageId: 127,
                  },
                },
              },
            },
            { quoted: m, userJid: sock.user.jid },
          );

          await sock.relayMessage(m.chat, msg14.message, { messageId: msg14.key.id });
        } catch (e14) {
          console.error("[Menu Case 14]", e14.message);
          await m.reply(text);
        }
        break;
      }

      case 15: {
        try {
          const _pad15 = (n) => String(n).padStart(2, "0");
          const _now15 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam15 = `${_pad15(_now15.getHours())}.${_pad15(_now15.getMinutes())}`;
          const tgl15 = _now15.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

          const weatherCodes15 = {
            0: { label: "Cerah", emoji: "☀️" },
            1: { label: "Sebagian Cerah", emoji: "🌤️" },
            2: { label: "Berawan Sebagian", emoji: "⛅" },
            3: { label: "Mendung", emoji: "☁️" },
            45: { label: "Berkabut", emoji: "🌫️" },
            48: { label: "Kabut Beku", emoji: "🌫️" },
            51: { label: "Gerimis Ringan", emoji: "🌦️" },
            53: { label: "Gerimis Sedang", emoji: "🌦️" },
            55: { label: "Gerimis Lebat", emoji: "🌧️" },
            61: { label: "Hujan Ringan", emoji: "🌧️" },
            63: { label: "Hujan Sedang", emoji: "🌧️" },
            65: { label: "Hujan Lebat", emoji: "🌧️" },
            80: { label: "Hujan Lokal", emoji: "🌦️" },
            95: { label: "Badai Petir", emoji: "⛈️" },
          };
          let cuaca15 = botConfig.bot?.tagline || "simple bot";
          try {
            const wRes15 = await axios.get("https://api.open-meteo.com/v1/forecast", {
              params: { latitude: -5.1477, longitude: 119.4327, current_weather: true },
              timeout: 5000,
            });
            const code15 = wRes15.data?.current_weather?.weathercode;
            const temp15 = wRes15.data?.current_weather?.temperature;
            const info15 = weatherCodes15[code15] || { label: "Cerah", emoji: "🌡️" };
            cuaca15 = temp15 !== undefined ? `${info15.emoji} ${info15.label}, ${Math.round(temp15)}°C` : `${info15.emoji} ${info15.label}`;
          } catch (eWeather15) {
            console.error("Gagal ambil cuaca menu case 15:", eWeather15.message);
            
          }

          const userData15 = db.getUser(m.sender) || {};
          const _vip15 = db.isVipActive
            ? db.isVipActive(m.sender)
            : (userData15?.isVip && (!userData15.vipExpired || userData15.vipExpired === -1 || Date.now() < userData15.vipExpired));
          const userRole15 = m.isOwner ? "Owner" : (_vip15 || m.isPremium) ? "Premium" : "Free User";

          const sharp15 = getSharp();
          let thumbRaw15 = getCachedAsset("ichigo") || (thumbBuffer || imageBuffer || Buffer.alloc(0));
          let finalThumb15 = undefined;
          try {
            if (thumbRaw15 && thumbRaw15.length > 0) {
              finalThumb15 = await sharp15(thumbRaw15).resize(300, 300, { fit: "cover" }).toBuffer();
            }
          } catch (eThumb15) {
            console.error("Gagal resize thumb menu case 15:", eThumb15.message);
          }

          const sections15 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `${emoji}  ${toMonoUpperBold(cat)}`,
            rows: [
              {
                title: `↳ ${toSmallCaps("lihat semua")}`,
                description: toSmallCaps(`${cmds.length} command tersedia`),
                id: `${prefix}menucat ${cat}`,
              },
            ],
          }));

          const UMUM_ITEMS15 = [
            { emoji: "🌐", title: "semua fitur", desc: `${totalCmds} command tersedia`, id: `${prefix}allmenu` },
            { emoji: "🪪", title: "profil", desc: "lihat statistik akun kamu", id: `${prefix}profile` },
            { emoji: "📘", title: "panduan", desc: "cara pakai bot", id: `${prefix}guide` },
            { emoji: "👑", title: "owner", desc: "kontak pengembang bot", id: `${prefix}owner` },
          ];

          const buttons15 = [
            { name: "⌥ Menu" },
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "⌥ Menu",
                sections: [
                  {
                    title: `📂  ${toMonoUpperBold("umum")}`,
                    rows: UMUM_ITEMS15.map((it) => ({
                      title: `${it.emoji} ${toSmallCaps(it.title)}`,
                      description: toSmallCaps(it.desc),
                      id: it.id,
                    })),
                  },
                  ...sections15,
                ],
                icon: "DEFAULT",
              }),
            },
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Channel",
                url: saluranLink,
                icon: "PROMOTION",
              }),
            },
          ];

          const bodyText15 = `Selamat datang, @${m.sender.split("@")[0]}!`;

          const footer15 = [
            `╭⌬ ${toItalicFont("『")} ${toMonoUpperBold("Info Pengguna")} ${toItalicFont("』")}`,
            `│ ✦ ${toSmallCaps("Nama")}    : ${toSmallCaps(m.pushName || "User")}`,
            `│ ✦ ${toSmallCaps("Nomor")}   : ${toSmallCaps(m.sender.split("@")[0])}`,
            `│ ✦ ${toSmallCaps("Role")}    : ${toSmallCaps(userRole15)}`,
            `│ ✦ ${toSmallCaps("Tanggal")} : ${toSmallCaps(tgl15)}`,
            `│ ✦ ${toSmallCaps("Waktu")}   : ${toSmallCaps(`${jam15} WITA`)}`,
            `╰⌬───────────⌬`,
            ``,
            `╭⌬ ${toItalicFont("『")} ${toMonoUpperBold("Info Bot")} ${toItalicFont("』")}`,
            `│ ✦ ${toSmallCaps("Nama")}     : ${toSmallCaps(botConfig.bot?.name || "Bot")}`,
            `│ ✦ ${toSmallCaps("Owner")}    : ${toSmallCaps(botConfig.bot?.developer || "-")}`,
            `│ ✦ ${toSmallCaps("Versi")}    : ${toSmallCaps(`v${botConfig.bot?.version || "1.0.0"}`)}`,
            `│ ✦ ${toSmallCaps("Uptime")}   : ${toSmallCaps(uptimeFormatted)}`,
            `│ ✦ ${toSmallCaps("Commands")} : ${toSmallCaps(String(totalCmds))} command`,
            `│ ✦ ${toSmallCaps("Status")}   : ⌬ ${toSmallCaps("Online")}`,
            `╰⌬───────────⌬`,
            ``,
            `↓ ${toItalicFont("ketuk tombol menu di bawah untuk lihat fitur")}`,
          ].join("\n") + PANEL_FOOT;

          const msg15 = generateWAMessageFromContent(
            m.chat,
            {
              interactiveMessage: {
                header: {
                  title: "",
                  subtitle: `Online · ${jam15} WITA`,
                  hasMediaAttachment: true,
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                    name: botConfig.bot?.name || "Ichigo Asisten",
                    address: cuaca15,
                    jpegThumbnail: finalThumb15,
                    contextInfo: {
                      mentionedJid: [],
                      forwardingScore: 1,
                      isForwarded: true,
                    },
                  },
                },
                body: { text: bodyText15 },
                footer: { text: footer15 },
                nativeFlowMessage: {
                  buttons: buttons15,
                  messageParamsJson: JSON.stringify({
                    bottom_sheet: {
                      list_title: "Pilih Kategori",
                      button_title: "Lihat Menu",
                      in_thread_buttons_limit: 3,
                      divider_indices: [1, 2],
                    },
                    limited_time_offer: {
                      text: botConfig.bot?.name || "Ichigo Asisten",
                      url: saluranLink,
                      copy_code: (botConfig.bot?.name || "IchigoSync").replace(/\s+/g, ""),
                      expiration_time: Date.now() + 1000 * 60 * 60 * 24 * 30,
                    },
                  }),
                },
                contextInfo: {
                  mentionedJid: [m.sender],
                  forwardingScore: 1,
                  isForwarded: true,
                },
              },
            },
            { quoted: m, userJid: sock.user.jid },
          );

          await sock.relayMessage(m.chat, msg15.message, { messageId: msg15.key.id });
        } catch (e15) {
          console.error("[Menu Case 15]", e15.message);
          await m.reply(text);
        }
        break;
      }

      case 16: {
        try {
          const _pad16 = (n) => String(n).padStart(2, "0");
          const _now16 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam16 = `${_pad16(_now16.getHours())}.${_pad16(_now16.getMinutes())}`;
          const tgl16 = _now16.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

          const userData16 = db.getUser(m.sender) || {};
          const _vip16 = db.isVipActive
            ? db.isVipActive(m.sender)
            : (userData16?.isVip && (!userData16.vipExpired || userData16.vipExpired === -1 || Date.now() < userData16.vipExpired));
          const userRole16 = m.isOwner ? "Owner" : (_vip16 || m.isPremium) ? "Premium" : "Free User";

          const thumbRaw16 = getCachedAsset("ichigo") || (thumbBuffer || imageBuffer || Buffer.alloc(0));

          let media16 = null;
          try {
            if (thumbRaw16 && thumbRaw16.length > 0) {
              media16 = await prepareWAMessageMedia(
                { image: thumbRaw16 },
                { upload: sock.waUploadToServer },
              );
            }
          } catch (eMedia16) {
            console.error("Gagal siapkan gambar header menu case 16:", eMedia16.message);
          }

          const kategoriRows16 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `${emoji} ${toSmallCaps(cat)}`,
            description: toSmallCaps(`${cmds.length} commands available`),
            id: `${prefix}menucat ${cat}`,
          }));

          const buttons16 = [
            { name: "" },
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "Menu",
                sections: [
                  {
                    title: `🏠 ${toMonoUpperBold("Main Menu")}`,
                    highlight_label: toMonoUpperBold("Popular"),
                    rows: [
                      { title: toSmallCaps("all features"), description: toSmallCaps(`show all ${totalCmds} bot commands`), id: `${prefix}allmenu` },
                      { title: toSmallCaps("my profile"), description: toSmallCaps("view your account stats"), id: `${prefix}profile` },
                      { title: toSmallCaps("bot guide"), description: toSmallCaps("how to use the bot"), id: `${prefix}guide` },
                      { title: toSmallCaps("owner contact"), description: toSmallCaps("developer contact info"), id: `${prefix}owner` },
                    ],
                  },
                  {
                    title: `📂 ${toMonoUpperBold("Bot Feature Categories")}`,
                    highlight_label: toMonoUpperBold("More Features"),
                    rows: kategoriRows16,
                  },
                  {
                    title: `\u200b                     © ${botConfig.bot?.developer || botConfig.bot?.name || "Bot"}`,
                    highlight_label: saluranLink.includes("://") ? new URL(saluranLink).hostname : saluranLink,
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
                    title: toSmallCaps("support the owner"),
                    rows: [
                      { title: toSmallCaps("contact owner"), description: toSmallCaps("chat directly with the developer"), id: `${prefix}owner` },
                      { title: toSmallCaps("donate"), description: toSmallCaps("support bot development"), id: `${prefix}donasi` },
                    ],
                  },
                ],
                icon: "REVIEW",
              }),
            },
          ];

          const _greetHour16 = _now16.getHours();
          const englishGreeting16 =
            _greetHour16 >= 4 && _greetHour16 < 12
              ? "Good Morning 🌅"
              : _greetHour16 >= 12 && _greetHour16 < 15
                ? "Good Afternoon ☀️"
                : _greetHour16 >= 15 && _greetHour16 < 18
                  ? "Good Evening 🌇"
                  : "Good Night 🌙";
          const priceTag16 = botConfig.bot?.priceTag || "$9.99 USD";

          const statusEmoji16 = m.isOwner ? "👑" : (_vip16 || m.isPremium) ? "💎" : "🆓";
          const userEnergi16 =
            m.isOwner || m.isPremium || _vip16
              ? "∞"
              : (userData16.energi ?? 25);

          const bodyText16 = [
            `━━━━━━━━⊱⋆⊰━━━━━━━━`,
            `  ${toSansSerif(botConfig.bot?.name || "Bot")} ${toSansSerif("Assistant")} - ${_now16.getFullYear()}`,
            `━━━━━━━━⊱⋆⊰━━━━━━━━`,
          ].join("\n");

          const footer16 = [
            toSansSerif(`Hi @${m.sender.split("@")[0]} | *${userRole16}* !!, ${englishGreeting16}`),
            toSansSerif(`How can I help you today? 🍃`),
            ``,
            `   \`ᑭᖇOᖴIᒪᗴ\``,
            `     ▸ 𝖴𝗌𝖾𝗋𝗇𝖺𝗆𝖾   : \`${m.pushName || "User"}\``,
            `     ▸ 𝖲𝗍𝖺𝗍𝗎𝗌     : ${statusEmoji16} \`${userRole16}\``,
            `     ▸ 𝖫𝗂𝗆𝗂𝗍      : \`${userEnergi16}\``,
            ``,
            `   \`ՏYՏTᗴᗰ\``,
            `     ▸ 𝖡𝗈𝗍 𝖭𝖺𝗆𝖾    : \`${botConfig.bot?.name || "Bot"}\``,
            `     ▸ 𝖮𝗐𝗇𝖾𝗋       : \`${botConfig.owner?.name || "Owner"}\``,
            `     ▸ 𝖵𝖾𝗋𝗌𝗂𝗈𝗇     : \`v${botConfig.bot?.version || "1.0.0"}\``,
            `     ▸ 𝖣𝖺𝗍𝖺𝖻𝖺𝗌𝖾    : \`${db.engine || "SQLite"}\``,
            `     ▸ 𝖳𝗈𝗍𝖺𝗅 𝖥𝖾𝖺𝗍𝗎𝗋𝖾 : \`${totalCmds}\``,
            `     ▸ 𝖳𝗂𝗆𝖾        : \`${jam16} WITA\``,
            `     ▸ 𝖠𝖼𝗍𝗂𝗏𝖾 𝗌𝗂𝗇𝖼𝖾 : \`${uptimeFormatted}\``,
            ``,
            `> Enjoy the bot's features`,
          ].join("\n") + PANEL_FOOT;

          const msg16 = generateWAMessageFromContent(
            m.chat,
            {
              interactiveMessage: {
                header: {
                  hasMediaAttachment: true,
                  ...(media16 ? { imageMessage: media16.imageMessage } : {}),
                },
                body: { text: bodyText16 },
                footer: { text: footer16 },
                nativeFlowMessage: {
                  buttons: buttons16,
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: priceTag16,
                      url: `https://wa.me/${String(Array.isArray(botConfig.owner?.number) ? botConfig.owner.number[0] : (botConfig.owner?.number || "")).replace(/[^0-9]/g, "")}`,
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

          await sock.relayMessage(m.chat, msg16.message, { messageId: msg16.key.id });
        } catch (e16) {
          console.error("[Menu Case 16]", e16.message);
          await m.reply(text);
        }
        break;
      }
      case 17: {
        try {
          const _pad17 = (n) => String(n).padStart(2, "0");
          const _now17 = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
          const jam17 = `${_pad17(_now17.getHours())}.${_pad17(_now17.getMinutes())}`;
          const _hour17 = _now17.getHours();
          const salamWaktu17 =
            _hour17 >= 4 && _hour17 < 11 ? "Selamat pagi"
            : _hour17 >= 11 && _hour17 < 15 ? "Selamat siang"
            : _hour17 >= 15 && _hour17 < 18 ? "Selamat sore"
            : "Selamat malam";

          const userData17 = db.getUser(m.sender) || {};
          const _vip17 = db.isVipActive
            ? db.isVipActive(m.sender)
            : (userData17?.isVip && (!userData17.vipExpired || userData17.vipExpired === -1 || Date.now() < userData17.vipExpired));
          const userRole17 = m.isOwner ? "Owner" : (_vip17 || m.isPremium) ? "Premium" : "Free User";
          const userEnergi17 = m.isOwner || m.isPremium || _vip17 ? "∞" : (userData17.energi ?? 25);
          const botName17 = botConfig.bot?.name || "Bot";

          // Thumbnail diperkecil supaya ringan dipakai sebagai externalAdReply
          let thumb17;
          const thumbRaw17 = getCachedAsset("ichigo") || thumbBuffer || imageBuffer || null;
          if (thumbRaw17 && thumbRaw17.length > 0) {
            try {
              const sharp17 = await getSharp();
              thumb17 = await sharp17(thumbRaw17).resize(640, 640, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
            } catch (eThumb17) {
              console.error("Gagal resize thumb menu case 17:", eThumb17.message);
              thumb17 = thumbRaw17;
            }
          }

          const banner17 = [
            `╭──────────────⊱⋆⊰──────────────╮`,
            `   ${toSansSerif(botName17)} ${toSansSerif("Menu")}`,
            `╰──────────────⊱⋆⊰──────────────╯`,
          ].join("\n");

          const body17 = [
            banner17,
            ``,
            `${salamWaktu17}, @${m.sender.split("@")[0]}`,
            `Silakan pilih menu lewat tombol di bawah.`,
          ].join("\n");

          const footer17 = [
            `╭─ ${toMonoUpperBold("profil")}`,
            `│ ▸ ${toSansSerif("Nama")}   : ${m.pushName || "User"}`,
            `│ ▸ ${toSansSerif("Status")} : ${userRole17}`,
            `│ ▸ ${toSansSerif("Limit")}  : ${userEnergi17}`,
            `├─ ${toMonoUpperBold("sistem")}`,
            `│ ▸ ${toSansSerif("Bot")}    : ${botName17}`,
            `│ ▸ ${toSansSerif("Owner")}  : ${botConfig.owner?.name || "Owner"}`,
            `│ ▸ ${toSansSerif("Versi")}  : v${botConfig.bot?.version || "1.0.0"}`,
            `│ ▸ ${toSansSerif("Fitur")}  : ${totalCmds}`,
            `│ ▸ ${toSansSerif("Waktu")}  : ${jam17} WITA`,
            `│ ▸ ${toSansSerif("Aktif")}  : ${uptimeFormatted}`,
            `╰─ © ${botConfig.bot?.developer || botName17}`,
          ].join("\n") + PANEL_FOOT;

          const kategoriRows17 = menuSorted.map(({ cat, emoji, cmds }) => ({
            title: `${emoji} ${toSmallCaps(cat)}`,
            description: toSmallCaps(`${cmds.length} commands available`),
            rowId: `${prefix}menucat ${cat}`,
          }));

          const sections17 = [
            {
              title: toMonoUpperBold("menu utama"),
              rows: [
                { title: toSmallCaps("all features"), description: toSmallCaps(`show all ${totalCmds} bot commands`), rowId: `${prefix}allmenu` },
                { title: toSmallCaps("my profile"), description: toSmallCaps("view your account stats"), rowId: `${prefix}profile` },
                { title: toSmallCaps("bot guide"), description: toSmallCaps("how to use the bot"), rowId: `${prefix}guide` },
                { title: toSmallCaps("owner contact"), description: toSmallCaps("developer contact info"), rowId: `${prefix}owner` },
              ],
            },
            { title: toMonoUpperBold("kategori fitur"), rows: kategoriRows17 },
            {
              title: toMonoUpperBold("dukungan"),
              rows: [{ title: toSmallCaps("donate"), description: toSmallCaps("support bot development"), rowId: `${prefix}donasi` }],
            },
          ];

          const msg17 = generateWAMessageFromContent(
            m.chat,
            {
              viewOnceMessage: {
                message: {
                  listMessage: {
                    title: `✦ ${botName17.toUpperCase()} ✦`,
                    description: body17,
                    buttonText: "Buka Menu",
                    listType: 1,
                    sections: sections17,
                    footerText: footer17,
                    contextInfo: {
                      mentionedJid: [m.sender],
                      externalAdReply: {
                        title: botName17,
                        body: `Owner: ${botConfig.owner?.name || "Owner"}`,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        showAdAttribution: false,
                        ...(thumb17 ? { thumbnail: thumb17 } : {}),
                        ...(saluranLink ? { sourceUrl: saluranLink } : {}),
                      },
                    },
                  },
                },
              },
            },
            { userJid: sock.user.jid },
          );

          await sock.relayMessage(m.chat, msg17.message, {
            messageId: msg17.key.id,
            additionalNodes: [
              {
                tag: "biz",
                attrs: {},
                content: [{ tag: "list", attrs: { v: "2", type: "product_list" } }],
              },
            ],
          });
        } catch (e17) {
          console.error("[Menu Case 17]", e17.message);
          await m.reply(text);
        }
        break;
      }
        default:
        await m.reply(text);
    }
    const audioEnabled = db.setting("audioMenu") !== false;
    if (audioEnabled && menuVariant !== 10 && menuVariant !== 11) {
      // "ichigo-mp3" di config berupa array [link utama, cadangan]; ambil sumber
      // pertama sebagai string, dan unduh lewat asset cache (bukan axios ke array).
      const _audioSrc = botConfig.assets["ichigo-mp3"];
      const audioUrl = Array.isArray(_audioSrc) ? _audioSrc[0] : _audioSrc;
      const fetchAudioRes = async () => {
        const cached = getCachedAsset("ichigo-mp3");
        if (cached) return { data: cached };
        const loaded = await loadAssetBuffer("ichigo-mp3").catch(() => null);
        if (loaded) return { data: loaded };
        throw new Error("audio ichigo-mp3 belum ke-cache dan semua sumber gagal");
      };

      const savedAudioCase = db.setting("audioMenuCase");
      const audioCase = savedAudioCase || (menuVariant <= 2 ? menuVariant : 4);
      try {
        switch (audioCase) {
          case 1:
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, "menu_audio_opus.ogg");
                if (fs.existsSync(destPath)) return destPath;
                const mp3Path = path.join(tempDir, "menu_audio.mp3");
                const res = await fetchAudioRes();
                fs.writeFileSync(mp3Path, Buffer.from(res.data));
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              }, { quoted: m });
            } catch (err) {
              await sock.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                ptt: false,
              }, { quoted: m });
            }
            break;
          case 2: {
            const qpoll = {
              key: {
                participant: "0@s.whatsapp.net",
                id: "LYNIX-POLL-" + Date.now(),
                fromMe: false,
              },
              message: {
                pollCreationMessage: {
                  name: config.bot.name
                }
              }
            };
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, "menu_audio_opus.ogg");
                if (fs.existsSync(destPath)) return destPath;
                const mp3Path = path.join(tempDir, "menu_audio.mp3");
                const res = await fetchAudioRes();
                fs.writeFileSync(mp3Path, Buffer.from(res.data));
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              }, { quoted: qpoll });
            } catch (err) {
              await sock.sendMessage(m.chat, {
                audio: getCachedAsset("ichigo-mp3"),
                mimetype: "audio/mpeg",
                ptt: false,
              }, { quoted: qpoll });
            }
            break;
          }
          case 3: {
            const qtext = {
              key: {
                fromMe: false,
                participant: m.sender,
                id: "LYNIX-TEXT-" + Date.now(),
              },
              message: {
                conversation: "setelin musiknya nya bang"
              }
            };
            await sock.sendMessage(m.chat, {
              audio: getCachedAsset("ichigo-mp3"),
              mimetype: "audio/mpeg",
              ptt: false,
            }, { quoted: qtext });
            break;
          }
          case 5: {

            const fakeName = db.setting("audioFakeName") || "Ichigo Assistant";
            const rawFakeNumber = (db.setting("audioFakeNumber") || "6281234567890").replace(/\D/g, "");
            const qfake = {
              key: {
                fromMe: false,
                participant: `${rawFakeNumber}@s.whatsapp.net`,
                remoteJid: "status@broadcast",
                id: "LYNIX-STATUS-" + Date.now(),
              },
              message: {
                contactMessage: {
                  displayName: fakeName,
                  vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${fakeName}\nTEL;type=CELL;type=VOICE;waid=${rawFakeNumber}:+${rawFakeNumber}\nEND:VCARD`,
                },
              },
            };
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, "menu_audio_opus.ogg");
                if (fs.existsSync(destPath)) return destPath;
                const mp3Path = path.join(tempDir, "menu_audio.mp3");
                const res = await fetchAudioRes();
                fs.writeFileSync(mp3Path, Buffer.from(res.data));
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              }, { quoted: qfake });
            } catch (err) {
              await sock.sendMessage(m.chat, {
                audio: getCachedAsset("ichigo-mp3"),
                mimetype: "audio/mpeg",
                ptt: false,
              }, { quoted: qfake });
            }
            break;
          }
                    case 6: {

            const ownerName6 = botConfig.owner?.name || "Owner";
            const pingStart6 = performance.now();
            const pingMs6 = (performance.now() - pingStart6).toFixed(0);
            const qfake = {
              key: {
                fromMe: false,
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast",
                id: "LYNIX-ORDER-" + Date.now(),
              },
              message: {
                orderMessage: {
                  orderId: `LYNIX-${Date.now()}`,
                  itemCount: 1,
                  status: "INQUIRY",
                  surface: "CATALOG",
                  message: `⌬ ${toSmallCaps("ping")} ${pingMs6}ᴍs · ${toSmallCaps("uptime")} ${uptimeFormatted}`,
                  orderTitle: `⌬ ${ownerName6}`,
                  sellerJid: botConfig.botNumber
                    ? `${botConfig.botNumber}@s.whatsapp.net`
                    : m.sender,
                  token: "ichigo-menu-c6",
                  totalAmount1000: 0,
                  totalCurrencyCode: "IDR",
                },
              },
            };
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, `menu_audio_opus_c6_${Date.now()}.ogg`);
                const mp3Path = path.join(tempDir, `menu_audio_c6_${Date.now()}.mp3`);

                if (/^https?:\/\//i.test(audioUrl)) {
                  const res = await fetchAudioRes();
                  fs.writeFileSync(mp3Path, Buffer.from(res.data));
                } else {
                  fs.copyFileSync(audioUrl, mp3Path);
                }
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {

                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-ac", "1", "-ar", "48000", "-b:a", "32k", "-vbr", "on", "-application", "voip", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              }, { quoted: qfake });
              fs.unlink(oggPath, () => {});
            } catch (err) {
              console.error("[Menu Case 6]", err.message);
              await sock.sendMessage(m.chat, {
                audio: getCachedAsset("ichigo-mp3"),
                mimetype: "audio/mpeg",
                ptt: false,
              }, { quoted: qfake });
            }
            break;
          }
          case 7: {

            const chName7 = db.setting("audioC7Name") || "Ichigo Channel";
            const chJid7 =
              db.setting("audioC7Jid") ||
              config?.saluran?.id ||
              "120363409557700746@newsletter";
            const contextInfo7 = {
              forwardingScore: 1,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: chJid7,
                serverMessageId: Math.floor(Math.random() * 9999),
                newsletterName: chName7,
              },
            };
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, `menu_audio_opus_c7_${Date.now()}.ogg`);
                const mp3Path = path.join(tempDir, `menu_audio_c7_${Date.now()}.mp3`);
                if (/^https?:\/\//i.test(audioUrl)) {
                  const res = await fetchAudioRes();
                  fs.writeFileSync(mp3Path, Buffer.from(res.data));
                } else {
                  fs.copyFileSync(audioUrl, mp3Path);
                }
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-ac", "1", "-ar", "48000", "-b:a", "32k", "-vbr", "on", "-application", "voip", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
                contextInfo: contextInfo7,
              });
              fs.unlink(oggPath, () => {});
            } catch (err) {
              console.error("[Menu Case 7]", err.message);
              await sock.sendMessage(m.chat, {
                audio: getCachedAsset("ichigo-mp3"),
                mimetype: "audio/mpeg",
                ptt: false,
                contextInfo: contextInfo7,
              });
            }
            break;
          }
          case 4:
          default: {
            
            try {
              const oggPath = await (async () => {
                const tempDir = path.join(process.cwd(), "temp");
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const destPath = path.join(tempDir, "menu_audio_opus.ogg");
                if (fs.existsSync(destPath)) return destPath;
                const mp3Path = path.join(tempDir, "menu_audio.mp3");
                const res = await fetchAudioRes();
                fs.writeFileSync(mp3Path, Buffer.from(res.data));
                const { spawn } = await import("child_process");
                return new Promise((resolve, reject) => {
                  const ffmpeg = spawn("ffmpeg", ["-y", "-i", mp3Path, "-c:a", "libopus", "-b:a", "48k", "-vbr", "on", destPath]);
                  ffmpeg.on("close", (code) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    if (code === 0) resolve(destPath);
                    else reject(new Error("FFmpeg error"));
                  });
                  ffmpeg.on("error", (err) => {
                    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
                    reject(err);
                  });
                });
              })();
              await sock.sendMessage(m.chat, {
                audio: { url: oggPath },
                mimetype: "audio/ogg; codecs=opus",
                ptt: true,
              }, { quoted: m });
            } catch (ffmpegErr) {
              await sock.sendMessage(m.chat, {
                audio: getCachedAsset("ichigo-mp3"),
                mimetype: "audio/mpeg",
                ptt: false,
              }, { quoted: m });
            }
            break;
          }
        }
      } catch (e) {
        console.error("[Menu] Error sending dynamic audio:", e.message);
      }
    }
  } catch (error) {
    console.error("[Menu] Error on command execution:", error);
  }
}
async function handler(m, ctx) {
  await menuHandler(m, ctx);
  await attachMenuSticker(ctx.sock, m, ctx.config);
}
export default {
  config: pluginConfig,
  handler,
};