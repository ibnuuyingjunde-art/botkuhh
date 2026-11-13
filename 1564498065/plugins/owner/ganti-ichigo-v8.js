import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ganti-ichigo-v8.jpg',
    alias: ['gantiichigov8', 'setichigov8'],
    category: 'owner',
    description: 'Ganti gambar ichigo-v8.jpg (thumbnail welcome)',
    usage: '.ganti-ichigo-v8.jpg (reply/kirim gambar) atau .ganti-ichigo-v8.jpg <url>',
    example: '.ganti-ichigo-welcome.jpg https://contoh.com/gambar.jpg',
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
        return m.reply(`🖼️ *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ-ᴠ8.ᴊᴘɢ*\n\n> Kirim/reply gambar untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/images/ichigo-v9.jpg`)
    }

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            return m.reply(`❌ Gagal mendownload gambar${isLink ? ' dari link' : ''}`)
        }

        const newUrl = await setAssetFromInput('ichigo-v8', { buffer, linkUrl, filename: 'ichigo-v8.jpg' })

        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Gambar ichigo-v8.jpg telah diganti${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }