import searchKonachan from "../../src/scraper/konachan.js";

const pluginConfig = {
  name: "konachan",
  alias: ["konasearch", "kona"],
  category: "anime",
  description: "Cari gambar anime dari konachan",
  usage: ".konachan <tags>",
  example: ".konachan long_hair",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { args, sock }) {
  if (!args[0]) {
    let txt = `🌸 *KONACHAN SEARCH* 🌸\n\n`;
    txt += `Halo kak! Lagi nyari referensi gambar anime keren? Sini aku carikan dari Konachan!\n\n`;
    txt += `*Cara Pakai:*\n`;
    txt += `👉 \`${m.prefix}konachan <tag1> <tag2>\`\n\n`;
    txt += `*Contoh:*\n`;
    txt += `\`${m.prefix}konachan long_hair blue_eyes\``;
    return m.reply(txt);
  }

  await m.react("🕕");

  try {
    const query = args.join(" ");
    const results = await searchKonachan(query);

    if (results.error) {
      return m.reply(`❌ Maaf kak, ada masalah saat nyari gambarnya!\nError: ${results.message}`);
    }

    if (!results || results.length === 0) {
      return m.reply(`❌ Aduh kak, gambarnya nggak ketemu nih! Coba ganti tag pencariannya ya. 😭`);
    }
    const randomIdx = Math.floor(Math.random() * Math.min(results.length, 10));
    const image = results[randomIdx];

    if (!image.images.preview) {
      return m.reply(`❌ Waduh kak, gambarnya ga bisa dimuat!`);
    }

    let txt = `🌸 *HASIL PENCARIAN KONACHAN* 🌸\n\n`;
    
    let contentTxt = `🎨 *Tags:*\n${image.tags.join(", ")}\n\n`;
    contentTxt += `🔗 *Sumber:*\n${image.details_page}`;

    txt += contentTxt.trim().split("\n").map(line => line.trim() ? `${line}` : ``).join("\n");

    await sock.sendMedia(m.chat, image.images.preview, txt.trim(), m, { type: "image" });

    await m.react("✅");
  } catch (e) {
    m.reply(`❌ Maaf kak, sistem error! 😭\nError: ${e.message}`);
  }
}

export { pluginConfig as config, handler };
