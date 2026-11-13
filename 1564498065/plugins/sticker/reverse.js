import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import te from '../../src/lib/ichigo-error.js'
const execAsync = promisify(exec)

const pluginConfig = {
    name: 'reverse',
    alias: ['rev', 'terbalik'],
    category: 'sticker',
    description: 'Membalik video/audio (reverse)',
    usage: '.reverse',
    example: '.reverse',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function reverseVideo(inputPath, outputPath) {
    await execAsync(`ffmpeg -i "${inputPath}" -vf "reverse" -af "areverse" -y "${outputPath}"`)
}

async function reverseAudio(inputPath, outputPath) {
    await execAsync(`ffmpeg -i "${inputPath}" -af "areverse" -y "${outputPath}"`)
}

async function handler(m, { sock }) {
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')
    const isAudio = m.isAudio || (m.quoted && (m.quoted.type === 'audioMessage' || m.quoted.type === 'pttMessage'))

    if (!isVideo && !isAudio) {
        await m.reply(
            `🔄 *ʀᴇᴠᴇʀsᴇ ᴍᴀᴋᴇʀ*\n\n` +
            `Kirim/reply video atau audio dengan caption:\n` +
            `\`${m.prefix}reverse\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}reverse\` (reply video)\n` +
            `> \`${m.prefix}reverse\` (reply voice note)`
        )
        return
    }

    await m.react('🕕')

    try {
        let buffer
        if (m.quoted && m.quoted.isMedia) {
            buffer = await m.quoted.download()
        } else if (m.isMedia) {
            buffer = await m.download()
        }

        if (!buffer) {
            await m.reply('❌ Gagal mendownload media!')
            await m.react('❌')
            return
        }

        const tempDir = path.join(process.cwd(), 'temp')
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const ext = isVideo ? 'mp4' : 'mp3'
        const inputPath = path.join(tempDir, `reverse_in_${Date.now()}.${ext}`)
        const outputPath = path.join(tempDir, `reverse_out_${Date.now()}.${ext}`)

        fs.writeFileSync(inputPath, buffer)

        try {
            if (isVideo) {
                await reverseVideo(inputPath, outputPath)
            } else {
                await reverseAudio(inputPath, outputPath)
            }
            buffer = fs.readFileSync(outputPath)
        } catch (e) {
            await m.reply('❌ Gagal memproses media, pastikan format didukung!')
            await m.react('❌')
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            return
        }

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

        if (isVideo) {
            await sock.sendMessage(m.chat, { video: buffer, caption: '🔄 Reversed!' }, { quoted: m })
        } else {
            await sock.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/mp4', ptt: m.quoted?.type === 'pttMessage' }, { quoted: m })
        }

        await m.react('✅')

    } catch (error) {
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}

export { pluginConfig as config, handler }