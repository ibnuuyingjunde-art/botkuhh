const pluginConfig = {
    name: 'latex',
    alias: ['math', 'rumus'],
    category: 'tools',
    description: 'Render ekspresi matematika (LaTeX) jadi gambar rumus, dikirim sebagai media message standar',
    usage: '.latex <ekspresi latex>',
    example: '.latex x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function renderLatexToBuffer(latex) {
    const encoded = encodeURIComponent(latex)
    const url = `https://latex.codecogs.com/png.image?\\dpi{300}\\bg{white}\\huge ${encoded}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Render gagal (HTTP ${res.status}) — cek sintaks LaTeX`)

    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer
}

async function handler(m, { sock }) {
    const latex = m.text?.trim()

    if (!latex) {
        return m.reply(
            `🧮 *Latex Renderer*\n\n` +
            `> Render rumus matematika langsung jadi gambar di chat\n\n` +
            `*Cara pakai:*\n` +
            `> \`${m.prefix}latex <ekspresi>\`\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}latex x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\`\n` +
            `> \`${m.prefix}latex \\int_0^\\infty e^{-x^2}dx\`\n` +
            `> \`${m.prefix}latex \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\``
        )
    }

    await m.react('🕕')

    try {
        const buffer = await renderLatexToBuffer(latex)

        await sock.sendMessage(
            m.chat,
            {
                image: buffer,
                caption: `📐 *Ichigo Latex*\n\n\`${latex}\`\n\n_Rendered via ichigo-baileys_`
            },
            { quoted: m }
        )

        await m.react('✅')
    } catch (e) {
        await m.react('❌')
        await m.reply(
            `❌ Gagal render rumus.\n\n` +
            `┃ Alasan: ${e.message}\n\n` +
            `> Cek lagi sintaks LaTeX-nya, mungkin ada kurung/backslash yang kurang.`
        )
    }
}

export { pluginConfig as config, handler }