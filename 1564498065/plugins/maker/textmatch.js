import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "textmatch",
  alias: ["matchcut", "textmatchcut", "tmc"],
  category: "maker",
  description: "Bikin video text match cut dari teks (via API Cloud)",
  usage: ".textmatch <teks>|[rasio]|[suara]",
  example: ".textmatch TACO again|9:16|paper",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 3,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/maker/textmatch";
const MAX_TEXT = 23;
const RATIOS = ["9:16", "1:1", "16:9"];
const SOUNDS = ["paper", "shutter", "film", "polaroid", "flash", "none"];

const REQUEST_TIMEOUT = 75000; // server menunggu sampai ~50 detik per request
const TOTAL_TIMEOUT = 4 * 60000; // batas total menunggu render
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function usage(prefix, command) {
  return (
    `*ᴛᴇxᴛ ᴍᴀᴛᴄʜ ᴄᴜᴛ*\n\n` +
    `> Bikin video teks gaya match cut dengan efek suara\n\n` +
    `\`${prefix}${command} <teks>\`\n` +
    `\`${prefix}${command} <teks>|<rasio>|<suara>\`\n\n` +
    `> Teks maksimal ${MAX_TEXT} karakter\n` +
    `> Rasio: ${RATIOS.join(", ")} (default 9:16)\n` +
    `> Suara: ${SOUNDS.join(", ")} (default paper)\n\n` +
    `Contoh: \`${prefix}${command} TACO again|1:1|polaroid\``
  );
}

async function callApi(params) {
  return axios.get(API_URL, {
    params,
    timeout: REQUEST_TIMEOUT,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });
}

// buat job lalu tunggu sampai selesai (server membalas 202 + id kalau render belum kelar)
async function renderVideo({ text, ratio, sound }) {
  const startedAt = Date.now();
  let res = await callApi({ teks: text, text, ratio, sound });

  while (res.status === 202 && res.data && res.data.pending && res.data.id) {
    if (Date.now() - startedAt > TOTAL_TIMEOUT) {
      throw new Error("Render terlalu lama, coba lagi nanti");
    }
    const wait = Math.max(3, Number(res.data.retryAfter) || 10);
    await sleep(wait * 1000);
    // polling hanya pakai id, supaya tidak membuat job baru
    res = await callApi({ id: res.data.id });
  }

  const data = res.data;
  if (res.status !== 200 || !data || data.status !== true) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }

  const raw = typeof data.result === "string" ? data.result : "";
  const match = raw.match(/^data:video\/[\w.+-]+;base64,(.+)$/s);
  if (!match) throw new Error("Format respons API tidak dikenali");

  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length) throw new Error("Video kosong");
  return buffer;
}

async function handler(m, { sock }) {
  const input = String(m.text || "").trim();
  if (!input) return m.reply(usage(m.prefix, m.command));

  const [rawText, rawRatio, rawSound] = input.split("|").map((s) => (s || "").trim());
  const text = (rawText || "").replace(/\s+/g, " ");

  if (!text) return m.reply(usage(m.prefix, m.command));
  if ([...text].length > MAX_TEXT) {
    return m.reply(`Teks terlalu panjang. Maksimal ${MAX_TEXT} karakter (sekarang ${[...text].length}).`);
  }

  const ratio = rawRatio || "9:16";
  const sound = (rawSound || "paper").toLowerCase();

  m.react("🕕");

  try {
    const buffer = await renderVideo({ text, ratio, sound });

    await sock.sendMessage(
      m.chat,
      {
        video: buffer,
        mimetype: "video/mp4",
        caption: `*ᴛᴇxᴛ ᴍᴀᴛᴄʜ ᴄᴜᴛ*\n\n> ${text}`,
      },
      { quoted: m }
    );
    m.react("✅");
  } catch (error) {
    m.react("☢");
    console.log("[textmatch error]", error.message);

    // 400 = input salah (rasio/suara/teks), pesannya aman ditampilkan apa adanya
    if (error.httpStatus === 400) return m.reply(`Input tidak valid: ${error.message}`);
    if (error.httpStatus === 429) return m.reply("Antrian render sedang penuh. Coba lagi beberapa saat lagi.");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };