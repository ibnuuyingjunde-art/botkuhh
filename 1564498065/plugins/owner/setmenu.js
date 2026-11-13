import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setmenu",
  alias: ["menuvariant", "menustyle"],
  category: "owner",
  description: "Mengatur variant tampilan menu",
  usage: ".setmenu <v1-v17>",
  example: ".setmenu v6",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  v1:  { id: 1,  name: "Simple",               desc: "Image biasa tanpa contextInfo",                                                       emoji: "🖼️" },
  v2:  { id: 2,  name: "Carousel",              desc: "ViewOnce video header + interactive buttons + profil lengkap + cuaca & top fitur",   emoji: "🃏" },
  v3:  { id: 3,  name: "Dashboard Interactive", desc: "Interactive + dashboard stats + waktu WIB/WITA + cuaca real-time + order quoted",     emoji: "🏠" },
  v4:  { id: 4,  name: "Dashboard Elegant",     desc: "Interactive + box elegant ✧ + progress bar exp + waktu WIB/WITA + cuaca",            emoji: "✧"  },
  v5:  { id: 5,  name: "Dashboard Pro",         desc: "Interactive + user/bot stats + top fitur + waktu WIB/WITA + cuaca",                   emoji: "🌿" },
  v6:  { id: 6,  name: "NativeFlow Pro",        desc: "Interactive + User/Bot/System Information + role VIP + RAM & platform + ftroli quoted", emoji: "🌟" },
  v7:  { id: 7,  name: "Button Compact",        desc: "Buttons message + 2 tombol (Owner & Allmenu) + info bot & user ringkas",              emoji: "🧀" },
  v8:  { id: 8,  name: "ViewOnce Full List",    desc: "ViewOnce + image header + readmore trick + daftar semua commands",                    emoji: "🍅" },
  v9:  { id: 9,  name: "Button Elegant",        desc: "Location & buttons message + 3 tombol smallcaps + stats ringkas + cuaca WITA",        emoji: "✦"  },
  v10: { id: 10, name: "Audio Order",           desc: "Kirim audio dengan quoted order message + thumbnail bot",                             emoji: "🎵" },
  v11: { id: 11, name: "Location Elegant",      desc: "Location header + body profil smallcaps + footer cuaca real-time + buttons dropdown", emoji: "📍" },
  v12: { id: 12, name: "Button Kategori Estetik", desc: "Location message + thumbnail + tombol kategori dinamis & owner + footer box estetik + WITA", emoji: "💠" },
  v13: { id: 13, name: "NativeFlow Elegant VIP", desc: "NativeFlow message + limited time offer sapaan + role VIP di footer & greeting + quick reply owner + bottom sheet kategori", emoji: "🔷" },
  v14: { id: 14, name: "Location Menu Elegant", desc: "Location header thumbnail + body & footer info user/bot + single_select 2 section (menu utama & kategori) + tombol Owner", emoji: "🗺️" },
  v15: { id: 15, name: "Location Welcome NativeFlow", desc: "Location header online + body sapaan mention + footer system status box + single_select kategori dinamis + cta_url saluran + quick reply allmenu", emoji: "👋" },
  v16: { id: 16, name: "Image Menu & Support", desc: "Image header + single_select Menu (utama & kategori) & Support + limited time offer sapaan + footer profil & system status", emoji: "🛍️" },
  v17: { id: 17, name: "List Menu Thumbnail", desc: "List message + thumbnail besar + banner & salam di body + footer profil & system status + tombol Buka Menu", emoji: "📜" },
};

async function handler(m, { sock, db }) {
  const args = m.args || [];
  const variant = args[0]?.toLowerCase();

  if (variant) {
    const selected = VARIANTS[variant];
    if (!selected) {
      await m.reply(
        `❌ *VARIANT TIDAK VALID*\n\n` +
        `Gunakan: *v1* sampai *v17*\n\n` +
        `Ketik *.setmenu* tanpa argumen untuk melihat daftar lengkap.`
      );
      return;
    }

    db.setting("menuVariant", selected.id);
    await db.save();

    await m.reply(
      `✅ *MENU VARIANT DIUBAH*\n\n` +
      `${selected.emoji} *V${selected.id} — ${selected.name}*\n` +
      `_${selected.desc}_`
    );
    return;
  }

  const current = db.setting("menuVariant") || config.ui?.menuVariant || 1;

  const rows = [];
  for (const [key, val] of Object.entries(VARIANTS)) {
    const mark = val.id === current ? " ✓" : "";
    rows.push({
      title: `${val.emoji} ${key.toUpperCase()}${mark} — ${val.name}`,
      description: val.desc,
      id: `${m.prefix}setmenu ${key}`,
    });
  }

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🎨 Pilih Variant Menu",
        sections: [{ title: "Daftar Variant Menu", rows }],
      }),
    },
  ];

  const bodyText =
    `🎨🖼️ *MENU VARIANT*\n\n` +
    `Atur tampilan menu utama bot ketika user mengetik perintah menu 📋✨\n` +
    `Variant aktif saat ini: *V${current} — ${VARIANTS[`v${current}`]?.name || "Unknown"}* 🎯\n\n` +
    `*PENJELASAN VARIANT:*\n\n` +
    `- *V1 Simple* 🖼️ — Image biasa tanpa contextInfo\n\n` +
    `- *V2 Carousel* 🃏 — ViewOnce video header + interactive buttons + profil lengkap + cuaca & top fitur\n\n` +
    `- *V3 Dashboard Interactive* 🏠 — Stats + waktu WIB/WITA + cuaca real-time + order quoted\n\n` +
    `- *V4 Dashboard Elegant* ✧ — Box elegant + progress bar exp + waktu WIB/WITA + cuaca\n\n` +
    `- *V5 Dashboard Pro* 🌿 — User/bot stats + top fitur + waktu WIB/WITA + cuaca\n\n` +
    `- *V6 NativeFlow Pro* 🌟 — User/Bot/System Information + role VIP + RAM & platform + ftroli quoted\n\n` +
    `- *V7 Button Compact* 🧀 — Buttons message + 2 tombol ringkas\n\n` +
    `- *V8 ViewOnce Full List* 🍅 — ViewOnce + image + readmore + semua commands\n\n` +
    `- *V9 Button Elegant* ✦ — Location & buttons message + 3 tombol smallcaps + stats ringkas + cuaca WITA\n\n` +
    `- *V10 Audio Order* 🎵 — Kirim audio dengan quoted order message + thumbnail bot\n\n` +
    `- *V11 Location Elegant* 📍 — Location header + body profil smallcaps + footer cuaca real-time + buttons dropdown\n\n` +
    `- *V12 Button Kategori Estetik* 💠 — Location message + thumbnail + tombol kategori dinamis & owner + footer box estetik + WITA\n\n` +
    `- *V13 NativeFlow Elegant VIP* 🔷 — NativeFlow message + limited time offer sapaan + role VIP di footer & greeting + quick reply owner + bottom sheet kategori\n\n` +
    `- *V14 Location Menu Elegant* 🗺️ — Location header thumbnail + body & footer info user/bot + single_select 2 section (menu utama & kategori) + tombol Owner\n\n` +
    `- *V15 Location Welcome NativeFlow* 👋 — Location header online + body sapaan mention + footer system status box + single_select kategori dinamis + cta_url saluran + quick reply allmenu\n\n` +
    `- *V16 Image Menu & Support* 🛍️ — Image header + single_select Menu (utama & kategori) & Support + limited time offer sapaan + footer profil & system status\n\n` +
    `> Pilih variant menu dari tombol di bawah 👇`;

  await sock.sendMessage(
    m.chat,
    {
      interactiveMessage: {
        title: bodyText,
        footer: "Powered by Ichigo",
        header: "🎨 Menu Variant",
        image: (await loadAssetBuffer("ichigo")),
        buttons,
      },
    },
    { quoted: m },
  );
}

export { pluginConfig as config, handler };