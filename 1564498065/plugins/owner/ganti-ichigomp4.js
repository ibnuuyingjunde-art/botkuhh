import fs from 'fs'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
import { updateAssetUrl, updateAssetLink } from '../../src/lib/ichigo-uploader.js'
import { hasLinkInput } from '../../src/lib/ichigo-media-input.js'
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

function extractLinkCandidate(m) {
    const argUrl = (m.args?.[0] || '').trim()
    if (/^https?:\/\//i.test(argUrl)) return argUrl
    const quotedText = (m.quoted?.text || m.quoted?.body || m.quoted?.caption || '').trim()
    if (/^https?:\/\//i.test(quotedText)) return quotedText
    return null
}

async function handler(m, { sock }) {
    const isVideo = m.type === 'videoMessage' || (m.quoted && m.quoted.type === 'videoMessage')
    const linkCandidate = extractLinkCandidate(m)

    if (!isVideo && !linkCandidate) {
        return m.reply(`🎬 *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ.ᴍᴘ4*\n\n> Kirim/reply video untuk mengganti\n> atau kirim link: ${m.prefix}${m.command} <url>\n> File: assets/video/ichigo.mp4`)
    }

    try {
        let buffer = null
        if (!linkCandidate) {
            if (m.quoted && m.quoted.isMedia) {
                buffer = await m.quoted.download()
            } else if (m.isMedia) {
                buffer = await m.download()
            }
            if (!buffer) {
                return m.reply(`❌ Gagal mendownload video`)
            }
        }

        await m.reply(`⏳ Sedang memproses...`)
        try {
            const newUrl = linkCandidate
                ? await updateAssetLink('ichigo-mp4', linkCandidate)
                : await updateAssetUrl('ichigo-mp4', buffer, 'ichigo.mp4')
            m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> File ichigo.mp4 telah diganti ke URL baru:\n> ${newUrl}\n> Config telah diupdate secara realtime!`)
        } catch (e) {
            m.reply(`❌ Gagal mengupload file: ${e.message}`)
        }
    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
