import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: ['clearchat', 'cc', 'cleangc', 'deletechat', 'delchat'],
    alias: [],
    category: 'group',
    description: 'Membersihkan chat grup (di sisi bot)',
    usage: '.clearchat',
    example: '.clearchat',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: true,
    cooldown: 60,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    await m.react('🗑️')

    try {
        const timestamp = typeof m.messageTimestamp === 'number'
            ? m.messageTimestamp
            : Math.floor(Date.now() / 1000)

        await sock.chatModify(
            {
                delete: true,
                lastMessages: [
                    {
                        key: m.key,
                        messageTimestamp: timestamp
                    }
                ]
            },
            m.chat
        )

        await m.reply(
            `✅ *ᴄʜᴀᴛ ᴅɪʙᴇʀsɪʜᴋᴀɴ*\n\n> Chat di wa bot telah dibersihkan oleh @${m.sender.split('@')[0]}`,
            { mentions: [m.sender] }
        )
    } catch (error) {
        console.error('[clearchat] gagal:', error)
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }