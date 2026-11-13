import crypto from 'crypto'
import { prepareWAMessageMedia } from 'ichigo'
import { getAssetBuffer } from './ichigo-asset-manager.js'
import { createStickerFromImage } from './ichigo-exif.js'

// AssociationType.STICKER_ANNOTATION di WAProto Baileys terbaru.
// Angka langsung dipakai supaya aman di fork yang enum-nya belum ada.
const STICKER_ANNOTATION = 11
const UPLOAD_TTL = 30 * 60 * 1000

// assetKey -> { hash, webp }  (hasil konversi foto ke stiker)
const webpCache = new Map()
// assetKey -> { hash, at, message }  (hasil upload ke server WhatsApp)
const uploadCache = new Map()

/**
 * Ambil asset foto lalu ubah jadi stiker webp.
 * Konversi hanya dilakukan sekali. Kalau asset diganti (mis. lewat
 * ganti-ichigo3), hash berubah dan stiker dibuat ulang otomatis.
 */
async function getAssetSticker(assetKey, meta = {}) {
    const src = getAssetBuffer(assetKey)
    if (!src?.length) return null

    const hash = crypto.createHash('sha1').update(src).digest('hex')
    const hit = webpCache.get(assetKey)
    if (hit && hit.hash === hash) return { webp: hit.webp, hash }

    const webp = await createStickerFromImage(src, {
        packname: meta.packname || "lyniX's MD",
        author: meta.author || 'Bot'
    })
    webpCache.set(assetKey, { hash, webp })
    uploadCache.delete(assetKey)
    return { webp, hash }
}

async function getUploadedStickerMessage(sock, assetKey, webp, hash) {
    const hit = uploadCache.get(assetKey)
    if (hit && hit.hash === hash && Date.now() - hit.at < UPLOAD_TTL) return hit.message

    const media = await prepareWAMessageMedia(
        { sticker: webp, mimetype: 'image/webp' },
        { upload: sock.waUploadToServer }
    )
    const message = media.stickerMessage
    message.mimetype = 'image/webp'
    message.width = 512
    message.height = 512
    message.isAnimated = false

    uploadCache.set(assetKey, { hash, at: Date.now(), message })
    return message
}

// Kunci pesan yang ditempeli stiker (pesan yang diserialisasi, mis. command user).
function keyFromMessage(m) {
    const key = {
        remoteJid: m.chat,
        fromMe: !!m.fromMe,
        id: m.id || m.key?.id
    }
    if (m.isGroup && m.sender) key.participant = m.sender
    return key
}

/**
 * Tempelkan stiker (dari asset foto) ke pesan m.
 * Tidak pernah melempar error: kegagalan hanya dicatat di console supaya
 * tidak mengganggu command yang memanggilnya.
 */
async function attachAssetStickerToMessage(sock, m, assetKey = 'ichigo3', meta = {}) {
    try {
        const parentKey = keyFromMessage(m)
        if (!parentKey.id) return false

        const sticker = await getAssetSticker(assetKey, meta)
        if (!sticker) return false

        const stickerMessage = await getUploadedStickerMessage(sock, assetKey, sticker.webp, sticker.hash)

        await sock.relayMessage(
            m.chat,
            {
                messageContextInfo: {
                    messageAssociation: {
                        associationType: STICKER_ANNOTATION,
                        parentMessageKey: parentKey
                    }
                },
                stickerMessage
            },
            {}
        )
        return true
    } catch (e) {
        console.error('[StickerAnnotation]', e.message)
        return false
    }
}

/**
 * Dipakai oleh menu, allmenu, dan menucat: tempel stiker dari foto ichigo3
 * ke pesan command. Bisa dimatikan dengan ui.menuStickerReply = false di config.
 */
async function attachMenuSticker(sock, m, botConfig) {
    if (botConfig?.ui?.menuStickerReply === false) return false
    return attachAssetStickerToMessage(sock, m, 'ichigo3', {
        packname: botConfig?.sticker?.packname || botConfig?.bot?.name,
        author: botConfig?.sticker?.author || botConfig?.owner?.name
    })
}

export { getAssetSticker, attachAssetStickerToMessage, attachMenuSticker, STICKER_ANNOTATION }
