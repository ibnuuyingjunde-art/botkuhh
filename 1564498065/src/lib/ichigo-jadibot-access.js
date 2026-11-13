import { getDatabase } from "./ichigo-database.js";
import config from "../../config.js";

// Konvensi sama seperti fitur VIP: -1 = permanen, angka = timestamp expired (ms),
// 0/undefined/null = tidak punya akses berbayar sama sekali.
const LIFETIME = -1;

function cleanJid(jid) {
  return String(jid || "")
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
}

/** "7d" / "30d" / "90d" / "lifetime" -> ms (angka) atau 'lifetime' */
export function durationToMs(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (["lifetime", "permanent", "forever", "unlimited"].includes(s)) {
    return "lifetime";
  }
  const match = s.match(/^(\d+)([dhmy])$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const multiplier = {
    h: 3600000,
    d: 86400000,
    m: 2592000000, // 30 hari
    y: 31536000000, // 365 hari
  };
  const ms = multiplier[match[2]];
  return ms ? val * ms : null;
}

export function formatDurationLabel(str) {
  if (!str) return "-";
  const s = String(str).toLowerCase();
  if (["lifetime", "permanent", "forever", "unlimited"].includes(s)) {
    return "Permanent";
  }
  const match = s.match(/^(\d+)([dhmy])$/);
  if (!match) return str;
  const units = { h: "jam", d: "hari", m: "bulan", y: "tahun" };
  return `${match[1]} ${units[match[2]] || match[2]}`;
}

/**
 * Cek apakah nomor ini boleh pakai jadibot tanpa bayar:
 * owner, partner, dan premium (isPremium sudah mencakup owner+partner+premium list).
 */
export function isJadibotExempt(jid) {
  try {
    return !!config.isPremium?.(jid);
  } catch {
    return false;
  }
}

/** Info lengkap status akses jadibot berbayar untuk satu nomor. */
export function getJadibotAccessInfo(jid) {
  const exempt = isJadibotExempt(jid);
  const db = getDatabase();
  const num = cleanJid(jid);
  const user = db.getUser(num) || db.getUser(jid) || {};
  const exp = user.jadibotAccessExpiry;
  const isLifetime = exp === LIFETIME;
  const now = Date.now();
  const paidActive = isLifetime || (typeof exp === "number" && exp > now);

  return {
    exempt,
    active: exempt || paidActive,
    isLifetime,
    expiresAt: !exempt && !isLifetime && exp ? exp : null,
  };
}

export function hasJadibotAccess(jid) {
  return getJadibotAccessInfo(jid).active;
}

/**
 * Kasih/perpanjang akses jadibot berbayar. Kalau akses lama masih aktif,
 * durasi baru ditambahkan di atasnya (bukan menimpa) — bayar lagi = nambah hari.
 */
export function grantJadibotAccess(jid, durationStr) {
  const db = getDatabase();
  const num = cleanJid(jid);
  const user = db.getUser(num) || db.setUser(num);
  const addMs = durationToMs(durationStr);

  if (addMs === null) {
    throw new Error(`Format durasi tidak valid: ${durationStr}`);
  }

  // bug fix: flag peringatan H-3/H-1 (jadibotWarned3d/jadibotWarned1h, lihat
  // startJadibotAccessChecker di manager) sebelumnya tidak pernah direset.
  // Begitu user memperpanjang, peringatan periode berikutnya tidak muncul lagi
  // karena flag lama masih true selamanya. Reset di sini setiap kali akses
  // diberikan/diperpanjang.
  if (addMs === "lifetime") {
    db.setUser(num, {
      ...user,
      jadibotAccessExpiry: LIFETIME,
      jadibotWarned3d: false,
      jadibotWarned1h: false,
    });
    db.save();
    return { expiresAt: LIFETIME, isLifetime: true };
  }

  const now = Date.now();
  const currentExp = user.jadibotAccessExpiry;
  const base =
    typeof currentExp === "number" && currentExp !== LIFETIME && currentExp > now
      ? currentExp
      : now;
  const newExpiry = base + addMs;

  db.setUser(num, {
    ...user,
    jadibotAccessExpiry: newExpiry,
    jadibotWarned3d: false,
    jadibotWarned1h: false,
  });
  db.save();
  return { expiresAt: newExpiry, isLifetime: false };
}

export function revokeJadibotAccess(jid) {
  const db = getDatabase();
  const num = cleanJid(jid);
  const user = db.getUser(num) || {};
  db.setUser(num, { ...user, jadibotAccessExpiry: 0 });
  db.save();
  return true;
}
