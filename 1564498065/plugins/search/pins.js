import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "pins",
  alias: ["pinsearch", "pinterestsearch"],
  category: "search",
  description: "Cari gambar di Pinterest",
  usage: ".pins <query>",
  example: ".pins Zhao Lusi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const MAX_IMAGES = 5;

async function handler(m, { sock }) {
  const query = m.text?.trim();
  if (!query) {
    return m.reply(
      `🔍 *ᴘɪɴᴛᴇʀᴇsᴛ sᴇᴀʀᴄʜ*\n\n` +
      `> Contoh:\n` +
      `\`${m.prefix}pins Zhao Lusi\``,
    );
  }
  m.react("🕕");

  const rich = new AIRich(sock)
    .addText(`# 🥙 ${query.toUpperCase()}`, { id: "title" })
    .addText("\n🔍 _Mencari gambar di Pinterest..._", { id: "status" });

  try {

    await rich.send(m.chat, { quoted: m });

    const data = await f(
      `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`,
    );
    const results = data?.data?.slice(0, MAX_IMAGES);

    if (!results || results.length === 0) {
      rich.addText("\n❌ _Tidak ditemukan hasil._", { replace: "status" });
      await rich.sendEdit();
      m.react("❌");
      return;
    }

    rich.addText("", { replace: "status", id: "status" });

    results.forEach((item, i) => {
      rich.addImage(item.image_url, { id: `img${i}`, resolveUrl: true });
    });

    rich.addText(
      "\n💾 _Tekan lama salah satu gambar di atas untuk menyimpan/download._",
    );

    await rich.sendEdit();
    m.react("✅");
  } catch (err) {
    console.error("[Pins] Error:", err.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };