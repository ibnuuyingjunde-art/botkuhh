import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../../config.js";

let client = null;
function getClient() {
  if (!config.geminiApiKey) return null;
  if (!client) client = new GoogleGenerativeAI(config.geminiApiKey);
  return client;
}

/**
 * Minta Gemini nulis pesan konfirmasi ramah dalam Bahasa Indonesia
 * berdasarkan context yang dikasih. Kalau Gemini gagal/apikey kosong,
 * fallback ke template statis (jadi fitur inti tetap jalan walau AI down).
 */
export async function generateConfirmation(context, fallback) {
  const genAI = getClient();
  if (!genAI) return fallback;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt =
      `Kamu adalah asisten toko bot WhatsApp. Tulis SATU pesan konfirmasi singkat ` +
      `(maksimal 5 kalimat, Bahasa Indonesia santai tapi sopan, boleh emoji secukupnya) ` +
      `berdasarkan detail transaksi berikut. Jangan tambahkan basa-basi pembuka/penutup ` +
      `di luar pesan itu sendiri, langsung isi pesannya saja.\n\n` +
      `Detail:\n${JSON.stringify(context, null, 2)}`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text()?.trim();
    return text || fallback;
  } catch (e) {
    return fallback;
  }
}
