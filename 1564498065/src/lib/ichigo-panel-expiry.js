import fs from 'fs'
import path from 'path'
import axios from 'axios'

const EXPIRY_DIR = path.join(process.cwd(), 'database', 'cpanel')
const EXPIRY_FILE = path.join(EXPIRY_DIR, 'panel_expiry.json')
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000 

function ensureDir() {
    if (!fs.existsSync(EXPIRY_DIR)) {
        fs.mkdirSync(EXPIRY_DIR, { recursive: true })
    }
}

function loadDB() {
    ensureDir()
    if (!fs.existsSync(EXPIRY_FILE)) {
        fs.writeFileSync(EXPIRY_FILE, '[]', 'utf8')
        return []
    }
    try {
        return JSON.parse(fs.readFileSync(EXPIRY_FILE, 'utf8'))
    } catch {
        return []
    }
}

function saveDB(data) {
    ensureDir()
    fs.writeFileSync(EXPIRY_FILE, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * Simpan record server yang baru dibuat
 * @param {Object} record
 * @param {string} record.username
 * @param {string} record.email
 * @param {number} record.userId       - ID user di pterodactyl
 * @param {number} record.serverId     - ID server di pterodactyl
 * @param {string} record.serverVersion - e.g. 'v1'
 * @param {string} record.domain
 * @param {string} record.apikey
 * @param {string} record.targetUser   - JID WhatsApp penerima
 * @param {number} record.createdAt    - Date.now()
 */
export function saveServerRecord(record) {
    const db = loadDB()
    db.push({
        ...record,
        expiresAt: record.createdAt + EXPIRE_MS
    })
    saveDB(db)
    console.log(`[EXPIRY] Recorded: ${record.username} (${record.serverVersion}) - expires in 30 days`)
}

/**
 * Cek dan hapus semua server/akun yang sudah expired (>= 30 hari)
 * Dipanggil via setInterval dari file utama bot
 */
export async function checkAndDeleteExpiredServers() {
    const db = loadDB()
    const now = Date.now()
    const remaining = []
    let deletedCount = 0

    for (const rec of db) {
        const expired = now >= rec.expiresAt

        if (!expired) {
            remaining.push(rec)
            continue
        }

        console.log(`[EXPIRY] Processing expired: ${rec.username} (${rec.serverVersion})`)

        let serverDeleted = false
        let userDeleted = false

        try {
            await axios.delete(
                `${rec.domain}/api/application/servers/${rec.serverId}`,
                {
                    headers: {
                        Authorization: `Bearer ${rec.apikey}`,
                        Accept: 'Application/vnd.pterodactyl.v1+json'
                    }
                }
            )
            serverDeleted = true
            console.log(`[EXPIRY] Server deleted: ${rec.serverId} (${rec.username})`)
        } catch (e) {
            const status = e?.response?.status
            
            if (status === 404) {
                serverDeleted = true
                console.log(`[EXPIRY] Server ${rec.serverId} sudah tidak ada (404), skip`)
            } else {
                const msg = e?.response?.data?.errors?.[0]?.detail || e.message
                console.error(`[EXPIRY] Gagal hapus server ${rec.serverId}: ${msg}`)
            }
        }

        if (serverDeleted) {
            try {
                await axios.delete(
                    `${rec.domain}/api/application/users/${rec.userId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${rec.apikey}`,
                            Accept: 'Application/vnd.pterodactyl.v1+json'
                        }
                    }
                )
                userDeleted = true
                console.log(`[EXPIRY] User deleted: ${rec.userId} (${rec.username})`)
            } catch (e) {
                const status = e?.response?.status
                if (status === 404) {
                    userDeleted = true
                    console.log(`[EXPIRY] User ${rec.userId} sudah tidak ada (404), skip`)
                } else {
                    const msg = e?.response?.data?.errors?.[0]?.detail || e.message
                    console.error(`[EXPIRY] Gagal hapus user ${rec.userId}: ${msg}`)
                }
            }
        }

        if (serverDeleted && userDeleted) {
            deletedCount++
            console.log(`[EXPIRY] Done: ${rec.username} (${rec.serverVersion}) removed from DB`)
        } else {
            
            remaining.push(rec)
        }
    }

    saveDB(remaining)

    if (deletedCount > 0) {
        console.log(`[EXPIRY] Selesai: ${deletedCount} akun expired dihapus`)
    }
}

/**
 * Ambil info expiry untuk username tertentu
 * @param {string} username
 * @returns {Object|null}
 */
export function getExpiryInfo(username) {
    const db = loadDB()
    const record = db.find(r => r.username === username)
    if (!record) return null

    const now = Date.now()
    const remaining = Math.max(0, record.expiresAt - now)
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))

    return {
        username: record.username,
        serverVersion: record.serverVersion,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        remaining,
        days,
        hours,
        isExpired: remaining === 0
    }
}

/**
 * List semua record expiry (untuk keperluan admin)
 * @returns {Array}
 */
export function listAllRecords() {
    return loadDB()
}