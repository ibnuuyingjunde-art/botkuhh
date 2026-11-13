import axios from 'axios'
import { uploadImage } from '../../src/lib/ichigo-uploader.js'
import te from '../../src/lib/ichigo-error.js'

const API_URL = 'https://api-cloud.my.id/tools/unblur'

const pluginConfig = {
    name: 'unblur',
    alias: ['jernih', 'deblur'],
    category: 'tools',
    description: 'Jernihkan gambar buram pakai AI',
    usage: '.unblur [2k|4k|8k] (kirim foto, reply foto, atau link gambar)',
    example: '.unblur 4k',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    const input = String(m.text || '').trim()

    const resMatch = input.match(/\b(2k|4k|8k)\b/i)
    const resolution = resMatch ? resMatch[1].toUpperCase() : '2K'

    const quotedText = (m.quoted && (m.quoted.text || m.quoted.body || m.quoted.caption)) || ''
    const linkMatch = (input + ' ' + quotedText).match(/https?:\/\/\S+/i)

    const isImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))

    if (!linkMatch && !isImage) {
        return m.reply(
            `*ᴜɴʙʟᴜʀ ɪᴍᴀɢᴇ*\n\n` +
            `> Kirim foto dengan caption, reply foto, atau tulis link gambar\n\n` +
            `\`${m.prefix}unblur\`\n` +
            `\`${m.prefix}unblur 4k\`\n` +
            `\`${m.prefix}unblur 8k https://link-gambar.jpg\`\n\n` +
            `> Resolusi: 2k (default), 4k, 8k`
        )
    }

    m.react('🕕')

    try {
        let imageUrl
        if (linkMatch) {
            imageUrl = linkMatch[0]
        } else {
            let buffer
            if (m.quoted && m.quoted.isMedia) {
                buffer = await m.quoted.download()
            } else if (m.isMedia) {
                buffer = await m.download()
            }
            if (!buffer || !buffer.length) {
                m.react('❌')
                return m.reply('Gagal mendownload gambar')
            }
            imageUrl = await uploadImage(buffer, 'image.jpg')
        }

        const { data } = await axios.get(API_URL, {
            params: { url: imageUrl, resolution },
            timeout: 130000
        })
        if (!data || !data.status || !data.result) {
            throw new Error((data && data.error) || 'API tidak mengembalikan hasil')
        }

        const dl = await axios.get(data.result, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://unblurimage.ai/' }
        })

        m.react('✅')
        await sock.sendMedia(m.chat, Buffer.from(dl.data), null, m, { type: 'image' })
    } catch (error) {
        const apiErr = error.response && error.response.data && error.response.data.error
        console.log('[unblur error]', apiErr || error.message)
        m.react('☢')
        if (error.response && error.response.status === 429) {
            return m.reply('Layanan unblur sedang penuh atau kuota harian habis. Coba lagi nanti.')
        }
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }