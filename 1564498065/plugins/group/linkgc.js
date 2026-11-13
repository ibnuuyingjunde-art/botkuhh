import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'linkgc',
    alias: ['linkgrup', 'getlink', 'gclink'],
    category: 'group',
    description: 'Dapatkan link invite grup',
    usage: '.linkgc',
    example: '.linkgc',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: true
}

async function handler(m, { sock }) {
    m.react('🕕')

    try {
        const code      = await sock.groupInviteCode(m.chat)
        const urlGrup   = `https://chat.whatsapp.com/${code}`
        const groupName = m.groupMetadata?.subject || 'Grup'

        const txt = `🔗 *LINK GRUP*\n\n│ Nama : *${groupName}*\n│ Link : ${urlGrup}\n\n_Bagikan link ini untuk mengundang anggota baru._`

        try {
            const msg = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            body: { text: txt },
                            footer: { text: config.bot?.name || 'Mizee-Bot' },
                            header: { hasMediaAttachment: false },
                            nativeFlowMessage: {
                                buttons: [
                                    {
                                        name: 'cta_copy',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '📋 Salin Link',
                                            copy_code: urlGrup,
                                        }),
                                    },
                                    {
                                        name: 'cta_url',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '🔗 Buka Link',
                                            url: urlGrup,
                                            merchant_url: urlGrup,
                                        }),
                                    },
                                ],
                                messageVersion: 1,
                            },
                        },
                    },
                },
            }
            await sock.relayMessage(m.chat, msg, {})
        } catch {
            
            await m.reply(txt)
        }

        m.react('✅')

    } catch (err) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }