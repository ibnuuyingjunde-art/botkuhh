import fs from 'fs'
import path from 'path'
const JADIBOT_AUTH_FOLDER = path.join(process.cwd(), 'session', 'jadibot')

const jadibotDatabases = new Map()

function getJadibotDbPath(jadibotId) {
    const id = jadibotId.replace(/@.+/g, '')
    return path.join(JADIBOT_AUTH_FOLDER, id, 'data.json')
}

function loadJadibotDb(jadibotId) {
    const id = jadibotId.replace(/@.+/g, '')
    
    if (jadibotDatabases.has(id)) {
        return jadibotDatabases.get(id)
    }
    
    const dbPath = getJadibotDbPath(id)
    const dir = path.dirname(dbPath)
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    
    let data = {
        owners: [],
        premiums: [],
        settings: {},
        users: {},
        groups: {}
    }
    
    if (fs.existsSync(dbPath)) {
        try {
            const content = fs.readFileSync(dbPath, 'utf8')
            data = JSON.parse(content)
        } catch {}
    }
    
    jadibotDatabases.set(id, data)
    return data
}

function saveJadibotDb(jadibotId) {
    const id = jadibotId.replace(/@.+/g, '')
    const data = jadibotDatabases.get(id)
    if (!data) return
    
    const dbPath = getJadibotDbPath(id)
    const dir = path.dirname(dbPath)
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

function isJadibotOwner(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    const senderNum = jid?.replace(/[^0-9]/g, '') || ''
    return db.owners.some(o => o.replace(/[^0-9]/g, '') === senderNum)
}

function addJadibotOwner(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    const num = jid.replace(/[^0-9]/g, '')
    if (!db.owners.includes(num)) {
        db.owners.push(num)
        saveJadibotDb(jadibotId)
        return true
    }
    return false
}

function removeJadibotOwner(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    const num = jid.replace(/[^0-9]/g, '')
    const idx = db.owners.indexOf(num)
    if (idx !== -1) {
        db.owners.splice(idx, 1)
        saveJadibotDb(jadibotId)
        return true
    }
    return false
}

function getJadibotOwners(jadibotId) {
    const db = loadJadibotDb(jadibotId)
    return db.owners
}

// bug fix: expiry yang tersimpan di entri premium (lihat addJadibotPremium)
// sebelumnya tidak pernah dicek di sini, jadi user yang premium-nya sudah
// lewat expiry tetap dianggap premium selamanya. Sekalian bersihkan entri
// yang sudah kedaluwarsa dari data.json biar listprem juga akurat.
function pruneExpiredJadibotPremiums(jadibotId) {
    const db = loadJadibotDb(jadibotId)
    const now = Date.now()
    const before = db.premiums.length
    db.premiums = db.premiums.filter(p => {
        if (typeof p === 'string') return true
        if (!p.expiry) return true
        return p.expiry > now
    })
    if (db.premiums.length !== before) saveJadibotDb(jadibotId)
}

function isJadibotPremium(jadibotId, jid) {
    pruneExpiredJadibotPremiums(jadibotId)
    const db = loadJadibotDb(jadibotId)
    const senderNum = jid?.replace(/[^0-9]/g, '') || ''
    return db.premiums.some(p => {
        const premNum = typeof p === 'string' ? p.replace(/[^0-9]/g, '') : p.jid?.replace(/[^0-9]/g, '') || ''
        return premNum === senderNum
    })
}

function addJadibotPremium(jadibotId, jid, expiry = null) {
    const db = loadJadibotDb(jadibotId)
    const num = jid.replace(/[^0-9]/g, '')
    // bug fix: sebelumnya entri berbentuk string tidak dibersihkan dari karakter
    // non-digit (tidak konsisten dengan isJadibotPremium), sehingga deteksi
    // duplikat bisa gagal jika format tersimpan berbeda (mis. ada "@s.whatsapp.net")
    const existing = db.premiums.find(p => {
        const premNum = typeof p === 'string' ? p.replace(/[^0-9]/g, '') : p.jid?.replace(/[^0-9]/g, '') || ''
        return premNum === num
    })
    
    if (!existing) {
        db.premiums.push({ jid: num, expiry: expiry || null })
        saveJadibotDb(jadibotId)
        return true
    }
    return false
}

function removeJadibotPremium(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    const num = jid.replace(/[^0-9]/g, '')
    const idx = db.premiums.findIndex(p => {
        const premNum = typeof p === 'string' ? p : p.jid?.replace(/[^0-9]/g, '') || ''
        return premNum === num
    })
    
    if (idx !== -1) {
        db.premiums.splice(idx, 1)
        saveJadibotDb(jadibotId)
        return true
    }
    return false
}

function getJadibotPremiums(jadibotId) {
    pruneExpiredJadibotPremiums(jadibotId)
    const db = loadJadibotDb(jadibotId)
    return db.premiums
}

function getJadibotSetting(jadibotId, key) {
    const db = loadJadibotDb(jadibotId)
    return db.settings[key]
}

function setJadibotSetting(jadibotId, key, value) {
    const db = loadJadibotDb(jadibotId)
    db.settings[key] = value
    saveJadibotDb(jadibotId)
}

function getJadibotUser(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    return db.users[jid] || null
}

function setJadibotUser(jadibotId, jid, data) {
    const db = loadJadibotDb(jadibotId)
    db.users[jid] = { ...db.users[jid], ...data }
    saveJadibotDb(jadibotId)
}

function getJadibotGroup(jadibotId, jid) {
    const db = loadJadibotDb(jadibotId)
    return db.groups[jid] || null
}

function setJadibotGroup(jadibotId, jid, data) {
    const db = loadJadibotDb(jadibotId)
    db.groups[jid] = { ...db.groups[jid], ...data }
    saveJadibotDb(jadibotId)
}

function getAllJadibotData(jadibotId) {
    return loadJadibotDb(jadibotId)
}

export { loadJadibotDb, saveJadibotDb, isJadibotOwner, addJadibotOwner, removeJadibotOwner, getJadibotOwners, isJadibotPremium, addJadibotPremium, removeJadibotPremium, getJadibotPremiums, pruneExpiredJadibotPremiums, getJadibotSetting, setJadibotSetting, getJadibotUser, setJadibotUser, getJadibotGroup, setJadibotGroup, getAllJadibotData }