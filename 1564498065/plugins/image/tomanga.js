const pluginConfig = {
  name: "tomanga",
  alias: ["manga"],
  category: "image",
  description: "Konversi foto jadi gaya manga",
  usage: ".tomanga [style]",
  example: ".tomanga putih hitam",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock, config: botConfig, db }) {
  const q = m.quoted ? m.quoted : m;
  const mime = (q.msg || q).mimetype || q.mediaType || "";

  if (!/image/.test(mime)) {
    return m.reply(
      `❌ Reply gambar dengan caption\n*Contoh:* ${botConfig.command?.prefix || "."}tomanga sketch`
    );
  }

  try {
    await m.reply("⏳ Mengkonversi ke manga...");

    const buffer = await q.download();
    if (!buffer) throw new Error("Gagal download gambar");

    const args = m.text?.split(" ").slice(1) || [];
    const style = args.join(" ") || "putih hitam";

    const form = new FormData();
    form.append("apikey", "3Rj3E");
    form.append("style", style);
    form.append("image", new Blob([buffer], { type: mime }), "image.jpg");

    const res = await fetch("https://api.theresav.biz.id/image/tomanga", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Status ${res.status}${text ? ` - ${text}` : ""}`);
    }

    const result = Buffer.from(await res.arrayBuffer());
    if (!result || result.length < 1000) throw new Error("Hasil gambar tidak valid");

    await sock.sendMessage(
      m.chat,
      {
        image: result,
        caption: `📚 *Berhasil dikonversi ke manga!*\n🎨 Style: *${style}*`,
      },
      { quoted: m }
    );
  } catch (e) {
    console.error(e);
    await m.reply(`❌ Error: ${e.message}`);
  }
}

export default {
  config: pluginConfig,
  handler,
};