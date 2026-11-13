

const ERROR_MAP = {
  400: {
    label: "invalid_request",
    hint: "Format parameter tidak lengkap, tipe data salah, atau link tidak valid.",
  },
  401: {
    label: "authentication_error",
    hint: "Token Bearer key salah, kadaluarsa, atau tidak terdaftar. Cek config.alipshop.apiKey.",
  },
  403: {
    label: "smm_disabled / plan_required",
    hint: "Layanan sedang dimatikan global oleh admin, atau sewa API AM kamu belum aktif/kadaluarsa.",
  },
  404: {
    label: "not_found",
    hint: "ID layanan SMM tidak ditemukan, atau order ID tidak valid.",
  },
  502: {
    label: "upstream_error",
    hint: "Server pusat provider sedang bermasalah atau response gagal di-parsing. Coba lagi nanti.",
  },
};

/**
 * Format pesan error Alip Shop API jadi teks siap kirim ke WA.
 * @param {import('axios').AxiosError} error
 * @returns {string}
 */
export function formatAlipError(error) {
  if (!error.response) {
    return "❌ Gagal terhubung ke server Alip Shop. Cek koneksi internet server bot.";
  }

  const status = error.response.status;
  const apiMessage = error.response.data?.message || error.response.data?.reason;
  const known = ERROR_MAP[status];

  let text = `❌ *API Error (${status})*`;
  if (known) text += ` — \`${known.label}\``;
  text += `\n`;

  if (apiMessage) {
    text += `${apiMessage}`;
  } else if (known) {
    text += `${known.hint}`;
  }

  return text;
}
