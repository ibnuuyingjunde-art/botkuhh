import fs from 'fs'
import path from 'path'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'quote',
    alias: ['q', 'quotly'],
    category: 'tools',
    description: 'Membuat quote card dari pesan yang di-reply (ala Quotly)',
    usage: '.quote (reply pesan teks)',
    example: '.quote',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let currentLine = words[0] || ''

    for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const testLine = `${currentLine} ${word}`
        const testWidth = ctx.measureText(testLine).width

        if (testWidth > maxWidth) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine = testLine
        }
    }
    lines.push(currentLine)
    return lines
}

async function drawRoundedAvatar(ctx, image, x, y, size) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, x, y, size, size)
    ctx.restore()
}

async function generateQuoteCard({ name, text, avatarBuffer, isDark = true }) {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')

    const width = 800
    const padding = 50
    const avatarSize = 90
    const fontSize = 32
    const nameFontSize = 24

    const measureCanvas = createCanvas(1, 1)
    const measureCtx = measureCanvas.getContext('2d')
    measureCtx.font = `${fontSize}px Sans`

    const textMaxWidth = width - padding * 2 - avatarSize - 30
    const lines = wrapText(measureCtx, text, textMaxWidth)
    const lineHeight = fontSize * 1.4
    const textBlockHeight = lines.length * lineHeight

    const contentHeight = Math.max(avatarSize, textBlockHeight + nameFontSize + 20)
    const height = contentHeight + padding * 2

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = isDark ? '#1a1a2e' : '#f5f5f5'
    ctx.fillRect(0, 0, width, height)

    const avatarX = padding
    const avatarY = padding

    if (avatarBuffer) {
        try {
            const avatarImg = await loadImage(avatarBuffer)
            await drawRoundedAvatar(ctx, avatarImg, avatarX, avatarY, avatarSize)
        } catch (e) {
            ctx.fillStyle = '#555'
            ctx.beginPath()
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
            ctx.fill()
        }
    } else {
        ctx.fillStyle = '#555'
        ctx.beginPath()
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
        ctx.fill()
    }

    const textX = avatarX + avatarSize + 30
    let textY = avatarY + fontSize

    ctx.fillStyle = isDark ? '#ffffff' : '#000000'
    ctx.font = `${fontSize}px Sans`
    ctx.textBaseline = 'top'

    for (const line of lines) {
        ctx.fillText(line, textX, textY)
        textY += lineHeight
    }

    ctx.fillStyle = isDark ? '#aaaaaa' : '#666666'
    ctx.font = `italic ${nameFontSize}px Sans`
    ctx.fillText(`— ${name}`, textX, textY + 10)

    return canvas.toBuffer('image/png')
}

function extractQuotedText(quoted) {
    if (!quoted) return ''

    const candidates = [
        quoted.text,
        quoted.body,
        quoted.caption,
        quoted.content,
        quoted.message?.conversation,
        quoted.message?.extendedTextMessage?.text,
        quoted.message?.imageMessage?.caption,
        quoted.message?.videoMessage?.caption,
        quoted?.msg?.conversation,
        quoted?.msg?.caption
    ]

    for (const c of candidates) {
        if (typeof c === 'string' && c.trim().length > 0) {
            return c.trim()
        }
    }

    return ''
}

async function handler(m, { sock }) {
    if (!m.quoted) {
        await m.reply(
            `💬 *ǫᴜᴏᴛᴇ ᴍᴀᴋᴇʀ*\n\n` +
            `Reply pesan teks seseorang dengan caption:\n` +
            `\`${m.prefix}quote\`\n\n` +
            `Bot akan membuat quote card berisi nama + foto profil + pesan tersebut, dikirim sebagai sticker.`
        )
        return
    }

    const quotedText = extractQuotedText(m.quoted)
    if (!quotedText) {
        await m.reply('❌ Pesan yang di-reply tidak mengandung teks!\n\n💡 Coba `.inspect` di pesan yang sama buat cek struktur field-nya kalau ini masih muncul terus.')
        return
    }

    await m.react('🕕')

    try {
        const senderName = m.quoted.pushName || m.quoted.sender?.split('@')[0] || 'Unknown'

        let avatarBuffer = null
        try {
            const senderJid = m.quoted.sender || m.quoted.participant
            if (senderJid && sock.profilePictureUrl) {
                const ppUrl = await sock.profilePictureUrl(senderJid, 'image')
                const res = await fetch(ppUrl)
                avatarBuffer = Buffer.from(await res.arrayBuffer())
            }
        } catch (e) {
            avatarBuffer = null
        }

        const cardBuffer = await generateQuoteCard({
            name: senderName,
            text: quotedText,
            avatarBuffer
        })

        await sock.sendImageAsSticker(m.chat, cardBuffer, m, {
            packname: 'Quote',
            author: senderName
        })

        await m.react('✅')

    } catch (error) {
        console.error('[quote] error:', error.message || error)
        m.reply(te(m.prefix, m.command, m.pushName))
        await m.react('❌')
    }
}

export { pluginConfig as config, handler }