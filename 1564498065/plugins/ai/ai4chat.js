import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'ai4chat',
    alias: ['ai'],
    category: 'ai',
    description: 'Chat dengan AI',
    usage: '.ai4chat <pertanyaan>',
    example: '.ai4chat Apa itu JavaScript?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m) {
    const text = m.text
    if (!text) {
        return m.reply(`🤖 *ᴀɪᴄʜᴀᴛ*\n\n> Masukkan pertanyaan\n\n\`Contoh: ${m.prefix}ai4chat Apa itu JavaScript?\``)
    }

    m.react('🕕')

    try {
        const data = await f(`https://api.lexcode.biz.id/api/ai/copilot?prompt=${encodeURIComponent(text)}&model=default`)

        if (!data?.success || !data?.result?.text) throw new Error('Empty or failed response')

        m.react('✅')
        await m.reply(data.result.text)
    } catch (error) {
        console.error('[ai4chat]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }