import { getAssetBuffer, loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import fs from "fs";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "setreply",
  alias: ["replyvariant", "replystyle"],
  category: "owner",
  description: "Mengatur variant tampilan reply",
  usage: ".setreply <v1-v19>",
  example: ".setreply v16",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const VARIANTS = {
  v1: { id: 1, name: "BASIC", desc: "", emoji: "✨" },
  v2: { id: 2, name: "PREMIUM", desc: "", emoji: "🖼️" },
  v3: { id: 3, name: "TITANIUM", desc: "", emoji: "📨" },
  v4: { id: 4, name: "LV", desc: "", emoji: "💼" },
  v5: { id: 5, name: "FAKE ORDER", desc: "Teks dengan fake quoted order message", emoji: "🛒" },
  v6: { id: 6, name: "SIMPLE DOCUMENT", desc: "Seperti V2 tapi tanpa fake contact quote (quoted ori)", emoji: "📄" },
  v7: { id: 7, name: "FAKE LOCATION", desc: "Teks dengan fake quoted location message", emoji: "📍" },
  v8: { id: 8, name: "FAKE SIGNUP", desc: "Teks dengan fake quoted signup message", emoji: "🥠" },
  v9: { id: 9, name: "FAKE ORDER", desc: "Teks dengan fake quoted order message", emoji: "🍙" },
  v10: { id: 10, name: "TAGIHAN / PAYMENT", desc: "Tampilan struk tagihan (Payment Request)", emoji: "💳" },
  v11: { id: 11, name: "ANIMATED BOT NAME", desc: "Teks animasi loop bertahap mengambil dari nama bot", emoji: "🌀" },
  v12: { id: 12, name: "EXTENDED TEXT MESSAGE", desc: "Reply dengan link preview ichigostore.my.id (extendedTextMessage)", emoji: "🔗" },
  v13: { id: 13, name: "FAKE CONTACT LINK PREVIEW", desc: "Extended text dengan quoted fake contact + favicon link preview", emoji: "👤" },
  v14: { id: 14, name: "BOOKING CONFIRMATION", desc: "Reply interaktif dengan native flow booking confirmation", emoji: "📅" },
  v15: { id: 15, name: "CATALOG LINK PREVIEW", desc: "Extended text dengan link preview katalog wa.me/c owner + thumbnail HQ", emoji: "🛍️" },
  v16: { id: 16, name: "PAYMENT FOOTER", desc: "Interactive review_and_pay (order_details), teks reply tampil di footer", emoji: "💸" },
  v17: { id: 17, name: "ORDER STATUS", desc: "Interactive native flow order_status dengan quoted kontak Meta (status)", emoji: "📦" },
  v18: { id: 18, name: "VIEW ONCE NATIVE FLOW", desc: "Interactive viewOnce native flow (mixed), teks reply di footer, quoted kontak Meta (status)", emoji: "🧩" },
  v19: { id: 19, name: "EVENT INVITE", desc: "Event invitation (eventInviteMessage) NIXCODE dengan thumbnail, teks reply di deskripsi", emoji: "🎟️" },
};

async function handler(m, { sock, db }) {
  const variant = m.text;

  if (variant) {
    const selected = VARIANTS[variant];
    if (!selected) {
      await m.reply(`❌ *VARIANT TIDAK VALID*\n\nGunakan: *v1* s/d *v19*`);
      return;
    }

    db.setting("replyVariant", selected.id);
    await db.save();

    let warningMsg = "";
    if (selected.id === 11) {
      warningMsg = `\n\n⚠ *PERINGATAN KHUSUS V11:*\n_Penggunaan variant animasi ini memiliki kemungkinan dapat menyebabkan nomor bot ter-banned, kinerja panel melambat, dan spam di console._`;
    }
    if (selected.id === 12) {
      warningMsg = `\n\n💡 *INFO V12:*\n_Reply akan tampil sebagai extendedTextMessage dengan link preview ichigostore.my.id._`;
    }
    if (selected.id === 14) {
      warningMsg = `\n\n💡 *INFO V14:*\n_Reply akan tampil sebagai interactive message native flow booking confirmation._`;
    }
    if (selected.id === 15) {
      warningMsg = `\n\n💡 *INFO V15:*\n_Reply akan tampil sebagai extendedTextMessage dengan link preview katalog owner (wa.me/c)._`;
    }

    if (selected.id === 16) {
      warningMsg = `\n\n💡 *INFO V16:*\n_Reply akan tampil sebagai interactive message review_and_pay (order_details) dengan teks reply di footer._`;
    }

    if (selected.id === 17) {
      warningMsg = `\n\n💡 *INFO V17:*\n_Reply akan tampil sebagai interactive message native flow order_status dengan quoted kontak Meta, teks reply di body._`;
    }

    if (selected.id === 18) {
      warningMsg = `\n\n💡 *INFO V18:*\n_Reply akan tampil sebagai interactive message viewOnce native flow (mixed) dengan teks reply di footer dan quoted kontak Meta (status)._`;
    }

    if (selected.id === 19) {
      warningMsg = `\n\n💡 *INFO V19:*\n_Reply akan tampil sebagai event invitation (eventInviteMessage) NIXCODE dengan thumbnail, teks reply di deskripsi event._`;
    }

    await m.reply(
      `✅ *REPLY VARIANT DIUBAH*\n\n` +
      `${selected.emoji} *V${selected.id} — ${selected.name}*\n` +
      `_${selected.desc}_` + warningMsg,
    );
    return;
  }

  const current = db.setting("replyVariant") || config.ui?.replyVariant || 1;

  const rows = [];
  for (const [key, val] of Object.entries(VARIANTS)) {
    const mark = val.id === current ? " ✓" : "";
    rows.push({
      title: `${val.emoji} ${key.toUpperCase()}${mark} — ${val.name}`,
      description: val.desc,
      id: `${m.prefix}setreply ${key}`,
    });
  }

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "💬 Pilih Variant Reply",
        sections: [{ title: "Daftar Variant Reply", rows }],
      }),
    },
  ];

  const bodys =
    `💬📨 *REPLY VARIANT*\n\n` +
    `Atur tampilan balasan bot ketika membalas pesan user 💬✨\n` +
    `Variant aktif saat ini: *V${current} — ${VARIANTS[`v${current}`]?.name || "Unknown"}* 🎯\n\n` +
    `⚠ *PERINGATAN:*\n_Khusus penggunaan v11 (Animasi) berisiko menyebabkan nomor bot ter-banned, panel melambat, & spam di console._\n\n`;

  await sock.sendButton(
    m.chat,
    await loadAssetBuffer("ichigo"),
    bodys,
    m,
    { buttons },
  );
}

export { pluginConfig as config, handler };