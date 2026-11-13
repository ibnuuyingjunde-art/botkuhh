import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import te from '../../src/lib/ichigo-error.js'
const execAsync = promisify(exec)

const pluginConfig = {
    name: 'watermark',
    alias: ['wm'],
    category: 'sticker',
    description: 'Menambahkan watermark teks ke gambar/video',
    usage: '.watermark <teks> [--position pos] [--size N] [--color warna]',
    example: '.watermark MyBrand\n.watermark © 2026 --position bottom-right\n.watermark lyniX\'s MD --size 32 --color white',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function escapeDrawtext(text) {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\u2019")
        .replace(/%/g, '\\%')
}

function parseOptions(args) {
    const options = {
        text: null,
        position: 'bottom-right',
        size: 24,
        color: 'white'
    }

    const textParts = []
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--position' || arg === '-p') {
            if (args[i + 1]) {
                options.position = args[i + 1]
                i++
            }
        } else if (arg === '--size' || arg === '-s') {
            if (args[i + 1] && /^\d+$/.test(args[i + 1])) {
                options.size = parseInt(args[i + 1])
                i++
            }
        } else if (arg === '--color' || arg === '-c') {
            if (args[i + 1]) {
                options.color = args[i + 1]
                i++
            }
        } else {
            textParts.push(arg)
        }
    }

    options.text = textParts.join(' ') || null
    return options
}

function getPositionExpr(position) {
    const margin = 20
    switch (position) {
        case 'top-left':
            return { x: `${margin}`, y: `${margin}` }
        case 'top-right':
            return { x: `w-tw-${margin}`, y: `${margin}` }
        case 'bottom-left':
            return { x: `${margin}`, y: `h-th-${margin}` }
        case 'bottom-right':
            return { x: `w-tw-${margin}`, y: `h-th-${margin}` }
        case 'center':
            return { x: `(w-tw)/2`, y: `(h-th)/2` }
        default:
            return { x: `w-tw-${margin}`, y: `h-th-${margin}` }
    }
}

function buildDrawtextFilter(text, options) {
    const { x, y } = getPositionExpr(options.position)
    const escapedText = escapeDrawtext(text)
    return `drawtext=text='${escapedText}':fontcolor=${options.color}:fontsize=${options.size}:x=${x}:y=${y}:shadowcolor=black:shadowx=2:shadowy=2`
}

async function watermarkImage(inputPath, outputPath, text, options) {
    const filter = buildDrawtextFilter(text, options)
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filter}" -y "${outputPath}"`
    const { stderr } = await execAsync(cmd)
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error(`ffmpeg produced empty output. stderr: ${stderr}`)
    }
}

async function watermarkVideo(inputPath, outputPath, text, options) {
    const filter = buildDrawtextFilter(text, options)
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filter}" -c:a copy -y "${outputPath}"`
    const { stderr } = await execAsync(cmd)
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error(`ffmpeg produced empty output. stderr: ${stderr}`)
    }
}

async function handler(m, { sock }) {
    const isImage = m.isImage || (m.quoted && m.quoted.type === 'imageMessage')
    const isVideo = m.isVideo || (m.quoted && m.quoted.type === 'videoMessage')

    const options = parseOptions(m.args || [])

    if (!isImage && !isVideo) {
        await m.reply(
            `💧 *ᴡᴀᴛᴇʀᴍᴀʀᴋ ᴍᴀᴋᴇʀ*\n\n` +
            `Kirim/reply gambar atau video dengan caption:\n` +
            `\`${m.prefix}watermark <teks>\`\n\n` +
            `*ᴏᴘsɪ:*\n` +
            `> \`--position\` - top-left/top-right/bottom-left/bottom-right/center (default: bottom-right)\n` +
            `> \`--size\` - ukuran font (default: 24)\n` +
            `> \`--color\` - warna teks (default: white)\n\n` +
            `*ᴄᴏɴᴛᴏʜ:*\n` +
            `> \`${m.prefix}watermark MyBrand\`\n` +
            `> \`${m.prefix}watermark © 2026 --position bottom-right\`\n` +
            `> \`${m.prefix}watermark lyniX's MD --size 32 --color yellow\``
        )
        return
    }

    if (!options.text) {
        await m.reply('❌ Teks watermark tidak boleh kosong!\n\nContoh: `' + m.prefix + 'watermark MyBrand`')
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

        const ext = isVideo ? 'mp4' : 'png'
        const inputPath = path.join(tempDir, `wm_in_${Date.now()}.${ext}`)
        const outputPath = path.join(tempDir, `wm_out_${Date.now()}.${ext}`)

        fs.writeFileSync(inputPath, buffer)

        try {
            if (isImage) {
                await watermarkImage(inputPath, outputPath, options.text, options)
            } else {
                await watermarkVideo(inputPath, outputPath, options.text, options)
            }
            buffer = fs.readFileSync(outputPath)
        } catch (e) {
            console.error('[watermark] ffmpeg error:', e.message || e)
            await m.reply(`❌ Gagal memproses media!\n\n\`\`\`${(e.message || 'unknown error').slice(0, 300)}\`\`\``)
            await m.react('❌')
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
            return
        }

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

        if (isImage) {
            await sock.sendMessage(m.chat, { image: buffer, caption: `💧 Watermarked: ${options.text}` }, { quoted: m })
        } else {
            await sock.sendMessage(m.chat, { video: buffer, caption: `💧 Watermarked: ${options.text}` }, { quoted: m })
        }

        await m.react('✅')

    } catch (error) {
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}

export { pluginConfig as config, handler }