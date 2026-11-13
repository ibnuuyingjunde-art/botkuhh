import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import { getUserStatusLabel } from '../../src/lib/ichigo-level.js'

const pluginConfig = {
  name: 'cekprem',
  alias: ['cekpremium', 'preminfo', 'cekvip'],
  category: 'cek',
  description: 'Cek detail status premium/VIP user',
  usage: '.cekprem [@user]',
  example: '.cekprem',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatCountdown(ms) {
  if (ms <= 0) return '⚠️ Sudah expired'
  const totalSec = Math.floor(ms / 1000)
  const hari = Math.floor(totalSec / 86400)
  const jam = Math.floor((totalSec % 86400) / 3600)
  const menit = Math.floor((totalSec % 3600) / 60)
  const detik = totalSec % 60
  const parts = []
  if (hari > 0) parts.push(`${hari} hari`)
  if (jam > 0) parts.push(`${jam} jam`)
  if (menit > 0) parts.push(`${menit} menit`)
  if (detik > 0) parts.push(`${detik} detik`)
  return parts.join(' ') || '< 1 detik'
}

function isVipActive(user) {
  if (!user?.isVip) return false
  if (!user.vipExpired || user.vipExpired === -1) return true
  return Date.now() < user.vipExpired
}

async function handler(m, { sock }) {
  const db = getDatabase()
  const now = Date.now()

  let targetNumber = ''
  if (m.quoted) {
    targetNumber = m.quoted.sender?.replace(/[^0-9]/g, '') || ''
  } else if (m.mentionedJid?.length) {
    targetNumber = m.mentionedJid[0]?.replace(/[^0-9]/g, '') || ''
  } else if (m.args?.length) {
    targetNumber = m.args[0].replace(/[^0-9]/g, '')
  } else {
    targetNumber = m.sender?.replace(/[^0-9]/g, '') || ''
  }

  if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

  const jid = targetNumber + '@s.whatsapp.net'
  const user = db.getUser(jid) || db.getUser(targetNumber) || {}
  if (!db.data.premium) db.data.premium = []

  const isOwnerUser   = config.isOwner ? config.isOwner(targetNumber) : false
  const isPremiumUser = config.isPremium ? config.isPremium(targetNumber) : false
  const vipActive     = isVipActive(user)

  const premData = db.data.premium.find(p =>
    typeof p === 'string' ? p === targetNumber : p.id === targetNumber
  )
  const isDbPremValid = user?.isPremium === true &&
    !(user?.premiumExpired && now > user.premiumExpired)
  const isDbSewabotValid = user?.isSewabot === true &&
    !(user?.sewabotExpired && now > user.sewabotExpired)

  const { label: statusLabel, emoji: statusEmoji } = getUserStatusLabel({
    isOwner: isOwnerUser,
    isVip: vipActive,
    isPremium: isPremiumUser || isDbPremValid,
  })

  const corner = '\u25A3'
  const top    = `\u256D\u2500${corner}\u300C ${statusEmoji} *STATUS AKUN* \u300D`
  const div    = `\u251C${'─'.repeat(20)}${corner}`
  const bottom = `\u2570${'─'.repeat(20)}${corner}`
  const r = (emoji, label, val) => `\u2502- ${emoji} *${label}* : ${val}`

  const hasAnyStatus = isOwnerUser || vipActive || isPremiumUser || isDbPremValid || isDbSewabotValid || premData

  if (!hasAnyStatus) {
    let txt = `${top}\n`
    txt += `${r('👤', 'User', `@${targetNumber}`)}\n`
    txt += `${r('🔓', 'Role', '✦ Member')}\n`
    txt += `${div}\n`
    txt += `${r('❌', 'Premium', 'Belum aktif')}\n`
    txt += `${r('❌', 'VIP', 'Belum aktif')}\n`
    txt += `${div}\n`
    txt += `\u2502- 💡 Upgrade ke *Premium/VIP* untuk\n`
    txt += `\u2502  nikmati semua fitur tanpa batas!\n`
    txt += `${bottom}`

    try {
      await sock.relayMessage(m.chat, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: txt },
              footer: { text: '🛒 Ketik .bayar untuk lihat paket premium' },
              header: { hasMediaAttachment: false },
              nativeFlowMessage: {
                buttons: [{
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: '🛍️ Beli Premium Sekarang',
                    url: `https://wa.me/${sock.user?.id?.split(':')[0]}?text=.bayar`,
                    merchant_url: ''
                  })
                }]
              }
            }
          }
        }
      }, {})
    } catch {
      await sock.sendMessage(m.chat, { text: txt }, { quoted: m })
    }
    return
  }

  let txt = `${top}\n`
  txt += `${r('👤', 'User', `@${targetNumber}`)}\n`
  txt += `${r(statusEmoji, 'Role', statusLabel)}\n`
  txt += `${div}\n`

  if (isOwnerUser) {
    txt += `${r('♾️', 'Status', 'Owner — Permanent')}\n`
  }

  if (vipActive) {
    txt += `${r('💎', 'VIP', 'Aktif')}\n`
    if (!user.vipExpired || user.vipExpired === -1) {
      txt += `${r('♾️', 'VIP Expired', 'Permanent')}\n`
    } else {
      const sisaVip = user.vipExpired - now
      txt += `${r('📅', 'VIP Expired', formatDate(user.vipExpired))}\n`
      txt += `${r('⏳', 'VIP Sisa', formatCountdown(sisaVip))}\n`
    }
    txt += `${div}\n`
  }

  if (isDbSewabotValid) {
    txt += `${r('🤖', 'Sewabot', 'Aktif')}\n`
    if (user.sewabotExpired) {
      const sisa = user.sewabotExpired - now
      txt += `${r('📅', 'Expired', formatDate(user.sewabotExpired))}\n`
      txt += `${r('⏳', 'Sisa', formatCountdown(sisa))}\n`
    }
    txt += `${div}\n`
  }

  if (premData && !isOwnerUser) {
    if (typeof premData === 'string' || !premData?.expired) {
      txt += `${r('💎', 'Premium', 'Aktif — Permanent')}\n`
    } else {
      const sisaMs = premData.expired - now
      const totalDays = premData.addedAt
        ? Math.ceil((premData.expired - premData.addedAt) / 864e5)
        : '?'
      txt += `${r('💎', 'Premium', 'Aktif')}\n`
      if (premData.name) txt += `${r('📛', 'Nama', premData.name)}\n`
      txt += `${r('📅', 'Mulai', premData.addedAt ? formatDate(premData.addedAt) : 'Unknown')}\n`
      txt += `${r('📅', 'Expired', formatDate(premData.expired))}\n`
      txt += `${r('🗓️', 'Durasi', `${totalDays} hari`)}\n`
      txt += `${r('⏳', 'Sisa', formatCountdown(sisaMs))}\n`
    }
    txt += `${div}\n`
  } else if (isDbPremValid && !isOwnerUser && !premData) {
    
    if (user.premiumExpired) {
      const sisa = user.premiumExpired - now
      txt += `${r('💎', 'Premium', 'Aktif')}\n`
      txt += `${r('📅', 'Expired', formatDate(user.premiumExpired))}\n`
      txt += `${r('⏳', 'Sisa', formatCountdown(sisa))}\n`
    } else {
      txt += `${r('💎', 'Premium', 'Aktif — Permanent')}\n`
    }
    txt += `${div}\n`
  }

  if (user && Object.keys(user).length > 0) {
    const EXP_PER_LEVEL = 10000
    const realLevel = Math.min(Math.floor((user.exp || 0) / EXP_PER_LEVEL) + 1, 900001)
    const energiDisplay = isOwnerUser || vipActive || isPremiumUser || isDbPremValid
      ? '∞ Unlimited'
      : (user.energi === -1 ? '∞ Unlimited' : (user.energi ?? 0))
    txt += `${r('⚡', 'Energi', energiDisplay)}\n`
    txt += `${r('🪙', 'Koin', `${(user.koin ?? 0).toLocaleString('id-ID')}`)}\n`
    txt += `${r('💫', 'Exp', (user.exp ?? 0).toLocaleString('id-ID'))}\n`
    txt += `${r('⚔️', 'Level', realLevel)}\n`
  }

  txt += `${bottom}`

  await m.reply(txt, { mentions: [jid] })
}

export { pluginConfig as config, handler }