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
  name: "smmstatus",
  alias: ["smmcek", "ceksmm", "orderstatus"],
  category: "tools",
  description: "Cek status pengerjaan order Suntik Sosmed (SMM)",
  usage: ".smmstatus <order_id>",
  example: ".smmstatus INV-171892801123-554",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
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

const statusIcon = (statusText = "") => {
  const s = statusText.toLowerCase();
  if (s.includes("completed")) return "✅";
  if (s.includes("processing") || s.includes("in progress")) return "⏳";
  if (s.includes("pending")) return "🕐";
  if (s.includes("partial")) return "⚠️";
  if (s.includes("canceled") || s.includes("cancelled") || s.includes("failed")) return "❌";
  return "ℹ️";
};

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
    console.log("[smmstatus] gagal load header media:", e.message);
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

    const orderId = args[0];
    if (!orderId) {
      const bodyText =
        `◇ ${toBoldSans("CEK STATUS")} ◇\n\n` +
        `\`${prefix}smmstatus <order_id>\`\n\n` +
        `Contoh:\n\`${prefix}smmstatus INV-171892801123-554\``;

      return sendInteractive(m, sock, {
        bodyText,
        subtitle: "Format Cek Status",
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

    const { data } = await axios.get(
      `${baseUrl}/smm/status/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 }
    );

    if (!data?.status) {
      return m.reply(`❌ Order tidak ditemukan.\n${data?.message || ""}`);
    }

    const icon = statusIcon(data.status_text);

    const bodyText =
      `◇ ${icon} ${toBoldSans("STATUS ORDER")} ◇\n\n` +
      `▸ Order ID    : \`${data.order_id}\`\n` +
      `▸ Provider ID : \`${data.provider_order_id}\`\n` +
      `▸ Layanan     : ${data.service}\n` +
      `▸ Status      : *${data.status_text}*\n` +
      `▸ Target      : ${data.target}\n` +
      `▸ Start Count : ${data.start_count}\n` +
      `▸ Sisa        : ${data.remains}\n` +
      `▸ Biaya       : ${fmtRp(data.charge)}\n\n` +
      `${data.explanation || ""}`;

    await sendInteractive(m, sock, {
      bodyText,
      subtitle: `Status: ${data.status_text}`,
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔄 Refresh",
            id: `${prefix}smmstatus ${orderId}`,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🛒 Order Baru",
            id: `${prefix}smmservices`,
          }),
        },
      ],
    });
  } catch (error) {
    console.log("[smmstatus]", error);
    if (error.response) {
      return m.reply(formatAlipError(error));
    }
    try {
      await m.reply("❌ Gagal cek status. Coba lagi.");
    } catch {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

export { pluginConfig as config, handler };