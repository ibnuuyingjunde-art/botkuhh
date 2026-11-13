/**
 * Plugin Cek Nomor - via NumLookup API
 *
 * SETUP:
 * 1. Daftar gratis di https://numlookupapi.com (1000 req/bulan)
 * 2. Salin API key dari dashboard
 * 3. Tambahkan ke config.js:
 *      numlookup: {
 *        apiKey: "your_api_key_here"
 *      }
 */

import Numlookupapi from '@everapi/numlookupapi-js'

const pluginConfig = {
  name: "truecaller",
  alias: ["tc", "cekidentitas", "ceknama", "whois"],
  category: "tools",
  description: "Cek identitas & info nomor telepon",
  usage: ".truecaller <nomor>",
  example: ".truecaller 08123456789",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(input) {
  let num = input.replace(/[\s\-().+]/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  return "+" + num;
}

function isValidNumber(num) {
  return /^\+\d{7,15}$/.test(num);
}

function getLineTypeLabel(type) {
  const map = {
    mobile:   "📱 Mobile",
    landline: "☎️ Telepon Rumah",
    voip:     "🌐 VoIP",
    toll_free:"🆓 Toll Free",
    premium:  "💰 Premium",
    unknown:  "❓ Unknown",
  };
  return map[type?.toLowerCase()] || type || "❓ Unknown";
}

function getRiskLabel(risk) {
  if (!risk || risk === "none") return "✅ Aman";
  if (risk === "low")    return "🟡 Risiko Rendah";
  if (risk === "medium") return "🟠 Risiko Sedang";
  if (risk === "high")   return "🔴 Risiko Tinggi";
  return `⚠️ ${risk}`;
}

const FRAMES = [
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Menghubungi server...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Mencari info nomor...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *ᴄᴇᴋ ɴᴏᴍᴏʀ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Memproses hasil...\n╰┈┈┈┈┈┈┈┈⬡",
];

async function fetchNumlookup(num, apiKey) {
  const client = new Numlookupapi(apiKey)
  const res = await client.validate(num)
  if (res?.error) {
    const code = res.error?.code || ''
    if (code === 'invalid_api_key') throw new Error('API_KEY_INVALID')
    if (code === 'rate_limit_exceeded') throw new Error('RATE_LIMIT')
    throw new Error(code || 'UNKNOWN')
  }
  return res
}

async function handler(m, { sock }) {
  const apiKey = "num_live_6vihrHedZbw0AU8cq19l2mVcmjNzVtYdFwCBuTkN";

  const args  = m.text?.trim().split(/\s+/) || [];
  const input = args[0];

  if (!input) {
    return m.reply(
      `⚠️ *ᴍᴀsᴜᴋᴋᴀɴ ɴᴏᴍᴏʀ*\n\n` +
      `> \`${m.prefix}truecaller <nomor>\`\n\n` +
      `*ᴄᴏɴᴛᴏʜ:*\n` +
      `> \`${m.prefix}truecaller 08123456789\`\n` +
      `> \`${m.prefix}truecaller +62 812-345-6789\``
    );
  }

  const num = parseNumber(input);
  if (!isValidNumber(num)) {
    return m.reply(
      `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
      `> \`${input}\` bukan format nomor yang valid.`
    );
  }

  let sent;
  try {
    sent = await sock.sendMessage(m.chat, { text: FRAMES[0] }, { quoted: m });
  } catch {
    return m.reply("❌ Gagal mengirim pesan.");
  }

  let data = null;
  let fetchError = null;

  await Promise.all([
    fetchNumlookup(num, apiKey)
      .then((res) => { data = res; })
      .catch((err) => { fetchError = err.message; }),
    (async () => {
      for (let i = 1; i < FRAMES.length; i++) {
        await sleep(700);
        try {
          await sock.sendMessage(m.chat, { text: FRAMES[i], edit: sent.key });
        } catch { break; }
      }
    })(),
  ]);

  await sleep(300);

  if (fetchError) {
    let errMsg = "Gagal menghubungi server. Coba lagi nanti.";
    if (fetchError === "API_KEY_INVALID") errMsg = "API key tidak valid. Cek kembali di config.js.";
    if (fetchError === "RATE_LIMIT")      errMsg = "Kuota API habis untuk bulan ini (maks 1000 req/bulan).";

    const errText = `❌ *ɢᴀɢᴀʟ*\n\n> ${errMsg}`;
    try { await sock.sendMessage(m.chat, { text: errText, edit: sent.key }); }
    catch { await m.reply(errText); }
    return;
  }

  if (!data?.valid) {
    const invalidText =
      `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
      `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
      `┃ 📱 Nomor: ${num}\n` +
      `┃ ❌ Status: Tidak terdaftar / tidak valid\n` +
      `╰┈┈┈┈┈┈┈┈⬡`;
    try { await sock.sendMessage(m.chat, { text: invalidText, edit: sent.key }); }
    catch { await m.reply(invalidText); }
    return;
  }

  const ownerName  = data.owner_name || data.name || null;
  const country    = data.country_name || data.country || "-";
  const countryCode = data.country_code || "-";
  const location   = data.location || data.city || null;
  const carrier    = data.carrier || data.line_provider || "-";
  const lineType   = getLineTypeLabel(data.line_type);
  const spamRisk   = getRiskLabel(data.spam_risk || data.risk_level);
  const intlFormat = data.international_format || data.formatted_number || num;
  const localFormat = data.local_format || null;
  const timezones  = Array.isArray(data.timezones)
    ? data.timezones.join(", ")
    : data.timezone || null;

  let finalText =
    `👤 *ʜᴀsɪʟ ᴄᴇᴋ ɴᴏᴍᴏʀ*\n\n` +
    `╭┈┈⬡「 📋 *ɪɴꜰᴏ ɴᴏᴍᴏʀ* 」\n`;

  if (ownerName) finalText += `┃ 👤 Nama: *${ownerName}*\n`;

  finalText +=
    `┃ 📱 Nomor: ${intlFormat}\n`;

  if (localFormat) finalText += `┃ 🔢 Format Lokal: ${localFormat}\n`;

  finalText +=
    `┃ 🌐 Negara: ${country} (${countryCode})\n` +
    `┃ 📶 Operator: ${carrier}\n` +
    `┃ 📞 Tipe: ${lineType}\n`;

  if (location)  finalText += `┃ 📍 Lokasi: ${location}\n`;
  if (timezones) finalText += `┃ 🕐 Timezone: ${timezones}\n`;

  finalText +=
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `╭┈┈⬡「 ⚠️ *ʀɪsɪᴋᴏ* 」\n` +
    `┃ ${spamRisk}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `> _Data dari NumLookup API_`;

  try {
    await sock.sendMessage(m.chat, { text: finalText, edit: sent.key });
  } catch {
    await m.reply(finalText);
  }
}

export { pluginConfig as config, handler }