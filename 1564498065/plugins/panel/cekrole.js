import config from '../../config.js'
import { getAllRolesForUser, cleanNumber, VALID_SERVERS } from '../../src/lib/ichigo-roles-cpanel.js'
import { isPartner as isPartnerDb, getPartnerList } from '../../src/lib/ichigo-premium-db.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'cekrole',
    alias: ['checkrole', 'myrole', 'roleinfo'],
    category: 'panel',
    description: 'Cek role user di semua server panel',
    usage: '.cekrole [@mention/nomor]',
    example: '.cekrole atau .cekrole @user',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const PANEL_ROLE_EMOJI = {
    owner: '👑',
    ceo: '💼',
    reseller: '🏪'
}

const PANEL_ROLE_LABEL = {
    owner: 'Owner',
    ceo: 'CEO',
    reseller: 'Reseller'
}

function getName(jid, sock, pushName, fallback) {
    return sock.contacts?.[jid]?.name
        || sock.contacts?.[jid]?.notify
        || pushName
        || fallback
        || jid.replace(/@.*$/, '')
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatSisa(ts) {
    if (!ts || ts === -1) return '∞'
    const sisa = ts - Date.now()
    if (sisa <= 0) return '⚠️ Expired'
    const d = Math.floor(sisa / (1000 * 60 * 60 * 24))
    const h = Math.floor((sisa % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (d > 0) return `${d} hari ${h} jam`
    const min = Math.floor((sisa % (1000 * 60 * 60)) / (1000 * 60))
    if (h > 0) return `${h} jam ${min} menit`
    return `${min} menit`
}

function getMentionPushName(m, mentionedJid) {
    const ctx = m.message?.extendedTextMessage?.contextInfo
        || m.message?.imageMessage?.contextInfo
        || m.message?.videoMessage?.contextInfo
        || m.message?.stickerMessage?.contextInfo
        || null
    if (!ctx) return null
    if (ctx.participant === mentionedJid || ctx.remoteJid === mentionedJid) {
        return ctx.pushName || m.quoted?.pushName || null
    }
    return null
}

async function handler(m, { sock }) {
    try {
        let targetJid = null
        let targetName = null

        const mentioned = m.mentionedJid?.[0] || null
        const quoted = m.quoted?.sender || null

        if (mentioned) {
            targetJid = mentioned
            const mentionPushName = getMentionPushName(m, mentioned)
            targetName = getName(mentioned, sock, mentionPushName, null)
        } else if (quoted) {
            targetJid = quoted
            targetName = getName(quoted, sock, m.quoted?.pushName, null)
        } else {
            targetJid = m.sender
            targetName = getName(m.sender, sock, m.pushName, null)
        }

        if (!targetName || targetName === targetJid.replace(/@.*$/, '')) {
            const num = targetJid.replace(/@.*$/, '')
            targetName = `+${num}`
        }

        const number = cleanNumber(targetJid)
        const panelRoles = getAllRolesForUser(targetJid)

        const isOwnerBot   = config.isOwner?.(targetJid) || false
        const isPremiumBot = config.isPremium?.(targetJid) || false
        const isPartnerBot = isPartnerDb(number)

        const db = getDatabase()
        const userData = db?.getUser(targetJid) || {}
        const isVipActive = db?.isVipActive
            ? db.isVipActive(targetJid)
            : (userData.isVip && (!userData.vipExpired || userData.vipExpired === -1 || Date.now() < userData.vipExpired))

        let partnerExpired = null
        if (isPartnerBot) {
            const list = getPartnerList()
            const found = list.find(p => {
                const num = (p.number || p.jid || p.id || '').replace(/[^0-9]/g, '')
                return num === number || number.endsWith(num) || num.endsWith(number)
            })
            const expTs = found?.expiredAt
                ? new Date(found.expiredAt).getTime()
                : (found?.expired || 0)
            partnerExpired = expTs
        }

        const bullet = '-'
        const corner = '▣'
        const top    = `╭─${corner}「 🔍 *ᴄᴇᴋ ʀᴏʟᴇ* 」`
        const div    = `├────────────────────${corner}`
        const bottom = `╰────────────────────${corner}`
        const r = (label, val) => `│${bullet} *${label}* : ${val}`

        let txt = `${top}\n`
        txt += `${r('User',  targetName)}\n`
        txt += `${r('Nomor', `\`${number}\``)}\n`
        txt += `${div}\n`

        txt += `│🤖 *Role Bot:*\n`
        const hasAnyBotRole = isOwnerBot || isPremiumBot || isPartnerBot || isVipActive
        if (!hasAnyBotRole) {
            txt += `│${bullet} Tidak ada role bot\n`
        } else {
            if (isOwnerBot) {
                txt += `│${bullet} 👑 *Owner Bot*\n`
            }
            if (isVipActive) {
                txt += `│${bullet} 💎 *VIP*\n`
                if (userData.vipExpired && userData.vipExpired !== -1) {
                    txt += `│  ↳ Expired: ${formatDate(userData.vipExpired)}\n`
                    txt += `│  ↳ Sisa: ${formatSisa(userData.vipExpired)}\n`
                } else {
                    txt += `│  ↳ Expired: Permanen\n`
                }
            }
            if (isPremiumBot) {
                txt += `│${bullet} 🌟 *Premium*\n`
            }
            if (isPartnerBot && partnerExpired) {
                const remaining = Math.ceil((partnerExpired - Date.now()) / (1000 * 60 * 60 * 24))
                txt += `│${bullet} 🤝 *Partner*\n`
                txt += `│  ↳ Expired: ${formatDate(partnerExpired)}\n`
                txt += `│  ↳ Sisa: ${remaining > 0 ? `${remaining} hari` : '⚠️ Expired'}\n`
            }
        }

        txt += `${div}\n`

        txt += `│🖥️ *Role Panel:*\n`
        if (panelRoles.length === 0) {
            txt += `│${bullet} Tidak ada role panel\n`
        } else {
            for (const { server, role } of panelRoles) {
                const emoji = PANEL_ROLE_EMOJI[role] || '❓'
                const label = PANEL_ROLE_LABEL[role] || role
                txt += `│${bullet} *${server.toUpperCase()}* — ${emoji} ${label}\n`
            }
        }

        txt += `${div}\n`
        txt += `${r('Total Panel', `${panelRoles.length}/${VALID_SERVERS.length} server`)}\n`
        txt += `${bottom}\n`
        txt += `> Ketik *${m.prefix}mypanel* untuk lihat detail panel`

        return m.reply(txt)

    } catch (err) {
        console.error('[cekrole error]', err?.message || err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }