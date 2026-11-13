import { getDatabase } from "./ichigo-database.js";
import * as timeHelper from "./ichigo-time.js";
import { saluranCtx } from "./ichigo-context.js";
import config from "../../config.js";

export function parseDuration(str) {
  if (["lifetime", "permanent", "forever", "unlimited"].includes(str.toLowerCase()))
    return Infinity;
  const match = str.match(/^(\d+)([iIdDmMyYhH])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = { i: 60000, h: 3600000, d: 86400000, m: 2592000000, y: 31536000000 };
  return multiplier[unit] ? Date.now() + value * multiplier[unit] : null;
}

export function formatDuration(str) {
  if (["lifetime", "permanent", "forever", "unlimited"].includes(str.toLowerCase()))
    return "Permanent";
  const match = str.match(/^(\d+)([iIdDmMyYhH])$/);
  if (!match) return str;
  const units = { i: "menit", h: "jam", d: "hari", m: "bulan", y: "tahun" };
  return `${match[1]} ${units[match[2].toLowerCase()] || match[2]}`;
}

export async function resolveGroupId(sock, input) {

  const cleanInput = String(input || "")
    .trim()
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "");

  if (cleanInput.includes("chat.whatsapp.com/")) {
    const inviteCode = cleanInput
      .split("chat.whatsapp.com/")[1]
      ?.split(/[\s?]/)[0]
      ?.replace(/\/+$/, ""); 
    if (!inviteCode) return null;
    try {
      const metadata = await sock.groupGetInviteInfo(inviteCode);
      if (!metadata?.id) return null;
      return { id: metadata.id, name: metadata.subject || "Unknown", inviteCode };
    } catch (e) {

      console.error("[ichigo-sewa] groupGetInviteInfo gagal untuk kode", inviteCode, ":", e?.message || e);
      return null;
    }
  }
  const groupId = cleanInput.includes("@g.us") ? cleanInput : cleanInput + "@g.us";
  try {
    const metadata = await sock.groupMetadata(groupId);
    return { id: groupId, name: metadata?.subject || "Unknown", inviteCode: null };
  } catch {
    return { id: groupId, name: "Unknown", inviteCode: null };
  }
}

export async function tryJoinGroup(sock, inviteCode, groupId, fallbackDurationLabel = "7d") {
  try {
    const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
    const metadata = await sock.groupMetadata(groupId).catch(() => null);
    if (metadata) {
      const isMember = metadata.participants?.some((p) => {
        const pJid = p.id?.split(":")[0] + "@s.whatsapp.net";
        return pJid === botJid || p.id === botJid;
      });
      if (isMember) return { joined: true, reason: "Bot sudah ada di grup" };
    }
  } catch {}

  if (!inviteCode)
    return {
      joined: false,
      reason: "Tidak ada invite code — tambahkan bot ke grup secara manual, lalu daftarkan ulang dengan ID grup",
    };

  try {
    await sock.groupAcceptInvite(inviteCode);
    return { joined: true, reason: "Bot berhasil join grup" };
  } catch (e) {
    const errMsg = e.message || "Gagal join grup";
    if (errMsg.includes("restricted") || errMsg.includes("reachout")) {
      return {
        joined: false,
        reason:
          `Nomor bot dibatasi sementara oleh WA (${errMsg}).\n\n` +
          `*Cara manual:*\n` +
          `1. Tambahkan nomor bot ke grup secara manual\n` +
          `2. Setelah bot masuk, jalankan:\n` +
          `   \`.addsewa <ID_GRUP> ${fallbackDurationLabel}\`\n` +
          `   ID grup bisa dilihat di info grup`,
      };
    }
    return { joined: false, reason: errMsg };
  }
}

/**
 * Fungsi inti nambahin grup ke whitelist sewa + auto join + kirim welcome message.
 * Dipakai oleh plugin command (addsewa.js) MAUPUN internal API (api-internal.js)
 * supaya logicnya cuma ada di satu tempat.
 *
 * @param {object} opts
 * @param {object} opts.sock - instance socket baileys
 * @param {string} opts.input - link invite / id grup
 * @param {string} opts.durationStr - format durasi ("30d", "1m", "lifetime", dst)
 * @param {string} opts.addedBy - identitas yang menambahkan (sender jid / "system-ichigostore")
 * @param {boolean} [opts.sendWelcome=true] - kirim pesan sambutan ke grup atau tidak
 */
export async function addSewaGroup({ sock, input, durationStr, addedBy, sendWelcome = true }) {
  const db = getDatabase();
  if (!db.db.data.sewa) {
    db.db.data.sewa = { enabled: false, groups: {} };
    db.db.write();
  }

  const expiredAt = parseDuration(durationStr);
  if (!expiredAt) {
    throw new Error("Format durasi tidak valid (contoh: 7d, 1m, 1y, lifetime)");
  }

  const result = await resolveGroupId(sock, input);
  if (!result) {
    throw new Error("Grup tidak ditemukan atau link tidak valid");
  }

  const { id: groupId, name: groupName, inviteCode } = result;
  const isLifetime = expiredAt === Infinity;

  db.db.data.sewa.groups[groupId] = {
    name: groupName,
    addedAt: Date.now(),
    expiredAt: isLifetime ? 0 : expiredAt,
    isLifetime,
    addedBy,
  };
  db.db.write();

  const expiredStr = isLifetime
    ? "Permanent"
    : timeHelper.fromTimestamp(expiredAt, "D MMMM YYYY HH:mm");

  const joinResult = await tryJoinGroup(sock, inviteCode, groupId, durationStr);

  if (joinResult.joined && sendWelcome) {
    try {
      await new Promise((r) => setTimeout(r, 2000));
      await sock.sendMessage(groupId, {
        text:
          `👋 *Halo Semuanya!* Perkenalkan, aku ${config.bot?.name || "Bot"}.\n\n` +
          `- Masa sewa : *${formatDuration(durationStr)}*\n` +
          `- Aktif s/d  : *${expiredStr}*\n\n` +
          `Ketik *.menu* untuk melihat semua fitur.`,
        contextInfo: saluranCtx?.() || {},
      });
    } catch {}
  }

  return {
    groupId,
    groupName,
    duration: formatDuration(durationStr),
    expiredAt: isLifetime ? null : expiredAt,
    isLifetime,
    joined: joinResult.joined,
    joinReason: joinResult.reason,
  };
}
