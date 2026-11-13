import te from '../../src/lib/ichigo-error.js'

const API = 'https://api-cloud.my.id/downloader/aio2?url='

const pluginConfig = {
    name: 'aio2',
    alias: [],
    category: 'downloader',
    description: 'Download media dari TikTok, Instagram, Threads, Spotify, X, Pinterest, Facebook, SoundCloud',
    usage: '.aio2 <url>',
    example: '.aio2 https://vt.tiktok.com/ZSbGujekX/',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

function extractUrl(text) {
    const match = String(text || '').match(/https?:\/\/[^\s]+/i)
    return match ? match[0] : null
}

async function fetchAio(url) {
    const res = await fetch(API + encodeURIComponent(url), {
        signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
}

function mediaLink(item) {
    return item?.download_url || item?.url || null
}

function audioButton(prefix, url) {
    return [{
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
            display_text: '🎵 Ambil Audio',
            id: `${prefix}aio2 audio ${url}`
        })
    }]
}

async function handler(m, { sock }) {
    const rawText = String(m.text || m.args?.join(' ') || '')
    const isAudioMode = /^audio\s+/i.test(rawText.trim())
    const url = extractUrl(rawText) || extractUrl(m.quoted?.text)

    if (!url) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> Kirim link atau balas pesan berisi link:\n` +
            `> \`${m.prefix}${m.command} https://vt.tiktok.com/xxxx\`\n\n` +
            `*ᴘʟᴀᴛꜰᴏʀᴍ:* TikTok, Instagram, Threads, Spotify, X, Pinterest, Facebook, SoundCloud`
        )
    }

    await m.reply(isAudioMode ? `🕕 *ᴍᴇɴɢᴀᴍʙɪʟ ᴀᴜᴅɪᴏ...*` : `🕕 *ᴍᴇɴɢᴜɴᴅᴜʜ ᴍᴇᴅɪᴀ...*`)

    try {
        const data = await fetchAio(url)

        if (!data?.status || !Array.isArray(data.media) || data.media.length === 0) {
            return m.reply(`❌ Media tidak ditemukan. Pastikan link valid dan tidak private.`)
        }

        const videos = data.media.filter(v => v.type === 'video' && mediaLink(v))
        const images = data.media.filter(v => v.type === 'image' && mediaLink(v))
        const audios = data.media.filter(v => v.type === 'audio' && mediaLink(v))

        // Mode audio: dipicu tombol quick reply, kirim audio saja
        if (isAudioMode) {
            if (!audios.length) {
                return m.reply(`❌ Audio tidak tersedia untuk link ini.`)
            }
            await sock.sendMessage(m.chat, {
                audio: { url: mediaLink(audios[0]) },
                mimetype: 'audio/mpeg'
            }, { quoted: m })
            return m.react('✅')
        }

        const caption =
            `📥 *${(data.platform || 'aio').toUpperCase()}*\n\n` +
            `> *Tipe:* ${data.kind || '-'}\n` +
            `> *Author:* ${data.author || '-'}\n` +
            (data.text ? `> *Deskripsi:* ${data.text}\n` : '')

        const buttons = audios.length ? audioButton(m.prefix, url) : null

        // Kirim dengan tombol, kalau gagal fallback tanpa tombol
        const send = async (content) => {
            if (buttons) {
                try {
                    return await sock.sendMessage(m.chat, {
                        ...content,
                        footer: 'Tekan tombol untuk ambil audio',
                        interactiveButtons: buttons
                    }, { quoted: m })
                } catch (e) {
                    console.error('[aio2] gagal kirim tombol, fallback:', e)
                }
            }
            return sock.sendMessage(m.chat, content, { quoted: m })
        }

        if (videos.length) {
            await send({
                video: { url: mediaLink(videos[0]) },
                mimetype: 'video/mp4',
                caption
            })
        } else if (images.length) {
            for (let i = 0; i < images.length; i++) {
                const content = {
                    image: { url: mediaLink(images[i]) },
                    caption: i === 0 ? caption : ''
                }
                if (i === images.length - 1) await send(content)
                else await sock.sendMessage(m.chat, content, { quoted: m })
            }
        } else if (audios.length) {
            // Hanya audio (Spotify, SoundCloud), langsung kirim
            await m.reply(caption)
            await sock.sendMessage(m.chat, {
                audio: { url: mediaLink(audios[0]) },
                mimetype: 'audio/mpeg'
            }, { quoted: m })
        } else {
            return m.reply(`❌ Tidak ada media yang bisa dikirim dari link tersebut.`)
        }

        m.react('✅')

    } catch (err) {
        console.error('[aio2] gagal download:', err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }