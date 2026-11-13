import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { Button, Carousel } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "pins2",
  alias: ["pinsearch2", "pinterestsearch2"],
  category: "search",
  description: "Cari gambar di Pinterest (carousel) - versi 2",
  usage: ".pins2 <query>",
  example: ".pins2 Zhao Lusi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const MAX_CARDS = 8;

async function handler(m, { sock }) {
  const query = m.text?.trim();
  if (!query) {
    return m.reply(
      `PINTEREST SEARCH (v2)\n\n` +
      `Contoh:\n` +
      `${m.prefix}pins2 Zhao Lusi`
    );
  }
  m.react("🕕");

  try {
    const data = await f(
      `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`,
    );
    const results = data?.data?.slice(0, MAX_CARDS);

    if (!results || results.length === 0) {
      m.react("❌");
      return m.reply(`Tidak ditemukan hasil untuk: ${query}`);
    }

    const carousel = new Carousel(sock)
      .setBody(`Hasil pencarian: ${query}`)
      .setFooter("Swipe untuk lihat gambar lainnya, tekan lama gambar untuk save");

    for (const item of results) {
      const caption = item?.grid_title || item?.description || "-";
      const card = await new Button(sock)
        .setTitle(caption.length > 60 ? caption.slice(0, 57) + "..." : caption)
        .setBody(item?.pinner?.username ? item.pinner.username : " ")
        .setFooter("Pinterest")
        .setImage(item.image_url)
        .addUrl("Buka di Pinterest", item.pin, true, { icon: "DEFAULT" })
        .toCard();

      carousel.addCard(card);
    }

    await carousel.send(m.chat, { quoted: m });
    m.react("✅");
  } catch (err) {
    console.error("[Pins2] Error:", err.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };