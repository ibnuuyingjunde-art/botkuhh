import axios from "axios";

const pluginConfig = {
  name: "gchat",
  alias: ["gstatusbar", "statusbarmaker"],
  category: "maker",
  description: "Membuat gambar status bar Android (jam, sinyal, baterai) dengan teks custom via API Cloud",
  usage: ".gchat <teks> [--network 4G/5G/WIFI] [--signal 0-5] [--battery 0-100] [--charging true/false]",
  example: ".gchat Hai kak!\n.gchat Lagi gabut --network WIFI --signal 5 --battery 45 --charging true",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/maker/gchat";

const DEFAULTS = {
  network: "4G",
  signal: "4",
  battery: "80",
  charging: "false",
};

function parseArgs(args) {
  const options = { ...DEFAULTS };
  const textParts = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const flagMatch = arg.match(/^--(network|signal|battery|charging)$/i);

    if (flagMatch && args[i + 1] !== undefined) {
      options[flagMatch[1].toLowerCase()] = args[i + 1];
      i++;
    } else {
      textParts.push(arg);
    }
  }

  return { text: textParts.join(" ").trim(), options };
}

async function handler(m, { sock, args }) {
  const prefix = m.prefix;
  const command = m.command;
  const { text, options } = parseArgs(args || []);

  if (!text) {
    return m.reply(
      `💬 *Status Bar Chat Maker*\n\n` +
        `Buat gambar notifikasi chat ala status bar Android.\n\n` +
        `*Penggunaan:*\n` +
        `\`${prefix}${command} <teks>\`\n\n` +
        `*Opsi tambahan:*\n` +
        `> \`--network\` - 4G/5G/WIFI (default: ${DEFAULTS.network})\n` +
        `> \`--signal\` - 0-5 (default: ${DEFAULTS.signal})\n` +
        `> \`--battery\` - 0-100 (default: ${DEFAULTS.battery})\n` +
        `> \`--charging\` - true/false (default: ${DEFAULTS.charging})\n\n` +
        `*Contoh:*\n` +
        `> \`${prefix}${command} Hai kak!\`\n` +
        `> \`${prefix}${command} Lagi gabut --network WIFI --signal 5 --battery 45 --charging true\``
    );
  }

  await m.react("⏳");

  try {
    const { data } = await axios.get(API_URL, {
      params: {
        text,
        network: options.network,
        signal: options.signal,
        battery: options.battery,
        charging: options.charging,
        format: "json",
      },
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!data || !data.status || !data.result) {
      throw new Error("Respons API tidak valid");
    }

    const base64 = String(data.result).replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64, "base64");

    await sock.sendMessage(m.chat, { image: imageBuffer, caption: `💬 ${text}` }, { quoted: m });
    await m.react("✅");
  } catch (error) {
    console.error("[GChat Error]:", error);
    await m.react("❌");
    await m.reply("❌ *GAGAL*\n\n> " + (error.response?.data?.message || error.message));
  }
}

export { pluginConfig as config, handler };