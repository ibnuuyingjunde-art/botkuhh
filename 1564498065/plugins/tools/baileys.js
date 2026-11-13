import te from "../../src/lib/ichigo-error.js";
import { npmPackageInfo } from "../../src/scraper/npmsearch.js";

const config = {
  name: "baileys",
  alias: ["infobaileys", "whatbaileys", "aboutbaileys"],
  category: "tools",
  description: "Penjelasan singkat + kelebihan/kekurangan Baileys atau fork-nya (npm package apa aja)",
  usage: ".baileys [nama_package]",
  example: ".baileys cloud-baileys",
  cooldown: 5,
  energi: 0,
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isEnabled: true,
};

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function handler(m, { sock }) {
  const pkgName = (m.text || m.fullArgs || "").trim() || "baileys";

  m.react("⏳");

  try {
    const pkg = await npmPackageInfo(pkgName);

    if (!pkg.status) {
      m.react("☢");
      return m.reply(
        `❌ Package \`${pkgName}\` tidak ditemukan di NPM Registry.\n\n` +
        `Contoh: \`${m.prefix}baileys\` atau \`${m.prefix}baileys cloud-baileys\``
      );
    }

    const isFork = pkg.package.toLowerCase() !== "baileys";
    const versionLine = `\`v${pkg.version}\` • rilis terakhir ${fmtDate(pkg.publishedAt)} • lisensi ${pkg.license}`;

    const text =
      `╭─ 📦 *APA ITU ${pkg.package.toUpperCase()}*\n` +
      `│· Package : ${pkg.package}${isFork ? " (fork dari Baileys)" : " (dulu @whiskeysockets/baileys)"}\n` +
      `│· Versi   : ${versionLine}\n` +
      `│· Author  : ${pkg.author}\n` +
      `╰───────────────────────────\n\n` +
      (isFork
        ? `*${pkg.package}* adalah fork/turunan dari Baileys — library JavaScript/TypeScript buat konek ke WhatsApp Web lewat protokol WebSocket resmi milik WhatsApp, bukan lewat automasi browser kayak Selenium atau Puppeteer.${pkg.description ? ` Deskripsi resmi dari maintainer-nya: _${pkg.description}_.` : ""} Karena masih satu akar sama Baileys, kelebihan dan kekurangan intinya tetap ngikut ke library aslinya.\n\n`
        : `Baileys adalah library JavaScript/TypeScript buat konek ke WhatsApp Web lewat protokol WebSocket resmi milik WhatsApp — bukan lewat automasi browser kayak Selenium atau Puppeteer. Karena langsung bicara ke protokolnya, Baileys jauh lebih ringan dan cepat dibanding library berbasis browser, dan inilah yang jadi fondasi hampir semua bot WhatsApp open-source sekarang.\n\n`) +

      `*✅ Kelebihan:*\n` +
      `1. Ringan & cepat — nggak perlu jalanin browser (Chromium) di background, jadi hemat RAM dan CPU, cocok buat VPS/panel kecil.\n` +
      `2. Multi-device support — bisa jalan tanpa HP utama harus online terus, ngikutin arsitektur WA MD.\n` +
      `3. Open source & gratis — kode terbuka, bisa di-fork dan dimodif sesuai kebutuhan${isFork ? ` (kayak ${pkg.package} ini)` : ""}.\n` +
      `4. Ekosistem plugin luas — banyak base bot dan komunitas Indonesia yang udah lama pakai, jadi dokumentasi tidak resmi & contoh kode gampang dicari.\n` +
      `5. Dukungan fitur cukup lengkap — pesan teks, media, button, list, poll, story/status, newsletter/channel, sampai group management.\n\n` +

      `*⚠️ Kekurangan:*\n` +
      `1. Bukan API resmi — reverse-engineer protokol WhatsApp, jadi rawan patah tiap WhatsApp update sistemnya, butuh maintenance rutin dari maintainer/fork.\n` +
      `2. Risiko banned — pemakaian di luar batas wajar (spam, mass broadcast, self-bot berlebihan) bisa kena banned oleh WhatsApp karena ini termasuk "unofficial client".\n` +
      `3. Nggak ada dukungan resmi dari Meta/WhatsApp — kalau ada bug protokol, solusinya cuma nunggu komunitas/maintainer nge-patch.\n` +
      `4. Session/auth manual — pairing & penyimpanan credential (multi-file auth state) harus dikelola sendiri, salah handle bisa bikin sesi ke-logout terus.\n` +
      `5. Dukungan fitur voice/video call belum penuh — beberapa fitur real-time call masih terbatas dibanding WhatsApp Business API resmi.\n` +
      (isFork ? `6. Fork pihak ketiga — update dan keamanannya tergantung seberapa aktif maintainer fork ini, beda sama Baileys resmi yang komunitasnya lebih besar.\n` : "") +
      `\n_📦 Data versi diambil live dari NPM Registry_`;

    const buttons = [
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📁 Lihat Repository",
          url: pkg.links?.repository || "https://github.com/WhiskeySockets/Baileys",
        }),
      },
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📦 Lihat di NPM",
          url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.package}`,
        }),
      },
    ];

    await sock.sendMessage(
      m.chat,
      {
        text,
        footer: "NPM Registry",
        interactiveButtons: buttons,
      },
      { quoted: m },
    );

    m.react("✅");
  } catch (e) {
    console.error("[baileys]", e.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };