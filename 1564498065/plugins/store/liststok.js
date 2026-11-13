import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "liststok",
  alias: ["cekstok", "stokproduk"],
  category: "store",
  description: "Lihat stok produk digital",
  usage: ".liststok [produk]",
  example: ".liststok amlight",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

async function sendInteractive(sock, jid, bodyText, footerText, buttons) {
  try {
    const msg = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            footer: { text: footerText },
            header: { hasMediaAttachment: false },
            nativeFlowMessage: {
              buttons,
              messageVersion: 1,
            },
          },
        },
      },
    };
    await sock.relayMessage(jid, msg, {});
  } catch {
    await sock.sendMessage(jid, { text: bodyText + "\n\n" + footerText });
  }
}

async function handler(m, { sock }) {
  const db      = getDatabase();
  const args    = m.args;
  const stokAll = db.setting("stokProduk") || {};

  if (Object.keys(stokAll).length === 0) {
    return m.reply(`📦 Belum ada stok produk.\nGunakan *.addstok* untuk menambahkan.`);
  }

  if (args[0]) {
    const key  = args[0].toLowerCase();
    const stok = stokAll[key] || [];

    if (stok.length === 0) {
      return m.reply(`📦 Stok *${key}* kosong.`);
    }

    let txt = `📦 *STOK ${key.toUpperCase()}* (${stok.length} item)\n\n`;
    stok.forEach((item, i) => {
      txt += `${i + 1}. `;
      txt += item.tempmail
        ? `${item.email} : ${item.tempmail}\n`
        : `${item.email} : ${item.password}\n`;
    });

    return m.reply(txt.trim());
  }

  const produkKeys = Object.keys(stokAll);

  let txt = `📦 *RINGKASAN STOK PRODUK*\n\n`;
  for (const [key, stok] of Object.entries(stokAll)) {
    const jumlah = Array.isArray(stok) ? stok.length : 0;
    const status = jumlah === 0
      ? `❌ Kosong`
      : jumlah <= 3
        ? `⚠️ ${jumlah} item`
        : `✅ ${jumlah} item`;
    txt += `│ ${key.padEnd(10)} : ${status}\n`;
  }
  txt += `\nKlik tombol untuk lihat detail per produk.`;

  const buttons = produkKeys.slice(0, 5).map(key => {
    const jumlah = Array.isArray(stokAll[key]) ? stokAll[key].length : 0;
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: `📦 ${key} (${jumlah})`,
        id: `cekstok_${key}`,
      }),
    };
  });

  return await sendInteractive(sock, m.chat, txt, config.bot?.name || "lyniX's MD", buttons);
}

export { pluginConfig as config, handler };