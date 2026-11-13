import { uploadImage } from '../../src/lib/ichigo-uploader.js'
import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'tojapanese',
    alias: ['japanese', 'japanesestyle'],
    category: 'ai',
    description: 'Ubah gambar ke style Japanese',
    usage: '.tojapanese (reply gambar)',
    example: '.tojapanese',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 2,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')

    if (!isImage) {
        return m.reply(`🎌 *ᴊᴀᴘᴀɴᴇsᴇ sᴛʏʟᴇ*\n\n> Kirim/reply gambar untuk diubah ke style Japanese\n\n\`${m.prefix}tojapanese\``)
    }

    m.react('🕕')

    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer || buffer.length === 0) {
            m.react('❌')
            return m.reply(`❌ Gagal mendownload gambar`)
        }

        const imageUrl = await uploadImage(buffer, 'image.jpg')
        if (!imageUrl) {
            m.react('❌')
            return m.reply(`❌ Gagal upload gambar ke server`)
        }

        const stylePrompt = 'Transform this photo into traditional Japanese style: ' +
            'change the outfit into an authentic Japanese kimono with a detailed obi sash and traditional patterns, ' +
            'change the background into a traditional Japanese setting such as a shrine torii gate, zen garden, ' +
            'or tatami room with shoji sliding doors, ' +
            'keep the same person, same face, same identity, same pose and same hairstyle, ' +
            'photorealistic, high detail, natural lighting'

        const apiUrl = `https://api.lexcode.biz.id/api/ai/nano-banana?url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(stylePrompt)}`

        let json = await f(apiUrl, 'json')
        if (!json) {
            json = await f(apiUrl, 'json') 
        }

        if (!json || !json.success || !json.result || !json.result.image) {
            m.react('❌')
            return m.reply(`❌ Gagal memproses gambar. API sedang gangguan atau menolak request.`)
        }

        const resultImageUrl = json.result.image

        let imgBuffer = await f(resultImageUrl, 'arrayBuffer')
        if (!imgBuffer) {
            imgBuffer = await f(resultImageUrl, 'arrayBuffer') 
        }

        if (!imgBuffer || imgBuffer.byteLength < 1000) {
            m.react('❌')
            return m.reply(`❌ Gagal mengunduh hasil gambar dari server`)
        }

        m.react('✅')

        await sock.sendMedia(m.chat, Buffer.from(imgBuffer), null, m, {
            type: 'image',
        })

    } catch (error) {
        console.log('[tojapanese error]', error)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }