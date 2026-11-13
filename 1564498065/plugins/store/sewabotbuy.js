import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import {
  getPlans,
  findPlan,
  startPurchase,
  cancelPurchase,
  getPendingPurchase,
} from "../../src/lib/ichigo-sewabot-purchase.js";
import { formatDuration } from "../../src/lib/ichigo-sewa.js";

const pluginConfig = {
  name: "sewabotbuy",
  alias: ["sewabot", "rentbot", "beliseewabot"],
  category: "store",
  description: "Beli sewa bot otomatis via QRIS (AustinPay), pilih durasi atau permanent",
  usage: ".sewabot\n.sewabot buy <kode>\n.sewabot status\n.sewabot cancel",
  example: ".sewabot buy 30d",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function planListText(prefix) {
  const plans = getPlans();
  if (!plans.length) {
    return "❌ Belum ada paket sewabot yang dikonfigurasi. Hubungi owner.";
  }
  const lines = plans
    .map((p) => `• *${p.code}* — ${p.label} — Rp${p.price.toLocaleString("id-ID")}`)
    .join("\n");
  return (
    `🤖 *SEWA BOT OTOMATIS*\n\n` +
    `${lines}\n\n` +
    `Cara beli:\n\`${prefix}sewabot buy <kode>\`\n` +
    `Contoh: \`${prefix}sewabot buy 30d\`\n\n` +
    `Setelah bayar via QRIS, kirim link invite grup kamu dan bot otomatis join.`
  );
}

async function handler(m, { sock }) {
  const sub = (m.args?.[0] || "").toLowerCase();

  if (sub === "status") {
    const pending = getPendingPurchase(m.sender);
    if (!pending) {
      return m.reply("📦 Tidak ada transaksi sewabot yang sedang berjalan.");
    }
    return m.reply(
      `📦 *Status Transaksi*\n\nID: ${pending.transactionId}\nPaket: ${pending.planCode}\nStatus: Menunggu pembayaran\n\nQRIS masih aktif, silakan bayar sesuai nominal yang tertera di gambar QR.`,
    );
  }

  if (sub === "cancel") {
    const ok = cancelPurchase(m.sender);
    await m.react(ok ? "✅" : "❌");
    return m.reply(
      ok
        ? "✅ Transaksi sewabot dibatalkan."
        : "❌ Tidak ada transaksi sewabot yang sedang berjalan.",
    );
  }

  if (sub === "buy") {
    const code = m.args?.[1];
    if (!code) {
      return m.reply(`❌ Format: \`${m.prefix}sewabot buy <kode>\`\n\n${planListText(m.prefix)}`);
    }

    const plan = findPlan(code);
    if (!plan) {
      return m.reply(`❌ Paket "${code}" tidak ditemukan.\n\n${planListText(m.prefix)}`);
    }

    const existingPending = getPendingPurchase(m.sender);
    if (existingPending) {
      return m.reply(
        `⏳ Kamu masih punya transaksi yang belum selesai (${existingPending.planCode}).\n\n` +
          `Ketik \`${m.prefix}sewabot cancel\` dulu kalau mau ganti paket, atau bayar QRIS sebelumnya.`,
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

      const caption =
        `🧾 *QRIS Pembayaran Sewa Bot*\n\n` +
        `Paket: *${plan.label}* (${formatDuration(plan.duration)})\n` +
        `Total bayar: *Rp${deposit.amount.toLocaleString("id-ID")}*\n` +
        `Berlaku s/d: ${new Date(deposit.expiredAt).toLocaleString("id-ID")}\n\n` +
        `Scan QR di atas untuk bayar. Setelah terbayar, bot otomatis kirim instruksi selanjutnya (kirim link grup kamu).`;

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

  return m.reply(planListText(m.prefix));
}

export { pluginConfig as config, handler };