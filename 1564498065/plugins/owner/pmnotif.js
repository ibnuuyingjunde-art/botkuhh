

import { readStore, writeStore } from '../../src/lib/ichigo-pm-notif.js';

const pluginConfig = {
    name: 'pmnotif',
    alias: ['notifpm'],
    category: 'owner',
    description: 'Toggle notif pesan pribadi ke owner & grup',
    usage: '.pmnotif <on/off/setgroup/status>',
    example: '.pmnotif on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock, args }) {
    const sub = (args[0] || '').toLowerCase();

    switch (sub) {
        case 'on': {
            const store = readStore();
            store.enabled = true;
            writeStore(store);
            await m.react('✅');
            return sock.sendMessage(m.chat, {
                text: `✅ *ɴᴏᴛɪғ ᴘᴍ ᴅɪᴀᴋᴛɪғᴋᴀɴ*\n\n> Setiap ada yang PM bot, notif akan dikirim ke owner & grup.`
            }, { quoted: m });
        }

        case 'off': {
            const store = readStore();
            store.enabled = false;
            writeStore(store);
            await m.react('✅');
            return sock.sendMessage(m.chat, {
                text: `🚫 *ɴᴏᴛɪғ ᴘᴍ ᴅɪɴᴏɴᴀᴋᴛɪғᴋᴀɴ*\n\n> Notif PM tidak akan dikirim.`
            }, { quoted: m });
        }

        case 'setgroup': {
            const store = readStore();
            if (!m.isGroup) {
                return sock.sendMessage(m.chat, {
                    text: `❌ Kirim perintah ini di dalam grup yang ingin dijadikan tujuan notif!`
                }, { quoted: m });
            }
            store.notifGroup = m.chat;
            writeStore(store);
            await m.react('✅');
            return sock.sendMessage(m.chat, {
                text: `📍 *ɢʀᴜᴘ ɴᴏᴛɪғ ᴅɪsᴇᴛ*\n\n> Notif PM akan dikirim ke grup ini.\n> ID: \`${m.chat}\``
            }, { quoted: m });
        }

        case 'status':
        default: {
            const store = readStore();
            const notifGroup = store.notifGroup || '(dari config)';
            return sock.sendMessage(m.chat, {
                text:
                    `⚙️ *sᴛᴀᴛᴜs ɴᴏᴛɪғ ᴘᴍ*\n\n` +
                    `┃ 🔘 Status      : *${store.enabled ? '✅ Aktif' : '🚫 Nonaktif'}*\n` +
                    `┃ 📍 Notif Group : *${notifGroup}*\n` +
                    `┃ ⏱️ Cooldown    : *2 menit per pengirim*\n\n` +
                    `> .pmnotif on | off | setgroup | status`
            }, { quoted: m });
        }
    }
}

export { pluginConfig as config, handler };