
import { autoClearSession, readStore, writeStore, getAutoClearStats } from '../../src/lib/ichigo-auto-clearsession.js'

const pluginConfig = {
    name: 'autoclearsession',
    alias: ['acs'],
    category: 'owner',
    description: 'Atur fitur auto clear session saat bad MAC terdeteksi',
    usage: '.autoclearsession <on/off/setgroup/status/test>',
    example: '.autoclearsession on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, args }) {
    const sub = (args[0] || '').toLowerCase()

    switch (sub) {
        case 'on': {
            const store = readStore()
            store.enabled = true
            writeStore(store)
            await m.react('✅')
            return sock.sendMessage(m.chat, {
                text: `✅ *ᴅᴇᴛᴇᴋsɪ ʙᴀᴅ ᴍᴀᴄ ᴅɪᴀᴋᴛɪғᴋᴀɴ*\n\n> Bot akan mencatat & melapor kalau bad MAC/frozen terdeteksi.\n> Auto-clear OTOMATIS tetap nonaktif by design (pernah jadi penyebab loop "Closing Session" berulang). Kalau memang perlu reset, pakai *.clearsession* atau *.acs test confirm* manual.`
            }, { quoted: m })
        }

        case 'off': {
            const store = readStore()
            store.enabled = false
            writeStore(store)
            await m.react('✅')
            return sock.sendMessage(m.chat, {
                text: `🚫 *ᴅᴇᴛᴇᴋsɪ ʙᴀᴅ ᴍᴀᴄ ᴅɪɴᴏɴᴀᴋᴛɪғᴋᴀɴ*\n\n> Bot tidak akan mencatat/melapor bad MAC/frozen sama sekali.`
            }, { quoted: m })
        }

        case 'setgroup': {
            const store = readStore()
            store.notifGroup = m.chat
            writeStore(store)
            await m.react('✅')
            return sock.sendMessage(m.chat, {
                text: `📍 *ɴᴏᴛɪғ ɢʀᴏᴜᴘ ᴅɪsᴇᴛ*\n\n> Notifikasi auto clear session bakal dikirim ke chat ini.\n> ID: \`${m.chat}\``
            }, { quoted: m })
        }

        case 'test': {
            if ((args[1] || '').toLowerCase() !== 'confirm') {
                return sock.sendMessage(m.chat, {
                    text:
                        `⚠️ *ᴋᴏɴғɪʀᴍᴀsɪ ᴅɪᴘᴇʀʟᴜᴋᴀɴ*\n\n` +
                        `Perintah ini bakal beneran hapus session dan restart bot.\n\n` +
                        `> Ketik *.autoclearsession test confirm* kalau yakin.`
                }, { quoted: m })
            }
            await m.react('🕐')
            await sock.sendMessage(m.chat, {
                text: `🧪 *ᴍᴇɴᴊᴀʟᴀɴᴋᴀɴ ᴛᴇsᴛ ᴀᴜᴛᴏ ᴄʟᴇᴀʀ sᴇssɪᴏɴ...*\n\n> Bot akan restart sebentar lagi.`
            }, { quoted: m })
            return autoClearSession(sock, 'manual test')
        }

        case 'status':
        default: {
            const stats = getAutoClearStats()
            return sock.sendMessage(m.chat, {
                text:
                    `⚙️ *sᴛᴀᴛᴜs ʙᴀᴅ ᴍᴀᴄ ᴅᴇᴛᴇᴄᴛɪᴏɴ*\n\n` +
                    `┃ 🔘 Logging      : *${stats.enabled ? '✅ Aktif' : '🚫 Nonaktif'}*\n` +
                    `┃ 🔒 Auto-clear   : *🚫 Disabled by design* (cegah loop)\n` +
                    `┃ 📍 Notif Group  : *${stats.notifGroup}*\n` +
                    `┃ 🔄 Total Clear  : *${stats.totalAutoClear}x*\n` +
                    `┃ 🕐 Last Clear   : *${stats.lastClearAt}*\n` +
                    `┃ 💬 Last Pesan   : *${stats.lastMessageAt}*\n` +
                    `┃ ⚠️ Closing Count: *${stats.closingCount}x*\n` +
                    `┃ 🔓 Closed Sesi  : *${stats.closedSessionCount}x* (5 menit terakhir, normal/self-heal)\n\n` +
                    `> .acs on | off | setgroup | test confirm`
            }, { quoted: m })
        }
    }
}

export { pluginConfig as config, handler }