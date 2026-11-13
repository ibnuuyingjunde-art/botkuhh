import axios from "axios";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "ampremv3",
  alias: ["ampv3", "amprem3"],
  category: "tools",
  description: "Kirim link atau verifikasi Alight Motion Premium lewat API ampremv3",
  usage: ".ampremv3 <action> | <email> | [link]",
  example: ".ampremv3 1 | nama@gmail.com atau .ampremv3 2 | nama@gmail.com | https://alight-creative.firebaseapp.com/...",
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 3,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/tools/ampremv3";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function formatDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return String(value || "-");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function daysLeft(value) {
  const d = new Date(value);
  if (isNaN(d)) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("active") || s.includes("premium")) return "✅ Premium Aktif";
  if (s.includes("expired")) return "⛔ Kedaluwarsa";
  if (s.includes("pending")) return "⏳ Menunggu";
  return status ? String(status) : "-";
}

async function sendPayInfo(m, conn, text, payEmail) {
  if (!conn?.relayMessage) return m.reply(text);

  try {
    await conn.relayMessage(
      m.chat,
      {
        interactiveMessage: {
          body: { text },
          footer: { text: payEmail },
          nativeFlowMessage: {
            buttons: [
              {
                name: "payment_info",
                buttonParamsJson: JSON.stringify({
                  payment_settings: [
                    {
                      type: "pix_static_code",
                      pix_static_code: {
                        merchant_name: payEmail,
                        key: payEmail,
                        key_type: "EMAIL",
                      },
                    },
                  ],
                  additional_note: payEmail,
                  native_payment_methods: [],
                  share_payment_status: false,
                }),
              },
            ],
            messageParamsJson: "",
          },
        },
      },
      {
        additionalAttributes: { expiration: "7776000" },
        additionalNodes: [
          {
            tag: "biz",
            attrs: {
              actual_actors: "2",
              host_storage: "2",
              privacy_mode_ts: "1791287336",
              native_flow_name: "payment_info",
            },
            content: [
              {
                tag: "quality_control",
                attrs: {
                  decision_id: "aa0a73becf512dbc7d864220e6fb6c89481a0050",
                  source_type: "third_party",
                },
                content: [{ tag: "decision_source", attrs: { value: "df" } }],
              },
            ],
          },
        ],
      }
    );
  } catch (e) {
    console.error("[AmpremV3] relayMessage gagal:", e.message);
    await m.reply(text); // fallback
  }
}

async function handler(m, ctx = {}) {
  // Sesuaikan dengan nama koneksi di framework bot kamu
  const conn = ctx.sock || ctx.conn || m.conn;

  const args = (m.text || "").split("|").map((item) => item.trim());
  const actionInput = args[0];
  const email = args[1]?.toLowerCase() || "";
  const link = args[2] || "";

  if (!actionInput || (actionInput !== "1" && actionInput !== "2")) {
    return m.reply(
      `⭐ *ᴀᴍᴘʀᴇᴍ ᴠ3*\n\n` +
        `> *Format Penggunaan:*\n\n` +
        `1️⃣ *Kirim Magic Link:*\n` +
        `\`${m.prefix}${m.command} 1 | nama@gmail.com\`\n\n` +
        `2️⃣ *Verifikasi Link:*\n` +
        `\`${m.prefix}${m.command} 2 | nama@gmail.com | https://alight-creative.firebaseapp.com/...\``
    );
  }

  if (!email || !EMAIL_RE.test(email)) {
    return m.reply("❌ Format email tidak valid.\n\n> Contoh: nama@gmail.com");
  }

  await m.react("🕕");

  try {
    const actionValue = actionInput === "1" ? "send" : "verify";

    const params = { action: actionValue, email };

    if (actionInput === "2") {
      if (!link) {
        await m.react("❌");
        return m.reply("❌ Masukkan link verifikasi yang kamu terima di email!");
      }
      params.link = link;
    }

    const res = await axios.get(API, {
      params,
      timeout: 60000,
      validateStatus: () => true,
    });

    if (res.status !== 200) {
      console.error(`[AmpremV3] HTTP ${res.status}:`, JSON.stringify(res.data)?.slice(0, 300));
      await m.react("❌");
      return m.reply(`⚠️ Server API bermasalah (HTTP ${res.status}). Coba lagi beberapa saat lagi.`);
    }

    const data = res.data;
    const r = data?.result;

    if (!data?.status || !r) {
      console.error("[AmpremV3] Respons API:", JSON.stringify(data)?.slice(0, 300));
      await m.react("❌");
      const reason =
        typeof data?.error === "string"
          ? `\n> ${data.error}`
          : typeof data?.message === "string"
            ? `\n> ${data.message}`
            : "";
      return m.reply(`❌ Permintaan gagal untuk *${email}*.${reason}`);
    }

    await m.react("✅");

    if (actionInput === "1") {
      return sendPayInfo(
        m,
        conn,
        `⭐ *ᴀᴍᴘʀᴇᴍ ᴠ3 - KIRIM LINK*\n\n` +
          `> ${r.message || "Magic link berhasil dikirim!"}\n\n` +
          `📧 Email: *${email}*\n` +
          `📌 Silakan periksa kotak masuk/spam email kamu, lalu salin link verifikasinya.`,
        email
      );
    }

    const left = daysLeft(r.validUntil);
    const leftText = left === null ? "" : left >= 0 ? ` (${left} hari lagi)` : " (sudah lewat)";
    const features = Array.isArray(r.features) ? r.features.map((f) => `  • ${f}`).join("\n") : "-";

    return sendPayInfo(
      m,
      conn,
      `⭐ *ᴀᴍᴘʀᴇᴍ ᴠ3 - VERIFIKASI SUKSES*\n\n` +
        `> ${r.message || "Verifikasi berhasil!"}\n\n` +
        `📧 Email: *${r.email || email}*\n` +
        `👤 Nama: *${r.displayName || "-"}*\n` +
        `💎 Paket: *${r.planName || "-"}*\n` +
        `📌 Status: *${statusLabel(r.membershipStatus)}*\n` +
        `🆔 Order ID: *${r.orderId || "-"}*\n` +
        `📅 Berlaku Sampai: *${formatDate(r.validUntil)}*${leftText}\n\n` +
        `✨ *Fitur Terbuka:*\n${features}`,
      r.email || email
    );
  } catch (err) {
    console.error("[AmpremV3] Error:", err.code || err.message);
    await m.react("☢");
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return m.reply("⏱️ Server API tidak merespons. Coba lagi nanti.");
    }
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };