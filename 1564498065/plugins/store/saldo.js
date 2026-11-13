/**
 * saldo.js — Cek saldo & riwayat belanja
 */

import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name:        "saldo",
  alias:       ["balance", "dompet", "wallet"],
  category:    "store",
  description: "Cek saldo & riwayat belanja",
  usage:       ".saldo\n.saldo riwayat",
  example:     ".saldo",
  isOwner:     false,
  isPremium:   false,
  isGroup:     false,
  isPrivate:   false,
  cooldown:    5,
  energi:      0,
  isEnabled:   true,
};

function formatRp(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function formatTgl(ts) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function handler(m) {
  const db   = getDatabase();
  const text = m.text?.trim().toLowerCase();
  const user = db.getUser(m.sender) || db.setUser(m.sender);
  const saldo = user.saldo ?? 0;

  if (text === "riwayat" || text === "history") {
    const allRiwayat   = db.setting("beliRiwayat") || {};
    const depositRiw   = db.setting("depositRiwayat") || {};
    const beliList     = allRiwayat[m.sender]   || [];
    const depositList  = depositRiw[m.sender]   || [];

    if (beliList.length === 0 && depositList.length === 0) {
      return m.reply(
        `📋 Belum ada riwayat transaksi.\n\n` +
        `> *.deposit <nominal>* — isi saldo\n` +
        `> *.beli <produk>* — belanja pakai saldo`
      );
    }

    let txt = `📋 *RIWAYAT TRANSAKSI*\n\n`;

    if (depositList.length > 0) {
      txt += `💰 *Deposit:*\n`;
      depositList.slice(0, 5).forEach((r) => {
        txt += `  + ${formatRp(r.amount)} — ${formatTgl(r.paidAt)}\n`;
      });
      txt += `\n`;
    }

    if (beliList.length > 0) {
      txt += `🛒 *Pembelian:*\n`;
      beliList.slice(0, 5).forEach((r) => {
        txt += `  - ${formatRp(r.harga)} → ${r.produkNama} — ${formatTgl(r.buyAt)}\n`;
      });
    }

    txt += `\n> 💳 Saldo sekarang: *${formatRp(saldo)}*`;
    return m.reply(txt);
  }

  const pending = user.pendingDeposit;
  let pendingTxt = "";
  if (pending && Date.now() < pending.expiredAt) {
    pendingTxt = `\n> ⏳ Ada deposit pending: *${formatRp(pending.amount)}*`;
  }

  return m.reply(
    `💳 *DOMPET KAMU*\n\n` +
    `╭─「 💰 Saldo 」\n` +
    `│ Saldo : *${formatRp(saldo)}*\n` +
    `│ User  : ${m.pushName || m.sender.split("@")[0]}\n` +
    `╰──\n\n` +
    `> *.deposit <nominal>* — isi saldo via QRIS\n` +
    `> *.beli <produk>* — belanja pakai saldo\n` +
    `> *.saldo riwayat* — lihat riwayat transaksi` +
    pendingTxt
  );
}

export { pluginConfig as config, handler };