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
  name: "smmservices",
  alias: ["smmlist", "smservices", "layananmm"],
  category: "tools",
  description: "Lihat daftar layanan Suntik Sosmed (SMM) yang tersedia",
  usage: ".smmservices [kategori]",
  example: ".smmservices Instagram",
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
    console.log("[smmservices] gagal load header media:", e.message);
    cachedHeaderMedia = null;
  }
  return cachedHeaderMedia;
}

async function sendPlainFallback(m, text) {
  await m.reply(text);
}

async function handler(m, { sock, args }) {
  const prefix = m.prefix || config.command?.prefix || ".";

  try {
    const baseUrl = config.alipshop?.baseUrl;
    const apiKey  = config.alipshop?.apiKey;

    if (!apiKey) {
      return m.reply("⚠️ API key Alip Shop belum di-set di config.js (config.alipshop.apiKey).");
    }

    const { data } = await axios.get(`${baseUrl}/smm/services`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000,
    });

    if (!data?.status || !Array.isArray(data.services)) {
      return m.reply(`❌ Gagal mengambil daftar layanan.\n${data?.message || ""}`);
    }

    const filterKw = args.join(" ").trim().toLowerCase();
    let services = data.services;
    if (filterKw) {
      services = services.filter(
        (s) =>
          s.category?.toLowerCase().includes(filterKw) ||
          s.name?.toLowerCase().includes(filterKw)
      );
    }

    if (services.length === 0) {
      return m.reply(`❌ Gak ada layanan yang cocok dengan "${filterKw}".`);
    }

    const grouped = {};
    for (const s of services) {
      const cat = s.category || "Lainnya";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }

    let bodyText;
    let buttons;

    if (!filterKw) {
      
      bodyText =
        `◇ ${toBoldSans("SMM SERVICES")} ◇\n\n` +
        `Total *${services.length}* layanan tersedia di *${Object.keys(grouped).length}* kategori.\n\n` +
        `Pilih kategori di bawah buat lihat daftar layanannya.`;

      const rows = Object.entries(grouped)
        .slice(0, 40) 
        .map(([cat, list]) => ({
          title: cat,
          description: `${list.length} layanan`,
          id: `${prefix}smmservices ${cat}`,
        }));

      buttons = [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Pilih Kategori",
            sections: [{ title: "Daftar Kategori", rows }],
          }),
        },
      ];
    } else {
      
      const MAX_ROWS = 30; 

      bodyText =
        `◇ ${toBoldSans("SMM SERVICES")} ◇\n\n` +
        `Filter: "${filterKw}" · ${services.length} layanan\n\n` +
        `Tap layanan di bawah buat mulai order —\n` +
        `nanti tinggal lengkapi link & jumlahnya.`;

      const sections = Object.entries(grouped).map(([cat, list]) => ({
        title: cat,
        rows: list.slice(0, MAX_ROWS).map((s) => ({
          title: `${s.service} · ${s.name}`.slice(0, 60),
          description: `Min/Max ${s.min}/${s.max} · ${fmtRp(s.price_per_1000)}/1000`,
          id: `${prefix}smmorder ${s.service}`,
        })),
      }));

      buttons = [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🛒 Pilih Layanan",
            sections,
          }),
        },
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔙 Semua Kategori",
            id: `${prefix}smmservices`,
          }),
        },
      ];
    }

    const headerMedia = await getHeaderMedia(sock);

    const content = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          interactiveMessage: {
            header: {
              title: config.bot?.name || "Bot",
              subtitle: "SMM Panel",
              hasMediaAttachment: !!headerMedia,
              ...(headerMedia ? { imageMessage: headerMedia.imageMessage } : {}),
            },
            body: { text: bodyText },
            footer: { text: "👇 Tap tombol di bawah" },
            contextInfo: {
              mentionedJid: [m.sender],
            },
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
  } catch (error) {
    console.log("[smmservices]", error);
    if (error.response) {
      return m.reply(formatAlipError(error));
    }
    
    try {
      await sendPlainFallback(
        m,
        `📦 *SMM Services*\nGunakan \`${prefix}smmservices <kategori>\` untuk lihat daftar layanan.`
      );
    } catch {
      m.reply(te(m.prefix, m.command, m.pushName));
    }
  }
}

export { pluginConfig as config, handler };