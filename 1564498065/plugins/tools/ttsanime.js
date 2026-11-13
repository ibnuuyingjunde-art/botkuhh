import axios from 'axios';

const pluginConfig = {
  name: "ttsanime",
  alias: ["ttsiko", "umamusume", "ttsanime-pick"],
  category: "tools",
  description: "Text-to-speech suara karakter Umamusume, Genshin Impact & Sanobawitch (147 karakter)",
  usage: ".ttsanime <teks>  atau  .ttsanime <karakter>|<teks>",
  example: ".ttsanime Paimon|Halo semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/tts/umamusume";
const MAX_TEXT = 300;

// ID karakter = nomor urut di API (bisa dikirim lewat ?character=<nomor>)
const GROUPS = [
  {
    key: "uma",
    title: "Umamusume",
    start: 1,
    names: [
      "Special Week", "Silence Suzuka", "Tokai Teio", "Maruzensky", "Fuji Kiseki", "Oguri Cap",
      "Gold Ship", "Vodka", "Daiwa Scarlet", "Taiki Shuttle", "Grass Wonder", "Hishi Amazon",
      "Mejiro Mcqueen", "El Condor Pasa", "T.M. Opera O", "Narita Brian", "Symboli Rudolf",
      "Air Groove", "Agnes Digital", "Seiun Sky", "Tamamo Cross", "Fine Motion", "Biwa Hayahide",
      "Mayano Topgun", "Manhattan Cafe", "Mihono Bourbon", "Mejiro Ryan", "Yukino Bijin",
      "Rice Shower", "Ines Fujin", "Agnes Tachyon", "Admire Vega", "Inari One", "Winning Ticket",
      "Air Shakur", "Eishin Flash", "Curren Chan", "Kawakami Princess", "Gold City",
      "Sakura Bakushin O", "Seeking the Pearl", "Shinko Windy", "Sweep Tosho", "Super Creek",
      "Smart Falcon", "Zenno Rob Roy", "Tosen Jordan", "Nakayama Festa", "Narita Taishin",
      "Nishino Flower", "Haru Urara", "Bamboo Memory", "Matikane Fukukitaru", "Meisho Doto",
      "Mejiro Dober", "Nice Nature", "King Halo", "Matikane Tannhauser", "Ikuno Dictus",
      "Mejiro Palmer", "Daitaku Helios", "Twin Turbo", "Satono Diamond", "Kitasan Black",
      "Sakura Chiyono O", "Sirius Symboli", "Mejiro Ardan", "Yaeno Muteki", "Tsurumaru Tsuyoshi",
      "Mejiro Bright", "Sakura Laurel", "Narita Top Road", "Yamanin Zephyr", "Aston Machan",
      "Hayakawa Tazuna", "Kopano Rickey", "Wonder Acute", "President Akikawa"
    ],
  },
  {
    key: "sanoba",
    title: "Sanoba Witch",
    start: 79,
    names: [
      "Ayachi Nene", "Inaba Meguru", "Shiiba Tsumugi", "Kariya Wakama", "Togakushi Touko"
    ],
  },
  {
    key: "genshin",
    title: "Genshin Impact",
    start: 84,
    names: [
      "Kujou Sara", "Barbara", "Paimon", "Arataki Itto", "Sayu", "Xiangling", "Kamisato Ayaka",
      "Chongyun", "Wanderer", "Eula", "Ningguang", "Zhongli", "Raiden Shogun",
      "Kaedehara Kazuha", "Cyno", "Noelle", "Yae Miko", "Kaeya", "Xiao", "Thoma", "Klee",
      "Diluc", "Yelan", "Shikanoin Heizou", "Xinyan", "Lisa", "Yun Jin", "Candace", "Rosaria",
      "Beidou", "Sangonomiya Kokomi", "Yanfei", "Kuki Shinobu", "Yoimiya", "Amber", "Diona",
      "Bennett", "Razor", "Albedo", "Venti", "Player Male", "Kamisato Ayato", "Jean",
      "Alhaitham", "Mona", "Nilou", "Hu Tao", "Ganyu", "Nahida", "Keqing", "Player Female",
      "Aloy", "Collei", "Dori", "Tighnari", "Sucrose", "Xingqiu", "Oz", "Gorou", "Tartalia",
      "Qiqi", "Shenhe", "Layla", "Fishl"
    ],
  }
];

const CHARACTERS = GROUPS.flatMap((g) =>
  g.names.map((name, i) => ({ id: g.start + i, name, group: g.title, groupKey: g.key }))
);

const LANGS = {
  jp: { id: 1, label: "日本語 (Jepang)" },
  zh: { id: 2, label: "简体中文 (Mandarin)" },
  en: { id: 3, label: "English" },
  mix: { id: 4, label: "Mix" },
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function randomChar() {
  return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}

// Return: { char } kalau ketemu satu, { matches } kalau ambigu, {} kalau tidak ada
function findCharacter(query) {
  const q = norm(query);
  if (!q) return {};
  if (/^\d+$/.test(q)) {
    const byId = CHARACTERS.find((c) => c.id === Number(q));
    return byId ? { char: byId } : {};
  }
  const exact = CHARACTERS.find((c) => norm(c.name) === q);
  if (exact) return { char: exact };
  const matches = CHARACTERS.filter((c) => norm(c.name).includes(q));
  if (matches.length === 1) return { char: matches[0] };
  if (matches.length > 1) return { matches };
  return {};
}

function buildList(filter) {
  const f = norm(filter || "");
  const groups = GROUPS.filter((g) => !f || norm(g.title).includes(f) || norm(g.key).includes(f));
  if (!groups.length) return null;
  return groups
    .map((g) => {
      const rows = CHARACTERS.filter((c) => c.groupKey === g.key)
        .map((c) => `${c.id}. ${c.name}`)
        .join("\n");
      return `*${g.title}* (${g.names.length})\n${rows}`;
    })
    .join("\n\n");
}

// Ambil opsi: -l <jp|zh|en|mix> dan -s <0.1-5>, sisanya jadi teks
function parseArgs(raw) {
  let rest = raw.trim();
  const opts = {};
  rest = rest.replace(/(?:^|\s)-l\s+(\w+)/i, (_, v) => { opts.lang = v.toLowerCase(); return " "; });
  rest = rest.replace(/(?:^|\s)-s\s+([\d.]+)/i, (_, v) => { opts.speed = parseFloat(v); return " "; });
  return { opts, rest: rest.trim() };
}

// Teks & opsi ikut dibawa di id baris, jadi tidak perlu simpan sesi
function buildSections(prefix, tail) {
  const sections = [
    {
      title: "Acak",
      rows: [
        {
          header: "Random",
          title: "🎲 Karakter acak",
          description: "Bot pilihkan satu dari 147 karakter",
          id: `${prefix}ttsanime-pick random ${tail}`,
        },
      ],
    },
  ];
  for (const g of GROUPS) {
    sections.push({
      title: `${g.title} (${g.names.length})`,
      rows: CHARACTERS.filter((c) => c.groupKey === g.key).map((c) => ({
        header: g.title,
        title: c.name,
        description: `No. ${c.id}`,
        id: `${prefix}ttsanime-pick ${c.id} ${tail}`,
      })),
    });
  }
  return sections;
}

async function generate(m, conn, char, speech, opts) {
  try {
    await m.react("⏳");

    const params = { text: speech, character: char.id };
    if (opts.lang) params.language = LANGS[opts.lang].id;
    if (opts.speed !== undefined) params.speed = opts.speed;

    const { data } = await axios.get(API_URL, { params, timeout: 130000 });

    if (!data || !data.status || !data.result?.audio_url) {
      throw new Error("Gagal mengambil data audio dari server API.");
    }

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: data.result.audio_url },
        mimetype: "audio/mp4",
        ptt: true,
      },
      { quoted: m }
    );

    await m.react("✅");
    await m.reply(`🎙️ *${char.name}* _(${char.group})_`);
  } catch (err) {
    console.error("[TTSAnime Error]:", err.response?.status || err.code || "", err.response?.data?.error || err.message);
    await m.react("❌");
    return m.reply(`⚠️ *Terjadi kesalahan saat memproses TTS:* ${err.response?.data?.error || err.message || err}`);
  }
}

async function handler(m, { sock, text, prefix, command }) {
  const conn = sock || m.conn;
  const cmd = prefix + "ttsanime";

  // ── Hasil pilihan dari single_select: .ttsanime-pick <id|random> [-l x] [-s x] <teks> ──
  if (command === "ttsanime-pick") {
    const raw = (text || "").trim();
    const first = raw.split(/\s+/)[0].toLowerCase();
    const { opts, rest } = parseArgs(raw.slice(first.length));
    const char = first === "random" ? randomChar() : CHARACTERS.find((c) => c.id === Number(first));
    if (!char || !rest) return m.reply(`❌ Pilihan tidak valid. Kirim ulang \`${cmd} <teks>\`.`);
    return generate(m, conn, char, rest, opts);
  }

  const help =
    `🎙️ *TTS Karakter Anime*\n\n` +
    `> \`${cmd} <teks>\` — pilih karakter lewat menu\n` +
    `> \`${cmd} <karakter>|<teks>\` — langsung pilih (nama / nomor)\n` +
    `> \`${cmd} list [umamusume|genshin|sanoba]\` — daftar karakter\n\n` +
    `*Opsi:* \`-l jp|zh|en|mix\` (bahasa), \`-s 0.1-5\` (kecepatan)\n` +
    `*Contoh:* \`${cmd} Paimon|Halo semua -l en\``;

  if (!text) return m.reply(help);

  const args = text.trim().split(/\s+/);
  if (["list", "daftar"].includes(args[0].toLowerCase())) {
    const out = buildList(args[1]);
    if (!out) return m.reply(`❌ Grup tidak ditemukan. Pilih: umamusume, genshin, sanoba.`);
    return m.reply(`${out}\n\n> Pakai: \`${cmd} <nama/nomor>|<teks>\``);
  }

  const { opts, rest } = parseArgs(text);

  if (opts.lang && !LANGS[opts.lang]) return m.reply(`❌ Bahasa tidak valid. Pilih: jp, zh, en, mix.`);
  if (opts.speed !== undefined && !(opts.speed >= 0.1 && opts.speed <= 5)) {
    return m.reply(`❌ Kecepatan harus 0.1 – 5.`);
  }

  let speech = rest;
  let char = null;
  const sep = rest.indexOf("|");
  if (sep !== -1) {
    const query = rest.slice(0, sep).trim();
    speech = rest.slice(sep + 1).trim();
    const found = findCharacter(query);
    if (found.matches) {
      const names = found.matches.slice(0, 15).map((c) => `${c.id}. ${c.name}`).join("\n");
      return m.reply(`⚠️ Ada beberapa yang cocok dengan *${query}*:\n\n${names}\n\n> Ulangi pakai nomor, contoh: \`${cmd} ${found.matches[0].id}|teks\``);
    }
    if (!found.char) {
      return m.reply(`❌ Karakter *${query}* tidak ditemukan.\n> Cek daftar: \`${cmd} list\``);
    }
    char = found.char;
  }

  if (!speech) return m.reply(help);
  if (speech.length > MAX_TEXT) {
    return m.reply(`❌ Teks terlalu panjang (${speech.length}/${MAX_TEXT} karakter).`);
  }

  // Karakter sudah ditentukan lewat "nama|teks" → langsung jalan
  if (char) return generate(m, conn, char, speech, opts);

  // Tanpa karakter → tampilkan single_select
  const flags = (opts.lang ? `-l ${opts.lang} ` : "") + (opts.speed !== undefined ? `-s ${opts.speed} ` : "");
  const tail = flags + speech;
  const preview = speech.length > 60 ? speech.slice(0, 60) + "…" : speech;
  try {
    await conn.sendMessage(
      m.chat,
      {
        text: `🎙️ *TTS Karakter Anime*\n\n> Teks: _${preview}_\n\nPilih karakter yang mau dipakai.`,
        footer: "Tap tombol di bawah ini",
        interactiveButtons: [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "Pilih Karakter",
              sections: buildSections(prefix, tail),
            }),
          },
        ],
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[TTSAnime Menu Error]:", err);
    return m.reply(`⚠️ Gagal menampilkan menu. Pakai \`${cmd} <karakter>|<teks>\` (lihat \`${cmd} list\`).`);
  }
}

export { pluginConfig as config, handler };