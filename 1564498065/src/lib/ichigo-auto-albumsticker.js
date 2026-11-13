import config from '../../config.js'
import {
    registerAlbumOpener,
    addImageToAlbum,
    setAlbumPendingCommand,
    popAlbum,
    scheduleAlbumDebounce,
    isAlbumComplete,
    parseStickerPackCaption,
    buildAndSendPack
} from './ichigo-sticker-queue.js'

async function finalizeAlbum(openerId, sock) {
    const album = popAlbum(openerId)
    if (!album) return
    if (album.timer) clearTimeout(album.timer)
    if (!album.pendingCmd || !album.images.length) return

    try {
        const author = album.pendingCmd.author ||
            config.sticker?.author || config.owner?.name || 'Bot'
        await buildAndSendPack(sock, album.chat, album.images, album.pendingCmd.packname, author)
    } catch (e) {
        try {
            await sock.sendMessage(album.chat, {
                text: `❌ Gagal bikin sticker pack: ${e.message}`
            })
        } catch (_) {}
    }
}

/**
 * Dipanggil untuk SETIAP pesan masuk (mirip handleAutoDownload).
 * Return true kalau pesan ini "diserap" jadi bagian dari album handling
 * (dipakai handler.js buat suppress command routing biasa di pesan yg sama).
 */
export async function handleAlbumSticker(m, sock) {
    const prefix = m.prefix || config.command?.prefix || '.'

    if (m.type === 'albumMessage') {
        const info = m.message?.albumMessage || {}
        registerAlbumOpener(m.key.id, m.sender, m.chat, info.expectedImageCount || 0)
        return false
    }

    if (m.isImage) {
        const parentId = m.message?.messageContextInfo?.messageAssociation?.parentMessageKey?.id
        if (!parentId) return false 

        const buffer = await m.download()
        if (!buffer) return false

        const album = addImageToAlbum(parentId, m.sender, m.chat, buffer)

        if (m.body) {
            const parsed = parseStickerPackCaption(m.body, prefix)
            if (parsed) {
                setAlbumPendingCommand(parentId, m.sender, m.chat, parsed)
                m.isCommand = false 
            }
        }

        if (isAlbumComplete(album) && album.pendingCmd) {
            await finalizeAlbum(parentId, sock)
        } else {
            scheduleAlbumDebounce(parentId, (id) => finalizeAlbum(id, sock))
        }

        return true
    }

    return false
}