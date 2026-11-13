import { getDatabase } from "../../src/lib/ichigo-database.js";
import config from "../../config.js";

const pluginConfig = {
  name: "produkcard",
  alias: ["katalogcard", "showproduk"],
  category: "store",
  description: "🛍️ Tampilkan produk sebagai kartu native WhatsApp (productMessage) lengkap dengan tombol beli",
  usage: ".produkcard <nomor> | .produkcard all",
  example: ".produkcard 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatPrice(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

async function sendProductCard(sock, jid, quoted, product, index, prefix) {
  const storeUrl = config.website || "https://ichigostore.my.id";
  const typeLabel = (product.type || "digital") === "digital" ? "🔑 Digital" : "📦 Fisik";

  const stockOk =
    product.type === "digital"
      ? product.stockItems?.length > 0 || product.stock === -1
      : product.stock > 0 || product.stock === -1;

  const body =
    `${typeLabel}\n` +
    (product.description ? `${product.description}\n\n` : "\n") +
    (stockOk ? "✅ Stok tersedia" : "❌ Stok habis");

  const messagePayload = {
    productMessage: {
      title: product.name,
      description: product.description || product.name,
      productId: product.id,
      retailerId: "ichigo-store",
      url: storeUrl,
      priceAmount1000: product.price,
      currencyCode: "IDR",
      body,
      footer: config.bot?.name || "Ichigo Store",
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🛒 Beli Sekarang",
            id: `${prefix}beli ${index}`,
          }),
        },
      ],
    },
  };

  if (product.image) {
    messagePayload.productMessage.thumbnail = { url: product.image };
  }

  await sock.sendMessage(jid, messagePayload, { quoted });
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const products = db.setting("storeProducts") || [];

  if (products.length === 0) {
    return m.reply(
      `🏪 *Produk Belum Tersedia*\n\nBelum ada produk yang ditambahkan admin 😔`,
    );
  }

  const arg = m.args[0]?.toLowerCase();

  if (!arg || arg === "all") {
    await m.react("🕐");
    for (let i = 0; i < products.length; i++) {
      try {
        await sendProductCard(sock, m.chat, m, products[i], i + 1, m.prefix);
      } catch (e) {
        console.error(`[ProdukCard] Gagal kirim produk #${i + 1}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    await m.react("✅");
    return;
  }

  const index = parseInt(arg);
  if (isNaN(index) || index < 1 || index > products.length) {
    return m.reply(
      `❌ Nomor produk tidak valid.\n\n` +
        `Gunakan \`${m.prefix}listproduk\` buat lihat nomor produk, lalu:\n` +
        `\`${m.prefix}produkcard <nomor>\``,
    );
  }

  const product = products[index - 1];
  await m.react("🕐");

  try {
    await sendProductCard(sock, m.chat, m, product, index, m.prefix);
    await m.react("✅");
  } catch (e) {
    await m.react("❌");
    await m.reply(`❌ Gagal kirim kartu produk.\n\nAlasan: ${e.message}`);
  }
}

export { pluginConfig as config, handler };