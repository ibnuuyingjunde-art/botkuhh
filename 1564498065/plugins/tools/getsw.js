import fs from "fs";
import path from "path";
import { config } from "../../config.js";
const botConfig = config;

const CACHE_DIR = path.join(process.cwd(), "temp", "sw_cache");

const pluginConfig = {
  name: "getsw",
  alias: ["ambilsw", "getstory", "cekstatus"],
  category: "tools",
  description: "Ambil status/story WhatsApp orang lain yang sudah tersimpan di cache",
  usage: ".getsw <nomor>",
  example: ".getsw 628123456789",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function normalizeNumber(raw) {
  let num = (raw || "").replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  return num;
}

function getUserCacheFile(number) {
  return path.join(CACHE_DIR, `${number}.json`);
}

async function handler(m, { sock, args }) {
  const rawNumber = args[0];

  if (!rawNumber) {
    await m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> \`${m.prefix}getsw <nomor>\`\n` +
      `> Contoh: \`${m.prefix}getsw 628123456789\``
    );
    return;
  }

  const number = normalizeNumber(rawNumber);
  const jid = `${number}@s.whatsapp.net`;
  const cacheFile = getUserCacheFile(number);

  if (!fs.existsSync(cacheFile)) {
    await m.reply(
      `❌ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴅᴀᴛᴀ*\n\n` +
      `> Belum ada status tersimpan untuk nomor *${number}*.\n` +
      `> _Bot hanya bisa mengambil status yang sempat lewat & terekam saat kontak tsb update status._`
    );
    return;
  }

  let entries = [];
  try {
    entries = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
  } catch (e) {
    await m.reply(`❌ Gagal membaca data cache.`);
    return;
  }

  if (!entries.length) {
    await m.reply(`❌ Belum ada status tersimpan untuk nomor *${number}*.`);
    return;
  }

  await m.react("🕕");

  for (const entry of entries) {
    try {
      const filePath = path.join(CACHE_DIR, entry.file);
      if (!fs.existsSync(filePath)) continue;
      const buffer = fs.readFileSync(filePath);

      if (entry.type === "image") {
        await sock.sendMessage(m.chat, { image: buffer, caption: entry.caption || "" });
      } else if (entry.type === "video") {
        await sock.sendMessage(m.chat, { video: buffer, caption: entry.caption || "" });
      } else if (entry.type === "text") {
        await sock.sendMessage(m.chat, { text: entry.text || "" });
      }
    } catch (e) {
      console.error("Gagal kirim status cache:", e);
    }
  }

  await m.react("✅");
}

export { pluginConfig as config, handler };