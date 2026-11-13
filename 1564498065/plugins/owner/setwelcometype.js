import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setwelcometype",
  alias: ["welcometype", "welcomevariant", "welcomestyle"],
  category: "owner",
  description: "Mengatur variant tampilan welcome message",
  usage: ".setwelcometype",
  example: ".setwelcometype",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  1: { name: "Interactive",         desc: "NativeFlow + tombol Copy Intro",                    emoji: "🎐" },
  2: { name: "Carousel Cards",      desc: "Kartu carousel + foto PP + tombol Halo & Copy Intro", emoji: "🃏" },
  3: { name: "Text Only",           desc: "Pesan teks minimalis tanpa gambar",                  emoji: "📝" },
  4: { name: "sendText",            desc: "Pesan teks biasa via sendMessage",                   emoji: "👥" },
  5: { name: "Welcome Card Canvas", desc: "Canvas card 16:9 + foto PP + tombol lengkap",        emoji: "🖼️" },
  6: { name: "Card Canvas Biru",    desc: "Canvas 16:9 biru + custom text",                     emoji: "🎴" },
  7: { name: "Video/GIF",           desc: "Video/GIF playback + caption welcome",               emoji: "🎬" },
  8: { name: "ViewOnce Interactive",desc: "Media native upload + tombol quick_reply & copy",    emoji: "👁️" },
  9: { name: "Plain Text",          desc: "Teks simpel, paling ringan & kompatibel",             emoji: "🔘" },
  10: { name: "Link Preview",       desc: "extendedTextMessage + link ichigostore.my.id + foto PP", emoji: "🔗" },
  11: { name: "Product Card",       desc: "Product/catalog card native + foto welcome + footer",   emoji: "🛍️" },
};

function getVariant(id) {
  const key = parseInt(id);
  return VARIANTS[key] || VARIANTS[1];
}
function getValidId(id) {
  const key = parseInt(id);
  return VARIANTS[key] ? key : 1;
}

async function handler(m, { sock, db }) {
  const args    = m.args || [];
  const variant = args[0]?.toLowerCase();

  const rawCurrent = db.setting("welcomeType");
  const current = getValidId(rawCurrent ?? 1);

  if (variant && /^v?([1-9]|1[01])$/.test(variant)) {
    const id = parseInt(variant.replace("v", ""));
    db.setting("welcomeType", id);
    await db.save();
    const v = getVariant(id);
    await m.reply(
      `╔═══════════════════╗\n║  ✅ *ᴛʏᴘᴇ ᴅɪɢᴀɴᴛɪ*\n╚═══════════════════╝\n\n` +
      `${v.emoji} *V${id} — ${v.name}*\n` +
      `_${v.desc}_\n\n` +
      `_Welcome berikutnya akan menggunakan tampilan baru._`,
    );
    return;
  }

  const rows = [];
  for (const [id, val] of Object.entries(VARIANTS)) {
    const mark = parseInt(id) === current ? " ✓" : "";
    rows.push({
      title:       `${val.emoji} V${id}${mark} — ${val.name}`,
      description: val.desc,
      id:          `${m.prefix}setwelcometype v${id}`,
    });
  }

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title:    "👋 Pilih Tipe Welcome",
        sections: [{ title: "Daftar Tipe Welcome", rows }],
      }),
    },
  ];

  const currentVariant = getVariant(current);

  const bodyText =
    `╔═══════════════════╗\n║  👋🎨 *ᴡᴇʟᴄᴏᴍᴇ ᴛʏᴘᴇ*\n╚═══════════════════╝\n\n` +
    `Atur tampilan pesan welcome saat member baru masuk grup 🚪✨\n` +
    `Tipe aktif saat ini: *V${current} — ${currentVariant.name}* 🎯\n\n` +
    `*━━ ᴘᴇɴᴊᴇʟᴀsᴀɴ ᴛɪᴘᴇ ━━*\n\n` +
    `› *V1 Interactive* 🎐 — NativeFlow + tombol Copy Intro, tampilan rapi\n\n` +
    `› *V2 Carousel Cards* 🃏 — Kartu carousel bisa di-swipe, lengkap foto PP + tombol Halo & Copy Intro\n\n` +
    `› *V3 Text Only* 📝 — Pesan teks biasa tanpa gambar, ringan dan minimalis\n\n` +
    `› *V4 sendText* 👥 — Pesan teks biasa via sendMessage\n\n` +
    `› *V5 Welcome Card Canvas* 🖼️ — Canvas card 16:9 lengkap foto PP + tombol menu/rules/saluran\n\n` +
    `› *V6 Card Canvas Biru* 🎴 — Canvas 16:9 biru dengan custom text welcome\n\n` +
    `› *V7 Video/GIF* 🎬 — Video/GIF playback + caption welcome\n\n` +
    `› *V8 ViewOnce Interactive* 👁️ — Media diupload native, tombol quick_reply + copy intro\n\n` +
    `› *V9 Plain Text* 🔘 — Teks polos, *paling ringan & kompatibel* di hampir semua versi WA Android\n\n` +
    `› *V10 Link Preview* 🔗 — Tampilan link preview (ichigostore.my.id) + judul, deskripsi, dan foto profil member baru\n\n` +
    `› *V11 Product Card* 🛍️ — Kartu produk/katalog native berisi welcome card + footer custom, gambar di-upload otomatis\n\n` +
    `> Pilih tipe welcome dari tombol di bawah 👇`;

  await sock.sendButton(
    m.chat,
    (await loadAssetBuffer("ichigo")),
    bodyText,
    m,
    { buttons },
  );
}

export { pluginConfig as config, handler };