/**
 * Pengumpul album (kumpulan foto yang dikirim sekaligus) per chat.
 *
 * Yang disimpan cuma REFERENSI media (kunci & path, ukuran kecil), bukan isi
 * foto, jadi aman untuk semua chat. Foto baru didownload saat command seperti
 * `.sp` benar-benar dipanggil lewat downloadAlbumImages().
 *
 * Cara kerja WhatsApp: pesan `albumMessage` (berisi jumlah foto yang
 * diharapkan) dikirim dulu, lalu tiap foto datang sebagai imageMessage dengan
 * messageContextInfo.messageAssociation.parentMessageKey = id album tadi.
 */
import { downloadContentFromMessage } from 'ichigo'

const albums = new Map() // parentId -> { chat, sender, expected, items: Map(id -> imageMessage), updatedAt }
const MAX_ALBUMS = 200
const MAX_AGE_MS = 5 * 60 * 1000

function getEntry(parentId, chat, sender) {
    let e = albums.get(parentId)
    if (!e) {
        e = { chat, sender, expected: 0, items: new Map(), updatedAt: Date.now() }
        albums.set(parentId, e)
        while (albums.size > MAX_ALBUMS) albums.delete(albums.keys().next().value)
    }
    return e
}

export function getAlbumParentId(message) {
    return message?.messageContextInfo?.messageAssociation?.parentMessageKey?.id || null
}

export function bindAlbumCollector(ev) {
    ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages || []) {
            try {
                const message = msg?.message
                if (!message || !msg.key?.remoteJid) continue
                const chat = msg.key.remoteJid
                const sender = msg.key.participant || chat

                if (message.albumMessage) {
                    const e = getEntry(msg.key.id, chat, sender)
                    e.expected = Number(message.albumMessage.expectedImageCount) || e.expected
                    e.updatedAt = Date.now()
                    continue
                }

                if (message.imageMessage) {
                    const parentId = getAlbumParentId(message)
                    if (!parentId) continue
                    const e = getEntry(parentId, chat, sender)
                    e.items.set(msg.key.id, message.imageMessage)
                    e.updatedAt = Date.now()
                }
            } catch { }
        }
    })
}

setInterval(() => {
    const now = Date.now()
    for (const [id, e] of albums) if (now - e.updatedAt > MAX_AGE_MS) albums.delete(id)
}, 60 * 1000).unref?.()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Tunggu sampai semua foto album sudah masuk (atau berhenti bertambah).
 * Return jumlah foto yang terkumpul.
 */
export async function waitForAlbum(parentId, { maxMs = 25000, stableMs = 3000 } = {}) {
    const start = Date.now()
    let lastCount = -1
    let lastChange = Date.now()
    while (Date.now() - start < maxMs) {
        const e = albums.get(parentId)
        const count = e ? e.items.size : 0
        if (count !== lastCount) {
            lastCount = count
            lastChange = Date.now()
        }
        if (e && e.expected > 0 && count >= e.expected) return count
        // jumlah yang diharapkan tidak diketahui / ada yang hilang: tunggu sampai stabil
        if (count > 0 && Date.now() - lastChange >= (e?.expected ? stableMs * 2 : stableMs)) return count
        await sleep(300)
    }
    return albums.get(parentId)?.items.size || 0
}

/** Download semua foto album (urutan kedatangan), maksimal `limit` foto. */
export async function downloadAlbumImages(parentId, limit = 30) {
    const e = albums.get(parentId)
    if (!e) return []
    const out = []
    for (const imageMessage of [...e.items.values()].slice(0, limit)) {
        try {
            const stream = await downloadContentFromMessage(imageMessage, 'image')
            const chunks = []
            for await (const c of stream) chunks.push(c)
            out.push(Buffer.concat(chunks))
        } catch { }
    }
    return out
}

export function dropAlbum(parentId) {
    albums.delete(parentId)
}

export function getAlbumInfo(parentId) {
    const e = albums.get(parentId)
    return e ? { expected: e.expected, count: e.items.size } : null
}
