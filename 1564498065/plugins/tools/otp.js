import axios from 'axios'
import config from '../../config.js'

const pluginConfig = {
    name: 'otp',
    alias: ['nokos', 'sewanom'],
    category: 'tools',
    description: 'Sewa nomor virtual untuk menerima OTP',
    usage: '.otp <service> [country]',
    example: '.otp wa\n.otp tg id\n.otp balance\n.otp cancel <id>\n.otp done <id>',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
}

const BASE_URL = 'https://nokos.co.id/api'
const API_KEY = config.nokos?.apiKey || '63d2ca3389df3f74d90b8ce8ffe7c82ddafcc7861eb4b5b82b31a746a0fc3a97'

const HEADERS = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

const COUNTRY_MAP = {
    id: 6, indonesia: 6,
    ru: 0, russia: 0,
    ua: 1, ukraine: 1,
    us: 12, usa: 12,
    uk: 16, england: 16,
    my: 7, malaysia: 7,
    ph: 4, philippines: 4,
    vn: 10, vietnam: 10,
    th: 52, thailand: 52,
    in: 22, india: 22,
    cn: 44, china: 44,
    br: 73, brazil: 73,
}

async function pollForOtp(activationId, onProgress) {
    const maxAttempts = 40  
    let attempt = 0
    while (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 30000)) 
        attempt++

        try {
            const res = await axios.get(`${BASE_URL}/?action=getStatus`, {
                headers: HEADERS,
                params: { id: activationId },
                timeout: 10000
            })

            const data = res.data
            
            if (data?.data?.startsWith?.('STATUS_OK:')) {
                const code = data.data.split(':')[1]
                return { success: true, code }
            }
            if (data?.data === 'STATUS_CANCEL') {
                return { success: false, reason: 'cancel' }
            }

            if (onProgress) onProgress(attempt, maxAttempts)
        } catch {
            
        }
    }
    return { success: false, reason: 'timeout' }
}

const activeSessions = new Map()

async function handler(m, { sock }) {
    const subcmd = m.args[0]?.toLowerCase()

    if (!subcmd || subcmd === 'balance' || subcmd === 'saldo') {
        try {
            const res = await axios.get(`${BASE_URL}/?action=getBalance`, {
                headers: HEADERS,
                timeout: 10000
            })
            const balance = res.data?.data?.balance ?? '?'
            return m.reply(
`╭──「 *NOKOS OTP* 」
│
│ 💰 Saldo   : Rp ${Number(balance).toLocaleString('id-ID')}
│
│ 📌 *Cara Pakai:*
│ .otp <service> [negara]
│
│ *Service populer:*
│ wa, tg, fb, ig, tt, sh
│ gg, li, tw, am, go
│
│ *Negara (opsional):*
│ id (default), my, ph, vn
│ th, in, us, uk, cn, br
│
╰────────────────`
            )
        } catch (e) {
            return m.reply(`❌ Gagal cek saldo: ${e.message}`)
        }
    }

    if (subcmd === 'cancel' || subcmd === 'batal') {
        const id = m.args[1] || activeSessions.get(m.sender)?.id
        if (!id) return m.reply('❌ Masukkan ID aktivasi\nContoh: .otp cancel 123456')

        try {
            await axios.get(`${BASE_URL}/?action=setStatus`, {
                headers: HEADERS,
                params: { id, status: 8 }, 
                timeout: 10000
            })
            activeSessions.delete(m.sender)
            m.react('✅')
            return m.reply(`✅ *Aktivasi #${id} dibatalkan*\nSaldo akan dikembalikan otomatis.`)
        } catch (e) {
            return m.reply(`❌ Gagal cancel: ${e.message}`)
        }
    }

    if (subcmd === 'done' || subcmd === 'selesai') {
        const id = m.args[1] || activeSessions.get(m.sender)?.id
        if (!id) return m.reply('❌ Masukkan ID aktivasi\nContoh: .otp done 123456')

        try {
            await axios.get(`${BASE_URL}/?action=setStatus`, {
                headers: HEADERS,
                params: { id, status: 6 }, 
                timeout: 10000
            })
            activeSessions.delete(m.sender)
            m.react('✅')
            return m.reply(`✅ *Aktivasi #${id} dikonfirmasi selesai*`)
        } catch (e) {
            return m.reply(`❌ Gagal konfirmasi: ${e.message}`)
        }
    }

    if (subcmd === 'harga' || subcmd === 'price' || subcmd === 'list') {
        const country = COUNTRY_MAP[m.args[1]?.toLowerCase()] ?? 6
        try {
            const res = await axios.get(`${BASE_URL}/?action=getPrices`, {
                headers: HEADERS,
                params: { country },
                timeout: 15000
            })
            const prices = res.data?.data || res.data || {}
            const entries = Object.entries(prices).slice(0, 15)
            if (!entries.length) return m.reply('❌ Tidak ada data harga')

            const rows = entries
                .map(([svc, info]) => `│ ${svc.padEnd(6)} Rp ${String(info.cost ?? info.price ?? '?').padStart(5)} (stok: ${info.count ?? '?'})`)
                .join('\n')

            return m.reply(
`╭──「 *HARGA OTP* 」
│
${rows}
│
│ Gunakan: .otp <service> [negara]
╰────────────────`
            )
        } catch (e) {
            return m.reply(`❌ Gagal ambil harga: ${e.message}`)
        }
    }

    const service = subcmd
    const countryInput = m.args[1]?.toLowerCase() ?? 'id'
    const country = COUNTRY_MAP[countryInput] ?? 6

    if (activeSessions.has(m.sender)) {
        const s = activeSessions.get(m.sender)
        return m.reply(
`⚠️ *Kamu masih punya sesi aktif!*

│ 🆔 ID     : ${s.id}
│ 📱 Nomor  : ${s.phone}
│ 📌 Service: ${s.service}

Ketik *.otp cancel* untuk batalkan
atau *.otp done* untuk selesaikan`
        )
    }

    m.react('⏳')

    try {
        
        const orderRes = await axios.get(`${BASE_URL}/?action=getNumber`, {
            headers: HEADERS,
            params: { service, country },
            timeout: 15000
        })

        const orderData = orderRes.data
        if (!orderData?.success && !orderData?.phone) {
            m.react('❌')
            const msg = orderData?.message || orderData?.error || 'Stok habis atau service tidak tersedia'
            return m.reply(`❌ *Order gagal*\n\n> ${msg}`)
        }

        const phone = orderData?.data?.phone || orderData?.phone
        const activationId = orderData?.data?.id || orderData?.activation_id || orderData?.id
        const cost = orderData?.data?.cost || orderData?.cost || '?'

        if (!phone || !activationId) {
            m.react('❌')
            return m.reply('❌ Respons API tidak valid, coba lagi.')
        }

        activeSessions.set(m.sender, { id: activationId, phone, service })

        m.react('📱')

        await m.reply(
`╭──「 *NOMOR SIAP* 」
│
│ 📱 Nomor  : +${phone}
│ 🆔 ID     : ${activationId}
│ 📌 Service: ${service.toUpperCase()}
│ 💰 Biaya  : Rp ${Number(cost).toLocaleString('id-ID')}
│
│ ⏳ Menunggu OTP...
│ (maks 20 menit)
│
│ Batalkan: .otp cancel
╰────────────────`
        )

        pollForOtp(activationId, async (attempt, max) => {
            
            if (attempt % 10 === 0) {
                const menit = (attempt * 30) / 60
                await m.reply(`⏳ Masih menunggu OTP... (${menit} menit / 20 menit)`)
            }
        }).then(async result => {
            activeSessions.delete(m.sender)

            if (result.success) {
                m.react('✅')
                await m.reply(
`╭──「 *OTP MASUK!* 」
│
│ 🔑 *${result.code}*
│
│ 📌 Service : ${service.toUpperCase()}
│ 🆔 ID      : ${activationId}
│
│ Konfirmasi: .otp done
╰────────────────`
                )
            } else if (result.reason === 'timeout') {
                m.react('⏰')
                await m.reply(
`⏰ *OTP timeout (20 menit)*

│ 🆔 ID: ${activationId}
│ Saldo dikembalikan otomatis.`
                )
            } else {
                await m.reply(`❌ Aktivasi #${activationId} dibatalkan.`)
            }
        }).catch(() => {})

    } catch (error) {
        m.react('❌')
        activeSessions.delete(m.sender)

        const err =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message

        await m.reply(
`╭──「 *ORDER GAGAL* 」
│
│ ❌ ${err}
│
╰────────────────`
        )
    }
}

export { pluginConfig as config, handler }