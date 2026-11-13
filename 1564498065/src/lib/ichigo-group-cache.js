/**
 * ichigo-group-cache.js
 *
 * SATU sumber cache metadata grup WhatsApp, dipakai bareng-bareng oleh
 * seluruh project (connection.js, handler.js, plugin apapun yang butuh).
 *
 * Sebelumnya ada 2 cache terpisah yang gak saling sinkron:
 *  - `groupCache` (NodeCache) di connection.js
 *  - `global.groupMetadataCache` (Map, shape beda-beda) di connection.js
 *    (chats.upsert) DAN handler.js (welcome/goodbye)
 * Efeknya: satu grup bisa ke-cache di satu tempat tapi dianggap "gak ada"
 * di tempat lain -> sock.groupMetadata() ke server WA dipanggil ulang
 * terus buat grup yang sama = boros API call, salah satu penyumbang
 * "kena limit"/overlimit pas bot aktif di banyak grup rame.
 *
 * In-memory aja (gak di-persist ke disk) -- metadata grup emang sifatnya
 * sementara & gampang di-fetch ulang kalau memang perlu, jadi gak perlu
 * numpuk di file database.
 */

import NodeCache from "node-cache";
import { cacheParticipantLids } from "./ichigo-lid.js";

const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

/**
 * Ambil metadata grup: cache dulu, fetch ke WA cuma kalau cache kosong.
 * Ini yang harus dipakai di mana-mana biar gak ada fetch dobel buat grup
 * yang sama dalam window waktu singkat.
 *
 * Setiap kali dapet metadata baru (fresh dari WA), langsung cache mapping
 * LID -> nomor asli semua participant-nya. Ini yang bikin resolve LID pas
 * welcome/goodbye tetep akurat walaupun member yang bersangkutan udah
 * keluar duluan sebelum kita sempat baca metadata lagi -- selama dia
 * pernah "kelihat" di metadata manapun (join, chat aktif, dsb), nomornya
 * udah kesimpen duluan di cache persisten (database/lid-cache.json).
 */
async function getCachedGroupMetadata(sock, jid) {
  if (!jid) return null;
  const cached = groupCache.get(jid);
  if (cached) return cached;
  try {
    const fresh = await (sock._rawGroupMetadata || sock.groupMetadata.bind(sock))(jid);
    if (fresh) {
      groupCache.set(jid, fresh);
      if (fresh.participants) cacheParticipantLids(fresh.participants);
    }
    return fresh;
  } catch {
    return null;
  }
}

function setCachedGroupMetadata(jid, data) {
  if (!jid || !data) return;
  groupCache.set(jid, data);
  if (data.participants) cacheParticipantLids(data.participants);
}

function invalidateGroupMetadata(jid) {
  if (!jid) return;
  groupCache.del(jid);
}

const _pending = new Map();

/**
 * Bungkus sock.groupMetadata supaya SEMUA pemanggil (plugin, group-protection,
 * getName, dll) otomatis lewat cache yang sama:
 *  - cache hit -> langsung balik, tanpa request ke server WA
 *  - panggilan bersamaan untuk grup yang sama -> digabung jadi 1 request
 *  - error tetap dilempar seperti aslinya (perilaku pemanggil tidak berubah)
 * Cache dibuang otomatis kalau grup berubah (groups.update) atau setelah
 * aksi admin lewat bot (promote/demote, ganti nama/deskripsi/setting).
 */
function wrapSocketGroupMetadata(sock) {
  if (!sock || sock._rawGroupMetadata) return;
  const raw = sock.groupMetadata.bind(sock);
  sock._rawGroupMetadata = raw;

  sock.groupMetadata = async (jid) => {
    if (!jid) return raw(jid);
    const cached = groupCache.get(jid);
    if (cached) return cached;
    let p = _pending.get(jid);
    if (!p) {
      p = raw(jid)
        .then((fresh) => {
          if (fresh) setCachedGroupMetadata(jid, fresh);
          return fresh;
        })
        .finally(() => _pending.delete(jid));
      _pending.set(jid, p);
    }
    return p;
  };

  // Buang cache sebelum handler lain jalan, supaya refetch di handler itu segar.
  sock.ev.on("groups.update", (updates) => {
    for (const u of updates || []) if (u?.id) groupCache.del(u.id);
  });

  const after = (name, jidOf, when = () => true) => {
    const orig = sock[name];
    if (typeof orig !== "function") return;
    sock[name] = async (...args) => {
      const res = await orig.apply(sock, args);
      try { if (when(args)) invalidateGroupMetadata(jidOf(args)); } catch {}
      return res;
    };
  };
  const first = (a) => a[0];
  after("groupParticipantsUpdate", first, (a) => a[2] === "promote" || a[2] === "demote");
  after("groupUpdateSubject", first);
  after("groupUpdateDescription", first);
  after("groupSettingUpdate", first);
  after("groupToggleEphemeral", first);
  after("groupMemberAddMode", first);
  after("groupJoinApprovalMode", first);
}

export { groupCache, getCachedGroupMetadata, setCachedGroupMetadata, invalidateGroupMetadata, wrapSocketGroupMetadata };
