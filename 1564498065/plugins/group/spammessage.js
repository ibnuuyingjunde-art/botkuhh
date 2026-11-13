import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'spammessage',
    alias: ['spambot', 'spamtext'],
    category: 'group',
    description: 'Meneruskan pesan yang di-reply sebanyak jumlah tertentu dengan delay 1 detik dan menyertakan mention',
    usage: '.spammessage <jumlah> (reply pesan)',
    example: '.spammessage 5',
    isOwner: false,
    isPremium: true,
    isGroup: true,
    isPrivate: false,
    cooldown: 100,
    energi: 50,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: false
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function handler(m, { sock }) {
    
    if (!m.quoted) {
        return m.reply(
            `📨 *SPAM MESSAGE*\n\n` +
            `> Wajib reply pesan yang ingin di-spam\n` +
            `> Contoh: Reply pesan lalu ketik \`${m.prefix}spammessage 5\``
        )
    }

    const match = m.text.match(/\d+/)
    const count = match ? parseInt(match[0]) : 0

    if (count < 1) {
        return m.reply(
            `❌ *Jumlah tidak valid*\n\n` +
            `> Cara pakai: \`${m.prefix}spammessage <jumlah>\`\n` +
            `> Contoh: \`${m.prefix}spammessage 10\``
        )
    }

    if (count > 1000) {
        return m.reply(`⚠️ *Maksimal spam adalah 1000 pesan* untuk menghindari spam berlebihan`)
    }

    m.react('📨')

    try {
        const quotedMessage = m.quoted.fakeObj || m.quoted

        const quotedMsgObj = m.quoted.message || m.quoted
        let mentionedJids = []

        if (quotedMsgObj) {
            
            if (quotedMsgObj.extendedTextMessage?.contextInfo?.mentionedJid) {
                mentionedJids = quotedMsgObj.extendedTextMessage.contextInfo.mentionedJid
            } else if (quotedMsgObj.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                mentionedJids = quotedMsgObj.message.extendedTextMessage.contextInfo.mentionedJid
            } else if (m.quoted.mentionedJid) {
                mentionedJids = m.quoted.mentionedJid
            }
        }

        for (let i = 1; i <= count; i++) {
            
            await sock.presenceSubscribe(m.chat)
            await sock.sendPresenceUpdate('composing', m.chat)
            await delay(500)

            await sock.sendMessage(m.chat, {
                forward: quotedMessage,
                force: true,
                mentions: mentionedJids
            })

            await sock.sendPresenceUpdate('paused', m.chat)

            if (i < count) await delay(1000)
        }

        m.react('✅')
        m.reply(`✅ *Selesai mengirim spam sebanyak ${count} kali*`)

    } catch (err) {
        console.error(err)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }