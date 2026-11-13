import { getDatabase } from "../../src/lib/ichigo-database.js";
import config from "../../config.js";

const pluginConfig = {
  name: "list",
  alias: ["liststore", "daftar", "info"],
  category: "store",
  description: "📋 Lihat daftar informasi toko",
  usage: ".list atau .list <nomor>",
  example: ".list 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const lists = db.setting("storeLists") || [];
  const prefix = m.prefix || ".";

  if (lists.length === 0) {
    return m.reply(
      `📋 *Belum Ada Informasi Toko*\n\n` +
        `Saat ini belum ada informasi yang ditambahkan oleh admin 😔\n\n` +
        `Silakan cek kembali nanti atau hubungi admin untuk informasi lebih lanjut.\n\n` +
        `_Terima kasih atas ketertarikan Anda_ 🙏`,
    );
  }

  const input = m.text?.trim();
  const idx = parseInt(input) - 1;

  if (!isNaN(idx) && idx >= 0 && idx < lists.length) {
    const l = lists[idx];
    const txt = `${l.content}`;

    const backButton = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔙 Kembali ke Daftar",
          id: `${prefix}list`,
        }),
      },
    ];

    try {
      if (l.image) {
        await sock.sendMessage(
          m.chat,
          {
            interactiveMessage: {
              title: txt,
              footer: `Info toko #${idx + 1}`,
              header: "",
              image: { url: l.image },
              buttons: backButton,
            },
          },
          { quoted: m },
        );
        return;
      }
      if (l.video) {
        await sock.sendMessage(
          m.chat,
          {
            interactiveMessage: {
              title: txt,
              footer: `Info toko #${idx + 1}`,
              header: "",
              video: { url: l.video },
              buttons: backButton,
            },
          },
          { quoted: m },
        );
        return;
      }

      await sock.sendMessage(
        m.chat,
        {
          interactiveMessage: {
            title: txt,
            footer: `Info toko #${idx + 1}`,
            header: "",
            buttons: backButton,
          },
        },
        { quoted: m },
      );
      return;
    } catch (e) {
      console.error("[list] gagal kirim interactive detail:", e?.message || e);
      
      if (l.image) {
        return sock.sendMessage(
          m.chat,
          { image: { url: l.image }, caption: txt },
          { quoted: m },
        );
      }
      if (l.video) {
        return sock.sendMessage(
          m.chat,
          { video: { url: l.video }, caption: txt },
          { quoted: m },
        );
      }
      return m.reply(txt);
    }
  }

  let txt = `📋 *DAFTAR INFORMASI TOKO*\n\n`;
  txt += `Berikut informasi yang tersedia saat ini 📝\n`;
  txt += `Ketuk salah satu di bawah, atau ketik \`${prefix}list <nomor>\` untuk melihat detail.\n\n`;

  for (let i = 0; i < lists.length; i++) {
    const l = lists[i];
    const mediaIcon = l.image ? "🖼️" : l.video ? "🎬" : "📝";
    txt += `*${i + 1}.* ${mediaIcon} *${l.name}*\n`;
  }

  const rows = lists.map((l, i) => ({
    title: `${i + 1}. ${l.name}`,
    description: l.image ? "🖼️ Gambar" : l.video ? "🎬 Video" : "",
    id: `${prefix}list ${i + 1}`,
  }));

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "📋 Pilih Informasi",
        sections: [
          {
            title: "Daftar Informasi Toko",
            rows,
          },
        ],
      }),
    },
  ];

  try {
    await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          title: txt,
          footer: `${lists.length} informasi tersedia`,
          header: "📋 Daftar Informasi Toko",
          buttons,
        },
      },
      { quoted: m },
    );
  } catch (e) {
    console.error("[list] gagal kirim interactive overview:", e?.message || e);
    
    txt += `\n💡 _Ketik \`${prefix}list <nomor>\` untuk membaca detail informasi_`;
    await m.reply(txt);
  }
}

export { pluginConfig as config, handler };