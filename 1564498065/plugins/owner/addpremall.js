import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import te from '../../src/lib/ichigo-error.js'
const pluginConfig = {
    name: 'addpremall',
    alias: ['addpremiumall', 'setpremall'],
    category: 'owner',
    description: 'Menambahkan semua member grup ke premium',
    usage: '.addprem all',
    example: '.addprem all',
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []

        if (participants.length === 0) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak ada member di grup ini`)
        }

        await m.react('🕕')

        const db = getDatabase()
        if (!db.data.premium) db.data.premium = []

        let addedCount = 0
        let alreadyPremCount = 0
        const now = Date.now()
        const days = 30
        const newExpired = now + days * 24 * 60 * 60 * 1000

        for (const participant of participants) {
            const number = participant.jid?.replace(/[^0-9]/g, '') || ''
            if (!number) continue

            const existingIndex = db.data.premium.findIndex(p =>
                typeof p === 'string' ? p === number : p.id === number
            )

            if (existingIndex !== -1) {
                alreadyPremCount++
                continue
            }

            db.data.premium.push({
                id: number,
                expired: newExpired,
                name: 'AddPremAll',
                addedAt: now
            })

            const jid = number + '@s.whatsapp.net'
            const premLimit = config.energi?.premium || config.limits?.premium || 100
            const user = db.getUser(jid) || db.setUser(jid)

            user.energi = premLimit
            user.isPremium = true
            user.premiumExpired = newExpired

            db.setUser(jid, user)
            db.updateExp(jid, 200000)
            db.updateKoin(jid, 20000)
            addedCount++
        }

        db.save()

        await m.react('💎')
        await m.reply(
            `💎 *ᴀᴅᴅ ᴘʀᴇᴍɪᴜᴍ ᴀʟʟ*\n\n` +
            `╭┈┈⬡「 📋 *ʜᴀsɪʟ* 」\n` +
            `┃ 👥 ᴛᴏᴛᴀʟ ᴍᴇᴍʙᴇʀ: \`${participants.length}\`\n` +
            `┃ ✅ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ: \`${addedCount}\`\n` +
            `┃ ⏭️ sᴜᴅᴀʜ ᴘʀᴇᴍɪᴜᴍ: \`${alreadyPremCount}\`\n` +
            `┃ 💎 ᴛᴏᴛᴀʟ ᴘʀᴇᴍɪᴜᴍ: \`${db.data.premium.length}\`\n` +
            `╰┈┈⬡\n\n` +
            `> Grup: ${groupMeta.subject}`
        )

    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
