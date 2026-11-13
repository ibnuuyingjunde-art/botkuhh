import te from '../../src/lib/ichigo-error.js'
import { decodeJid } from '../../src/lib/ichigo-serialize.js'

const pluginConfig = {
    name: 'couple',
    alias: ['pasangan', 'jodoh'],
    category: 'fun',
    description: 'Pasangkan 2 member random di group',
    usage: '.couple',
    example: '.couple',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 30,
    energi: 1,
    isEnabled: true
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function getCompatibility() {
    return Math.floor(Math.random() * 31) + 70
}

const sweetWords = [
    'Semoga langgeng ya~ 💕',
    'Wah cocok banget nih! 🥰',
    'Jodoh memang tidak kemana 😍',
    'Selamat ya pasangan baru! 🎉',
    'Awas baper! 💘',
    'Udah ditakdirkan dari sono nya~ ✨',
    'Semoga segera ke pelaminan! 💍',
    'Keliatan banget chemistry-nya! 🔥'
]

function buildCaption(p1, p2, compat, quote) {
    return (
        `💑 *ᴄᴏᴜᴘʟᴇ ʜᴀʀɪ ɪɴɪ*\n` +
        `◈━━━━━━━━━━━━━◈\n\n` +
        `👫 @${p1.number}\n` +
        `💞 *&*\n` +
        `👫 @${p2.number}\n\n` +
        `💯 Kecocokan: *${compat}%*\n\n` +
        `💬 _${quote}_\n\n` +
        `◈━━━━━━━━━━━━━◈`
    )
}

async function handler(m, { sock }) {
    const chatId = m.chat

    try {
        const groupMeta = await sock.groupMetadata(chatId)
        const participants = groupMeta.participants || []

        const botJid = decodeJid(sock.user?.id || '')
        const botNumber = botJid ? botJid.replace(/@.+/g, '') : ''

        const members = participants
            .map(p => {
                const jid = decodeJid(p.id || p.jid || p.lid || '')
                if (!jid) return null
                return { jid, number: jid.replace(/@.+/g, '') }
            })
            .filter(p => p && p.number && p.number !== botNumber)

        if (members.length < 2) {
            return m.reply('❌ Member group kurang dari 2 orang!')
        }

        const p1 = getRandom(members)
        let p2 = getRandom(members)
        while (p2.jid === p1.jid) p2 = getRandom(members)

        const compat = getCompatibility()
        const quote = getRandom(sweetWords)

        m.react('💕')
        await sock.sendMessage(chatId, {
            text: buildCaption(p1, p2, compat, quote),
            mentions: [p1.jid, p2.jid]
        }, { quoted: m })

    } catch (error) {
        console.error('[couple]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }