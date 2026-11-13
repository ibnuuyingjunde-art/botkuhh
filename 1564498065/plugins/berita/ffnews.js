import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'ffnews',
    alias: ['beritaff', 'freefirenews'],
    category: 'berita',
    description: 'Berita terbaru Free Fire dari Garena',
    usage: '.ffnews',
    example: '.ffnews',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m) {
    m.react('🕕')

    try {
        const data = await f('https://api.nexray.eu.cc/berita/ffnews')

        if (!data?.status || !data?.result) throw new Error('API error')

        const { total, data: berita } = data.result

        const list = berita.map((item, i) =>
            `${i + 1}. *${item.title}*\n    📅 ${item.date}\n    🔗 ${item.link}`
        ).join('\n\n')

        const teks =
            `🎮 *ꜰʀᴇᴇ ꜰɪʀᴇ ɴᴇᴡꜱ*\n` +
            `◈━━━━━━━━━━━━━◈\n\n` +
            `${list}\n\n` +
            `◈━━━━━━━━━━━━━◈\n` +
            `📰 Total: *${total} berita* | ⏱️ ${data.response_time}`

        m.react('✅')
        await m.reply(teks)
    } catch (error) {
        console.error('[ffnews]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }