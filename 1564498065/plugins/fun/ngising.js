import { decodeJid } from '../../src/lib/ichigo-serialize.js'

const pluginConfig = {
    name: 'ngising',
    alias: ['ngeden', 'boker', 'pup'],
    category: 'fun',
    description: 'Cek status ngising receh kamu hari ini',
    usage: '.ngising',
    example: '.ngising',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

const lokasiList = [
    'WC umum dekat warung',
    'Toilet kantor lantai 3',
    'WC sekolah yang baunya legendaris',
    'Kamar mandi mertua',
    'Toilet pesawat',
    'Semak-semak pinggir sawah',
    'WC mall yang antrenya panjang',
    'Toilet duduk kos-kosan',
    'Toilet jongkok rest area'
]

const suaraList = [
    'BRRRTTT... plop plop 💦',
    'Hening... tapi mematikan 🤫',
    'DUARRR! kayak halilintar ⚡',
    'Cuma kentut doang, gagal total 😭',
    'Konser orkestra 1 babak penuh 🎶',
    'Sunyi sekali, sampai jangkrik bunyi 🦗',
    'Bunyi kayak motor mogok 🏍️'
]

const komentarList = [
    'Lega rasanya kayak abis ujian 😌',
    'Hidup terasa lebih ringan~ 🍃',
    'WC butuh direnovasi setelah ini 🚽',
    'Tisu sekampung gak akan cukup 😂',
    'Selamat, misi selesai dengan damai 🎉',
    'Tetangga sebelah ikut merasakan getarannya 🌍',
    'Petugas kebersihan langsung resign 🏃'
]

async function handler(m, { sock }) {
    const senderJid = decodeJid(m.sender || '')
    const number = senderJid ? senderJid.replace(/@.+/g, '') : ''

    const durasiMenit = Math.floor(Math.random() * 20) + 1
    const durasiDetik = Math.floor(Math.random() * 60)
    const tingkatBau = Math.floor(Math.random() * 101)
    const lokasi = getRandom(lokasiList)
    const sfx = getRandom(suaraList)
    const komentar = getRandom(komentarList)

    const statusBau =
        tingkatBau >= 80 ? '☣️ Bahaya' :
        tingkatBau >= 50 ? '⚠️ Lumayan' :
        '🌸 Aman'

    const caption =
        `💩 *sᴛᴀᴛᴜs ɴɢɪsɪɴɢ*\n` +
        `◈━━━━━━━━━━━━━◈\n\n` +
        `👤 @${number}\n` +
        `📍 Lokasi : ${lokasi}\n` +
        `⏱️ Durasi  : ${durasiMenit} menit ${durasiDetik} detik\n` +
        `💨 Bau     : ${tingkatBau}% (${statusBau})\n` +
        `🔊 Efek    : ${sfx}\n\n` +
        `💬 _${komentar}_\n\n` +
        `◈━━━━━━━━━━━━━◈`

    m.react('💩')
    await sock.sendMessage(m.chat, {
        text: caption,
        mentions: senderJid ? [senderJid] : []
    }, { quoted: m })
}

export { pluginConfig as config, handler }