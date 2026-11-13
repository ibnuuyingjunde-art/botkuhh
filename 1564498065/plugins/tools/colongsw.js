const pluginConfig = {
    name: 'colongsw',
    alias: ['ambilsw'],
    category: 'tools',
    description: 'Ambil SW khusus yang mention grup',
    usage: '.colongsw (reply sw mention)',
    example: '.colongsw',
    cooldown: 5,
    isEnabled: true
}

async function handler(m, { sock }) {

    if (!m.quoted) {
        return m.reply(
`Reply status yang dimention group ya`)
    }

    try {

        let q = m.quoted

        let msg = q.message || {}

        if (msg?.ephemeralMessage) msg = msg.ephemeralMessage.message
        if (msg?.viewOnceMessage) msg = msg.viewOnceMessage.message
        if (msg?.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message

        const context =
            msg?.extendedTextMessage?.contextInfo ||
            msg?.imageMessage?.contextInfo ||
            msg?.videoMessage?.contextInfo ||
            {}

        const mentioned = context?.mentionedJid || []

        const isStatus = q.key?.remoteJid === 'status@broadcast'
        const isMentionGroup = mentioned.includes(m.chat)

        if (!isStatus || !isMentionGroup) {
            return m.reply(
`ini bukan sw yang mau dicolong`)
        }

        m.react('💖')

        const type = Object.keys(msg)[0]

        if (type === 'imageMessage') {

            const media = await q.download()

            await sock.sendMessage(m.chat, {
                image: media,
                caption:
`swnya berhasil diambil`
            }, { quoted: m })

            return
        }

        if (type === 'videoMessage') {

            const media = await q.download()

            await sock.sendMessage(m.chat, {
                video: media,
                caption:
`ini yaa sw nya jangan disebar`
            }, { quoted: m })

            return
        }

        const text =
            q.text ||
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            'Tidak ada isi'

        await m.reply(
`Nih Sw nya "${text}"`)

    } catch (e) {

        console.log(e)

        m.reply(
`Maaf lagi error`)
    }
}

export { pluginConfig as config, handler };