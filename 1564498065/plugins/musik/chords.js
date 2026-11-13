/**
 * Nama Plugin: Chords
 * Fungsi: Cari & tampilkan chord/kunci gitar lagu dari ChordTela.com
 */

import fetch from "node-fetch";

const pluginConfig = {
  name: "chords",
  alias: ["chord", "kunci", "gitar"],
  category: "musik",
  description: "Cari chord / kunci gitar lagu dari ChordTela.com",
  usage: ".chords <judul lagu> [- <artis>]",
  example: ".chords kangen - dewa 19",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const HEADERS_BROWSER = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
};

/**
 * Cari URL chord di ChordTela via DuckDuckGo HTML
 * Pakai 3 strategy ekstraksi URL sekaligus
 */
async function cariViaDDG(query) {
  const q = encodeURIComponent(`site:chordtela.com ${query}`);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;

  const res = await fetch(url, {
    headers: {
      ...HEADERS_BROWSER,
      "Referer": "https://duckduckgo.com/",
    },
  });

  if (!res.ok) throw new Error(`DDG error: ${res.status}`);
  const html = await res.text();

  const uddgMatches = [...html.matchAll(/uddg=(https?%3A%2F%2F(?:www\.)?chordtela\.com%2F\d{4}%2F\d{2}%2F[^&"#\s]+)/g)];
  if (uddgMatches.length > 0) {
    return decodeURIComponent(uddgMatches[0][1]);
  }

  const spanMatches = [...html.matchAll(/result__url[^>]*>\s*((?:www\.)?chordtela\.com\/\d{4}\/\d{2}\/[^<\s]+)/g)];
  if (spanMatches.length > 0) {
    const path = spanMatches[0][1].trim().replace(/^www\./, "");
    return `https://www.${path}`;
  }

  const directMatches = [...html.matchAll(/https?:\/\/(?:www\.)?chordtela\.com\/\d{4}\/\d{2}\/[^\s"'<>&]+/g)];
  if (directMatches.length > 0) {
    return directMatches[0][0];
  }

  return null;
}

/**
 * Fallback: cari via Google (tanpa API, pakai scrape HTML)
 */
async function cariViaGoogle(query) {
  const q = encodeURIComponent(`site:chordtela.com ${query}`);
  const url = `https://www.google.com/search?q=${q}&num=5&hl=id`;

  const res = await fetch(url, {
    headers: {
      ...HEADERS_BROWSER,
      "Referer": "https://www.google.com/",
    },
  });

  if (!res.ok) throw new Error(`Google error: ${res.status}`);
  const html = await res.text();

  const matches = [...html.matchAll(/https?:\/\/(?:www\.)?chordtela\.com\/\d{4}\/\d{2}\/[^"&<\s]+/g)];
  if (matches.length > 0) {
    return matches[0][0];
  }

  return null;
}

/**
 * Fallback terakhir: bangun URL slug langsung dari query
 * ChordTela URL pattern: /YYYY/MM/artis-judul.html
 * Kita coba slug dari query dan cek apakah 200
 */
async function cariViaSlug(query) {
  
  const slug = query
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")      
    .replace(/[^a-z0-9\s-]/g, "") 
    .trim()
    .replace(/\s+/g, "-");

  const years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
  const months = ["12", "11", "10", "09", "08", "07", "06", "05", "04", "03", "02", "01"];

  const parts = query.split(/\s*-\s*/);
  if (parts.length >= 2) {
    const artis = parts[parts.length - 1].trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const artisUrl = `https://www.chordtela.com/chord/${artis}`;

    const res = await fetch(artisUrl, { headers: HEADERS_BROWSER });
    if (res.ok) {
      const html = await res.text();
      
      const judul = parts.slice(0, -1).join(" ").trim().toLowerCase();
      const linkMatches = [...html.matchAll(/href="(https?:\/\/(?:www\.)?chordtela\.com\/\d{4}\/\d{2}\/[^"]+)"/g)];

      for (const match of linkMatches) {
        const linkUrl = match[1];
        const linkSlug = linkUrl.split("/").pop().replace(".html", "").replace(/-/g, " ");
        const judulWords = judul.split(/\s+/);
        const matchCount = judulWords.filter(w => linkSlug.includes(w)).length;
        if (matchCount >= Math.min(2, judulWords.length)) {
          return linkUrl;
        }
      }

      if (linkMatches.length > 0) return linkMatches[0][1];
    }
  }

  return null;
}

/**
 * Master search: coba semua strategy berurutan
 */
async function cariUrlChord(query) {
  
  try {
    const url = await cariViaDDG(query);
    if (url) return url;
  } catch (e) {
    console.warn("[chords] DDG gagal:", e.message);
  }

  try {
    const url = await cariViaGoogle(query);
    if (url) return url;
  } catch (e) {
    console.warn("[chords] Google gagal:", e.message);
  }

  try {
    const url = await cariViaSlug(query);
    if (url) return url;
  } catch (e) {
    console.warn("[chords] Slug gagal:", e.message);
  }

  return null;
}

async function scrapeChord(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: {
      ...HEADERS_BROWSER,
      "Referer": "https://www.chordtela.com/",
    },
  });

  if (!res.ok) throw new Error(`Gagal fetch halaman: ${res.status}`);
  const html = await res.text();

  const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title>([\s\S]*?)<\/title>/i);
  let judul = titleMatch
    ? titleMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/Kunci\s+Gitar\s*/i, "")
        .replace(/\s*Chord\s+Dasar.*/i, "")
        .replace(/©.*$/, "")
        .trim()
    : pageUrl.split("/").pop().replace(".html", "").replace(/-/g, " ");

  let chordRaw = "";

  const preMatches = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)];
  if (preMatches.length > 0) {
    
    chordRaw = preMatches.reduce((longest, m) => m[1].length > longest.length ? m[1] : longest, "");
  }

  if (!chordRaw || chordRaw.length < 50) {
    const contentMatch = html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]+?)<div[^>]+class="[^"]*(?:sharedaddy|post-footer|related)/i);
    if (contentMatch) {
      chordRaw = contentMatch[1];
    }
  }

  if (!chordRaw || chordRaw.length < 20) {
    throw new Error("Konten chord tidak ditemukan di halaman.");
  }

  let chordText = chordRaw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const originalIdx = chordText.indexOf("[[[ORIGINAL CHORD]]]");
  if (originalIdx > 0) {
    chordText = chordText.substring(0, originalIdx).trim();
  }

  const capoMatch = chordText.match(/Capo\s+(?:di\s+)?(?:fret\s+)?(\d+)/i);
  const capo = capoMatch ? `Capo fret ${capoMatch[1]}` : null;

  const keyMatch = chordText.match(/Key\s*:\s*([A-G][#b]?(?:m|maj|min)?)/i);
  const key = keyMatch ? keyMatch[1] : null;

  return { judul, chordText, capo, key, url: pageUrl };
}

function formatOutput({ judul, chordText, capo, key, url }) {
  const MAX_CHARS = 3800;

  let header = `🎸 *${judul}*\n`;
  if (capo) header += `📌 ${capo}\n`;
  if (key)  header += `🎵 Key: ${key}\n`;
  header += `🔗 ${url}\n`;
  header += "─".repeat(30) + "\n\n";

  const body = "```\n" + chordText + "\n```";
  const full = header + body;

  if (full.length <= MAX_CHARS) return full;

  const available = MAX_CHARS - header.length - 60;
  const truncated = chordText.substring(0, available);
  
  const lastNewline = truncated.lastIndexOf("\n");
  const cleanTruncated = lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated;

  return header + "```\n" + cleanTruncated + "\n```\n\n_[Chord terlalu panjang — lihat lengkap di link atas 👆]_";
}

async function handler(m, { sock }) {
  const query = m.text?.trim();

  if (!query) {
    return m.reply(
      `❌ *Format salah!*\n\n` +
      `Gunakan: *.chords <judul lagu> [- artis]*\n\n` +
      `Contoh:\n` +
      `• \`.chords kangen - dewa 19\`\n` +
      `• \`.chords pupus\`\n` +
      `• \`.chords separuh nafas dewa\``
    );
  }

  await m.react("🔍");

  let pageUrl = null;

  try {
    pageUrl = await cariUrlChord(query);

    if (!pageUrl) {
      await m.react("❌");
      return m.reply(
        `❌ Chord *"${query}"* tidak ditemukan.\n\n` +
        `💡 Coba:\n` +
        `• *.chords ${query} - [nama artis]*\n` +
        `• Periksa ejaan judul lagu\n\n` +
        `Atau cari manual: https://www.chordtela.com`
      );
    }

    await m.react("⏳");

    const data = await scrapeChord(pageUrl);
    const output = formatOutput(data);

    await m.react("✅");
    await m.reply(output);

  } catch (err) {
    console.error("[chords] Error:", err.message);
    await m.react("❌");

    if (pageUrl) {
      return m.reply(
        `⚠️ Gagal membaca halaman chord.\n\n` +
        `Buka langsung di:\n${pageUrl}\n\n` +
        `_Error: ${err.message}_`
      );
    }

    return m.reply(
      `❌ Terjadi kesalahan: _${err.message}_\n\n` +
      `Cari manual: https://www.chordtela.com`
    );
  }
}

export { pluginConfig as config, handler };