import fs from 'fs'
import path from 'path'
import { cleanNumber } from '../../src/lib/ichigo-roles-cpanel.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'autodelete',
    alias: ['autodel', 'checkinactive'],
    category: 'panel',
    description: 'Auto hapus server Pterodactyl yang tidak aktif selama 1 hari',
    usage: '.autodelete [on/off/check/run/info/setup/reset/whitelist/servers]',
    example: '.autodelete on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const DB_PATH         = path.join(process.cwd(), 'database', 'cpanel', 'panels.json')
const CONFIG_PATH     = path.join(process.cwd(), 'database', 'cpanel', 'autodelete-config.json')
const ACTIVITY_PATH   = path.join(process.cwd(), 'database', 'cpanel', 'server-activity.json')
const WHITELIST_PATH  = path.join(process.cwd(), 'database', 'cpanel', 'autodelete-whitelist.json')

const INACTIVE_MS = 24 * 60 * 60 * 1000

function toGB(mb) { return (mb / 1024).toFixed(1) }

function makeBar(pct) {
    const filled = Math.max(0, Math.min(10, Math.round(pct / 100 * 10)))
    const bar    = '▓'.repeat(filled) + '░'.repeat(10 - filled)
    const color  = pct >= 90 ? '🔴' : pct >= 70 ? '🟡' : '🟢'
    return `${color} [${bar}] ${pct}%`
}

const line = `━━━━━━━━━━━━━━━━━━━━━━\n`

function readJSON(filePath, fallback = {}) {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8')
        return fallback
    }
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) }
    catch { return fallback }
}

function writeJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function loadDB()         { return readJSON(DB_PATH, {}) }
function loadConfig()     { return readJSON(CONFIG_PATH, { enabled: false, pterodactyl: { url: '', apiKey: '' } }) }
function loadActivity()   { return readJSON(ACTIVITY_PATH, {}) }
function loadWhitelist()  { return readJSON(WHITELIST_PATH, { ids: [] }) }
function saveConfig(c)    { writeJSON(CONFIG_PATH, c) }
function saveActivity(d)  { writeJSON(ACTIVITY_PATH, d) }
function saveWhitelist(w) { writeJSON(WHITELIST_PATH, w) }

async function pteroRequest(cfg, method, endpoint, body = null) {
    const url = `${cfg.pterodactyl.url.replace(/\/$/, '')}/api/application${endpoint}`
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${cfg.pterodactyl.apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }
    if (body) options.body = JSON.stringify(body)
    const res = await fetch(url, options)
    if (res.status === 204) return null
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
    return res.json()
}

async function getAllServers(cfg) {
    const result = []
    let page = 1
    while (true) {
        const data = await pteroRequest(cfg, 'GET', `/servers?page=${page}&per_page=50`)
        if (!data?.data?.length) break
        result.push(...data.data)
        if (!data.meta?.pagination?.links?.next) break
        page++
    }
    return result
}

async function getServerUtilization(cfg, identifier) {
    try {
        const url = `${cfg.pterodactyl.url.replace(/\/$/, '')}/api/client/servers/${identifier}/resources`
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${cfg.pterodactyl.apiKey}`, 'Accept': 'application/json' }
        })
        if (!res.ok) return null
        return res.json()
    } catch { return null }
}

async function deleteServer(cfg, serverId) {
    await pteroRequest(cfg, 'DELETE', `/servers/${serverId}`)
}

async function getAdminUserIds(cfg) {
    try {
        const adminIds = new Set()
        let page = 1
        while (true) {
            const data = await pteroRequest(cfg, 'GET', `/users?page=${page}&per_page=100`)
            if (!data?.data?.length) break
            for (const u of data.data) {
                if (u.attributes?.root_admin === true) adminIds.add(u.attributes.id)
            }
            if (!data.meta?.pagination?.links?.next) break
            page++
        }
        return adminIds
    } catch { return new Set() }
}

function buildOwnerMap(db) {
    const map = {}
    for (const [number, panels] of Object.entries(db)) {
        if (!Array.isArray(panels)) continue
        for (const p of panels) {
            if (p.serverId) map[String(p.serverId)] = { number, name: p.name }
        }
    }
    return map
}

/**
 * Kembalikan berapa ms server sudah tidak aktif / belum dipakai.
 * - Jika server pernah aktif  → pakai lastActive
 * - Jika server belum pernah aktif → pakai firstSeen
 * Kalau firstSeen juga belum ada (server lama tanpa tracking) → set firstSeen = now, return 0
 */
function getInactiveMs(activity, serverId, now) {
    const rec = activity[serverId]
    if (!rec) return null                          

    if (rec.lastActive) return now - rec.lastActive  
    if (rec.firstSeen)  return now - rec.firstSeen   
    return null
}

async function runAutoDelete(cfg, sock = null) {
    const now       = Date.now()
    const activity  = loadActivity()
    const db        = loadDB()
    const whitelist = loadWhitelist()
    const wlSet     = new Set(whitelist.ids.map(String))

    let servers
    try { servers = await getAllServers(cfg) }
    catch (err) { throw new Error(`Gagal ambil daftar server: ${err.message}`) }

    const ownerMap     = buildOwnerMap(db)
    const adminUserIds = await getAdminUserIds(cfg)
    const deleted = [], skipped = [], errors = []

    for (const server of servers) {
        const attrs    = server.attributes
        const serverId = String(attrs.id)
        const srvName  = attrs.name

        if (wlSet.has(serverId)) {
            skipped.push({ id: serverId, name: srvName, reason: 'whitelist' })
            continue
        }

        if (adminUserIds.has(attrs.user)) {
            skipped.push({ id: serverId, name: srvName, reason: 'admin' })
            continue
        }

        const util      = await getServerUtilization(cfg, attrs.identifier)
        const isRunning = util?.attributes?.current_state === 'running'
        const cpuUsage  = util?.attributes?.resources?.cpu_absolute ?? 0
        const netRx     = util?.attributes?.resources?.network_rx_bytes ?? 0
        const isActive  = isRunning && (cpuUsage > 0.5 || netRx > 0)

        if (isActive) {
            
            activity[serverId] = { lastActive: now, name: srvName }
            skipped.push({ id: serverId, name: srvName, reason: 'active' })
            continue
        }

        if (!activity[serverId]) {
            
            activity[serverId] = { firstSeen: now, name: srvName }
            skipped.push({ id: serverId, name: srvName, reason: 'new-tracked' })
            continue
        }

        if (!activity[serverId].firstSeen && !activity[serverId].lastActive) {
            activity[serverId].firstSeen = now
            activity[serverId].name      = srvName
            skipped.push({ id: serverId, name: srvName, reason: 'new-tracked' })
            continue
        }

        const inactiveMs = getInactiveMs(activity, serverId, now)
        if (inactiveMs === null) {
            skipped.push({ id: serverId, name: srvName, reason: 'unknown' })
            continue
        }

        const inactiveHour = Math.floor(inactiveMs / (1000 * 60 * 60))

        if (inactiveMs >= INACTIVE_MS) {
            
            try {
                await deleteServer(cfg, serverId)

                const owner = ownerMap[serverId]
                if (owner) db[owner.number] = (db[owner.number] || []).filter(p => String(p.serverId) !== serverId)

                delete activity[serverId]
                const neverUsed = !activity[serverId]?.lastActive  
                deleted.push({
                    id: serverId,
                    name: srvName,
                    inactiveHour,
                    owner: ownerMap[serverId]?.number || 'unknown',
                    neverUsed: !ownerMap[serverId]   
                })

                if (sock && owner?.number) {
                    try {
                        await sock.sendMessage(`${owner.number}@s.whatsapp.net`, {
                            text: `⚠️ *[ AUTO DELETE ]*\n\nServer *${srvName}* dihapus otomatis karena tidak aktif selama *${inactiveHour} jam*.\n\n_Hubungi admin jika ada pertanyaan._`
                        })
                    } catch {}
                }
            } catch (err) {
                errors.push({ id: serverId, name: srvName, error: err.message })
            }
        } else {
            skipped.push({ id: serverId, name: srvName, reason: `${inactiveHour}j` })
        }
    }

    saveActivity(activity)
    writeJSON(DB_PATH, db)
    return { deleted, skipped, errors, total: servers.length }
}

let autoDeleteInterval = null

export function startAutoDeleteScheduler(sock) {
    if (autoDeleteInterval) return
    autoDeleteInterval = setInterval(async () => {
        const cfg = loadConfig()
        if (!cfg.enabled || !cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey) return
        console.log('[auto-delete] Cek server tidak aktif...')
        try {
            const result = await runAutoDelete(cfg, sock)
            console.log(`[auto-delete] Selesai — dihapus: ${result.deleted.length}, error: ${result.errors.length}`)
        } catch (err) {
            console.error('[auto-delete] Error:', err.message)
        }
    }, 60 * 60 * 1000)
    console.log('[auto-delete] Scheduler aktif.')
}

export function stopAutoDeleteScheduler() {
    if (autoDeleteInterval) {
        clearInterval(autoDeleteInterval)
        autoDeleteInterval = null
        console.log('[auto-delete] Scheduler dimatikan.')
    }
}

async function handler(m, { sock }) {
    try {
        const args = (m.body || '').trim().split(/\s+/).filter(Boolean).slice(1)
        const sub  = args[0]?.toLowerCase().trim()
        const cfg  = loadConfig()

        if (!sub || sub === 'status') {
            const activity  = loadActivity()
            const tracked   = Object.keys(activity).length
            const neverUsed = Object.values(activity).filter(r => !r.lastActive && r.firstSeen).length
            const wlCount   = loadWhitelist().ids.length

            return m.reply(
                `🗑️ *AUTO DELETE SERVER*\n` +
                line +
                `› Status     : ${cfg.enabled ? '🟢 Aktif' : '🔴 Nonaktif'}\n` +
                `› Panel      : ${cfg.pterodactyl?.url || '—'}\n` +
                `› Threshold  : 24 jam tidak aktif\n` +
                `› Jadwal cek : Setiap 1 jam\n` +
                `› Ditrack    : ${tracked} server\n` +
                `› Blm dipakai: ${neverUsed} server\n` +
                `› Whitelist  : ${wlCount} server\n` +
                line +
                `*PERINTAH*\n` +
                `› on          — Aktifkan auto delete\n` +
                `› off         — Matikan auto delete\n` +
                `› setup <url> <key> — Set panel\n` +
                `› check       — Cek server tidak aktif\n` +
                `› run         — Hapus sekarang\n` +
                `› info        — Info node & resource\n` +
                `› reset <id>  — Reset timer server\n` +
                `› servers     — Lihat semua server & ID\n` +
                `› whitelist list          — Lihat whitelist\n` +
                `› whitelist add <id>      — Tambah ke whitelist\n` +
                `› whitelist remove <id>   — Hapus dari whitelist\n` +
                line +
                `🛡️ _Server milik admin panel & whitelist tidak akan dihapus._`
            )
        }

        if (sub === 'whitelist') {
            const wlSub = args[1]?.toLowerCase()
            const wlId  = args[2] ? String(args[2]) : null
            const wl    = loadWhitelist()

            if (!wlSub || wlSub === 'list') {
                if (wl.ids.length === 0)
                    return m.reply(
                        `📋 *WHITELIST KOSONG*\n` +
                        line +
                        `Belum ada server yang diwhitelist.\n\n` +
                        `Gunakan:\n` +
                        `› \`.autodelete whitelist add <serverid>\``
                    )

                let txt =
                    `📋 *WHITELIST SERVER*\n` +
                    line +
                    `› Total: ${wl.ids.length} server\n` +
                    line

                const activity = loadActivity()
                for (const id of wl.ids) {
                    const name = activity[id]?.name || '—'
                    txt += `  🛡️ ID: \`${id}\`  |  ${name}\n`
                }

                txt += `\n_Server di atas tidak akan dihapus meskipun tidak aktif._`
                return m.reply(txt)
            }

            if (wlSub === 'add') {
                if (!wlId)
                    return m.reply(
                        `❌ *Format salah*\n\n` +
                        `Gunakan: \`.autodelete whitelist add <serverid>\`\n\n` +
                        `Cek ID server: \`.autodelete servers\``
                    )

                if (wl.ids.includes(wlId))
                    return m.reply(`⚠️ Server ID \`${wlId}\` sudah ada di whitelist.`)

                wl.ids.push(wlId)
                saveWhitelist(wl)

                const name = loadActivity()[wlId]?.name || 'tidak diketahui'
                return m.reply(
                    `✅ *Ditambahkan ke whitelist*\n` +
                    line +
                    `› ID   : \`${wlId}\`\n` +
                    `› Nama : ${name}\n` +
                    `› Total whitelist: ${wl.ids.length} server\n\n` +
                    `_Server ini tidak akan dihapus otomatis._`
                )
            }

            if (wlSub === 'remove') {
                if (!wlId)
                    return m.reply(
                        `❌ *Format salah*\n\n` +
                        `Gunakan: \`.autodelete whitelist remove <serverid>\``
                    )

                if (!wl.ids.includes(wlId))
                    return m.reply(`❌ Server ID \`${wlId}\` tidak ada di whitelist.`)

                wl.ids = wl.ids.filter(id => id !== wlId)
                saveWhitelist(wl)

                return m.reply(
                    `✅ *Dihapus dari whitelist*\n` +
                    line +
                    `› ID   : \`${wlId}\`\n` +
                    `› Sisa whitelist: ${wl.ids.length} server\n\n` +
                    `_Server ini sekarang bisa dihapus otomatis jika tidak aktif._`
                )
            }

            return m.reply(
                `❌ Sub-command whitelist tidak dikenal.\n\n` +
                `Tersedia:\n` +
                `› \`.autodelete whitelist list\`\n` +
                `› \`.autodelete whitelist add <id>\`\n` +
                `› \`.autodelete whitelist remove <id>\``
            )
        }

        if (sub === 'servers') {
            if (!cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey)
                return m.reply(`❌ Setup panel dulu.\nGunakan: \`.autodelete setup <url> <apikey>\``)

            await m.reply(`🔍 Mengambil daftar semua server...`)

            let servers
            try { servers = await getAllServers(cfg) }
            catch (err) { return m.reply(`❌ Gagal ambil server: ${err.message}`) }

            if (servers.length === 0)
                return m.reply(`❌ Tidak ada server ditemukan di panel.`)

            const now          = Date.now()
            const activity     = loadActivity()
            const db           = loadDB()
            const ownerMap     = buildOwnerMap(db)
            const adminUserIds = await getAdminUserIds(cfg)
            const wlSet        = new Set(loadWhitelist().ids.map(String))

            let txt =
                `🖥️ *SEMUA SERVER (${servers.length})*\n` +
                line

            const groups = {
                whitelist: [],
                admin:     [],
                active:    [],
                inactive:  [],
                neverUsed: [],   
                newSrv:    []    
            }

            for (const server of servers) {
                const attrs    = server.attributes
                const serverId = String(attrs.id)

                if (wlSet.has(serverId)) {
                    groups.whitelist.push({ attrs, serverId, inactiveHour: 0, tag: '' })
                    continue
                }

                if (adminUserIds.has(attrs.user)) {
                    groups.admin.push({ attrs, serverId, inactiveHour: 0, tag: '' })
                    continue
                }

                const rec = activity[serverId]

                if (!rec || (!rec.firstSeen && !rec.lastActive)) {
                    groups.newSrv.push({ attrs, serverId, inactiveHour: 0, tag: '⚪ baru ditrack' })
                    continue
                }

                if (rec.lastActive) {
                    const inactiveMs   = now - rec.lastActive
                    const inactiveHour = Math.floor(inactiveMs / (1000 * 60 * 60))
                    if (inactiveMs >= INACTIVE_MS) {
                        groups.inactive.push({ attrs, serverId, inactiveHour, tag: '🗑️ akan dihapus' })
                    } else {
                        groups.active.push({ attrs, serverId, inactiveHour, tag: '✅ aman' })
                    }
                    continue
                }

                if (rec.firstSeen) {
                    const waitMs   = now - rec.firstSeen
                    const waitHour = Math.floor(waitMs / (1000 * 60 * 60))
                    const tag      = waitMs >= INACTIVE_MS ? '🗑️ akan dihapus' : `⏳ ${waitHour}j / 24j`
                    groups.neverUsed.push({ attrs, serverId, inactiveHour: waitHour, tag })
                    continue
                }
            }

            const renderGroup = (label, icon, items, showHour = false) => {
                if (!items.length) return ''
                let out = `${icon} *${label} (${items.length})*\n`
                for (const { attrs, serverId, inactiveHour, tag } of items) {
                    const owner = ownerMap[serverId]?.number || '—'
                    out += `  › ID: \`${serverId}\` | ${attrs.name}\n`
                    out += `    Owner: ${owner}`
                    if (showHour && tag) out += `  ${tag}`
                    out += `\n`
                }
                return out + '\n'
            }

            txt += renderGroup('WHITELIST (dilindungi)',       '🛡️', groups.whitelist)
            txt += renderGroup('ADMIN PANEL (dilindungi)',     '👑', groups.admin)
            txt += renderGroup('AKAN DIHAPUS (tidak aktif)',   '🗑️', groups.inactive,  true)
            txt += renderGroup('BELUM PERNAH DIPAKAI',         '🚫', groups.neverUsed,  true)
            txt += renderGroup('MASIH AMAN',                   '✅', groups.active,     true)
            txt += renderGroup('BARU DITRACK',                 '⚪', groups.newSrv)

            txt += line
            txt += `📊 *Ringkasan:*\n`
            txt += `  Whitelist      : ${groups.whitelist.length}\n`
            txt += `  Admin          : ${groups.admin.length}\n`
            txt += `  Akan dihapus   : ${groups.inactive.length + groups.neverUsed.filter(s => s.tag.includes('dihapus')).length}\n`
            txt += `  Blm pernah pakai: ${groups.neverUsed.length}\n`
            txt += `  Aman           : ${groups.active.length}\n`
            txt += `  Baru ditrack   : ${groups.newSrv.length}\n\n`
            txt += `_Gunakan \`.autodelete whitelist add <id>\` untuk proteksi server._`

            return m.reply(txt)
        }

        if (sub === 'setup') {
            const [, url, apiKey] = args
            if (!url || !apiKey)
                return m.reply(
                    `❌ *Format salah*\n\n` +
                    `Gunakan:\n` +
                    `› \`.autodelete setup <url> <apikey>\`\n\n` +
                    `Contoh:\n` +
                    `› \`.autodelete setup https://panel.domain.com ptla_xxxxx\``
                )

            cfg.pterodactyl = { url, apiKey }
            saveConfig(cfg)
            return m.reply(
                `✅ *Panel berhasil disimpan*\n` +
                line +
                `› URL     : ${url}\n` +
                `› API Key : ${apiKey.slice(0, 8)}...`
            )
        }

        if (sub === 'on') {
            if (!cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey)
                return m.reply(`❌ Setup panel dulu.\nGunakan: \`.autodelete setup <url> <apikey>\``)

            cfg.enabled = true
            saveConfig(cfg)
            startAutoDeleteScheduler(sock)
            return m.reply(
                `✅ *Auto Delete diaktifkan*\n` +
                line +
                `› Server tidak aktif >24 jam akan dihapus otomatis\n` +
                `› Server baru/belum dipakai >24 jam juga akan dihapus\n` +
                `› Pengecekan dilakukan setiap 1 jam\n` +
                `› Server admin panel & whitelist tidak akan ikut dihapus`
            )
        }

        if (sub === 'off') {
            cfg.enabled = false
            saveConfig(cfg)
            stopAutoDeleteScheduler()
            return m.reply(
                `🔴 *Auto Delete dimatikan*\n` +
                line +
                `› Server tidak akan dihapus otomatis`
            )
        }

        if (sub === 'check') {
            if (!cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey)
                return m.reply(`❌ Setup panel dulu.\nGunakan: \`.autodelete setup <url> <apikey>\``)

            await m.reply(`🔍 Mengecek server...`)

            let servers
            try { servers = await getAllServers(cfg) }
            catch (err) { return m.reply(`❌ Gagal ambil server: ${err.message}`) }

            const now          = Date.now()
            const activity     = loadActivity()
            const adminUserIds = await getAdminUserIds(cfg)
            const wlSet        = new Set(loadWhitelist().ids.map(String))

            const willDelete   = []   
            const neverUsed    = []   
            const neverUsedSafe= []   
            const safe         = []   
            const adminSafe    = []
            const whitelisted  = []
            const newServer    = []   

            for (const server of servers) {
                const attrs    = server.attributes
                const serverId = String(attrs.id)

                if (wlSet.has(serverId)) {
                    whitelisted.push(attrs.name)
                    continue
                }

                if (adminUserIds.has(attrs.user)) {
                    adminSafe.push(attrs.name)
                    continue
                }

                const rec = activity[serverId]

                if (!rec || (!rec.firstSeen && !rec.lastActive)) {
                    newServer.push(attrs.name)
                    continue
                }

                if (rec.lastActive) {
                    const inactiveMs   = now - rec.lastActive
                    const inactiveHour = Math.floor(inactiveMs / (1000 * 60 * 60))
                    if (inactiveMs >= INACTIVE_MS) {
                        willDelete.push({ name: attrs.name, inactiveHour, type: 'inactive' })
                    } else {
                        safe.push({ name: attrs.name, inactiveHour })
                    }
                    continue
                }

                if (rec.firstSeen) {
                    const waitMs   = now - rec.firstSeen
                    const waitHour = Math.floor(waitMs / (1000 * 60 * 60))
                    if (waitMs >= INACTIVE_MS) {
                        neverUsed.push({ name: attrs.name, waitHour })
                    } else {
                        neverUsedSafe.push({ name: attrs.name, waitHour })
                    }
                }
            }

            const totalDelete = willDelete.length + neverUsed.length

            let txt =
                `📋 *CEK SERVER TIDAK AKTIF*\n` +
                line +
                `› Total      : ${servers.length} server\n` +
                `› Akan dihapus : ${totalDelete} server\n` +
                `  ∟ Tidak aktif : ${willDelete.length}\n` +
                `  ∟ Tdk pernah pakai : ${neverUsed.length}\n` +
                `› Aman       : ${safe.length} server\n` +
                `› Blm dipakai (aman) : ${neverUsedSafe.length} server\n` +
                `› Baru       : ${newServer.length} server\n` +
                `› Dilindungi : ${adminSafe.length + whitelisted.length} server\n` +
                line

            if (willDelete.length > 0) {
                txt += `🗑️ *AKAN DIHAPUS (tidak aktif)*\n`
                for (const s of willDelete) txt += `  › ${s.name}  (${s.inactiveHour}j tidak aktif)\n`
                txt += `\n`
            }

            if (neverUsed.length > 0) {
                txt += `🚫 *AKAN DIHAPUS (belum pernah dipakai)*\n`
                for (const s of neverUsed) txt += `  › ${s.name}  (dibuat ${s.waitHour}j lalu, tidak pernah aktif)\n`
                txt += `\n`
            }

            if (neverUsedSafe.length > 0) {
                txt += `⏳ *BELUM DIPAKAI (masih dalam grace period)*\n`
                for (const s of neverUsedSafe) txt += `  › ${s.name}  (${s.waitHour}j / 24j)\n`
                txt += `\n`
            }

            if (safe.length > 0) {
                txt += `✅ *MASIH AMAN*\n`
                for (const s of safe.slice(0, 10)) txt += `  › ${s.name}  (${s.inactiveHour}j / 24j)\n`
                if (safe.length > 10) txt += `  › ...dan ${safe.length - 10} lainnya\n`
                txt += `\n`
            }

            if (newServer.length > 0) {
                txt += `⚪ *BARU DITRACK*\n`
                for (const n of newServer.slice(0, 5)) txt += `  › ${n}\n`
                if (newServer.length > 5) txt += `  › ...dan ${newServer.length - 5} lainnya\n`
                txt += `\n`
            }

            if (whitelisted.length > 0) {
                txt += `🛡️ *WHITELIST (aman permanen)*\n`
                for (const n of whitelisted) txt += `  › ${n}\n`
                txt += `\n`
            }

            if (adminSafe.length > 0) {
                txt += `👑 *ADMIN PANEL (dilindungi)*\n`
                for (const n of adminSafe) txt += `  › ${n}\n`
                txt += `\n`
            }

            if (totalDelete > 0) txt += `_Gunakan \`.autodelete run\` untuk hapus sekarang._`
            else txt += `_Tidak ada server yang perlu dihapus._`

            return m.reply(txt)
        }

        if (sub === 'run') {
            if (!cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey)
                return m.reply(`❌ Setup panel dulu.\nGunakan: \`.autodelete setup <url> <apikey>\``)

            await m.reply(`⚙️ Menjalankan auto delete...`)

            let result
            try { result = await runAutoDelete(cfg, sock) }
            catch (err) { return m.reply(`❌ Gagal: ${err.message}`) }

            const adminSkipped    = result.skipped.filter(s => s.reason === 'admin')
            const wlSkipped       = result.skipped.filter(s => s.reason === 'whitelist')
            const newTracked      = result.skipped.filter(s => s.reason === 'new-tracked')
            const activeSkipped   = result.skipped.filter(s => s.reason === 'active')
            const inactSkipped    = result.skipped.filter(s => !['admin', 'whitelist', 'new-tracked', 'active', 'unknown'].includes(s.reason))

            let txt =
                `✅ *AUTO DELETE SELESAI*\n` +
                line +
                `› Total        : ${result.total} server\n` +
                `› Dihapus      : ${result.deleted.length} server\n` +
                `› Masih aman   : ${inactSkipped.length} server\n` +
                `› Sedang aktif : ${activeSkipped.length} server\n` +
                `› Baru ditrack : ${newTracked.length} server\n` +
                `› Whitelist    : ${wlSkipped.length} server\n` +
                `› Dilindungi   : ${adminSkipped.length} server\n` +
                `› Error        : ${result.errors.length}\n` +
                line

            if (result.deleted.length > 0) {
                txt += `🗑️ *SERVER DIHAPUS*\n`
                for (const d of result.deleted) {
                    txt += `  › ${d.name}  (${d.inactiveHour}j — owner: ${d.owner})\n`
                }
                txt += `\n`
            }

            if (result.errors.length > 0) {
                txt += `❌ *ERROR*\n`
                for (const e of result.errors) txt += `  › ${e.name}: ${e.error}\n`
                txt += `\n`
            }

            if (result.deleted.length === 0) txt += `_Tidak ada server yang perlu dihapus._`

            return m.reply(txt)
        }

        if (sub === 'reset') {
            const serverId = args[1]
            if (!serverId)
                return m.reply(
                    `❌ *Format salah*\n\n` +
                    `Gunakan: \`.autodelete reset <serverid>\``
                )

            const activity = loadActivity()
            if (!activity[serverId])
                return m.reply(`❌ Server ID \`${serverId}\` tidak ditemukan.`)

            const before = activity[serverId].lastActive
                ? new Date(activity[serverId].lastActive).toLocaleString('id-ID')
                : activity[serverId].firstSeen
                    ? `firstSeen: ${new Date(activity[serverId].firstSeen).toLocaleString('id-ID')}`
                    : '—'

            activity[serverId].lastActive = Date.now()
            delete activity[serverId].firstSeen
            saveActivity(activity)

            return m.reply(
                `✅ *Timer direset*\n` +
                line +
                `› Server    : ${activity[serverId].name}\n` +
                `› ID        : ${serverId}\n` +
                `› Sebelumnya: ${before}\n` +
                `› Sekarang  : ${new Date().toLocaleString('id-ID')}`
            )
        }

        if (sub === 'info') {
            if (!cfg.pterodactyl?.url || !cfg.pterodactyl?.apiKey)
                return m.reply(`❌ Setup panel dulu.\nGunakan: \`.autodelete setup <url> <apikey>\``)

            await m.reply(`🔍 Mengambil info panel...`)

            try {
                const nodesData    = await pteroRequest(cfg, 'GET', '/nodes?per_page=100')
                const nodes        = nodesData?.data || []
                const servers      = await getAllServers(cfg)
                const now          = Date.now()
                const activity     = loadActivity()
                const db           = loadDB()
                const ownerMap     = buildOwnerMap(db)
                const adminUserIds = await getAdminUserIds(cfg)
                const wlSet        = new Set(loadWhitelist().ids.map(String))

                const inactiveList  = []   
                const neverUsedDel  = []   
                const neverUsedSafe = []   
                const notTracked    = []   
                const adminList     = []
                const wlList        = []

                for (const server of servers) {
                    const attrs    = server.attributes
                    const serverId = String(attrs.id)

                    if (wlSet.has(serverId)) {
                        wlList.push(attrs.name)
                        continue
                    }

                    if (adminUserIds.has(attrs.user)) {
                        adminList.push(attrs.name)
                        continue
                    }

                    const rec = activity[serverId]

                    if (!rec || (!rec.firstSeen && !rec.lastActive)) {
                        notTracked.push(attrs.name)
                        continue
                    }

                    if (rec.lastActive) {
                        const inactiveMs   = now - rec.lastActive
                        const inactiveHour = Math.floor(inactiveMs / (1000 * 60 * 60))
                        if (inactiveMs >= INACTIVE_MS) {
                            inactiveList.push({
                                name: attrs.name,
                                inactiveHour,
                                owner: ownerMap[serverId]?.number || '—'
                            })
                        }
                        continue
                    }

                    if (rec.firstSeen) {
                        const waitMs   = now - rec.firstSeen
                        const waitHour = Math.floor(waitMs / (1000 * 60 * 60))
                        if (waitMs >= INACTIVE_MS) {
                            neverUsedDel.push({ name: attrs.name, waitHour, owner: ownerMap[serverId]?.number || '—' })
                        } else {
                            neverUsedSafe.push({ name: attrs.name, waitHour })
                        }
                    }
                }

                const totalWillDelete = inactiveList.length + neverUsedDel.length

                let txt =
                    `📊 *INFO PANEL PTERODACTYL*\n` +
                    line +
                    `› Server       : ${servers.length}\n` +
                    `› Node         : ${nodes.length}\n` +
                    `› Akan dihapus : ${totalWillDelete} server\n` +
                    `  ∟ Tidak aktif       : ${inactiveList.length}\n` +
                    `  ∟ Tdk pernah pakai  : ${neverUsedDel.length}\n` +
                    `› Blm pakai (aman)    : ${neverUsedSafe.length} server\n` +
                    `› Belum ditrack : ${notTracked.length} server\n` +
                    `› Whitelist    : ${wlList.length} server\n` +
                    `› Dilindungi   : ${adminList.length} server\n` +
                    line

                if (nodes.length === 0) {
                    txt += `❌ Tidak ada node ditemukan.`
                } else {
                    let totalRamUsed = 0, totalRamLimit = 0
                    let totalDiskUsed = 0, totalDiskLimit = 0

                    for (const node of nodes) {
                        const n        = node.attributes
                        const ramOver  = n.memory_overallocate > 0 ? n.memory_overallocate : 0
                        const diskOver = n.disk_overallocate   > 0 ? n.disk_overallocate   : 0
                        const ramEff   = Math.floor(n.memory * (1 + ramOver  / 100))
                        const diskEff  = Math.floor(n.disk   * (1 + diskOver / 100))

                        const nodeSrvs = servers.filter(s => s.attributes?.node === n.id)
                        const ramUsed  = nodeSrvs.reduce((a, s) => a + (s.attributes?.limits?.memory || 0), 0)
                        const diskUsed = nodeSrvs.reduce((a, s) => a + (s.attributes?.limits?.disk   || 0), 0)

                        totalRamUsed   += ramUsed
                        totalRamLimit  += ramEff
                        totalDiskUsed  += diskUsed
                        totalDiskLimit += diskEff

                        const ramPct   = ramEff  > 0 ? Math.min(100, Math.round(ramUsed  / ramEff  * 100)) : 0
                        const diskPct  = diskEff > 0 ? Math.min(100, Math.round(diskUsed / diskEff * 100)) : 0
                        const ramDisp  = n.memory_overallocate === -1 ? 'Unlimited' : `${toGB(ramEff)} GB`
                        const diskDisp = n.disk_overallocate   === -1 ? 'Unlimited' : `${toGB(diskEff)} GB`

                        txt += `🖥️ *NODE: ${n.name}*\n`
                        txt += `  RAM  : ${makeBar(ramPct)}\n`
                        txt += `         ${toGB(ramUsed)} GB / ${ramDisp}\n`
                        txt += `  Disk : ${makeBar(diskPct)}\n`
                        txt += `         ${toGB(diskUsed)} GB / ${diskDisp}\n`
                        txt += `  Server: ${nodeSrvs.length}\n`
                        if (ramPct  >= 90) txt += `  ⚠️ RAM hampir penuh!\n`
                        if (diskPct >= 90) txt += `  ⚠️ Disk hampir penuh!\n`
                        txt += `\n`
                    }

                    const totalRamPct  = totalRamLimit  > 0 ? Math.round(totalRamUsed  / totalRamLimit  * 100) : 0
                    const totalDiskPct = totalDiskLimit > 0 ? Math.round(totalDiskUsed / totalDiskLimit * 100) : 0
                    const safeRamSlot  = totalRamLimit  > 0 ? Math.floor((totalRamLimit  * 0.80 - totalRamUsed)  / 512)  : 0
                    const safeDiskSlot = totalDiskLimit > 0 ? Math.floor((totalDiskLimit * 0.80 - totalDiskUsed) / 5120) : 0
                    const safeSlot     = Math.max(0, Math.min(safeRamSlot, safeDiskSlot))

                    txt += line
                    txt += `📈 *TOTAL KESELURUHAN*\n`
                    txt += `  RAM  : ${makeBar(totalRamPct)}\n`
                    txt += `  Disk : ${makeBar(totalDiskPct)}\n`
                    txt += `  Server: ${servers.length}\n\n`
                    txt += `💡 *KAPASITAS TERSISA*\n`
                    txt += `  Sisa slot aman: *${safeSlot} server*\n`
                    txt += `  _(asumsi 512 MB RAM + 5 GB disk/server)_\n`
                    txt += line

                    if (totalRamPct >= 80 || totalDiskPct >= 80) {
                        txt += `⚠️ Panel mulai penuh — pertimbangkan hapus server tidak aktif.\n`
                    } else {
                        txt += `✅ Panel dalam kondisi aman.\n`
                    }

                    if (inactiveList.length > 0) {
                        txt += `\n🔴 *TIDAK AKTIF >= 24 JAM*\n`
                        for (const s of inactiveList) {
                            txt += `  › ${s.name}  (${s.inactiveHour}j — owner: ${s.owner})\n`
                        }
                    }

                    if (neverUsedDel.length > 0) {
                        txt += `\n🚫 *BELUM PERNAH DIPAKAI >= 24 JAM*\n`
                        for (const s of neverUsedDel) {
                            txt += `  › ${s.name}  (dibuat ${s.waitHour}j lalu — owner: ${s.owner})\n`
                        }
                    }

                    if (totalWillDelete > 0) {
                        txt += `_Gunakan \`.autodelete run\` untuk hapus semua._\n`
                    } else {
                        txt += `\n✅ Semua server aktif.\n`
                    }

                    if (neverUsedSafe.length > 0) {
                        txt += `\n⏳ *BELUM DIPAKAI (masih grace period)*\n`
                        for (const s of neverUsedSafe) txt += `  › ${s.name}  (${s.waitHour}j / 24j)\n`
                    }

                    if (notTracked.length > 0) {
                        txt += `\n⚪ *BELUM DITRACK*\n`
                        for (const n of notTracked.slice(0, 5)) txt += `  › ${n}\n`
                        if (notTracked.length > 5) txt += `  › ...dan ${notTracked.length - 5} lainnya\n`
                        txt += `_Jalankan \`.autodelete run\` agar mulai ditrack._\n`
                    }

                    if (wlList.length > 0) {
                        txt += `\n🛡️ *WHITELIST (aman permanen)*\n`
                        for (const n of wlList) txt += `  › ${n}\n`
                        txt += `_Server ini tidak akan dihapus otomatis._\n`
                    }

                    if (adminList.length > 0) {
                        txt += `\n👑 *DILINDUNGI (admin panel)*\n`
                        for (const n of adminList) txt += `  › ${n}\n`
                        txt += `_Server ini tidak akan dihapus otomatis._`
                    }
                }

                return m.reply(txt)
            } catch (err) {
                return m.reply(`❌ Gagal ambil info: ${err.message}`)
            }
        }

        return m.reply(
            `❌ Sub-command tidak dikenal.\n` +
            `Gunakan \`.autodelete\` untuk melihat daftar perintah.`
        )

    } catch (err) {
        console.error('[autodelete error]', err?.message || err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }