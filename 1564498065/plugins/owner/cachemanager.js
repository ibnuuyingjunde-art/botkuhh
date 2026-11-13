import { groupCache, getCachedGroupMetadata } from "../../src/connection.js";

export const config = {
  name: "cachemanager",
  alias: ["cacheinfo", "clearcache", "cachegc", "cachestats", "cacherefresh"],
  category: "owner",
  description: "Lihat dan kelola group metadata cache",
  usage: ".cacheinfo [kata kunci] | .cachestats | .cachegc | .cacherefresh | .clearcache",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  isBotAdmin: false,
  cooldown: 5,
  isEnabled: true,
};

const ID = {
  action: (a, jid) => `.cacheinfo __${a}:${encodeURIComponent(jid)}__`,
  parse: (s) => {
    const r = String(s || "").match(/__(\w+):([^_]+)__/);
    return r ? { action: r[1], jid: decodeURIComponent(r[2]) } : null;
  },
};

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}d`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}d`;
}

function estimateSize(meta) {
  try {
    return Buffer.byteLength(JSON.stringify(meta || {}), "utf8");
  } catch {
    return 0;
  }
}

function collectEntries(keys) {
  const now = Date.now();
  return keys.map((jid) => {
    const meta = groupCache.get(jid);
    const ttl = groupCache.getTtl(jid);
    return {
      jid,
      nama: meta?.subject || jid,
      participants: meta?.participants?.length || 0,
      sisaMs: ttl ? ttl - now : 0,
      size: estimateSize(meta),
    };
  });
}

export async function handler(m, { sock }) {
  const cmd = m.command;
  const text = (m.text || "").trim();
  const body = (m.body || "").trim();

  const parsed = ID.parse(text) || ID.parse(body);
  if (parsed) {
    const { action, jid } = parsed;

    if (action === "hapus") {
      if (!groupCache.has(jid)) {
        return m.reply(`📭 Cache untuk grup ini sudah tidak ada.`);
      }
      const meta = groupCache.get(jid);
      const nama = meta?.subject || jid;
      groupCache.del(jid);
      return m.reply(
        `◈── *Cache Manager* ──◈\n\n` +
        `🗑️ Cache *${nama}* berhasil dihapus.\n` +
        `Akan di-fetch ulang otomatis saat ada pesan berikutnya.`
      );
    }

    if (action === "refresh") {
      const oldMeta = groupCache.get(jid);
      const namaLama = oldMeta?.subject || jid;
      groupCache.del(jid);
      try {
        const fresh = await getCachedGroupMetadata(sock, jid);
        if (!fresh) {
          return m.reply(`⚠️ Gagal fetch ulang metadata *${namaLama}* (grup mungkin sudah tidak diikuti bot).`);
        }
        return m.reply(
          `◈── *Cache Manager* ──◈\n\n` +
          `🔄 Cache *${fresh.subject || jid}* berhasil di-refresh.\n` +
          `👥 Participant: ${fresh.participants?.length || 0}`
        );
      } catch (e) {
        return m.reply(`⚠️ Gagal refresh: ${e.message}`);
      }
    }

    if (action === "hapussemua") {
      const jumlah = groupCache.keys().length;
      groupCache.flushAll();
      return m.reply(
        `◈── *Cache Manager* ──◈\n\n` +
        `🗑️ Semua cache dihapus *(${jumlah} grup)*.\n` +
        `Cache akan diisi ulang otomatis.`
      );
    }

    return;
  }

  if (cmd === "cachestats") {
    const keys = groupCache.keys();
    const stats = groupCache.getStats();
    const totalReq = stats.hits + stats.misses;
    const hitRate = totalReq > 0 ? Math.round((stats.hits / totalReq) * 100) : 0;
    const entries = collectEntries(keys);

    const totalParticipants = entries.reduce((a, e) => a + e.participants, 0);
    const totalSize = entries.reduce((a, e) => a + e.size, 0);

    const terbesar = [...entries].sort((a, b) => b.participants - a.participants)[0];
    const terlama = [...entries].sort((a, b) => a.sisaMs - b.sisaMs)[0];
    const terbaru = [...entries].sort((a, b) => b.sisaMs - a.sisaMs)[0];

    let teks =
      `◈── *Cache Manager — Stats* ──◈\n\n` +
      `📦 *Grup ter-cache:* ${keys.length}\n` +
      `👥 *Total participant:* ${totalParticipants}\n` +
      `💾 *Estimasi ukuran:* ${fmtBytes(totalSize)}\n` +
      `✅ *Hits:* ${stats.hits}   ❌ *Miss:* ${stats.misses}   📊 *Rate:* ${hitRate}%\n` +
      `⏱️ *TTL default:* 5 menit\n`;

    if (terbesar) {
      teks += `\n👑 *Grup terbesar:* ${terbesar.nama} (${terbesar.participants} anggota)`;
    }
    if (terlama) {
      teks += `\n⏳ *Segera expired:* ${terlama.nama} (${fmtDuration(terlama.sisaMs)} lagi)`;
    }
    if (terbaru) {
      teks += `\n🆕 *Baru di-cache:* ${terbaru.nama} (${fmtDuration(terbaru.sisaMs)} lagi)`;
    }

    teks += `\n\nKetik *.cacheinfo* buat lihat daftar lengkap.`;
    return m.reply(teks);
  }

  if (cmd === "cacheinfo") {
    let keys = groupCache.keys();
    const keyword = text.toLowerCase();

    if (keys.length === 0) {
      return m.reply(
        `◈── *Cache Manager* ──◈\n\n` +
        `📭 Cache kosong saat ini.\n` +
        `Cache akan otomatis terisi saat ada pesan masuk di grup.`
      );
    }

    let entries = collectEntries(keys);

    if (keyword) {
      entries = entries.filter((e) => e.nama.toLowerCase().includes(keyword));
      if (entries.length === 0) {
        return m.reply(`🔍 Gak ada grup ter-cache yang cocok dengan "*${text}*".`);
      }
    }

    entries.sort((a, b) => a.sisaMs - b.sisaMs);

    const stats = groupCache.getStats();
    const totalReq = stats.hits + stats.misses;
    const hitRate = totalReq > 0 ? Math.round((stats.hits / totalReq) * 100) : 0;

    const sections = [];
    for (let i = 0; i < entries.length; i += 5) {
      const chunk = entries.slice(i, i + 5);
      sections.push({
        title: `Grup ${i + 1}–${Math.min(i + 5, entries.length)}${keyword ? ` (cari: "${text}")` : ""}`,
        rows: chunk.map((e) => ({
          title: e.nama.length > 24 ? e.nama.slice(0, 22) + "…" : e.nama,
          description: `👥 ${e.participants} • TTL ${fmtDuration(e.sisaMs)} • ${fmtBytes(e.size)}`,
          id: ID.action("hapus", e.jid),
        })),
      });
    }

    if (!keyword) {
      sections[sections.length - 1].rows.push({
        title: "🗑️ Hapus Semua Cache",
        description: `Total ${entries.length} grup`,
        id: ID.action("hapussemua", "all"),
      });
    }

    try {
      await sock.sendButton(m.chat, null,
        `◈── *Cache Manager* ──◈\n\n` +
        `📦 *Cached:* ${entries.length}${keyword ? `/${keys.length}` : ""} grup\n` +
        `✅ *Hits:* ${stats.hits}   ❌ *Miss:* ${stats.misses}   📊 *Rate:* ${hitRate}%\n\n` +
        `Diurutkan dari yang paling cepat expired. Pilih grup untuk hapus cache-nya.`,
        m,
        {
          footer: "Cache TTL: 5 menit • .cachestats buat ringkasan",
          buttons: [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "Pilih Aksi",
              sections,
            }),
          }],
          contextInfo: {
            mentionedJid: [m.sender],
            isForwarded: true,
            forwardingScore: 9,
          },
        }
      );
    } catch (e) {
      
      const lines = entries.map((e, i) =>
        `${i + 1}. *${e.nama}*\n   👥 ${e.participants} • TTL ${fmtDuration(e.sisaMs)} • ${fmtBytes(e.size)}`
      );
      await m.reply(
        `◈── *Cache Manager* ──◈\n\n` +
        `📦 *Cached:* ${entries.length}${keyword ? `/${keys.length}` : ""} grup\n` +
        `✅ *Hits:* ${stats.hits}   ❌ *Miss:* ${stats.misses}   📊 *Rate:* ${hitRate}%\n\n` +
        lines.join("\n") +
        `\n\nKetik *.clearcache* untuk hapus semua, *.cachestats* untuk ringkasan.`
      );
    }
    return;
  }

  if (cmd === "clearcache") {
    const jumlah = groupCache.keys().length;
    if (jumlah === 0) return m.reply(`📭 Cache sudah kosong.`);
    groupCache.flushAll();
    return m.reply(
      `◈── *Cache Manager* ──◈\n\n` +
      `🗑️ Berhasil hapus *${jumlah} cache* grup.\n` +
      `Cache akan diisi ulang otomatis saat ada pesan masuk.`
    );
  }

  if (cmd === "cachegc") {
    if (!m.isGroup) return m.reply(`⚠️ Jalankan di dalam grup.`);
    const ada = groupCache.has(m.chat);
    if (!ada) return m.reply(`📭 Grup ini belum ada di cache.`);
    const meta = groupCache.get(m.chat);
    const nama = meta?.subject || m.chat;
    groupCache.del(m.chat);
    return m.reply(
      `◈── *Cache Manager* ──◈\n\n` +
      `🗑️ Cache grup *${nama}* dihapus.\n` +
      `Akan di-fetch ulang saat ada pesan berikutnya.`
    );
  }

  if (cmd === "cacherefresh") {
    if (!m.isGroup) return m.reply(`⚠️ Jalankan di dalam grup.`);
    const before = groupCache.get(m.chat);
    groupCache.del(m.chat);
    try {
      const fresh = await getCachedGroupMetadata(sock, m.chat);
      if (!fresh) return m.reply(`⚠️ Gagal fetch metadata grup ini.`);
      const berubahNama = before?.subject && before.subject !== fresh.subject;
      const berubahAnggota =
        before?.participants?.length !== undefined &&
        before.participants.length !== (fresh.participants?.length || 0);
      return m.reply(
        `◈── *Cache Manager* ──◈\n\n` +
        `🔄 Cache grup ini berhasil di-refresh.\n` +
        `📛 Nama: *${fresh.subject}*${berubahNama ? " _(berubah)_" : ""}\n` +
        `👥 Participant: ${fresh.participants?.length || 0}${berubahAnggota ? " _(berubah)_" : ""}`
      );
    } catch (e) {
      return m.reply(`⚠️ Gagal refresh: ${e.message}`);
    }
  }
}