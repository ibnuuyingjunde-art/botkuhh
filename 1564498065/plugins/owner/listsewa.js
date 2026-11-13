import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import * as timeHelper from "../../src/lib/ichigo-time.js";

const pluginConfig = {
  name: "listsewa",
  alias: ["sewalist", "daftarsewa"],
  category: "owner",
  description: "Lihat daftar grup yang terdaftar sewa",
  usage: ".listsewa",
  example: ".listsewa",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatCountdown(data) {
  if (data.status === "expired") return "EXPIRED";
  if (data.isLifetime) return "Permanent";
  const diff = data.expiredAt - Date.now();
  if (diff <= 0) return "EXPIRED";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusEmoji(data) {
  if (data.status === "expired") return "🚫";
  if (data.isLifetime) return "♾️";
  const diff = data.expiredAt - Date.now();
  if (diff <= 0) return "❌";
  if (diff <= 259200000) return "⚠️";
  return "✅";
}

async function handler(m, { sock, db }) {
  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    await db.save();
  }

  const sewaGroups = db.db.data.sewa.groups || {};
  const groupIds = Object.keys(sewaGroups);

  if (groupIds.length === 0) {
    return m.reply(
      `╔═══════════════════╗\n║  📋 *ᴅᴀꜰᴛᴀʀ sᴇᴡᴀ*\n╚═══════════════════╝\n\n` +
        `Status: *${db.db.data.sewa.enabled ? "✅ AKTIF" : "❌ NONAKTIF"}*\n` +
        `Belum ada grup terdaftar\n\n` +
        `Tambah dengan: *${m.prefix}addsewa <link> <durasi>*`
    );
  }

  const sorted = groupIds.sort((a, b) => {
    const aData = sewaGroups[a];
    const bData = sewaGroups[b];
    if (aData.isLifetime && !bData.isLifetime) return 1;
    if (!aData.isLifetime && bData.isLifetime) return -1;
    return (aData.expiredAt || 0) - (bData.expiredAt || 0);
  });

  const active = sorted.filter(
    (id) => sewaGroups[id].isLifetime || sewaGroups[id].expiredAt > Date.now()
  );
  const expired = sorted.filter(
    (id) => !sewaGroups[id].isLifetime && sewaGroups[id].expiredAt <= Date.now()
  );

  const rows = sorted.map((gid, i) => {
    const data = sewaGroups[gid];
    const status = getStatusEmoji(data);
    const countdown = formatCountdown(data);
    const addedDate = data.addedAt
      ? timeHelper.fromTimestamp(data.addedAt, "DD/MM/YYYY")
      : "-";

    return {
      title: `${status} ${i + 1}. ${data.name || "Unknown"}`,
      description: `Sisa: ${countdown} • Ditambah: ${addedDate}`,
      id: `${m.prefix}detailsewa ${gid}`,
    };
  });

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "📋 Pilih Grup Sewa",
        sections: [{ title: `Grup Sewa (${groupIds.length})`, rows }],
      }),
    },
  ];

  const bodyText =
    `╔═══════════════════╗\n║  📋 *ᴅᴀꜰᴛᴀʀ sᴇᴡᴀ*\n╚═══════════════════╝\n\n` +
    `Status sistem: *${db.db.data.sewa.enabled ? "✅ AKTIF" : "❌ NONAKTIF"}*\n` +
    `Total: *${groupIds.length}* grup (${active.length} aktif, ${expired.length} expired)\n\n` +
    `> Pilih grup di bawah untuk lihat aksi (renew/hapus) 👇`;

  await sock.sendButton(
    m.chat,
    (await loadAssetBuffer("ichigo")),
    bodyText,
    m,
    { buttons }
  );
}

export { pluginConfig as config, handler };