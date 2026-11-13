import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich, Button, ButtonV2, Carousel } = IchigoBuilder;

const pluginConfig = {
  name: "remix",
  alias: ["loadfrom", "rebuild", "editmsg"],
  category: "tools",
  description: "Round-trip edit — reply pesan interaktif (Button/ButtonV2/Carousel/AIRich) hasil bot lalu rekonstruksi via loadFrom()",
  usage: ".remix (reply pesan bot)\n.remix -list\n.remix -add <teks>\n.remix -delete <id>\n.remix -addbutton <teks>",
  example: '.remix -add "Section baru ditambahkan lewat loadFrom"',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const PARTICLES = ["✦", "◈", "⟡", "❋", "✺", "⊹"];

function randomParticle() {
  return PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
}

function parseArgs(args = []) {
  const raw = Array.isArray(args) ? args : [];
  const tokens = raw.flatMap((x) => String(x).trim().split(/\s+/)).filter(Boolean);

  const flags = new Set();
  const textParts = [];

  for (const t of tokens) {
    if (t.startsWith("-")) {
      flags.add(t.replace(/^-+/, "").toLowerCase());
    } else {
      textParts.push(t);
    }
  }

  return { flags, text: textParts.join(" ") };
}

function detectBuilderKind(quoted) {
  const msg = quoted?.message || quoted;

  if (msg?.richResponseMessage || msg?.botForwardedMessage?.message?.richResponseMessage || msg?.botForwardedMessage?.richResponseMessage) {
    return "airich";
  }

  if (msg?.buttonsMessage) return "buttonv2";
  if (msg?.interactiveMessage?.carouselMessage) return "carousel";
  if (msg?.interactiveMessage) return "button";

  return null;
}

function frame(title, lines = []) {
  const p = randomParticle();
  return [`╭─「 ${p} ${title} ${p} 」`, "│", ...lines.map((l) => `├ ${l}`), "│", "╰─「 𝘾𝙡𝙤𝙪𝙙 𝙈𝘿 」"].join("\n");
}

async function sendHelp(sock, chat, prefix) {
  await new AIRich(sock)
    .addText(
      frame("𝙍𝙚𝙢𝙞𝙭 — loadFrom() Demo", [
        "Reply pesan interaktif hasil bot (Button / ButtonV2 / Carousel / AIRich)",
        "",
        `\`${prefix}remix -list\`        lihat isi hasil rekonstruksi`,
        `\`${prefix}remix -add <teks>\`  (AIRich) tambah section + edit in-place`,
        `\`${prefix}remix -delete <id>\` (AIRich) hapus node by id + edit in-place`,
        `\`${prefix}remix -addbutton <teks>\` (Button/ButtonV2) tambah tombol + kirim ulang`,
      ])
    )
    .send(chat);
}

async function handleAIRich(sock, m, quoted, flags, text, prefix) {
  const rich = new AIRich(sock).loadFrom(quoted.message);
  const ids = rich.getIds();

  if (flags.has("list") || (!flags.size && !text)) {
    await new AIRich(sock)
      .addText(
        frame("𝙍𝙚𝙢𝙞𝙭 — AIRich Info", [
          `Disclaimer : ${rich._title || "-"}`,
          `Jumlah node: ${rich.sections.length}`,
          `Id terdaftar: ${ids.length ? ids.join(", ") : "(tidak ada node beridentitas)"}`,
          "",
          `Pakai \`${prefix}remix -add <teks>\` atau \`${prefix}remix -delete <id>\``,
        ])
      )
      .send(m.chat);
    m.react("✅");
    return;
  }

  if (flags.has("delete")) {
    if (!text) throw new Error(`Sertakan id yang mau dihapus. Id tersedia: ${ids.join(", ") || "(kosong)"}`);
    rich.delete(text);
    await rich.sendEdit(m.chat, quoted.id);
    m.react("🗑️");
    return;
  }

  if (flags.has("add")) {
    if (!text) throw new Error("Sertakan teks yang mau ditambahkan, contoh: -add Halo dunia");
    const newId = `remix_${Date.now()}`;
    rich.addText(`${randomParticle()} ${text}`, { id: newId });
    await rich.sendEdit(m.chat, quoted.id);
    m.react("✏️");
    return;
  }

  throw new Error(`Mode tidak dikenal untuk AIRich. Pakai -list / -add / -delete`);
}

async function handleButton(sock, m, quoted, text) {
  if (!text) throw new Error("Sertakan teks tombol, contoh: -addbutton Konfirmasi");

  const btn = new Button(sock).loadFrom(quoted.message);
  btn.addReply(text, `remix_${Date.now()}`);
  await btn.send(m.chat, { quoted: m });
  m.react("✅");
}

async function handleButtonV2(sock, m, quoted, text) {
  if (!text) throw new Error("Sertakan teks tombol, contoh: -addbutton Konfirmasi");

  const btn = new ButtonV2(sock).loadFrom(quoted.message);
  btn.addButton(text);
  await btn.send(m.chat, { quoted: m });
  m.react("✅");
}

async function handleCarousel(sock, m, quoted) {
  const car = new Carousel(sock).loadFrom(quoted.message);
  await car.send(m.chat, { quoted: m });
  m.react("✅");
}

async function handler(m, { sock }) {
  const quoted = m.quoted;
  const prefix = m.prefix || ".";
  const { flags, text } = parseArgs(m.args);

  if (!quoted) {
    await sendHelp(sock, m.chat, prefix);
    return;
  }

  m.react("🤖");

  try {
    const kind = detectBuilderKind(quoted);

    if (!kind) {
      throw new Error("Pesan yang di-reply bukan hasil Button, ButtonV2, Carousel, atau AIRich milik bot.");
    }

    if (kind === "airich") {
      await handleAIRich(sock, m, quoted, flags, text, prefix);
      return;
    }

    if (flags.has("addbutton") || flags.has("add")) {
      if (kind === "button") return await handleButton(sock, m, quoted, text);
      if (kind === "buttonv2") return await handleButtonV2(sock, m, quoted, text);
    }

    if (kind === "carousel") {
      return await handleCarousel(sock, m, quoted);
    }

    throw new Error(`Pesan terdeteksi sebagai "${kind}". Pakai -addbutton <teks> untuk menambah tombol.`);
  } catch (error) {
    console.error("[REMIX]", error?.message || error);
    m.react("☢");
    await new AIRich(sock).addText(frame("☢️ 𝙀𝙧𝙧𝙤𝙧", [error?.message || String(error)])).send(m.chat);
  }
}

export { pluginConfig as config, handler };