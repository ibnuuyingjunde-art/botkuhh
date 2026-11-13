import config from '../../config.js'
import { getParticipantJid } from '../../src/lib/ichigo-lid.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'kudeta',
    alias: ['coup', 'rebut', 'demoteall','rodok'],
    category: 'group',
    description: 'Menurunkan seluruh admin grup menjadi member, kecuali owner bot dan bot itu sendiri. Bisa dipakai lintas grup, TAPI hanya untuk grup dimana pemanggil sendiri berstatus admin.',
    usage: '.kudeta',
    example: '.kudeta',
    isOwner: false,
    isPremium: false,
    isGroup: false, 
    isPrivate: false,
    cooldown: 15,
    energi: 0,
    isEnabled: true,
    isAdmin: false, 
    isBotAdmin: false,
}

function isParticipantAdmin(participants, jidOrNumber) {
    return participants.some(p => {
        const pJid = getParticipantJid(p) || p.id
        return pJid === jidOrNumber && (p.admin === 'admin' || p.admin === 'superadmin')
    })
}

async function handler(m, { sock }) {
    const args = m.args || []

    if (args[0] === '--confirm' && args[1]) {
        const targetGroupId = args[1]

        try {
            await m.react('🕕')

            const groupMeta = await sock.groupMetadata(targetGroupId)
            const participants = groupMeta.participants || []

            const botNumber = sock.user?.id?.split(':')[0] + '@s.whatsapp.net'
            const senderJid = getParticipantJid({ id: m.sender }) || m.sender

            const callerIsAdminHere = isParticipantAdmin(participants, senderJid)
            if (!callerIsAdminHere) {
                await m.reply(
                    `⛔ *ᴅɪᴛᴏʟᴀᴋ*\n\n` +
                    `> Kamu bukan admin di grup *${groupMeta.subject}*.\n` +
                    `> Kudeta hanya bisa dilakukan di grup dimana kamu sendiri admin.`
                )
                return
            }

            const botIsAdminHere = isParticipantAdmin(participants, botNumber)
            if (!botIsAdminHere) {
                await m.reply(
                    `⛔ *ɢᴀɢᴀʟ*\n\n` +
                    `> Bot bukan admin di grup *${groupMeta.subject}*, tidak bisa demote siapapun.`
                )
                return
            }

            const allAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')

            const targets = allAdmins.filter(p => {
                const pJid = getParticipantJid(p)
                const pNumber = (p.id || '').replace(/:.*$/, '').replace(/@.*$/, '') + '@s.whatsapp.net'

                const isBot = pJid === botNumber || p.id === botNumber || pNumber === botNumber
                const isBotOwner = config.isOwner ? config.isOwner(pJid || p.id) : false
                const isCallerSelf = pJid === senderJid || p.id === senderJid

                return !isBot && !isBotOwner && !isCallerSelf
            })

            if (targets.length === 0) {
                await m.reply(
                    `ℹ️ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴛᴀʀɢᴇᴛ*\n\n` +
                    `> Tidak ada admin yang bisa diturunkan di grup *${groupMeta.subject}*.`
                )
                return
            }

            const idsToUpdate = targets.map(p => p.id)

            await sock.groupParticipantsUpdate(targetGroupId, idsToUpdate, 'demote')

            await m.react('👑')
        } catch (error) {
            await m.reply(
                `❌ *ᴇʀʀᴏʀ*\n\n> Gagal melakukan kudeta.\n> _${error.message}_`
            )
        }
        return
    }

    if (m.isGroup) {
        m.args = ['--confirm', m.chat]
        return handler(m, { sock: arguments[1].sock })
    }

    try {
        const senderJid = getParticipantJid({ id: m.sender }) || m.sender

        global.isFetchingGroups = true
        const groups = await sock.groupFetchAllParticipating()
        global.isFetchingGroups = false

        const eligibleGroups = Object.entries(groups).filter(([id, meta]) => {
            const participants = meta.participants || []
            return isParticipantAdmin(participants, senderJid)
        })

        if (eligibleGroups.length === 0) {
            await m.reply(
                `⚠️ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ɢʀᴜᴘ*\n\n` +
                `> Kamu tidak berstatus admin di grup manapun yang ada bot-nya.`
            )
            return
        }

        const groupRows = eligibleGroups.map(([id, meta]) => ({
            title: meta.subject || 'Unknown Group',
            description: `${(meta.participants || []).length} anggota`,
            id: `${m.prefix}kudeta --confirm ${id}`,
        }))

        const prefix = m.prefix || '.'

        await sock.sendMessage(m.chat, {
            text:
                `📋 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ᴋᴜᴅᴇᴛᴀ*\n\n` +
                `> Hanya menampilkan grup dimana kamu adalah admin.\n` +
                `> Total: *${eligibleGroups.length}* grup\n\n` +
                `_Pilih grup dari daftar di bawah:_`,
            footer: 'Ichigo Strife MD',
            interactiveButtons: [
                {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: '🏠 Pilih Grup',
                        sections: [{ title: 'Grup Kamu (Admin)', rows: groupRows }],
                    }),
                },
                {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: '❌ Batal',
                        id: `${prefix}cancelkudeta`,
                    }),
                },
            ],
        })
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n> Gagal mengambil daftar grup.\n> _${error.message}_`
        )
    }
}

export { pluginConfig as config, handler }