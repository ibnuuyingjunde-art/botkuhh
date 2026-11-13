import { getDatabase } from "./ichigo-database.js"

const MAX_LOG = 30 
const MAX_KOIN = 9000000000000
const MAX_EXP  = 9000000000

function _ensureRpg(user) {
    if (!user.rpg) user.rpg = {}
    if (!Array.isArray(user.rpg.koinLog))   user.rpg.koinLog   = []
    if (!Array.isArray(user.rpg.expLog))    user.rpg.expLog    = []
    if (!user.rpg.koinStat)                 user.rpg.koinStat  = {}
    if (!user.rpg.expStat)                  user.rpg.expStat   = {}
}

function _pushLog(arr, entry) {
    arr.unshift(entry)
    if (arr.length > MAX_LOG) arr.splice(MAX_LOG)
}

/**
 * Update akumulasi per sumber di stat
 * stat[sumber] = { masuk, keluar, count }
 */
function _updateStat(stat, sumber, amount) {
    if (!stat[sumber]) stat[sumber] = { masuk: 0, keluar: 0, count: 0 }
    if (amount > 0) stat[sumber].masuk  += amount
    else            stat[sumber].keluar += Math.abs(amount)
    stat[sumber].count++
}

/**
 * Tambah/kurangi koin user sekaligus catat ke log & stat per sumber.
 * Gunakan ini sebagai pengganti `user.koin += x` di plugin.
 *
 * @param {string} jid     - JID user
 * @param {number} amount  - Jumlah koin (+ masuk, - keluar)
 * @param {string} sumber  - Nama sumber (contoh: "Daily", "Work", "Shop", "Duel")
 * @returns {number}       - Saldo koin setelah transaksi
 */
function addKoin(jid, amount, sumber = "Lainnya") {
    if (!jid || amount === 0) return 0
    try {
        const db = getDatabase()
        const user = db.getUser(jid) || db.setUser(jid)
        if (!user) return 0

        _ensureRpg(user)

        user.koin = Math.max(0, Math.min(MAX_KOIN, (user.koin ?? 0) + amount))

        _pushLog(user.rpg.koinLog, {
            t: Date.now(),
            a: amount,
            k: sumber,
            s: user.koin,
        })

        _updateStat(user.rpg.koinStat, sumber, amount)

        db.markDirty("users")
        return user.koin
    } catch {
        return 0
    }
}

/**
 * Ambil log transaksi koin (terbaru duluan)
 *
 * @param {string} jid    - JID user
 * @param {number} limit  - Jumlah entri (default 15)
 * @returns {Array}
 */
function getKoinLog(jid, limit = 15) {
    if (!jid) return []
    try {
        const db = getDatabase()
        const user = db.getUser(jid)
        return (user?.rpg?.koinLog || []).slice(0, limit)
    } catch {
        return []
    }
}

/**
 * Ambil statistik koin per sumber
 * return: { Daily: { masuk, keluar, count }, Work: {...}, ... }
 *
 * @param {string} jid
 * @returns {Object}
 */
function getKoinStat(jid) {
    if (!jid) return {}
    try {
        const db = getDatabase()
        const user = db.getUser(jid)
        return user?.rpg?.koinStat || {}
    } catch {
        return {}
    }
}

/**
 * Tambah EXP user sekaligus catat ke log & stat per sumber.
 * Gunakan ini sebagai pengganti `user.exp += x` di plugin.
 * Catatan: untuk level-up gunakan tetap addExpWithLevelCheck,
 * cukup panggil addExp SETELAH addExpWithLevelCheck selesai.
 *
 * @param {string} jid     - JID user
 * @param {number} amount  - Jumlah EXP (selalu positif)
 * @param {string} sumber  - Nama sumber (contoh: "Daily", "Work", "Boss")
 * @returns {number}       - Total EXP setelah dapat
 */
function addExp(jid, amount, sumber = "Lainnya") {
    if (!jid || amount <= 0) return 0
    try {
        const db = getDatabase()
        const user = db.getUser(jid) || db.setUser(jid)
        if (!user) return 0

        _ensureRpg(user)

        const expSekarang = user.exp ?? 0

        _pushLog(user.rpg.expLog, {
            t: Date.now(),
            a: amount,
            k: sumber,
            e: expSekarang + amount,
        })

        _updateStat(user.rpg.expStat, sumber, amount)

        db.markDirty("users")
        return expSekarang + amount
    } catch {
        return 0
    }
}

/**
 * Ambil log EXP (terbaru duluan)
 *
 * @param {string} jid
 * @param {number} limit
 * @returns {Array}
 */
function getExpLog(jid, limit = 15) {
    if (!jid) return []
    try {
        const db = getDatabase()
        const user = db.getUser(jid)
        return (user?.rpg?.expLog || []).slice(0, limit)
    } catch {
        return []
    }
}

/**
 * Ambil statistik EXP per sumber
 *
 * @param {string} jid
 * @returns {Object}
 */
function getExpStat(jid) {
    if (!jid) return {}
    try {
        const db = getDatabase()
        const user = db.getUser(jid)
        return user?.rpg?.expStat || {}
    } catch {
        return {}
    }
}

/**
 * Ambil log gabungan koin & EXP, sort terbaru
 *
 * @param {string} jid
 * @param {number} limit
 * @param {string} filter  - "all" | "koin" | "exp"
 * @returns {Array}
 */
function getUnifiedLog(jid, limit = 15, filter = "all") {
    if (!jid) return []
    try {
        const db = getDatabase()
        const user = db.getUser(jid)
        if (!user?.rpg) return []

        let result = []
        if (filter !== "exp") result = result.concat((user.rpg.koinLog || []).map(e => ({ ...e, type: "koin" })))
        if (filter !== "koin") result = result.concat((user.rpg.expLog  || []).map(e => ({ ...e, type: "exp"  })))

        result.sort((a, b) => b.t - a.t)
        return result.slice(0, limit)
    } catch {
        return []
    }
}

const addKoinLog = (jid, amount, ket, saldo) => addKoin(jid, amount, ket)
const addExpLog  = (jid, amount, ket, exp)   => addExp(jid, amount, ket)

export {
    addKoin, getKoinLog, getKoinStat,
    addExp,  getExpLog,  getExpStat,
    getUnifiedLog,
    
    addKoinLog, addExpLog,
}
