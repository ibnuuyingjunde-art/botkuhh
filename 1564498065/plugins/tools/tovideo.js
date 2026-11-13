import { sharp } from '../../src/lib/ichigo-lazy.js';
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import te from '../../src/lib/ichigo-error.js'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const FFMPEG_PATH = ffmpegInstaller.path

const pluginConfig = {
    name: 'tovideo',
    alias: ['tovid', 'stickertovideo', 'giftomp4', 'webmtomp4'],
    category: 'tools',
    description: 'Mengubah sticker animasi menjadi video MP4',
    usage: '.tovideo (reply/caption sticker animasi)',
    example: '.tovideo',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 8,
    energi: 2,
    isEnabled: true
}

const MAX_SIZE = 512          // sisi terpanjang output (sticker WA memang 512)
const MAX_FRAMES = 150        // batas frame agar RAM/CPU aman
const MIN_DURATION_MS = 3000  // video terlalu pendek di-loop sampai ~3 detik
const MAX_LOOPS = 5
const FFMPEG_TIMEOUT = 60000

function isAnimatedWebp(buffer) {
    if (!buffer || buffer.length < 50) return false
    return buffer.includes(Buffer.from('ANIM')) || buffer.includes(Buffer.from('ANMF'))
}

function getTempDir() {
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    return tmpDir
}

function isNoSpace(err) {
    return /no space left|ENOSPC/i.test(err?.message || '') || err?.code === 'EPIPE'
}

/**
 * Sticker animasi (webp) -> MP4 TANPA file perantara GIF.
 *
 * Penyebab error lama ("wbuffer_write: write failed / No space left on device")
 * adalah sharp(..., { animated: true, pages: -1 }).gif(): libvips menyusun semua
 * frame jadi satu gambar raksasa lalu menulis file sementara ke disk (/tmp).
 * Sekarang tiap frame di-decode satu per satu, dikirim sebagai raw RGBA lewat
 * stdin ke ffmpeg, jadi di disk hanya ada 1 file mp4 kecil (output).
 */
async function webpToMp4(buffer) {
    const meta = await sharp(buffer, { animated: true, pages: -1 }).metadata()
    const pages = Math.min(meta.pages || 1, MAX_FRAMES)
    if (!meta.pages || meta.pages <= 1) return null

    const srcW = meta.width
    const srcH = meta.pageHeight || meta.height
    const scale = Math.min(1, MAX_SIZE / Math.max(srcW, srcH))
    const w = Math.max(2, Math.floor((srcW * scale) / 2) * 2)
    const h = Math.max(2, Math.floor((srcH * scale) / 2) * 2)

    const delays = Array.isArray(meta.delay) ? meta.delay.slice(0, pages) : []
    const validDelays = delays.filter(d => d > 0)
    const avgDelay = validDelays.length
        ? validDelays.reduce((a, b) => a + b, 0) / validDelays.length
        : 100
    const fps = Math.min(30, Math.max(5, Math.round(1000 / avgDelay)))
    const totalMs = Math.max(1, pages * (1000 / fps))
    const loops = Math.min(MAX_LOOPS, Math.max(1, Math.ceil(MIN_DURATION_MS / totalMs)))

    const tmpDir = getTempDir()
    const outputPath = path.join(tmpDir, `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`)
    const cleanup = () => { try { fs.unlinkSync(outputPath) } catch {} }

    const args = [
        '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps),
        '-i', 'pipe:0',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '26',
        '-pix_fmt', 'yuv420p',
        '-movflags', 'faststart',
        outputPath
    ]

    const ff = spawn(FFMPEG_PATH, args, { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    ff.stderr.on('data', c => { stderr = (stderr + c).slice(-1500) })

    const done = new Promise((resolve, reject) => {
        ff.on('error', reject)
        ff.on('close', code => code === 0
            ? resolve()
            : reject(new Error(`FFmpeg exit ${code}: ${stderr.trim().split('\n').pop()}`)))
    })
    done.catch(() => {}) // hindari unhandled rejection bila kita sudah throw lebih dulu

    const timer = setTimeout(() => ff.kill('SIGKILL'), FFMPEG_TIMEOUT)
    ff.stdin.on('error', () => {}) // error asli diambil dari event 'close'

    try {
        for (let l = 0; l < loops; l++) {
            for (let i = 0; i < pages; i++) {
                // putihkan transparansi (mp4 tidak punya alpha) lalu raw RGBA
                const frame = await sharp(buffer, { page: i })
                    .resize(w, h, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
                    .flatten({ background: '#ffffff' })
                    .ensureAlpha()
                    .raw()
                    .toBuffer()
                if (!ff.stdin.write(frame)) {
                    await new Promise(r => ff.stdin.once('drain', r))
                }
            }
        }
        ff.stdin.end()
        await done

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
            throw new Error('Output file empty')
        }
        return fs.readFileSync(outputPath)
    } catch (err) {
        ff.kill('SIGKILL')
        await done.catch(() => {})
        throw err
    } finally {
        clearTimeout(timer)
        cleanup()
    }
}

async function handler(m, { sock }) {
    let downloadFn = null
    const selfIsSticker = m.isSticker || m.type === 'stickerMessage' || m.message?.stickerMessage
    const quotedIsSticker = m.quoted && (
        m.quoted.isSticker ||
        m.quoted.type === 'stickerMessage' ||
        m.quoted.mtype === 'stickerMessage' ||
        m.quoted.message?.stickerMessage
    )

    if (selfIsSticker) {
        downloadFn = m.download
    } else if (quotedIsSticker) {
        downloadFn = m.quoted.download
    }

    if (!downloadFn) {
        return m.reply(
            `❌ *ɢᴀɢᴀʟ*\n\n` +
            `> Tidak ada sticker yang terdeteksi!\n\n` +
            `*Cara penggunaan:*\n` +
            `> 1. Kirim sticker + caption \`${m.prefix}tovideo\`\n` +
            `> 2. Reply sticker dengan \`${m.prefix}tovideo\``
        )
    }

    await m.react('🕕')

    try {
        const buffer = await downloadFn()

        if (!buffer || buffer.length === 0) {
            await m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Tidak dapat mengunduh sticker.`)
        }

        const animated = isAnimatedWebp(buffer)

        if (!animated) {

            const pngBuffer = await sharp(buffer).png().toBuffer()
            await sock.sendMessage(m.chat, {
                image: pngBuffer,
                caption: `✅ *ʙᴇʀʜᴀsɪʟ*\n\n> Sticker statis → gambar`
            }, { quoted: m })
            await m.react('✅')
            return
        }
        const mp4Buffer = await webpToMp4(buffer)
        if (!mp4Buffer) {
            await m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Sticker tidak bisa dikonversi (tidak animated)`)
        }

        if (!mp4Buffer || mp4Buffer.length < 100) {
            await m.react('❌')
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Video output kosong`)
        }

        await sock.sendMedia(m.chat, mp4Buffer, null, m, {
            type: 'video'
        })
        await m.react('✅')

    } catch (error) {
        console.error('[ToVideo] Error:', error.message)
        await m.react('☢')
        if (isNoSpace(error)) {
            return m.reply(`❌ *ɢᴀɢᴀʟ*\n\n> Penyimpanan server penuh. Hubungi owner untuk membersihkan disk.`)
        }
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }