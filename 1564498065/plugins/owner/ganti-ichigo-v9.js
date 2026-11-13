import fs from 'fs'
import { setAssetFromInput } from '../../src/lib/ichigo-uploader.js'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'
const pluginConfig = {
    name: 'ganti-ichigo-v9.jpg',
    alias: ['gantiichigov9', 'setichigov9'],
    category: 'owner',
    description: 'Ganti gambar ichigo-v9.jpg (thumbnail welcome)',
    usage: '.ganti-ichigo-v9.jpg (reply/kirim gambar)',
    example: '.ganti-ichigo-welcome.jpg',
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
    
    if (!isImage) {
        return m.reply(`🖼️ *ɢᴀɴᴛɪ ᴄʟᴏᴜᴅ-ᴠ9.ᴊᴘɢ*\n\n> Kirim/reply gambar untuk mengganti\n> File: assets/images/ichigo-v9.jpg`)
    }
    
    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }
        
        if (!buffer) {
            return m.reply(`❌ Gagal mendownload gambar`)
        }
        
        const newUrl = await setAssetFromInput('ichigo-v9', { buffer, filename: 'ichigo-v9.jpg' })
        
        m.reply(`✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Gambar ichigo-v9.jpg telah diganti`)
        
    } catch (error) {
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }