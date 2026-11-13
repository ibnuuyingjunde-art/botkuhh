import fs from 'fs'
import path from 'path'
import { prepareWAMessageMedia } from 'ichigo'
import te from '../../src/lib/ichigo-error.js'
import { createStickerFromImage, createStickerFromVideo } from '../../src/lib/ichigo-exif.js'

// AssociationType.STICKER_ANNOTATION di WAProto Baileys terbaru.
// Dipakai angka langsung supaya tidak error di fork yang enum-nya belum ada.
const STICKER_ANNOTATION = 11
const MAX_VIDEO_SECONDS = 10

const pluginConfig = {
    name: 'stickerreply',
    alias: ['stcreply', 'sreply', 'replysticker', 'stickerannot'],
    category: 'sticker',
    description: 'Tempelkan stiker ke sebuah pesan (sticker annotation)',
    usage: '.stickerreply [--quote] | .stickerreply set | .stickerreply del',
    example: '.stickerreply set\n.stickerreply\n.stickerreply --quote',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const DIR = path.join(process.cwd(), 'database', 'stickerreply')
const META_FILE = path.join(DIR, 'meta.json')

function loadMeta() {
    try {
        return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'))
    } catch {
        return {}
    }
}

function saveMeta(meta) {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2))
}

function stickerFile(number) {
    return path.join(DIR, `${number}.bin`)
}

function userError(message) {
    return Object.assign(new Error(message), { userMessage: message })
}

function buildUsage(m) {
    const p = m.prefix || '.'
    const c = m.command || 'stickerreply'
    return (
        `STICKER REPLY\n\n` +
        `Menempelkan stiker ke sebuah pesan.\n\n` +
        `Cara 1 (stiker tersimpan):\n` +
        `1. Reply sebuah stiker, ketik ${p}${c} set\n` +
        `2. Reply pesan target, ketik ${p}${c}\n\n` +
        `Cara 2 (langsung dari media):\n` +
        `Reply pesan target, kirim gambar/video (maks ${MAX_VIDEO_SECONDS} detik) dengan caption ${p}${c}\n\n` +
        `Opsi:\n` +
        `--quote atau -q : stiker juga tampil sebagai reply (quote) ke pesan target\n\n` +
        `Hapus stiker tersimpan: ${p}${c} del`
    )
}

// Kunci pesan induk. Dibangun ulang dari m.chat supaya tidak membawa
// remoteJid/participant kosong atau berbentuk LID dari serializer.
function buildParentKey(m) {
    const q = m.quoted
    const fromMe = !!q.key?.fromMe || (!!q.sender && q.sender === m.botJid)
    const key = {
        remoteJid: m.chat,
        fromMe,
        id: q.id || q.key?.id
    }
    if (m.isGroup && q.sender) key.participant = q.sender
    return key
}

async function resolveSticker(m, number, botConfig) {
    const packname = botConfig?.sticker?.packname || botConfig?.bot?.name || "lyniX's MD"
    const author = botConfig?.sticker?.author || botConfig?.owner?.name || 'Bot'

    if (m.isImage) {
        const buf = await m.download()
        if (!buf?.length) throw userError('Gagal mengunduh gambar.')
        const webp = await createStickerFromImage(buf, { packname, author })
        return { buffer: webp, mimetype: 'image/webp', isAnimated: false, isLottie: false }
    }

    if (m.isVideo) {
        if ((m.seconds || 0) > MAX_VIDEO_SECONDS) {
            throw userError(`Video terlalu panjang. Maksimal ${MAX_VIDEO_SECONDS} detik.`)
        }
        const buf = await m.download()
        if (!buf?.length) throw userError('Gagal mengunduh video.')
        const webp = await createStickerFromVideo(buf, { packname, author })
        return { buffer: webp, mimetype: 'image/webp', isAnimated: true, isLottie: false }
    }

    const meta = loadMeta()[number]
    const file = stickerFile(number)
    if (meta && fs.existsSync(file)) {
        return {
            buffer: fs.readFileSync(file),
            mimetype: meta.mimetype || 'image/webp',
            isAnimated: !!meta.isAnimated,
            isLottie: !!meta.isLottie
        }
    }
    return null
}

// Upload stiker baru ke server WhatsApp. Tidak memakai ulang url/mediaKey
// stiker lama, jadi tidak bergantung pada masa berlaku media (parameter oe=).
async function buildStickerMessage(sock, sticker) {
    const media = await prepareWAMessageMedia(
        { sticker: sticker.buffer, mimetype: sticker.mimetype },
        { upload: sock.waUploadToServer }
    )
    const msg = media.stickerMessage
    msg.mimetype = sticker.mimetype
    msg.width = 512
    msg.height = 512
    msg.isAnimated = !!sticker.isAnimated
    if (sticker.isLottie) msg.isLottie = true
    return msg
}

async function handler(m, { sock, config: botConfig }) {
    const args = m.args || []
    const sub = (args[0] || '').toLowerCase()
    const number = String(m.senderNumber || '').replace(/\D/g, '')
    const p = m.prefix || '.'
    const c = m.command || 'stickerreply'

    try {
        if (sub === 'set') {
            if (!m.quoted?.isSticker) {
                return m.reply(`Reply sebuah stiker dengan ${p}${c} set untuk menyimpannya.`)
            }
            const buf = await m.quoted.download()
            if (!buf?.length) return m.reply('Gagal mengunduh stiker.')

            const sm = m.quoted.message?.stickerMessage || {}
            fs.mkdirSync(DIR, { recursive: true })
            fs.writeFileSync(stickerFile(number), buf)

            const meta = loadMeta()
            meta[number] = {
                mimetype: sm.mimetype || 'image/webp',
                isAnimated: !!sm.isAnimated,
                isLottie: !!sm.isLottie || sm.mimetype === 'application/was',
                savedAt: Date.now()
            }
            saveMeta(meta)

            return m.reply(`Stiker disimpan. Reply pesan target lalu ketik ${p}${c} untuk menempelkannya.`)
        }

        if (sub === 'del' || sub === 'hapus') {
            const meta = loadMeta()
            if (!meta[number]) return m.reply('Kamu belum punya stiker tersimpan.')
            delete meta[number]
            saveMeta(meta)
            try { fs.unlinkSync(stickerFile(number)) } catch {}
            return m.reply('Stiker tersimpan dihapus.')
        }

        if (!m.quoted) return m.reply(buildUsage(m))

        const withQuote = args.some(a => ['--quote', '-q'].includes(String(a).toLowerCase()))

        const sticker = await resolveSticker(m, number, botConfig)
        if (!sticker) {
            return m.reply(
                `Belum ada stiker. Simpan dulu dengan reply stiker + ${p}${c} set, ` +
                `atau kirim gambar/video dengan caption ${p}${c}.`
            )
        }

        const stickerMessage = await buildStickerMessage(sock, sticker)

        if (withQuote && m.quoted.message) {
            stickerMessage.contextInfo = {
                stanzaId: m.quoted.id || m.quoted.key?.id,
                participant: m.quoted.sender || m.quoted.key?.participant,
                quotedMessage: m.quoted.message
            }
        }

        await sock.relayMessage(
            m.chat,
            {
                messageContextInfo: {
                    messageAssociation: {
                        associationType: STICKER_ANNOTATION,
                        parentMessageKey: buildParentKey(m)
                    }
                },
                stickerMessage
            },
            {}
        )
    } catch (error) {
        if (error?.userMessage) return m.reply(error.userMessage)
        console.error('[stickerreply]', error)
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
