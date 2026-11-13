import { enableAutoBackup, disableAutoBackup, getBackupStatus, triggerManualBackup, formatInterval } from '../../src/lib/ichigo-auto-backup.js'
import * as timeHelper from '../../src/lib/ichigo-time.js'
import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'
const pluginConfig = {
  name: "autobackup",
  alias: ["ab"],
  category: "owner",
  description: "Kelola sistem auto backup",
  usage: ".autobackup <on/off/status/now> [interval] [owner/grup]",
  example: ".autobackup on 6h grup",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function parseTarget(rawArg, m) {
  const raw = (rawArg || "").toLowerCase();
  if (!raw) return {};

  if (["owner", "dm", "pribadi"].includes(raw)) {
    return { target: "owner" };
  }

  if (["grup", "group", "gc"].includes(raw)) {
    const chatId = m.chat;
    if (!chatId || !chatId.endsWith("@g.us")) {
      return {
        error:
          "Target *grup* cuma bisa dipilih kalau command ini dijalankan di dalam grup tujuan.",
      };
    }
    return { target: "group", chatId };
  }

  return { error: `Target tidak dikenal: \`${rawArg}\`. Pilih \`owner\` atau \`grup\`.` };
}

function targetLabel(status) {
  if (status.target === "group") {
    return status.targetChatId ? "Grup (tersimpan)" : "Grup (belum ada chat tersimpan)";
  }
  return config.owner?.number?.[0] || "Owner (belum diset)";
}

async function handler(m, { sock }) {
  const args = m.text?.trim().split(/\s+/) || [];
  const action = args[0]?.toLowerCase();

  if (!action) {
    const status = getBackupStatus();

    let txt = `🗂️ *ᴀᴜᴛᴏ ʙᴀᴄᴋᴜᴘ sʏsᴛᴇᴍ*\n\n`;
    txt += `╭┈┈⬡「 📊 *sᴛᴀᴛᴜs* 」\n`;
    txt += `┃ 🔘 Status: ${status.enabled ? "✅ *ON*" : "❌ *OFF*"}\n`;
    txt += `┃ ⏱️ Interval: ${status.interval}\n`;
    txt += `┃ 📅 Last Backup: ${status.lastBackup ? timeHelper.fromTimestamp(status.lastBackup, "DD MMMM YYYY HH:mm:ss") : "-"}\n`;
    txt += `┃ #️⃣ Total: ${status.backupCount} backup\n`;
    txt += `┃ 📤 Dikirim ke: ${targetLabel(status)}\n`;
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`;

    txt += `*ᴄᴀʀᴀ ᴘᴀᴋᴀɪ:*\n`;
    txt += `> \`${m.prefix}autobackup on <interval> [owner/grup]\`\n`;
    txt += `> \`${m.prefix}autobackup off\`\n`;
    txt += `> \`${m.prefix}autobackup status\`\n`;
    txt += `> \`${m.prefix}autobackup now [owner/grup]\`\n\n`;

    txt += `*ꜰᴏʀᴍᴀᴛ ɪɴᴛᴇʀᴠᴀʟ:*\n`;
    txt += `> • \`5m\` = 5 menit\n`;
    txt += `> • \`1h\` = 1 jam\n`;
    txt += `> • \`6h\` = 6 jam\n`;
    txt += `> • \`1d\` = 1 hari\n\n`;

    txt += `*ᴛᴜᴊᴜᴀɴ ʙᴀᴄᴋᴜᴘ:*\n`;
    txt += `> • \`owner\` = dikirim ke DM owner (default kalau tidak diisi)\n`;
    txt += `> • \`grup\` = dikirim ke grup ini (jalankan command-nya di grup tujuan)\n\n`;

    txt += `*ᴄᴏɴᴛᴏʜ:*\n`;
    txt += `> \`${m.prefix}autobackup on 6h grup\` - backup tiap 6 jam, dikirim ke grup ini`;

    return m.reply(txt);
  }

  switch (action) {
    case "on":
    case "enable":
    case "start": {
      const interval = args[1];

      if (!interval) {
        return m.reply(
          `⚠️ *ɪɴᴛᴇʀᴠᴀʟ ᴅɪʙᴜᴛᴜʜᴋᴀɴ*\n\n` +
            `> \`${m.prefix}autobackup on <interval> [owner/grup]\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}autobackup on 30m\` - tiap 30 menit ke owner\n` +
            `> \`${m.prefix}autobackup on 6h grup\` - tiap 6 jam ke grup ini\n` +
            `> \`${m.prefix}autobackup on 1d\` - tiap 1 hari ke owner`,
        );
      }

      const parsedTarget = parseTarget(args[2], m);
      if (parsedTarget.error) {
        return m.reply(`⚠️ ${parsedTarget.error}`);
      }

      const result = enableAutoBackup(interval, sock, {
        target: parsedTarget.target || "owner",
        chatId: parsedTarget.chatId,
      });

      if (!result.success) {
        return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> ${result.error}`);
      }

      const destLabel =
        result.target === "group" ? "Grup ini" : config.owner?.number?.[0] || "Owner #1";

      await m.react("✅");
      return m.reply(
        `✅ *ᴀᴜᴛᴏ ʙᴀᴄᴋᴜᴘ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n\n` +
          `╭┈┈⬡「 ⚙️ *sᴇᴛᴛɪɴɢs* 」\n` +
          `┃ ⏱️ Interval: ${result.interval}\n` +
          `┃ 📤 Dikirim ke: ${destLabel}\n` +
          `┃ 📦 Exclude: node_modules, .git, storages, dll\n` +
          `╰┈┈┈┈┈┈┈┈⬡\n\n` +
          `> Backup pertama akan dikirim dalam ${result.interval}`,
      );
    }

    case "off":
    case "disable":
    case "stop": {
      disableAutoBackup();

      await m.react("✅");
      return m.reply(
        `❌ *ᴀᴜᴛᴏ ʙᴀᴄᴋᴜᴘ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ*\n\n` +
          `> Backup otomatis sudah dihentikan.\n` +
          `> Gunakan \`${m.prefix}autobackup on <interval>\` untuk mengaktifkan kembali.`,
      );
    }

    case "status":
    case "info": {
      const status = getBackupStatus();

      let txt = `🗂️ *sᴛᴀᴛᴜs ᴀᴜᴛᴏ ʙᴀᴄᴋᴜᴘ*\n\n`;
      txt += `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n`;
      txt += `┃ 🔘 Enabled: ${status.enabled ? "✅ Ya" : "❌ Tidak"}\n`;
      txt += `┃ ⏱️ Interval: ${status.interval}\n`;
      txt += `┃ 🔄 Running: ${status.isRunning ? "✅ Ya" : "❌ Tidak"}\n`;
      txt += `┃ 📅 Last: ${status.lastBackup ? timeHelper.fromTimestamp(status.lastBackup, "DD MMMM YYYY HH:mm:ss") : "-"}\n`;
      txt += `┃ #️⃣ Total: ${status.backupCount} backup\n`;
      txt += `┃ 📤 Target: ${targetLabel(status)}\n`;
      txt += `╰┈┈┈┈┈┈┈┈⬡`;

      return m.reply(txt);
    }

    case "now":
    case "manual":
    case "trigger": {
      const parsedTarget = parseTarget(args[1], m);
      if (parsedTarget.error) {
        return m.reply(`⚠️ ${parsedTarget.error}`);
      }

      await m.react("🕕");
      await m.reply(
        `🕕 *ᴍᴇᴍʙᴜᴀᴛ ʙᴀᴄᴋᴜᴘ...*\n\n> Mohon tunggu, sedang membuat backup...`,
      );

      try {
        await triggerManualBackup(sock, parsedTarget);
        await m.react("✅");

        const dest =
          parsedTarget.target === "group"
            ? "grup ini"
            : parsedTarget.target === "owner"
              ? "owner"
              : "tujuan tersimpan";

        return m.reply(
          `✅ *ʙᴀᴄᴋᴜᴘ sᴇʟᴇsᴀɪ*\n\n> Backup telah dikirim ke ${dest}!`,
        );
      } catch (error) {
        await m.react('☢');
        await m.reply(te(m.prefix, m.command, m.pushName));
      }
    }
    break;

    default:
      return m.reply(
        `⚠️ *ᴀᴄᴛɪᴏɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
          `> Pilih: \`on\`, \`off\`, \`status\`, atau \`now\`\n` +
          `> Contoh: \`${m.prefix}autobackup on 6h grup\``,
      );
  }
}

export { pluginConfig as config, handler }