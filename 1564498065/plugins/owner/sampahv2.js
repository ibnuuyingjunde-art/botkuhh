import fs from 'fs'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'sampahv2',
    alias: ['sampah2', 'cleartempv2', 'deltempv2'],
    category: 'owner',
    description: 'Bersihkan semua folder temp (temp/, tmp/, storage/temp/) sekaligus, aman dari file yang lagi dipakai',
    usage: '.sampahv2 [force]',
    example: '.sampahv2',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

const TARGET_DIRS = ['temp', 'tmp', path.join('storage', 'temp')]

const SAFE_AGE_MS = 2 * 60 * 1000

function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function cleanDir(fullPath, force) {
    const stat = { deleted: 0, skipped: 0, size: 0 }
    if (!fs.existsSync(fullPath)) return stat

    const now = Date.now()
    for (const file of fs.readdirSync(fullPath)) {
        const filePath = path.join(fullPath, file)
        let st
        try {
            st = fs.statSync(filePath)
        } catch {
            continue
        }

        const age = now - st.mtimeMs
        if (!force && age < SAFE_AGE_MS) {
            stat.skipped++
            continue
        }

        const size = st.isDirectory() ? getDirSize(filePath) : st.size
        try {
            fs.rmSync(filePath, { recursive: true, force: true })
            stat.deleted++
            stat.size += size
        } catch {
            stat.skipped++
        }
    }
    return stat
}

function getDirSize(dir) {
    let total = 0
    try {
        for (const file of fs.readdirSync(dir)) {
            const p = path.join(dir, file)
            const st = fs.statSync(p)
            total += st.isDirectory() ? getDirSize(p) : st.size
        }
    } catch {}
    return total
}

async function handler(m) {
    const force = (m.args[0] || '').toLowerCase() === 'force'

    await m.react('🗑️')

    try {
        const results = []
        let totalDeleted = 0
        let totalSkipped = 0
        let totalSize = 0

        for (const rel of TARGET_DIRS) {
            const fullPath = path.join(process.cwd(), rel)
            const stat = cleanDir(fullPath, force)
            results.push({ rel, ...stat })
            totalDeleted += stat.deleted
            totalSkipped += stat.skipped
            totalSize += stat.size
        }

        if (totalDeleted === 0 && totalSkipped === 0) {
            await m.react('✅')
            return m.reply('📁 Semua folder temp sudah bersih, gak ada yang perlu dihapus!')
        }

        const breakdown = results
            .filter(r => r.deleted > 0 || r.skipped > 0)
            .map(r => `▸ ${r.rel} : ${r.deleted} dihapus (${formatBytes(r.size)})${r.skipped > 0 ? `, ${r.skipped} dilewati` : ''}`)
            .join('\n')

        await m.react('✅')
        await m.reply(
            `🗑️ *SAMPAH CLEANED V2*\n\n` +
            `${breakdown}\n\n` +
            `> Total dihapus: *${totalDeleted}* file (${formatBytes(totalSize)})` +
            (totalSkipped > 0 && !force
                ? `\n> Dilewati: *${totalSkipped}* file (masih baru, < 2 menit — mungkin lagi diproses)\n> Ketik \`${m.prefix}sampahv2 force\` buat paksa hapus semua`
                : '')
        )
    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }