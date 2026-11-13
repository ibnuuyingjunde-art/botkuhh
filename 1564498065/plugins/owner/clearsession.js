import fs from 'fs'
import path from 'path'
import { generateWAMessageFromContent } from 'ichigo'
import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import { clearSessionForJid } from '../../src/lib/ichigo-auto-clearsession.js'

const pluginConfig = {
    name: 'clearsession',
    alias: ['resetsession', 'fixmac', 'fixsession', 'sessionfix'],
    category: 'owner',
    description: 'Fix bad MAC / closing session: clear keys + ping grup + restart',
    usage: '.clearsession [fix|fixjid <nomor>]',
    example: '.clearsession fixjid 6281234567890',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

const KEEP_FILES = ['data.json']
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const saluranId = config.saluran?.id || '120363409557700746@newsletter'
const saluranName = config.saluran?.name || config.bot?.name || 'Ichigo Strife AI'

function clearSessionKeys() {
    const sessionsPath = path.join(process.cwd(), 'storage', config.session?.folderName || 'session')
    let deleted = 0

    function walk(dir) {
        if (!fs.existsSync(dir)) return
        for (const entry of fs.readdirSync(dir)) {
            if (KEEP_FILES.includes(entry)) continue
            const full = path.join(dir, entry)
            try {
                const stat = fs.statSync(full)
                if (stat.isDirectory()) {
                    walk(full)
                    try { if (fs.readdirSync(full).length === 0) fs.rmdirSync(full) } catch {}
                } else {
                    fs.unlinkSync(full)
                    deleted++
                }
            } catch {}
        }
    }

    const jadibotDir = path.resolve('./session/jadibot')
    if (fs.existsSync(jadibotDir)) {
        walk(jadibotDir)
    }

    walk(sessionsPath)
    return deleted
}

function sendInteractive(sock, jid, bodyText, buttons, quotedMsg) {
    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: {
                    body: { text: bodyText },
                    footer: { text: `© lyniX's Strife AI` },
                    header: { hasMediaAttachment: false },
                    nativeFlowMessage: { buttons },
                    contextInfo: {
                        forwardingScore: 9999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            newsletterName: saluranName,
                            serverMessageId: 127
                        }
                    }
                }
            }
        }
    }, { quoted: quotedMsg })
    return sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

async function doRestart() {
    
    try {
        const db = getDatabase()
        db.save()
    } catch {}

    try {
        const { closeConnection } = await import('../../src/connection.js')
        await closeConnection('clearsession restart')
    } catch {}

    process.exit(0)
}

async function handler(m, { sock }) {
    const arg = m.args[0]?.toLowerCase()

    if (arg === 'fixjid') {
        const target = m.args[1]?.replace(/[^0-9]/g, '')
        if (!target) return m.reply(`❌ Nomor wajib diisi!\n\nContoh: *${m.prefix}clearsession fixjid 6281234567890*`)

        const jid = `${target}@s.whatsapp.net`
        await m.react('🔧')

        const result = await clearSessionForJid(sock, jid)

        if (!result.ok) {
            await m.react('❌')
            return m.reply(`❌ Gagal cek/clear session untuk *${target}*\n\nAlasan: ${result.reason}`)
        }

        await m.react('✅')
        return m.reply(
            `✅ *Targeted Session Fix*\n\n` +
            `┃ 🎯 Target   : ${target}\n` +
            `┃ 🗑️ Dihapus  : ${result.deleted ? 'Ya' : 'Tidak'}\n` +
            `┃ ℹ️ Info     : ${result.reason}\n\n` +
            `_Session akan self-heal via prekey renegotiation di pesan berikutnya. Tidak perlu restart._`
        )
    }

    if (arg === 'fix') {
        await m.react('🔧')

        let groups = []
        try {
            const chats = await sock.groupFetchAllParticipating()
            groups = Object.values(chats)
        } catch {}

        await sock.sendTable(
            m.chat,
            '🔧 Fix Session',
            ['Keterangan', 'Detail'],
            [
                ['📋 Tahap', '1/3 — Scan session'],
                ['👥 Grup aktif', `${groups.length} grup`],
                ['📊 Status', '⏳ Memulai...'],
            ],
            m,
            {
                headerText: `Ichigo Strife AI\n\n✦ Memperbaiki session error`,
                footer: `Proses berjalan, harap tunggu...`
            }
        )

        await sleep(500)

        const deleted = clearSessionKeys()

        await sock.sendTable(
            m.chat,
            '🔧 Fix Session',
            ['Keterangan', 'Detail'],
            [
                ['📋 Tahap', '2/3 — Clear session keys'],
                ['🗑️ Terhapus', `${deleted} file`],
                ['🔒 Aman', KEEP_FILES.join(', ')],
                ['📊 Status', '⏳ Ping grup...'],
            ],
            m,
            {
                headerText: `Ichigo Strife AI\n\n✦ Session keys dibersihkan`,
                footer: `Melanjutkan ke step berikutnya...`
            }
        )

        await sleep(500)

        let pinged = 0, pingFail = 0
        for (const g of groups) {
            try {
                await sock.sendMessage(g.id, {
                    react: { text: '', key: { remoteJid: g.id, fromMe: true, id: 'fixsession-ping' } }
                })
                pinged++
            } catch { pingFail++ }
            await sleep(300)
        }

        await sock.sendTable(
            m.chat,
            '✅ Fix Session Selesai',
            ['Keterangan', 'Detail'],
            [
                ['📋 Tahap', '3/3 — Selesai'],
                ['🗑️ Keys dihapus', `${deleted} file`],
                ['📡 Grup di-ping', `${pinged} ok, ${pingFail} gagal`],
                ['📊 Status', '🚀 Restart dalam 1 detik...'],
            ],
            m,
            {
                headerText: `Ichigo Strife AI\n\n✦ Semua tahap selesai`,
                footer: `Bot akan restart otomatis`
            }
        )

        await m.react('✅')
        await sleep(800)
        return doRestart()
    }

    const targets = []
    const sessionRoot = path.resolve('./storage', config.session?.folderName || 'session')
    if (fs.existsSync(sessionRoot)) targets.push(sessionRoot)

    const jadibotDir = path.resolve('./session/jadibot')
    if (fs.existsSync(jadibotDir)) targets.push(jadibotDir)

    if (targets.length === 0) return m.reply('❌ Tidak ada folder session yang ditemukan!')

    function countFiles(dir) {
        let count = 0
        if (!fs.existsSync(dir)) return count
        for (const entry of fs.readdirSync(dir)) {
            if (KEEP_FILES.includes(entry)) continue
            const full = path.join(dir, entry)
            try {
                if (fs.statSync(full).isDirectory()) count += countFiles(full)
                else count++
            } catch {}
        }
        return count
    }

    let totalFiles = 0
    for (const t of targets) totalFiles += countFiles(t)

    await m.react('🕐')

    await sock.sendTable(
        m.chat,
        '🗑️ Clear Session',
        ['Keterangan', 'Detail'],
        [
            ['📁 Lokasi', `${targets.length} folder`],
            ['🗑️ Target', `${totalFiles} file`],
            ['🔒 Aman', KEEP_FILES.join(', ')],
            ['📊 Status', '⏳ Memulai proses...'],
        ],
        m,
        {
            headerText: `Ichigo Strife AI\n\n✦ Memulai pembersihan session keys`,
            footer: `Proses sedang berjalan...`
        }
    )

    await sleep(800)

    let totalDeleted = 0, totalFailed = 0
    function deleteWalk(dir) {
        if (!fs.existsSync(dir)) return
        for (const entry of fs.readdirSync(dir)) {
            if (KEEP_FILES.includes(entry)) continue
            const full = path.join(dir, entry)
            try {
                const stat = fs.statSync(full)
                if (stat.isDirectory()) {
                    deleteWalk(full)
                    try { if (fs.readdirSync(full).length === 0) fs.rmdirSync(full) } catch {}
                } else {
                    fs.unlinkSync(full)
                    totalDeleted++
                }
            } catch { totalFailed++ }
        }
    }
    for (const t of targets) deleteWalk(t)

    await sleep(500)

    await sock.sendTable(
        m.chat,
        '✅ Session Berhasil Dihapus',
        ['Keterangan', 'Detail'],
        [
            ['✅ Terhapus', `${totalDeleted} file`],
            ['❌ Gagal', `${totalFailed} file`],
            ['🔒 Aman', KEEP_FILES.join(', ')],
            ['⚠️ Perlu', 'Scan QR / pairing ulang setelah restart'],
            ['📊 Status', '🚀 Pilih aksi selanjutnya'],
        ],
        m,
        {
            headerText: `Ichigo Strife AI\n\n✦ Pembersihan session selesai`,
            footer: `Pilih aksi di bawah`
        }
    )

    await sendInteractive(
        sock,
        m.chat,
        `✅ *sᴇssɪᴏɴ ʙᴇʀʜᴀsɪʟ ᴅɪʜᴀᴘᴜs!*\n\n` +
        `┃ ✅ Terhapus : *${totalDeleted} file*\n` +
        `┃ ❌ Gagal    : *${totalFailed} file*\n\n` +
        `> Pilih aksi selanjutnya:`,
        [
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '🔧 Fix Session (Ping + Restart)',
                    id: `${m.prefix}clearsession fix`
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '🔄 Restart Saja',
                    id: `${m.prefix}restart`
                })
            },
            {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: '✅ Selesai',
                    id: `${m.prefix}ping`
                })
            }
        ],
        m
    )

    await m.react('✅')
}

export { pluginConfig as config, handler }