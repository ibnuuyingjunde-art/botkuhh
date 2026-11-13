import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'antide',
    alias: ['ad', 'recall'],
    category: 'tools',
    description: 'Memunculkan isi pesan asli (teks/gambar/video/sticker) yang sudah dihapus, diambil dari pesan orang yang me-reply pesan tersebut',
    usage: '.antide (reply pesan orang yang me-reply pesan yang sudah dihapus)',
    example: '.antide',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 1,
    isEnabled: true
}

function getEmbeddedQuoted(quotedRaw) {
    if (!quotedRaw || !quotedRaw.message) return null

    const msgTypes = Object.keys(quotedRaw.message)
    for (const type of msgTypes) {
        const content = quotedRaw.message[type]
        if (content?.contextInfo?.quotedMessage) {
            return {
                message: content.contextInfo.quotedMessage,
                participant: content.contextInfo.participant,
                stanzaId: content.contextInfo.stanzaId
            }
        }
    }
    return null
}

function detectType(waMessage) {
    if (waMessage.imageMessage) return 'image'
    if (waMessage.videoMessage) return 'video'
    if (waMessage.stickerMessage) return 'sticker'
    if (waMessage.audioMessage) return 'audio'
    if (waMessage.conversation || waMessage.extendedTextMessage) return 'text'
    return null
}

function getText(waMessage) {
    return (
        waMessage.conversation ||
        waMessage.extendedTextMessage?.text ||
        waMessage.imageMessage?.caption ||
        waMessage.videoMessage?.caption ||
        ''
    )
}

async function handler(m, { sock }) {
    if (!m.quoted) {
        await m.reply(
            `🗑️ *ᴀɴᴛɪᴅᴇ*\n\n` +
            `Reply pesan seseorang yang isinya me-reply pesan lain yang sudah dihapus, dengan caption:\n` +
            `\`${m.prefix}antide\`\n\n` +
            `Bot akan ambil isi pesan asli (teks/gambar/video/sticker) yang tersimpan di dalam reply tersebut.`
        )
        return
    }

    try {
        console.log('========== [antide] DEBUG m.quoted ==========')
        console.log(JSON.stringify(m.quoted, (key, value) => {
            if (value && (value.type === 'Buffer' || value instanceof Uint8Array)) {
                return `[Buffer ${value.data?.length ?? value.length ?? 0} bytes]`
            }
            return value
        }, 2))
        console.log('========== [antide] keys of m.quoted.message (jika ada) ==========')
        console.log(m.quoted.message ? Object.keys(m.quoted.message) : 'm.quoted.message tidak ada')
        console.log('==============================================')
    } catch (e) {
        console.log('[antide] gagal debug log:', e.message)
    }

    const quotedRaw = m.quoted.message ? m.quoted : (m.quoted.msg || m.quoted)
    const embedded = getEmbeddedQuoted(quotedRaw)

    if (!embedded) {
        await m.reply(
            `❌ Pesan yang kamu reply itu bukan reply ke pesan lain (tidak ada quotedMessage).\n\n` +
            `💡 Pastikan alurnya: A kirim pesan → B reply pesan A → kamu reply pesan B pakai \`${m.prefix}antide\`.`
        )
        return
    }

    const waMsg = embedded.message
    const type = detectType(waMsg)

    if (!type) {
        await m.reply('❌ Tipe pesan asli tidak dikenali/tidak didukung.')
        return
    }

    await m.react('🕕')

    try {
        if (type === 'text') {
            const text = getText(waMsg)
            await m.reply(`🗑️ *Pesan yang dihapus:*\n\n${text || '(kosong)'}`)
            await m.react('✅')
            return
        }

        const { downloadMediaMessage } = await import('ichigo')

        const fakeMsg = {
            key: {
                remoteJid: m.chat,
                id: embedded.stanzaId || `ANTIDE${Date.now()}`,
                participant: embedded.participant || m.quoted.sender || undefined
            },
            message: waMsg
        }

        const buffer = await downloadMediaMessage(
            fakeMsg,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        )

        const caption = `🗑️ *${type === 'image' ? 'Foto' : type === 'video' ? 'Video' : 'Media'} yang dihapus*\n${getText(waMsg)}`.trim()

        if (type === 'image') {
            await sock.sendMessage(m.chat, { image: buffer, caption }, { quoted: m })
        } else if (type === 'video') {
            await sock.sendMessage(m.chat, { video: buffer, caption }, { quoted: m })
        } else if (type === 'sticker') {
            await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m })
        } else if (type === 'audio') {
            await sock.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: m })
        }

        await m.react('✅')

    } catch (error) {
        console.error('[antide] error:', error.message || error)
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}

export { pluginConfig as config, handler }