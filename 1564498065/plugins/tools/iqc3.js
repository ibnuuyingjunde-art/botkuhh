import te from '../../src/lib/ichigo-error.js'

const API = 'https://api-cloud.my.id/canvas/iqcdark'

const pluginConfig = {
    name: 'iqc3',
    alias: [],
    category: 'tools',
    description: 'Buat quote dark dari teks, dengan gambar dari URL atau foto',
    usage: '.iqc3 <teks> | .iqc3 <teks> <url gambar> | kirim/balas foto + .iqc3 <teks>',
    example: '.iqc3 hai',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

const URL_REGEX = /https?:\/\/[^\s]+/i

// Upload buffer gambar supaya dapat URL publik untuk parameter ?image=
// Utama: cdn-ichigo.web.id, sisanya cadangan kalau gagal.
const CDN = 'https://cdn-ichigo.web.id'

const uploaders = [
    async (buffer) => {
        const form = new FormData()
        form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')
        const res = await fetch(`${CDN}/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
        const json = await res.json()
        if (!json?.success || !json.url) throw new Error(`cdn-ichigo: ${json?.error || 'tidak ada url'}`)
        return json.url.startsWith('http') ? json.url : CDN + json.url
    },
    async (buffer) => {
        const form = new FormData()
        form.append('files[]', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')
        const res = await fetch('https://uguu.se/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
        const json = await res.json()
        const url = json?.files?.[0]?.url
        if (!url) throw new Error('uguu: tidak ada url')
        return url
    },
    async (buffer) => {
        const form = new FormData()
        form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
        const json = await res.json()
        const url = json?.data?.url
        if (!url) throw new Error('tmpfiles: tidak ada url')
        return url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    },
    async (buffer) => {
        const form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg')
        const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
        const out = (await res.text()).trim()
        if (!/^https?:\/\//i.test(out)) throw new Error(`catbox: ${out}`)
        return out
    }
]

async function uploadImage(buffer) {
    const errors = []
    for (const upload of uploaders) {
        try {
            return await upload(buffer)
        } catch (e) {
            errors.push(e.message)
        }
    }
    throw new Error(`Semua uploader gagal: ${errors.join(' | ')}`)
}

async function getImageBuffer(m) {
    if (m.quoted?.isImage) return m.quoted.download()
    if (m.isImage) return m.download()
    return null
}

async function handler(m, { sock }) {
    let input = String(m.text || m.args?.join(' ') || '').trim()

    // Ambil URL gambar dari teks (kalau ada), sisanya jadi teks quote
    let imageUrl = null
    const urlMatch = input.match(URL_REGEX)
    if (urlMatch) {
        imageUrl = urlMatch[0]
        input = input.replace(urlMatch[0], '').trim()
    }

    // Kalau tidak ada teks, pakai teks dari pesan yang dibalas
    let text = input || String(m.quoted?.text || m.quoted?.caption || '').trim()

    let hasImageMessage = !!(m.quoted?.isImage || m.isImage)

    if (!text && !imageUrl && !hasImageMessage) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}${m.command} <teks>\`\n` +
            `> \`${m.prefix}${m.command} <teks> <url gambar>\`\n` +
            `> Kirim atau balas *foto* lalu ketik \`${m.prefix}${m.command} <teks>\``
        )
    }

    if (!text) text = ' '

    await m.reply(`🕕 *ᴍᴇᴍʙᴜᴀᴛ ǫᴜᴏᴛᴇ...*`)

    try {
        // Foto dari pesan lebih diutamakan daripada URL
        if (hasImageMessage) {
            let buffer
            try {
                buffer = await getImageBuffer(m)
            } catch (e) {
                console.error('[iqc3] gagal download gambar:', e)
                return m.reply(`❌ Gagal download gambar.`)
            }
            if (buffer) imageUrl = await uploadImage(buffer)
        }

        const params = new URLSearchParams({ text })
        if (imageUrl) params.set('image', imageUrl)

        const res = await fetch(`${API}?${params.toString()}`, {
            signal: AbortSignal.timeout(60000)
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const contentType = res.headers.get('content-type') || ''
        let image

        if (contentType.startsWith('image/')) {
            // API kadang langsung mengembalikan file PNG
            image = Buffer.from(await res.arrayBuffer())
        } else {
            const data = await res.json()
            if (!data?.status || !data.base64) {
                return m.reply(`❌ Gagal membuat gambar.`)
            }
            image = Buffer.from(data.base64, 'base64')
        }

        await sock.sendMessage(m.chat, { image }, { quoted: m })
        m.react('✅')

    } catch (err) {
        console.error('[iqc3] gagal:', err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }