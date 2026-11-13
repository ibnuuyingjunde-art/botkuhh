import fs from "fs";
import { getAssetBuffer, loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import axios from "axios";
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
} from "ichigo";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { formatAlipError } from "../../src/lib/ichigo-alip-error.js";

const pluginConfig = {
  name: "smmorder",
  alias: ["smmbuy", "orderMM"],
  category: "tools",
  description: "Order layanan Suntik Sosmed (SMM) — followers, likes, views, dll",
  usage: ".smmorder <service_id> <link/target> <jumlah> [komentar]",
  example: ".smmorder 321 https://instagram.com/alipshop 1000",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const boldSansMap = (() => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const map = {};
  const addRange = (src, startCode) => {
    for (let i = 0; i < src.length; i++) map[src[i]] = String.fromCodePoint(startCode + i);
  };
  addRange(upper, 0x1d5d4);
  addRange(lower, 0x1d5ee);
  addRange(digits, 0x1d7ec);
  return map;
})();
const toBoldSans = (str) => String(str).split("").map((c) => boldSansMap[c] || c).join("");

const fmtRp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

let cachedHeaderMedia = null;
async function getHeaderMedia(sock) {
  if (cachedHeaderMedia) return cachedHeaderMedia;
  try {
    const buf = await loadAssetBuffer("ichigo");
    cachedHeaderMedia = await prepareWAMessageMedia(
      { image: buf },
      { upload: sock.waUploadToServer }
    );
  } catch (e) {
    console.log("[smmorder] gagal load header media:", e.message);
    cachedHeaderMedia = null;
  }
  return cachedHeaderMedia;
}

async function sendInteractive(m, sock, { bodyText, buttons, subtitle }) {
  const headerMedia = await getHeaderMedia(sock);

  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {},
        interactiveMessage: {
          header: {
            title: config.bot?.name || "Bot",
            subtitle: subtitle || "SMM Panel",
            hasMediaAttachment: !!headerMedia,
            ...(headerMedia ? { imageMessage: headerMedia.imageMessage } : {}),
          },
          body: { text: bodyText },
          footer: { text: "👇 Tap tombol di bawah" },
          contextInfo: { mentionedJid: [m.sender] },
          nativeFlowMessage: { buttons },
        },
      },
    },
  };

  const msg = generateWAMessageFromContent(m.chat, content, {
    quoted: m,
    userJid: sock.user.jid,
  });

  await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

async function handler(m, { sock, args }) {
  const prefix = m.prefix || config.command?.prefix || ".";

  try {
    const baseUrl = config.alipshop?.baseUrl;
    const apiKey  = config.alipshop?.apiKey;

    if (!apiKey) {
      return m.reply("⚠️ API key Alip Shop belum di-set di config.js (config.alipshop.apiKey).");
    }

    const [service, link, quantityRaw, ...commentParts] = args;

    if (!service || !link || !quantityRaw) {
      const bodyText = service
        ? `◇ ${toBoldSans("LANJUTKAN ORDER")} ◇\n\n` +
          `Layanan \`${service}\` udah dipilih ✅\n\n` +
          `Tinggal ketik:\n` +
          `\`${prefix}smmorder ${service} <link> <jumlah>\`\n\n` +
          `Contoh:\n\`${prefix}smmorder ${service} https://instagram.com/alipshop 1000\``
        : `◇ ${toBoldSans("CARA ORDER")} ◇\n\n` +
          `\`${prefix}smmorder <service_id> <link> <jumlah> [komentar]\`\n\n` +
          `Contoh:\n\`${prefix}smmorder 321 https://instagram.com/alipshop 1000\`\n\n` +
          `Belum tau ID layanan? Cek daftar dulu.`;

      return sendInteractive(m, sock, {
        bodyText,
        subtitle: service ? `Layanan ${service} dipilih` : "Format Order",
        buttons: [
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📦 Lihat Layanan",
              id: `${prefix}smmservices`,
            }),
          },
        ],
      });
    }

    const quantity = parseInt(quantityRaw, 10);
    if (isNaN(quantity) || quantity <= 0) {
      return m.reply("❌ Jumlah harus berupa angka lebih dari 0.");
    }
    if (!/^https?:\/\//i.test(link)) {
      return m.reply("❌ Link/target harus berupa URL yang valid (diawali http:// atau https://).");
    }

    const body = { service, link, quantity };
    if (commentParts.length) body.comments = commentParts.join(" ").replace(/\\n/g, "\n");

    await m.react("🕕");

    const { data } = await axios.post(`${baseUrl}/smm/order`, body, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 20000,
    });

    if (!data?.status) {
      await m.react("☢");
      return m.reply(`❌ Order gagal.\n${data?.message || ""}`);
    }

    const bodyText =
      `◇ ${toBoldSans("ORDER BERHASIL")} ◇\n\n` +
      `▸ Order ID    : \`${data.order_id}\`\n` +
      `▸ Provider ID : \`${data.provider_order_id}\`\n` +
      `▸ Layanan     : ${data.service}\n` +
      `▸ Biaya       : ${fmtRp(data.charge)}\n` +
      `▸ Saldo Awal  : ${fmtRp(data.start_balance)}\n` +
      `▸ Saldo Akhir : ${fmtRp(data.end_balance)}\n\n` +
      `${data.message || ""}`;

    await sendInteractive(m, sock, {
      bodyText,
      subtitle: "Order Berhasil",
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📊 Cek Status",
            id: `${prefix}smmstatus ${data.order_id}`,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🛒 Order Lagi",
            id: `${prefix}smmservices`,
          }),
        },
      ],
    });

    await m.react("✅");
  } catch (error) {
    console.log("[smmorder]", error);
    await m.react("☢");
    if (error.response) {
      return m.reply(formatAlipError(error));
    }
    
    try {
      await m.reply("❌ Terjadi kesalahan saat memproses order. Coba lagi.");
    } catch {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

export { pluginConfig as config, handler };