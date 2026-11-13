import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ganti-ichigo.mp4',
    alias: ['gantiichigovideo', 'setichigovideo'],
    category: 'owner',
    description: 'Ganti video ichigo.mp4',
    usage: '.ganti-ichigo.mp4 (reply/kirim video) atau .ganti-ichigo.mp4 <url>',
    example: '.ganti-ichigo.mp4 https://contoh.com/video.mp4',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isVideo = m.type === 'videoMessage' || (m.quoted && m.quoted.type === 'videoMessage')
    const hasLink = hasLinkInput(m)

    if (!isVideo && !hasLink) {
        return m.reply(`🎬 *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ.ᴍᴘ4*\n\n> Kirim/reply video untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/video/ichigo.mp4`)
    }

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            return m.reply(`❌ Gagal mendownload video${isLink ? ' dari link' : ''}`)
        }

        const newUrl = await setAssetFromInput('ichigo-mp4', { buffer, linkUrl, filename: 'ichigo.mp4' })

        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Video ichigo.mp4 telah diganti\n> Link: ${newUrl}${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
