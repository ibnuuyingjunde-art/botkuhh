import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import * as timeHelper from "../../src/lib/ichigo-time.js";

const pluginConfig = {
  name: "detailsewa",
  alias: ["sewadetail", "infosewa"],
  category: "owner",
  description: "Lihat detail satu grup sewa dan pilih aksi (renew/hapus)",
  usage: ".detailsewa <id grup>",
  example: ".detailsewa 120363xxx@g.us",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function formatRemaining(data) {
  if (data.isLifetime) return "Permanent";
  const diff = data.expiredAt - Date.now();
  if (diff <= 0) return "EXPIRED";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const input = m.text?.trim();

  if (!input) {
    return m.reply(
      `⚠️ Format salah.\nGunakan: *${m.prefix}detailsewa <id grup>*\n\nAmbil id dari *${m.prefix}listsewa*`,
    );
  }

  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  const groupId = input.includes("@g.us") ? input : input + "@g.us";
  const data = db.db.data.sewa.groups[groupId];

  if (!data) {
    return m.reply(
      `❌ Grup tidak terdaftar dalam sistem sewa\n\nLihat daftar: *${m.prefix}listsewa*`,
    );
  }

  const groupName = data.name || groupId.split("@")[0];
  const sisaStr = formatRemaining(data);
  const addedDate = data.addedAt
    ? timeHelper.fromTimestamp(data.addedAt, "DD/MM/YYYY")
    : "-";

  const rows = [
    {
      title: "🔄 Perpanjang Sewa",
      description: "Pilih durasi lalu perpanjang masa aktif grup ini",
      id: `${m.prefix}renewsewa ${groupId}`,
    },
    {
      title: "🗑️ Hapus dari Whitelist",
      description: "Hapus grup ini dari sistem sewa (bot akan keluar grup)",
      id: `${m.prefix}delsewa ${groupId}`,
    },
  ];

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "⚙️ Pilih Aksi",
        sections: [{ title: "Aksi Tersedia", rows }],
      }),
    },
  ];

  const bodyText =
    `╔═══════════════════╗\n║  📄 *ᴅᴇᴛᴀɪʟ sᴇᴡᴀ*\n╚═══════════════════╝\n\n` +
    `Grup: *${groupName}*\n` +
    `ID: ${groupId.split("@")[0]}\n` +
    `Sisa: *${sisaStr}*\n` +
    `Ditambah: ${addedDate}\n\n` +
    `> Pilih aksi di bawah 👇`;

  await sock.sendButton(
    m.chat,
    (await loadAssetBuffer("ichigo")),
    bodyText,
    m,
    { buttons },
  );
}

export { pluginConfig as config, handler };