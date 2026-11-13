import moment from "moment-timezone";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { resolveAnyLidToJid, isLid, isLidConverted, resolveFromSock, cacheParticipantLids, getCachedJid } from "../../src/lib/ichigo-lid.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
import te from "../../src/lib/ichigo-error.js";
import fetch from "node-fetch";
import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js";
import { prepareWAMessageMedia } from "ichigo";

const BG_PATH = "/home/container/assets/images/ichigo-goodbye.jpg";

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

function drawDoorIcon(ctx, cx, cy, size, color) {
  const w = size * 0.7, h = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, size * 0.09);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + w / 2 - size * 0.16, cy, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + w / 2 + size * 0.05, cy - size * 0.22);
  ctx.lineTo(cx + w / 2 + size * 0.32, cy);
  ctx.lineTo(cx + w / 2 + size * 0.05, cy + size * 0.22);
  ctx.stroke();
  ctx.restore();
}

async function buildGoodbyeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, showPhone = true) {
  const W = 1280, H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const botName = config.bot?.name || "lyniX's MD";

  let hasBgImage = false;
  try {
    const bgImg = await loadImage((await loadAssetBuffer("ichigo-goodbye")) || BG_PATH);
    ctx.drawImage(bgImg, 0, 0, W, H);
    hasBgImage = true;
  } catch {
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,    "#241014");
    bgGrad.addColorStop(0.55, "#180b0e");
    bgGrad.addColorStop(1,    "#090405");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = hasBgImage ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 300, 20, W / 2, 300, 420);
  glow.addColorStop(0,   "rgba(246, 90, 90, 0.25)");
  glow.addColorStop(0.5, "rgba(184, 60, 100, 0.10)");
  glow.addColorStop(1,   "rgba(184, 60, 100, 0)");
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
    ctx.strokeStyle = `rgba(246, 90, 90, ${0.05 * (7 - i) / 6})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const frameGrad = ctx.createLinearGradient(pad, pad, W - pad, H - pad);
  frameGrad.addColorStop(0,   "rgba(246, 90, 90, 0.5)");
  frameGrad.addColorStop(0.5, "rgba(212, 130, 90, 0.4)");
  frameGrad.addColorStop(1,   "rgba(246, 90, 90, 0.5)");
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, radius);
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const kickerW = 210, kickerH = 38, kickerY = 58;
  drawPill(ctx, W / 2 - kickerW / 2, kickerY, kickerW, kickerH, {
    fill: "rgba(255,255,255,0.05)",
    stroke: "rgba(255, 140, 140, 0.35)",
  });
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#ffb3b3";
  ctx.textBaseline = "middle";
  fillTextSpaced(ctx, "G O O D B Y E", W / 2, kickerY + kickerH / 2 + 1, 3);
  ctx.textBaseline = "alphabetic";

  const ppSize = 176;
  const ppX = W / 2, ppY = 300;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#300f14";
  ctx.fill();
  ctx.restore();

  const ringGrad = ctx.createLinearGradient(ppX - ppSize / 2, ppY - ppSize / 2, ppX + ppSize / 2, ppY + ppSize / 2);
  ringGrad.addColorStop(0, "#f65a5a");
  ringGrad.addColorStop(1, "#d4825a");
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2 + 5, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(ppX, ppY, ppSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.75; 
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
      ctx.fillStyle = "#4a1a1a";
      ctx.fillRect(ppX - ppSize / 2, ppY - ppSize / 2, ppSize, ppSize);
    }
  }
  ctx.globalAlpha = 1;
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
    ctx.fillStyle = "rgba(230, 190, 190, 0.7)";
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
    fill: "rgba(212, 130, 90, 0.10)",
    stroke: "rgba(212, 130, 90, 0.30)",
  });
  const groupContentW = iconSize + iconGap + groupTextW;
  const groupIconX = W / 2 - groupContentW / 2 + iconSize / 2;
  const groupPillCY = groupPillY + groupPillH / 2;
  drawDoorIcon(ctx, groupIconX, groupPillCY, iconSize, "#f0b9a7");
  ctx.fillStyle = "#f0b9a7";
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
    ctx.fillStyle = "rgba(230, 195, 195, 0.65)";
    ctx.fillText(label.toUpperCase(), x + chipW / 2, chipY + 26);
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + chipW / 2, chipY + 54);
  }

  drawStatChip(chipStartX, "Sisa Member", `${memberCount}`);
  drawStatChip(chipStartX + chipW + gap, "Keluar", `${now.format("DD/MM")} · ${now.format("HH:mm")} WITA`);

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
  ctx.fillStyle = "rgba(210, 170, 170, 0.6)";
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
  const dayId = dayNames[now.format("dddd")] || now.format("dddd");

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

function buildGoodbyeMessage(participant, groupName, memberCount, participantJid = null, displayName = null, mentionLabel = null) {
  const farewells = [
    `Selamat tinggal`, `Sampai jumpa lagi`, `Sayonara~`,
    `Bye bye`, `Hati-hati di jalan`, `Semoga sukses selalu`,
  ];
  const quotes = [
    `Pintu selalu terbuka kalau mau balik lagi 🚪`,
    `Terima kasih udah pernah jadi bagian dari grup ini 🤍`,
    `Semoga di manapun berada, tetap sehat & bahagia ✨`,
    `Perpisahan bukan akhir, siapa tau ketemu lagi nanti 🌙`,
  ];

  const username    = participant?.split("@")[0] || "User";
  const mentionTag  = mentionLabel || `@${(participantJid || participant)?.split("@")[0] || username}`;
  const shownName   = displayName && displayName !== username ? displayName : mentionTag;
  const farewell    = farewells[Math.floor(Math.random() * farewells.length)];
  const quote       = quotes[Math.floor(Math.random() * quotes.length)];

  let msg = `🚪 *${farewell}, ${shownName}* 👋\n`;
  msg += `_${quote}_\n\n`;
  msg += `╔═══════════════════╗\n`;
  msg += `║ 🏠 ${groupName}\n`;
  msg += `║ 👥 Sisa member: ${memberCount}\n`;
  msg += `╚═══════════════════╝`;

  return msg;
}

async function sendGoodbyeMessage(sock, groupJid, participant, groupMeta, opts = {}) {
  try {
    const db        = getDatabase();
    const groupData = db.getGroup(groupJid) || {};
    const isGoodbyeOn =
      groupData?.leave === true || groupData?.leave === 1 || groupData?.leave === "true" ||
      groupData?.goodbye === true || groupData?.goodbye === 1 || groupData?.goodbye === "true";
    if (!opts.force && !isGoodbyeOn) {
      console.log("[Goodbye] goodbye off for", groupJid, "| value:", groupData?.leave);
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

    const memberCount = groupMeta?.participants?.length || 0;
    const groupName   = groupMeta?.subject || "Grup";
    const phoneNumber = realParticipant?.split("@")[0] || "User";
    const displayName = resolveDisplayName(realParticipant, groupMeta);

    const stillUnresolved = isLid(realParticipant) || isLidConverted(realParticipant);
    const mentionLabel = stillUnresolved
      ? (displayName && displayName !== phoneNumber ? `*${displayName}*` : "*Member*")
      : null;

    let ppUrl = "./assets/images/pp-kosong.jpg"; // default: file lokal
    try { ppUrl = await sock.profilePictureUrl(realParticipant, "image"); } catch {}

    const text = groupData?.goodbyeMsg
      ? resolvePlaceholders(groupData.goodbyeMsg, phoneNumber, groupName, groupMeta?.desc, memberCount, groupMeta?.owner?.split("@")[0] || "", config.command?.prefix || ".", realParticipant, mentionLabel)
      : buildGoodbyeMessage(realParticipant, groupName, memberCount, realParticipant, displayName, mentionLabel);

    const goodbyeType = parseInt(db.setting("goodbyeType"), 10) || 1;
    const ctxBase      = { ...saluranCtx(), mentionedJid: stillUnresolved ? [] : [realParticipant] };
    const botName      = config.bot?.name || "lyniX's MD";
    const saluranId    = config.saluran?.id   || "120363409557700746@newsletter";
    const saluranName  = config.saluran?.name || botName;

    if (goodbyeType === 2) {
      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          body:   { text: `🚪 ${mentionLabel || `*@${phoneNumber}*`} telah meninggalkan grup` },
          footer: { text: botName },
          header: { title: "Goodbye", hasMediaAttachment: false },
          carouselMessage: {
            cards: [
              {
                header: { imageMessage: /^https?:/.test(ppUrl) ? { url: ppUrl } : (await prepareWAMessageMedia({ image: { url: ppUrl } }, { upload: sock.waUploadToServer })).imageMessage },
                body:   { text },
                footer: { text: botName },
                nativeFlowMessage: {
                  buttons: [
                    {
                      name: "quick_reply",
                      buttonParamsJson: JSON.stringify({
                        display_text: "👋 Sampai Jumpa",
                        id: "bye",
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

    } else if (goodbyeType === 3) {
      await sock.sendMessage(groupJid, {
        text,
        mentions: stillUnresolved ? [] : [realParticipant],
        contextInfo: ctxBase,
      });

    } else if (goodbyeType === 4) {
      await sock.sendMessage(groupJid, {
        text,
        mentions: stillUnresolved ? [] : [realParticipant],
        contextInfo: {
          mentionedJid: stillUnresolved ? [] : [realParticipant],
          forwardingScore: 9999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127,
          },
        },
      });

    } else if (goodbyeType === 5) {
      const previewUrl = "https://ichigostore.my.id";
      await sock.sendPreview(
        groupJid,
        {
          caption: `${previewUrl}\n${text}`,
          url: previewUrl,
          title: `${groupName}`,
          description: `${mentionLabel || `@${phoneNumber}`} keluar dari grup`,
          image: ppUrl,
          previewType: 0,
        },
        {
          mentions: stillUnresolved ? [] : [realParticipant],
          contextInfo: ctxBase,
        },
      );

    } else if (goodbyeType === 6) {
      const now        = moment().tz("Asia/Makassar");
      const cardBuffer = await buildGoodbyeCard(ppUrl, displayName, phoneNumber, groupName, memberCount, now, !stillUnresolved);
      const previewUrl = "https://ichigostore.my.id";

      await sock.sendPreview(
        groupJid,
        {
          caption: `${previewUrl}\n${text}`,
          url: previewUrl,
          title: `${groupName}`,
          description: `${mentionLabel || `@${phoneNumber}`} keluar dari grup`,
          image: cardBuffer,
          previewType: 0,
        },
        {
          mentions: stillUnresolved ? [] : [realParticipant],
          contextInfo: ctxBase,
        },
      );

    } else if (goodbyeType === 7) {
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
              productId: `goodbye-${groupJid.split("@")[0]}-${Date.now()}`,
              title: groupName,
              productImageCount: 1,
            },
            businessOwnerJid: sock.user?.id?.split(":")[0] + "@s.whatsapp.net",
            footer: text,
            contextInfo: {
              mentionedJid: stillUnresolved ? [] : [realParticipant],
              forwardingScore: 1,
              isForwarded: true,
              forwardOrigin: 0,
            },
          },
        },
        {},
      );

    } else {
      await sock.sendMessage(groupJid, {
        interactiveMessage: {
          header: {
            hasMediaAttachment: true,
            imageMessage: (
              await prepareWAMessageMedia(
                { image: { url: ppUrl } },
                { upload: sock.waUploadToServer },
              )
            ).imageMessage,
          },
          title:  text,
          footer: botName,
          contextInfo: ctxBase,
          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "👋 Selamat Tinggal",
                  id: "bye",
                }),
              },
            ],
          },
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Goodbye Error:", error);
    return false;
  }
}

const pluginConfig = {
  name: "goodbye",
  alias: ["gb", "bye"],
  category: "group",
  description: "Mengatur goodbye message untuk grup",
  usage: ".goodbye <on/off>",
  example: ".goodbye on",
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
  const currentStatus = groupData.leave === true || groupData.goodbye === true;
  const goodbyeType   = parseInt(db.setting("goodbyeType"), 10) || 1;

  if (sub === "on" && sub2 === "all") {
    if (!m.isOwner) return m.reply(config.messages.ownerOnly);
    m.react("🕕");
    try {
      const groups   = await sock.groupFetchAllParticipating();
      const groupIds = Object.keys(groups);
      let count = 0;
      for (const groupId of groupIds) { db.setGroup(groupId, { leave: true, goodbye: true }); count++; }
      m.react("✅");
      return m.reply(
        `╔═══════════════════╗\n║  ✅ *ɢʟᴏʙᴀʟ ɢᴏᴏᴅʙʏᴇ ᴏɴ*\n╚═══════════════════╝\n\n` +
        `> Goodbye aktif di *${count}* grup!`,
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
      for (const groupId of groupIds) { db.setGroup(groupId, { leave: false, goodbye: false }); count++; }
      m.react("✅");
      return m.reply(
        `╔═══════════════════╗\n║  ❌ *ɢʟᴏʙᴀʟ ɢᴏᴏᴅʙʏᴇ ᴏꜰꜰ*\n╚═══════════════════╝\n\n` +
        `> Goodbye nonaktif di *${count}* grup!`,
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
        `> Status: *✅ ON*\n> Goodbye sudah aktif di grup ini.\n\n` +
        `_Gunakan \`${m.prefix}goodbye off\` untuk menonaktifkan._`,
      );
    }
    db.setGroup(m.chat, { leave: true, goodbye: true });
    return m.reply(
      `╔═══════════════════╗\n║  ✅ *ɢᴏᴏᴅʙʏᴇ ᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
      `> Goodbye message berhasil diaktifkan!\n> Member yang keluar akan dikirim pesan perpisahan.\n\n` +
      `_Gunakan \`${m.prefix}setgoodbye\` untuk custom pesan._`,
    );
  }

  if (sub === "off") {
    if (!currentStatus) {
      return m.reply(
        `╔═══════════════════╗\n║  ⚠️ *sᴜᴅᴀʜ ɴᴏɴᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
        `> Status: *❌ OFF*\n> Goodbye sudah nonaktif di grup ini.\n\n` +
        `_Gunakan \`${m.prefix}goodbye on\` untuk mengaktifkan._`,
      );
    }
    db.setGroup(m.chat, { leave: false, goodbye: false });
    return m.reply(
      `╔═══════════════════╗\n║  ❌ *ɢᴏᴏᴅʙʏᴇ ɴᴏɴᴀᴋᴛɪꜰ*\n╚═══════════════════╝\n\n` +
      `> Goodbye message berhasil dinonaktifkan.\n> Member yang keluar tidak akan disambut pesan perpisahan.`,
    );
  }

  return m.reply(
    `╔═══════════════════╗\n║  🚪 *ɢᴏᴏᴅʙʏᴇ sᴇᴛᴛɪɴɢs*\n╚═══════════════════╝\n\n` +
    `> Status: *${currentStatus ? "✅ ON" : "❌ OFF"}*\n` +
    `> Type aktif: *${goodbyeType}*\n\n` +
    `*━━ ᴘɪʟɪʜᴀɴ ━━*\n` +
    `› \`${m.prefix}goodbye on\` — Aktifkan\n` +
    `› \`${m.prefix}goodbye off\` — Nonaktifkan\n` +
    `› \`${m.prefix}goodbye on all\` — Global ON _(owner)_\n` +
    `› \`${m.prefix}goodbye off all\` — Global OFF _(owner)_\n` +
    `› \`${m.prefix}setgoodbyetype\` — Ganti tampilan _(owner)_\n` +
    `› \`${m.prefix}setgoodbye\` — Custom pesan goodbye\n` +
    `› \`${m.prefix}resetgoodbye\` — Reset default`,
  );
}

export { pluginConfig as config, handler, sendGoodbyeMessage };