import te from "../../src/lib/ichigo-error.js";
import {
  parseDuration,
  formatDuration,
  resolveGroupId,
} from "../../src/lib/ichigo-sewa.js";
import {
  addPremiumGroup,
  normalizeGroupId,
} from "../../src/lib/ichigo-premium-group.js";

const pluginConfig = {
  name: "addpremgc",
  alias: ["addgcprem", "premgc", "addpremiumgc"],
  category: "owner",
  description: "Jadikan grup premium (semua member bisa pakai fitur premium)",
  usage: ".addpremgc <link/id grup> <durasi>\n.addpremgc <durasi> (di dalam grup)",
  example: ".addpremgc https://chat.whatsapp.com/xxx 30d",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const DURATION_RE = /^(\d+[sSiIdDmMyYhH]|lifetime|permanent|forever|unlimited)$/i;

// parseDuration bawaan sewa belum mendukung detik, jadi ditangani di sini
function parseDur(str) {
  const sm = String(str).match(/^(\d+)[sS]$/);
  if (sm) return Date.now() + parseInt(sm[1], 10) * 1000;
  return parseDuration(str);
}

function fmtDur(str) {
  const sm = String(str).match(/^(\d+)[sS]$/);
  if (sm) return `${sm[1]} detik`;
  return formatDuration(str);
}

function helpText(prefix) {
  return (
    `💎 *TAMBAH PREMIUM GRUP*\n\n` +
    `Format: *${prefix}addpremgc <link/id> <durasi>*\n` +
    `Di dalam grup: *${prefix}addpremgc <durasi>*\n\n` +
    `*FORMAT DURASI:*\n` +
    `• 30s = 30 detik\n` +
    `• 30i = 30 menit\n` +
    `• 12h = 12 jam\n` +
    `• 7d = 7 hari\n` +
    `• 1m = 1 bulan (30 hari)\n` +
    `• 1y = 1 tahun\n` +
    `• lifetime = Permanent\n\n` +
    `*CONTOH:*\n` +
    `• ${prefix}addpremgc https://chat.whatsapp.com/xxx 30d\n` +
    `• ${prefix}addpremgc 120363408577012139 7d\n` +
    `• ${prefix}addpremgc 30d _(di dalam grup)_\n\n` +
    `💡 Kalau durasi tidak diisi, default *30 hari*.\n` +
    `💡 Kalau grup sudah premium, durasinya *ditambahkan* (perpanjang).`
  );
}

async function handler(m, { sock }) {
  const args = m.args || [];
  let durationStr = args.find((a) => DURATION_RE.test(a)) || null;
  const input = args.find((a) => !DURATION_RE.test(a)) || null;

  let groupId = null;
  let groupName = null;

  if (input) {
    await m.react("🕕");
    const resolved = await resolveGroupId(sock, input);
    if (!resolved) {
      await m.react("❌");
      return m.reply(`❌ Link tidak valid atau grup tidak ditemukan`);
    }
    groupId = resolved.id;
    groupName = resolved.name;
  } else if (m.isGroup) {
    groupId = m.chat;
    groupName = m.groupName || null;
  } else {
    return m.reply(helpText(m.prefix));
  }

  groupId = normalizeGroupId(groupId);
  if (!groupId || groupId === "@g.us") {
    return m.reply(`❌ ID grup tidak valid`);
  }

  if (!durationStr) durationStr = "30d";
  const expiredAt = parseDur(durationStr);
  if (expiredAt === null) {
    return m.reply(`❌ Format durasi salah\n\n${helpText(m.prefix)}`);
  }
  const durationMs = expiredAt === Infinity ? 0 : expiredAt - Date.now();

  try {
    // coba ambil nama grup terbaru kalau belum ada
    if (!groupName || groupName === "Unknown") {
      try {
        const meta = await sock.groupMetadata(groupId);
        if (meta?.subject) groupName = meta.subject;
      } catch {}
    }

    const { extended, data } = addPremiumGroup({
      groupId,
      name: groupName,
      expiredAt,
      durationMs,
      addedBy: m.sender,
    });

    const expiredStr = data.isLifetime
      ? "Permanent"
      : new Date(data.expiredAt).toLocaleString("id-ID");

    let text = `✅ *PREMIUM GRUP ${extended ? "DIPERPANJANG" : "DITAMBAHKAN"}*\n\n`;
    text += `╭─〔 Detail 〕\n`;
    text += `│ Grup    : *${data.name}*\n`;
    text += `│ ID      : ${groupId.split("@")[0]}\n`;
    text += `│ Durasi  : *${fmtDur(durationStr)}*\n`;
    text += `│ Expired : *${expiredStr}*\n`;
    text += `╰──\n\n`;
    text += `💎 Semua member grup ini sekarang bisa pakai fitur premium.`;

    await m.react("💎");
    await m.reply(text);

    // kabari grup targetnya kalau perintah dijalankan dari chat lain
    if (m.chat !== groupId) {
      try {
        await sock.sendMessage(groupId, {
          text:
            `💎 *GRUP INI SEKARANG PREMIUM*\n\n` +
            `Semua member bisa pakai fitur premium.\n` +
            `Expired: *${expiredStr}*`,
        });
      } catch {}
    }
  } catch (error) {
    await m.react("☢");
    console.error("[addpremgc] Error:", error.message);
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };