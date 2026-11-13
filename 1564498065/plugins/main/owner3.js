import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import config from "../../config.js"; // Pastikan path config Anda benar

const pluginConfig = {
  name: "owner3",
  alias: [], // Alias dikosongkan sesuai permintaan
  category: "main",
  description: "Menampilkan profil owner bot dengan kartu Meta Verified",
  usage: ".owner3",
  isOwner: false,
  isGroup: false,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  
  // Konfigurasi data owner (Bisa otomatis dari config.js atau diubah manual di sini)
  const namabot = config?.bot?.name || "lyniX's MD";
  const namaowner = config?.owner?.name || "";
  const ownerJid = config?.owner?.number || ""; // Ganti dengan nomor asli Anda tanpa + atau spasi

  await m.react("👤");

  try {
    // 1. Inisialisasi AIRich Builder
    const ai = new AIRich(conn);

    // 2. Set Header Disclaimer Atas
    ai.setTitle(`${namabot}`);

    // 3. Section Gambar Utama Banner
    ai.addSection({
      view_model: {
        primitive: {
          media: {
            url: "https://u.pone.rs/hsxuftzz.jpg",
            mime_type: "image/png",
            width: 16,
            height: 9
          },
          imagine_type: "IMAGE",
          status: { status: "READY" },
          __typename: "GenAIImaginePrimitive"
        },
        __typename: "GenAISingleLayoutViewModel"
      }
    });

    // 4. Section Profil + Centang Biru Verified Meta
    ai.addSection({
      view_model: {
        primitive: {
          __typename: "GenAICompactEntityPrimitive",
          title: "Kaze", // Nama di kartu
          subtitle: `Owner: ${namaowner}`,
          secondary_subtitle: "Ini Ownernya",
          entity_id: ownerJid,
          entity_url: `https://wa.me/${ownerJid}`,
          entity_type: "PAGE",
          action_type: "FOLLOW",
          is_verified: true, // INI YANG BIKIN CENTANG BIRU MUNCUL ✅
          image: {
            url: "https://u.pone.rs/gdhoppnv.jpg",
            url_fallback: "https://kappa.lol/oxFqGq"
          }
        },
        __typename: "GenAISingleLayoutViewModel"
      }
    });

    // 5. Section Teks Deskripsi & Footer Watermark
    ai.addFOAText(`👑 *Informasi Pemilik Bot*\n\nSilakan hubungi owner jika ada keperluan penyewaan bot, lapor bug, atau hal penting lainnya.\n\n> Owner: ${namaowner}`);
    ai.addMetadata("By lyniX's MD");

    // 6. Send dengan bypassDownload agar pesan otomatis dirender WhatsApp (tanpa warning download)
    await ai.send(m.chat, {
      quoted: m,
      bypassDownload: true
    });

  } catch (error) {
    console.error('[PLUGIN OWNER3 ERROR]', error);
    await m.react("❌");
    return m.reply("⚠️ Gagal memuat kartu profil owner.");
  }
}

export { pluginConfig as config, handler };