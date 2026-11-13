import axios from 'axios'

const ANILIST = 'https://graphql.anilist.co'

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const pluginConfig = {
    name: 'jadwalanime',
    alias: ['animeschedule', 'animetayang', 'jadwalanime'],
    category: 'anime',
    description: 'Lihat jadwal tayang anime minggu ini',
    usage: '.jadwalanime [hari]',
    example: '.jadwalanime senin',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    isAdmin: false,
    isBotAdmin: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function getJadwal() {
    
    const now = Math.floor(Date.now() / 1000)
    const weekLater = now + (7 * 24 * 60 * 60)

    const query = `{
        Page(page: 1, perPage: 50) {
            airingSchedules(
                airingAt_greater: ${now - (24 * 60 * 60)}
                airingAt_lesser: ${weekLater}
                sort: TIME
            ) {
                airingAt
                episode
                media {
                    title {
                        romaji
                        english
                        native
                    }
                    coverImage { medium }
                    genres
                    status
                    episodes
                    duration
                    averageScore
                    siteUrl
                }
            }
        }
    }`

    const { data } = await axios.post(ANILIST, { query }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
    })

    return data?.data?.Page?.airingSchedules || []
}

async function handler(m, { sock }) {
    const args = m.text?.trim().toLowerCase() || ''

    const hariMap = {
        'minggu': 0, 'ahad': 0,
        'senin': 1,
        'selasa': 2,
        'rabu': 3,
        'kamis': 4,
        'jumat': 5, "jum'at": 5,
        'sabtu': 6
    }

    let targetHari = null
    for (const [key, val] of Object.entries(hariMap)) {
        if (args.includes(key)) {
            targetHari = val
            break
        }
    }

    await m.reply('⏳ Mengambil jadwal anime...')

    try {
        const schedules = await getJadwal()

        if (schedules.length === 0) {
            return m.reply('❌ Tidak ada data jadwal anime saat ini.')
        }

        const grouped = {}
        for (let i = 0; i < 7; i++) grouped[i] = []

        for (const item of schedules) {
            const date = new Date((item.airingAt + (8 * 3600)) * 1000) 
            const day = date.getUTCDay()
            const jam = date.getUTCHours().toString().padStart(2, '0')
            const menit = date.getUTCMinutes().toString().padStart(2, '0')
            const title = item.media.title.romaji || item.media.title.english || 'Unknown'
            const ep = item.episode
            const score = item.media.averageScore ? `⭐${item.media.averageScore}` : ''
            const genre = item.media.genres?.slice(0, 2).join(', ') || ''

            grouped[day].push({ title, ep, jam, menit, score, genre })
        }

        if (targetHari !== null) {
            const list = grouped[targetHari]
            if (list.length === 0) {
                return m.reply(`📅 Tidak ada anime yang tayang hari *${HARI[targetHari]}* minggu ini.`)
            }

            let msg = `🎌 *Jadwal Anime - ${HARI[targetHari]}*\n`
            msg += `📡 Source: AniList\n`
            msg += `━━━━━━━━━━━━━━━\n\n`

            list.forEach((a, i) => {
                msg += `${i + 1}. *${a.title}*\n`
                msg += `   🕐 ${a.jam}:${a.menit} WITA  |  📺 Ep ${a.ep}\n`
                if (a.genre) msg += `   🏷️ ${a.genre}\n`
                if (a.score) msg += `   ${a.score}\n`
                msg += '\n'
            })

            return m.reply(msg.trim())
        }

        const hariIni = new Date((Date.now() / 1000 + (8 * 3600)) * 1000).getUTCDay()
        let msg = `🎌 *Jadwal Anime Minggu Ini*\n`
        msg += `📡 Source: AniList\n`
        msg += `━━━━━━━━━━━━━━━\n\n`

        for (let offset = 0; offset < 7; offset++) {
            const day = (hariIni + offset) % 7
            const list = grouped[day]
            if (list.length === 0) continue

            msg += `📅 *${HARI[day]}*${offset === 0 ? ' (Hari ini)' : ''}\n`
            list.slice(0, 8).forEach(a => {
                msg += `  • ${a.title} - Ep ${a.ep} (${a.jam}:${a.menit})\n`
            })
            if (list.length > 8) msg += `  _...dan ${list.length - 8} anime lainnya_\n`
            msg += '\n'
        }

        msg += `_Ketik *${m.prefix}jadwalanime <hari>* untuk detail per hari_\n`
        msg += `_Contoh: *${m.prefix}jadwalanime senin*_`

        if (msg.length > 4000) {
            const lines = msg.split('\n')
            let part = ''
            for (const line of lines) {
                if ((part + line + '\n').length > 3800) {
                    await m.reply(part.trim())
                    part = line + '\n'
                } else {
                    part += line + '\n'
                }
            }
            if (part.trim()) await m.reply(part.trim())
        } else {
            await m.reply(msg.trim())
        }

    } catch (e) {
        return m.reply(`❌ Gagal mengambil jadwal.\n\n_${e.message}_`)
    }
}

export { pluginConfig as config, handler }