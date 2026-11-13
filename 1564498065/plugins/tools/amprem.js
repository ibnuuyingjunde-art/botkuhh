import axios from "axios";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const API_BASE_URL = process.env.ALIGHT_API_BASE_URL || "https://api.theresav.eu/api/premium/alightmotion";
const API_KEY_ENC = "VGF5Um9vQVBJa2V5";
const API_KEY = process.env.ALIGHT_API_KEY || Buffer.from(API_KEY_ENC, "base64").toString("utf-8");
const SESSION_TTL = 10 * 60 * 1000;

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validLink(link) {
  try {
    const u = new URL(link);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

async function apiGet(endpoint, params) {
  if (!API_KEY) throw new Error("API key belum dikonfigurasi.");
  const response = await axios.get(`${API_BASE_URL}/${endpoint}`, {
    params,
    timeout: 45_000,
    headers: { "x-apikey": API_KEY },
    validateStatus: () => true,
  });
  const data = response.data || {};
  if (response.status < 200 || response.status >= 300 || data.status === false) {
    throw new Error(data.error || data.message || `API mengembalikan HTTP ${response.status}`);
  }
  return data;
}

const pluginConfig = {
  name: "amprem",
  alias: ["alightpremium", "am-prem"],
  category: "tools",
  description: "Proses aktivasi Alight Motion melalui API provider",
  usage: ".amprem <email> | .amprem <link_verifikasi>",
  example: ".amprem user@example.com",
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const db = getDatabase();
  const input = m.text?.trim();

  if (!input) {
    return m.reply(`✨ *ALIGHT MOTION PREMIUM*\n\nLangkah 1 — kirim email:\n> ${m.prefix}amprem email@example.com\n\nLangkah 2 — setelah dapat email verifikasi, kirim full link-nya:\n> ${m.prefix}amprem https://link-dari-email...\n\n(Tidak perlu reply pesan bot, langsung ketik saja.)`);
  }

  if (/^https?:\/\//i.test(input)) {
    if (!validLink(input)) {
      return m.reply("❌ Link verifikasi tidak valid.\n\nPastikan kamu kirim full URL dari email noreply.");
    }

    const userData = db.getUser(m.sender);
    const session = userData?.ampremSession;

    if (!session?.email) {
      return m.reply(`❌ *Belum Ada Sesi AMPREM*\n\nKirim dulu email-nya:\n> ${m.prefix}amprem email@example.com`);
    }
    if (Date.now() - session.createdAt > SESSION_TTL) {
      userData.ampremSession = null;
      db.setUser(m.sender, userData);
      return m.reply(`⌛ Sesi AMPREM sudah kedaluwarsa. Silakan ketik "${m.prefix}amprem email@example.com" lagi.`);
    }

    await m.react("⏳");
    try {
      await apiGet("verify", { email: session.email, link: input });

      userData.ampremSession = null;
      db.setUser(m.sender, userData);

      await m.react("✅");
      return m.reply(`✅ *PROSES SELESAI*\n\n📧 Email: *${session.email}*\n✨ Status: *Premium berhasil diproses*\n\nDone ya kak ✅`);
    } catch (error) {
      userData.ampremSession = null;
      db.setUser(m.sender, userData);

      await m.react("❌");
      return m.reply(`❌ *PROSES GAGAL*\n\n> ${error.message || "Terjadi kesalahan pada API."}\n\nKalau link sudah benar tetapi tetap gagal, jalankan kembali *${m.prefix}amprem email* untuk membuat sesi baru.`);
    }
  }

  const email = input;
  if (!validEmail(email)) return m.reply("❌ Format email tidak valid.");
  if (!API_KEY) return m.reply("❌ Fitur AMPREM belum dikonfigurasi.");

  const userData = db.getUser(m.sender) || {};
  const existing = userData.ampremSession;
  if (existing && Date.now() - existing.createdAt <= SESSION_TTL) {
    return m.reply(`⏳ Kamu masih punya proses AMPREM yang sedang menunggu link verifikasi untuk *${existing.email}*.\n\nKirim link verifikasinya langsung, atau tunggu sampai sesi kedaluwarsa.`);
  }

  await m.react("⏳");
  try {
    await apiGet("send", { email });

    userData.ampremSession = { email, createdAt: Date.now() };
    db.setUser(m.sender, userData);

    await m.react("✅");
    return m.reply(`✅ *LINK VERIFIKASI TERKIRIM*\n\n📧 Email: *${email}*\n\nSilakan cek email dari *noreply*.\nKalau tidak ada di Inbox, coba cek folder *Spam/Junk*.\n\nJika sudah menerima email, kirim *${m.prefix}amprem <full_link_verifikasi>*.\n\n⏱️ Sesi berlaku selama 10 menit.`);
  } catch (error) {
    await m.react("❌");
    return m.reply(`❌ *GAGAL MENGIRIM LINK*\n\n> ${error.message || "Terjadi kesalahan pada API."}`);
  }
}

export { pluginConfig as config, handler };