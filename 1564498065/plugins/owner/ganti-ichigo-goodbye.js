import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ganti-ichigo-goodbye.jpg',
    alias: ['gantigoodbye', 'setichigogoodbye'],
    category: 'owner',
    description: 'Ganti gambar ichigo-goodbye.jpg (thumbnail goodbye)',
    usage: '.ganti-ichigo-goodbye.jpg (reply/kirim gambar) atau .ganti-ichigo-goodbye.jpg <url>',
    example: '.ganti-ichigo-goodbye.jpg https://contoh.com/gambar.jpg',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const hasLink = hasLinkInput(m)

    if (!isImage && !hasLink) {
        return m.reply(`🖼️ *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ-ɢᴏᴏᴅʙʏᴇ.ᴊᴘɢ*\n\n> Kirim/reply gambar untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/images/ichigo-goodbye.jpg`)
    }

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            return m.reply(`❌ Gagal mendownload gambar${isLink ? ' dari link' : ''}`)
        }

        const newUrl = await setAssetFromInput('ichigo-goodbye', { buffer, linkUrl, filename: 'ichigo-goodbye.jpg' })

        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Gambar ichigo-goodbye.jpg telah diganti${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }