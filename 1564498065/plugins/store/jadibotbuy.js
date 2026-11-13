import {
  getPlans,
  findPlan,
  startPurchase,
  cancelPurchase,
  getPendingPurchase,
} from "../../src/lib/ichigo-jadibot-purchase.js";
import {
  getJadibotAccessInfo,
  formatDurationLabel,
} from "../../src/lib/ichigo-jadibot-access.js";
import { isJadibotPaymentEnforced } from "../../src/lib/ichigo-jadibot-plans.js";

const pluginConfig = {
  name: "jadibotbuy",
  alias: ["belijadibot", "jadibotplans"],
  category: "store",
  description: "Beli akses jadibot berbayar via QRIS, pilih durasi",
  usage: ".jadibotbuy\n.jadibotbuy beli <kode>\n.jadibotbuy status\n.jadibotbuy cancel",
  example: ".jadibotbuy beli 30d",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function planListText(prefix, sender) {
  const plans = getPlans();
  const info = getJadibotAccessInfo(sender);

  let header;
  if (info.exempt) {
    header = `✅ Kamu owner/partner/premium — jadibot *gratis*, tidak perlu bayar.\n\n`;
  } else if (info.isLifetime) {
    header = `✅ Akses jadibot kamu aktif *permanent*.\n\n`;
  } else if (info.expiresAt) {
    header = `✅ Akses jadibot kamu aktif sampai *${new Date(info.expiresAt).toLocaleString("id-ID")}*.\n\n`;
  } else {
    header = `❌ Kamu belum punya akses jadibot berbayar.\n\n`;
  }

  if (!plans.length) {
    return header + "Belum ada paket jadibot yang dikonfigurasi. Hubungi owner.";
  }

  const lines = plans
    .map(
      (p) =>
        `• *${p.code}* — ${p.label} (${formatDurationLabel(p.duration)}) — Rp${Number(p.price).toLocaleString("id-ID")}`,
    )
    .join("\n");

  return (
    header +
    `🤖 *PAKET JADIBOT*\n\n${lines}\n\n` +
    `Cara beli:\n\`${prefix}jadibotbuy beli <kode>\`\n` +
    `Contoh: \`${prefix}jadibotbuy beli 30d\`\n\n` +
    `Setelah bayar via QRIS, akses langsung aktif dan kamu bisa ketik \`${prefix}jadibot\`.`
  );
}

async function handler(m, { sock }) {
  const sub = (m.args?.[0] || "").toLowerCase();

  // bug fix: status/cancel harus selalu bisa dipakai untuk transaksi yang
  // sudah terlanjur jalan, walau owner baru saja mematikan saklar bayar atau
  // menghapus semua paket — supaya user tidak terjebak dengan transaksi
  // menggantung yang tidak bisa dicek/dibatalkan.
  if (sub === "status") {
    const pending = getPendingPurchase(m.sender);
    if (!pending) {
      return m.reply(planListText(m.prefix, m.sender));
    }
    return m.reply(
      `📦 *Status Transaksi*\n\nID: ${pending.transactionId}\nPaket: ${pending.planCode}\nStatus: Menunggu pembayaran\n\nQRIS masih aktif, silakan bayar sesuai nominal yang tertera di gambar QR.`,
    );
  }

  if (sub === "cancel") {
    const result = await cancelPurchase(m.sender, sock);
    if (result.reason === "already_paid") {
      await m.react("✅");
      return m.reply(
        "✅ Transaksi ternyata sudah kepalang dibayar sebelum sempat dibatalkan — akses jadibot kamu sudah otomatis aktif.",
      );
    }
    await m.react(result.ok ? "✅" : "❌");
    return m.reply(
      result.ok
        ? "✅ Transaksi jadibot dibatalkan."
        : "❌ Tidak ada transaksi jadibot yang sedang berjalan.",
    );
  }

  if (!isJadibotPaymentEnforced()) {
    return m.reply(
      `ℹ️ Jadibot sedang *gratis* untuk semua orang (fitur bayar sedang dimatikan/belum diatur owner).\n\n` +
        `Ketik \`${m.prefix}jadibot\` langsung untuk mengaktifkan.`,
    );
  }

  if (sub === "beli" || sub === "buy") {
    const info = getJadibotAccessInfo(m.sender);
    if (info.exempt) {
      return m.reply(
        `ℹ️ Kamu owner/partner/premium — jadibot sudah *gratis* buat kamu, tidak perlu beli paket apapun.\n\n` +
          `Langsung saja ketik \`${m.prefix}jadibot\`.`,
      );
    }

    const code = m.args?.[1];
    if (!code) {
      return m.reply(`❌ Format: \`${m.prefix}jadibotbuy beli <kode>\`\n\n${planListText(m.prefix, m.sender)}`);
    }

    const plan = findPlan(code);
    if (!plan) {
      return m.reply(`❌ Paket "${code}" tidak ditemukan.\n\n${planListText(m.prefix, m.sender)}`);
    }

    const existingPending = getPendingPurchase(m.sender);
    if (existingPending) {
      return m.reply(
        `⏳ Kamu masih punya transaksi yang belum selesai (${existingPending.planCode}).\n\n` +
          `Ketik \`${m.prefix}jadibotbuy cancel\` dulu kalau mau ganti paket, atau bayar QRIS sebelumnya.`,
      );
    }

    await m.react("🕕");
    try {
      const deposit = await startPurchase({
        sock,
        sender: m.sender,
        chat: m.chat,
        plan,
      });

      const stackNote =
        info.expiresAt && !info.isLifetime
          ? `\nSisa akses kamu sekarang (${new Date(info.expiresAt).toLocaleString("id-ID")}) akan *ditambah* durasi paket ini, bukan ditimpa.\n`
          : "";

      const caption =
        `🧾 *QRIS Pembayaran Jadibot*\n\n` +
        `Paket: *${plan.label}* (${formatDurationLabel(plan.duration)})\n` +
        `Total bayar: *Rp${deposit.amount.toLocaleString("id-ID")}*\n` +
        `Berlaku s/d: ${new Date(deposit.expiredAt).toLocaleString("id-ID")}\n` +
        stackNote +
        `\nScan QR di atas untuk bayar. Setelah terbayar, akses jadibot otomatis aktif dan kamu tinggal ketik \`${m.prefix}jadibot\`.`;

      if (String(deposit.qrImage || "").startsWith("data:")) {
        const base64Data = deposit.qrImage.split(",")[1];
        await sock.sendMessage(m.chat, {
          image: Buffer.from(base64Data, "base64"),
          caption,
        });
      } else if (deposit.qrImage) {
        await sock.sendMessage(m.chat, { image: { url: deposit.qrImage }, caption });
      } else {
        await m.reply(caption);
      }

      await m.react("✅");
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ Gagal membuat QRIS: ${e.message}`);
    }
    return;
  }

  return m.reply(planListText(m.prefix, m.sender));
}

export { pluginConfig as config, handler };
