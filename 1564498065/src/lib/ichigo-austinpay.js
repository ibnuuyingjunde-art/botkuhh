import axios from "axios";
import config from "../../config.js";

const BASE_URL = config.austinpay?.baseUrl || "https://austinstore.id";
const API_KEY = config.austinpay?.apiKey || "";

function client() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    // bug fix: sama seperti kasus Dongtube — jangan biarkan axios langsung
    // throw generic "Request failed with status code 4xx" tanpa pesan asli
    // dari AustinPay (biasanya ada field "message" yang menjelaskan sebabnya,
    // mis. amount di luar batas, IP belum di-whitelist, dll).
    validateStatus: () => true,
  });
}

function extractErrorMessage(status, data, fallback) {
  if (data && typeof data === "object") {
    if (data.message) return `${data.message} (HTTP ${status})`;
    if (data.error) return `${data.error} (HTTP ${status})`;
  }
  if (typeof data === "string" && data.trim()) {
    return `${data.trim().slice(0, 200)} (HTTP ${status})`;
  }
  return `${fallback} (HTTP ${status})`;
}

/** Info akun + saldo wallet AustinPay. */
export async function getAccount() {
  if (!API_KEY) throw new Error("austinpay.apiKey belum diisi di config.js");
  const { status, data } = await client().get("/api/account");
  if (status !== 200 || !data?.success) {
    throw new Error(extractErrorMessage(status, data, "Gagal mengambil info akun AustinPay"));
  }
  return data.user;
}

export async function getBalance() {
  const user = await getAccount();
  return user?.wallet?.balance ?? null;
}

/**
 * Bikin QRIS deposit baru.
 * bug fix: path sebelumnya "/api/v1/deposit/create" — endpoint yang benar
 * tidak pakai "/v1/" (lihat dokumentasi austinstore.id/api-docs).
 * @param {number} amount - nominal sebelum fee
 * @returns {Promise<{transactionId:string, amount:number, fee:number, qrString:string, qrImage:string, expiredAt:string, status:string}>}
 */
export async function createDeposit(amount) {
  if (!API_KEY) throw new Error("austinpay.apiKey belum diisi di config.js");

  const { status, data } = await client().post("/api/deposit/create", { amount });

  if (status !== 200 || !data?.success || !data?.deposit) {
    throw new Error(extractErrorMessage(status, data, "Gagal membuat QRIS deposit AustinPay"));
  }

  const d = data.deposit;
  return {
    transactionId: d.transaction_id,
    // "amount" di response AustinPay sudah termasuk fee + unique_code —
    // itulah nominal pas yang harus dibayar via QR (lihat catatan di docs).
    amount: d.amount,
    fee: d.fee,
    uniqueCode: d.unique_code,
    qrString: d.qr_string,
    qrImage: d.qr_image, // sudah berupa data URL base64 langsung dari AustinPay
    expiredAt: d.expired_at,
    status: d.status,
  };
}

/**
 * Cek status deposit. Interval polling minimal 5 detik (dibatasi oleh gateway).
 * bug fix: path sebelumnya "/api/v1/deposit/check/:id" — endpoint yang benar
 * tidak pakai "/v1/".
 * @param {string} transactionId
 * @returns {Promise<{status:'paid'|'pending'|'expired', message:string}>}
 */
export async function checkDeposit(transactionId) {
  if (!API_KEY) throw new Error("austinpay.apiKey belum diisi di config.js");

  const { status: httpStatus, data } = await client().get(
    `/api/deposit/check/${transactionId}`,
  );

  if (httpStatus !== 200 || !data?.success) {
    throw new Error(extractErrorMessage(httpStatus, data, "Gagal cek status deposit AustinPay"));
  }
  return { status: data.status, message: data.message };
}

/** Batalkan deposit yang masih pending. */
export async function cancelDeposit(transactionId) {
  if (!API_KEY) throw new Error("austinpay.apiKey belum diisi di config.js");

  const { status: httpStatus, data } = await client().post(
    `/api/deposit/cancel/${transactionId}`,
  );

  if (httpStatus !== 200 || !data?.success) {
    throw new Error(extractErrorMessage(httpStatus, data, "Gagal membatalkan deposit AustinPay"));
  }
  return data;
}
