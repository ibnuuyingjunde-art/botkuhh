import { getDatabase } from '../../src/lib/ichigo-database.js'
import config from '../../config.js'
import { isPremiumGroup } from '../../src/lib/ichigo-premium-group.js'
const pluginConfig = {
    name: 'energi',
    alias: ['cekenergi', 'myenergi', 'energy', 'limit', 'ceklimit'],
    category: 'user',
    description: 'Cek energi user',
    usage: '.energi [@user]',
    example: '.energi',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function formatNumber(num) {
    if (num === -1) return '∞ Unlimited'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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
    const isOwner = config.owner?.number?.includes(targetJid.replace(/[^0-9]/g, '')) || config.isOwner?.(targetJid)

    const dbToggle = db.setting('energi')
    const energiEnabled = dbToggle !== undefined ? dbToggle : (config.energi?.enabled !== false)

    const isSelf = targetJid === m.sender
    // Premium = premium pribadi, atau member grup yang di-addpremgc (sama seperti handler)
    const isPrem = !!user.isPremium || (isSelf && !!m.isPremium) || (m.isGroup && isPremiumGroup(m.chat))
    const premiumEnergi = config.energi?.premium ?? -1

    let finalEnergi
    if (!energiEnabled || isOwner) {
        finalEnergi = -1
    } else if (isPrem) {
        finalEnergi = (premiumEnergi === -1 || user.energi === -1) ? -1 : (user.energi ?? premiumEnergi)
    } else {
        finalEnergi = user.energi ?? config.energi?.default ?? 25
    }

    const isUnlimited = finalEnergi === -1
    const energiDisplay = formatNumber(finalEnergi)
    
    let userStatus = 'Free'
    if (isOwner) userStatus = 'Owner'
    else if (isPrem) userStatus = 'Premium'
    if (!energiEnabled) userStatus += ' (Energi OFF)'
    
    let text = `*〔 ⚡ ENERGI INFO 〕*\n\n`

text += `*〔 👤 User 〕* ${targetName}\n`
text += `*〔 ⚡ Energi 〕* ${energiDisplay}\n`
text += `*〔 💎 Status 〕* ${userStatus}\n\n`
    
    if (!energiEnabled) {
        text += `🔌 Sistem energi dinonaktifkan — semua command gratis`
    } else if (isSelf && !isUnlimited && finalEnergi < 10) {
        text += `⚠️ Energi hampir habis!\n`
        text += `Gunakan \`.buyenergi\` untuk beli`
    } else if (isUnlimited) {
        text += `✨ Energi unlimited aktif!`
    }
    
    await m.reply(text)
}

export { pluginConfig as config, handler }