/**
 * deposit.js — Deposit saldo via Yusuf Payment QRIS
 * Flow: user ketik .deposit <nominal> → dapat QRIS → bayar → saldo otomatis masuk
 * API: https://yusufpayment.com
 */

import axios from "axios";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import config from "../../config.js";

const YUSUF_BASE   = "https://yusufpayment.com";
const YUSUF_APIKEY = config.yusufPayment?.apiKey || process.env.YUSUF_PAYMENT_KEY || "dp_504e0f47da386817553bc354";

const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 1_000_000;

const POLL_INTERVAL = 8_000;  
const POLL_MAX      = 15;     

const pluginConfig = {
  name:        "deposit",
  alias:       ["topup", "isi", "isaldo"],
  category:    "store",
  description: "Deposit saldo via QRIS Yusuf Payment (otomatis terkonfirmasi)",
  usage:       ".deposit <nominal>\n.deposit riwayat",
  example:     ".deposit 10000",
  isOwner:     false,
  isPremium:   false,
  isGroup:     false,
  isPrivate:   false,
  cooldown:    30,
  energi:      0,
  isEnabled:   true,
};

function formatRp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function formatTgl(ts) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function createDeposit(amount) {
  const res = await axios.post(
    `${YUSUF_BASE}/api/deposit/create`,
    { amount },
    { headers: { "Content-Type": "application/json", "x-api-key": YUSUF_APIKEY }, timeout: 15_000 }
  );
  
  return res.data?.deposit || res.data;
}

async function checkDeposit(deposit_id) {
  const res = await axios.post(
    `${YUSUF_BASE}/api/deposit/status`,
    { deposit_id },
    { headers: { "Content-Type": "application/json", "x-api-key": YUSUF_APIKEY }, timeout: 10_000 }
  );
  
  return res.data?.deposit || res.data;
}

async function cancelDeposit(deposit_id) {
  const res = await axios.post(
    `${YUSUF_BASE}/api/deposit/cancel`,
    { deposit_id },
    { headers: { "Content-Type": "application/json", "x-api-key": YUSUF_APIKEY }, timeout: 10_000 }
  );
  return res.data?.deposit || res.data;
}

const activePolls = new Map(); 

async function startPolling(sock, senderJid, chatJid, deposit_id, amount, quotedKey) {
  if (activePolls.has(senderJid)) return; 

  let count = 0;
  const db = getDatabase();

  const timer = setInterval(async () => {
    count++;
    try {
      const result = await checkDeposit(deposit_id);
      const status = result?.status?.toLowerCase();

      if (status === "paid" || status === "success") {
        clearInterval(timer);
        activePolls.delete(senderJid);

        const user = db.getUser(senderJid) || db.setUser(senderJid);
        const saldoBefore = user.saldo ?? 0;
        db.updateSaldo(senderJid, amount);
        const saldoAfter = db.getUser(senderJid)?.saldo ?? 0;

        const riwayat = db.setting("depositRiwayat") || {};
        if (!riwayat[senderJid]) riwayat[senderJid] = [];
        riwayat[senderJid].unshift({
          deposit_id,
          amount,
          saldoBefore,
          saldoAfter,
          paidAt: Date.now(),
          method: "QRIS",
        });
        if (riwayat[senderJid].length > 20) riwayat[senderJid] = riwayat[senderJid].slice(0, 20);
        db.setting("depositRiwayat", riwayat);

        db.setUser(senderJid, { pendingDeposit: null });
        await db.save();

        await sock.sendMessage(chatJid, {
          text:
            `✅ *DEPOSIT BERHASIL!*\n\n` +
            `╭─「 💰 Detail 」\n` +
            `│ Nominal  : *${formatRp(amount)}*\n` +
            `│ Saldo    : *${formatRp(saldoBefore)}* → *${formatRp(saldoAfter)}*\n` +
            `│ Metode   : QRIS Yusuf Payment\n` +
            `│ Waktu    : ${formatTgl(Date.now())}\n` +
            `╰──\n\n` +
            `> Saldo kamu sudah bertambah! Ketik *.saldo* untuk cek.\n` +
            `> Gunakan *.beli* untuk berbelanja 🛒`,
        });

        const ownerNum = Array.isArray(config.owner?.number)
          ? String(config.owner.number[0]).replace(/[^0-9]/g, "")
          : String(config.owner?.number || "").replace(/[^0-9]/g, "");
        if (ownerNum) {
          await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, {
            text:
              `💰 *DEPOSIT MASUK*\n\n` +
              `👤 User   : ${senderJid.split("@")[0]}\n` +
              `💵 Nominal: ${formatRp(amount)}\n` +
              `💳 Metode : QRIS Yusuf Payment\n` +
              `📅 Waktu  : ${formatTgl(Date.now())}`,
          }).catch(() => {});
        }

      } else if (status === "expired" || status === "cancelled" || count >= POLL_MAX) {
        clearInterval(timer);
        activePolls.delete(senderJid);

        db.setUser(senderJid, { pendingDeposit: null });
        await db.save();

        if (count >= POLL_MAX && status !== "expired") {
          await sock.sendMessage(chatJid, {
            text:
              `⏰ *Waktu konfirmasi habis!*\n\n` +
              `Deposit *${formatRp(amount)}* tidak terkonfirmasi dalam 2 menit.\n\n` +
              `> Jika sudah bayar, hubungi owner untuk konfirmasi manual.\n` +
              `> ID: \`${deposit_id}\``,
          });
        } else {
          await sock.sendMessage(chatJid, {
            text:
              `❌ *Deposit Kadaluarsa / Dibatalkan*\n\n` +
              `Deposit *${formatRp(amount)}* sudah tidak bisa diproses.\n` +
              `Buat deposit baru dengan *.deposit ${amount}*`,
          });
        }
      }
      
    } catch (e) {
      
      console.error("[deposit poll] error:", e.message);
    }
  }, POLL_INTERVAL);

  activePolls.set(senderJid, timer);
}

async function handler(m, { sock }) {
  const db   = getDatabase();
  const text = m.text?.trim().toLowerCase();

  if (text === "riwayat") {
    const riwayat = db.setting("depositRiwayat") || {};
    const list    = riwayat[m.sender] || [];

    if (list.length === 0) {
      return m.reply(`📋 Belum ada riwayat deposit.\n\nGunakan *.deposit <nominal>* untuk deposit pertamamu!`);
    }

    let txt = `📋 *RIWAYAT DEPOSIT*\n\n`;
    list.slice(0, 10).forEach((r, i) => {
      txt += `${i + 1}. *${formatRp(r.amount)}* — ${formatTgl(r.paidAt)}\n`;
      txt += `   └ Saldo: ${formatRp(r.saldoBefore)} → ${formatRp(r.saldoAfter)}\n`;
    });
    txt += `\n> Saldo saat ini: *${formatRp(db.getUser(m.sender)?.saldo ?? 0)}*`;
    return m.reply(txt);
  }

  const user = db.getUser(m.sender) || db.setUser(m.sender);

  if (text === "batal" || text === "cancel") {
    const pd = user.pendingDeposit;
    if (!pd) return m.reply(`❌ Tidak ada deposit aktif untuk dibatalkan.`);
    try {
      await cancelDeposit(pd.deposit_id);
    } catch {}
    if (activePolls.has(m.sender)) {
      clearInterval(activePolls.get(m.sender));
      activePolls.delete(m.sender);
    }
    db.setUser(m.sender, { pendingDeposit: null });
    await db.save();
    return m.reply(`✅ Deposit *${formatRp(pd.amount)}* berhasil dibatalkan.`);
  }

  if (user.pendingDeposit) {
    const pd = user.pendingDeposit;
    if (Date.now() < pd.expiredAt) {
      return m.reply(
        `⏳ *Kamu masih punya deposit aktif!*\n\n` +
        `╭─「 Detail 」\n` +
        `│ Nominal : *${formatRp(pd.amount)}*\n` +
        `│ ID      : \`${pd.deposit_id}\`\n` +
        `│ Expired : ${formatTgl(pd.expiredAt)}\n` +
        `╰──\n\n` +
        `> Selesaikan pembayaran QRIS atau tunggu expired.\n` +
        `> Ketik *.deposit batal* untuk batalkan.`
      );
    }
    
    db.setUser(m.sender, { pendingDeposit: null });
    await db.save();
  }

  const amount = parseInt(m.text?.trim().replace(/[^0-9]/g, ""));
  if (isNaN(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    return m.reply(
      `💳 *DEPOSIT SALDO*\n\n` +
      `Topup saldo untuk berbelanja di toko bot.\n\n` +
      `*Cara pakai:*\n` +
      `> \`.deposit <nominal>\`\n` +
      `> Contoh: \`.deposit 10000\`\n\n` +
      `*Ketentuan:*\n` +
      `│ Min : *${formatRp(MIN_DEPOSIT)}*\n` +
      `│ Max : *${formatRp(MAX_DEPOSIT)}*\n` +
      `│ Metode: QRIS (auto konfirmasi)\n\n` +
      `> Saldo kamu: *${formatRp(user.saldo ?? 0)}*\n` +
      `> Riwayat: \`.deposit riwayat\``
    );
  }

  m.react("⏳");

  try {
    
    const invoice = await createDeposit(amount);

    if (!invoice?.id) {
      throw new Error("Gagal membuat invoice — response tidak valid");
    }

    const deposit_id = invoice.id;
    
    const expiredAt  = invoice.expired_at
      ? (typeof invoice.expired_at === "number" ? invoice.expired_at : new Date(invoice.expired_at).getTime())
      : Date.now() + 5 * 60 * 1000;

    db.setUser(m.sender, {
      pendingDeposit: { deposit_id, amount, expiredAt, createdAt: Date.now() },
    });
    await db.save();

    const qrisImageUrl = invoice.qr_image || invoice.qris_url || invoice.qr_url || invoice.image_url || null;

    const fee          = invoice.fee ?? 0;
    const totalPayment = invoice.total_payment ?? (amount + fee);

    const caption =
      `💳 *INVOICE DEPOSIT*\n\n` +
      `╭─「 📋 Detail 」\n` +
      `│ Nominal   : *${formatRp(amount)}*\n` +
      `│ Biaya     : *${formatRp(fee)}*\n` +
      `│ Total Bayar: *${formatRp(totalPayment)}*\n` +
      `│ ID        : \`${deposit_id}\`\n` +
      `│ Expired   : ${formatTgl(expiredAt)}\n` +
      `╰──\n\n` +
      `📱 Scan QRIS di atas dan bayar *sesuai Total Bayar* (bukan nominal saja).\n\n` +
      `> Bot akan otomatis konfirmasi setelah pembayaran.\n` +
      `> Jangan tutup chat ini selama proses pembayaran.`;

    if (qrisImageUrl) {
      await sock.sendMessage(m.chat, { image: { url: qrisImageUrl }, caption }, { quoted: m });
    } else {
      
      await m.reply(caption + `\n\n⚠️ Gambar QRIS tidak tersedia, hubungi owner.`);
    }

    m.react("✅");

    startPolling(sock, m.sender, m.chat, deposit_id, amount);

  } catch (e) {
    console.error("[deposit] error:", e.message, e.response?.data);
    m.react("❌");
    m.reply(
      `❌ *Gagal membuat deposit!*\n\n` +
      `Error: ${e.response?.data?.message || e.message}\n\n` +
      `Coba lagi atau hubungi owner.`
    );
  }
}

export { pluginConfig as config, handler };