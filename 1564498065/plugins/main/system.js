import os from 'os'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile);
const pluginConfig = {
    name: 'system',
    alias: ['ram', 'cpu', 'disk', 'latency', 'ping'],
    category: 'main',
    description: 'Menampilkan informasi sistem (RAM, CPU, Disk, Latency)',
    usage: '.ram | .cpu | .disk | .ping',
    isGroup: false,
    isBotAdmin: false,
    isAdmin: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
};

// Format ala panel Pterodactyl (KiB/MiB/GiB, 2 desimal)
function formatSize(bytes) {
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    if (!bytes || bytes <= 0) return '0 B';
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

function readNum(path) {
    try {
        const v = fs.readFileSync(path, 'utf8').trim();
        if (v === 'max') return Infinity;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

function readStat(path) {
    try {
        return Object.fromEntries(
            fs.readFileSync(path, 'utf8').trim().split('\n').map(l => {
                const [k, v] = l.split(' ');
                return [k, Number(v)];
            })
        );
    } catch {
        return {};
    }
}

// Baca RAM milik CONTAINER (sama dengan angka di panel Pterodactyl).
// os.totalmem()/os.freemem() membaca RAM seluruh node/host, bukan jatah server.
// Panel menghitung: pemakaian cgroup dikurangi cache file yang tidak aktif.
function getContainerMemory() {
    // cgroup v2
    let used = readNum('/sys/fs/cgroup/memory.current');
    if (used !== null) {
        const st = readStat('/sys/fs/cgroup/memory.stat');
        return {
            used: Math.max(0, used - (st.inactive_file || 0)),
            limit: readNum('/sys/fs/cgroup/memory.max') ?? Infinity,
            source: 'cgroup v2'
        };
    }
    // cgroup v1
    used = readNum('/sys/fs/cgroup/memory/memory.usage_in_bytes');
    if (used !== null) {
        const st = readStat('/sys/fs/cgroup/memory/memory.stat');
        return {
            used: Math.max(0, used - (st.total_inactive_file || st.inactive_file || 0)),
            limit: readNum('/sys/fs/cgroup/memory/memory.limit_in_bytes') ?? Infinity,
            source: 'cgroup v1'
        };
    }
    return null;
}

function getRamText() {
    const mu = process.memoryUsage();
    // RSS = RAM fisik yang dipakai proses Node (heap + kode + buffer + native)
    const botText = `🤖 *Proses Bot (Node)*\n` +
                    `RSS: ${formatSize(mu.rss)}\n` +
                    `Heap: ${formatSize(mu.heapUsed)} / ${formatSize(mu.heapTotal)}`;
    const mem = getContainerMemory();

    // RAM VPS/node: os.totalmem() & os.freemem() membaca RAM seluruh mesin,
    // jadi sudah termasuk pemakaian server/container lain di VPS yang sama.
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const vps = `🖥️ *VPS / Node*\nTotal: ${formatSize(total)}\nUsed: ${formatSize(used)}\nFree: ${formatSize(free)}\nUse%: ${((used / total) * 100).toFixed(1)}%`;

    if (!mem) {
        // Tidak ada cgroup (misal jalan di Windows/laptop): tampilkan proses bot + VPS
        return `💻 *RAM USAGE*\n\n${botText}\n\n${vps}`;
    }

    // Limit lebih besar dari RAM host = praktis tanpa batas (tampil ∞ seperti di panel)
    const unlimited = !Number.isFinite(mem.limit) || mem.limit > total;
    let panel = `📦 *Panel (container)*\n` +
                `Used: ${formatSize(mem.used)}\n` +
                `Limit: ${unlimited ? '∞ (tanpa batas)' : formatSize(mem.limit)}`;
    if (!unlimited) {
        const pct = (mem.used / mem.limit) * 100;
        panel += `\nTerpakai: ${pct.toFixed(1)}%\nFree: ${formatSize(Math.max(0, mem.limit - mem.used))}`;
    }

    return `💻 *RAM USAGE*\n\n${panel}\n\n${botText}\n\n${vps}`;
}

// Folder server di panel Pterodactyl = folder tempat bot dijalankan (/home/container).
const PANEL_DIR = process.cwd();
// Opsional: isi env PANEL_DISK_MB (sesuai limit disk di panel) kalau mau tampil persennya.
// Limit disk tidak bisa dibaca dari dalam container, jadi harus diisi manual.
const PANEL_DISK_LIMIT = (Number(process.env.PANEL_DISK_MB) || 0) * 1024 * 1024;

let panelDiskCache = { at: 0, bytes: 0 };

async function walkSize(dir) {
    let total = 0;
    let entries = [];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        try {
            if (e.isDirectory()) total += await walkSize(p);
            else total += (await fs.promises.lstat(p)).size;
        } catch {}
    }
    return total;
}

// Ukuran folder server (angka yang setara dengan "Disk" di panel). Di-cache 60 detik.
async function getPanelDiskBytes() {
    if (Date.now() - panelDiskCache.at < 60_000) return panelDiskCache.bytes;
    let bytes;
    try {
        const { stdout } = await execFileAsync('du', ['-sk', PANEL_DIR], { timeout: 20_000 });
        bytes = parseInt(stdout.split(/\s+/)[0], 10) * 1024;
        if (!Number.isFinite(bytes)) throw new Error('du gagal');
    } catch {
        bytes = await walkSize(PANEL_DIR); // cadangan (Windows / tanpa du)
    }
    panelDiskCache = { at: Date.now(), bytes };
    return bytes;
}

// Disk VPS/node: partisi yang terlihat dari dalam container.
async function getHostDisk() {
    const root = path.parse(PANEL_DIR).root || '/';
    if (typeof fs.statfsSync === 'function') {
        const st = fs.statfsSync(root);
        const total = st.blocks * st.bsize;
        const free = st.bavail * st.bsize;
        const used = (st.blocks - st.bfree) * st.bsize;
        return { total, used, free };
    }
    const { stdout } = await execFileAsync('df', ['-k', '-P', root]);
    const p = stdout.trim().split('\n')[1].replace(/\s+/g, ' ').split(' ');
    return { total: p[1] * 1024, used: p[2] * 1024, free: p[3] * 1024 };
}

async function getDiskUsage() {
    let text = `💿 *DISK USAGE*\n`;

    try {
        const used = await getPanelDiskBytes();
        text += `\n📦 *Panel (folder server)*\nUsed: ${formatSize(used)}\n`;
        if (PANEL_DISK_LIMIT > 0) {
            text += `Limit: ${formatSize(PANEL_DISK_LIMIT)} (${((used / PANEL_DISK_LIMIT) * 100).toFixed(1)}%)\n`;
        } else {
            text += `Limit: ∞ (tanpa batas)\n`;
        }
    } catch {
        text += `\n📦 *Panel (folder server)*\n❌ Gagal membaca ukuran folder\n`;
    }

    try {
        const d = await getHostDisk();
        const pct = (d.used + d.free) ? ((d.used / (d.used + d.free)) * 100).toFixed(1) : '0.0'; // sama rumus dengan df
        text += `\n🖥️ *VPS / Node*\nTotal: ${formatSize(d.total)}\nUsed: ${formatSize(d.used)}\nFree: ${formatSize(d.free)}\nUse%: ${pct}%`;
    } catch {
        text += `\n🖥️ *VPS / Node*\n❌ Gagal membaca disk VPS`;
    }

    return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const mnt = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${d ? d + 'd ' : ''}${h}h ${mnt}m ${s}s`;
}

// Total waktu CPU yang dipakai container (mikrodetik). Sumber yang sama dengan panel.
function readCpuUsageUsec() {
    const v2 = readStat('/sys/fs/cgroup/cpu.stat'); // cgroup v2
    if (Number.isFinite(v2.usage_usec)) return v2.usage_usec;
    for (const p of [ // cgroup v1 (nanodetik)
        '/sys/fs/cgroup/cpuacct/cpuacct.usage',
        '/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage',
        '/sys/fs/cgroup/cpu/cpuacct.usage'
    ]) {
        const n = readNum(p);
        if (n !== null && Number.isFinite(n)) return n / 1000;
    }
    return null;
}

// Limit CPU container dalam persen (100 = 1 core). Infinity = tanpa batas (tampil ∞ di panel).
function getCpuLimit() {
    try { // cgroup v2: "max 100000" atau "200000 100000"
        const raw = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim().split(' ');
        if (raw[0] === 'max') return Infinity;
        const quota = Number(raw[0]);
        const period = Number(raw[1]) || 100000;
        if (quota > 0) return (quota / period) * 100;
    } catch {}
    const quota = readNum('/sys/fs/cgroup/cpu/cpu.cfs_quota_us') ?? readNum('/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us');
    const period = readNum('/sys/fs/cgroup/cpu/cpu.cfs_period_us') ?? readNum('/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us');
    if (quota !== null && quota > 0 && period > 0) return (quota / period) * 100;
    return Infinity;
}

function hostCpuTimes() {
    let idle = 0, total = 0;
    for (const c of os.cpus()) {
        for (const t of Object.values(c.times)) total += t;
        idle += c.times.idle;
    }
    return { idle, total };
}

async function getCpuText() {
    // CPU itu laju, bukan angka sesaat: ambil dua sampel dengan jeda 1 detik.
    const SAMPLE_MS = 1000;
    const cg0 = readCpuUsageUsec();
    const h0 = hostCpuTimes();
    const p0 = process.cpuUsage();
    const t0 = process.hrtime.bigint();
    await sleep(SAMPLE_MS);
    const cg1 = readCpuUsageUsec();
    const h1 = hostCpuTimes();
    const p1 = process.cpuUsage();
    const wallUs = Number(process.hrtime.bigint() - t0) / 1000;

    const botPct = (((p1.user + p1.system) - (p0.user + p0.system)) / wallUs) * 100;
    const hostTotalD = h1.total - h0.total;
    const hostPct = hostTotalD > 0 ? (1 - (h1.idle - h0.idle) / hostTotalD) * 100 : 0;

    let panel;
    if (cg0 !== null && cg1 !== null) {
        const pct = Math.max(0, ((cg1 - cg0) / wallUs) * 100); // 100% = 1 core, sama seperti panel
        const limit = getCpuLimit();
        panel = `📦 *Panel (container)*\n` +
                `Load: ${pct.toFixed(2)}%\n` +
                `Limit: ${Number.isFinite(limit) ? limit.toFixed(0) + '%' : '∞ (tanpa batas)'}\n` +
                `Proses Bot: ${Math.max(0, botPct).toFixed(2)}%\n` +
                `Bot Uptime: ${formatUptime(process.uptime())}`;
    } else {
        // Tidak ada cgroup (misal jalan di Windows/laptop): tampilkan proses bot saja
        panel = `📦 *Proses Bot*\n` +
                `Load: ${Math.max(0, botPct).toFixed(2)}%\n` +
                `Bot Uptime: ${formatUptime(process.uptime())}`;
    }

    // os.cpus() membaca seluruh mesin, jadi ini CPU VPS/node (termasuk server lain di VPS yang sama).
    const cpus = os.cpus();
    const [l1, l5, l15] = os.loadavg();
    let vps = `🖥️ *VPS / Node*\n` +
              `Model: ${cpus[0]?.model || '-'}\n` +
              (cpus[0]?.speed ? `Speed: ${cpus[0].speed} MHz\n` : '') +
              `Cores: ${cpus.length} Core(s)\n` +
              `Load: ${Math.max(0, hostPct).toFixed(1)}%\n`;
    if (process.platform !== 'win32') {
        vps += `Load Avg: ${l1.toFixed(2)} | ${l5.toFixed(2)} | ${l15.toFixed(2)}\n`;
    }
    vps += `Uptime: ${formatUptime(os.uptime())}`;

    return `🖥️ *CPU INFO*\n\n${panel}\n\n${vps}`;
}

async function handler(m, { sock }) {
    let command = m.command.toLowerCase();
    if (command === 'ping') command = 'latency'; // alias ping sebelumnya tidak punya case

    try {
        switch (command) {
            case 'ram': {
                m.reply(getRamText());
            }
            break;

            case 'cpu': {
                m.reply(await getCpuText());
            }
            break;

            case 'disk': {
                const diskInfo = await getDiskUsage();
                m.reply(diskInfo);
            }
            break;

            case 'latency': {
                const timestamp = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
                const now = Date.now();
                const latency = now - timestamp;
                let speed = '';
                if (latency < 100) speed = '🚀 Fast';
                else if (latency < 500) speed = '⚡ Good';
                else if (latency < 1000) speed = '🐢 Oke';
                else speed = '🐌 Slow';
                m.reply(`📶 *Pong!*\nLatency: ${latency}ms\nResponse: ${speed}`);
            }
            break;

            default: {
                // .system (nama utama plugin) sebelumnya tidak membalas apa-apa
                m.reply(getRamText() + '\n\n' + await getDiskUsage());
            }
        }
    } catch (e) {
        console.error('System Plugin Error:', e);
        m.reply('❌ Terjadi kesalahan mengambil data sistem.');
    }
}

export { pluginConfig as config, handler }