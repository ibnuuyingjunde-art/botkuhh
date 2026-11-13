import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import {
    addPartner as addPartnerDb,
    removePartner as removePartnerDb,
    getPartnerList,
    isPartner as isPartnerDb
} from '../../src/lib/ichigo-premium-db.js'

const pluginConfig = {
    name: 'addpartner',
    alias: ['delpartner', 'listpartner', 'cekpartner'],
    category: 'owner',
    description: 'Kelola daftar partner bot',
    usage: '.addpartner <nomor/@tag> [hari]\n.delpartner <nomor/@tag>\n.listpartner\n.cekpartner <nomor/@tag>',
    example: '.addpartner 6281234567890 30',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function extractNumber(m) {
    if (m.mentionedJid?.length) return m.mentionedJid[0]
    if (m.quoted?.sender) return m.quoted.sender

    const text = m.args?.join(' ')?.trim() || ''
    const match = text.match(/(\d{10,15})/)
    if (match) return `${match[1]}@s.whatsapp.net`

    return null
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function toMentionJid(number) {
    const num = String(number || '').replace(/[^0-9]/g, '')
    return num ? `${num}@s.whatsapp.net` : null
}

async function handler(m, { sock }) {
    const db = getDatabase()
    if (!db) return m.reply("❌ Database belum siap, coba lagi.")
    const cmd = m.command?.toLowerCase()
    if (!db.data.partner) db.data.partner = []

    if (cmd === 'addpartner') {
        const target = await extractNumber(m)
        if (!target) {
            return m.reply(
                `🤝 *ᴀᴅᴅ ᴘᴀʀᴛɴᴇʀ*\n\n` +
                `> Cara pakai:\n` +
                `> \`${m.prefix}addpartner @tag [hari]\`\n` +
                `> \`${m.prefix}addpartner 6281xxx 30\`\n\n` +
                `> Default: 30 hari`
            )
        }

        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) targetNumber = '62' + targetNumber.slice(1)
        if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

        if (config.isOwner?.(targetNumber)) {
            return m.reply(`⚠️ @${targetNumber} sudah menjadi owner!`, { mentions: [target] })
        }

        const days = parseInt(m.args?.find(a => /^\d+$/.test(a) && a.length <= 4)) || 30
        const pushName = m.quoted?.pushName || m.pushName || 'Unknown'
        const now = Date.now()

        const result = addPartnerDb(targetNumber, days, pushName)

        const existingIndex = db.data.partner.findIndex(p =>
            typeof p === 'string' ? p === targetNumber : p.id === targetNumber
        )
        let newExpired
        if (existingIndex !== -1) {
            const currentExpired = db.data.partner[existingIndex].expired || now
            const baseTime = currentExpired > now ? currentExpired : now
            newExpired = baseTime + (days * 24 * 60 * 60 * 1000)
            db.data.partner[existingIndex].expired = newExpired
            db.data.partner[existingIndex].name = pushName
        } else {
            newExpired = now + (days * 24 * 60 * 60 * 1000)
            db.data.partner.push({
                id: targetNumber,
                expired: newExpired,
                name: pushName,
                addedAt: now
            })
        }
        db.save()

        const expDate = formatDate(newExpired)
        await m.react('🤝')
        return m.reply(
            `✅ Berhasil ${existingIndex !== -1 ? 'memperpanjang' : 'menambahkan'} partner @${targetNumber} selama *${days} hari*\nExpired: *${expDate}*`,
            { mentions: [toMentionJid(targetNumber)].filter(Boolean) }
        )
    }

    if (cmd === 'delpartner') {
        const target = await extractNumber(m)
        if (!target) {
            return m.reply(`⚠️ Tag atau reply user yang ingin dihapus dari partner.`)
        }

        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) targetNumber = '62' + targetNumber.slice(1)
        if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

        removePartnerDb(targetNumber)

        const initialLength = db.data.partner.length
        db.data.partner = db.data.partner.filter(p =>
            typeof p === 'string' ? p !== targetNumber : p.id !== targetNumber
        )

        if (db.data.partner.length < initialLength) {
            db.save()
            await m.react('✅')
            return m.reply(`✅ Berhasil menghapus @${targetNumber} dari partner`, { mentions: [toMentionJid(targetNumber)].filter(Boolean) })
        } else {
            return m.reply(`⚠️ User tersebut bukan partner.`)
        }
    }

    if (cmd === 'listpartner') {
        const partners = getPartnerList()
        if (!partners.length) {
            return m.reply(`🤝 *ᴅᴀꜰᴛᴀʀ ᴘᴀʀᴛɴᴇʀ*\n\n> Belum ada partner.`)
        }

        let txt = `🤝 *DAFTAR PARTNER*\n\n`
        const mentions = []
        partners.forEach((p, i) => {
            const num = p.number || p.jid || p.id
            const expTs = p.expiredAt ? new Date(p.expiredAt).getTime() : (p.expired || 0)
            const expDate = formatDate(expTs)
            const remaining = Math.ceil((expTs - Date.now()) / (1000 * 60 * 60 * 24))
            txt += `${i + 1}. @${num} — ${expDate} (${remaining > 0 ? remaining + 'd' : 'Expired'})\n`
            const jid = toMentionJid(num)
            if (jid) mentions.push(jid)
        })
        txt += `\nTotal: *${partners.length}* partner`
        return m.reply(txt, { mentions })
    }

    if (cmd === 'cekpartner') {
        const target = await extractNumber(m)
        if (!target) {
            return m.reply(`⚠️ Tag atau reply user yang ingin dicek status partnernya.`)
        }

        let targetNumber = target.replace(/@.+/g, '')
        if (targetNumber.startsWith('08')) targetNumber = '62' + targetNumber.slice(1)
        if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

        const isP = isPartnerDb(targetNumber)
        if (!isP) {
            return m.reply(`❌ @${targetNumber} bukan partner`, { mentions: [toMentionJid(targetNumber)].filter(Boolean) })
        }

        const partners = getPartnerList()
        const data = partners.find(p => {
            const num = (p.number || p.jid || p.id || '').replace(/[^0-9]/g, '')
            return num === targetNumber || targetNumber.endsWith(num) || num.endsWith(targetNumber)
        })

        const expTs = data?.expiredAt ? new Date(data.expiredAt).getTime() : (data?.expired || 0)
        const remaining = Math.ceil((expTs - Date.now()) / (1000 * 60 * 60 * 24))
        const expDate = formatDate(expTs)

        return m.reply(
            `🤝 *CEK PARTNER*\n\n` +
            `> Nomor: @${targetNumber}\n` +
            `> Status: ✅ Partner\n` +
            `> Expired: ${expDate}\n` +
            `> Sisa: ${remaining > 0 ? remaining + ' hari' : '⚠️ Expired'}`,
            { mentions: [toMentionJid(targetNumber)].filter(Boolean) }
        )
    }
}

export { pluginConfig as config, handler }