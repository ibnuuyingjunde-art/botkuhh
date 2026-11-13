import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'converter',
    alias: ['convert', 'cvt'],
    category: 'tools',
    description: 'Konversi file dari URL ke format lain (PNG, JPG, PDF, WEBP, dll)',
    usage: '.converter <url> <format>',
    example: '.converter https://kappa.lol/0OoEWR PNG',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const SUPPORTED_FORMATS = ['PNG', 'JPG', 'JPEG', 'WEBP', 'PDF', 'GIF', 'BMP', 'TIFF']

async function handler(m) {
    const args = m.text?.trim().split(/\s+/)

    if (!args || args.length < 2) {
        return m.reply(
            `🔄 *ᴄᴏɴᴠᴇʀᴛᴇʀ*\n\n` +
            `> Konversi file dari URL ke format lain\n\n` +
            `*Format yang didukung:*\n${SUPPORTED_FORMATS.join(', ')}\n\n` +
            `\`Contoh: ${m.prefix}converter https://kappa.lol/0OoEWR PNG\``
        )
    }

    const url = args[0]
    const format = args[1].toUpperCase()

    if (!SUPPORTED_FORMATS.includes(format)) {
        return m.reply(
            `❌ Format *${format}* tidak didukung\n\n` +
            `*Format yang tersedia:*\n${SUPPORTED_FORMATS.join(', ')}`
        )
    }

    try { new URL(url) } catch {
        return m.reply(`❌ URL tidak valid. Pastikan URL dimulai dengan \`http://\` atau \`https://\``)
    }

    m.react('🕕')

    try {
        const data = await f(
            `https://api.nexray.eu.cc/tools/converter?url=${encodeURIComponent(url)}&format=${format}`
        )

        if (!data?.status || !data?.result) throw new Error('API error')

        m.react('✅')
        await m.reply(
            `✅ *Konversi Berhasil!*\n\n` +
            `🔗 *Format:* ${format}\n` +
            `📎 *Link hasil:*\n${data.result}\n\n` +
            `⏱️ _Response time: ${data.response_time}_`
        )
    } catch (error) {
        console.error('[converter]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }