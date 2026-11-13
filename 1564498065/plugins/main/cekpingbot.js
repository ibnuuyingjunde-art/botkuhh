import os from 'os'
import config from '../../config.js'

const pluginConfig = {
  name: "cekpingbot",
  alias: ["info", "botinfo"],
  category: "main",
  description: "Statistik sistem & performa bot",
  usage: ".cekpingbot",
  example: ".cekpingbot",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCpuPercent() {
  function cpuInfo() {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const cpu of cpus) {
      for (const [, val] of Object.entries(cpu.times)) total += val;
      idle += cpu.times.idle;
    }
    return { idle, total };
  }
  const s1 = cpuInfo();
  await sleep(500);
  const s2 = cpuInfo();
  const idleDiff = s2.idle - s1.idle;
  const totalDiff = s2.total - s1.total;
  return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}h`);   
  if (h > 0) parts.push(`${h}j`);
  if (min > 0) parts.push(`${min}m`);
  parts.push(`${s}d`);
  return parts.join(' ');
}

function formatBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function bar(pct, len = 10) {
  const filled = Math.round((pct / 100) * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

function colorPct(pct) {
  return pct < 50 ? '🟢' : pct < 80 ? '🟡' : '🔴';
}

const SCAN_FRAMES = [
  '🔍 *sᴄᴀɴɴɪɴɢ sʏsᴛᴇᴍ...*\n\n╭┈┈⬡「 ⚙️ *sʏsᴛᴇᴍ* 」\n┃ ⏳ Mengambil data CPU...\n╰┈┈┈┈┈┈┈┈⬡',
  '🔍 *sᴄᴀɴɴɪɴɢ sʏsᴛᴇᴍ...*\n\n╭┈┈⬡「 ⚙️ *sʏsᴛᴇᴍ* 」\n┃ ⏳ Mengambil data RAM...\n╰┈┈┈┈┈┈┈┈⬡',
  '🔍 *sᴄᴀɴɴɪɴɢ sʏsᴛᴇᴍ...*\n\n╭┈┈⬡「 ⚙️ *sʏsᴛᴇᴍ* 」\n┃ ⏳ Menghitung uptime...\n╰┈┈┈┈┈┈┈┈⬡',
  '🔍 *sᴄᴀɴɴɪɴɢ sʏsᴛᴇᴍ...*\n\n╭┈┈⬡「 ⚙️ *sʏsᴛᴇᴍ* 」\n┃ ✅ Data terkumpul, menyusun laporan...\n╰┈┈┈┈┈┈┈┈⬡',
];

async function handler(m, { sock }) {
  
  let sent;
  try {
    sent = await sock.sendMessage(m.chat, { text: SCAN_FRAMES[0] }, { quoted: m });
  } catch {
    return m.reply('❌ Gagal mengirim stats.');
  }

  const [cpuPct] = await Promise.all([
    getCpuPercent(),
    (async () => {
      for (let i = 1; i < SCAN_FRAMES.length; i++) {
        await sleep(550);
        try {
          await sock.sendMessage(m.chat, { text: SCAN_FRAMES[i], edit: sent.key });
        } catch { break; }
      }
    })(),
  ]);

  await sleep(400);

  const totalRam   = os.totalmem();
  const freeRam    = os.freemem();
  const usedRam    = totalRam - freeRam;
  const ramPct     = Math.round((usedRam / totalRam) * 100);

  const heapUsed   = process.memoryUsage().heapUsed;
  const heapTotal  = process.memoryUsage().heapTotal;
  const heapPct    = Math.round((heapUsed / heapTotal) * 100);

  const sysUptime  = formatUptime(os.uptime());
  const botUptime  = formatUptime(process.uptime());

  const cpuModel   = os.cpus()[0]?.model?.trim() || 'Unknown';
  const cpuCount   = os.cpus().length;
  const platform   = `${os.type()} ${os.arch()}`;
  const nodeVer    = process.version;

  const ramColor   = colorPct(ramPct);
  const cpuColor   = colorPct(cpuPct);

  const finalText =
    `📊 *sᴛᴀᴛɪsᴛɪᴋ ʙᴏᴛ*\n\n` +

    `╭┈┈⬡「 🤖 *ʙᴏᴛ* 」\n` +
    `┃ 🏷️ Nama: ${config.bot?.name || "lyniX's MD"}\n` +
    `┃ ⏱️ Uptime Bot: ${botUptime}\n` +
    `┃ 🖥️ Uptime Server: ${sysUptime}\n` +
    `┃ 📦 Node.js: ${nodeVer}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +

    `╭┈┈⬡「 🧠 *ᴄᴘᴜ* 」\n` +
    `┃ ${cpuColor} Pemakaian: ${cpuPct}%\n` +
    `┃ ${bar(cpuPct)}\n` +
    `┃ 🔧 Model: ${cpuCount} core\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +

    `╭┈┈⬡「 💾 *ʀᴀᴍ sɪsᴛᴇᴍ* 」\n` +
    `┃ ${ramColor} Terpakai: ${formatBytes(usedRam)} / ${formatBytes(totalRam)} (${ramPct}%)\n` +
    `┃ ${bar(ramPct)}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +

    `╭┈┈⬡「 🟩 *ʜᴇᴀᴘ ɴᴏᴅᴇ* 」\n` +
    `┃ ${colorPct(heapPct)} Heap: ${formatBytes(heapUsed)} / ${formatBytes(heapTotal)} (${heapPct}%)\n` +
    `┃ ${bar(heapPct)}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +

    `╭┈┈⬡「 🖥️ *sᴇʀᴠᴇʀ* 」\n` +
    `┃ 💻 Platform: ${platform}\n` +
    `┃ 🌐 Hostname: ${os.hostname()}\n` +
    `╰┈┈┈┈┈┈┈┈⬡`;

  try {
    await sock.sendMessage(m.chat, { text: finalText, edit: sent.key });
  } catch {
    await m.reply(finalText);
  }
}

export { pluginConfig as config, handler }