/**
 * Plugin: blockallmember.js
 * Lokasi: plugins/owner/blockallmember.js
 */

const pluginConfig = {
  name: ["blockallmember", "blockall"],
  alias: ["unblockallmember", "unblockall"],
  category: "owner",
  description: "Block semua member di semua grup yang diikuti bot",
  usage: ".blockallmember",
  example: ".blockallmember",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const command = (m.command || "").toLowerCase();
  const isUnblock = command.startsWith("unblock");

  m.react("🕕");
  await m.reply(`⏳ Mengambil daftar grup...`);

  let allGroups = {};
  try {
    allGroups = await sock.groupFetchAllParticipating();
  } catch (e) {
    m.react("❌");
    return m.reply("❌ Gagal ambil daftar grup: " + e.message);
  }

  const groupIds = Object.keys(allGroups);
  if (!groupIds.length) {
    m.react("❌");
    return m.reply("❌ Bot tidak ada di grup manapun.");
  }

  const skipJids = new Set();

  const botRawId = sock.user?.id || "";
  const botNum = botRawId.replace(/:[\d]+@.*/, "").replace("@s.whatsapp.net", "");
  if (botNum) skipJids.add(botNum + "@s.whatsapp.net");

  try {
    const { default: config } = await import("../../config.js");
    const owners = Array.isArray(config.owner) ? config.owner : [config.owner];
    owners.forEach((o) => {
      if (!o) return;
      const num = o.replace(/[^0-9]/g, "");
      if (num) skipJids.add(num + "@s.whatsapp.net");
    });
  } catch {}

  const memberSet = new Set();

  for (const gid of groupIds) {
    const participants = allGroups[gid]?.participants || [];
    for (const p of participants) {
      
      const jid = p.jid || p.phoneNumber || p.id || (typeof p === "string" ? p : "");
      if (!jid) continue;
      if (!jid.endsWith("@s.whatsapp.net")) continue;
      if (skipJids.has(jid)) continue;
      memberSet.add(jid);
    }
  }

  const members = [...memberSet];
  console.log(`[BlockAll] Total unik: ${members.length} dari ${groupIds.length} grup`);

  if (!members.length) {
    m.react("❌");
    return m.reply(`❌ Tidak ada member yang bisa diproses.\nGrup: ${groupIds.length}`);
  }

  await m.reply(
    `📋 *${members.length} nomor unik* dari *${groupIds.length} grup*\n` +
    `⏳ Mulai ${isUnblock ? "unblock" : "block"}...\n_(bisa makan beberapa menit)_`
  );

  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < members.length; i++) {
    const jid = members[i];
    try {
      await sock.updateBlockStatus(jid, isUnblock ? "unblock" : "block");
      success++;
    } catch (e) {
      const msg = e?.message || "";
      if (
        msg.includes("not-authorized") ||
        msg.includes("item-not-found") ||
        msg.includes("not-found")
      ) {
        skipped++;
      } else {
        failed++;
      }
    }

    if (i > 0 && i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (i > 0 && i % 50 === 0) {
      await m.reply(
        `⏳ Progress: ${i}/${members.length}\n` +
        `✅ ${success} | ❌ ${failed} | ⏭️ ${skipped}`
      ).catch(() => {});
    }
  }

  m.react("✅");
  await m.reply(
    `╭─「 ${isUnblock ? "🔓 Unblock" : "🚫 Block"} Selesai 」\n` +
    `│  Total grup   : ${groupIds.length}\n` +
    `│  Total nomor  : ${members.length}\n` +
    `│  ✅ Berhasil  : ${success}\n` +
    `│  ❌ Gagal     : ${failed}\n` +
    `│  ⏭️ Dilewati  : ${skipped}\n` +
    `╰─────────────────`
  );
}

export { pluginConfig as config, handler };