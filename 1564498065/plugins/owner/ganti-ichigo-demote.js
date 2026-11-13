import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ganti-ichigo-demote.jpg',
    alias: ['gantiichigodemote', 'setichigodemote'],
    category: 'owner',
    description: 'Ganti gambar ichigo-demote.jpg',
    usage: '.ganti-ichigo-demote.jpg (reply/kirim gambar) atau .ganti-ichigo-demote.jpg <url>',
    example: '.ganti-ichigo-demote.jpg https://contoh.com/gambar.jpg',
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
        return m.reply(`🖼️ *ɢᴀɴᴛɪ LYNIX-DEMOTE.JPG*\n\n> Kirim/reply gambar untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/images/ichigo-demote.jpg`)
    }

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            return m.reply(`❌ Gagal mendownload gambar${isLink ? ' dari link' : ''}`)
        }

        const newUrl = await setAssetFromInput('ichigo-demote', { buffer, linkUrl, filename: 'ichigo-demote.jpg' })

        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Gambar ichigo-demote.jpg telah diganti\n> Link: ${newUrl}${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }