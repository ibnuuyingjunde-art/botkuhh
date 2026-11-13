import config from "../../config.js"
import fetch from "node-fetch"

const pluginConfig = {
  name: "donasi",
  alias: ["donate", "donation", "support", "saweria", "trakteer"],
  category: "main",
  description: "Informasi dukungan dan metode pembayaran",
  usage: ".donasi",
  example: ".donasi",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
}

async function handler(m, { sock }) {
  const botName = config.bot?.name || "lyniX's MD"
  const donasiConfig = config.donasi || {}
  const payments = (donasiConfig.payment || []).filter(item => item?.number)
  const links = donasiConfig.links || []
  const qrisUrl = donasiConfig.qris || ""
  const benefits = donasiConfig.benefits || [
    "Mendukung pengembangan bot",
    "Menjaga server tetap stabil",
    "Membantu menghadirkan fitur baru",
  ]

  const divider = "━━━━━━━━━━━━━━━━━━━━"
  let text = `╭━━〔 ✦ *SUPPORT CENTER* ✦ 〕━━╮\n`
  text += `│ *${botName}*\n`
  text += `╰${divider}╯\n\n`
  text += `Terima kasih atas dukungan yang kamu berikan.\n\n`

  if (payments.length) {
    text += `╭─〔 ◈ *METODE PEMBAYARAN* 〕\n`
    for (const item of payments) {
      const icon = /dana/i.test(item.name) ? "◆" : /gopay/i.test(item.name) ? "●" : /seabank/i.test(item.name) ? "▣" : "◇"
      text += `│ ${icon} *${item.name}*\n`
      text += `│   Nomor : \`${item.number}\`\n`
      text += `│   Nama  : *${item.holder || item.name}*\n`
    }
    text += `╰${"─".repeat(25)}\n\n`
  }

  if (links.length) {
    text += `╭─〔 ↗ *TAUTAN DUKUNGAN* 〕\n`
    for (const item of links) {
      if (item?.url) text += `│ ◇ *${item.name || "Support"}*: ${item.url}\n`
    }
    text += `╰${"─".repeat(25)}\n\n`
  }

  text += `╭─〔 ✧ *DUKUNGANMU MEMBANTU* 〕\n`
  for (const benefit of benefits) text += `│ ✓ ${benefit}\n`
  text += `╰${"─".repeat(25)}\n\n`
  text += `▸ Pastikan nama penerima sudah benar.\n`
  text += `▸ Setelah transfer, kirim bukti pembayaran ke owner.\n`
  text += `\n${divider}\n*Terima kasih banyak atas support-nya!*`

  if (qrisUrl) {
    try {
      const response = await fetch(qrisUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const qrisBuffer = Buffer.from(await response.arrayBuffer())
      await sock.sendMessage(m.chat, { image: qrisBuffer, caption: text }, { quoted: m })
      return
    } catch (error) {
      console.error("[DONASI] QRIS gagal dimuat:", error?.message || error)
    }
  }

  await sock.sendMessage(m.chat, { text }, { quoted: m })
}

export { pluginConfig as config, handler }
