import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "tofile",
  alias: ["totxt", "txt2file", "text2file"],
  category: "tools",
  description: "Ubah teks menjadi file, nama file bisa diatur sendiri",
  usage: ".tofile <nama_file> <teks> / reply teks dengan .tofile <nama_file>",
  example: ".tofile catatan.txt Halo dunia!",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const DEFAULT_EXT = "txt";
// batasi ekstensi yang masih "aman" dikirim sebagai dokumen teks
const MIME_MAP = {
  txt: "text/plain",
  json: "application/json",
  js: "text/javascript",
  csv: "text/csv",
  md: "text/markdown",
  html: "text/html",
  xml: "application/xml",
  log: "text/plain",
  yaml: "text/yaml",
  yml: "text/yaml",
  css: "text/css",
};

function sanitizeFilename(raw) {
  // buang karakter yang bisa bikin masalah di path/OS
  let name = String(raw || "").trim().replace(/[\\/:*?"<>|]/g, "");
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

function buildFilename(rawName, lang) {
  let name = sanitizeFilename(rawName);

  if (!name) {
    name = `tofile-${Date.now()}`;
  }

  // kalau user nggak kasih ekstensi, coba tebak dari bahasa code fence,
  // kalau nggak ada juga baru fallback ke .txt
  if (!/\.[a-zA-Z0-9]+$/.test(name)) {
    const guessedExt = (lang && LANG_TO_EXT[lang]) || DEFAULT_EXT;
    name = `${name}.${guessedExt}`;
  }

  // batasi panjang nama file biar aman
  if (name.length > 100) {
    const ext = name.includes(".") ? name.split(".").pop() : DEFAULT_EXT;
    name = `${name.slice(0, 90)}.${ext}`;
  }

  return name;
}

function getMimetype(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

// alias bahasa -> ekstensi file, dipakai saat parsing ```lang fence
const LANG_TO_EXT = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  json: "json",
  html: "html",
  css: "css",
  python: "py",
  py: "py",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  yaml: "yaml",
  yml: "yml",
  markdown: "md",
  md: "md",
  xml: "xml",
};

// kalau teks dibungkus markdown code fence (```lang ... ```), bersihkan
// fence-nya dan kembalikan bahasanya (kalau ada) buat nebak ekstensi
function stripCodeFence(raw) {
  const text = String(raw || "");
  const match = text.trim().match(/^```([a-zA-Z0-9_-]*)\n?([\s\S]*?)\n?```$/);
  if (!match) return { text, lang: null };
  const [, lang, body] = match;
  return { text: body, lang: lang ? lang.toLowerCase() : null };
}

async function handler(m, { sock }) {
  const args = m.args || [];

  let filenameArg = null;
  let text = null;
  let lang = null;

  // beberapa tipe pesan nyimpen isi teksnya di .body atau .caption,
  // bukan di .text — jadi dicoba berurutan biar nggak kelewatan
  const quotedRaw = (
    m.quoted?.text ||
    m.quoted?.body ||
    m.quoted?.caption ||
    ""
  ).trim();

  if (quotedRaw) {
    // reply teks/kode: argumen pertama (kalau ada) dianggap nama file
    filenameArg = args[0] || null;
    ({ text, lang } = stripCodeFence(quotedRaw));
  } else {
    // .tofile <namafile> <teks...>
    filenameArg = args[0] || null;
    ({ text, lang } = stripCodeFence(args.slice(1).join(" ")));
  }

  if (!text || !text.trim()) {
    return m.reply(
      `📄 *ᴛᴇxᴛ/ᴋᴏᴅᴇ ᴛᴏ ꜰɪʟᴇ*\n\n` +
        `Ubah teks atau kode jadi file, nama file bebas kamu tentukan.\n\n` +
        `*Cara pakai:*\n` +
        `• \`${m.prefix}${m.command} <nama_file> <teks>\`\n` +
        `• Reply teks/kode dengan \`${m.prefix}${m.command} <nama_file>\`\n\n` +
        `*Contoh:*\n` +
        `• \`${m.prefix}${m.command} catatan.txt Halo dunia!\`\n` +
        `• \`${m.prefix}${m.command} data.json\` (reply ke pesan JSON)\n` +
        `• \`${m.prefix}${m.command} script\` (reply ke pesan berisi \`\`\`js ... \`\`\`)\n\n` +
        `> Kalau ekstensi nggak dikasih, otomatis ditebak dari code fence atau fallback .txt`,
    );
  }

  await m.react("🕕");

  try {
    const filename = buildFilename(filenameArg, lang);
    const mimetype = getMimetype(filename);
    const buffer = Buffer.from(text, "utf8");

    await sock.sendMessage(
      m.chat,
      {
        document: buffer,
        fileName: filename,
        mimetype,
        caption: `📄 *${filename}*\n📊 Ukuran: ${buffer.length} bytes`,
      },
      { quoted: m },
    );

    await m.react("✅");
  } catch (e) {
    console.error("[tofile] Error:", e);
    await m.react("❌");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };