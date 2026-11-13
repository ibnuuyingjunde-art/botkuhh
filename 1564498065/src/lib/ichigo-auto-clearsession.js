/**
 * ichigo-auto-clearsession.js
 * Auto clear session keys saat bot mendeteksi MAC error / closing session
 * Taruh di: src/lib/ichigo-auto-clearsession.js
 */

import fs from 'fs'
import path from 'path'
import { logger } from './ichigo-logger.js'

const KEEP_FILES = ['data.json']
const CLOSING_THRESHOLD = 15         
const CLEAR_COOLDOWN_MS = 5 * 60 * 1000   
const HEALTH_CHECK_INTERVAL = 60 * 1000   
const FROZEN_THRESHOLD_MS = 30 * 60 * 1000 

const STORE_PATH = path.join(process.cwd(), 'storage', 'auto-clearsession.json')

function readStore() {
    try {
        if (fs.existsSync(STORE_PATH)) {
            return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'))
        }
    } catch {}
    return { enabled: true, notifGroup: null }
}

function writeStore(data) {
    try {
        const dir = path.dirname(STORE_PATH)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2))
    } catch {}
}

const state = {
    closingCount: 0,
    lastClearAt: 0,
    lastMessageAt: Date.now(),
    isClearing: false,
    totalAutoClear: 0,
    healthTimer: null,
    sock: null,
    config: null,

    closedSessionCount: 0,
    closedSessionWindowStart: Date.now(),
}

const CLOSED_SESSION_WINDOW_MS = 5 * 60 * 1000  
const CLOSED_SESSION_SPAM_THRESHOLD = 30

function log(level, msg) {
    const fn = { info: 'info', warn: 'warn', error: 'error', success: 'success' }[level] || 'info'
    logger[fn]('autoclear', msg)
}

async function clearSessionForJid(sock, jid) {
    if (!sock?.signalRepository) return { ok: false, reason: 'signalRepository tidak tersedia' }
    try {
        const { exists, reason } = await sock.signalRepository.validateSession(jid)
        if (!exists) {
            
            await sock.signalRepository.deleteSession([jid])
            return { ok: true, deleted: true, reason }
        }
        return { ok: true, deleted: false, reason: 'session masih valid, tidak dihapus' }
    } catch (e) {
        return { ok: false, reason: e.message }
    }
}

function clearSessionKeys(sessionPath) {
    let deleted = 0, failed = 0
    const failedFiles = []

    function walk(dir) {
        if (!fs.existsSync(dir)) return
        let entries
        try { entries = fs.readdirSync(dir) } catch { return }
        for (const entry of entries) {
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
            } catch (e) {
                failed++
                failedFiles.push(`${entry} (${e.code || e.message})`)
            }
        }
    }

    walk(sessionPath)
    return { deleted, failed, failedFiles }
}

async function pingGroups(sock) {
    let ok = 0, fail = 0
    try {
        const chats = await sock.groupFetchAllParticipating()
        for (const g of Object.values(chats)) {
            try {
                await sock.sendMessage(g.id, {
                    react: { text: '', key: { remoteJid: g.id, fromMe: true, id: 'autoclear-ping' } }
                })
                ok++
            } catch { fail++ }
            await new Promise(r => setTimeout(r, 200))
        }
    } catch {}
    return { ok, fail }
}

async function sendNotif(sock, cfg, message) {
    if (!sock) return

    const targets = []

    const groupFromConfig = cfg?.autoSession?.notifGroup
    if (groupFromConfig) targets.push(groupFromConfig)

    const store = readStore()
    if (store.notifGroup && store.notifGroup !== groupFromConfig) {
        targets.push(store.notifGroup)
    }

    if (targets.length === 0) {
        const ownerNum = Array.isArray(cfg?.owner?.number)
            ? cfg.owner.number[0]
            : cfg?.owner?.number
        if (ownerNum) targets.push(ownerNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    }

    for (const target of targets) {
        try { await sock.sendMessage(target, { text: message }) } catch {}
    }
}

async function doRestart() {
    try {
        const { getDatabase } = await import('./ichigo-database.js')
        await getDatabase()?.save()
    } catch {}

    try {
        const { closeConnection } = await import('../connection.js')
        await closeConnection('auto-clear restart')
    } catch {}

    process.exit(0)
}

async function autoClearSession(sock, reason = 'manual') {
    const cfg = state.config
    const currentSock = sock || state.sock

    if (state.isClearing) return
    const store = readStore()
    if (!store.enabled) {
        log('warn', 'Auto-clear dinonaktifkan via store, skip')
        return
    }

    const now = Date.now()
    const cooldownSisa = CLEAR_COOLDOWN_MS - (now - state.lastClearAt)
    if (cooldownSisa > 0 && reason !== 'manual') {
        log('warn', `Cooldown aktif, skip (${Math.ceil(cooldownSisa / 1000)}s lagi)`)
        return
    }

    state.isClearing = true
    state.lastClearAt = now
    state.totalAutoClear++
    state.closingCount = 0

    log('warn', `Auto-clear dipicu! Alasan: ${reason} (total ke-${state.totalAutoClear})`)

    const sessionPath = path.join(
        process.cwd(), 'storage',
        cfg?.session?.folderName || 'session'
    )

    const { deleted, failed, failedFiles } = clearSessionKeys(sessionPath)
    log('success', `Keys dihapus: ${deleted} file, gagal: ${failed} file`)
    if (failedFiles.length > 0) log('warn', `File gagal: ${failedFiles.join(', ')}`)

    const { ok, fail } = await pingGroups(currentSock)
    log('info', `Ping grup: ${ok} ok, ${fail} gagal`)

    const failedInfo = failedFiles.length > 0
        ? `\n┃ ⚠️ Gagal     : ${failedFiles.slice(0, 3).join(', ')}${failedFiles.length > 3 ? ` +${failedFiles.length - 3} lagi` : ''}`
        : ''

    await sendNotif(
        currentSock, cfg,
        `⚙️ *Auto Clear Session*\n\n` +
        `┃ 🔍 Alasan   : ${reason}\n` +
        `┃ 🗑️ Dihapus  : ${deleted} file\n` +
        `┃ ❌ Gagal    : ${failed} file${failedInfo}\n` +
        `┃ 📡 Ping grup: ${ok} ok, ${fail} gagal\n` +
        `┃ 🔄 Total    : ke-${state.totalAutoClear}\n\n` +
        `_Bot akan restart otomatis..._`
    )

    log('warn', 'Restart dalam 2 detik...')
    await new Promise(r => setTimeout(r, 2000))
    await doRestart()
}

function patchConsoleLog() {

    if (console._ichigoPatched) return
    console._ichigoPatched = true

    const _orig = console._ichigoOrigLog || console.log
    if (!console._ichigoOrigLog) console._ichigoOrigLog = _orig

    console.log = (...args) => {
        _orig.apply(console, args)

        const store = readStore()
        if (!store.enabled) return

        const str = args.map(a => typeof a === 'string' ? a : '').join(' ')

        const isBadSession =
            str.includes('bad MAC') ||
            str.includes('Bad MAC') ||
            str.includes('decryption failed') ||
            str.includes('Failed to decrypt')

        const isClosedSessionInfo = str.includes('Decrypted message with closed session')
        if (isClosedSessionInfo) {
            const now = Date.now()
            if (now - state.closedSessionWindowStart > CLOSED_SESSION_WINDOW_MS) {
                state.closedSessionCount = 0
                state.closedSessionWindowStart = now
            }
            state.closedSessionCount++
            if (state.closedSessionCount === CLOSED_SESSION_SPAM_THRESHOLD) {
                log('warn', `"closed session" muncul ${CLOSED_SESSION_SPAM_THRESHOLD}x dalam ${CLOSED_SESSION_WINDOW_MS / 60000} menit (masih normal/self-heal, cuma dipantau — nggak auto-wipe)`)
            }
        }

        if (isBadSession) {
            state.closingCount++

            if (state.closingCount >= CLOSING_THRESHOLD) {
                log('warn', `Session error ${state.closingCount}x terdeteksi (native enableAutoSessionRecreation aktif, harusnya self-heal; gunakan .clearsession manual kalau masih berulang)`)
                state.closingCount = 0
            }
        }
    }
}

function startHealthCheck() {
    if (state.healthTimer) clearInterval(state.healthTimer)
    state.healthTimer = setInterval(async () => {
        const store = readStore()
        if (!store.enabled) return
        const silentMs = Date.now() - state.lastMessageAt
        if (silentMs > FROZEN_THRESHOLD_MS) {

            log('warn', `Bot frozen ${Math.floor(silentMs / 60000)} menit (auto-clear otomatis nonaktif)`)
        }
    }, HEALTH_CHECK_INTERVAL)
    if (state.healthTimer?.unref) state.healthTimer.unref()
    log('success', `health check aktif · beku ${FROZEN_THRESHOLD_MS / 60000} mnt`)
}

function stopHealthCheck() {
    if (state.healthTimer) { clearInterval(state.healthTimer); state.healthTimer = null }
}

function onMessageReceived() {
    state.lastMessageAt = Date.now()
    if (state.closingCount > 0) state.closingCount = 0
}

function initAutoClearSession(sock, cfg) {
    state.sock = sock
    state.config = cfg
    state.lastMessageAt = Date.now()
    state.closingCount = 0

    const store = readStore()
    if (!fs.existsSync(STORE_PATH)) writeStore(store)

    patchConsoleLog()
    startHealthCheck()

    log('success',
        `${store.enabled ? 'aktif' : 'nonaktif'} · batas ${CLOSING_THRESHOLD}x · cooldown ${CLEAR_COOLDOWN_MS / 60000}m · ` +
        `notif ${(() => { const g = cfg?.autoSession?.notifGroup || store.notifGroup || 'owner'; return String(g).endsWith('@g.us') ? 'grup' : g })()}`
    )
}

function disableAutoClearSession() {
    const store = readStore()
    store.enabled = false
    writeStore(store)
    stopHealthCheck()
    log('info', 'dinonaktifkan')
}

function getAutoClearStats() {
    const store = readStore()
    return {
        enabled: store.enabled,
        notifGroup: store.notifGroup || state.config?.autoSession?.notifGroup || '-',
        closingCount: state.closingCount,
        closedSessionCount: state.closedSessionCount,
        totalAutoClear: state.totalAutoClear,
        lastClearAt: state.lastClearAt ? new Date(state.lastClearAt).toLocaleString('id-ID') : 'belum pernah',
        lastMessageAt: new Date(state.lastMessageAt).toLocaleString('id-ID'),
    }
}

export {
    initAutoClearSession,
    disableAutoClearSession,
    onMessageReceived,
    getAutoClearStats,
    autoClearSession,
    clearSessionForJid,
    readStore,
    writeStore,
}
