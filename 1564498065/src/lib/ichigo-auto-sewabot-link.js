import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";
import { addSewaGroup } from "./ichigo-sewa.js";
import { generateConfirmation } from "./ichigo-gemini-confirm.js";

const GROUP_LINK_RE = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i;

/**
 * Dipanggil untuk SETIAP pesan masuk (mirip handleAutoDownload / handleAlbumSticker).
 * Return true kalau pesan ini "diserap" jadi bagian dari proses redeem sewabot.
 */
export async function handleSewabotGroupLink(m, sock) {
  const db = getDatabase();
  const user = db.getUser(m.sender);
  const pending = user?.pendingSewabotGroupLink;
  if (!pending?.waiting) return false;

  const text = m.body || m.text || "";
  const linkMatch = text.match(GROUP_LINK_RE);

  if (!linkMatch) {

    const trimmed = text.trim().toLowerCase();
    if (["batal", "cancel"].includes(trimmed)) {
      db.setUser(m.sender, { pendingSewabotGroupLink: null });
      try {
        await sock.sendMessage(m.chat, {
          text: "❌ Redeem dibatalkan. Link tidak akan diproses lagi untuk transaksi ini.",
        });
      } catch (_) {}
      return true;
    }
    return false
  }

  db.setUser(m.sender, { pendingSewabotGroupLink: null });

  const inviteLink = linkMatch[0];

  try {
    await sock.sendMessage(m.chat, { text: "🕕 Memproses join grup..." });

    const result = await addSewaGroup({
      sock,
      input: inviteLink,
      durationStr: pending.plan.duration,
      addedBy: m.sender,
      sendWelcome: true,
    });

    const fallback = result.joined
      ? `✅ *Berhasil!* Bot sudah bergabung ke grup *${result.groupName}*.\n\n` +
        `Paket: *${pending.plan.label}*\nAktif s/d: *${result.isLifetime ? "Permanent" : new Date(result.expiredAt).toLocaleString("id-ID")}*`
      : `⚠️ Grup sudah terdaftar (paket *${pending.plan.label}*), tapi bot gagal auto-join.\n\n` +
        `Alasan: ${result.joinReason}\n\nHubungi owner kalau butuh bantuan join manual.`;

    const msg = await generateConfirmation(
      {
        event: result.joined ? "sewabot_join_sukses" : "sewabot_join_gagal",
        grup: result.groupName,
        paket: pending.plan.label,
        alasan_gagal: result.joined ? null : result.joinReason,
      },
      fallback,
    );

    await sock.sendMessage(m.chat, { text: msg });
  } catch (e) {
    try {
      await sock.sendMessage(m.chat, {
        text: `❌ Gagal memproses link grup: ${e.message}\n\nHubungi owner untuk bantuan manual.`,
      });
    } catch (_) {}
  }

  return true;
}
