import axios from "axios";
import * as cheerio from "cheerio";

const pluginConfig = {
  name: "webtoapk",
  alias: ["w2apk", "web2apk"],
  category: "tools",
  description: "Convert website URL menjadi file APK Android",
  usage: ".webtoapk <url> | <nama app>",
  example: ".webtoapk https://google.com | Google App",
  cooldown: 60,
  energi: 2,
  isEnabled: true,
};

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeAppName(name) {
  return name.replace(/[^a-zA-Z0-9 _-]/g, "").trim().substring(0, 30) || "MyApp";
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

async function generateApk(url, appName) {
  
  const homePage = await axios.get("https://webintoapp.com/", {
    headers: HEADERS,
    timeout: 15000,
  });

  const $ = cheerio.load(homePage.data);
  const csrfToken =
    $('input[name="_token"]').val() ||
    $('meta[name="csrf-token"]').attr("content");

  const formData = new URLSearchParams();
  if (csrfToken) formData.append("_token", csrfToken);
  formData.append("url", url);
  formData.append("app_name", appName);
  formData.append("package", `com.${appName.toLowerCase().replace(/\s+/g, "")}.app`);

  const submitRes = await axios.post(
    "https://webintoapp.com/",
    formData.toString(),
    {
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://webintoapp.com/",
        "Origin": "https://webintoapp.com",
      },
      timeout: 30000,
      maxRedirects: 5,
    }
  );

  const $2 = cheerio.load(submitRes.data);

  let apkUrl = null;
  $2("a[href]").each((_, el) => {
    const href = $2(el).attr("href");
    if (href && (href.includes(".apk") || href.includes("download"))) {
      apkUrl = href.startsWith("http") ? href : `https://webintoapp.com${href}`;
    }
  });

  if (!apkUrl) {
    $2("[href*='apk'], [href*='download']").each((_, el) => {
      const href = $2(el).attr("href");
      if (href) apkUrl = href.startsWith("http") ? href : `https://webintoapp.com${href}`;
    });
  }

  if (!apkUrl) {
    
    const finalUrl = submitRes.request?.res?.responseUrl || submitRes.config?.url;
    if (finalUrl && finalUrl !== "https://webintoapp.com/") {
      return { apkUrl: finalUrl, direct: false };
    }
    throw new Error("Link APK tidak ditemukan di halaman hasil");
  }

  return { apkUrl, direct: true };
}

async function handler(m, { sock }) {
  const raw = m.text?.trim() || "";

  if (!raw) {
    return m.reply(
      `╭─「 🛠️ *WEB TO APK* 」\n` +
      `│\n` +
      `│  Convert website menjadi APK Android.\n` +
      `│\n` +
      `├─「 📖 *CARA PAKAI* 」\n` +
      `│  \`${m.prefix}webtoapk <url>\`\n` +
      `│  \`${m.prefix}webtoapk <url> | <nama app>\`\n` +
      `│\n` +
      `├─「 📌 *CONTOH* 」\n` +
      `│  \`${m.prefix}webtoapk https://google.com\`\n` +
      `│  \`${m.prefix}webtoapk https://tokopedia.com | Toko App\`\n` +
      `│\n` +
      `├─「 ⚠️ *CATATAN* 」\n` +
      `│  • Website harus bisa diakses publik\n` +
      `│  • Proses build ±1-2 menit\n` +
      `│  • Output berupa link download APK\n` +
      `│\n` +
      `╰─ _Powered by WebIntoApp_`
    );
  }

  const parts = raw.split("|").map((s) => s.trim());
  const inputUrl = parts[0];
  const appName = sanitizeAppName(parts[1] || "MyApp");

  if (!isValidUrl(inputUrl)) {
    return m.reply(
      `╭─「 ❌ *URL TIDAK VALID* 」\n` +
      `│\n` +
      `│  URL harus dimulai dengan:\n` +
      `│  \`http://\` atau \`https://\`\n` +
      `│\n` +
      `╰─ _Contoh: \`${m.prefix}webtoapk https://example.com\`_`
    );
  }

  m.react("⚙️");
  await m.reply(
    `╭─「 ⚙️ *MEMPROSES* 」\n` +
    `│\n` +
    `│  🌐 URL: ${inputUrl}\n` +
    `│  📱 Nama App: ${appName}\n` +
    `│\n` +
    `│  Sedang build APK...\n` +
    `╰─ _Mohon tunggu ±1-2 menit_ ⏳`
  );

  try {
    const { apkUrl, direct } = await generateApk(inputUrl, appName);

    m.react("✅");
    await m.reply(
      `╭─「 ✅ *${direct ? "APK SIAP DOWNLOAD" : "PROSES SELESAI"}* 」\n` +
      `│\n` +
      `│  📱 *${appName}*\n` +
      `│  🌐 ${inputUrl}\n` +
      `│\n` +
      `├─「 📥 *${direct ? "DOWNLOAD APK" : "BUKA HALAMAN"}* 」\n` +
      `│  ${apkUrl}\n` +
      `│\n` +
      `├─「 📋 *INFO* 」\n` +
      `│  • Klik link di atas untuk download\n` +
      `│  • Install di Android (aktifkan "Unknown sources")\n` +
      `│\n` +
      `╰─ _Powered by WebIntoApp_ 🛠️`
    );
  } catch (e) {
    console.error("[WebToAPK]", e.message || e);
    m.react("❌");
    await m.reply(
      `╭─「 ❌ *GAGAL BUILD APK* 」\n` +
      `│\n` +
      `│  ${e.message || "Terjadi kesalahan tidak diketahui"}\n` +
      `│\n` +
      `├─「 💡 *SOLUSI* 」\n` +
      `│  • Pastikan URL bisa diakses publik\n` +
      `│  • Coba lagi beberapa saat\n` +
      `│  • Gunakan URL yang lebih sederhana\n` +
      `│\n` +
      `╰─ _Hubungi owner jika masalah berlanjut_`
    );
  }
}

export { pluginConfig as config, handler };