import te from '../../src/lib/ichigo-error.js'
import { getSocket } from '../../src/connection.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'

const pluginConfig = {
    name: 'restart',
    alias: ['reset', 'reboot', 'restartbot'],
    category: 'owner',
    description: 'Restart bot process',
    usage: '.restart',
    example: '.restart',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

const uptime = () => {
    const s = Math.floor(process.uptime())
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}j ${m}m ${sec}d`
}

const memUsage = () => {
    const mb = process.memoryUsage().rss / 1024 / 1024
    return `${mb.toFixed(1)} MB`
}

const waktu = () => new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Makassar'
})

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function handler(m, { sock }) {
    try {
        await m.react('🔄')

        const statusMsg = await sock.sendMessage(m.chat, {
            text:
                `🔄 *ʀᴇsᴛᴀʀᴛɪɴɢ...*\n\n` +
                `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
                `┃ 🕐 Waktu  : ${waktu()}\n` +
                `┃ ⏱️ Uptime : ${uptime()}\n` +
                `┃ 🧠 Memori : ${memUsage()}\n` +
                `┃ 🔢 PID    : ${process.pid}\n` +
                `┃ 💻 OS     : ${process.platform}\n` +
                `╰┈┈┈┈┈┈┈┈⬡\n\n` +
                `> ⏳ Mempersiapkan restart...`
        }, { quoted: m })

        const key = statusMsg.key
        const edit = (txt) => sock.sendMessage(m.chat, { text: txt, edit: key })

        await sleep(800)
        await edit(
            `🔄 *ʀᴇsᴛᴀʀᴛɪɴɢ...*\n\n` +
            `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
            `┃ 🕐 Waktu  : ${waktu()}\n` +
            `┃ ⏱️ Uptime : ${uptime()}\n` +
            `┃ 🧠 Memori : ${memUsage()}\n` +
            `┃ 🔢 PID    : ${process.pid}\n` +
            `┃ 💻 OS     : ${process.platform}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> 💾 Menyimpan database...`
        )

        try {
            const db = getDatabase()
            db.save()
        } catch {}

        await sleep(800)
        await edit(
            `🔄 *ʀᴇsᴛᴀʀᴛɪɴɢ...*\n\n` +
            `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
            `┃ 🕐 Waktu  : ${waktu()}\n` +
            `┃ ⏱️ Uptime : ${uptime()}\n` +
            `┃ 🧠 Memori : ${memUsage()}\n` +
            `┃ 🔢 PID    : ${process.pid}\n` +
            `┃ 💻 OS     : ${process.platform}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> 🔌 Menutup koneksi WA...`
        )

        await sleep(800)
        await edit(
            `🔄 *ʀᴇsᴛᴀʀᴛɪɴɢ...*\n\n` +
            `╭┈┈⬡「 📊 *ɪɴꜰᴏ* 」\n` +
            `┃ 🕐 Waktu  : ${waktu()}\n` +
            `┃ ⏱️ Uptime : ${uptime()}\n` +
            `┃ 🧠 Memori : ${memUsage()}\n` +
            `┃ 🔢 PID    : ${process.pid}\n` +
            `┃ 💻 OS     : ${process.platform}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `> ✅ Pterodactyl akan menyalakan ulang bot...`
        )

        console.log(`[Restart] Triggered by: ${m.sender}`)
        console.log(`[Restart] PID: ${process.pid} | Uptime: ${uptime()}`)

        try {
            const currentSock = getSocket()
            if (currentSock) currentSock.end()
        } catch {}

        await sleep(500)
        process.exit(0)

    } catch (error) {
        console.error('[Restart] Error:', error)
        await m.react('☢️')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }