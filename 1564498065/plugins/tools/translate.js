import axios from "axios";

const pluginConfig = {
  name: "translate",
  alias: ["tr", "terjemah", "tl"],
  category: "tools",
  description: "Terjemahkan teks ke bahasa lain",
  usage: ".translate <kode_bahasa> <teks>",
  example: ".translate ja halo dunia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const LANG_LIST = {
  id: "Indonesia", en: "Inggris", ja: "Jepang", ko: "Korea",
  zh: "China", ar: "Arab", fr: "Prancis", de: "Jerman",
  es: "Spanyol", pt: "Portugis", ru: "Rusia", it: "Italia",
  nl: "Belanda", tr: "Turki", th: "Thailand", vi: "Vietnam",
  ms: "Melayu", hi: "Hindi", tl: "Tagalog", jv: "Jawa",
  su: "Sunda", min: "Minang", bug: "Bugis",
};

const LATIN_LANGS = ["ja", "ko", "zh", "ar", "hi", "ru", "th", "vi", "el", "he"];

async function handler(m, { sock }) {
  const args = m.args || [];

  if (!args[0]) {
    const langListStr = Object.entries(LANG_LIST)
      .map(([k, v]) => `\`${k}\` ${v}`)
      .join("  •  ");

    return m.reply(
      `🌐 *TRANSLATE*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}translate <kode_bahasa> <teks>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}translate en halo dunia\`\n` +
      `\`${m.prefix}translate ja aku suka kamu\`\n` +
      `\`${m.prefix}translate ar assalamualaikum\`\n\n` +
      `*Kode bahasa tersedia:*\n${langListStr}\n\n` +
      `_💡 Bahasa Jepang, Korea, Arab, dll otomatis tampil latin/romaji_`
    );
  }

  const toLang = args[0].toLowerCase();
  const text = args.slice(1).join(" ");

  if (!text) {
    return m.reply(`❌ Masukkan teks yang mau diterjemahkan!\n\nContoh: \`${m.prefix}translate en halo dunia\``);
  }

  m.react("🕕");

  try {
    
    const [transRes, latinRes] = await Promise.allSettled([
      axios.get(`https://api.azbry.com/api/tools/translate`, {
        params: { text, to: toLang },
        timeout: 10000,
      }),
      LATIN_LANGS.includes(toLang)
        ? axios.get(`https://api.azbry.com/api/tools/translate`, {
            params: { text, to: toLang, latin: true },
            timeout: 10000,
          })
        : Promise.resolve(null),
    ]);

    const transData = transRes.status === "fulfilled" ? transRes.value.data : null;
    const latinData = latinRes.status === "fulfilled" && latinRes.value
      ? latinRes.value.data
      : null;

    if (!transData?.status || !transData?.result) {
      m.react("☢");
      return m.reply(`❌ Gagal menerjemahkan teks.\n\n> Pastikan kode bahasa benar.`);
    }

    const r = transData.result;
    const latin = latinData?.result?.translated || null;

    const lines = [
      `🌐 *TRANSLATE*`,
      ``,
      `╭─────────────────`,
      `│ 🔤 Dari  : *${r.from_name}* (\`${r.from}\`)`,
      `│ 🔡 Ke    : *${r.to_name}* (\`${r.to}\`)`,
      `├─────────────────`,
      `│ 📝 Asli  :`,
      `│ ${r.original}`,
      `│`,
      `│ ✅ Hasil :`,
      `│ *${r.translated}*`,
    ];

    if (latin && latin !== r.translated) {
      lines.push(`│`);
      lines.push(`│ 🔠 Latin/Romaji :`);
      lines.push(`│ _${latin}_`);
    }

    lines.push(`╰─────────────────`);
    lines.push(``);
    lines.push(`> _via Google Translate_`);

    await sock.sendMessage(
      m.chat,
      { text: lines.join("\n") },
      { quoted: m }
    );

    m.react("✅");
  } catch (e) {
    console.error("[Translate]", e);
    m.react("☢");
    m.reply(`❌ Gagal menerjemahkan.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };