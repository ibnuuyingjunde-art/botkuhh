import axios from "axios";

const pluginConfig = {
  name: "negara",
  alias: ["country", "countryinfo", "infonegara"],
  category: "search",
  description: "Info lengkap tentang suatu negara",
  usage: ".negara <nama negara>",
  example: ".negara Indonesia",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const query = m.args?.join(" ") || "";

  if (!query) {
    return m.reply(
      `🌍 *INFO NEGARA*\n\n` +
      `*Cara pakai:*\n` +
      `\`${m.prefix}negara <nama negara>\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}negara Indonesia\`\n` +
      `\`${m.prefix}negara Japan\`\n` +
      `\`${m.prefix}negara United States\``
    );
  }

  m.react("🕕");

  try {
    const { data } = await axios.get(
      `https://api.siputzx.my.id/api/tools/countryInfo`,
      {
        params: { name: query },
        timeout: 15000,
      }
    );

    if (!data?.status || !data?.data) {
      m.react("☢");
      return m.reply(`❌ Negara *${query}* tidak ditemukan.\n\n> Coba nama dalam bahasa Inggris.`);
    }

    const d = data.data;

    let flagBuffer = null;
    try {
      const flagRes = await axios.get(d.flag, {
        responseType: "arraybuffer",
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      flagBuffer = Buffer.from(flagRes.data);
    } catch {}

    const neighbors = d.neighbors?.map(n => n.name).join(", ") || "—";
    const languages = d.languages?.native?.join(", ") || "—";
    const landlocked = d.landlocked ? "Ya (tidak punya laut)" : "Tidak (punya pantai)";
    const drivingSide = d.drivingSide === "left" ? "Kiri 🚗" : "Kanan 🚗";

    const caption = [
      `🌍 *INFO NEGARA — ${d.name.toUpperCase()}*`,
      ``,
      `╭─────────────────`,
      `│ 🏙️ Ibu Kota    : *${d.capital}*`,
      `│ ${d.continent.emoji} Benua        : *${d.continent.name}*`,
      `│ 📞 Kode Telp   : *${d.phoneCode}*`,
      `│ 💰 Mata Uang   : *${d.currency}*`,
      `│ 🌐 Internet TLD: *${d.internetTLD}*`,
      `│ 🗺️ Bentuk       : *${d.constitutionalForm}*`,
      `├─────────────────`,
      `│ 📐 Luas        : *${d.area.squareKilometers.toLocaleString("id-ID")} km²*`,
      `│ 🚗 Jalur       : *${drivingSide}*`,
      `│ 🔒 Terkurung   : *${landlocked}*`,
      `│ 🍺 Alkohol     : *${d.alcoholProhibition}*`,
      `│ 🗣️ Bahasa      : *${languages}*`,
      `├─────────────────`,
      `│ 🏳️ ISO Alpha2  : *${d.isoCode.alpha2.toUpperCase()}*`,
      `│ 🏳️ ISO Alpha3  : *${d.isoCode.alpha3.toUpperCase()}*`,
      `│ 🔢 ISO Numerik : *${d.isoCode.numeric}*`,
      `├─────────────────`,
      `│ 🌟 Terkenal    : *${d.famousFor}*`,
      `│ 🤝 Tetangga    : *${neighbors}*`,
      `├─────────────────`,
      `│ 📍 Koordinat   :`,
      `│ Lat: *${d.coordinates.latitude}*`,
      `│ Lng: *${d.coordinates.longitude}*`,
      `│ 🗺️ ${d.googleMapsLink}`,
      `╰─────────────────`,
      ``,
      `> _via siputzx.my.id_`,
    ].join("\n");

    if (flagBuffer) {
      await sock.sendMessage(
        m.chat,
        { image: flagBuffer, caption },
        { quoted: m }
      );
    } else {
      await sock.sendMessage(
        m.chat,
        { text: caption },
        { quoted: m }
      );
    }

    m.react("✅");
  } catch (e) {
    console.error("[Negara]", e);
    m.react("☢");
    m.reply(`❌ Gagal mengambil info negara.\n\n> ${e.message}`);
  }
}

export { pluginConfig as config, handler };