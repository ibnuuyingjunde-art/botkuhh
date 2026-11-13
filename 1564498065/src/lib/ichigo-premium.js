import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function normalizeNumber(value) {
  let number = String(value || "").replace(/[^0-9]/g, "");
  if (number.startsWith("0")) number = "62" + number.slice(1);
  return number;
}

export function isValidNumber(number) {
  return !!number && number.length >= 10 && number.length <= 15;
}

/**
 * Fungsi inti nambahin/perpanjang premium user — cuma soal DURASI SUDAH DALAM ms,
 * jadi caller (plugin command atau internal API) bebas pakai format durasi masing-masing
 * lalu convert ke ms/isLifetime sebelum manggil ini.
 *
 * Dipakai oleh plugin command (addprem.js) MAUPUN internal API (api-internal.js)
 * supaya logic mutasi DB-nya cuma ada di satu tempat — sama kayak pola addSewaGroup
 * di ichigo-sewa.js.
 *
 * @param {object} opts
 * @param {string} opts.number - nomor WA target (boleh 08xx atau 62xx, akan dinormalisasi)
 * @param {number} [opts.durationMs] - lama premium dalam ms (diabaikan kalau isLifetime true)
 * @param {boolean} [opts.isLifetime=false] - premium permanent atau tidak
 * @param {string} [opts.name="Unknown"] - nama yang disimpan buat catatan
 * @param {string} [opts.addedBy] - identitas yang menambahkan (sender jid / "system-ichigostore")
 */
export async function applyPremium({ number, durationMs, isLifetime = false, name = "Unknown", addedBy }) {
  const targetNumber = normalizeNumber(number);
  if (!isValidNumber(targetNumber)) {
    throw new Error("Format nomor tidak valid");
  }
  if (!isLifetime && (!durationMs || durationMs <= 0)) {
    throw new Error("Durasi tidak valid");
  }

  const db = getDatabase();
  if (!db.data.premium) db.data.premium = [];

  const existingIndex = db.data.premium.findIndex((p) =>
    typeof p === "string" ? p === targetNumber : p.id === targetNumber,
  );

  const now = Date.now();
  let newExpired = 0;

  if (existingIndex !== -1) {
    const currentData = db.data.premium[existingIndex];
    const currentExpired =
      typeof currentData === "string" ? now : currentData.expired || now;
    const baseTime = currentExpired > now ? currentExpired : now;
    newExpired = isLifetime ? 0 : baseTime + durationMs;

    db.data.premium[existingIndex] = {
      id: targetNumber,
      expired: newExpired,
      isLifetime,
      name,
      addedAt: typeof currentData === "object" ? currentData.addedAt || now : now,
      addedBy: addedBy || (typeof currentData === "object" ? currentData.addedBy : undefined),
    };
  } else {
    newExpired = isLifetime ? 0 : now + durationMs;
    db.data.premium.push({
      id: targetNumber,
      expired: newExpired,
      isLifetime,
      name,
      addedAt: now,
      addedBy,
    });
  }

  const jid = targetNumber + "@s.whatsapp.net";
  const user = db.getUser(jid) || db.setUser(jid);

  if (user.energi !== -1) {
    user.energi = config.energi?.premium || 999999;
  }
  user.isPremium = true;

  db.setUser(jid, user);
  db.updateExp(jid, 200000);
  db.updateKoin(jid, 20000);

  db.save();

  return {
    number: targetNumber,
    isNew: existingIndex === -1,
    isLifetime,
    expiredAt: isLifetime ? null : newExpired,
    expiredLabel: isLifetime ? "Permanent" : formatDate(newExpired),
  };
}

export async function removePremiumUser({ number }) {
  const targetNumber = normalizeNumber(number);
  const db = getDatabase();
  if (!db.data.premium) db.data.premium = [];

  const index = db.data.premium.findIndex((p) =>
    typeof p === "string" ? p === targetNumber : p.id === targetNumber,
  );
  if (index === -1) {
    throw new Error(`${targetNumber} bukan premium`);
  }

  db.data.premium.splice(index, 1);

  const jid = targetNumber + "@s.whatsapp.net";
  const user = db.getUser(jid);
  if (user) {
    user.isPremium = false;
    db.setUser(jid, user);
  }

  db.save();
  return { number: targetNumber };
}
