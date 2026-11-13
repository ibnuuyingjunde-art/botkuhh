import fs from 'fs'
import path from 'path'
import os from 'os'
import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'
import { getMemoryStats } from '../../src/lib/ichigo-memory-monitor.js'
import { getTempCleanerStats } from '../../src/lib/ichigo-temp-cleaner.js'
import { getPrunerStats } from '../../src/lib/ichigo-data-pruner.js'
import { getActiveJadibots } from '../../src/lib/ichigo-jadibot-manager.js'
import { groupCache } from '../../src/lib/ichigo-group-cache.js'

const pluginConfig = {
    name: 'systemstats',
    alias: ['sysstats', 'healthbot', 'cekbersih'],
    category: 'owner',
    description: 'Dashboard lengkap: memory, temp cleaner, pruner, jadibot, database, dan cache',
    usage: '.systemstats',
    example: '.systemstats',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function formatBytes(bytes) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function fmtUptime(seconds) {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return d > 0 ? `${d}h ${h}j ${m}m` : `${h}j ${m}m`
}

function fmtAgo(ts) {
    if (!ts) return 'belum pernah'
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'baru saja'
    if (m < 60) return `${m}m lalu`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}j lalu`
    return `${Math.floor(h / 24)}h lalu`
}

function fmtNext(ts, intervalMs) {
    if (!ts) return 'nunggu 1st run'
    const diff = ts + intervalMs - Date.now()
    if (diff <= 0) return 'sebentar lagi'
    const m = Math.floor(diff / 60000)
    return m < 60 ? `~${m}m lagi` : `~${Math.floor(m / 60)}j lagi`
}

function bar(percent, width = 10) {
    const filled = Math.round((Math.min(percent, 100) / 100) * width)
    return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function statusIcon(active) {
    return active ? '🟢' : '🔴'
}

function getDirSize(dir) {
    let total = 0
    let count = 0
    try {
        for (const file of fs.readdirSync(dir)) {
            const p = path.join(dir, file)
            const st = fs.statSync(p)
            if (st.isDirectory()) {
                const sub = getDirSize(p)
                total += sub.size
                count += sub.count
            } else {
                total += st.size
                count++
            }
        }
    } catch {}
    return { size: total, count }
}

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size
    } catch {
        return 0
    }
}

async function handler(m) {
    try {
        const mem = getMemoryStats()
        const temp = getTempCleanerStats()
        const pruner = getPrunerStats()

        const cwd = process.cwd()
        const tempNow = getDirSize(path.join(cwd, 'temp'))
        const tmpNow = getDirSize(path.join(cwd, 'tmp'))
        const dbDir = path.join(cwd, 'database', 'main')
        const dbSize =
            getFileSize(path.join(dbDir, 'ichigo.db')) +
            getFileSize(path.join(dbDir, 'ichigo.db-wal'))

        const activeJadibot = getActiveJadibots().length
        const cacheStats = groupCache.getStats()

        const text =
            `「 SYSTEM STATS 」\n\n` +
            `「 Bot 」\n` +
            `▸ uptime  : ${fmtUptime(process.uptime())}\n` +
            `▸ node    : ${process.version}\n` +
            `▸ platform : ${os.platform()} (${os.arch()})\n` +
            `▸ jadibot  : ${activeJadibot} sesi aktif\n\n` +
            `「 Memory 」 ${statusIcon(mem.active)}\n` +
            `▸ pakai   : ${formatBytes(mem.rss)} / ${formatBytes(mem.limit)}\n` +
            `▸ bar     : ${bar(mem.percent)} ${mem.percent.toFixed(1)}%\n` +
            `▸ heap    : ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}\n` +
            `▸ cek     : ${fmtAgo(mem.lastCheck)}\n\n` +
            `「 Disk (real-time) 」\n` +
            `▸ temp/   : ${formatBytes(tempNow.size)} (${tempNow.count} file)\n` +
            `▸ tmp/    : ${formatBytes(tmpNow.size)} (${tmpNow.count} file)\n` +
            `▸ database : ${formatBytes(dbSize)}\n\n` +
            `「 Temp Cleaner 」 ${statusIcon(temp.active)}\n` +
            `▸ terakhir : ${fmtAgo(temp.lastRun)}, ${temp.lastCleaned} file\n` +
            `▸ total    : ${temp.totalCleanedAllTime} file (${temp.totalRuns}x)\n` +
            `▸ jalan lg : ${fmtNext(temp.lastRun, temp.intervalMs)}\n\n` +
            `「 Data Pruner 」 ${statusIcon(pruner.active)}\n` +
            `▸ terakhir : ${fmtAgo(pruner.lastRun)}, ${pruner.lastPrunedUsers} user, ${pruner.lastPrunedGroups} grup\n` +
            `▸ total    : ${pruner.totalPrunedAllTime} entry (${pruner.totalRuns}x)\n` +
            `▸ ambang   : ${pruner.thresholdMs / 86400000} hari inactive\n` +
            `▸ jalan lg : ${fmtNext(pruner.lastRun, pruner.intervalMs)}\n\n` +
            `「 Group Cache 」\n` +
            `▸ tersimpan : ${cacheStats.keys} grup\n` +
            `▸ hit/miss  : ${cacheStats.hits}/${cacheStats.misses}`

        await m.reply(text, {
            footer: `${config.bot?.name || 'IchigoBot'} • System Health`,
        })
    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }