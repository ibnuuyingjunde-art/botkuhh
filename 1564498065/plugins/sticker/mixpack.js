import axios from 'axios'
import config from '../../config.js'

const pluginConfig = {
    name: 'mixpack',
    alias: ['emojimixpack'],
    category: 'sticker',
    description: 'Buat stiker pack native dari kombinasi emoji',
    usage: '.mixpack 😂🔥,🥹💀,😎🤖',
    example: '.mixpack 😂🔥,🥹💀,😎🤖',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true
};

async function handler(m, { sock }) {
    const input = m.fullArgs?.trim() || m.text?.trim() || ''
    const prefix = m.prefix || '.'

    if (!input || !input.includes(',')) {
        return m.reply(
            `⚠️ *ғᴏʀᴍᴀᴛ sᴀʟᴀʜ*\n\n` +
            `> Pisahkan tiap pasangan emoji dengan koma (minimal 2 item).\n\n` +
            `*Contoh:*\n` +
            `> \`${prefix}mixpack 😂🔥,🥹💀,😎🤖\``
        )
    }

    let items = input.split(',').map(s => s.trim()).filter(Boolean)
    const MAX_ITEMS = 15

    if (items.length < 2) {
        return m.reply('⚠️ Minimal 2 item dipisah koma ya.')
    }

    if (items.length > MAX_ITEMS) {
        items = items.slice(0, MAX_ITEMS)
        await m.reply(`ℹ️ Maksimal ${MAX_ITEMS} item per pack, sisanya dipotong.`);
    }

    await sock.sendMessage(m.chat, { react: { text: '🕕', key: m.key } })

    const apikey = global.apikeybetabotz || 'SUP-6a70605bab0b4b97d624'
    const emojiRegex = /\p{Extended_Pictographic}/gu

    const results = await Promise.all(items.map(async (item) => {
        const emojis = item.match(emojiRegex) || []
        if (emojis.length < 2) return { item, buffer: null }
        
        try {
            const url = `https://api.betabotz.eu.org/api/emoji/emojimix?apikey=${apikey}&emoji1=${encodeURIComponent(emojis[0])}&emoji2=${encodeURIComponent(emojis[1])}`
            const res = await axios.get(url, { timeout: 20000 })
            const resultUrl = res.data?.result?.url || res.data?.result || res.data?.url || null
            
            if (!resultUrl) return { item, buffer: null }
            
            const imgRes = await axios.get(String(resultUrl), { responseType: 'arraybuffer', timeout: 20000 })
            return { item, buffer: Buffer.from(imgRes.data) }
        } catch (e) {
            return { item, buffer: null }
        }
    }))

    const success = results.filter(r => r.buffer)
    const failed = results.filter(r => !r.buffer)

    if (!success.length) {
        await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return m.reply('❌ Semua item gagal digenerate. Pastikan format emoji valid.')
    }

    const finalPackname = config.sticker?.packname || global.packname || 'Mix Pack'
    const finalAuthor = config.sticker?.author || global.author || 'WhatsApp Bot'
    const finalDescription = `Sticker pack dari ${success.length} kombinasi emojimix`

    try {
        
        const buffers = success.map(r => r.buffer)

        await sock.sendStickerPack(m.chat, buffers, m, {
            name: finalPackname,
            packname: finalPackname,
            publisher: finalAuthor,
            author: finalAuthor,
            description: finalDescription,
            emojis: ['🧩'],
        })

        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        let summary = `✅ Berhasil membuat sticker pack dari *${success.length}* item emoji.`
        if (failed.length) {
            summary += `\n⚠️ Gagal: ${failed.length} item.`
        }
        await m.reply(summary)

    } catch (error) {
        console.error('[mixpack error]', error)
        await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
        return m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal membuat sticker pack emojimix.\n` +
            `> _${error.message}_`
        )
    }
}

export { pluginConfig as config, handler }