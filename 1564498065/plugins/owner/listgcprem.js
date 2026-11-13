import {
  listPremiumGroups,
  formatRemaining,
  pruneExpired,
} from "../../src/lib/ichigo-premium-group.js";

const pluginConfig = {
  name: "listgcprem",
  alias: ["listpremgc", "gcpremlist", "daftargcprem"],
  category: "owner",
  description: "Lihat daftar grup premium",
  usage: ".listgcprem\n.listgcprem clean (hapus yang expired)",
  example: ".listgcprem",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function statusEmoji(g) {
  if (g.isLifetime) return "♾️";
  const diff = (g.expiredAt || 0) - Date.now();
  if (diff <= 0) return "❌";
  if (diff <= 259200000) return "⚠️";
  return "✅";
}

async function handler(m) {
  const arg = (m.args?.[0] || "").toLowerCase();
  let cleaned = 0;
  if (["clean", "bersihkan", "clear"].includes(arg)) {
    cleaned = pruneExpired();
  }

  const groups = listPremiumGroups();

  if (groups.length === 0) {
    return m.reply(
      `💎 *DAFTAR PREMIUM GRUP*\n\n` +
        (cleaned ? `🧹 ${cleaned} grup expired dibersihkan\n\n` : "") +
        `Belum ada grup premium\n` +
        `Tambah dengan: *${m.prefix}addpremgc <link/id> <durasi>*`,
    );
  }

  const sorted = groups.sort((a, b) => {
    if (a.isLifetime && !b.isLifetime) return 1;
    if (!a.isLifetime && b.isLifetime) return -1;
    return (a.expiredAt || 0) - (b.expiredAt || 0);
  });

  const active = sorted.filter(
    (g) => g.isLifetime || (g.expiredAt || 0) > Date.now(),
  ).length;
  const expired = sorted.length - active;

  let txt = `💎 *DAFTAR PREMIUM GRUP*\n\n`;
  if (cleaned) txt += `🧹 ${cleaned} grup expired dibersihkan\n\n`;

  sorted.forEach((g, i) => {
    const expStr = g.isLifetime
      ? "Permanent"
      : new Date(g.expiredAt).toLocaleString("id-ID");
    txt += `*${i + 1}.* ${statusEmoji(g)} *${g.name || "Unknown"}*\n`;
    txt += `   ID      : ${g.id.split("@")[0]}\n`;
    txt += `   Sisa    : ${formatRemaining(g)}\n`;
    txt += `   Expired : ${expStr}\n\n`;
  });

  txt += `Total: *${sorted.length}* grup (✅ ${active} aktif`;
  if (expired) txt += ` • ❌ ${expired} expired`;
  txt += `)\n\n`;
  txt += `💡 Hapus: *${m.prefix}delgcprem <nomor>*`;
  if (expired) txt += `\n💡 Bersihkan expired: *${m.prefix}listgcprem clean*`;

  return m.reply(txt);
}

export { pluginConfig as config, handler };