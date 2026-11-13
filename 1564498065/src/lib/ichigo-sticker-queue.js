import crypto from 'crypto'
import { sharp } from './ichigo-lazy.js'
import webp from 'node-webpmux'

export const manualQueue = new Map()

export function getManualQueue(sender) {
    if (!manualQueue.has(sender)) manualQueue.set(sender, [])
    return manualQueue.get(sender)
}

export function clearManualQueue(sender) {
    manualQueue.delete(sender)
}

export const albumBuffers = new Map()

const ALBUM_DEBOUNCE_MS = 4000 
const ALBUM_MAX_AGE_MS = 60000 

function getOrCreateAlbum(openerId, sender, chat) {
    if (!albumBuffers.has(openerId)) {
        albumBuffers.set(openerId, {
            sender,
            chat,
            expectedCount: 0,
            images: [],
            pendingCmd: null,
            timer: null,
            createdAt: Date.now()
        })
    }
    return albumBuffers.get(openerId)
}

export function registerAlbumOpener(openerId, sender, chat, expectedCount) {
    const album = getOrCreateAlbum(openerId, sender, chat)
    album.expectedCount = expectedCount || album.expectedCount
    return album
}

export function addImageToAlbum(openerId, sender, chat, buffer) {
    const album = getOrCreateAlbum(openerId, sender, chat)
    album.images.push(buffer)
    return album
}

export function setAlbumPendingCommand(openerId, sender, chat, cmd) {
    const album = getOrCreateAlbum(openerId, sender, chat)
    album.pendingCmd = cmd
    return album
}

export function popAlbum(openerId) {
    const album = albumBuffers.get(openerId)
    albumBuffers.delete(openerId)
    return album
}

export function scheduleAlbumDebounce(openerId, onFire) {
    const album = albumBuffers.get(openerId)
    if (!album) return
    if (album.timer) clearTimeout(album.timer)
    album.timer = setTimeout(() => onFire(openerId), ALBUM_DEBOUNCE_MS)
}

export function isAlbumComplete(album) {
    return album.expectedCount > 0 && album.images.length >= album.expectedCount
}

setInterval(() => {
    const now = Date.now()
    for (const [id, album] of albumBuffers) {
        if (now - album.createdAt > ALBUM_MAX_AGE_MS) {
            if (album.timer) clearTimeout(album.timer)
            albumBuffers.delete(id)
        }
    }
}, 30000)

export function parseStickerPackCaption(text, prefix = '.') {
    if (!text) return null
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${esc}(sp|spack|stickerpack)\\s+(?:create\\s+)?(.+)$`, 'i')
    const match = text.trim().match(re)
    if (!match) return null

    const rest = match[2]
    const [packname, author] = rest.split('|').map(s => s?.trim())
    if (!packname) return null
    return { packname, author: author || null }
}

async function toWebp(buffer) {
    return sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toBuffer()
}

async function injectExif(webpBuffer, packname, author) {
    const img = new webp.Image()
    await img.load(webpBuffer)

    const json = {
        'sticker-pack-id': crypto.randomUUID(),
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        'emojis': ['🙂']
    }

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ])
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8')
    exifAttr.writeUIntLE(jsonBuffer.length, 14, 4)

    img.exif = Buffer.concat([exifAttr, jsonBuffer])
    return img.save(null)
}

export async function buildAndSendPack(sock, chat, buffers, packname, author) {
    if (!buffers.length) throw new Error('Tidak ada gambar untuk dijadikan sticker pack')

    const stickerWebps = []
    for (const buf of buffers) {
        const raw = await toWebp(buf)
        const final = await injectExif(raw, packname, author)
        stickerWebps.push(final)
    }

    const stickerEntries = []
    for (const webpBuf of stickerWebps) {
        const uploaded = await sock.waUploadToServer(webpBuf, { mediaType: 'sticker' })
        stickerEntries.push({
            fileName: `${crypto.randomUUID()}.webp`,
            isAnimated: false,
            accessibilityLabel: '',
            isLottie: false,
            mimetype: 'image/webp',
            ...uploaded
        })
    }

    const trayBuf = await sharp(buffers[0]).resize(96, 96).png().toBuffer()
    const trayUploaded = await sock.waUploadToServer(trayBuf, { mediaType: 'thumbnail-image' })

    const stickerPackId = crypto.randomUUID()
    const totalSize = stickerWebps.reduce((a, b) => a + b.length, 0)

    const packMessage = {
        stickerPackMessage: {
            stickerPackId,
            name: packname,
            publisher: author,
            stickers: stickerEntries,
            fileLength: String(totalSize),
            fileSha256: stickerEntries[0].fileSha256,
            fileEncSha256: stickerEntries[0].fileEncSha256,
            mediaKey: stickerEntries[0].mediaKey,
            directPath: stickerEntries[0].directPath,
            mediaKeyTimestamp: String(Math.floor(Date.now() / 1000)),
            trayIconFileName: `${stickerPackId}.png`,
            thumbnailDirectPath: trayUploaded.directPath,
            thumbnailSha256: trayUploaded.fileSha256,
            thumbnailEncSha256: trayUploaded.fileEncSha256,
            thumbnailHeight: 96,
            thumbnailWidth: 96,
            stickerPackSize: String(totalSize),
            stickerPackOrigin: 'USER_CREATED'
        }
    }

    return sock.relayMessage(chat, packMessage, { messageId: crypto.randomUUID() })
}