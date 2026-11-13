const pluginConfig = {
  name: "typewriter",
  alias: ["stream", "streamtext", "ngetik"],
  category: "tools",
  description: "Demo efek streaming/mengetik — satu pesan teks diedit bertahap pakai fitur native WhatsApp message edit (protocolMessage type 14), tanpa reply/quote dan tanpa tag AI Bot.",
  usage: ".typewriter <teks>\n.typewriter -speed <ms> <teks>\n.typewriter -chunk <jumlah kata> <teks>",
  example: ".typewriter -speed 400 -chunk 4 Halo! Ini demo efek mengetik di WhatsApp.",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 8,
  energi: 1,
  isEnabled: true,
};

const MIN_SPEED = 350;
const MAX_STEPS = 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse "-speed 500 -chunk 4 sisa teks di sini" menjadi
 * { flags: { speed: "500", chunk: "4" }, text: "sisa teks di sini" }
 */
function parseArgs(args = []) {
  const raw = Array.isArray(args) ? args : [];
  const tokens = raw.flatMap((x) => String(x).trim().split(/\s+/)).filter(Boolean);

  const flags = {};
  const textParts = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.startsWith("-")) {
      const key = t.replace(/^-+/, "").toLowerCase();
      const next = tokens[i + 1];

      if (next !== undefined && !next.startsWith("-") && /^\d+$/.test(next)) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }

    textParts.push(t);
  }

  return { flags, text: textParts.join(" ") };
}

/**
 * Pecah teks jadi array kalimat kumulatif (progressive reveal),
 * bertambah `wordsPerStep` kata setiap langkah. Elemen terakhir
 * selalu teks lengkap.
 */
function progressiveReveal(text, wordsPerStep = 3) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const steps = [];

  for (let i = wordsPerStep; i < words.length; i += wordsPerStep) {
    steps.push(words.slice(0, i).join(" "));
  }

  steps.push(words.join(" "));

  return steps;
}

async function handler(m, { sock }) {
  const prefix = m.prefix || ".";
  const { flags, text } = parseArgs(m.args);

  if (!text) {
    await m.reply(
      `⌨️ *Typewriter — Streaming Edit Demo*\n\n` +
        `Kirim teks yang muncul bertahap dengan mengedit pesan yang sama (native WhatsApp message edit), bukan mengirim pesan baru tiap langkah. Tidak ada reply/quote dan tidak ada tag AI Bot.\n\n` +
        `\`${prefix}typewriter <teks>\`\n` +
        `\`${prefix}typewriter -speed <ms> <teks>\` — default 700ms, min ${MIN_SPEED}ms\n` +
        `\`${prefix}typewriter -chunk <n> <teks>\` — kata per langkah, default 3`
    );
    return;
  }

  const speed = Math.max(MIN_SPEED, Number(flags.speed) || 700);
  const wordsPerStep = Math.max(1, Number(flags.chunk) || 3);

  m.react("⌨️");

  try {
    const steps = progressiveReveal(text, wordsPerStep).slice(0, MAX_STEPS);

    const sent = await sock.sendMessage(m.chat, { text: steps[0] });

    for (let i = 1; i < steps.length; i++) {
      await sleep(speed);
      await sock.sendMessage(m.chat, { text: steps[i], edit: sent.key });
    }

    m.react("✅");
  } catch (error) {
    console.error("[TYPEWRITER]", error?.message || error);
    m.react("☢");
    await m.reply(`☢️ Error: ${error?.message || String(error)}`);
  }
}

export { pluginConfig as config, handler };