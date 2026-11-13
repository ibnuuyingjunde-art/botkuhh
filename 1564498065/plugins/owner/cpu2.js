import os from "os";

const pluginConfig = {
  name: "cpu2",
  alias: ["cek cpu", "cekcpu", "ramcheck", "sysinfo"],
  category: "owner",
  description: "Cek penggunaan CPU & RAM secara manual atau otomatis",
  usage: ".cpu",
  example: ".cpu",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  isEnabled: true,
};

const _pad = (n) => String(n).padStart(2, "0");

function getCpuUsage() {
  return new Promise((resolve) => {
    const cpus1 = os.cpus();
    setTimeout(() => {
      const cpus2 = os.cpus();
      let idle = 0, total = 0;
      cpus2.forEach((cpu, i) => {
        const prev = cpus1[i];
        for (const type in cpu.times) {
          total += cpu.times[type] - prev.times[type];
        }
        idle += cpu.times.idle - prev.times.idle;
      });
      resolve(Math.round(100 - (idle / total) * 100));
    }, 1000);
  });
}

function getRAMInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const persen = Math.round((used / total) * 100);
  const toMB = (b) => (b / 1024 / 1024).toFixed(1);
  return { total: toMB(total), used: toMB(used), free: toMB(free), persen };
}

function getUptime() {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${_pad(h)}j ${_pad(m)}m ${_pad(sec)}d`;
}

function buildBar(persen, total = 10) {
  const filled = Math.round((persen / 100) * total);
  return "▰".repeat(filled) + "▱".repeat(total - filled);
}

function buildReport(cpu, ram) {
  const now = new Date();
  const wita = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const jam = `${_pad(wita.getUTCHours())}.${_pad(wita.getUTCMinutes())}`;

  return [
    `┌─「 *𝖲𝗒𝗌𝗍𝖾𝗆 𝖬𝗈𝗇𝗂𝗍𝗈𝗋* 」`,
    `│`,
    `│  🖥️ *CPU*`,
    `│  • Usage  : *${cpu}%*`,
    `│  • Bar    : ${buildBar(cpu)}`,
    `│  • Core   : *${os.cpus().length} Core*`,
    `│  • Model  : *${os.cpus()[0].model.trim()}*`,
    `│`,
    `│  🧠 *RAM*`,
    `│  • Usage  : *${ram.persen}%*`,
    `│  • Bar    : ${buildBar(ram.persen)}`,
    `│  • Used   : *${ram.used} MB*`,
    `│  • Free   : *${ram.free} MB*`,
    `│  • Total  : *${ram.total} MB*`,
    `│`,
    `│  ⏱️ *Uptime* : *${getUptime()}*`,
    `│  🕐 *WITA*   : *${jam}*`,
    `└──✧`,
  ].join("\n");
}

const CPU_THRESHOLD = 80; 
const RAM_THRESHOLD = 85; 
let autoCheckStarted = false;

function startAutoCheck(sock, ownerNumber) {
  if (autoCheckStarted) return;
  autoCheckStarted = true;

  console.log("[cpu-monitor] Auto check dimulai, interval 10 menit");

  setInterval(async () => {
    try {
      const cpu = await getCpuUsage();
      const ram = getRAMInfo();
      const warnings = [];

      if (cpu > CPU_THRESHOLD) warnings.push(`⚠️ CPU tinggi: *${cpu}%*`);
      if (ram.persen > RAM_THRESHOLD) warnings.push(`⚠️ RAM tinggi: *${ram.persen}%*`);

      if (warnings.length > 0) {
        const msg = [
          `🚨 *AUTO ALERT — SISTEM*`,
          ``,
          warnings.join("\n"),
          ``,
          buildReport(cpu, ram),
        ].join("\n");

        await sock.sendMessage(`${ownerNumber}@s.whatsapp.net`, { text: msg });
        console.log(`[cpu-monitor] Alert terkirim ke owner — CPU: ${cpu}%, RAM: ${ram.persen}%`);
      } else {
        console.log(`[cpu-monitor] Normal — CPU: ${cpu}%, RAM: ${ram.persen}%`);
      }
    } catch (err) {
      console.error("[cpu-monitor] Error:", err.message);
    }
  }, 10 * 60 * 1000); 
}

async function handler(m, { sock, botConfig }) {
  await m.react("⏳");

  const ownerNumber = botConfig?.ownerNumber || botConfig?.owner?.[0];
  if (ownerNumber) startAutoCheck(sock, ownerNumber);

  const cpu = await getCpuUsage();
  const ram = getRAMInfo();
  const report = buildReport(cpu, ram);

  await m.react("✅");
  return m.reply(report);
}

export { pluginConfig as config, handler };