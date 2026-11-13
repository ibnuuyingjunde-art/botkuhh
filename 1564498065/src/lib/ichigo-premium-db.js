import path from 'path'
import { openStore, importJsonOnce } from './ichigo-sqlite-store.js'

// Store lama ini dulu disimpan di src/database/*.json. Sekarang di ichigo.db
// (store: pdb_owner / pdb_premium / pdb_partner). JSON lama di-import sekali lalu
// di-rename jadi *.json.migrated.bak.
const LEGACY_DIR = path.join(process.cwd(), 'src', 'database')
const DB_FILE = path.join(process.cwd(), 'database', 'main', 'ichigo.db')

const cache = {}
let sql = null

function getSql() {
    if (!sql) sql = openStore(DB_FILE)
    return sql
}

function loadList(name, field, legacyFile) {
    if (cache[name]) return cache[name]
    try {
        const st = getSql()
        importJsonOnce(st, name, path.join(LEGACY_DIR, legacyFile))
        const data = st.load(name, {})
        cache[name] = Array.isArray(data[field]) ? data[field] : []
    } catch {
        return []
    }
    return cache[name]
}

function saveList(name, field, list) {
    cache[name] = list
    getSql().save(name, { [field]: list, updatedAt: new Date().toISOString() })
}

function loadOwners() { return loadList('pdb_owner', 'owners', 'owner.json') }
function saveOwners(owners) { saveList('pdb_owner', 'owners', owners) }
function loadPremium() { return loadList('pdb_premium', 'premium', 'premium.json') }
function savePremium(premium) { saveList('pdb_premium', 'premium', premium) }
function loadPartners() { return loadList('pdb_partner', 'partners', 'partner.json') }
function savePartners(partners) { saveList('pdb_partner', 'partners', partners) }

function matchJid(cleanA, cleanB) {
    return cleanA === cleanB || cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA)
}

function isOwner(jid) {
    if (!jid) return false
    const cleanJid = jid.replace(/@.+/g, '')
    if (!cleanJid) return false

    const owners = loadOwners()
    return owners.some(o => {
        if (typeof o === 'string') return matchJid(cleanJid, o.replace(/[^0-9]/g, ''))
        const ownerNum = (o.number || o.jid || '').replace(/[^0-9]/g, '')
        return matchJid(cleanJid, ownerNum)
    })
}

function isPremium(jid) {
    if (!jid) return false
    const cleanJid = jid.replace(/@.+/g, '')
    if (!cleanJid) return false

    const premiumList = loadPremium()
    const user = premiumList.find(p => {
        if (typeof p === 'string') return matchJid(cleanJid, p.replace(/[^0-9]/g, ''))
        const premiumNum = (p.number || p.jid || '').replace(/[^0-9]/g, '')
        return matchJid(cleanJid, premiumNum)
    })

    if (!user) return false
    if (typeof user === 'string') return true
    if (user.expiredAt && new Date(user.expiredAt) < new Date()) {
        removePremium(cleanJid)
        return false
    }
    return true
}

function isPartner(jid) {
    if (!jid) return false
    const cleanJid = jid.replace(/@.+/g, '')
    if (!cleanJid) return false

    const partnerList = loadPartners()
    const user = partnerList.find(p => {
        if (typeof p === 'string') return matchJid(cleanJid, p.replace(/[^0-9]/g, ''))
        const partnerNum = (p.number || p.jid || '').replace(/[^0-9]/g, '')
        return matchJid(cleanJid, partnerNum)
    })

    if (!user) return false
    if (typeof user === 'string') return true
    if (user.expiredAt && new Date(user.expiredAt) < new Date()) {
        removePartner(cleanJid)
        return false
    }
    return true
}

function addOwner(jid, name = 'Unknown') {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    if (isOwner(cleanJid)) return { success: false, message: 'Sudah menjadi owner' }

    const owners = loadOwners()
    owners.push({
        jid: cleanJid,
        number: cleanJid,
        name,
        addedAt: new Date().toISOString()
    })
    saveOwners(owners)
    return { success: true, message: 'Berhasil ditambahkan sebagai owner' }
}

function removeOwner(jid) {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const owners = loadOwners()
    const index = owners.findIndex(o => o.number === cleanJid || o.jid === cleanJid)
    if (index === -1) return { success: false, message: 'Tidak ditemukan di daftar owner' }

    owners.splice(index, 1)
    saveOwners(owners)
    return { success: true, message: 'Berhasil dihapus dari owner' }
}

function addPremium(jid, days = 30, name = 'Unknown') {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const premiumList = loadPremium()

    const existing = premiumList.findIndex(p => p.number === cleanJid || p.jid === cleanJid)
    const expiredAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString()

    if (existing !== -1) {
        const currentExpiry = new Date(premiumList[existing].expiredAt || 0)
        const baseTime = currentExpiry > new Date() ? currentExpiry : new Date()
        premiumList[existing].expiredAt = new Date(baseTime.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()
        premiumList[existing].name = name || premiumList[existing].name
        savePremium(premiumList)
        return { success: true, message: `Premium diperpanjang ${days} hari`, expiredAt: premiumList[existing].expiredAt }
    }

    premiumList.push({
        jid: cleanJid,
        number: cleanJid,
        name,
        addedAt: new Date().toISOString(),
        expiredAt
    })
    savePremium(premiumList)
    return { success: true, message: `Berhasil ditambahkan sebagai premium ${days} hari`, expiredAt }
}

function removePremium(jid) {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const premiumList = loadPremium()
    const index = premiumList.findIndex(p => p.number === cleanJid || p.jid === cleanJid)
    if (index === -1) return { success: false, message: 'Tidak ditemukan di daftar premium' }

    premiumList.splice(index, 1)
    savePremium(premiumList)
    return { success: true, message: 'Berhasil dihapus dari premium' }
}

function addPartner(jid, days = 30, name = 'Unknown') {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const partnerList = loadPartners()

    const existing = partnerList.findIndex(p => p.number === cleanJid || p.jid === cleanJid)
    const expiredAt = new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString()

    if (existing !== -1) {
        const currentExpiry = new Date(partnerList[existing].expiredAt || 0)
        const baseTime = currentExpiry > new Date() ? currentExpiry : new Date()
        partnerList[existing].expiredAt = new Date(baseTime.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()
        partnerList[existing].name = name || partnerList[existing].name
        savePartners(partnerList)
        return { success: true, message: `Partner diperpanjang ${days} hari`, expiredAt: partnerList[existing].expiredAt }
    }

    partnerList.push({
        jid: cleanJid,
        number: cleanJid,
        name,
        addedAt: new Date().toISOString(),
        expiredAt
    })
    savePartners(partnerList)
    return { success: true, message: `Berhasil ditambahkan sebagai partner ${days} hari`, expiredAt }
}

function removePartner(jid) {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const partnerList = loadPartners()
    const index = partnerList.findIndex(p => p.number === cleanJid || p.jid === cleanJid)
    if (index === -1) return { success: false, message: 'Tidak ditemukan di daftar partner' }

    partnerList.splice(index, 1)
    savePartners(partnerList)
    return { success: true, message: 'Berhasil dihapus dari partner' }
}

function getOwnerList() {
    return loadOwners()
}

function getPremiumList() {
    const premiumList = loadPremium()
    const now = new Date()
    return premiumList.filter(p => {
        if (p.expiredAt && new Date(p.expiredAt) < now) {
            removePremium(p.number || p.jid)
            return false
        }
        return true
    })
}

function getPremiumInfo(jid) {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const premiumList = loadPremium()
    return premiumList.find(p => p.number === cleanJid || p.jid === cleanJid) || null
}

function getPartnerList() {
    const partnerList = loadPartners()
    const now = new Date()
    return partnerList.filter(p => {
        if (p.expiredAt && new Date(p.expiredAt) < now) {
            removePartner(p.number || p.jid)
            return false
        }
        return true
    })
}

function getPartnerInfo(jid) {
    const cleanJid = jid?.replace(/@.+/g, '') || ''
    const partnerList = loadPartners()
    return partnerList.find(p => p.number === cleanJid || p.jid === cleanJid) || null
}

export { loadOwners, saveOwners, loadPremium, savePremium, loadPartners, savePartners, isOwner, isPremium, isPartner, addOwner, removeOwner, addPremium, removePremium, addPartner, removePartner, getOwnerList, getPremiumList, getPremiumInfo, getPartnerList, getPartnerInfo }