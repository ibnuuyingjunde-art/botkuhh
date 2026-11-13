/**
 * Nama Plugin: Auto Restart
 * Fungsi: Restart otomatis setiap 3 jam + kontrol manual owner
 */

import fs from 'fs'
import path from 'path'
import { getSocket } from '../../src/connection.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import { logger } from '../../src/lib/ichigo-logger.js'

const pluginConfig = {
    name: 'autorestart',
    alias: ['setrestart', 'jadwalrestart'],
    category: 'owner',
    description: 'Kelola auto restart bot setiap 3 jam',
    usage: '.autorestart <on/off/status>',
    example: '.autorestart on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
}

const INTERVAL_MS = 3 * 60 * 60 * 1000 

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const waktu = () => new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Makassar'
})

const uptime = () => {
    const s = Math.floor(process.uptime())
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}j ${m}m ${sec}d`
}

const memUsage = () => {
    const mb = process.memoryUsage().rss / 1024 / 1024
    return `${mb.toFixed(1)} MB`
}

const STORE_PATH = path.join(process.cwd(), 'storage', 'auto-restart.json')

function readStore() {
    try {
        if (fs.existsSync(STORE_PATH)) {
            return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
        }
    } catch {}
    return { enabled: true } 
}

function writeStore(data) {
    try {
        const dir = path.dirname(STORE_PATH)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2))
    } catch {}
}

if (!global._autoRestartState) {
    global._autoRestartState = {
        enabled: false,
        timerId: null,
        startedAt: null,
        nextRestartAt: null,
    }
}

function formatSisa() {
    if (!global._autoRestartState.nextRestartAt) return '-'
    const sisa = global._autoRestartState.nextRestartAt - Date.now()
    if (sisa <= 0) return 'sebentar lagi'
    const h = Math.floor(sisa / 3600000)
    const m = Math.floor((sisa % 3600000) / 60000)
    const s = Math.floor((sisa % 60000) / 1000)
    return `${h}j ${m}m ${s}d`
}

async function doRestart() {
    logger.system('AutoRestart', `memulai restart otomatis · PID ${process.pid}`)
    try {
        const db = getDatabase()
        await db.save()
    } catch {}

    await sleep(500)

    try {
        const sock = getSocket()
        if (sock) sock.end()
    } catch {}

    await sleep(500)
    process.exit(0)
}

function startAutoRestart(persist = true) {
    const state = global._autoRestartState

    if (state.timerId) {
        clearInterval(state.timerId)
        state.timerId = null
    }

    state.enabled = true
    state.startedAt = Date.now()
    state.nextRestartAt = Date.now() + INTERVAL_MS

    state.timerId = setInterval(async () => {
        state.nextRestartAt = Date.now() + INTERVAL_MS 
        await doRestart()
    }, INTERVAL_MS)
    if (state.timerId?.unref) state.timerId.unref()

    if (persist) writeStore({ enabled: true })

    logger.success('AutoRestart', 'aktif — restart setiap 3 jam')
}

function stopAutoRestart(persist = true) {
    const state = global._autoRestartState
    if (state.timerId) {
        clearInterval(state.timerId)
        state.timerId = null
    }
    state.enabled = false
    state.startedAt = null
    state.nextRestartAt = null

    if (persist) writeStore({ enabled: false })

    logger.warn('AutoRestart', 'dimatikan')
}

;(function initAutoRestart() {
    const store = readStore()
    if (store.enabled) {
        startAutoRestart(false) 
        logger.info('AutoRestart', 'auto-armed dari store (enabled tersimpan)')
    }
})()

async function handler(m, { sock }) {
    const args = m.text?.trim().toLowerCase()
    const state = global._autoRestartState

    if (!args || args === 'status') {
        return m.reply(
            `╭┈┈⬡「 ⏰ *ᴀᴜᴛᴏ ʀᴇsᴛᴀʀᴛ* 」\n` +
            `┃ 🔘 Status  : ${state.enabled ? '✅ Aktif' : '❌ Mati'}\n` +
            `┃ ⏱️ Interval: setiap 3 jam\n` +
            `┃ ⏳ Sisa    : ${state.enabled ? formatSisa() : '-'}\n` +
            `┃ 🕐 Waktu   : ${waktu()}\n` +
            `┃ ⬆️ Uptime  : ${uptime()}\n` +
            `┃ 🧠 Memori  : ${memUsage()}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> Ketik \`.autorestart on/off\` untuk ubah status`
        )
    }

    if (args === 'on') {
        if (state.enabled) {
            return m.reply(
                `⚠️ Auto restart sudah aktif!\n` +
                `┃ ⏳ Sisa: ${formatSisa()}`
            )
        }
        startAutoRestart()
        await m.react('✅')
        return m.reply(
            `╭┈┈⬡「 ⏰ *ᴀᴜᴛᴏ ʀᴇsᴛᴀʀᴛ* 」\n` +
            `┃ ✅ Berhasil diaktifkan!\n` +
            `┃ ⏱️ Bot akan restart tiap 3 jam\n` +
            `┃ 💾 Status disimpan, tetap aktif walau bot restart\n` +
            `┃ ⏳ Restart berikutnya: ${formatSisa()}\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    if (args === 'off') {
        if (!state.enabled) {
            return m.reply(`⚠️ Auto restart memang sudah mati.`)
        }
        stopAutoRestart()
        await m.react('✅')
        return m.reply(
            `╭┈┈⬡「 ⏰ *ᴀᴜᴛᴏ ʀᴇsᴛᴀʀᴛ* 」\n` +
            `┃ 🛑 Auto restart dimatikan.\n` +
            `┃ 💾 Status disimpan, tetap mati walau bot restart\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    return m.reply(
        `❓ Perintah tidak dikenal.\n` +
        `Gunakan: \`.autorestart on/off/status\``
    )
}

export { pluginConfig as config, handler }