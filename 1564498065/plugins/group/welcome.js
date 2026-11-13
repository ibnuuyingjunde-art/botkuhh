import moment from "moment-timezone";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { resolveAnyLidToJid, isLid, isLidConverted, resolveFromSock, cacheParticipantLids, getCachedJid } from "../../src/lib/ichigo-lid.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
import te from "../../src/lib/ichigo-error.js";
import { parsePlaceholders as parseIntroPlaceholders, DEFAULT_INTRO } from "./intro.js";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";
import { prepareWAMessageMedia, generateWAMessageFromContent } from "ichigo";

const BG_PATH = "/home/container/assets/images/ichigo-welcome.jpg";

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function resolveDisplayName(participantJid, groupMeta) {
  try {
    const participants = groupMeta?.participants || [];
    const pData = participants.find(
      (p) => p.id === participantJid || p.jid === participantJid
    );
    if (pData?.notify && pData.notify.trim()) return pData.notify.trim();
    if (pData?.name && pData.name.trim()) return pData.name.trim();
    if (pData?.verifiedName && pData.verifiedName.trim()) return pData.verifiedName.trim();
  } catch {}
  return participantJid?.split("@")[0] || "User";
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  ctx.lineTo(x + r.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}

function fillTextSpaced(ctx, text, cx, y, spacing = 3) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - totalW / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

function drawPill(ctx, x, y, w, h, { fill, stroke, radius } = {}) {
  roundRectPath(ctx, x, y, w, h, radius ?? h / 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function drawHouseIcon(ctx, cx, cy, size, color) {
  const w = size, h = size * 0.85;
  const roofH = size * 0.55;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.09);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2 + roofH);
  ctx.lineTo(cx, cy - h / 2 - roofH * 0.35);
  ctx.lineTo(cx + w / 2, cy - h / 2 + roofH);
  ctx.stroke();
  roundRectPath(ctx, cx - w / 2 + 2, cy - h / 2 + roofH * 0.65, w - 4, h * 0.7, 2);
  ctx.stroke();
  const doorW = w * 0.28, doorH = h * 0.42;
  roundRectPath(ctx, cx - doorW / 2, cy + h / 2 - doorH, doorW, doorH, 1.5);
  ctx.fill();
  ctx.restore();
}

async function buildWelcomeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, showPhone = true) {
  const W = 1280, H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const botName = config.bot?.name || "lyniX's MD";

  let hasBgImage = false;
  try {
    const bgImg = await loadImage((await loadAssetBuffer("ichigo-welcome")) || BG_PATH);
    ctx.drawImage(bgImg, 0, 0, W, H);
    hasBgImage = true;
  } catch {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,    "#0c1224");
    bgGrad.addColorStop(0.55, "#080b18");
    bgGrad.addColorStop(1,    "#040509");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = hasBgImage ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 300, 20, W / 2, 300, 420);
  glow.addColorStop(0,   "rgba(56, 130, 246, 0.28)");
  glow.addColorStop(0.5, "rgba(20, 184, 166, 0.10)");
  glow.addColorStop(1,   "rgba(20, 184, 166, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let gx = 40; gx < W; gx += 34) {
    for (let gy = 40; gy < H; gy += 34) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const pad = 26, radius = 34;
  for (let i = 6; i >= 1; i--) {
    roundRectPath(ctx, pad - i, pad - i, W - pad * 2 + i * 2, H - pad * 2 + i * 2, radius + i);
    ctx.strokeStyle = `rgba(56, 130, 246, ${0.05 * (7 - i) / 6})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const frameGrad = ctx.createLinearGradient(pad, pad, W - pad, H - pad);
  frameGrad.addColorStop(0,   "rgba(56, 130, 246, 0.55)");
  frameGrad.addColorStop(0.5, "rgba(45, 212, 191, 0.45)");
  frameGrad.addColorStop(1,   "rgba(56, 130, 246, 0.55)");
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, radius);
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const kickerW = 190, kickerH = 38, kickerY = 58;
  drawPill(ctx, W / 2 - kickerW / 2, kickerY, kickerW, kickerH, {
    fill: "rgba(255,255,255,0.05)",
    stroke: "rgba(94, 170, 255, 0.35)",
  });
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#8fc4ff";
  ctx.textBaseline = "middle";
  fillTextSpaced(ctx, "W E L C O M E", W / 2, kickerY + kickerH / 2 + 1, 3);
  ctx.textBaseline = "alphabetic";

  const ppSize = 176;
  const ppX = W / 2, ppY = 300;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1330";
  ctx.fill();
  ctx.restore();

  const ringGrad = ctx.createLinearGradient(ppX - ppSize / 2, ppY - ppSize / 2, ppX + ppSize / 2, ppY + ppSize / 2);
  ringGrad.addColorStop(0, "#3b82f6");
  ringGrad.addColorStop(1, "#2dd4bf");
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2, 0, Math.PI * 2);
  ctx.clip();
  try {
    const ppBuf = await fetchImageBuffer(ppUrl);
    if (ppBuf) {
      const ppImg = await loadImage(ppBuf);
      ctx.drawImage(ppImg, ppX - ppSize / 2, ppY - ppSize / 2, ppSize, ppSize);
    } else {
      throw new Error("no pp");
    }
  } catch {
    try {
      const ppKosong = await loadImage((await loadAssetBuffer("pp-kosong")) || "/home/container/assets/images/pp-kosong.jpg");
      ctx.drawImage(ppKosong, ppX - ppSize / 2, ppY - ppSize / 2, ppSize, ppSize);
    } catch {
      ctx.fillStyle = "#0a1a4e";
      ctx.fillRect(ppX - ppSize / 2, ppY - ppSize / 2, ppSize, ppSize);
    }
  }
  ctx.restore();

  const nameY = ppY + ppSize / 2 + 56;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px sans-serif";
  const maxNameLen = 24;
  const displayedName = displayName.length > maxNameLen ? displayName.slice(0, maxNameLen) + "…" : displayName;
  ctx.fillText(displayedName, W / 2, nameY);
  ctx.shadowBlur = 0;

  const isNameSameAsPhone = displayName === phoneNumber;
  let cursorY = nameY;
  if (showPhone && !isNameSameAsPhone) {
    cursorY += 30;
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "rgba(180, 200, 230, 0.7)";
    ctx.fillText(`+${phoneNumber}`, W / 2, cursorY);
  }

  ctx.font = "15px sans-serif";
  const maxGroupLen = 40;
  const displayedGroup = groupName.length > maxGroupLen ? groupName.slice(0, maxGroupLen) + "…" : groupName;
  const groupTextW = ctx.measureText(displayedGroup).width;
  const iconGap = 10, iconSize = 15;
  const groupPillW = iconSize + iconGap + groupTextW + 44, groupPillH = 36;
  const groupPillY = cursorY + 24;
  drawPill(ctx, W / 2 - groupPillW / 2, groupPillY, groupPillW, groupPillH, {
    fill: "rgba(45, 212, 191, 0.10)",
    stroke: "rgba(45, 212, 191, 0.30)",
  });
  const groupContentW = iconSize + iconGap + groupTextW;
  const groupIconX = W / 2 - groupContentW / 2 + iconSize / 2;
  const groupPillCY = groupPillY + groupPillH / 2;
  drawHouseIcon(ctx, groupIconX, groupPillCY, iconSize, "#a7f3ea");
  ctx.fillStyle = "#a7f3ea";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(displayedGroup, groupIconX + iconSize / 2 + iconGap, groupPillCY + 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const chipY = groupPillY + groupPillH + 34;
  const chipH = 74, chipW = 240, gap = 22;
  const chipsTotalW = chipW * 2 + gap;
  const chipStartX = W / 2 - chipsTotalW / 2;

  function drawStatChip(x, label, value) {
    drawPill(ctx, x, chipY, chipW, chipH, {
      fill: "rgba(255,255,255,0.045)",
      stroke: "rgba(255,255,255,0.09)",
      radius: 18,
    });
    ctx.textAlign = "center";
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(170, 195, 230, 0.65)";
    ctx.fillText(label.toUpperCase(), x + chipW / 2, chipY + 26);
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + chipW / 2, chipY + 54);
  }

  drawStatChip(chipStartX, "Member ke-", `#${memberCount}`);
  drawStatChip(chipStartX + chipW + gap, "Bergabung", `${now.format("DD/MM")} · ${now.format("HH:mm")} WITA`);

  const footerY = H - pad - 34;
  const fDivGrad = ctx.createLinearGradient(pad + 60, 0, W - pad - 60, 0);
  fDivGrad.addColorStop(0,   "rgba(255,255,255,0)");
  fDivGrad.addColorStop(0.5, "rgba(255,255,255,0.14)");
  fDivGrad.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.strokeStyle = fDivGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 60, footerY - 18);
  ctx.lineTo(W - pad - 60, footerY - 18);
  ctx.stroke();

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(150, 175, 210, 0.6)";
  ctx.textAlign = "center";
  fillTextSpaced(ctx, botName.toUpperCase(), W / 2, footerY, 2);

  return canvas.toBuffer("image/jpeg", { quality: 94 });
}

function resolvePlaceholders(template, username, groupName, groupDesc, memberCount, groupOwner, prefix, participantJid = null, mentionLabel = null) {
  const now = moment().tz("Asia/Makassar");
  const dayNames = {
    Sunday: "Minggu", Monday: "Senin", Tuesday: "Selasa",
    Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu",
  };
  const dayId      = dayNames[now.format("dddd")] || now.format("dddd");

  const mentionTag = mentionLabel
    ? mentionLabel
    : participantJid ? `@${participantJid.split("@")[0]}` : `@${username}`;
  const numberPlaceholder = mentionLabel ? "-" : username;
  return template
    .replace(/{user}/gi,    mentionTag)
    .replace(/{number}/gi,  numberPlaceholder)
    .replace(/{group}/gi,   groupName    || "Grup")
    .replace(/{desc}/gi,    groupDesc    || "")
    .replace(/{count}/gi,   memberCount?.toString() || "0")
    .replace(/{owner}/gi,   groupOwner   || "Admin")
    .replace(/{date}/gi,    now.format("DD/MM/YYYY"))
    .replace(/{time}/gi,    now.format("HH:mm"))
    .replace(/{day}/gi,     dayId)
    .replace(/{bot}/gi,     config.bot?.name || "lyniX's")
    .replace(/{prefix}/gi,  prefix);
}

async function buildWelcomeMessage(participant, groupName, groupDesc, memberCount, customMsg = null, groupOwner = "", prefix = ".", participantJid = null, displayName = null, mentionLabel = null) {
  const greetings = [
    `Akhirnya datang juga`, `Selamat datang`, `Welcome aboard`,
    `Yokoso~`, `Ohayou~`, `Irasshaimase~`, `Yuk masuk, udah ditunggu`,
  ];
  const quotes = [
    `Jangan jadi silent reader ya, ikut ngobrol dong!`,
    `Santai aja, anggap ini rumah sendiri 🏠`,
    `Yuk langsung gas, jangan malu-malu~`,
    `Kita semua temen di sini, langsung nimbrung aja!`,
    `Semoga betah dan bawa vibes positif ya 🌟`,
    `Satu langkah masuk grup, seribu kenangan menanti 💫`,
  ];
  const themes = [
    {
      emoji: `🎐`,
      header:
        `┌─────────────────────┐\n` +
        `│  🎐 *ᴏʜᴀʏᴏᴜ~ ᴍɪɴɴᴀ-sᴀɴ!*  │\n` +
        `└─────────────────────┘`,
      vibe: `Tomodachi baru datang bawa angin segar~ 🌱`,
    },
    {
      emoji: `🌸`,
      header:
        `┌─────────────────────┐\n` +
        `│   🌸 *ɪʀᴀssʜᴀɪᴍᴀsᴇ~*   │\n` +
        `└─────────────────────┘`,
      vibe: `Seperti bunga sakura yang mekar, selamat datang! 🌸`,
    },
    {
      emoji: `✨`,
      header:
        `┌─────────────────────┐\n` +
        `│  ✨ *ᴀ ɴᴇᴡ sᴛᴀʀ ᴀʀʀɪᴠᴇs*  │\n` +
        `└─────────────────────┘`,
      vibe: `Bintang baru telah hadir di langit grup ini 💫`,
    },
    {
      emoji: `🪸`,
      header:
        `┌─────────────────────┐\n` +
        `│  🪸 *ʏᴏᴋᴏsᴏ~ ᴛᴏᴍᴏᴅᴀᴄʜɪ*  │\n` +
        `└─────────────────────┘`,
      vibe: `Grup ini makin lengkap dengan kehadiranmu 🤍`,
    },
  ];

  const username = participant?.split("@")[0] || "User";
  const now      = moment().tz("Asia/Makassar");
  const dayNames = {
    Sunday: "Minggu", Monday: "Senin", Tuesday: "Selasa",
    Wednesday: "Rabu", Thursday: "Kamis", Friday: "Jumat", Saturday: "Sabtu",
  };
  const dayId = dayNames[now.format("dddd")] || now.format("dddd");

  if (customMsg) {
    return resolvePlaceholders(customMsg, username, groupName, groupDesc, memberCount, groupOwner, prefix, participantJid || participant, mentionLabel);
  }

  const greeting   = greetings[Math.floor(Math.random() * greetings.length)];
  const quote      = quotes[Math.floor(Math.random() * quotes.length)];
  const theme      = themes[Math.floor(Math.random() * themes.length)];
  const mentionTag = mentionLabel || `@${(participantJid || participant)?.split("@")[0] || username}`;
  const shownName  = displayName && displayName !== username ? displayName : mentionTag;

  let msg = `${theme.header}\n\n`;
  msg += `${theme.emoji} ${greeting}, *${shownName}* 💫\n`;
  msg += `_${theme.vibe}_\n\n`;
  msg += `╔═══════════════════╗\n`;
  msg += `║  📋 *ɪɴꜰᴏ ɢʀᴜᴘ*\n`;
  msg += `╠═══════════════════╣\n`;
  msg += `║ 🏠 ${groupName}\n`;
  msg += `║ 👥 Member ke-${memberCount}\n`;
  msg += `║ 📅 ${dayId}, ${now.format("DD/MM/YYYY")}\n`;
  msg += `║ 🕐 ${now.format("HH:mm")} WITA\n`;
  if (groupDesc) {
    const shortDesc = groupDesc.slice(0, 80) + (groupDesc.length > 80 ? "..." : "");
    msg += `║ 📝 ${shortDesc}\n`;
  }
  msg += `╚═══════════════════╝\n\n`;
  msg += `💬 _"${quote}"_\n\n`;
  msg += `🌸 *Yoroshiku ne~ semoga betah ya!* 🤍`;

  return msg;
}

async function sendIntroMessage(sock, groupJid, participantJid, groupMeta) {
  try {
    const db        = getDatabase();
    const groupData = db.getGroup(groupJid) || {};
    const introText = groupData.intro || DEFAULT_INTRO;
    const fakeM     = { sender: participantJid };
    const parsed    = parseIntroPlaceholders(introText, fakeM, groupMeta);
    await sock.sendMessage(groupJid, {
      text: parsed,
      mentions: [participantJid],
      contextInfo: {
        ...saluranCtx(),
        mentionedJid: [participantJid],
      },
    });
    return true;
  } catch (err) {
    console.error("SendIntro Error:", err);
    return false;
  }
}

function buildIntroCopyText(groupJid, participantJid, groupMeta) {
  try {
    const db        = getDatabase();
    const groupData = db.getGroup(groupJid) || {};
    const introText = groupData.intro || DEFAULT_INTRO;
    const fakeM     = { sender: participantJid };
    return parseIntroPlaceholders(introText, fakeM, groupMeta);
  } catch {
    return DEFAULT_INTRO || "Halo semua! Perkenalkan saya member baru 👋";
  }
}

async function sendWelcomeMessage(sock, groupJid, participant, groupMeta, opts = {}) {
  try {
    const db        = getDatabase();
    const groupData = db.getGroup(groupJid) || {};
    const isWelcomeOn = groupData?.welcome === true || groupData?.welcome === 1 || groupData?.welcome === "true";
    if (!opts.force && !isWelcomeOn) {
      console.log("[Welcome] welcome off for", groupJid, "| value:", groupData?.welcome);
      return false;
    }

    if (groupMeta?.participants) {
      cacheParticipantLids(groupMeta.participants);
    }

    let realParticipant = resolveAnyLidToJid(participant, groupMeta?.participants || []);
    if (!realParticipant || isLid(realParticipant) || isLidConverted(realParticipant)) {
      const cachedJid = getCachedJid(participant);
      if (cachedJid && !isLidConverted(cachedJid)) {
        realParticipant = cachedJid;
      } else if (isLid(participant) || isLidConverted(participant)) {
        try {
          const fromSock = await resolveFromSock(participant, sock);
          if (fromSock && !isLid(fromSock) && !isLidConverted(fromSock)) {
            realParticipant = fromSock;
          } else {
            realParticipant = participant;
          }
        } catch {
          realParticipant = participant;
        }
      } else {
        realParticipant = participant;
      }
    }
    const memberCount     = groupMeta?.participants?.length || 0;
    const groupName       = groupMeta?.subject || "Grup";
    const phoneNumber     = realParticipant?.split("@")[0] || "User";
    const displayName     = resolveDisplayName(realParticipant, groupMeta);

    const stillUnresolved = isLid(realParticipant) || isLidConverted(realParticipant);
    const mentionLabel = stillUnresolved
      ? (displayName && displayName !== phoneNumber ? `*${displayName}*` : "*Member Baru*")
      : null;

    let ppUrl = "./assets/images/pp-kosong.jpg"; // default: file lokal
    try { ppUrl = await sock.profilePictureUrl(realParticipant, "image"); } catch {}

    const text = await buildWelcomeMessage(
      realParticipant,
      groupMeta?.subject,
      groupMeta?.desc,
      memberCount,
      groupData?.welcomeMsg,
      groupMeta?.owner?.split("@")[0] || "",
      config.command?.prefix || ".",
      realParticipant,
      displayName,
      mentionLabel,
    );

    const welcomeType = parseInt(db.setting("welcomeType"), 10) || 1;
    const ctxBase     = { ...saluranCtx(), mentionedJid: [realParticipant] };
    const botName     = config.bot?.name || "lyniX's MD";
    const saluranId    = config.saluran?.id   || "120363409557700746@newsletter";
    const saluranName  = config.saluran?.name || botName;

    if (welcomeType === 2) {
      const cardBody = groupData?.welcomeMsg
        ? resolvePlaceholders(groupData.welcomeMsg, phoneNumber, groupMeta?.subject, groupMeta?.desc, memberCount, groupMeta?.owner?.split("@")[0] || "", config.command?.prefix || ".", realParticipant, mentionLabel)
        : `Selamat datang di *${groupName}* 🎉\nKamu member ke-${memberCount}!`;

      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          body:   { text: `🌸 Selamat datang ${mentionLabel || `*@${phoneNumber}*`}` },
          footer: { text: botName },
          header: { title: "Welcome", hasMediaAttachment: false },
          carouselMessage: {
            cards: [
              {
                header: { imageMessage: /^https?:/.test(ppUrl) ? { url: ppUrl } : (await prepareWAMessageMedia({ image: { url: ppUrl } }, { upload: sock.waUploadToServer })).imageMessage },
                body:   { text: cardBody },
                footer: { text: botName },
                nativeFlowMessage: {
                  buttons: [
                    {
                      name: "quick_reply",
                      buttonParamsJson: JSON.stringify({
                        display_text: "👋 Halo @" + phoneNumber,
                        id: "hi",
                      }),
                    },
                    {
                      name: "cta_copy",
                      buttonParamsJson: JSON.stringify({
                        display_text: "📋 ᴄᴏᴘʏ ɪɴᴛʀᴏ",
                        copy_code: buildIntroCopyText(groupJid, realParticipant, groupMeta),
                      }),
                    },
                  ],
                  messageVersion: 1,
                  carouselCardType: 1,
                },
              },
            ],
          },
          contextInfo: ctxBase,
        },
      });

    } else if (welcomeType === 3) {
      const textOnly = groupData?.welcomeMsg
        ? resolvePlaceholders(groupData.welcomeMsg, phoneNumber, groupMeta?.subject, groupMeta?.desc, memberCount, groupMeta?.owner?.split("@")[0] || "", config.command?.prefix || ".", realParticipant, mentionLabel)
        : `🌸 *Selamat datang* ${mentionLabel || `@${phoneNumber}`}!\nSemoga betah di *${groupName}* 💫`;

      await sock.sendMessage(groupJid, {
        text: textOnly,
        mentions: [realParticipant],
        contextInfo: ctxBase,
      });

    } else if (welcomeType === 4) {
      await sock.sendMessage(groupJid, {
        text,
        mentions: [realParticipant],
        contextInfo: ctxBase,
      });

    } else if (welcomeType === 5) {
      const now        = moment().tz("Asia/Makassar");
      const cardBuffer = await buildWelcomeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, !stillUnresolved);
      const introCopy  = buildIntroCopyText(groupJid, realParticipant, groupMeta);

      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          header: ``,
          title:  `✦ ꜱᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ ${mentionLabel || `@${phoneNumber}`} ✦`,
          footer: botName,
          image:  cardBuffer,
          contextInfo: ctxBase,
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 3, 999],
                list_title: "Pilih aksi",
                button_title: "Aksi",
              },
            }),
            buttons: [
              { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
              { name: "inapp_signup", buttonParamsJson: "{}" },
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 ᴄᴏᴘʏ ɪɴᴛʀᴏ",
                  copy_code: introCopy,
                }),
              },
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "👋 ʜɪ ᴇᴠᴇʀʏᴏɴᴇ",
                  id: "hi",
                }),
              },
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: `✦ ᴍᴇɴᴜ ʙᴏᴛ`,
                  id: `${config.command?.prefix || "."}menu`,
                }),
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "✦ ᴏʀᴅᴇʀ ᴘᴀɴᴇʟ",
                  url: config.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
                  merchant_url: config.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
                }),
              },
            ],
          },
        },
      });

    } else if (welcomeType === 6) {
      const now        = moment().tz("Asia/Makassar");
      const cardBuffer = await buildWelcomeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, !stillUnresolved);
      const introCopy  = buildIntroCopyText(groupJid, realParticipant, groupMeta);
      const welcomeCaption = text;

      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          header: ``,
          title:  welcomeCaption,
          footer: ``,
          image:  cardBuffer,
          contextInfo: ctxBase,
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({}),
            buttons: [
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 ᴄᴏᴘʏ ɪɴᴛʀᴏ",
                  copy_code: introCopy,
                }),
              },
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "✦ ʀᴜʟᴇs ʙᴏᴛ",
                  id: `${config.command?.prefix || "."}rules`,
                }),
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "✦ sᴀʟᴜʀᴀɴ ʙᴏᴛ",
                  url: config.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
                  merchant_url: config.saluran?.link || "https://whatsapp.com/channel/0029VbB37bgBfxoAmAlsgE0t",
                }),
              },
            ],
          },
        },
      });

    } else if (welcomeType === 7) {
      // Sumber video: kappa.lol (config.assets.welcomeVideo) -> file lokal -> teks saja
      const _wv = config.assets?.welcomeVideo;
      const _sources = [
        ...(Array.isArray(_wv) ? _wv : _wv ? [_wv] : []),
        "./assets/video/ichigo.mp4",
      ];
      let _sent = false;
      for (const src of _sources) {
        try {
          await sock.sendMessage(groupJid, {
            video: { url: src },
            gifPlayback: true,
            caption: text,
            mentions: [realParticipant],
            contextInfo: ctxBase,
          });
          _sent = true;
          break;
        } catch (e) {
          console.log("Welcome video gagal:", src, e.message);
        }
      }
      if (!_sent) {
        await sock.sendMessage(groupJid, {
          text,
          mentions: [realParticipant],
          contextInfo: ctxBase,
        });
      }

    } else if (welcomeType === 8) {
      const introCopy = buildIntroCopyText(groupJid, realParticipant, groupMeta);
      const qFake = {
        key: {
          fromMe: false,
          participant: realParticipant,
          remoteJid: groupJid,
        },
        message: {
          conversation: `Halo semuanya! 👋`,
        },
      };

      const media = await prepareWAMessageMedia(
        { image: { url: ppUrl } },
        { upload: sock.waUploadToServer },
      );

      const msg = generateWAMessageFromContent(
        groupJid,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {},
              interactiveMessage: {
                header: {
                  title: "",
                  subtitle: "",
                  hasMediaAttachment: true,
                  imageMessage: media.imageMessage,
                },
                body:   { text },
                footer: { text: botName },
                contextInfo: {
                  mentionedJid: [realParticipant],
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
                      name: "quick_reply",
                      buttonParamsJson: JSON.stringify({
                        display_text: "👋 Halo Semuanya",
                        id: "hi",
                      }),
                    },
                    {
                      name: "cta_copy",
                      buttonParamsJson: JSON.stringify({
                        display_text: "📋 ᴄᴏᴘʏ ɪɴᴛʀᴏ",
                        copy_code: introCopy,
                      }),
                    },
                  ],
                },
              },
            },
          },
        },
        { quoted: qFake, userJid: sock.user.jid },
      );

      await sock.relayMessage(groupJid, msg.message, { messageId: msg.key.id });

    } else if (welcomeType === 9) {
      const plainText = groupData?.welcomeMsg
        ? resolvePlaceholders(groupData.welcomeMsg, phoneNumber, groupMeta?.subject, groupMeta?.desc, memberCount, groupMeta?.owner?.split("@")[0] || "", config.command?.prefix || ".", realParticipant, mentionLabel)
        : `🌸 Halo ${mentionLabel || `@${phoneNumber}`}, selamat datang di grup *${groupName}*!`;

      await sock.sendMessage(groupJid, {
        text: plainText,
        mentions: [realParticipant],
      });

    } else if (welcomeType === 10) {
      const now             = moment().tz("Asia/Makassar");
      const cardBuffer      = await buildWelcomeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, !stillUnresolved);
      const previewUrl      = "https://ichigostore.my.id";
      const previewCaption  = `${previewUrl}\n${text}`;

      await sock.sendPreview(
        groupJid,
        {
          caption: previewCaption,
          url: previewUrl,
          title: `Welcome to ${groupName}`,
          description: `${mentionLabel || `@${phoneNumber}`} bergabung ke grup`,
          image: cardBuffer,
          previewType: 0,
        },
        {
          mentions: [realParticipant],
          contextInfo: ctxBase,
        },
      );

    } else if (welcomeType === 11) {

      const productFooter = text;

      const productMedia = await prepareWAMessageMedia(
        { image: { url: ppUrl } },
        { upload: sock.waUploadToServer },
      );

      await sock.relayMessage(
        groupJid,
        {
          productMessage: {
            product: {
              productImage: productMedia.imageMessage,
              productId: `welcome-${groupJid.split("@")[0]}-${Date.now()}`,
              title: groupName,
              productImageCount: 1,
            },
            businessOwnerJid: sock.user?.id?.split(":")[0] + "@s.whatsapp.net",
            footer: productFooter,
            contextInfo: {
              mentionedJid: [realParticipant],
              forwardingScore: 1,
              isForwarded: true,
              forwardOrigin: 0,
            },
          },
        },
        {},
      );

    } else {
      const introCopy = buildIntroCopyText(groupJid, realParticipant, groupMeta);

      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          header: ``,
          title:  text,
          footer: botName,
          contextInfo: ctxBase,
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 999],
                list_title: "Pilih aksi",
                button_title: "Aksi",
              },
            }),
            buttons: [
              { name: "single_select", buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
              { name: "inapp_signup", buttonParamsJson: "{}" },
              {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                  display_text: "📋 ᴄᴏᴘʏ ɪɴᴛʀᴏ",
                  copy_code: introCopy,
                }),
              },
            ],
          },
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Welcome Error:", error);
    return false;
  }
}

const pluginConfig = {
  name: "welcome",
  alias: ["wc"],
  category: "group",
  description: "Mengatur welcome message untuk grup",
  usage: ".welcome <on/off>",
  example: ".welcome on",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db            = getDatabase();
  const args          = m.args || [];
  const sub           = args[0]?.toLowerCase();
  const sub2          = args[1]?.toLowerCase();
  const groupData     = db.getGroup(m.chat) || {};
  const currentStatus = groupData.welcome === true;
  const welcomeType   = parseInt(db.setting("welcomeType"), 10) || 1;

  if (sub === "type") {
    const typeNum = parseInt(sub2);
    if (!sub2 || isNaN(typeNum) || typeNum < 1 || typeNum > 11) {
      const typeDesc = {
        1: "nativeFlow + tombol Perkenalan",
        2: "Carousel + foto PP",
        3: "Teks biasa",
        4: "Text sendMessage",
        5: "Welcome Card Canvas (hitam elegan)",
        6: "Welcome Card Canvas 16:9 Biru",
        7: "Video/GIF playback + caption",
        8: "ViewOnce Interactive (media upload native)",
        9: "Plain text (paling ringan & kompatibel)",
        10: "Link Preview (ichigostore.my.id) + foto profil",
        11: "Product Card Message (native catalog card)",
      };
      let info = `╔═══════════════════╗\n║  🎨 *ᴡᴇʟᴄᴏᴍᴇ ᴛʏᴘᴇ*\n╚═══════════════════╝\n\n`;
      info += `> Type aktif sekarang: *${welcomeType}*\n\n`;
      info += `*━━ ᴘɪʟɪʜᴀɴ ᴛʏᴘᴇ ━━*\n`;
      for (const [k, v] of Object.entries(typeDesc)) {
        info += `› \`${m.prefix}welcome type ${k}\` — ${v}${parseInt(k) === welcomeType ? " ✅" : ""}\n`;
      }
      return m.reply(info);
    }
    if (!m.isOwner && !m.isAdmin) return m.reply(config.messages.ownerOnly);
    db.setting("welcomeType", typeNum);
    const typeNames = {
      1: "nativeFlow",
      2: "Carousel",
      3: "Text Only",
      4: "Text",
      5: "Welcome Card Canvas",
      6: "Welcome Card Canvas 16:9 Biru",
      7: "Video/GIF Playback",
      8: "ViewOnce Interactive",
      9: "Plain Text",
      10: "Link Preview",
      11: "Product Card Message",
    };
    return m.reply(
      `╔═══════════════════╗\n` +
      `║  ✅ *ᴛʏᴘᴇ ᴅɪɢᴀɴᴛɪ*\n` +
      `╚═══════════════════╝\n\n` +
      `> Welcome type sekarang: *${typeNum} — ${typeNames[typeNum]}*\n\n` +
      `_Welcome berikutnya akan menggunakan tampilan baru._`,
    );
  }

  if (sub === "on" && sub2 === "all") {
    if (!m.isOwner) return m.reply(config.messages.ownerOnly);
    m.react("🕕");
    try {
      const groups   = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);
      let count = 0;
      for (const groupId of groupIds) { db.setGroup(groupId, { welcome: true }); count++; }
      m.react("✅");
      return m.reply(
        `╔═══════════════════╗\n║  ✅ *ɢʟᴏʙᴀʟ ᴡᴇʟᴄᴏᴍᴇ ᴏɴ*\n╚═══════════════════╝\n\n` +
        `> Welcome aktif di *${count}* grup!`,
      );
    } catch {
      m.react("☢");
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  }

  if (sub === "off" && sub2 === "all") {
    if (!m.isOwner) return m.reply(config.messages.ownerOnly);
    m.react("🕕");
    try {
      const groups   = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);
      let count = 0;
      for (const groupId of groupIds) { db.setGroup(groupId, { welcome: false }); count++; }
      m.react("✅");
      return m.reply(
        `╔═══════════════════╗\n║  ❌ *ɢʟᴏʙᴀʟ ᴡᴇʟᴄᴏᴍᴇ ᴏꜰꜰ*\n╚═══════════════════╝\n\n` +
        `> Welcome nonaktif di *${count}* grup!`,
      );
    } catch {
      m.react("☢");
      return m.reply(te(m.prefix, m.command, m.pushName));
    }
  }

  if (sub === "on") {
    if (currentStatus) {
      return m.reply(
        `╔═══════════════════╗\n║  ⚠️ *sᴜᴅᴀʜ ᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
        `> Status: *✅ ON*\n> Welcome sudah aktif di grup ini.\n\n` +
        `_Gunakan \`${m.prefix}welcome off\` untuk menonaktifkan._`,
      );
    }
    db.setGroup(m.chat, { welcome: true });
    return m.reply(
      `╔═══════════════════╗\n║  ✅ *ᴡᴇʟᴄᴏᴍᴇ ᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
      `> Welcome message berhasil diaktifkan!\n> Member baru akan disambut otomatis.\n\n` +
      `_Gunakan \`${m.prefix}setwelcome\` untuk custom pesan._`,
    );
  }

  if (sub === "off") {
    if (!currentStatus) {
      return m.reply(
        `╔═══════════════════╗\n║  ⚠️ *sᴜᴅᴀʜ ɴᴏɴᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
        `> Status: *❌ OFF*\n> Welcome sudah nonaktif di grup ini.\n\n` +
        `_Gunakan \`${m.prefix}welcome on\` untuk mengaktifkan._`,
      );
    }
    db.setGroup(m.chat, { welcome: false });
    return m.reply(
      `╔═══════════════════╗\n║  ❌ *ᴡᴇʟᴄᴏᴍᴇ ɴᴏɴᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
      `> Welcome message berhasil dinonaktifkan.\n> Member baru tidak akan disambut.`,
    );
  }

  return m.reply(
    `╔═══════════════════╗\n║  🌸 *ᴡᴇʟᴄᴏᴍᴇ sᴇᴛᴛɪɴɢs*\n╚═══════════════════╝\n\n` +
    `> Status: *${currentStatus ? "✅ ON" : "❌ OFF"}*\n` +
    `> Type aktif: *${welcomeType}*\n\n` +
    `*━━ ᴘɪʟɪʜᴀɴ ━━*\n` +
    `› \`${m.prefix}welcome on\` — Aktifkan\n` +
    `› \`${m.prefix}welcome off\` — Nonaktifkan\n` +
    `› \`${m.prefix}welcome on all\` — Global ON _(owner)_\n` +
    `› \`${m.prefix}welcome off all\` — Global OFF _(owner)_\n` +
    `› \`${m.prefix}welcome type\` — Lihat & ganti tipe tampilan\n` +
    `› \`${m.prefix}setwelcome\` — Custom pesan welcome\n` +
    `› \`${m.prefix}resetwelcome\` — Reset default\n` +
    `› \`${m.prefix}setintro\` — Custom pesan intro\n` +
    `› \`${m.prefix}resetintro\` — Reset intro default`,
  );
}

export { pluginConfig as config, handler, sendWelcomeMessage, sendIntroMessage };