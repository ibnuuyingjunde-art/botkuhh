import fs from 'fs'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import config from '../../config.js'

const pluginConfig = {
    name: 'clearsessions',
    alias: ['delsession', 'delsessions'],
    category: 'owner',
    description: 'Full reset session di storage/session/ (termasuk creds.json) — butuh scan/pairing ulang setelahnya',
    usage: '.clearsessions',
    example: '.clearsessions',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

function walkAndClean(dir, stats) {
    let entries
    try {
        entries = fs.readdirSync(dir)
    } catch {
        return
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry)
        let stat
        try {
            stat = fs.statSync(fullPath)
        } catch {
            continue
        }

        if (stat.isDirectory()) {
            walkAndClean(fullPath, stats)
            try {
                if (fs.readdirSync(fullPath).length === 0) {
                    fs.rmdirSync(fullPath)
                }
            } catch {}
            continue
        }

        try {
            fs.unlinkSync(fullPath)
            stats.deleted++
            stats.deletedFiles.push(path.relative(stats.root, fullPath))
        } catch {}
    }
}

async function handler(m, { sock }) {

    const sessionsPath = path.join(process.cwd(), 'storage', config.session?.folderName || 'session')

    if (!fs.existsSync(sessionsPath)) {
        return m.reply(`❌ Folder session tidak ditemukan!`)
    }

    await m.react('🗑️')

    try {
        const stats = { deleted: 0, deletedFiles: [], root: sessionsPath }
        walkAndClean(sessionsPath, stats)

        if (stats.deleted === 0) {
            return m.reply(`📁 Folder session sudah kosong!`)
        }

        const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })

        const tableData = [
            ['🗑️  Deleted',   `${stats.deleted} file`],
            ['⚠️  Perlu',     'Scan QR / pairing ulang setelah restart'],
            ['📂  Path',      `storage/${config.session?.folderName || 'session'}/`],
            ['🕒  Waktu',     now],
        ]

        await sock.sendTable(
            m.chat,
            '🗑️ Clear Sessions',
            ['Keterangan', 'Detail'],
            tableData,
            m,
            {
                headerText: `LYNIX BOT\n\n✦ Pembersihan session files selesai`,
                footer: `💡 Restart bot jika koneksi bermasalah`
            }
        )

        await m.react('✅')
    } catch (error) {
        console.log(error)
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }