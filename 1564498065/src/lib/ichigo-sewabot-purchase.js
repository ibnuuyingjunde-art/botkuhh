import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";
import { createDeposit, checkDeposit } from "./ichigo-austinpay.js";
import { generateConfirmation } from "./ichigo-gemini-confirm.js";
import { formatDuration } from "./ichigo-sewa.js";

const activePolls = new Map();

const POLL_INTERVAL_MS = 5000; 
const MAX_POLL_MS = 16 * 60 * 1000; 

export function getPlans() {
  return config.sewabotPlans || [];
}

export function findPlan(code) {
  return getPlans().find((p) => p.code.toLowerCase() === String(code).toLowerCase());
}

/**
 * Mulai transaksi pembelian sewabot: bikin QRIS + mulai polling.
 * @returns {Promise<{transactionId, amount, qrString, qrImage, expiredAt, plan}>}
 */
export async function startPurchase({ sock, sender, chat, plan }) {
  const deposit = await createDeposit(plan.price);

  const db = getDatabase();
  const user = db.getUser(sender) || {};
  user.sewabotPendingTx = {
    transactionId: deposit.transactionId,
    planCode: plan.code,
    createdAt: Date.now(),
  };
  db.setUser(sender, user);

  activePolls.set(deposit.transactionId, {
    sender,
    chat,
    plan,
    startedAt: Date.now(),
  });

  pollDeposit(sock, deposit.transactionId);

  return { ...deposit, plan };
}

export function cancelPurchase(sender) {
  const db = getDatabase();
  const user = db.getUser(sender) || {};
  const pending = user.sewabotPendingTx;
  if (!pending) return false;

  const entry = activePolls.get(pending.transactionId);
  if (entry?.timer) clearTimeout(entry.timer);
  activePolls.delete(pending.transactionId);

  db.setUser(sender, { sewabotPendingTx: null });
  return true;
}

export function getPendingPurchase(sender) {
  const db = getDatabase();
  return db.getUser(sender)?.sewabotPendingTx || null;
}

function pollDeposit(sock, transactionId) {
  const entry = activePolls.get(transactionId);
  if (!entry) return;

  if (Date.now() - entry.startedAt > MAX_POLL_MS) {
    activePolls.delete(transactionId);
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

  user.sewabotPendingTx = null;
  user.pendingSewabotGroupLink = {
    waiting: true,
    plan: entry.plan,
    transactionId,
    paidAt: Date.now(),
  };
  db.setUser(entry.sender, user);

  const fallback =
    `✅ *Pembayaran diterima!*\n\n` +
    `Paket: *${entry.plan.label}* (${formatDuration(entry.plan.duration)})\n\n` +
    `Sekarang kirim *link invite grup WhatsApp* kamu (format: https://chat.whatsapp.com/xxx) ` +
    `supaya bot otomatis join ke grup itu.\n\n` +
    `Link ini hanya berlaku *sekali pakai* untuk transaksi ini.`;

  const text = await generateConfirmation(
    {
      event: "pembayaran_diterima",
      paket: entry.plan.label,
      durasi: formatDuration(entry.plan.duration),
      instruksi: "minta buyer kirim link invite grup WhatsApp untuk auto-join",
    },
    fallback,
  );

  try {
    await sock.sendMessage(entry.chat, { text });
  } catch (_) {}
}

async function notifyExpired(sock, entry) {
  try {
    await sock.sendMessage(entry.chat, {
      text:
        `⌛ QRIS untuk paket *${entry.plan.label}* sudah kedaluwarsa dan belum dibayar.\n\n` +
        `Ketik lagi perintah pembelian kalau masih mau lanjut.`,
    });
  } catch (_) {}
}
