import os from 'os'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'
import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'ping2',
    alias: ['speed2', 'p2', 'latency2', 'sys2', 'status2'],
    category: 'main',
    description: 'Cek performa dan status sistem bot secara real-time',
    usage: '.ping2',
    example: '.ping2',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const fmtSize = (b) => {
    if (!b || b === 0) return '0 B'
    const u = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(1024))
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i]
}

const fmtUp = (s) => {
    s = Number(s)
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sc = Math.floor(s % 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sc}s`
    return `${m}m ${sc}s`
}

const pingEmoji = (ms) => ms <= 100 ? '🟢' : ms <= 300 ? '🟡' : '🔴'
const loadEmoji = (pct) => pct <= 40 ? '🟢' : pct <= 75 ? '🟡' : '🔴'
const ramEmoji  = (pct) => pct <= 50 ? '🟢' : pct <= 80 ? '🟡' : '🔴'

function getNetwork() {
    try {
        const ifaces = os.networkInterfaces()
        for (const [name, addrs] of Object.entries(ifaces)) {
            if (name.toLowerCase().includes('lo')) continue
            for (const a of addrs) {
                if (a.family === 'IPv4' && !a.internal) return name
            }
        }
    } catch {}
    return 'N/A'
}

async function handler(m, { sock }) {
    const execStart = performance.now()
    await m.react('🕕')

    try {
        sock.sendPresenceUpdate('composing', m.chat).catch(() => {})

        const t0 = m.messageTimestamp ? (m.messageTimestamp * 1000) : Date.now()
        const waLatency = Math.max(1, Date.now() - t0)

        const cpus     = os.cpus()
        const totalMem = os.totalmem()
        const freeMem  = os.freemem()
        const ramUsed  = totalMem - freeMem
        const ramPct   = (ramUsed / totalMem) * 100

        const cpuLoad  = Math.max(1, Math.min(100, os.loadavg()[0] / cpus.length * 100))
        const cpuPct   = cpuLoad.toFixed(1)

        let diskTotal = 0, diskUsed = 0
        try {
            if (process.platform === 'win32') {
                const w = execSync("wmic logicaldisk where \"DeviceID='C:'\" get Size,FreeSpace /format:value", { encoding: 'utf-8' })
                const fm = w.match(/FreeSpace=(\d+)/), sm = w.match(/Size=(\d+)/)
                if (sm && fm) { diskTotal = parseInt(sm[1]); diskUsed = diskTotal - parseInt(fm[1]) }
            } else {
                const df = execSync('df -k --output=size,used /').toString().trim().split('\n')
                if (df.length > 1) {
                    const p = df[1].trim().split(/\s+/).map(Number)
                    if (p.length >= 2) { diskTotal = p[0] * 1024; diskUsed = p[1] * 1024 }
                }
            }
        } catch {}

        const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
        const heap    = process.memoryUsage()
        const netIf   = getNetwork()

        let dbUsers = 0, dbGroups = 0, dbPremium = 0
        try {
            const db = getDatabase()
            if (db?.data) {
                dbUsers   = Object.keys(db.data.users  || {}).length
                dbGroups  = Object.keys(db.data.groups || {}).length
                dbPremium = Object.values(db.data.users || {}).filter(u => u.isPremium).length
            }
        } catch {}

        const botLatency = Math.round(performance.now() - execStart)
        const botName    = (config.bot?.name || "lyniX's MD").toUpperCase()
        const now        = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })

        const tableData = [
            
            ['📡  WA Latency',      `${pingEmoji(waLatency)}  ${waLatency} ms`],
            ['⚡  Bot Response',    `${pingEmoji(botLatency)}  ${botLatency} ms`],

            ['🖥️  Platform',        `${os.platform()} ${os.arch()}`],
            ['🔷  Hostname',        os.hostname()],
            ['🟣  Node.js',         process.version],
            ['⚙️  CPU',             `${cpus[0]?.model?.slice(0, 26) || 'Unknown'}`],
            ['🔢  Cores',           `${cpus.length} Core`],
            ['📊  CPU Load',        `${loadEmoji(cpuLoad)}  ${cpuPct}%`],

            ['🧠  RAM',             `${ramEmoji(ramPct)}  ${fmtSize(ramUsed)} / ${fmtSize(totalMem)} (${ramPct.toFixed(0)}%)`],
            ['🫧  Heap',            `${fmtSize(heap.heapUsed)} / ${fmtSize(heap.heapTotal)}`],
            ['💾  Storage',         `${fmtSize(diskUsed)} / ${fmtSize(diskTotal)} (${diskPct.toFixed(0)}%)`],

            ['🌐  Network',         netIf],
            ['👥  Users',           `${dbUsers} (${dbPremium} premium)`],
            ['🏘️  Groups',          `${dbGroups}`],

            ['🤖  Bot Uptime',      fmtUp(process.uptime())],
            ['🕒  Server Uptime',   fmtUp(os.uptime())],
        ]

        await sock.sendTable(
            m.chat,
            '⚡ System Performance',
            ['Metric', 'Value'],
            tableData,
            m,
            {
                headerText: `${botName}\n\n✦ Statistik performa bot secara real-time`,
                footer: `🕐 ${now}`
            }
        )

        await m.react('✅')
    } catch (error) {
        console.log(error)
        await m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }