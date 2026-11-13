import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'ptv',
    alias: ['pvideo', 'circlevideo'],
    category: 'tools',
    description: 'Kirim video sebagai PTV (circle video)',
    usage: '.ptv (reply video)',
    example: '.ptv',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    let video = null

    if (m.quoted && m.quoted.isVideo) {
        try {
            video = await m.quoted.download()
        } catch (e) {
            console.error('[ptv] gagal download quoted video:', e)
            return m.reply(`❌ Gagal download video dari quoted.`)
        }
    } else if (m.isVideo) {
        try {
            video = await m.download()
        } catch (e) {
            console.error('[ptv] gagal download video:', e)
            return m.reply(`❌ Gagal download video.`)
        }
    }

    if (!video) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> Kirim *video* atau *balas video* lalu ketik:\n` +
            `> \`${m.prefix}ptv\``
        )
    }

    await m.reply(`🕕 *ᴍᴇᴍʙᴜᴀᴛ ᴘᴛᴠ...*`)

    try {
        await sock.sendMessage(m.chat, {
            video: video,
            mimetype: 'video/mp4',
            gifPlayback: true,
            ptv: true
        })

        m.react('✅')

    } catch (err) {
        console.error('[ptv] gagal kirim ptv:', err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }