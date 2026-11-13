import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import axios from "axios";
import fetch from "node-fetch";
import { sharp } from "../../src/lib/ichigo-lazy.js";
import { createCanvas, loadImage, GlobalFonts } from "../../src/lib/ichigo-canvas-lazy.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import ichigoApi from "../../src/lib/ichigo-apimanager.js";

const execFileAsync = promisify(execFile);

const pluginConfig = {
  name: "brat",
  alias: [
    "bratmenu",
    "bratimg",
    "brattext",
    "bratcewek",
    "bratvermeil",
    "bratvid",
    "bratvid2",
    "bratgreen",
    "bratmika",
    "bratvidhd",
    
    "bratgojo",
    "bratgojovid",
    "bratvermeilvid",
  ],
  category: "sticker",
  description: "Menu variant brat dan generator sticker brat",
  usage: ".brat | .bratimg <text>",
  example: ".bratimg Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const BRAT_VARIANTS = [
  { title: "Brat Default", command: "bratimg" },
  { title: "Brat Cewek", command: "bratcewek" },
  { title: "Brat Vermeil", command: "bratvermeil" },
  { title: "Brat Vermeil Video", command: "bratvermeilvid" },
  { title: "Brat Video", command: "bratvid" },
  { title: "Brat Green", command: "bratgreen" },
  { title: "Brat Mika", command: "bratmika" },
  { title: "Brat Video HD", command: "bratvidhd" },
  { title: "Brat Gojo", command: "bratgojo" },
  { title: "Brat Gojo Video", command: "bratgojovid" },
];

const BRAT_FONT_URL =
  "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";
let isFontLoaded = false;

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal download asset: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/* ============================================================================
 * ENGINE B — safe-zone auto-fit + video reveal (diadaptasi dari bratlocal.js)
 * Dipakai buat gojo & vermeil (yang punya versi video "reveal per kata").
 * ==========================================================================*/

const TEMPLATES_B = {
  vermeil: {
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg",
    safeZone: { a: 655, b: 1118, c: 282, d: 993 },
  },
  gojo: {
    url: "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Gojo.jpeg",
    safeZone: { a: 660, b: 1180, c: 270, d: 990 },
  },
};

const CANVAS_B = { width: 1254, height: 1254 };

const TEXT_STYLE_B = {
  fontFamily: "Poppins",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center",
};

const VIDEO_CONFIG_B = {
  fps: 15,
  width: 512,
  height: 512,
  lyric: {
    maxWordPerLayer: 5,
    frameDuration: 0.7,
    lastFrameDuration: 1.5,
  },
};

function normalizeTextB(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeB(text) {
  return normalizeTextB(text)
    .replace(/[,，]/g, " ")
    .split(/\s+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
  if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
    return [tokens];
  }
  const layers = [];
  for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
    layers.push(tokens.slice(i, i + maxWordPerLayer));
  }
  return layers;
}

function buildRevealFrames(text, cfg) {
  const tokens = tokenizeB(text);
  const layers = splitIntoLayers(tokens, cfg.lyric.maxWordPerLayer);
  const frames = [];

  for (const layer of layers) {
    let current = "";
    for (let i = 0; i < layer.length; i++) {
      current += (current ? " " : "") + layer[i];
      frames.push({ text: current, isLastInLayer: i === layer.length - 1 });
    }
  }

  return frames.map((frame) => ({
    ...frame,
    duration: frame.isLastInLayer
      ? Math.max(0.05, cfg.lyric.lastFrameDuration)
      : Math.max(0.05, cfg.lyric.frameDuration),
  }));
}

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2,
  };
}

function setFontB(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE_B.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapTextB(ctx, text, maxWidth) {
  return text.split("\n").flatMap((paragraph) => {
    const clean = paragraph.trim();
    if (!clean) return [""];
    return wrapParagraph(ctx, clean, maxWidth);
  });
}

function fitText(ctx, text, rect) {
  for (let size = TEXT_STYLE_B.maxFontSize; size >= TEXT_STYLE_B.minFontSize; size--) {
    setFontB(ctx, size);
    const lineHeight = Math.ceil(size * TEXT_STYLE_B.lineHeight);
    const lines = wrapTextB(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= rect.h) {
      return { size, lines, lineHeight, totalHeight };
    }
  }

  const size = TEXT_STYLE_B.minFontSize;
  setFontB(ctx, size);
  const lineHeight = Math.ceil(size * TEXT_STYLE_B.lineHeight);
  const lines = wrapTextB(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }
    clipped[clipped.length - 1] = `${last}...`;
  }

  return { size, lines: clipped, lineHeight, totalHeight: clipped.length * lineHeight };
}

function drawCenteredTextB(ctx, text, zone) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFontB(ctx, fitted.size);
  ctx.fillStyle = TEXT_STYLE_B.color;
  ctx.textAlign = TEXT_STYLE_B.align;
  ctx.textBaseline = "top";

  fitted.lines.forEach((line, index) => {
    const y = startY + index * fitted.lineHeight;
    ctx.fillText(line, rect.centerX, y);
  });

  ctx.restore();
}

async function ensureFontLoadedB() {
  if (isFontLoaded) return;
  const fontBuffer = await downloadBuffer(BRAT_FONT_URL);
  GlobalFonts.register(fontBuffer, TEXT_STYLE_B.fontFamily);
  isFontLoaded = true;
}

async function renderTemplateBImage(text, template) {
  await ensureFontLoadedB();
  const imageBuffer = await downloadBuffer(template.url);
  const image = await loadImage(imageBuffer);
  const canvas = createCanvas(CANVAS_B.width, CANVAS_B.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, CANVAS_B.width, CANVAS_B.height);
  drawCenteredTextB(ctx, text, template.safeZone);
  return canvas.encode("png");
}

async function createFrameB(image, text, filePath, template) {
  const canvas = createCanvas(CANVAS_B.width, CANVAS_B.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, CANVAS_B.width, CANVAS_B.height);
  drawCenteredTextB(ctx, text, template.safeZone);
  fs.writeFileSync(filePath, await canvas.encode("png"));
}

function escapeConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildManifest(frames, framePaths) {
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    lines.push(`file '${escapeConcatPath(framePaths[i])}'`);
    lines.push(`duration ${frames[i].duration}`);
  }
  lines.push(`file '${escapeConcatPath(framePaths[framePaths.length - 1])}'`);
  return lines.join("\n");
}

async function encodeVideoB(concatPath, outputPath) {
  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
    "-vf", `fps=${VIDEO_CONFIG_B.fps},scale=${VIDEO_CONFIG_B.width}:${VIDEO_CONFIG_B.height}:flags=lanczos`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "32",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];
  await execFileAsync("ffmpeg", args, { maxBuffer: 1024 * 1024 * 10 });
}

async function renderTemplateBVideo(text, template) {
  const frames = buildRevealFrames(normalizeTextB(text), VIDEO_CONFIG_B);
  if (!frames.length) throw new Error("Teks kosong");

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bratvid-"));
  const outputPath = path.join(tmpDir, "output.mp4");

  try {
    await ensureFontLoadedB();
    const imageBuffer = await downloadBuffer(template.url);
    const image = await loadImage(imageBuffer);

    const framePaths = frames.map((_, index) =>
      path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`),
    );

    const batchSize = 5;
    for (let start = 0; start < frames.length; start += batchSize) {
      const batch = frames.slice(start, start + batchSize);
      await Promise.all(
        batch.map((frame, i) =>
          createFrameB(image, frame.text, framePaths[start + i], template),
        ),
      );
    }

    const concatPath = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatPath, buildManifest(frames, framePaths));

    await encodeVideoB(concatPath, outputPath);

    return fs.readFileSync(outputPath);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ============================================================================
 * EXTERNAL API ROUTES — provider pihak ketiga lewat ichigo-apimanager.js
 * ==========================================================================*/

const VARIANT_ROUTES = {
  bratimg: { mode: "url", build: (text) => ichigoApi.azbry.url("/api/maker/brat", { text }) },
  bratcewek: {
    mode: "url",
    build: (text) => ichigoApi.azbry.url("/api/maker/bratcanvas", { text, warna: "pink", blur: 0 }),
  },
  bratvermeil: {
    mode: "url",
    build: (text) => ichigoApi.cuki.url("/api/canvas/brat/bratnime-vermeil", { text }),
  },
  bratvid: { mode: "url", build: (text) => ichigoApi.apiFaa.url("/faa/bratvid", { text }) },
  bratvid2: { mode: "url", build: (text) => ichigoApi.apiFaa.url("/faa/bratvid", { text }) },

  bratgreen: {
    mode: "buffer",
    build: (text) => ichigoApi.ichigo.buffer("/api/brat-grenn", { params: { text } }),
  },
  bratmika: {
    mode: "buffer",
    build: (text) => ichigoApi.azbry.buffer("/api/maker/bratmika", { params: { text } }),
  },
  bratvidhd: {
    mode: "buffer",
    build: (text) => ichigoApi.nexrayAlt.buffer("/maker/bratvidhd", { params: { text } }),
  },
};

const VIDEO_COMMANDS = new Set(["bratvid", "bratvid2"]);
const CANVAS_B_IMAGE_COMMANDS = { bratgojo: "gojo" };
const CANVAS_B_VIDEO_COMMANDS = { bratgojovid: "gojo", bratvermeilvid: "vermeil" };

const lastResultByCommand = new Map();

function hashBuffer(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function isSuspectedStaleFallback(command, text, hash) {
  const prev = lastResultByCommand.get(command);
  lastResultByCommand.set(command, { text, hash });
  return Boolean(prev && prev.hash === hash && prev.text !== text);
}

async function normalizeStickerBuffer(buffer) {
  return sharp(buffer).flatten({ background: "#ffffff" }).png().toBuffer();
}

function buildVariantRows(prefix, text) {
  const safeText = text ? ` ${text}` : "";
  return BRAT_VARIANTS.map((v) => ({
    title: v.title,
    description: `.${v.command} <text>`,
    id: `${prefix}${v.command}${safeText}`,
  }));
}

async function sendBratMenu(m, sock) {
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  let jpegThumbnail = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : undefined;

  if (jpegThumbnail) {
    try {
      jpegThumbnail = await sharp(jpegThumbnail)
        .resize(300, 300, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (e) {
      
    }
  }

  const paramsJson = JSON.stringify({
    title: "🌾 Pilih Variant Brat",
    sections: [{ title: "Variant Brat", rows: buildVariantRows(m.prefix, m.text) }],
  });

  const _now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const jam = `${String(_now.getHours()).padStart(2, "0")}:${String(_now.getMinutes()).padStart(2, "0")}`;
  const _t0 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
  const pingWA = Math.max(1, Date.now() - _t0);

  await sock.relayMessage(
    m.chat,
    {
      buttonsMessage: {
        buttons: [
          {
            buttonId: "kategori",
            buttonText: { displayText: "☰ SELECT" },
            type: 1,
            nativeFlowInfo: { name: "single_select", paramsJson },
          },
        ],
        locationMessage: {
          name: "──「 𝑩𝒓𝒂𝒕 𝑴𝒆𝒏𝒖 」──",
          address: `⏱ ◷ ${jam} WITA  ·  ⌁ ${pingWA}ms`,
          jpegThumbnail,
        },
        contentText: "🌿 *kamu mau buat brat yak, silahkan pilih variant brat tombol dibawah*",
        footerText: "Pilih variant brat favorit kamu",
        contextInfo: {
          mentionedJid: [m.sender],
          isForwarded: true,
          forwardingScore: 7,
          groupMentions: [],
          statusAttributions: [],
        },
        headerType: 6,
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      },
    },
    {},
  );
}

async function handler(m, { sock }) {
  const text = m.text;
  const command = String(m.command || "").toLowerCase();

  if (command === "brat" || command === "bratmenu" || command === "brattext") {
    await sendBratMenu(m, sock);
    return;
  }

  if (!text) {
    return m.reply(
      `🖼️ *ʙʀᴀᴛ ɪᴍᴀɢᴇ*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratimg Hai semua\``,
    );
  }

  m.react("🕕");

  try {
    if (CANVAS_B_IMAGE_COMMANDS[command]) {
      const template = TEMPLATES_B[CANVAS_B_IMAGE_COMMANDS[command]];
      const media = await renderTemplateBImage(text, template);
      await sock.sendImageAsSticker(m.chat, media, m, {
        packname: config.sticker.packname,
        author: config.sticker.author,
      });
    } else if (CANVAS_B_VIDEO_COMMANDS[command]) {
      const template = TEMPLATES_B[CANVAS_B_VIDEO_COMMANDS[command]];
      const videoBuffer = await renderTemplateBVideo(text, template);
      const tempPath = path.join(os.tmpdir(), `bratvid-${Date.now()}.mp4`);
      fs.writeFileSync(tempPath, videoBuffer);
      try {
        await sock.sendVideoAsSticker(m.chat, tempPath, m, {
          packname: config.sticker.packname,
          author: config.sticker.author,
        });
      } finally {
        fs.unlink(tempPath, () => {});
      }
    } else {
      const route = VARIANT_ROUTES[command] || VARIANT_ROUTES.bratimg;

      if (VIDEO_COMMANDS.has(command)) {
        const mediaUrl = await route.build(text);
        await sock.sendVideoAsSticker(m.chat, mediaUrl, m, {
          packname: config.sticker.packname,
          author: config.sticker.author,
        });
      } else if (route.mode === "buffer") {
        const rawBuffer = await route.build(text);
        const media = await normalizeStickerBuffer(rawBuffer);

        if (isSuspectedStaleFallback(command, text, hashBuffer(media))) {
          const err = new Error(
            `Provider buat .${command} kelihatannya lagi rusak (balikin gambar yang sama terus walau teksnya beda).`,
          );
          err.brokenProvider = true;
          throw err;
        }

        await sock.sendImageAsSticker(m.chat, media, m, {
          packname: config.sticker.packname,
          author: config.sticker.author,
        });
      } else {
        const mediaUrl = await route.build(text);
        await sock.sendImageAsSticker(m.chat, mediaUrl, m, {
          packname: config.sticker.packname,
          author: config.sticker.author,
        });
      }
    }

    m.react("✅");
  } catch (error) {
    m.react("☢");
    console.error(`[brat] Error saat proses .${command}:`, error);

    if (error?.brokenProvider) {
      m.reply(
        `⚠️ *.${command}* lagi bermasalah di sisi provider (bukan bug bot) — hasilnya keluar sama terus walau teks beda-beda.\n\nCoba variant brat lain dulu ya, atau tunggu providernya dibenerin.`,
      );
      return;
    }

    if (m.isOwner) {
      m.reply(
        `⚠️ *.${command}* error:\n\`\`\`${error?.message || error}\`\`\`\n\nCek console panel buat stack trace lengkap.`,
      );
      return;
    }

    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };