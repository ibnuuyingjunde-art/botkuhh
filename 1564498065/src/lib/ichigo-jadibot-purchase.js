import { getDatabase } from "./ichigo-database.js";
import { createDeposit, checkDeposit, cancelDeposit } from "./ichigo-austinpay.js";
import { getJadibotPlans, findJadibotPlan } from "./ichigo-jadibot-plans.js";
import {
  grantJadibotAccess,
  formatDurationLabel,
} from "./ichigo-jadibot-access.js";
import { logger } from "./ichigo-logger.js";

const activePolls = new Map();

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 16 * 60 * 1000;

function clearPendingTx(sender) {
  const db = getDatabase();
  const user = db.getUser(sender) || {};
  if (user.jadibotPendingTx) {
    db.setUser(sender, { ...user, jadibotPendingTx: null });
    db.save();
  }
}

export function getPlans() {
  return getJadibotPlans();
}

export function findPlan(code) {
  return findJadibotPlan(code);
}

/**
 * Mulai transaksi pembelian akses jadibot: bikin QRIS + mulai polling.
 * @returns {Promise<{transactionId, amount, qrString, qrImage, expiredAt, plan}>}
 */
export async function startPurchase({ sock, sender, chat, plan }) {
  const deposit = await createDeposit(plan.price);

  const db = getDatabase();
  const user = db.getUser(sender) || {};
  user.jadibotPendingTx = {
    transactionId: deposit.transactionId,
    planCode: plan.code,
    // bug fix: chat perlu disimpan juga (bukan cuma sender) supaya polling
    // yang di-resume setelah restart (lihat resumePendingPurchases) tahu ke
    // chat mana harus membalas, karena jadibotbuy bisa dipakai di grup.
    chat,
    createdAt: Date.now(),
  };
  db.setUser(sender, user);
  db.save();

  activePolls.set(deposit.transactionId, {
    sender,
    chat,
    plan,
    startedAt: Date.now(),
  });

  pollDeposit(sock, deposit.transactionId);

  return { ...deposit, plan };
}

/**
 * Batalkan transaksi jadibot yang masih pending.
 * bug fix: sebelumnya fungsi ini cuma menghapus state lokal (activePolls +
 * jadibotPendingTx) tanpa pernah memanggil cancelDeposit ke AustinPay, jadi
 * QRIS-nya tetap hidup di gateway. Kalau tetap dibayar setelah "dibatalkan",
 * tidak ada polling yang jalan lagi untuk memprosesnya -> user bayar tapi
 * akses tidak pernah aktif dan tidak ada notifikasi ke siapapun.
 * @param {string} sender
 * @param {object} [sock] - dipakai untuk memberi akses+notifikasi kalau
 *   ternyata transaksi sudah kepalang dibayar tepat sebelum sempat dibatalkan.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function cancelPurchase(sender, sock) {
  const db = getDatabase();
  const user = db.getUser(sender) || {};
  const pending = user.jadibotPendingTx;
  if (!pending) return { ok: false, reason: "not_found" };

  const entry = activePolls.get(pending.transactionId);
  if (entry?.timer) clearTimeout(entry.timer);
  activePolls.delete(pending.transactionId);

  try {
    await cancelDeposit(pending.transactionId);
  } catch (e) {
    // Race condition: kemungkinan sudah dibayar tepat sebelum sempat
    // dibatalkan di gateway. Jangan buang transaksinya diam-diam — cek
    // statusnya dulu, dan kalau memang sudah paid, proses seperti
    // pembayaran normal supaya user tetap dapat akses.
    try {
      const status = await checkDeposit(pending.transactionId);
      if (status.status === "paid") {
        const plan = findJadibotPlan(pending.planCode);
        db.setUser(sender, { ...user, jadibotPendingTx: null });
        db.save();
        if (plan) {
          await onPaid(
            sock,
            { sender, chat: pending.chat || sender, plan },
            pending.transactionId,
          );
        }
        return { ok: false, reason: "already_paid" };
      }
    } catch { }
    logger.error(
      "JadibotPurchase",
      `Gagal membatalkan deposit ${pending.transactionId} di AustinPay: ${e.message}`,
    );
  }

  db.setUser(sender, { ...user, jadibotPendingTx: null });
  db.save();
  return { ok: true };
}

export function getPendingPurchase(sender) {
  const db = getDatabase();
  return db.getUser(sender)?.jadibotPendingTx || null;
}

function pollDeposit(sock, transactionId) {
  const entry = activePolls.get(transactionId);
  if (!entry) return;

  if (Date.now() - entry.startedAt > MAX_POLL_MS) {
    activePolls.delete(transactionId);
    // bug fix: sebelumnya jadibotPendingTx tidak pernah dihapus di sini, jadi
    // user harus .jadibotbuy cancel dulu secara manual sebelum bisa beli lagi
    // walau transaksinya sudah jelas-jelas kedaluwarsa.
    clearPendingTx(entry.sender);
    notifyExpired(sock, entry);
    return;
  }

  entry.timer = setTimeout(async () => {
    try {
      const result = await checkDeposit(transactionId);

      if (result.status === "paid") {
        activePolls.delete(transactionId);
        await onPaid(sock, entry, transactionId);
        return;
      }

      if (result.status === "expired") {
        activePolls.delete(transactionId);
        clearPendingTx(entry.sender);
        await notifyExpired(sock, entry);
        return;
      }

      pollDeposit(sock, transactionId);
    } catch (e) {
      pollDeposit(sock, transactionId);
    }
  }, POLL_INTERVAL_MS);
}

async function onPaid(sock, entry, transactionId) {
  const db = getDatabase();
  const user = db.getUser(entry.sender) || {};
  user.jadibotPendingTx = null;
  db.setUser(entry.sender, user);
  db.save();

  let grantResult;
  try {
    grantResult = grantJadibotAccess(entry.sender, entry.plan.duration);
  } catch (e) {
    logger.error("JadibotPurchase", `Gagal grant akses: ${e.message}`);
    try {
      await sock.sendMessage(entry.chat, {
        text:
          `⚠️ Pembayaran diterima tapi gagal mengaktifkan akses otomatis (${e.message}).\n` +
          `Hubungi owner dengan menyertakan ID transaksi: ${transactionId}`,
      });
    } catch { }
    return;
  }

  const expiryText = grantResult.isLifetime
    ? "Permanent (selamanya)"
    : new Date(grantResult.expiresAt).toLocaleString("id-ID");

  try {
    await sock.sendMessage(entry.chat, {
      text:
        `✅ *Pembayaran diterima!*\n\n` +
        `> Paket: *${entry.plan.label}* (${formatDurationLabel(entry.plan.duration)})\n` +
        `> Akses jadibot aktif sampai: *${expiryText}*\n\n` +
        `Sekarang kamu bisa ketik \`.jadibot\` untuk mengaktifkan bot di nomor kamu.`,
    });
  } catch { }
}

/**
 * Lanjutkan polling semua transaksi jadibot yang masih pending saat bot
 * terakhir mati. bug fix: sebelumnya polling cuma hidup di memori
 * (activePolls), jadi begitu bot restart transaksi yang tersimpan di
 * jadibotPendingTx tidak ada yang melanjutkan cek statusnya — user yang bayar
 * setelah restart tidak dapat akses otomatis dan harus di-.jadibotplan grant
 * manual. Dipanggil sekali saat bot utama konek (connection === "open").
 * @param {object} sock
 */
export function resumePendingPurchases(sock) {
  const db = getDatabase();
  const users = db.getAllUsers();
  let resumed = 0;

  for (const [num, user] of Object.entries(users)) {
    const pending = user?.jadibotPendingTx;
    if (!pending?.transactionId) continue;

    const sender = `${num}@s.whatsapp.net`;

    // Sudah pasti kedaluwarsa sebelum bot sempat nyala lagi -> bersihkan saja,
    // tidak perlu notifikasi (tidak ada gunanya, ini baru startup).
    if (Date.now() - (pending.createdAt || 0) > MAX_POLL_MS) {
      db.setUser(sender, { ...user, jadibotPendingTx: null });
      db.save();
      continue;
    }

    const plan = findJadibotPlan(pending.planCode);
    if (!plan) {
      logger.warn(
        "JadibotPurchase",
        `Paket "${pending.planCode}" untuk transaksi tertunda ${pending.transactionId} sudah tidak ada, transaksi dibersihkan`,
      );
      db.setUser(sender, { ...user, jadibotPendingTx: null });
      db.save();
      continue;
    }

    activePolls.set(pending.transactionId, {
      sender,
      chat: pending.chat || sender,
      plan,
      startedAt: pending.createdAt,
    });
    pollDeposit(sock, pending.transactionId);
    resumed++;
  }

  if (resumed > 0) {
    logger.info(
      "JadibotPurchase",
      `Melanjutkan polling ${resumed} transaksi jadibot yang masih pending`,
    );
  }
}

async function notifyExpired(sock, entry) {
  try {
    await sock.sendMessage(entry.chat, {
      text:
        `⌛ QRIS untuk paket *${entry.plan.label}* sudah kedaluwarsa dan belum dibayar.\n\n` +
        `Ketik lagi perintah pembelian kalau masih mau lanjut.`,
    });
  } catch { }
}
