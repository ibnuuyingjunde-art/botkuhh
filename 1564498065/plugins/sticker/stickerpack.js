import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { downloadContentFromMessage } from 'ichigo'
import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'
const execAsync = promisify(exec)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const hashBuf = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

const pluginConfig = {
    name: 'stickerpack',
    alias: ['spack', 'sp'],
    category: 'sticker',
    description: 'Convert foto/video (reply, atau beberapa foto yang baru dikirim) jadi sticker',
    usage: '.spack namapack|deskripsi [-crop]',
    example: '.spack MyPack|Keren banget\n.spack MyPack|Keren banget -crop',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const albumBuffers = new Map()
const ALBUM_MAX_AGE_MS = 90000 
const ALBUM_MAX_ITEMS = 30

function hookAlbumCollector(sock) {
    if (sock.__stickerpackHooked) return
    sock.__stickerpackHooked = true

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue
                const isImg = !!msg.message.imageMessage
                const isVid = !!msg.message.videoMessage
                if (!isImg && !isVid) {
                    if (msg.message.albumMessage) {
                        console.log('[stickerpack] albumMessage stub keliatan, expected:', msg.message.albumMessage.expectedImageCount, msg.message.albumMessage.expectedVideoCount)
                    }
                    continue
                }
                console.log('[stickerpack] collector nangkep', isVid ? 'video' : 'image', 'dari', msg.key.remoteJid)

                const chat = msg.key.remoteJid
                const sender = msg.key.participant || msg.key.remoteJid

                let entry = albumBuffers.get(chat)
                if (!entry || Date.now() - entry.updatedAt > ALBUM_MAX_AGE_MS || entry.sender !== sender) {
                    entry = { items: [], hashes: new Set(), sender, updatedAt: Date.now() }
                    albumBuffers.set(chat, entry)
                }

                const mediaMsg = isVid ? msg.message.videoMessage : msg.message.imageMessage
                const stream = await downloadContentFromMessage(mediaMsg, isVid ? 'video' : 'image')
                let buffer = Buffer.from([])
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

                const h = hashBuf(buffer)
                if (!entry.hashes.has(h)) {
                    entry.hashes.add(h)
                    entry.items.push({ buffer, type: isVid ? 'video' : 'image' })
                    if (entry.items.length > ALBUM_MAX_ITEMS) entry.items.shift()
                }
                entry.updatedAt = Date.now()
            } catch (e) {
                
            }
        }
    })
}

function parseOptions(args) {
    const options = { crop: false, packname: null, author: null }
    const rest = []
    for (const arg of args) {
        if (arg === '-crop' || arg === '--crop') options.crop = true
        else rest.push(arg)
    }
    if (rest.length) {
        const [packname, author] = rest.join(' ').split('|').map(s => s.trim())
        options.packname = packname || null
        options.author = author || null
    }
    return options
}

async function processImage(inputPath, outputPath, options) {
    const filters = options.crop
        ? [`crop='min(iw,ih)':'min(iw,ih)'`, `scale=512:512`]
        : [`scale=512:512:force_original_aspect_ratio=decrease`, `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000`]
    const filterStr = filters.join(',')
    await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -y "${outputPath}"`)
}

async function processVideo(inputPath, outputPath, options) {
    const filters = options.crop
        ? [`crop='min(iw,ih)':'min(iw,ih)'`, `scale=512:512`]
        : [`scale=512:512:force_original_aspect_ratio=decrease`, `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black`]
    const filterStr = filters.join(',')
    await execAsync(`ffmpeg -i "${inputPath}" -vf "${filterStr}" -c:a copy -t 10 -y "${outputPath}"`)
}

async function handler(m, { sock, config: botConfig }) {
    hookAlbumCollector(sock)

    const options = parseOptions(m.args || [])
    const chat = m.chat
    const sender = m.sender || m.key?.participant || chat

    let items = []

    if (m.quoted && m.quoted.isMedia && (m.quoted.type === 'imageMessage' || m.quoted.type === 'videoMessage')) {
        try {
            const buf = await m.quoted.download()
            items = [{ buffer: buf, type: m.quoted.type === 'videoMessage' ? 'video' : 'image' }]
        } catch (e) { }
    } else if (m.isImage || m.isVideo) {
        
        try {
            const buf = await m.download()
            items = [{ buffer: buf, type: m.isVideo ? 'video' : 'image' }]
        } catch (e) { }
    } else {
        
        const entry = albumBuffers.get(chat)
        if (entry && entry.sender === sender && entry.items.length > 0 && Date.now() - entry.updatedAt < ALBUM_MAX_AGE_MS) {
            
            let lastLen = entry.items.length
            let stableCount = 0
            for (let i = 0; i < 20; i++) {
                await sleep(300)
                if (entry.items.length === lastLen) {
                    stableCount++
                    if (stableCount >= 2) break
                } else {
                    stableCount = 0
                    lastLen = entry.items.length
                }
            }
            items = entry.items
        }
    }

    if (items.length === 0) {
        await m.reply(
            `Reply salah satu foto/video dalam album yang mau dijadiin sticker pack, ` +
            `atau kirim foto/videonya dulu baru ketik commandnya nyusul.\n\n` +
            `Contoh: reply/kirim foto/video lalu ketik *${m.prefix}spack namapack|deskripsi*\n` +
            `Tambahkan *-crop* di depan biar sticker dipotong persegi (default: *-fit*, tanpa crop).`
        )
        return
    }

    await m.react('🕕')

    const packname = options.packname || botConfig.sticker?.packname || botConfig.bot?.name || "lyniX's MD"
    const author = options.author || botConfig.sticker?.author || botConfig.owner?.name || 'Bot'

    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

    let sent = 0
    for (const item of items) {
        const isVid = item.type === 'video'
        const ext = isVid ? 'mp4' : 'png'
        const inputPath = path.join(tempDir, `spack_in_${Date.now()}_${sent}.${ext}`)
        const outputPath = path.join(tempDir, `spack_out_${Date.now()}_${sent}.${ext}`)
        try {
            fs.writeFileSync(inputPath, item.buffer)
            if (isVid) await processVideo(inputPath, outputPath, options)
            else await processImage(inputPath, outputPath, options)
            const stickerBuffer = fs.readFileSync(outputPath)
            if (isVid) await sock.sendVideoAsSticker(m.chat, stickerBuffer, m, { packname, author })
            else await sock.sendImageAsSticker(m.chat, stickerBuffer, m, { packname, author })
            sent++
        } catch (e) {
            
        } finally {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        }
    }

    albumBuffers.delete(chat)

    if (sent === 0) {
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
        return
    }

    await m.reply(`✅ ${sent} sticker terkirim dari pack "${packname}".`)
    await m.react('✅')
}

export { pluginConfig as config, handler }