/**
 * Plugin: autoblockjoin.js
 * Lokasi: plugins/owner/autoblockjoin.js
 */

const pluginConfig = {
  name: ["autoblockjoin", "abj"],
  alias: [],
  category: "owner",
  description: "Auto-block semua member grup (existing + join baru)",
  usage: ".autoblockjoin [on/off]",
  example: ".autoblockjoin on",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function normalizeJid(jid = "") {
  return jid.replace(/:[\d]+@/, "@");
}

async function getSkipJids(sock) {
  const skip = new Set();
  const botRaw = sock.user?.id || "";
  const botNum = botRaw.replace(/:[\d]+@.*/, "").replace("@s.whatsapp.net", "");
  if (botNum) skip.add(botNum + "@s.whatsapp.net");
  try {
    const { default: config } = await import("../../config.js");
    const owners = Array.isArray(config.owner) ? config.owner : [config.owner];
    owners.forEach((o) => {
      if (!o) return;
      const n = o.replace(/[^0-9]/g, "");
      if (n) skip.add(n + "@s.whatsapp.net");
    });
  } catch {}
  return skip;
}

/**
 * Block batch — kirim multiple JID sekaligus dalam 1 IQ node
 */
async function blockBatch(sock, jids) {
  const { proto } = await import("ichigo");
  return sock.query({
    tag: "iq",
    attrs: {
      xmlns: "blocklist",
      to: "@s.whatsapp.net",
      type: "set",
    },
    content: jids.map((jid) => ({
      tag: "item",
      attrs: { action: "block", jid },
    })),
  });
}

/**
 * Block semua member existing di semua grup
 */
async function blockAllExisting(sock, m) {
  try {
    let allGroups = {};
    try {
      allGroups = await sock.groupFetchAllParticipating();
    } catch (e) {
      if (m) m.reply("❌ Gagal ambil daftar grup: " + e?.message);
      return;
    }

    const groupIds = Object.keys(allGroups);
    if (!groupIds.length) {
      if (m) m.reply("❌ Bot tidak ada di grup manapun.");
      return;
    }

    const skipJids = await getSkipJids(sock);
    const memberSet = new Set();

    for (const gid of groupIds) {
      const participants = allGroups[gid]?.participants || [];
      for (const p of participants) {
        const jid = normalizeJid(p.jid || p.phoneNumber || p.id || (typeof p === "string" ? p : ""));
        if (!jid || !jid.endsWith("@s.whatsapp.net")) continue;
        if (skipJids.has(jid)) continue;
        memberSet.add(jid);
      }
    }

    const members = [...memberSet];
    console.log(`[AutoBlockJoin] Total: ${members.length} dari ${groupIds.length} grup`);

    if (!members.length) {
      if (m) m.reply("❌ Tidak ada member yang bisa diblock.");
      return;
    }

    if (m) await m.reply(
      `📋 *${members.length} nomor* dari *${groupIds.length} grup*\n` +
      `⏳ Mulai block...\n_(bisa makan beberapa menit)_`
    );

    let success = 0, failed = 0;
    const BATCH = 5; 

    for (let i = 0; i < members.length; i += BATCH) {
      const batch = members.slice(i, i + BATCH);
      try {
        
        await blockBatch(sock, batch);
        success += batch.length;
      } catch (batchErr) {
        console.warn(`[AutoBlockJoin] Batch gagal, coba satu-satu:`, batchErr?.message);
        
        for (const jid of batch) {
          try {
            await sock.updateBlockStatus(jid, "block");
            success++;
          } catch (e) {
            failed++;
            console.error(`[AutoBlockJoin] Gagal ${jid}:`, e?.message);
          }
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      await new Promise((r) => setTimeout(r, 2000));

      if (m && i > 0 && i % 50 === 0) {
        await m.reply(
          `⏳ Progress: ${Math.min(i + BATCH, members.length)}/${members.length}\n` +
          `✅ ${success} | ❌ ${failed}`
        ).catch(() => {});
      }
    }

    console.log(`[AutoBlockJoin] Selesai — ✅ ${success} | ❌ ${failed}`);
    if (m) await m.reply(
      `╭─「 🚫 *Block Selesai* 」\n` +
      `│  Total grup  : ${groupIds.length}\n` +
      `│  Total nomor : ${members.length}\n` +
      `│  ✅ Berhasil : ${success}\n` +
      `│  ❌ Gagal    : ${failed}\n` +
      `╰─────────────────`
    );
  } catch (e) {
    console.error("[AutoBlockJoin] Error:", e?.message);
  }
}

/**
 * Block member yang baru join
 */
async function onMemberJoin(sock, groupJid, participantJid, db) {
  try {
    const isOn = db.setting("autoBlockJoin") ?? false;
    if (!isOn) return;

    const skipJids = await getSkipJids(sock);
    const jid = normalizeJid(participantJid);
    if (skipJids.has(jid) || !jid.endsWith("@s.whatsapp.net")) return;

    console.log(`[AutoBlockJoin] Block join: ${jid}`);
    await sock.updateBlockStatus(jid, "block");
    console.log(`[AutoBlockJoin] ✅ Block join berhasil: ${jid}`);
  } catch (e) {
    console.error(`[AutoBlockJoin] ❌ Gagal block join ${participantJid}:`, e?.message);
  }
}

/**
 * Command handler
 */
async function handler(m, { sock }) {
  const { getDatabase } = await import("../../src/lib/ichigo-database.js").catch(
    () => import("../src/lib/ichigo-database.js")
  );
  const db = getDatabase();
  const sub = (m.text || "").trim().toLowerCase();

  if (!sub || sub === "status") {
    const isOn = db.setting("autoBlockJoin") ?? false;
    return m.reply(
      `╭─「 🚫 *Auto Block Join* 」\n` +
      `│  Status : ${isOn ? "✅ Aktif" : "❌ Nonaktif"}\n` +
      `╰─ *.autoblockjoin on/off*`
    );
  }

  if (sub === "on") {
    db.setting("autoBlockJoin", true);
    await db.save();
    m.react("🕕");
    await blockAllExisting(sock, m);
    m.react("✅");
    return;
  }

  if (sub === "off") {
    db.setting("autoBlockJoin", false);
    await db.save();
    return m.reply("❌ Auto-block join *dinonaktifkan*.");
  }

  return m.reply("📌 Gunakan: *.autoblockjoin on/off*");
}

export { pluginConfig as config, handler, onMemberJoin };