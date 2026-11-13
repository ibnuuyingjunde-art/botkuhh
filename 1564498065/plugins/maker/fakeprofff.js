import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "fakeprofff",
  alias: ["fakeprof", "fakeprofile", "fprof"],
  category: "maker",
  description: "Bikin gambar profil palsu dengan 9 pilihan template (via API Cloud)",
  usage: ".fakeprofff <nama>|<negara>|<likes>|<template 1-9>",
  example: ".fakeprofff Kaze|Indonesia|99999|3\n.fakeprofff Kaze -t 5",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/maker/fakeprofff";
const VERSION = 1;
const MIN_TEMPLATE = 1;
const MAX_TEMPLATE = 9;
const MAX_NAME = 30;
const MAX_COUNTRY = 30;
const MAX_LIKES_DIGITS = 12;
const DEFAULT_COUNTRY = "Indonesia";
const DEFAULT_LIKES = "99999";
const REQUEST_TIMEOUT = 60000;

function usage(prefix, command) {
  return (
    `*ꜰᴀᴋᴇ ᴘʀᴏꜰɪʟᴇ*\n\n` +
    `> Bikin gambar profil palsu dengan ${MAX_TEMPLATE} pilihan template\n\n` +
    `\`${prefix}${command} <nama>\`\n` +
    `\`${prefix}${command} <nama>|<negara>|<likes>|<template>\`\n` +
    `\`${prefix}${command} <nama> -t <template>\`\n\n` +
    `> Template: ${MIN_TEMPLATE} sampai ${MAX_TEMPLATE} (default 1)\n` +
    `> Negara default: ${DEFAULT_COUNTRY}\n` +
    `> Likes default: ${DEFAULT_LIKES}\n` +
    `> Nama kosong memakai nama kamu\n\n` +
    `Contoh:\n` +
    `\`${prefix}${command} Kaze|Indonesia|99999|3\`\n` +
    `\`${prefix}${command} Kaze -t 5\``
  );
}

// "-t 5", "-t5", "--template 5", "--template=5" bisa diletakkan di mana saja
function extractTemplateFlag(input) {
  let flag = null;
  const rest = input.replace(
    /(?:^|\s)(?:--template|-t)\s*=?\s*(\d+)(?=\s|$)/i,
    (_, n) => {
      flag = Number(n);
      return " ";
    }
  );
  return { flag, rest: rest.trim() };
}

function clean(text, max) {
  return [...String(text || "").replace(/\s+/g, " ").trim()].slice(0, max).join("");
}

// Ubah respons "result" (data URI base64, atau link biasa) menjadi Buffer
async function resultToBuffer(raw) {
  if (typeof raw !== "string" || !raw) throw new Error("Format respons API tidak dikenali");

  const dataUri = raw.match(/^data:image\/[\w.+-]+;base64,(.+)$/s);
  if (dataUri) {
    const buffer = Buffer.from(dataUri[1], "base64");
    if (!buffer.length) throw new Error("Gambar kosong");
    return buffer;
  }

  if (/^https?:\/\//i.test(raw)) {
    const dl = await axios.get(raw, { responseType: "arraybuffer", timeout: REQUEST_TIMEOUT });
    return Buffer.from(dl.data);
  }
  throw new Error("Format respons API tidak dikenali");
}

async function handler(m, { sock }) {
  const input = String(m.text || "").trim();
  if (!input) return m.reply(usage(m.prefix, m.command));

  const { flag, rest } = extractTemplateFlag(input);
  // flag -t / --template yang nilainya bukan angka
  if (/(?:^|\s)(?:--template|-t)(?=\s|=|$)/i.test(rest)) {
    return m.reply(`Template tidak valid. Pilih angka ${MIN_TEMPLATE} sampai ${MAX_TEMPLATE}.`);
  }
  const [rawName, rawCountry, rawLikes, rawTemplate] = rest.split("|").map((s) => (s || "").trim());

  const name = clean(rawName || m.pushName, MAX_NAME);
  const country = clean(rawCountry, MAX_COUNTRY) || DEFAULT_COUNTRY;
  const likes = String(rawLikes || "").replace(/\D/g, "") || DEFAULT_LIKES;

  const templateInput = rawTemplate || (flag !== null ? String(flag) : "1");
  const template = Number(templateInput);

  if (!name) return m.reply(usage(m.prefix, m.command));
  if (!Number.isInteger(template) || template < MIN_TEMPLATE || template > MAX_TEMPLATE) {
    return m.reply(`Template tidak valid. Pilih angka ${MIN_TEMPLATE} sampai ${MAX_TEMPLATE}.`);
  }
  if (likes.length > MAX_LIKES_DIGITS) {
    return m.reply(`Likes terlalu besar. Maksimal ${MAX_LIKES_DIGITS} digit.`);
  }

  try {
    const res = await axios.get(API_URL, {
      params: { name, version: VERSION, template, country, likes },
      timeout: REQUEST_TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });

    const data = res.data;
    if (res.status !== 200 || !data || data.status !== true) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.httpStatus = res.status;
      throw err;
    }

    const image = await resultToBuffer(data.result);
    const total = Number(data.totalTemplates) || MAX_TEMPLATE;

    await sock.sendMessage(
      m.chat,
      {
        image,
        caption:
          `*ꜰᴀᴋᴇ ᴘʀᴏꜰɪʟᴇ*\n\n` +
          `> Nama: ${name}\n` +
          `> Negara: ${country}\n` +
          `> Likes: ${likes}\n` +
          `> Template: ${template}/${total}`,
      },
      { quoted: m }
    );
  } catch (error) {
    console.log("[fakeprofff error]", error.message);

    // 400 = input salah, pesannya aman ditampilkan apa adanya
    if (error.httpStatus === 400) return m.reply(`Input tidak valid: ${error.message}`);
    if (error.httpStatus === 429) return m.reply("Layanan sedang penuh atau kena batas. Coba lagi nanti.");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
