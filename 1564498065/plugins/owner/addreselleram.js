import { getDatabase } from '../../src/lib/ichigo-database.js'
import { isLid, lidToJid } from '../../src/lib/ichigo-lid.js'
import ms from 'ms'

const AM_COMMANDS = ['amprem', 'alightmotionprem', 'ampremium']

const pluginConfig = {
    name: 'addreselleram',
    alias: ['delreselleram', 'listreselleram', 'cekreselleram'],
    category: 'owner',
    description: 'Kelola reseller Alight Motion Premium (otomatis dapat akses command .amprem)',
    usage: '.addreselleram <nomor/@tag> [hari]\n.delreselleram <nomor/@tag>\n.listreselleram\n.cekreselleram <nomor/@tag>',
    example: '.addreselleram 6281234567890 30',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function cleanJid(jid) {
    if (!jid) return null
    if (isLid(jid)) jid = lidToJid(jid)
    return jid.includes('@') ? jid : jid + '@s.whatsapp.net'
}

function getNumber(jid) {
    const clean = cleanJid(jid)
    return clean ? clean.split('@')[0] : null
}

function toMentionJid(number) {
    const num = String(number || '').replace(/[^0-9]/g, '')
    return num ? `${num}@s.whatsapp.net` : null
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function extractTarget(m) {
    if (m.quoted?.sender) return getNumber(m.quoted.sender)
    if (m.mentionedJid?.length > 0) return getNumber(m.mentionedJid[0])
    const numArg = m.args?.find(a => /^\d{8,15}$/.test(a.replace(/[^0-9]/g, '')))
    return numArg ? numArg.replace(/[^0-9]/g, '') : null
}

function extractDays(m) {
    const dayArg = m.args?.find(a => /^\d{1,4}$/.test(a))
    return dayArg ? parseInt(dayArg) : 30
}

function grantAmAccess(db, jid, expiredTime) {
    const user = db.getUser(jid) || {}
    if (!Array.isArray(user.access)) user.access = []

    for (const cmdName of AM_COMMANDS) {
        const idx = user.access.findIndex(a => a.cmd === cmdName)
        if (idx !== -1) {
            user.access[idx].expired = expiredTime
        } else {
            user.access.push({ cmd: cmdName, expired: expiredTime })
        }
    }

    user.resellerAM = {
        active: true,
        addedAt: user.resellerAM?.addedAt || Date.now(),
        expired: expiredTime
    }

    db.setUser(jid, user)
    return user
}

function revokeAmAccess(db, jid) {
    const user = db.getUser(jid)
    if (!user) return false

    let changed = false
    if (Array.isArray(user.access)) {
        const before = user.access.length
        user.access = user.access.filter(a => !AM_COMMANDS.includes(a.cmd))
        if (user.access.length !== before) changed = true
    }
    if (user.resellerAM?.active) {
        user.resellerAM.active = false
        changed = true
    }
    if (changed) db.setUser(jid, user)
    return changed
}

function handler(m, { sock }) {
    const db = getDatabase()
    if (!db) return m.reply('❌ Database belum siap, coba lagi.')
    const cmd = m.command.toLowerCase()

    const isAdd = cmd === 'addreselleram'
    const isDel = cmd === 'delreselleram'
    const isList = cmd === 'listreselleram'
    const isCek = cmd === 'cekreselleram'

    if (isList) {
        const users = db.users || {}
        const now = Date.now()
        const resellers = Object.entries(users)
            .filter(([, u]) => u.resellerAM?.active && (u.resellerAM.expired === null || u.resellerAM.expired > now))

        if (resellers.length === 0) {
            return m.reply(`📋 *ᴅᴀꜰᴛᴀʀ ʀᴇsᴇʟʟᴇʀ ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ*\n\n> Belum ada reseller AM terdaftar.`)
        }

        let txt = `📋 *ᴅᴀꜰᴛᴀʀ ʀᴇsᴇʟʟᴇʀ ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ*\n\n`
        txt += `> Total: *${resellers.length}* reseller\n\n`
        const mentions = []
        resellers.forEach(([jid, u], i) => {
            const num = jid.split('@')[0]
            const expTxt = u.resellerAM.expired ? formatDate(u.resellerAM.expired) : 'Permanent'
            txt += `${i + 1}. @${num} — exp: ${expTxt}\n`
            mentions.push(toMentionJid(num))
        })
        return m.reply(txt, { mentions: mentions.filter(Boolean) })
    }

    const target = extractTarget(m)
    if (!target) {
        return m.reply(
            `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
            `> \`${m.prefix}${cmd} @user\`\n` +
            `> \`${m.prefix}${cmd} 628xxx\`\n` +
            `> Reply pesan user`
        )
    }
    const targetJid = toMentionJid(target)

    if (isAdd) {
        const days = extractDays(m)
        const now = Date.now()

        const existing = db.getUser(target)
        const currentExpired = existing?.resellerAM?.active ? (existing.resellerAM.expired || now) : now
        const baseTime = currentExpired > now ? currentExpired : now
        const newExpired = baseTime + (days * 24 * 60 * 60 * 1000)

        grantAmAccess(db, target, newExpired)

        const isExtend = existing?.resellerAM?.active
        m.react('✅')
        return m.reply(
            `✅ *ʀᴇsᴇʟʟᴇʀ ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ ${isExtend ? 'ᴅɪᴘᴇʀᴘᴀɴᴊᴀɴɢ' : 'ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ'}*\n\n` +
            `╭┈┈⬡「 📋 *ᴅᴇᴛᴀɪʟ* 」\n` +
            `┃ 📱 ɴᴏᴍᴏʀ: @${target}\n` +
            `┃ 🎬 ᴀᴋsᴇs: \`.amprem\` (send/verif/cek/reset)\n` +
            `┃ ⏱️ ᴅᴜʀᴀsɪ: *${days} hari*\n` +
            `┃ 📅 ᴇxᴘɪʀᴇᴅ: ${formatDate(newExpired)}\n` +
            `╰┈┈⬡`,
            { mentions: [targetJid] }
        )
    }

    if (isDel) {
        const revoked = revokeAmAccess(db, target)
        if (!revoked) {
            return m.reply(`❌ @${target} bukan reseller AM.`, { mentions: [targetJid] })
        }
        m.react('✅')
        return m.reply(`✅ Reseller AM @${target} berhasil dihapus (akses \`.amprem\` dicabut).`, { mentions: [targetJid] })
    }

    if (isCek) {
        const user = db.getUser(target)
        const info = user?.resellerAM
        const now = Date.now()
        const isActive = info?.active && (info.expired === null || info.expired > now)

        if (!isActive) {
            return m.reply(`❌ @${target} bukan reseller AM.`, { mentions: [targetJid] })
        }

        const remaining = info.expired ? Math.ceil((info.expired - now) / (1000 * 60 * 60 * 24)) : null
        return m.reply(
            `🎬 *ᴄᴇᴋ ʀᴇsᴇʟʟᴇʀ ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ*\n\n` +
            `> Nomor: @${target}\n` +
            `> Status: ✅ Aktif\n` +
            `> Expired: ${info.expired ? formatDate(info.expired) : 'Permanent'}\n` +
            `> Sisa: ${remaining !== null ? remaining + ' hari' : '♾️ Permanent'}`,
            { mentions: [targetJid] }
        )
    }
}

export { pluginConfig as config, handler }