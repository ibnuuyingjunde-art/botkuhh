import te from '../../src/lib/ichigo-error.js'
import axios from 'axios'

const pluginConfig = {
    name: 'qr',
    alias: ['qrcode', 'qrcustom'],
    category: 'tools',
    description: 'Generate QR code dari teks/url',
    usage: '.qr <url/teks>',
    example: '.qr https://wa.me/628xxx',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const data = m.text?.trim()

    if (!data) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}qr <url/text>\`\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}qr https://wa.me/628xxx\``
        )
    }

    await m.react('🕐')

    try {
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(data)}`

        const res = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 15000 })
        const buffer = Buffer.from(res.data)

        await sock.sendMessage(m.chat, {
            image: buffer,
            caption: `📱 *QR Code*\n> ${data.length > 60 ? data.substring(0, 60) + '...' : data}`
        }, { quoted: m })

        await m.react('✅')

    } catch (err) {
        await m.react('☢')
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }