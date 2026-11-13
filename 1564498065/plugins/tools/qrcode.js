import fs from 'fs'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'qrcode',
    alias: ['qr', 'qrscan', 'scanqr'],
    category: 'tools',
    description: 'Membuat QR code dari teks/link, atau scan QR code dari gambar',
    usage: '.qrcode <teks/link> | .qrcode (reply gambar untuk scan)',
    example: '.qrcode https://google.com\n.qrcode Hello World\n.qrcode (reply gambar QR untuk di-scan)',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function generateQR(text) {
    const QRCode = (await import('qrcode')).default
    const buffer = await QRCode.toBuffer(text, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 512,
        margin: 2,
        color: {
            dark: '#000000ff',
            light: '#ffffffff'
        }
    })
    return buffer
}

async function scanQR(buffer) {
    const Jimp = (await import('jimp')).default
    const jsQR = (await import('jsqr')).default

    const image = await Jimp.read(buffer)
    const { data, width, height } = image.bitmap

    const result = jsQR(new Uint8ClampedArray(data), width, height)
    if (!result) {
        return null
    }
    return result.data
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const text = (m.args || []).join(' ').trim()

    if (!isImage && !text) {
        await m.reply(
            `🔳 *ǫʀ ᴄᴏᴅᴇ ᴛᴏᴏʟ*\n\n` +
            `*Generate QR:*\n` +
            `\`${m.prefix}qrcode <teks/link>\`\n\n` +
            `*Scan QR:*\n` +
            `Reply gambar QR dengan caption \`${m.prefix}qrcode\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}qrcode https://google.com\`\n` +
            `> \`${m.prefix}qrcode Hello World\`\n` +
            `> \`${m.prefix}qrcode\` (reply gambar QR)`
        )
        return
    }

    await m.react('🕕')

    try {
        if (isImage) {
            
            let buffer
            if (m.quoted && m.quoted.isMedia) {
                buffer = await m.quoted.download()
            } else if (m.isMedia) {
                buffer = await m.download()
            }

            if (!buffer) {
                await m.reply('❌ Gagal mendownload gambar!')
                await m.react('❌')
                return
            }

            const result = await scanQR(buffer)

            if (!result) {
                await m.reply('❌ Tidak ditemukan QR code pada gambar tersebut!')
                await m.react('❌')
                return
            }

            await m.reply(`🔳 *ǫʀ ᴄᴏᴅᴇ ᴅᴇᴛᴇᴄᴛᴇᴅ*\n\n${result}`)
            await m.react('✅')

        } else {
            
            const qrBuffer = await generateQR(text)
            await sock.sendMessage(m.chat, { image: qrBuffer, caption: `🔳 QR Code untuk:\n${text}` }, { quoted: m })
            await m.react('✅')
        }

    } catch (error) {
        console.error('[qrcode] error:', error.message || error)
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}

export { pluginConfig as config, handler }