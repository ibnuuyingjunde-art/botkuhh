import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'mlbbnews',
    alias: ['beritaml', 'mobilelegendsnews'],
    category: 'berita',
    description: 'Berita terbaru Mobile Legends: Bang Bang',
    usage: '.mlbbnews',
    example: '.mlbbnews',
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
        const data = await f('https://api.nexray.eu.cc/berita/mlbb')

        if (!data?.status || !data?.result) throw new Error('API error')

        const { total, data: berita } = data.result

        const preview = berita.slice(0, 8)

        const list = preview.map((item, i) => {
            const date = new Date(item.date).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
            })
            return `${i + 1}. *${item.title}*\n    📅 ${date}\n    🔗 ${item.link}`
        }).join('\n\n')

        const teks =
            `🗡️ *ᴍʟʙʙ ɴᴇᴡꜱ*\n` +
            `◈━━━━━━━━━━━━━◈\n\n` +
            `${list}\n\n` +
            `◈━━━━━━━━━━━━━◈\n` +
            `📰 Total: *${total} berita* | ⏱️ ${data.response_time}`

        m.react('✅')
        await m.reply(teks)
    } catch (error) {
        console.error('[mlbbnews]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }