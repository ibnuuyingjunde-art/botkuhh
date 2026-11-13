import config from '../../config.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'

const pluginConfig = {
  name: 'payment',
  alias: ['pay'],
  category: 'owner',
  description: 'Menampilkan informasi metode pembayaran',
  usage: '.payment',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

function buildPaymentText(paymentCfg, customText, botName, ownerName) {
  const methods = (paymentCfg.methods || []).filter(item => item?.number)
  const banks = (paymentCfg.banks || []).filter(item => item?.number)

  if (customText) {
    return customText
      .replace(/\{botname\}/gi, botName)
      .replace(/\{owner\}/gi, ownerName)
      .replace(/\{methods\}/gi, methods.map(item => `▸ *${item.name}*: ${item.number} (${item.holder || item.name})`).join('\n'))
      .replace(/\{banks\}/gi, banks.map(item => `▸ *${item.name}*: ${item.number} (${item.holder || item.name})`).join('\n'))
      .replace(/\{qris\}/gi, paymentCfg.qrisUrl ? 'Tersedia' : 'Belum diatur')
  }

  const line = '━━━━━━━━━━━━━━━━━━━━'
  let text = `╭━━━〔 ✦ *PAYMENT CENTER* ✦ 〕━━━╮\n`
  text += `│  *${botName}*  ·  Informasi Pembayaran\n`
  text += `╰${line}╯\n\n`
  text += `Silakan pilih metode pembayaran yang tersedia.\n\n`

  if (methods.length) {
    text += `╭─〔 ◈ *E-WALLET* 〕\n`
    for (const item of methods) {
      const icon = /dana/i.test(item.name) ? '◆' : /gopay/i.test(item.name) ? '●' : '◇'
      text += `│ ${icon} *${item.name}*\n`
      text += `│   Nomor : \`${item.number}\`\n`
      text += `│   Nama  : *${item.holder || item.name}*\n`
    }
    text += `╰${'─'.repeat(25)}\n\n`
  }

  if (banks.length) {
    text += `╭─〔 ▣ *TRANSFER BANK* 〕\n`
    for (const item of banks) {
      text += `│ ▣ *${item.name}*\n`
      text += `│   Rekening : \`${item.number}\`\n`
      text += `│   Nama     : *${item.holder || item.name}*\n`
    }
    text += `╰${'─'.repeat(25)}\n\n`
  }

  if (paymentCfg.qrisUrl) {
    text += `╭─〔 ▦ *PEMBAYARAN QRIS* 〕\n`
    text += `│ Scan kode QRIS yang terlampir.\n`
    text += `╰${'─'.repeat(25)}\n\n`
  }

  text += `✧ *PENTING*\n`
  text += `• Pastikan nama penerima sesuai sebelum transfer.\n`
  text += `• Setelah pembayaran, kirim bukti transfer ke owner.\n`
  text += `• Jangan mengedit atau memotong bukti pembayaran.\n\n`
  text += `${line}\n`
  text += `Terima kasih telah menggunakan *${botName}*.\n`
  text += `╰─ ✦ *${ownerName}* ✦`

  return text
}

async function handler(m, { sock }) {
  const db = getDatabase()
  const paymentCfg = config.payment || {}
  const customText = db.setting('customPaymentText') || paymentCfg.customText || ''
  const botName = config.bot?.name || "lyniX's MD"
  const ownerName = paymentCfg.nama || config.owner?.name || 'Owner'
  const text = buildPaymentText(paymentCfg, customText, botName, ownerName)

  if (paymentCfg.qrisUrl) {
    try {
      await sock.sendMessage(m.chat, {
        image: { url: paymentCfg.qrisUrl },
        caption: text
      }, { quoted: m })
      return
    } catch (error) {
      console.error('[PAYMENT] Gagal mengirim QRIS:', error?.message || error)
    }
  }

  await sock.sendMessage(m.chat, { text }, { quoted: m })
}

export { pluginConfig as config, handler }
