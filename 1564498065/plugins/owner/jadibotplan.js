import {
  getJadibotPlans,
  upsertJadibotPlan,
  removeJadibotPlan,
  isJadibotPaymentEnabled,
  isJadibotPaymentEnforced,
  setJadibotPaymentEnabled,
} from "../../src/lib/ichigo-jadibot-plans.js";
import {
  grantJadibotAccess,
  revokeJadibotAccess,
  getJadibotAccessInfo,
  formatDurationLabel,
} from "../../src/lib/ichigo-jadibot-access.js";

const pluginConfig = {
  name: "jadibotplan",
  alias: ["setjadibotplan", "aturjadibot"],
  category: "owner",
  description: "Atur paket harga/durasi jadibot berbayar dan akses gratis manual",
  usage:
    ".jadibotplan\n" +
    ".jadibotplan add <kode> <durasi> <harga>\n" +
    ".jadibotplan del <kode>\n" +
    ".jadibotplan on / off\n" +
    ".jadibotplan grant @user <durasi>\n" +
    ".jadibotplan revoke @user\n" +
    ".jadibotplan cek @user",
  example: ".jadibotplan add 7d 7d 5000",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function extractTarget(m) {
  if (m.quoted?.sender) return m.quoted.sender;
  if (m.mentionedJid?.length) return m.mentionedJid[0];
  const numArg = m.args?.find((a) => /^[0-9]{8,15}$/.test(a));
  if (numArg) return numArg + "@s.whatsapp.net";
  return null;
}

function planListText(prefix) {
  const plans = getJadibotPlans();
  const status = isJadibotPaymentEnabled() ? "🟢 AKTIF (berbayar)" : "🔴 NONAKTIF (gratis semua)";
  // bug fix: kasih tahu owner kalau saklar ON tapi tidak ada paket — jadibot
  // otomatis jatuh ke gratis (fail-open) supaya fitur tidak terkunci total,
  // tapi owner perlu tahu ini supaya tidak salah kira sudah aktif berbayar.
  const misconfigWarning =
    isJadibotPaymentEnabled() && plans.length === 0
      ? `\n⚠️ Saklar ON tapi belum ada paket — jadibot untuk sementara *tetap gratis* sampai ada paket ditambahkan.\n`
      : "";

  if (!plans.length) {
    return `🤖 *ᴊᴀᴅɪʙᴏᴛ ᴘʟᴀɴ*\n\n> Status: ${status}${misconfigWarning}\n❌ Belum ada paket.\nTambah: \`${prefix}jadibotplan add <kode> <durasi> <harga>\``;
  }

  const lines = plans
    .map(
      (p) =>
        `• *${p.code}* — ${p.label} (${formatDurationLabel(p.duration)}) — Rp${Number(p.price).toLocaleString("id-ID")}`,
    )
    .join("\n");

  return (
    `🤖 *ᴊᴀᴅɪʙᴏᴛ ᴘʟᴀɴ*\n\n` +
    `> Status: ${status}${misconfigWarning}\n${lines}\n\n` +
    `> \`${prefix}jadibotplan add <kode> <durasi> <harga>\` — tambah/ubah paket\n` +
    `> \`${prefix}jadibotplan del <kode>\` — hapus paket\n` +
    `> \`${prefix}jadibotplan on\` / \`off\` — nyalakan/matikan wajib bayar\n` +
    `> \`${prefix}jadibotplan grant @user <durasi>\` — kasih akses gratis manual\n` +
    `> \`${prefix}jadibotplan revoke @user\` — cabut akses manual\n` +
    `> \`${prefix}jadibotplan cek @user\` — cek status akses\n\n` +
    `Format durasi: \`7d\` (hari), \`12h\` (jam), \`3m\` (bulan), \`1y\` (tahun), atau \`lifetime\``
  );
}

async function handler(m, { sock }) {
  const sub = (m.args?.[0] || "").toLowerCase();
  const prefix = m.prefix;

  if (!sub) {
    return m.reply(planListText(prefix));
  }

  if (sub === "on" || sub === "off") {
    setJadibotPaymentEnabled(sub === "on");
    await m.react("✅");
    return m.reply(
      sub === "on"
        ? "🟢 Jadibot sekarang *wajib bayar* (kecuali owner/partner/premium/yang sudah punya akses)."
        : "🔴 Jadibot sekarang *gratis* untuk semua orang.",
    );
  }

  if (sub === "add") {
    const [, code, duration, priceStr] = m.args;
    if (!code || !duration || !priceStr) {
      return m.reply(`❌ Format: \`${prefix}jadibotplan add <kode> <durasi> <harga>\`\nContoh: \`${prefix}jadibotplan add 7d 7d 5000\``);
    }
    const price = Number(priceStr.replace(/[^0-9]/g, ""));
    if (!price || price <= 0) {
      return m.reply("❌ Harga tidak valid.");
    }
    try {
      const plan = upsertJadibotPlan({ code, duration, price, label: `Jadibot ${formatDurationLabel(duration)}` });
      await m.react("✅");
      return m.reply(
        `✅ *Paket disimpan*\n\n` +
          `> Kode: *${plan.code}*\n` +
          `> Durasi: *${formatDurationLabel(plan.duration)}*\n` +
          `> Harga: *Rp${plan.price.toLocaleString("id-ID")}*`,
      );
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ ${e.message}`);
    }
  }

  if (sub === "del" || sub === "delete" || sub === "remove") {
    const code = m.args?.[1];
    if (!code) return m.reply(`❌ Format: \`${prefix}jadibotplan del <kode>\``);
    const ok = removeJadibotPlan(code);
    await m.react(ok ? "✅" : "❌");
    return m.reply(ok ? `✅ Paket *${code}* dihapus.` : `❌ Paket *${code}* tidak ditemukan.`);
  }

  if (sub === "grant") {
    const target = extractTarget(m);
    const duration = m.args?.find((a, i) => i > 0 && /^\d+[dhmy]$|^lifetime$/i.test(a));
    if (!target) return m.reply(`❌ Format: \`${prefix}jadibotplan grant @user <durasi>\``);
    try {
      const result = grantJadibotAccess(target, duration || "lifetime");
      await m.react("✅");
      const expiryText = result.isLifetime
        ? "Permanent"
        : new Date(result.expiresAt).toLocaleString("id-ID");
      return m.reply(
        `✅ *Akses jadibot diberikan*\n\n> 👤 @${target.split("@")[0]}\n> ⏳ Sampai: *${expiryText}*`,
        { mentions: [target] },
      );
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ ${e.message}`);
    }
  }

  if (sub === "revoke") {
    const target = extractTarget(m);
    if (!target) return m.reply(`❌ Format: \`${prefix}jadibotplan revoke @user\``);
    revokeJadibotAccess(target);
    await m.react("✅");
    return m.reply(`✅ Akses jadibot manual untuk @${target.split("@")[0]} dicabut.`, {
      mentions: [target],
    });
  }

  if (sub === "cek" || sub === "check") {
    const target = extractTarget(m) || m.sender;
    const info = getJadibotAccessInfo(target);
    let statusText;
    if (info.exempt) statusText = "✅ Gratis (owner/partner/premium)";
    else if (info.isLifetime) statusText = "✅ Aktif — Permanent";
    else if (info.expiresAt) statusText = `✅ Aktif sampai ${new Date(info.expiresAt).toLocaleString("id-ID")}`;
    else statusText = "❌ Tidak punya akses berbayar";

    return m.reply(
      `🔎 *Status Akses Jadibot*\n\n> 👤 @${target.split("@")[0]}\n> ${statusText}`,
      { mentions: [target] },
    );
  }

  return m.reply(planListText(prefix));
}

export { pluginConfig as config, handler };
