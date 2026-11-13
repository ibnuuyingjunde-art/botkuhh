import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'temp', 'antidelete')
const MAX_AGE_MS = 60 * 60 * 1000 
const MAX_ENTRIES = 300 

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
}

ensureCacheDir()

function metaPath(id) {
    return path.join(CACHE_DIR, `${id}.json`)
}

function mediaPath(id, ext) {
    return path.join(CACHE_DIR, `${id}.${ext}`)
}

/**
 * Simpan pesan ke cache.
 * @param {object} data
 * @param {string} data.id - ID pesan (m.id atau m.key.id)
 * @param {string} data.chat - JID chat
 * @param {string} data.sender - JID pengirim
 * @param {string} data.senderName - Nama pengirim (pushName)
 * @param {'text'|'image'|'video'|'sticker'} data.type
 * @param {string} [data.text] - Isi teks (kalau type text, atau caption media)
 * @param {Buffer} [data.buffer] - Buffer media (kalau type image/video/sticker)
 */
function saveMessage({ id, chat, sender, senderName, type, text, buffer }) {
    if (!id) return

    try {
        ensureCacheDir()

        const meta = {
            id,
            chat,
            sender,
            senderName: senderName || 'Unknown',
            type,
            text: text || '',
            timestamp: Date.now(),
            hasMedia: !!buffer
        }

        fs.writeFileSync(metaPath(id), JSON.stringify(meta))

        if (buffer) {
            const ext = type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'webp'
            fs.writeFileSync(mediaPath(id, ext), buffer)
            meta.mediaExt = ext
            fs.writeFileSync(metaPath(id), JSON.stringify(meta))
        }
    } catch (e) {
        console.error('[antidelete-store] gagal simpan:', e.message)
    }
}

/**
 * Ambil pesan dari cache berdasarkan ID.
 * @param {string} id
 * @returns {object|null}
 */
function getMessage(id) {
    if (!id) return null

    const metaFile = metaPath(id)
    if (!fs.existsSync(metaFile)) return null

    try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))

        if (meta.hasMedia && meta.mediaExt) {
            const mFile = mediaPath(id, meta.mediaExt)
            if (fs.existsSync(mFile)) {
                meta.buffer = fs.readFileSync(mFile)
            }
        }

        return meta
    } catch (e) {
        console.error('[antidelete-store] gagal baca:', e.message)
        return null
    }
}

/**
 * Bersihkan entry lama biar disk/memory ga penuh. Panggil berkala (misal tiap 1 jam via setInterval).
 */
function cleanup() {
    try {
        ensureCacheDir()
        const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'))
        const now = Date.now()

        const entries = files.map(f => {
            const p = path.join(CACHE_DIR, f)
            const meta = JSON.parse(fs.readFileSync(p, 'utf-8'))
            return { file: f, id: meta.id, timestamp: meta.timestamp, ext: meta.mediaExt }
        }).sort((a, b) => b.timestamp - a.timestamp)

        const toDelete = []

        for (const entry of entries) {
            if (now - entry.timestamp > MAX_AGE_MS) {
                toDelete.push(entry)
            }
        }

        if (entries.length > MAX_ENTRIES) {
            toDelete.push(...entries.slice(MAX_ENTRIES))
        }

        for (const entry of toDelete) {
            const jsonFile = path.join(CACHE_DIR, `${entry.id}.json`)
            if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile)
            if (entry.ext) {
                const mFile = path.join(CACHE_DIR, `${entry.id}.${entry.ext}`)
                if (fs.existsSync(mFile)) fs.unlinkSync(mFile)
            }
        }
    } catch (e) {
        console.error('[antidelete-store] cleanup error:', e.message)
    }
}

export { saveMessage, getMessage, cleanup }
