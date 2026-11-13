import te from '../../src/lib/ichigo-error.js'
import FormData from 'form-data'
import fetch from 'node-fetch'

const COV_API_KEY = 'cov_live_4f4f3c990cba17587578cd13b7a5c53ae912ae93b91a272f'

const pluginConfig = {
    name: 'aiedit3',
    alias: ['imageedit', 'aiedit3'],
    category: 'ai',
    description: 'Edit foto dengan AI menggunakan prompt teks',
    usage: '.aiedit <prompt> (reply/kirim gambar)',
    example: '.aiedit ubah jadi anime',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 3,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))
    const prompt = m.args.join(' ').trim()

    if (!isImage || !prompt) {
        return m.reply(
            `🎨 *ᴀɪ ᴇᴅɪᴛ*\n\n` +
            `> Reply/kirim gambar dengan prompt untuk mengedit foto menggunakan AI\n\n` +
            `*Contoh:*\n` +
            `\`${m.prefix}aiedit ubah jadi anime\`\n` +
            `\`${m.prefix}aiedit ganti background jadi pantai\`\n` +
            `\`${m.prefix}aiedit tambahkan efek musim dingin\``
        )
    }

    m.react('🕕')

    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer) {
            m.react('❌')
            return m.reply(`❌ Gagal mendownload gambar`)
        }

        const formData = new FormData()
        formData.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' })
        formData.append('prompt', prompt)

        const res = await fetch('https://api.covenant.sbs/api/ai/nanana', {
            method: 'POST',
            headers: {
                'x-api-key': COV_API_KEY,
                ...formData.getHeaders()
            },
            body: formData
        })

        const data = await res.json()

        if (!data?.status || !data?.data?.result) throw new Error('Tidak ada hasil dari API')

        m.react('✅')

        await sock.sendMedia(m.chat, data.data.result, null, m, {
            type: 'image',
            caption: `✨ *ᴀɪ ᴇᴅɪᴛ*\n> ${prompt}`
        })

    } catch (error) {
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }