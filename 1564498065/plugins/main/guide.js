import fs from "fs";
import path from "path";
import config from "../../config.js";

const pluginConfig = {
  name: "guide",
  alias: ["panduan", "help", "tutorial", "cara"],
  category: "main",
  description: "Panduan lengkap penggunaan bot",
  usage: ".guide",
  example: ".guide",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, db }) {
  const prefix = config.command?.prefix || ".";
  const botName = config.bot?.name || "lyniX's MD";
  const ownerName = config.owner?.name || "Kazee";
  const saluranId = config.saluran?.id || "120363409557700746@newsletter";
  const saluranName = config.saluran?.name || botName;
  const saluranLink = config.saluran?.link || "";

  const imagePath = path.join(process.cwd(), "assets", "images", "ichigo.jpg");
  const thumbPath = path.join(process.cwd(), "assets", "images", "ichigo2.jpg");
  const imageBuffer = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : null;
  const thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : null;

  const guideRows = [
    {
      title: "📖 Cara Pakai Bot",
      description: "Panduan dasar menggunakan bot",
      id: `${prefix}guide cara`,
    },
    {
      title: "📋 Aturan Bot",
      description: "Peraturan yang wajib dipatuhi",
      id: `${prefix}guide aturan`,
    },
    {
      title: "⚡ Info Fitur & Limit",
      description: "Penjelasan fitur, energi, dan limit",
      id: `${prefix}guide fitur`,
    },
    {
      title: "💎 Info Premium",
      description: "Keuntungan dan cara jadi premium",
      id: `${prefix}guide premium`,
    },
    {
      title: "❓ FAQ",
      description: "Pertanyaan yang sering ditanyakan",
      id: `${prefix}guide faq`,
    },
  ];

  const args = m.args || [];
  const subCmd = args[0]?.toLowerCase();

  if (subCmd) {
    let title = "";
    let content = "";

    switch (subCmd) {
      case "cara":
        title = "📖 Cara Pakai Bot";
        content = [
          `╭─「 *📖 CARA PAKAI BOT* 」`,
          `│`,
          `│  1️⃣ *Ketik prefix + command*`,
          `│     Contoh: \`${prefix}menu\``,
          `│`,
          `│  2️⃣ *Lihat daftar perintah*`,
          `│     Ketik \`${prefix}menu\` atau \`${prefix}allmenu\``,
          `│`,
          `│  3️⃣ *Pilih kategori fitur*`,
          `│     Ketik \`${prefix}menucat <kategori>\``,
          `│     Contoh: \`${prefix}menucat ai\``,
          `│`,
          `│  4️⃣ *Cara pakai fitur media*`,
          `│     Reply gambar/video + ketik command`,
          `│     Contoh: reply gambar → \`${prefix}sticker\``,
          `│`,
          `│  5️⃣ *Cara pakai fitur AI*`,
          `│     Ketik command + pertanyaan/teks`,
          `│     Contoh: \`${prefix}ai Apa itu AI?\``,
          `│`,
          `│  6️⃣ *Lihat detail command*`,
          `│     Ketik \`${prefix}help <command>\``,
          `│     Contoh: \`${prefix}help sticker\``,
          `│`,
          `╰──✧`,
        ].join("\n");
        break;

      case "aturan":
        title = "📋 Aturan Bot";
        content = [
          `╭─「 *📋 ATURAN BOT* 」`,
          `│`,
          `│  ✅ *BOLEH:*`,
          `│  • Gunakan fitur untuk keperluan positif`,
          `│  • Request fitur via kontak owner`,
          `│  • Share bot ke teman-teman`,
          `│`,
          `│  ❌ *DILARANG:*`,
          `│  • Spam command berulang-ulang`,
          `│  • Gunakan bot untuk menipu/scam`,
          `│  • Kirim konten SARA, pornografi`,
          `│  • Abuse fitur premium gratis`,
          `│  • Menyebarkan hoaks lewat bot`,
          `│`,
          `│  ⚠️ *SANKSI:*`,
          `│  • Peringatan pertama: banned sementara`,
          `│  • Pelanggaran berulang: banned permanen`,
          `│  • Penyalahgunaan serius: lapor ke pihak berwajib`,
          `│`,
          `│  📌 Aturan dapat berubah sewaktu-waktu`,
          `│  📌 Keputusan owner bersifat final`,
          `│`,
          `╰──✧`,
        ].join("\n");
        break;

      case "fitur":
        title = "⚡ Info Fitur & Limit";
        content = [
          `╭─「 *⚡ INFO FITUR & LIMIT* 」`,
          `│`,
          `│  🔋 *ENERGI*`,
          `│  • Setiap pakai fitur berbayar butuh energi`,
          `│  • Energi default: *25/hari*`,
          `│  • Reset otomatis tiap hari jam 00.00 WITA`,
          `│  • Premium: energi *tidak terbatas* ∞`,
          `│`,
          `│  💰 *KOIN*`,
          `│  • Didapat dari aktivitas di bot`,
          `│  • Bisa dipakai untuk beli fitur tertentu`,
          `│  • Cek koin: \`${prefix}profil\``,
          `│`,
          `│  🎯 *KATEGORI FITUR*`,
          `│  • 🤖 AI — Kecerdasan buatan`,
          `│  • 🖼️ Sticker — Buat & cari stiker`,
          `│  • 📥 Download — Unduh media sosmed`,
          `│  • 🔍 Search — Pencarian informasi`,
          `│  • 🎮 Fun — Hiburan & games`,
          `│  • 🛠️ Tools — Alat bantu sehari-hari`,
          `│  • Dan masih banyak lagi!`,
          `│`,
          `│  📊 Cek semua fitur: \`${prefix}allmenu\``,
          `│`,
          `╰──✧`,
        ].join("\n");
        break;

      case "premium":
        title = "💎 Info Premium";
        content = [
          `╭─「 *💎 INFO PREMIUM* 」`,
          `│`,
          `│  ✨ *KEUNTUNGAN PREMIUM:*`,
          `│  • Energi tidak terbatas ∞`,
          `│  • Akses semua fitur premium`,
          `│  • Prioritas request fitur baru`,
          `│  • Bebas cooldown command`,
          `│  • Support langsung dari owner`,
          `│`,
          `│  💰 *HARGA:*`,
          `│  • Hubungi owner untuk info harga`,
          `│  • Tersedia paket harian/mingguan/bulanan`,
          `│`,
          `│  📞 *CARA DAFTAR:*`,
          `│  1. Ketik \`${prefix}owner\` untuk kontak owner`,
          `│  2. Hubungi owner via WA`,
          `│  3. Pilih paket yang diinginkan`,
          `│  4. Lakukan pembayaran`,
          `│  5. Premium aktif otomatis`,
          `│`,
          `│  ⏰ *CEK STATUS PREMIUM:*`,
          `│  Ketik \`${prefix}profil\` untuk cek status`,
          `│`,
          `╰──✧`,
        ].join("\n");
        break;

      case "faq":
        title = "❓ FAQ";
        content = [
          `╭─「 *❓ PERTANYAAN UMUM (FAQ)* 」`,
          `│`,
          `│  ❓ *Bot tidak merespons?*`,
          `│  → Pastikan prefix benar: \`${prefix}\``,
          `│  → Cek apakah bot sedang online`,
          `│  → Tunggu beberapa saat lalu coba lagi`,
          `│`,
          `│  ❓ *Energi habis?*`,
          `│  → Tunggu reset jam 00.00 WITA`,
          `│  → Atau upgrade ke premium`,
          `│`,
          `│  ❓ *Command tidak dikenal?*`,
          `│  → Ketik \`${prefix}allmenu\` untuk daftar lengkap`,
          `│  → Pastikan ejaan command benar`,
          `│`,
          `│  ❓ *Cara lapor bug/error?*`,
          `│  → Hubungi owner via \`${prefix}owner\``,
          `│  → Sertakan screenshot error`,
          `│`,
          `│  ❓ *Cara request fitur baru?*`,
          `│  → Hubungi owner langsung`,
          `│  → Jelaskan fitur yang diinginkan`,
          `│`,
          `│  ❓ *Bot bisa dipakai gratis?*`,
          `│  → Ya! Fitur dasar gratis untuk semua`,
          `│  → Fitur premium butuh upgrade`,
          `│`,
          `╰──✧`,
        ].join("\n");
        break;

      default:
        return m.reply(`❌ Sub-command tidak dikenal.\n\nGunakan: \`${prefix}guide\` untuk melihat panduan lengkap.`);
    }

    return await sock.sendMessage(
      m.chat,
      {
        interactiveMessage: {
          header: ``,
          title: `✧ ${title}`,
          footer: content,
          image: imageBuffer || thumbBuffer,
          contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 777,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: saluranId,
              newsletterName: saluranName,
              serverMessageId: 127,
            },
          },
          nativeFlowMessage: {
            messageParamsJson: JSON.stringify({
              limited_time_offer: {
                text: `📖 ${title}`,
                url: "",
                copy_code: "",
                expiration_time: null,
              },
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1, 2, 999],
                list_title: "✦ Panduan Bot",
                button_title: "📖 Lihat Panduan",
              },
              tap_target_configuration: {
                title: "✦",
                description: botName,
                canonical_url: "https://ichigo.site",
                domain: "ichigo.site",
                button_index: 0,
              },
            }),
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "📖 Kembali Ke Panduan",
                  id: `${prefix}guide`,
                }),
              },
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "🏠 Kembali Ke Menu",
                  id: `${prefix}menu`,
                }),
              },
            ],
          },
        },
      },
      { quoted: m },
    );
  }

  const txt = [
    `╭─「 *📖 PANDUAN ${botName.toUpperCase()}* 」`,
    `│`,
    `│  Selamat datang! Berikut panduan lengkap`,
    `│  untuk menggunakan ${botName} dengan optimal.`,
    `│`,
    `│  🔖 *PREFIX AKTIF:* \`${prefix}\``,
    `│  👤 *OWNER:* ${ownerName}`,
    `│`,
    `│  Pilih topik panduan di bawah 👇`,
    `│`,
    `╰──✧`,
  ].join("\n");

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "📖 Pilih Panduan",
        sections: [
          {
            title: "📚 TOPIK PANDUAN",
            rows: guideRows,
          },
        ],
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🏠 Kembali Ke Menu",
        id: `${prefix}menu`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "📞 Kontak Owner",
        id: `${prefix}owner`,
      }),
    },
  ];

  await sock.sendMessage(
    m.chat,
    {
      interactiveMessage: {
        header: ``,
        title: `✧ Panduan ${botName} ✧`,
        footer: txt,
        image: imageBuffer || thumbBuffer,
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 777,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127,
          },
        },
        nativeFlowMessage: {
          messageParamsJson: JSON.stringify({
            limited_time_offer: {
              text: `📖 Panduan ${botName}`,
              url: "",
              copy_code: "",
              expiration_time: null,
            },
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1, 2, 3, 999],
              list_title: "✦ Pilih topik panduan",
              button_title: "📖 Buka Panduan",
            },
            tap_target_configuration: {
              title: "✦",
              description: botName,
              canonical_url: "https://ichigo.site",
              domain: "ichigo.site",
              button_index: 0,
            },
          }),
          buttons,
        },
      },
    },
    { quoted: m },
  );
}

export { pluginConfig as config, handler };