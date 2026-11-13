import { canvasNs as _canvas } from "../../src/lib/ichigo-canvas-lazy.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "lquote",
  alias: ["quotes", "quote"],
  category: "maker",
  description: "Buat gambar quotes dari template karakter",
  usage: ".lquote <nomor>|<teks>",
  example: ".lquote 1|lebih baik aku menyerah daripada bertahan tapi tak dihargai",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 8,
  energi: 5,
  isEnabled: true,
};

const templates = {
  1: {
    name: "Template 1",
    image: "https://raw.githubusercontent.com/julzkeceabiez/github-storage/main/uploads/kelvin-evernight-1783302381679.jpg",
    textBox: { x: 260, centerY: 650, maxWidth: 430, lineHeight: 78, align: "center" },
    font: { family: "Arial", size: 58, minSize: 40, weight: "400" },
  },
  2: {
    name: "Template 2",
    image: "https://raw.githubusercontent.com/julzkeceabiez/shadow-tourl-storage/main/uploads/kelvin-evernight-1783302663595.jpg",
    textBox: { x: 270, centerY: 650, maxWidth: 470, lineHeight: 80, align: "center" },
    font: { family: "Arial", size: 58, minSize: 40, weight: "400" },
  },
  3: {
    name: "Template 3",
    image: "https://raw.githubusercontent.com/julzkeceabiez/shadow-tourl-storage/main/uploads/kelvin-evernight-1783303865314.jpg",
    textBox: { x: 930, centerY: 650, maxWidth: 470, lineHeight: 78, align: "center" },
    font: { family: "Arial", size: 56, minSize: 38, weight: "400" },
  },
  4: {
    name: "Template 4",
    image: "https://raw.githubusercontent.com/julzkeceabiez/shadow-tourl-storage/main/uploads/kelvin-evernight-1783303133163.jpg",
    textBox: { x: 350, centerY: 500, maxWidth: 520, lineHeight: 78, align: "center" },
    font: { family: "Arial", size: 56, minSize: 38, weight: "400" },
  },
  5: {
    name: "Template 5",
    image: "https://raw.githubusercontent.com/julzkeceabiez/github-storage/main/uploads/kelvin-evernight-1783303497278.jpg",
    textBox: { x: 880, centerY: 640, maxWidth: 520, lineHeight: 76, align: "center" },
    font: { family: "Arial", size: 54, minSize: 38, weight: "400" },
  },
};

const normalizeText = (str = "") =>
  str.replace(/\s+/g, " ").replace(/\n+/g, " ").trim();

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function fitTextToBox(ctx, text, options = {}) {
  const {
    maxWidth = 400,
    maxLines = 7,
    startSize = 56,
    minSize = 36,
    fontFamily = "Arial",
    fontWeight = "400",
  } = options;

  let fontSize = startSize;
  let lines = [];

  while (fontSize >= minSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, maxWidth);

    const longest = Math.max(...lines.map((v) => ctx.measureText(v).width), 0);
    if (longest <= maxWidth && lines.length <= maxLines) {
      return { fontSize, lines };
    }

    fontSize -= 2;
  }

  ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`;
  lines = wrapText(ctx, text, maxWidth);
  return { fontSize: minSize, lines: lines.slice(0, maxLines) };
}

function fillWhiteBackground(ctx, canvas) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

async function render(selected, cleanText) {
  const { createCanvas, loadImage } = _canvas;
  const canvas = createCanvas(1280, 1280);
  const ctx = canvas.getContext("2d");

  fillWhiteBackground(ctx, canvas);

  const bg = await loadImage(selected.image);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  const { fontSize, lines } = fitTextToBox(ctx, cleanText, {
    maxWidth: selected.textBox.maxWidth,
    maxLines: 7,
    startSize: selected.font.size,
    minSize: selected.font.minSize,
    fontFamily: selected.font.family,
    fontWeight: selected.font.weight,
  });

  const lineHeight = Math.max(selected.textBox.lineHeight, Math.round(fontSize * 1.25));
  const totalHeight = lines.length * lineHeight;
  const startY = selected.textBox.centerY - totalHeight / 2 + lineHeight / 2;

  ctx.fillStyle = "#111111";
  ctx.textAlign = selected.textBox.align || "center";
  ctx.textBaseline = "middle";
  ctx.font = `${selected.font.weight} ${fontSize}px ${selected.font.family}`;

  lines.forEach((line, i) => {
    ctx.fillText(line, selected.textBox.x, startY + i * lineHeight);
  });

  return canvas.toBuffer("image/png");
}

async function handler(m, { sock }) {
  const text = m.text?.trim();

  if (!text) {
    return m.reply(
      `📝 *Format Salah!*\n\nContoh:\n*${m.prefix + m.command} 1|lebih baik aku menyerah daripada bertahan tapi tak dihargai*\n\n*Template tersedia:* 1, 2, 3, 4, 5`
    );
  }

  const input = text.split("|");
  if (input.length < 2) {
    return m.reply(
      `📝 *Format Salah!*\n\nGunakan format:\n*${m.prefix + m.command} nomor|teks*\n\nContoh:\n*${m.prefix + m.command} 3|jangan pernah bertindak sendirian*`
    );
  }

  const templateId = parseInt(input.shift().trim());
  const quoteText = input.join("|").trim();

  if (!templateId || !quoteText) {
    return m.reply(
      `📝 *Format Salah!*\n\nContoh:\n*${m.prefix + m.command} 2|lebih baik diam daripada memaksa dimengerti*`
    );
  }

  const selected = templates[templateId];
  if (!selected) {
    return m.reply(`❌ *Template tidak tersedia!*\n\nPilih template: *1, 2, 3, 4, 5*`);
  }

  await m.react("📝");

  try {
    const cleanText = normalizeText(quoteText);
    const img = await render(selected, cleanText);
    const botName = global.botname || "lyniX's MD";

    await sock.sendMessage(
      m.chat,
      {
        image: img,
        caption: `✅ *Quotes Created Successfully*\n\n🖼️ *Template:* ${templateId}\n💬 *Text:* ${cleanText}\n\n_Processed by ${botName} x Canvas Engine_`,
        mentions: [m.sender],
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: global.idSaluran,
            newsletterName: `${global.namaSaluran || botName}: Mood Maker`,
            serverId: 200,
          },
        },
      },
      { quoted: m }
    );

    await m.react("✅");
  } catch (error) {
    console.log(error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };