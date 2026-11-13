const pluginConfig = {
  name: "addstamina",
  alias: ["stamina", "addstm", "stm"],
  category: "rpg",
  description: "Kelola stamina user",
  usage: ".addstamina [@user/all] [jumlah]",
  example: ".addstamina @user 100",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

const HARGA_STAMINA = 10;
const MAX_STAMINA_BELI = 500;
const KLAIM_STAMINA = 50;
const KLAIM_COOLDOWN = 6 * 60 * 60 * 1000;

function getMaxStamina(user) {
  return user?.rpg?.maxStamina ?? 100;
}

function getCurrentStamina(user) {
  return user?.rpg?.stamina ?? getMaxStamina(user);
}

async function handler(m, { sock, db }) {
  try {
    const args = m.args || [];
    const subCmd = args[0]?.toLowerCase();

    if (m.isOwner || m.isAdmin) {
      const mentioned = m.mentionedJid?.[0] || m.quoted?.sender;

      if (subCmd === "all") {
        const jumlah = parseInt(args[1]) || 50;
        if (jumlah <= 0 || jumlah > 99999) return m.reply("❌ Jumlah tidak valid (1 - 99999)");

        const allUsers = db.data?.users || {};
        let count = 0;
        for (const jid of Object.keys(allUsers)) {
          const u = db.getUser(jid) || {};
          if (!u.rpg) u.rpg = {};
          const maxStm = getMaxStamina(u);
          u.rpg.stamina = Math.min((u.rpg.stamina ?? 0) + jumlah, maxStm);
          db.setUser(jid, u);
          count++;
        }
        await db.save();
        return await sock.sendMessage(m.chat, {
          text: `✅ *Berhasil Tambah Stamina Semua User*\n\n│ ➕ Jumlah : *+${jumlah} stamina*\n│ 👥 Total  : *${count} user*`,
        }, { quoted: m });
      }

      const targetJid = mentioned || m.sender;
      const jumlah = parseInt(mentioned ? (args[1] || args[0]) : args[0]) || 50;

      if (!isNaN(jumlah) && jumlah > 0) {
        if (jumlah > 99999) return m.reply("❌ Jumlah tidak valid (1 - 99999)");

        const target = db.getUser(targetJid) || {};
        if (!target.rpg) target.rpg = {};
        const maxStm = getMaxStamina(target);
        const sebelum = getCurrentStamina(target);
        target.rpg.stamina = Math.min(sebelum + jumlah, maxStm);

        if (!target.staminaStats) target.staminaStats = {};
        target.staminaStats.totalOwnerAdd = (target.staminaStats.totalOwnerAdd || 0) + 1;

        db.setUser(targetJid, target);
        await db.save();

        const nomor = targetJid.split("@")[0];
        const labelUser = targetJid === m.sender ? "Diri Sendiri" : `@${nomor}`;
        return await sock.sendMessage(m.chat, {
          text: `✅ *Stamina Berhasil Ditambah*\n\n│ 👤 User    : *${labelUser}*\n│ ➕ Tambah  : *+${jumlah}*\n│ 🏃 Sebelum : *${sebelum}*\n│ 🏃 Sesudah : *${target.rpg.stamina}/${maxStm}*`,
          mentions: mentioned ? [mentioned] : [],
        }, { quoted: m });
      }
    }

    if (subCmd === "buy" || subCmd === "beli") {
      const jumlah = parseInt(args[1]) || 0;

      if (!jumlah || jumlah <= 0) {
        return m.reply(`💡 *Cara Beli Stamina*\n\n> Ketik: \`.addstamina buy [jumlah]\`\n> Contoh: \`.addstamina buy 100\`\n\n│ 💰 Harga   : *${HARGA_STAMINA} koin / stamina*\n│ 📦 Maks    : *${MAX_STAMINA_BELI} per transaksi*`);
      }

      if (jumlah > MAX_STAMINA_BELI) return m.reply(`❌ Maksimal beli *${MAX_STAMINA_BELI} stamina* sekaligus.`);

      const user = db.getUser(m.sender) || {};
      if (!user.rpg) user.rpg = {};

      const totalHarga = jumlah * HARGA_STAMINA;
      const koinUser = user.koin || 0;

      if (koinUser < totalHarga) {
        return m.reply(`❌ *Koin Tidak Cukup!*\n\n│ 💰 Koin kamu : *${koinUser.toLocaleString()}*\n│ 💸 Butuh     : *${totalHarga.toLocaleString()}*\n│ 📉 Kurang    : *${(totalHarga - koinUser).toLocaleString()}*`);
      }

      const maxStm = getMaxStamina(user);
      const sebelum = getCurrentStamina(user);

      if (sebelum >= maxStm) return m.reply(`❌ Stamina kamu sudah penuh! (*${sebelum}/${maxStm}*)`);

      const aktualTambah = Math.min(jumlah, maxStm - sebelum);
      const aktualHarga = aktualTambah * HARGA_STAMINA;

      user.koin = koinUser - aktualHarga;
      user.rpg.stamina = sebelum + aktualTambah;

      if (!user.staminaStats) user.staminaStats = {};
      user.staminaStats.totalBeli = (user.staminaStats.totalBeli || 0) + 1;
      user.staminaStats.totalBeliStamina = (user.staminaStats.totalBeliStamina || 0) + aktualTambah;

      db.setUser(m.sender, user);
      await db.save();

      return await sock.sendMessage(m.chat, {
        text: `✅ *Beli Stamina Berhasil!*\n\n╭─〔 🏃 *Stamina* 〕\n│ ➕ Ditambah : *+${aktualTambah}*\n│ 🏃 Sekarang : *${user.rpg.stamina}/${maxStm}*\n╰────────────────⬣\n\n╭─〔 💰 *Koin* 〕\n│ 💸 Bayar    : *-${aktualHarga.toLocaleString()}*\n│ 💰 Sisa     : *${user.koin.toLocaleString()}*\n╰────────────────⬣\n\n│ 🛒 Total Beli: *${user.staminaStats.totalBeli}x*`,
      }, { quoted: m });
    }

    if (subCmd === "claim" || subCmd === "klaim") {
      const user = db.getUser(m.sender) || {};
      if (!user.rpg) user.rpg = {};

      const now = Date.now();
      const lastClaim = user.lastStaminaClaim || 0;
      const elapsed = now - lastClaim;

      if (elapsed < KLAIM_COOLDOWN) {
        const sisaMs = KLAIM_COOLDOWN - elapsed;
        const sisaJam = Math.floor(sisaMs / 3600000);
        const sisaMenit = Math.floor((sisaMs % 3600000) / 60000);
        return m.reply(`⏳ *Klaim Stamina Belum Tersedia*\n\n> Kamu bisa klaim lagi dalam:\n> *${sisaJam} jam ${sisaMenit} menit*`);
      }

      const maxStm = getMaxStamina(user);
      const sebelum = getCurrentStamina(user);

      if (sebelum >= maxStm) return m.reply(`❌ Stamina kamu sudah penuh! (*${sebelum}/${maxStm}*)`);

      const aktualTambah = Math.min(KLAIM_STAMINA, maxStm - sebelum);
      user.rpg.stamina = sebelum + aktualTambah;
      user.lastStaminaClaim = now;

      if (!user.staminaStats) user.staminaStats = {};
      user.staminaStats.totalKlaim = (user.staminaStats.totalKlaim || 0) + 1;
      user.staminaStats.totalKlaimStamina = (user.staminaStats.totalKlaimStamina || 0) + aktualTambah;

      db.setUser(m.sender, user);
      await db.save();

      return await sock.sendMessage(m.chat, {
        text: `✅ *Klaim Stamina Berhasil!*\n\n│ ➕ Dapat    : *+${aktualTambah} stamina*\n│ 🏃 Sekarang : *${user.rpg.stamina}/${maxStm}*\n│ 🎁 Total Klaim: *${user.staminaStats.totalKlaim}x*\n│ ⏳ Klaim lagi: *6 jam lagi*`,
      }, { quoted: m });
    }

    const user = db.getUser(m.sender) || {};
    if (!user.rpg) user.rpg = {};

    const maxStm = getMaxStamina(user);
    const curStm = getCurrentStamina(user);
    const koin = user.koin || 0;
    const staminaStats = user.staminaStats || {};

    const now = Date.now();
    const lastClaim = user.lastStaminaClaim || 0;
    const elapsed = now - lastClaim;
    let klaimStatus = "✅ Tersedia";
    if (elapsed < KLAIM_COOLDOWN) {
      const sisaMs = KLAIM_COOLDOWN - elapsed;
      const sisaJam = Math.floor(sisaMs / 3600000);
      const sisaMenit = Math.floor((sisaMs % 3600000) / 60000);
      klaimStatus = `⏳ ${sisaJam}j ${sisaMenit}m lagi`;
    }

    const staminaBar = () => {
      const filled = Math.round((curStm / maxStm) * 10);
      return "█".repeat(filled) + "░".repeat(10 - filled);
    };

    return await sock.sendMessage(m.chat, {
      text: `🏃 *INFO STAMINA*\n\n╭─〔 📊 *Status* 〕\n│ 🏃 Stamina  : *${curStm}/${maxStm}*\n│ 📊 Bar      : \`${staminaBar()}\`\n│ 💰 Koin     : *${koin.toLocaleString()}*\n╰────────────────⬣\n\n╭─〔 📈 *Statistik* 〕\n│ 🎁 Total Klaim : *${staminaStats.totalKlaim || 0}x* (${staminaStats.totalKlaimStamina || 0} stm)\n│ 🛒 Total Beli  : *${staminaStats.totalBeli || 0}x* (${staminaStats.totalBeliStamina || 0} stm)\n╰────────────────⬣\n\n╭─〔 📋 *Cara Isi Stamina* 〕\n│ 🎁 \`.addstamina claim\` — ${klaimStatus}\n│ 🛒 \`.addstamina buy [jumlah]\`\n│    Harga: *${HARGA_STAMINA} koin/stamina*\n╰────────────────⬣`,
    }, { quoted: m });

  } catch (error) {
    console.error("[addstamina] Error:", error.message);
    await m.reply("❌ Terjadi kesalahan.\n> " + error.message);
  }
}

export default {
  config: pluginConfig,
  handler,
};