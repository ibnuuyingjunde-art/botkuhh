import {
    startJadibot,
    isJadibotActive,
    isJadibotPending,
    countActiveJadibotsByOwner,
    countAllActiveJadibots,
} from '../../src/lib/ichigo-jadibot-manager.js'
import { hasJadibotAccess, getJadibotAccessInfo, isJadibotExempt } from '../../src/lib/ichigo-jadibot-access.js'
import { isJadibotPaymentEnforced } from '../../src/lib/ichigo-jadibot-plans.js'
import config from '../../config.js'

const pluginConfig = {
    name: 'jadibot',
    alias: ['jadibotqr', 'becomebot', 'bot'],
    category: 'main',
    description: 'Jadikan nomor kamu menjadi bot (Pairing Code / QR / nomor lain)',
    usage: '.jadibot / .jadibot qr / .jadibot 628xxxxxxxxxx',
    example: '.jadibot 6281524385851',
    isOwner: false,
    isPremium: false, // gating akses sekarang ditangani manual (lihat hasJadibotAccess) supaya user yang sudah bayar tetap bisa lewat
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const sender = m.sender
    if (!sender) return m.reply('❌ Gagal mengidentifikasi nomor kamu')

    if (isJadibotPaymentEnforced() && !hasJadibotAccess(sender)) {
        const info = getJadibotAccessInfo(sender)
        const expiredNote = info.expiresAt
            ? `\n> ⚠️ Akses kamu sebelumnya sudah habis pada ${new Date(info.expiresAt).toLocaleString('id-ID')}`
            : ''
        return m.reply(
            `🔒 *ᴊᴀᴅɪʙᴏᴛ ʙᴇʀʙᴀʏᴀʀ*\n\n` +
            `> Fitur jadibot sekarang perlu langganan aktif.${expiredNote}\n` +
            `> Owner, partner, dan premium tetap gratis.\n\n` +
            `Ketik \`${m.prefix}jadibotbuy\` untuk lihat paket & bayar via QRIS.`
        )
    }

    const rawArg = (m.args?.[0] || '').trim()
    const useQR = rawArg.toLowerCase() === 'qr'

    let targetJid = sender
    let targetNumber = sender.replace(/@.+/g, '')

    if (rawArg && !useQR) {
        const cleaned = rawArg.replace(/[^0-9]/g, '')
        if (!/^\d{8,15}$/.test(cleaned)) {
            return m.reply(
                `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
                `> Format: \`${m.prefix}jadibot 628xxxxxxxxxx\`\n` +
                `> Gunakan kode negara (misal 62) tanpa tanda \`+\`, spasi, atau strip`
            )
        }

        const botNumber = sock?.user?.id?.replace(/@.+/g, '').replace(/:.+/, '')
        if (botNumber && cleaned === botNumber) {
            return m.reply('❌ Nomor itu adalah nomor bot utama, tidak bisa dijadikan jadibot')
        }

        targetNumber = cleaned
        targetJid = cleaned + '@s.whatsapp.net'
    }

    if (isJadibotActive(targetJid)) {
        return m.reply(
            `⚠️ *ᴊᴀᴅɪʙᴏᴛ ꜱᴜᴅᴀʜ ᴀᴋᴛɪꜰ*\n\n` +
            `> Nomor *${targetNumber}* sudah menjadi bot\n` +
            `> Ketik \`${m.prefix}stopjadibot\` untuk menghentikan`
        )
    }

    if (isJadibotPending(targetJid)) {
        return m.reply(
            `⏳ *ᴊᴀᴅɪʙᴏᴛ sᴇᴅᴀɴɢ ᴅɪᴘʀᴏsᴇs*\n\n` +
            `> Koneksi untuk nomor *${targetNumber}* masih berjalan (nunggu scan QR/pairing)\n` +
            `> Ketik \`${m.prefix}stopjadibot\` dulu kalau mau membatalkan`
        )
    }

    // bug fix: sebelumnya tidak ada batas jumlah jadibot sama sekali — satu
    // akses berbayar bisa dipakai untuk menjalankan jadibot di banyak nomor
    // sekaligus (lewat `.jadibot 628xxx`), dan tidak ada batas total di
    // seluruh sistem juga. Sekarang ditegakkan lewat config.jadibotMaxPerOwner
    // (per nomor pembeli, owner/partner/premium dikecualikan) dan
    // config.jadibotMaxTotal (berlaku untuk semua orang termasuk owner, demi
    // melindungi resource server).
    const maxTotal = Number(config.jadibotMaxTotal) || Infinity
    if (countAllActiveJadibots() >= maxTotal) {
        return m.reply(
            `❌ *ʙᴀᴛᴀs ᴊᴀᴅɪʙᴏᴛ ᴛᴇʀᴄᴀᴘᴀɪ*\n\n` +
            `> Jumlah jadibot aktif di seluruh sistem sudah mencapai batas maksimal (${maxTotal}).\n` +
            `> Coba lagi nanti atau hubungi owner.`
        )
    }

    if (!isJadibotExempt(sender)) {
        const maxPerOwner = Number(config.jadibotMaxPerOwner) || Infinity
        if (countActiveJadibotsByOwner(sender) >= maxPerOwner) {
            return m.reply(
                `❌ *ʙᴀᴛᴀs ᴊᴀᴅɪʙᴏᴛ ᴋᴀᴍᴜ ᴛᴇʀᴄᴀᴘᴀɪ*\n\n` +
                `> Kamu sudah punya *${maxPerOwner}* jadibot aktif/berjalan.\n` +
                `> Ketik \`${m.prefix}stopjadibot\` di nomor jadibot yang lama dulu kalau mau pindah, atau \`${m.prefix}listjadibotaktif\` untuk lihat daftarnya (owner).`
            )
        }
    }

    if (useQR) {
        await m.reply(
            `🤖 *ᴊᴀᴅɪʙᴏᴛ — Qʀ ᴍᴏᴅᴇ*\n\n` +
            `> Menyiapkan koneksi...\n` +
            `> Scan QR Code yang akan dikirim`
        )
    } else if (targetJid !== sender) {
        await m.reply(
            `🤖 *ᴊᴀᴅɪʙᴏᴛ — ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n\n` +
            `> Nomor tujuan: *${targetNumber}*\n` +
            `> Menyiapkan koneksi...\n` +
            `> Masukkan kode pairing di WhatsApp nomor *${targetNumber}* (Perangkat Tertaut)`
        )
    } else {
        await m.reply(
            `🤖 *ᴊᴀᴅɪʙᴏᴛ — ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ*\n\n` +
            `> Menyiapkan koneksi...`
        )
    }

    try {
        await startJadibot(sock, m, targetJid, !useQR)
    } catch (e) {
        const msg = e.message || ''
        const isBadMac = msg.includes('Bad MAC') || msg.includes('bad mac') || msg.includes('decrypt')

        if (isBadMac) {
            return m.reply(
                `❌ *ʙᴀᴅ ᴍᴀᴄ ᴅᴇᴛᴇᴄᴛᴇᴅ*\n\n` +
                `> Session corrupt telah direset otomatis\n` +
                `> Coba jalankan ulang \`${m.prefix}jadibot\` sekarang`
            )
        }

        await m.reply(
            `❌ *ᴊᴀᴅɪʙᴏᴛ ɢᴀɢᴀʟ*\n\n` +
            `> ${msg || 'Terjadi kesalahan'}\n\n` +
            `Coba lagi dalam beberapa menit.`
        )
    }
}

export { pluginConfig as config, handler }