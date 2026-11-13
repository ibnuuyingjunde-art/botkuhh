import te from "../../src/lib/ichigo-error.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { resolveGroupId } from "../../src/lib/ichigo-sewa.js";
import {
  isPremiumGroup,
  getPremiumGroup,
  formatRemaining,
  normalizeGroupId,
} from "../../src/lib/ichigo-premium-group.js";

const pluginConfig = {
  name: "cekpremgc",
  alias: ["cekgcprem", "statuspremgc", "limitgc", "energigc", "cekpremiumgc"],
  category: "user",
  description: "Cek status premium grup (sisa waktu) beserta limit/energi kamu",
  usage: ".cekpremgc\n.cekpremgc <link/id grup> (owner)",
  example: ".cekpremgc",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function fmtNum(n) {
  if (n === -1 || n === Infinity) return "∞ Unlimited";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Meniru logika pemotongan energi di handler.js supaya hasilnya sama dengan yang terjadi saat command dipakai
function resolveEnergi(m, user) {
  const db = getDatabase();
  const enabledSetting = db.setting("energi");
  const enabled =
    enabledSetting !== undefined
      ? enabledSetting
      : config.energi?.enabled !== false;
  if (!enabled) return { text: "Gratis (sistem energi OFF)", unlimited: true };

  const ownerEnergi = config.energi?.owner ?? -1;
  const premiumEnergi = config.energi?.premium ?? -1;
  const defaultEnergi = config.energi?.default ?? 0;

  const vipActive =
    user?.isVip &&
    (!user.vipExpired ||
      user.vipExpired === -1 ||
      Date.now() < user.vipExpired);

  if ((m.isOwner || m.isPartner) && (ownerEnergi === -1 || user?.energi === -1))
    return { text: "∞ Unlimited (Owner)", unlimited: true };
  if (m.isPremium && (premiumEnergi === -1 || user?.energi === -1))
    return { text: "∞ Unlimited (Premium)", unlimited: true };
  if (vipActive) return { text: "∞ Unlimited (VIP)", unlimited: true };

  const current =
    user?.energi ??
    (m.isOwner || m.isPartner
      ? ownerEnergi
      : m.isPremium
        ? premiumEnergi
        : defaultEnergi);
  return { text: fmtNum(current), unlimited: false, value: current };
}

async function handler(m, { sock }) {
  try {
    const input = (m.args || [])[0] || null;
    let groupId = null;
    let groupName = null;

    if (input) {
      if (!m.isOwner) {
        return m.reply(
          `❌ Cek grup lain hanya untuk owner.\nJalankan *${m.prefix}${m.command}* langsung di dalam grup.`,
        );
      }
      await m.react("🕕");
      const resolved = await resolveGroupId(sock, input);
      if (!resolved) {
        await m.react("❌");
        return m.reply(`❌ Link tidak valid atau grup tidak ditemukan`);
      }
      groupId = normalizeGroupId(resolved.id);
      groupName = resolved.name;
    } else if (m.isGroup) {
      groupId = m.chat;
      groupName = m.groupName || null;
    } else {
      return m.reply(
        `💎 *CEK PREMIUM GRUP*\n\n` +
          `Jalankan *${m.prefix}${m.command}* di dalam grup,\n` +
          `atau (owner) *${m.prefix}${m.command} <link/id grup>*`,
      );
    }

    const active = isPremiumGroup(groupId);
    const data = getPremiumGroup(groupId);
    const db = getDatabase();
    const user = db.getUser(m.sender) || db.setUser(m.sender);
    const inThisGroup = m.isGroup && m.chat === groupId;

    let text = `*〔 💎 CEK PREMIUM GRUP 〕*\n\n`;
    text += `╭─〔 Grup 〕\n`;
    text += `│ Nama    : *${data?.name || groupName || "Unknown"}*\n`;
    text += `│ ID      : ${groupId.split("@")[0]}\n`;

    if (active && data) {
      const expStr = data.isLifetime
        ? "Permanent"
        : new Date(data.expiredAt).toLocaleString("id-ID");
      text += `│ Status  : ✅ *Premium aktif*\n`;
      text += `│ Sisa    : *${formatRemaining(data)}*\n`;
      text += `│ Expired : ${expStr}\n`;
    } else {
      text += `│ Status  : ❌ *Bukan grup premium*\n`;
    }
    text += `╰──\n`;

    if (inThisGroup) {
      const e = resolveEnergi(m, user);
      text += `\n╭─〔 Energi / Limit Kamu 〕\n`;
      text += `│ Energi  : *${e.text}*\n`;
      text += `│ Akses   : ${m.isPremium ? "💎 Premium" : "Free"}\n`;
      text += `╰──\n\n`;
      if (active) {
        text += `💎 Selama grup ini premium, semua member bisa pakai fitur premium.`;
      } else if (!e.unlimited && e.value !== undefined && e.value < 10) {
        text += `⚠️ Energi hampir habis! Beli dengan *${m.prefix}buyenergi*`;
      } else {
        text += `💡 Grup ini belum premium, energi tetap terpakai seperti biasa.`;
      }
    } else if (active) {
      text += `\n💎 Member grup tersebut bisa pakai fitur premium (energi unlimited) selama masih aktif.`;
    }

    await m.react(active ? "💎" : "ℹ️");
    return m.reply(text.trim());
  } catch (error) {
    await m.react("☢");
    console.error("[cekpremgc] Error:", error.message);
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
