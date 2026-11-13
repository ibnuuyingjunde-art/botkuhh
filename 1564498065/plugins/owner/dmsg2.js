import util from 'util'
import te from '../../src/lib/ichigo-error.js'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const pluginConfig = {
    name: 'dmsg2',
    alias: ['delmsg2', 'delother2'],
    category: 'owner',
    description: 'Menghapus pesan',
    usage: '.dmsg2 (reply pesan)',
    isOwner: true,
    isGroup: true,
    cooldown: 3,
    isEnabled: true
}

async function handler(m, { sock }) {
    if (!m.quoted) {
        return m.reply('❌ *Reply pesan yang ingin diproses.*')
    }

    const chatId = m.chat

    try {
        const targetId = m.quoted.id

        const tempId = await sock.relayMessage(
            chatId,
            {
                groupStatusMessageV2: {
                    message: {
                        extendedTextMessage: { text: '', contextInfo: { isGroupStatus: true } }
                    }
                }
            },
            {}
        )

        const tempId2 = await sock.relayMessage(
            chatId,
            {
                protocolMessage: {
                    key: { jid: chatId, fromMe: true, id: tempId },
                    type: 14,
                    editedMessage: {
                        extendedTextMessage: { text: '\0', contextInfo: { isGroupStatus: false } }
                    }
                }
            },
            { messageId: targetId }
        )

        await delay(100)

        await Promise.allSettled([
            sock.sendMessage(chatId, { delete: { remoteJid: chatId, id: tempId, fromMe: true } }),
            sock.sendMessage(chatId, { delete: { remoteJid: chatId, id: tempId2, fromMe: true } }),
        ])
    } catch (err) {
        console.error('Error saat mengeksekusi dmsg (Part 1):', err)
        await m.reply(te(m.prefix, m.command, m.pushName))
        return 
    }

    await delay(1000)

    try {
        const commandId = m.key.id 

        const tempId3 = await sock.relayMessage(
            chatId,
            {
                groupStatusMessageV2: {
                    message: {
                        extendedTextMessage: { text: '', contextInfo: { isGroupStatus: true } }
                    }
                }
            },
            {}
        )

        const tempId4 = await sock.relayMessage(
            chatId,
            {
                protocolMessage: {
                    key: { jid: chatId, fromMe: true, id: tempId3 },
                    type: 14,
                    editedMessage: {
                        extendedTextMessage: { text: '\0', contextInfo: { isGroupStatus: false } }
                    }
                },
            },
            { messageId: commandId }
        )

        await delay(100)

        await Promise.allSettled([
            sock.sendMessage(chatId, { delete: { remoteJid: chatId, id: tempId3, fromMe: true } }),
            sock.sendMessage(chatId, { delete: { remoteJid: chatId, id: tempId4, fromMe: true } }),
        ])
    } catch (err) {
        console.error('Error saat menghapus jejak cmd (Part 2):', err)
    }
}

export { pluginConfig as config, handler }