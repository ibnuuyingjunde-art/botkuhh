import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setgoodbyetype",
  alias: ["goodbyetype", "goodbyevariant", "goodbyestyle"],
  category: "owner",
  description: "Mengatur variant tampilan goodbye message",
  usage: ".setgoodbyetype",
  example: ".setgoodbyetype",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  1: {
    name: "Sakura Farewell",
    desc: "nativeFlow + foto PP + tombol Selamat Tinggal — aesthetic & kompatibel",
    emoji: "🌸",
  },
  2: {
    name: "Carousel Cards",
    desc: "Kartu carousel interaktif + foto PP + tombol",
    emoji: "🃏",
  },
  3: {
    name: "Text Only",
    desc: "Pesan teks minimalis tanpa gambar",
    emoji: "📝",
  },
  4: {
    name: "Group Style",
    desc: "ContextInfo group style — tampilan rapi dengan label newsletter",
    emoji: "👥",
  },
  5: {
    name: "Link Preview",
    desc: "Pesan teks + link preview + foto profil member",
    emoji: "✨",
  },
  6: {
    name: "Link Preview + Canvas",
    desc: "Link preview (ichigostore.my.id) + Goodbye Card Canvas 16:9",
    emoji: "🌳",
  },
  7: {
    name: "Product Card",
    desc: "Kartu produk native (catalog card) + Goodbye Card Canvas",
    emoji: "🛍️",
  },
};

const VALID_IDS = [1, 2, 3, 4, 5, 6, 7];

async function handler(m, { sock, db }) {
  const args    = m.args || [];
  const variant = args[0]?.toLowerCase();
  const rawCurrent = parseInt(db.setting("goodbyeType"), 10) || 1;
  const current = VARIANTS[rawCurrent] ? rawCurrent : 1;

  if (variant && /^v?[1-7]$/.test(variant)) {
    const id = parseInt(variant.replace("v", ""));
    db.setting("goodbyeType", id);
    await db.save();
    await m.reply(
      `✅ *GOODBYE TYPE DIUBAH*\n\n` +
      `${VARIANTS[id].emoji} *V${id} — ${VARIANTS[id].name}*\n` +
      `_${VARIANTS[id].desc}_`,
    );
    return;
  }

  const rows = [];
  for (const [id, val] of Object.entries(VARIANTS)) {
    const mark = parseInt(id) === current ? " ✓" : "";
    rows.push({
      title:       `${val.emoji} V${id}${mark} — ${val.name}`,
      description: val.desc,
      id:          `${m.prefix}setgoodbyetype v${id}`,
    });
  }

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title:    "👋 Pilih Tipe Goodbye",
        sections: [{ title: "Daftar Tipe Goodbye", rows }],
      }),
    },
  ];

  const bodyText =
    `👋🚪 *GOODBYE TYPE*\n\n` +
    `Atur tampilan pesan goodbye saat member keluar dari grup 🚶💨\n` +
    `Tipe aktif saat ini: *V${current} — ${VARIANTS[current].name}* 🎯\n\n` +
    `*PENJELASAN TIPE:*\n\n` +
    `- *V1 Sakura Farewell* 🌸 — nativeFlow + foto PP member + tombol Selamat Tinggal, aesthetic dan kompatibel di semua device\n\n` +
    `- *V2 Carousel Cards* 🃏 — Kartu carousel interaktif yang bisa di-swipe, lengkap foto PP + tombol action\n\n` +
    `- *V3 Text Only* 📝 — Pesan teks biasa tanpa gambar, ringan dan minimalis\n\n` +
    `- *V4 Group Style* 👥 — ContextInfo bergaya group forward, tampilan rapi dengan label newsletter\n\n` +
    `- *V5 Link Preview* ✨ — Pesan teks dengan link preview + foto profil member yang keluar\n\n` +
    `- *V6 Link Preview + Canvas* 🌳 — Link preview (ichigostore.my.id) dengan Goodbye Card Canvas 16:9 sebagai thumbnail\n\n` +
    `- *V7 Product Card* 🛍️ — Kartu produk native (catalog card) dengan Goodbye Card Canvas sebagai gambar produk\n\n` +
    `> Pilih tipe goodbye dari tombol di bawah 👇`;

  await sock.sendButton(
    m.chat,
    (await loadAssetBuffer("ichigo")),
    bodyText,
    m,
    { buttons },
  );
}

export { pluginConfig as config, handler };