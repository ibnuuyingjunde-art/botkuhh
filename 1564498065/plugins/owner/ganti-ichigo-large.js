import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'
import { resolveMediaOrLink, hasLinkInput } from '../../src/lib/ichigo-media-input.js'
const pluginConfig = {
    name: 'ichigo-large',
    alias: ['setichigolarge', 'gantiichigolarge'],
    category: 'owner',
    description: 'Preset: Ganti gambar ichigo.jpg, serta ichigo-v7 hingga ichigo-v11.jpg sekaligus',
    usage: '.ichigo-large (reply/kirim gambar) atau .ichigo-large <url>',
    example: '.ichigo-large https://contoh.com/gambar.jpg',
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
        return m.reply(`🖼️ *ᴄʟᴏᴜᴅ ʟᴀʀɢᴇ ᴘʀᴇsᴇᴛ*\n\n> Kirim/reply gambar untuk mengganti kumpulan foto besar (ichigo.jpg, ichigo-v7.jpg s/d ichigo-v11.jpg) sekaligus.\n> atau kirim link: ${m.prefix}${m.command} <url>\n> Pastikan rasio gambar sesuai dengan yang diinginkan.`)
    }

    await m.react('🕕')

    try {
        const { buffer, isLink, linkUrl } = await resolveMediaOrLink(m)

        if (!buffer) {
            await m.react('❌')
            return m.reply(`❌ Gagal mendownload gambar${isLink ? ' dari link' : ''}`)
        }

        const targetKeys = ['ichigo', 'ichigo-v7', 'ichigo-v8', 'ichigo-v9', 'ichigo-v11']
        const targetImages = targetKeys

        const newUrl = await setAssetFromInput(targetKeys[0], { buffer, linkUrl, filename: 'ichigo.jpg' })
        for (const k of targetKeys.slice(1)) {
            await setAssetFromInput(k, { linkUrl: config.assets?.[targetKeys[0]] || newUrl })
        }

        await m.react('✅')
        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Gambar bundle *ichigo-large* berhasil diganti secara massal.\n> Mencakup: ${targetImages.join(', ')}\n> Sudah aktif tanpa restart.\n> Link: ${newUrl}${isLink ? `\n> Sumber: link (${linkUrl})` : ''}`)

    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
