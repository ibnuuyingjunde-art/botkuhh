import fs from "fs";
import path from "path";
import os from "os";
import { getAllPlugins, getCategories } from "../../src/lib/ichigo-plugins.js";

const pluginConfig = {
  name: "dbstats",
  alias: ["dbstat", "dbfull", "dbdetail", "statdb", "fulldbstats"],
  category: "owner",
  description: "Statistik lengkap seluruh database bot (users, groups, premium, owner, partner, sewa, settings, plugin, ukuran file)",
  usage: ".dbstats",
  example: ".dbstats",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function fmt(n) {
  return new Intl.NumberFormat("id-ID").format(Number(n) || 0);
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function fmtDate(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  } catch {
    return "-";
  }
}

function bar(percent, len = 10) {
  const filled = Math.round((percent / 100) * len);
  return "▰".repeat(Math.max(0, Math.min(len, filled))) + "▱".repeat(Math.max(0, len - filled));
}

async function handler(m, { db, config: botConfig }) {
  if (!m.isOwner) {
    return m.reply("❌ *Khusus Owner!*");
  }

  await m.react("📊");

  const now = Date.now();
  const data = db?.db?.data || {};
  const users = data.users || {};
  const groups = data.groups || {};
  const premium = Array.isArray(data.premium) ? data.premium : [];
  const owner = Array.isArray(data.owner) ? data.owner : [];
  const partner = Array.isArray(data.partner) ? data.partner : [];
  const settings = data.settings || {};
  const sewa = data.sewa || { enabled: false, groups: {} };
  const stats = data.stats || {};

  const userList = Object.values(users);
  const totalUsers = userList.length;
  const registeredUsers = userList.filter((u) => u.isRegistered).length;
  const premiumUsersLive = userList.filter((u) => u.isPremium).length;
  const bannedUsers = userList.filter((u) => u.isBanned).length;
  const unlimitedEnergi = userList.filter((u) => u.energi === -1).length;
  const marriedUsers = userList.filter((u) => u.rpg?.spouses?.length > 0).length;
  const clanMembers = userList.filter((u) => u.clanId).length;
  const totalKoin = userList.reduce((a, u) => a + (Number(u.koin) || 0), 0);
  const totalSaldo = userList.reduce((a, u) => a + (Number(u.saldo) || 0), 0);
  const totalExp = userList.reduce((a, u) => a + (Number(u.exp) || 0), 0);
  const avgLevel = totalUsers ? (userList.reduce((a, u) => a + (Number(u.level) || 0), 0) / totalUsers).toFixed(1) : 0;

  const premiumLifetime = premium.filter((p) => p.isLifetime).length;
  const premiumActive = premium.filter((p) => !p.isLifetime && p.expired > now).length;
  const premiumExpired = premium.filter((p) => !p.isLifetime && p.expired <= now).length;

  const groupList = Object.values(groups);
  const totalGroups = groupList.length;
  const gWelcome = groupList.filter((g) => g.welcome).length;
  const gGoodbye = groupList.filter((g) => g.goodbye).length;
  const gAntilink = groupList.filter((g) => g.antilink).length;
  const gAntitoxic = groupList.filter((g) => g.antitoxic).length;
  const gMute = groupList.filter((g) => g.mute).length;
  const gGameOn = groupList.filter((g) => g.game).length;
  const gRpgOn = groupList.filter((g) => g.rpg).length;
  const totalWarnings = groupList.reduce((a, g) => a + (Array.isArray(g.warnings) ? g.warnings.length : 0), 0);
  const totalChatMembersTracked = groupList.reduce(
    (a, g) => a + (g.chatStats ? Object.keys(g.chatStats).length : 0),
    0,
  );

  const sewaGroups = Object.values(sewa.groups || {});
  const sewaLifetime = sewaGroups.filter((s) => s.isLifetime).length;
  const sewaActive = sewaGroups.filter((s) => !s.isLifetime && s.expiredAt > now).length;
  const sewaExpired = sewaGroups.filter((s) => !s.isLifetime && s.expiredAt <= now).length;

  const commandEntries = Object.entries(stats).filter(([k]) => k.startsWith("command_"));
  const topCommands = commandEntries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v], i) => `   ${i + 1}. ${k.replace("command_", "")} — ${fmt(v)}x`)
    .join("\n");

  let totalPlugins = 0;
  let enabledPlugins = 0;
  for (const plugin of getAllPlugins()) {
    if (!plugin?.config) continue;
    totalPlugins++;
    if (plugin.config.isEnabled !== false) enabledPlugins++;
  }
  const totalCategories = getCategories().length;

  const dbDir = db?.dbPath || path.join(process.cwd(), "database", "main");
  let fileSizeLines = [];
  let totalDbSize = 0;
  try {
    const files = fs.readdirSync(dbDir).filter((f) => f.endsWith(".json") || f.endsWith(".db"));
    const sized = files.map((f) => {
      const full = path.join(dbDir, f);
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {}
      return { f, size };
    });
    sized.sort((a, b) => b.size - a.size);
    totalDbSize = sized.reduce((a, s) => a + s.size, 0);
    fileSizeLines = sized.map((s) => `   • ${s.f} — ${fmtBytes(s.size)}`).join("\n");
  } catch {
    fileSizeLines = "   (gagal membaca folder database)";
  }

  const botName = botConfig?.bot?.name || "lyniX's MD";
  const botVersion = botConfig?.bot?.version || "1.0.0";

  const teks = `
📊 *DATABASE STATS — FULL DETAIL*
🤖 ${botName} v${botVersion}
🕐 ${fmtDate(now)}

╭─「 👤 *USERS* 」
│ Total      : ${fmt(totalUsers)}
│ Terdaftar  : ${fmt(registeredUsers)} ${bar((registeredUsers / (totalUsers || 1)) * 100)}
│ Premium    : ${fmt(premiumUsersLive)}
│ Banned     : ${fmt(bannedUsers)}
│ Unlimited  : ${fmt(unlimitedEnergi)} energi
│ Menikah    : ${fmt(marriedUsers)}
│ Anggota Clan: ${fmt(clanMembers)}
│ Avg Level  : ${avgLevel}
│ Total Koin : ${fmt(totalKoin)}
│ Total Saldo: Rp${fmt(totalSaldo)}
│ Total Exp  : ${fmt(totalExp)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 👑 *PREMIUM (premium.json)* 」
│ Total Slot : ${fmt(premium.length)}
│ Lifetime   : ${fmt(premiumLifetime)}
│ Aktif      : ${fmt(premiumActive)}
│ Expired    : ${fmt(premiumExpired)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 👥 *GROUPS* 」
│ Total          : ${fmt(totalGroups)}
│ Welcome ON     : ${fmt(gWelcome)}
│ Goodbye ON     : ${fmt(gGoodbye)}
│ Antilink ON    : ${fmt(gAntilink)}
│ Antitoxic ON   : ${fmt(gAntitoxic)}
│ Mute ON        : ${fmt(gMute)}
│ Game ON        : ${fmt(gGameOn)}
│ RPG ON         : ${fmt(gRpgOn)}
│ Total Warning  : ${fmt(totalWarnings)}
│ Member Tracked : ${fmt(totalChatMembersTracked)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 🏢 *SEWA BOT* 」
│ Status  : ${sewa.enabled ? "✅ Aktif" : "❌ Nonaktif"}
│ Total   : ${fmt(sewaGroups.length)}
│ Lifetime: ${fmt(sewaLifetime)}
│ Aktif   : ${fmt(sewaActive)}
│ Expired : ${fmt(sewaExpired)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 🛡️ *OWNER & PARTNER* 」
│ Owner   : ${fmt(owner.length)}
│ Partner : ${fmt(partner.length)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 ⚙️ *SETTINGS* 」
│ Self Mode  : ${settings.selfMode ? "ON" : "OFF"}
│ Bot Mode   : ${settings.botMode || "-"}
│ Only Group : ${settings.onlyGc ? "ON" : "OFF"}
│ Only Chat  : ${settings.onlyPc ? "ON" : "OFF"}
│ Banned User: ${fmt(settings.bannedUsers?.length || 0)}
│ Error Log  : ${fmt(settings.errorLog?.length || 0)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 📈 *COMMAND USAGE* 」
│ Executed : ${fmt(stats.commandsExecuted || 0)}
│ Errors   : ${fmt(stats.commandErrors || 0)}
│ Top 5:
${topCommands || "   (belum ada data)"}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 🧩 *PLUGINS* 」
│ Total    : ${fmt(totalPlugins)}
│ Enabled  : ${fmt(enabledPlugins)}
│ Disabled : ${fmt(totalPlugins - enabledPlugins)}
│ Kategori : ${fmt(totalCategories)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 💾 *UKURAN FILE DATABASE* 」
${fileSizeLines}
│ ────────────────
│ Total: ${fmtBytes(totalDbSize)}
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

╭─「 🖥️ *SISTEM* 」
│ Platform : ${os.platform()} ${os.arch()}
│ Node     : ${process.version}
│ Uptime   : ${(process.uptime() / 3600).toFixed(1)} jam
╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
`.trim();

  await m.reply(teks);
}

export { pluginConfig as config, handler };