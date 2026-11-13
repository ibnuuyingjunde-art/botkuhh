import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import te from '../../src/lib/ichigo-error.js'
const execAsync = promisify(exec)

const pluginConfig = {
    name: 'volume',
    alias: ['vol', 'volumeup', 'volumedown'],
    category: 'sticker',
    description: 'Mengatur volume audio/video (naik/turunin)',
    usage: '.volume <multiplier|persen>',
    example: '.volume 2x\n.volume 150%\n.volume 0.5x',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function parseVolumeArg(arg) {
    if (!arg) return null

    const xMatch = arg.match(/^(\d+(?:\.\d+)?)x$/i)
    if (xMatch) {
        return parseFloat(xMatch[1])
    }

    const percentMatch = arg.match(/^(\d+(?:\.\d+)?)%$/)
    if (percentMatch) {
        return parseFloat(percentMatch[1]) / 100
    }

    const plainMatch = arg.match(/^(\d+(?:\.\d+)?)$/)
    if (plainMatch) {
        return parseFloat(plainMatch[1])
    }

    return null
}

async function adjustVolumeVideo(inputPath, outputPath, factor) {
    const cmd = `ffmpeg -i "${inputPath}" -af "volume=${factor}" -c:v copy -c:a aac -b:a 192k -y "${outputPath}"`
    const { stderr } = await execAsync(cmd)
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error(`ffmpeg produced empty output. stderr: ${stderr}`)
    }
}

async function adjustVolumeAudio(inputPath, outputPath, factor) {
    const cmd = `ffmpeg -i "${inputPath}" -af "volume=${factor}" -c:a libmp3lame -y "${outputPath}"`
    const { stderr } = await execAsync(cmd)
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error(`ffmpeg produced empty output. stderr: ${stderr}`)
    }
}

async function handler(m, { sock }) {
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')
    const isAudio = m.isAudio || (m.quoted && (m.quoted.type === 'audioMessage' || m.quoted.type === 'pttMessage'))

    const rawArg = m.args && m.args[0]
    const factor = parseVolumeArg(rawArg)

    if (!isVideo && !isAudio) {
        await m.reply(
            `🔊 *ᴠᴏʟᴜᴍᴇ ᴄᴏɴᴛʀᴏʟ*\n\n` +
            `Kirim/reply video atau audio dengan caption:\n` +
            `\`${m.prefix}volume <multiplier|persen>\`\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}volume 2x\` - naikkan 2x\n` +
            `> \`${m.prefix}volume 150%\` - naikkan 150%\n` +
            `> \`${m.prefix}volume 0.5x\` - turunkan setengah`
        )
        return
    }

    if (factor === null || isNaN(factor) || factor <= 0) {
        await m.reply(
            `❌ Format volume tidak valid!\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}volume 2x\`\n` +
            `> \`${m.prefix}volume 150%\`\n` +
            `> \`${m.prefix}volume 0.5x\``
        )
        return
    }

    if (factor > 10) {
        await m.reply('❌ Maksimal volume adalah 10x untuk mencegah distorsi ekstrem!')
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
        const inputPath = path.join(tempDir, `volume_in_${Date.now()}.${ext}`)
        const outputPath = path.join(tempDir, `volume_out_${Date.now()}.${ext}`)

        fs.writeFileSync(inputPath, buffer)

        try {
            if (isVideo) {
                await adjustVolumeVideo(inputPath, outputPath, factor)
            } else {
                await adjustVolumeAudio(inputPath, outputPath, factor)
            }
            buffer = fs.readFileSync(outputPath)
        } catch (e) {
            console.error('[volume] ffmpeg error:', e.message || e)
            await m.reply(`❌ Gagal memproses media!\n\n\`\`\`${(e.message || 'unknown error').slice(0, 300)}\`\`\``)
            await m.react('❌')
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            return
        }

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

        if (isVideo) {
            await sock.sendMessage(m.chat, { video: buffer, caption: `🔊 Volume ${factor}x` }, { quoted: m })
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