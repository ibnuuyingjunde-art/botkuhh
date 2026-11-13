import config from '../../config.js'

const pluginConfig = {
    name: 'delete',
    alias: ['del', 'hapus', 'd'],
    category: 'group',
    description: 'Hapus pesan dengan reply',
    usage: '.delete (reply pesan)',
    example: '.delete',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: false,
    isBotAdmin: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    if (!m.quoted) {
        return m.reply('╭─「 ✦ *Delete* 」\n│ Reply pesan yang mau kamu hapus dulu ya.\n╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈')
    }
    
    const quotedSender = m.quoted.sender || m.quoted.key?.participant
    const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'
    const isOwnMessage = m.quoted.key?.fromMe || quotedSender === m.sender
    const isBotMessage = quotedSender === botJid || m.quoted.key?.fromMe
    
    if (!isOwnMessage && !isBotMessage) {
        if (!m.isBotAdmin) {
            return m.reply(config.groupProtection.notAdmin)
        }
        if (!m.isAdmin && !m.isOwner) {
            return m.reply(config.messages.adminOnly)
        }
    }
    
    try {
        const key = {
            remoteJid: m.chat,
            id: m.quoted.key.id,
            fromMe: m.quoted.key.fromMe,
            participant: quotedSender
        }
        
        await sock.sendMessage(m.chat, { delete: key })
        await m.react('✅')
        
    } catch (err) {
        if (err.message?.includes('not found') || err.message?.includes('forbidden')) {
            await m.reply('╭─「 ✦ *Delete* 」\n│ Gagal menghapus pesan.\n│ Mungkin pesannya udah dihapus atau kelamaan.\n╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈')
        } else {
            await m.react('❌')
        }
    }
}

export { pluginConfig as config, handler }