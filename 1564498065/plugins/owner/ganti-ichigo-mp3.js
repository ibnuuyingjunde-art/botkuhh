import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ganti-ichigo.mp3',
    alias: ['gantiichigoaudio', 'setichigoaudio'],
    category: 'owner',
    description: 'Ganti audio ichigo.mp3',
    usage: '.ganti-ichigo.mp3 (reply/kirim audio) atau .ganti-ichigo.mp3 <url>',
    example: '.ganti-ichigo.mp3 https://contoh.com/audio.mp3',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const isAudio = m.type === 'audioMessage' || (m.quoted && m.quoted.type === 'audioMessage')
    const hasLink = hasLinkInput(m)

    if (!isAudio && !hasLink) {
        return m.reply(`🎵 *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ.ᴍᴘ3*\n\n> Kirim/reply audio untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/audio/ichigo.mp3`)
    }

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            return m.reply(`❌ Gagal mendownload audio${isLink ? ' dari link' : ''}`)
        }

        const newUrl = await setAssetFromInput('ichigo-mp3', { buffer, linkUrl, filename: 'ichigo.mp3' })

        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Audio ichigo.mp3 telah diganti${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
