import fetch from "node-fetch";

const pluginConfig = {
  name: "matilampu",
  alias: ["pln", "gangguan", "listrik"],
  category: "info",
  description: "Cek info gangguan/mati lampu PLN di seluruh Indonesia",
  usage: ".matilampu <kota/wilayah>",
  example: ".matilampu Jakarta Selatan",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 15,
  energi: 0,
  isEnabled: true,
  skipRegistration: false,
};

const PLN_REGIONS = {
  jakarta: "DKI Jakarta",
  "jakarta pusat": "DKI Jakarta - Jakarta Pusat",
  "jakarta selatan": "DKI Jakarta - Jakarta Selatan",
  "jakarta barat": "DKI Jakarta - Jakarta Barat",
  "jakarta timur": "DKI Jakarta - Jakarta Timur",
  "jakarta utara": "DKI Jakarta - Jakarta Utara",
  bogor: "Jawa Barat - Bogor",
  bandung: "Jawa Barat - Bandung",
  bekasi: "Jawa Barat - Bekasi",
  depok: "Jawa Barat - Depok",
  cirebon: "Jawa Barat - Cirebon",
  tasikmalaya: "Jawa Barat - Tasikmalaya",
  tangerang: "Banten - Tangerang",
  "tangerang selatan": "Banten - Tangerang Selatan",
  serang: "Banten - Serang",
  semarang: "Jawa Tengah - Semarang",
  solo: "Jawa Tengah - Solo",
  surakarta: "Jawa Tengah - Surakarta",
  yogyakarta: "DI Yogyakarta",
  jogja: "DI Yogyakarta",
  surabaya: "Jawa Timur - Surabaya",
  malang: "Jawa Timur - Malang",
  sidoarjo: "Jawa Timur - Sidoarjo",
  gresik: "Jawa Timur - Gresik",
  medan: "Sumatera Utara - Medan",
  palembang: "Sumatera Selatan - Palembang",
  pekanbaru: "Riau - Pekanbaru",
  padang: "Sumatera Barat - Padang",
  banda_aceh: "Aceh - Banda Aceh",
  lampung: "Lampung - Bandar Lampung",
  batam: "Kepulauan Riau - Batam",
  balikpapan: "Kalimantan Timur - Balikpapan",
  samarinda: "Kalimantan Timur - Samarinda",
  pontianak: "Kalimantan Barat - Pontianak",
  banjarmasin: "Kalimantan Selatan - Banjarmasin",
  makassar: "Sulawesi Selatan - Makassar",
  manado: "Sulawesi Utara - Manado",
  palu: "Sulawesi Tengah - Palu",
  bali: "Bali - Denpasar",
  denpasar: "Bali - Denpasar",
  mataram: "Nusa Tenggara Barat - Mataram",
  kupang: "Nusa Tenggara Timur - Kupang",
  jayapura: "Papua - Jayapura",
  manokwari: "Papua Barat - Manokwari",
  ambon: "Maluku - Ambon",
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function editMsg(sock, chat, key, text) {
  await sock.sendMessage(chat, { text, edit: key });
}

function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function findRegion(query) {
  const q = normalizeQuery(query);
  if (PLN_REGIONS[q]) return PLN_REGIONS[q];
  for (const [key, val] of Object.entries(PLN_REGIONS)) {
    if (q.includes(key) || key.includes(q)) return val;
  }
  return null;
}

function buildProgressBar(step, total = 4) {
  const filled = "█".repeat(step);
  const empty = "░".repeat(total - step);
  const percent = Math.round((step / total) * 100);
  return `[${filled}${empty}] ${percent}%`;
}

function buildStatusIcon(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("selesai") || s.includes("normal") || s.includes("pulih")) return "✅";
  if (s.includes("proses") || s.includes("berlangsung") || s.includes("perbaikan")) return "🔧";
  if (s.includes("direncanakan") || s.includes("jadwal") || s.includes("planned")) return "📅";
  return "⚠️";
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
    }) + " WITA";
  } catch {
    return dateStr;
  }
}

async function fetchGangguanPLN(wilayah) {
  const results = [];
  const keyword = encodeURIComponent(wilayah);
  const stripHtml = (s) =>
    s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();

  const plnUrls = [
    `https://www.pln.co.id/pelanggan/gangguan-listrik?search=${keyword}`,
    `https://web.pln.co.id/pelanggan/gangguan-listrik?search=${keyword}`,
  ];

  for (const url of plnUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Referer: "https://www.pln.co.id/",
        },
        timeout: 10000,
      });

      if (!res.ok) continue;

      const html = await res.text();
      const lower = html.toLowerCase();
      const hasContent =
        html.includes("gangguan") || html.includes("padam") || html.includes("pemeliharaan");
      const isJsSkeleton =
        html.length < 3000 ||
        (lower.includes("__next") && !hasContent) ||
        (lower.includes("react") && !hasContent);

      if (isJsSkeleton) continue;

      if (
        lower.includes("tidak ada gangguan") ||
        lower.includes("tidak ditemukan") ||
        lower.includes("no data") ||
        lower.includes("data tidak tersedia")
      ) {
        return { success: true, source: "PLN.co.id", data: [], noGangguan: true };
      }

      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      let count = 0;
      while ((rowMatch = rowRegex.exec(html)) !== null && count < 5) {
        const cells = [];
        let tdMatch;
        const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        while ((tdMatch = tdRe.exec(rowMatch[1])) !== null) {
          cells.push(stripHtml(tdMatch[1]));
        }
        if (cells.length >= 3 && cells[0].length > 3) {
          results.push({
            lokasi: cells[0] || "-",
            keterangan: cells[1] || "-",
            mulai: cells[2] || null,
            selesai: cells[3] || null,
            status: cells[4] || "Info PLN",
            unit: cells[5] || "-",
          });
          count++;
        }
      }

      if (results.length === 0) {
        const cardRegex =
          /class="[^"]*(?:card|gangguan|outage|padam)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section)>/gi;
        let cardMatch;
        while ((cardMatch = cardRegex.exec(html)) !== null && results.length < 5) {
          const text = stripHtml(cardMatch[1]);
          if (text.length > 20) {
            results.push({
              lokasi: wilayah,
              keterangan: text.slice(0, 200),
              mulai: null,
              selesai: null,
              status: "Info PLN",
              unit: "-",
            });
          }
        }
      }

      if (results.length > 0) {
        return { success: true, source: "PLN.co.id", data: results };
      }
    } catch (_) {
      continue;
    }
  }

  const nitterInstances = [
    `https://nitter.poast.org/pln_123`,
    `https://nitter.privacydev.net/pln_123`,
  ];

  for (const nitterUrl of nitterInstances) {
    try {
      const res = await fetch(nitterUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; InfoBot/1.0)",
          Accept: "text/html",
        },
        timeout: 8000,
      });

      if (!res.ok) continue;

      const html = await res.text();
      const wilayahLower = wilayah.toLowerCase();
      const tweetRegex =
        /<div[^>]*class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let tweetMatch;

      while ((tweetMatch = tweetRegex.exec(html)) !== null && results.length < 3) {
        const text = stripHtml(tweetMatch[1]).trim();
        if (
          (text.toLowerCase().includes(wilayahLower) ||
            text.toLowerCase().includes("padam") ||
            text.toLowerCase().includes("gangguan")) &&
          text.length > 30
        ) {
          results.push({
            lokasi: wilayah,
            keterangan: text.slice(0, 300),
            mulai: null,
            selesai: null,
            status: "Info via @PLN_123",
            unit: "-",
          });
        }
      }

      if (results.length > 0) {
        return { success: true, source: "Twitter @PLN_123", data: results };
      }
    } catch (_) {
      continue;
    }
  }

  try {
    const searchUrl = `https://news.google.com/rss/search?q=mati+lampu+${keyword}+PLN&hl=id&gl=ID&ceid=ID:id`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000,
    });

    if (res.ok) {
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i;
      const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i;
      const pubRegex = /<pubDate>([\s\S]*?)<\/pubDate>/i;
      let itemMatch;

      while ((itemMatch = itemRegex.exec(xml)) !== null && results.length < 3) {
        const item = itemMatch[1];
        const title = (item.match(titleRegex)?.[1] || "").trim();
        const desc = stripHtml(item.match(descRegex)?.[1] || "").trim();
        const pub = (item.match(pubRegex)?.[1] || "").trim();

        if (title.length > 5) {
          results.push({
            lokasi: wilayah,
            keterangan: title + (desc ? ` — ${desc.slice(0, 150)}` : ""),
            mulai: pub || null,
            selesai: null,
            status: "Berita Terkini",
            unit: "Google News",
          });
        }
      }

      if (results.length > 0) {
        return { success: true, source: "Google News", data: results };
      }
    }
  } catch (_) {}

  return { success: false, data: [] };
}

async function handler(m, { sock, args }) {
  const query = args.join(" ").trim();

  if (!query) {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `Gunakan: \`${m.prefix}matilampu <kota/wilayah>\`\n\n` +
      `📌 *Contoh:*\n` +
      `› \`${m.prefix}matilampu Jakarta Selatan\`\n` +
      `› \`${m.prefix}matilampu Bandung\`\n` +
      `› \`${m.prefix}matilampu Surabaya\`\n` +
      `› \`${m.prefix}matilampu Medan\`\n\n` +
      `💡 Mendukung semua kota besar di Indonesia`
    );
  }

  const wilayah = query;
  const regionLabel = findRegion(query) || wilayah;

  const sent = await sock.sendMessage(
    m.chat,
    {
      text:
        `🔍 *ᴄᴇᴋ ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
        `${buildProgressBar(0)}\n` +
        `> Memulai pencarian...`,
    },
    { quoted: m }
  );

  const msgKey = sent.key;

  await sleep(700);
  await editMsg(sock, m.chat, msgKey,
    `🔍 *ᴄᴇᴋ ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
    `${buildProgressBar(1)}\n` +
    `> Menghubungi server PLN...`
  );

  await sleep(700);
  await editMsg(sock, m.chat, msgKey,
    `🔍 *ᴄᴇᴋ ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
    `${buildProgressBar(2)}\n` +
    `> Mengambil data gangguan untuk *${regionLabel}*...`
  );

  const result = await fetchGangguanPLN(wilayah);

  await sleep(500);
  await editMsg(sock, m.chat, msgKey,
    `🔍 *ᴄᴇᴋ ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
    `${buildProgressBar(3)}\n` +
    `> Memproses hasil...`
  );

  await sleep(500);

  const now = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar",
  });

  if (!result.success) {
    await editMsg(sock, m.chat, msgKey,
      `⚡ *ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
      `╭┈┈⬡「 🔎 *ᴘᴇɴᴄᴀʀɪᴀɴ* 」\n` +
      `┃ 📍 Wilayah : *${regionLabel}*\n` +
      `┃ 🕐 Waktu   : ${now} WITA\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `╭┈┈⬡「 ⚠️ *ɢᴀɢᴀʟ* 」\n` +
      `┃ Tidak dapat terhubung ke server PLN\n` +
      `┃ Coba beberapa saat lagi\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Cek langsung: pln.co.id/pelanggan/gangguan-listrik`
    );
    return;
  }

  if (result.noGangguan || result.data.length === 0) {
    await editMsg(sock, m.chat, msgKey,
      `⚡ *ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
      `╭┈┈⬡「 🔎 *ᴘᴇɴᴄᴀʀɪᴀɴ* 」\n` +
      `┃ 📍 Wilayah : *${regionLabel}*\n` +
      `┃ 🕐 Diperbarui : ${now} WITA\n` +
      `┃ 🌐 Sumber  : ${result.source || "PLN.co.id"}\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `╭┈┈⬡「 ✅ *sᴛᴀᴛᴜs* 」\n` +
      `┃ 🟢 Tidak ada gangguan listrik\n` +
      `┃ yang terdaftar di wilayah ini\n` +
      `╰┈┈┈┈┈┈┈┈⬡\n\n` +
      `> Info resmi: pln.co.id/pelanggan/gangguan-listrik`
    );
    await m.react("✅");
    return;
  }

  const gangguanList = result.data;
  let gangguanText = "";

  gangguanList.forEach((item, i) => {
    const icon = buildStatusIcon(item.status);
    gangguanText +=
      `┃\n` +
      `┃ ${icon} *Gangguan #${i + 1}*\n` +
      `┃ 📍 Lokasi  : ${item.lokasi}\n` +
      `┃ 📝 Info    : ${item.keterangan}\n`;
    if (item.mulai) gangguanText += `┃ 🕐 Mulai   : ${formatDate(item.mulai)}\n`;
    if (item.selesai) gangguanText += `┃ 🕓 Estimasi: ${formatDate(item.selesai)}\n`;
    if (item.unit && item.unit !== "-") gangguanText += `┃ 🏢 Unit PLN: ${item.unit}\n`;
    gangguanText += `┃ 🔖 Status  : ${item.status}\n`;
  });

  await editMsg(sock, m.chat, msgKey,
    `⚡ *ɪɴꜰᴏ ᴍᴀᴛɪ ʟᴀᴍᴘᴜ ᴘʟɴ*\n\n` +
    `╭┈┈⬡「 🔎 *ᴘᴇɴᴄᴀʀɪᴀɴ* 」\n` +
    `┃ 📍 Wilayah  : *${regionLabel}*\n` +
    `┃ ⚠️ Gangguan : *${gangguanList.length} ditemukan*\n` +
    `┃ 🕐 Diperbarui: ${now} WITA\n` +
    `┃ 🌐 Sumber   : ${result.source || "PLN.co.id"}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `╭┈┈⬡「 ⚡ *ᴅᴀꜰᴛᴀʀ ɢᴀɴɢɢᴜᴀɴ* 」\n` +
    gangguanText +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `╭┈┈⬡「 📞 *ᴋᴏɴᴛᴀᴋ ᴘʟɴ* 」\n` +
    `┃ 📱 Call Center : *123*\n` +
    `┃ 🌐 Website    : pln.co.id\n` +
    `┃ 📲 Aplikasi   : PLN Mobile\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `> Data bersumber langsung dari ${result.source || "PLN.co.id"}`
  );

  await m.react("⚡");
}

export { pluginConfig as config, handler };