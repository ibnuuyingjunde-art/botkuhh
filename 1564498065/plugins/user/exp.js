import { getDatabase } from '../../src/lib/ichigo-database.js'
import { calculateLevel, getRole } from '../../src/lib/ichigo-level.js'

const pluginConfig = {
    name: 'exp',
    alias: ['cekexp', 'myexp', 'xp'],
    category: 'user',
    description: 'Cek exp user',
    usage: '.exp [@user]',
    example: '.exp',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const BUFF_LABELS = {
    atk: { name: 'ATK', icon: '💪', format: (v) => `+${v}` },
    def: { name: 'DEF', icon: '🛡️', format: (v) => `+${v}` },
    luck: { name: 'Drop Rate', icon: '🍀', format: (v) => `+${Math.round(v * 100)}%` },
    exp: { name: 'EXP', icon: '✨', format: (v) => `+${Math.round(v * 100)}%` }
}

function getActiveBuffLines(user) {
    const buffs = user.rpg?.buffs || {}
    const lines = []
    let changed = false

    for (const [key, buff] of Object.entries(buffs)) {
        if (Date.now() > buff.expiresAt) {
            delete buffs[key]
            changed = true
            continue
        }
        const info = BUFF_LABELS[key]
        if (!info) continue
        const minutesLeft = Math.max(1, Math.ceil((buff.expiresAt - Date.now()) / 60000))
        lines.push(`${info.icon} ${info.name}: ${info.format(buff.amount)} (${minutesLeft}m tersisa)`)
    }

    return { lines, changed }
}

async function handler(m, { sock }) {
    const db = getDatabase()
    
    let targetJid = m.sender
    let targetName = m.pushName || 'Kamu'
    
    if (m.quoted) {
        targetJid = m.quoted.sender
        targetName = m.quoted.pushName || targetJid.split('@')[0]
    } else if (m.mentionedJid?.length) {
        targetJid = m.mentionedJid[0]
        targetName = targetJid.split('@')[0]
    }
    
    const user = db.getUser(targetJid) || db.setUser(targetJid)
    const expDisplay = formatNumber(user.exp || 0)
    const level = calculateLevel(user.exp || 0)
    const title = getRole(level)

    const { lines: buffLines, changed } = getActiveBuffLines(user)
    if (changed) db.save()
    
    let text = `*〔 ⭐ EXP INFO 〕*\n\n`

text += `*〔 👤 User 〕* ${targetName}\n`
text += `*〔 ⭐ Exp 〕* ${expDisplay}\n`
text += `*〔 🏆 Level 〕* ${level}\n`
text += `*〔 🎖️ Title 〕* ${title}\n`

if (buffLines.length) {
    text += `\n*〔 🧪 Buff Aktif 〕*\n`
    text += buffLines.map((l) => `> ${l}`).join('\n') + '\n'
}
    
    await m.reply(text)
}

export { pluginConfig as config, handler }