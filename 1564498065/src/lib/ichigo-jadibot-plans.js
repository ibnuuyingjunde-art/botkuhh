import { getDatabase } from "./ichigo-database.js";
import config from "../../config.js";
import { durationToMs } from "./ichigo-jadibot-access.js";

// Paket default kalau owner belum pernah setting apa-apa lewat command.
// Bisa diubah lewat plugin owner/jadibotplan.js tanpa perlu edit file/restart.
const FALLBACK_PLANS = [
  { code: "7d", label: "Jadibot 7 Hari", price: 5000, duration: "7d" },
  { code: "30d", label: "Jadibot 30 Hari", price: 15000, duration: "30d" },
];

function normalizePlans(plans) {
  if (!Array.isArray(plans)) return [];
  return plans.filter(
    (p) =>
      p &&
      typeof p.code === "string" &&
      typeof p.duration === "string" &&
      Number.isFinite(Number(p.price)),
  );
}

/** Ambil daftar paket aktif: prioritas setting runtime > config.js > fallback bawaan. */
export function getJadibotPlans() {
  const db = getDatabase();
  const custom = normalizePlans(db.setting("jadibotPlans"));
  if (custom.length) return custom;

  const fromConfig = normalizePlans(config.jadibotPlans);
  if (fromConfig.length) return fromConfig;

  return FALLBACK_PLANS;
}

export function findJadibotPlan(code) {
  if (!code) return null;
  return (
    getJadibotPlans().find(
      (p) => p.code.toLowerCase() === String(code).toLowerCase(),
    ) || null
  );
}

export function saveJadibotPlans(plans) {
  const db = getDatabase();
  db.setting("jadibotPlans", normalizePlans(plans));
  db.save();
}

/** Tambah paket baru atau update kalau code-nya sudah ada. */
export function upsertJadibotPlan({ code, label, price, duration }) {
  if (!code || !duration || !Number.isFinite(Number(price))) {
    throw new Error("code, duration, dan price wajib diisi dengan benar");
  }
  // bug fix: validasi format durasi SEKARANG (saat owner bikin paket), bukan
  // nanti setelah pembeli sudah terlanjur bayar dan grantJadibotAccess gagal.
  if (durationToMs(duration) === null) {
    throw new Error(
      `Format durasi "${duration}" tidak valid. Pakai contoh: 7d, 12h, 3m, 1y, atau lifetime`,
    );
  }
  const plans = getJadibotPlans().slice();
  const idx = plans.findIndex(
    (p) => p.code.toLowerCase() === String(code).toLowerCase(),
  );
  const plan = {
    code: String(code).toLowerCase(),
    label: label || `Jadibot ${duration}`,
    price: Number(price),
    duration: String(duration).toLowerCase(),
  };
  if (idx !== -1) plans[idx] = plan;
  else plans.push(plan);
  saveJadibotPlans(plans);
  return plan;
}

export function removeJadibotPlan(code) {
  const plans = getJadibotPlans();
  const filtered = plans.filter(
    (p) => p.code.toLowerCase() !== String(code).toLowerCase(),
  );
  if (filtered.length === plans.length) return false;
  saveJadibotPlans(filtered);
  return true;
}

/** Saklar utama: kalau off, jadibot gratis untuk semua (perilaku lama). Default ON. */
export function isJadibotPaymentEnabled() {
  const db = getDatabase();
  const v = db.setting("jadibotPaymentEnabled");
  return v === undefined ? true : !!v;
}

export function setJadibotPaymentEnabled(enabled) {
  const db = getDatabase();
  db.setting("jadibotPaymentEnabled", !!enabled);
  db.save();
}

/**
 * Apakah paywall benar-benar harus ditegakkan sekarang.
 * bug fix: kalau saklar ON tapi belum ada satupun paket dikonfigurasi (mis. owner
 * belum sempat set harga), jadibot akan gagal total tanpa jalan keluar bagi siapapun.
 * Jadi enforcement hanya jalan kalau saklar ON *dan* minimal ada 1 paket tersedia.
 */
export function isJadibotPaymentEnforced() {
  return isJadibotPaymentEnabled() && getJadibotPlans().length > 0;
}
