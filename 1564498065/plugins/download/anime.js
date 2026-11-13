import { default as axiosAnime } from 'axios'
import { load as cheerioLoad } from '../../src/lib/ichigo-cheerio-lazy.js'

const BASE = 'https://kusonime.com'
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9',
    'Referer': BASE
}

const cache = {}
const cacheKey   = (m) => `${m.sender?.replace(/@.+$/, '')}::${m.chat?.replace(/@.+$/, '')}`
const cacheSet   = (m, data) => {
    const k = cacheKey(m)
    clearTimeout(cache[k]?.t)
    cache[k] = { ...cache[k], ...data, t: setTimeout(() => delete cache[k], 180_000) }
}
const cacheClear = (m) => {
    clearTimeout(cache[cacheKey(m)]?.t)
    delete cache[cacheKey(m)]
}

export const config = {
    name: 'anime',
    alias: ['nonton', 'animedl'],
    category: 'download',
    description: 'Cari dan download anime dari Kusonime secara interaktif',
    usage: '.anime <judul>',
    example: '.anime naruto',
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

const ID = {
    pick:    (i)    => `.anime __pick:${i}:0__`,
    episode: (b, e) => `.anime __episode:${b}:${e}__`,
    cancel:  ()     => `.anime __cancel:0:0__`,
    parse:   (s) => {
        const r = String(s || '').match(/__(\w+):(\d+):(\d+)__/)
        return r ? { action: r[1], bi: +r[2], ei: +r[3] } : null
    }
}

async function searchAnime(keyword) {
    const { data } = await axiosAnime.get(`${BASE}/?s=${encodeURIComponent(keyword)}`, {
        headers: HEADERS, timeout: 15000
    })
    const $ = cheerioLoad(data)
    const results = []
    $('.kover').each((i, el) => {
        if (i >= 10) return false
        const a     = $(el).find('.content h2 a').first()
        const title = a.text().trim()
        const url   = a.attr('href') || ''
        const genre = $(el).find('.fa-tag').parent().text().replace('Genre', '').trim() || '-'
        const thumb = $(el).find('img').attr('src')
            || $(el).find('img').attr('data-src')
            || $(el).find('img').attr('data-lazy-src')
            || ''
        if (title && url) results.push({ title, url, genre, thumb })
    })
    return results
}

async function getDetail(animeUrl) {
    const { data } = await axiosAnime.get(animeUrl, { headers: HEADERS, timeout: 15000 })
    const $ = cheerioLoad(data)

    const title   = $('h1.jdlz').text().trim()
    const thumb   = $('.fotoanime img').attr('src')
        || $('.fotoanime img').attr('data-src')
        || $('.infoanime img').attr('src')
        || $('img.attachment-post-thumbnail').attr('src')
        || ''
    const info    = $('.info')
    const genre   = info.find('a[href*="/genres/"]').map((i, el) => $(el).text()).get().join(', ') || '-'
    const status  = info.find('b:contains("Status")').parent().text().replace('Status :', '').trim() || '-'
    const episode = info.find('b:contains("Total Episode")').parent().text().replace('Total Episode :', '').trim() || '-'
    const score   = info.find('b:contains("Score")').parent().text().replace('Score :', '').trim() || '-'

    const downloads = []

    $('.smokeddlrh').each((i, el) => {
        const batchTitle = $(el).prevAll('.smokettlrh').first().text().trim()
            || $(el).prev('h3,h4').text().trim()
            || `Batch ${i + 1}`

        const episodes = []
        let curEpisode = null

        $(el).children().each((j, child) => {
            const cls = $(child).attr('class') || ''
            if (cls.includes('smokettlrh')) {
                if (curEpisode && Object.keys(curEpisode.resolutions).length) {
                    episodes.push(curEpisode)
                }
                curEpisode = { episode: $(child).text().trim(), resolutions: {} }
            } else if (cls.includes('smokeurlrh') && curEpisode) {
                $(child).find('a').each((k, a) => {
                    const host     = $(a).text().trim()
                    const href     = $(a).attr('href') || ''
                    const resMatch = host.match(/(\d{3,4}p)/i)
                    const resKey   = resMatch ? resMatch[1].toUpperCase() : '720p'
                    if (!curEpisode.resolutions[resKey]) curEpisode.resolutions[resKey] = []
                    curEpisode.resolutions[resKey].push({
                        host: host.replace(/\s*\d{3,4}p\s*/i, '').trim() || host,
                        href
                    })
                })
            }
        })

        if (curEpisode && Object.keys(curEpisode.resolutions).length) episodes.push(curEpisode)
        if (episodes.length) downloads.push({ batch: batchTitle, episodes })
    })

    if (!downloads.length) {
        const episodes = []
        let curEpisode = null

        $('.smokettlrh, .smokeurlrh').each((i, el) => {
            const cls = $(el).attr('class') || ''
            if (cls.includes('smokettlrh')) {
                if (curEpisode && Object.keys(curEpisode.resolutions).length) episodes.push(curEpisode)
                curEpisode = { episode: $(el).text().trim(), resolutions: {} }
            } else if (cls.includes('smokeurlrh') && curEpisode) {
                $(el).find('a').each((j, a) => {
                    const host     = $(a).text().trim()
                    const href     = $(a).attr('href') || ''
                    const resMatch = host.match(/(\d{3,4}p)/i)
                    const resKey   = resMatch ? resMatch[1].toUpperCase() : '720p'
                    if (!curEpisode.resolutions[resKey]) curEpisode.resolutions[resKey] = []
                    curEpisode.resolutions[resKey].push({
                        host: host.replace(/\s*\d{3,4}p\s*/i, '').trim() || host,
                        href
                    })
                })
            }
        })

        if (curEpisode && Object.keys(curEpisode.resolutions).length) episodes.push(curEpisode)
        if (episodes.length) downloads.push({ batch: title, episodes })
    }

    return { title, thumb, genre, status, episode, score, downloads }
}

async function sendListButton(sock, m, { body, footer, title, sections }) {
    const buttons = [{
        name: 'single_select',
        buttonParamsJson: JSON.stringify({ title, sections })
    }]
    try {
        await sock.sendButton(m.chat, null, body, m, {
            footer,
            buttons,
            contextInfo: { mentionedJid: [m.sender], isForwarded: true, forwardingScore: 9 }
        })
    } catch (e) {
        console.error('[Anime] sendListButton error:', e.message)
        throw e
    }
}

async function showAnimeList(m, sock, results, keyword) {
    cacheSet(m, { results })

    const sections = []
    for (let i = 0; i < results.length; i += 5) {
        const chunk = results.slice(i, i + 5)
        sections.push({
            title: `Hasil ${i + 1}-${Math.min(i + 5, results.length)}`,
            rows: chunk.map((r, j) => ({
                title: r.title.length > 24 ? r.title.slice(0, 22) + '...' : r.title,
                description: (r.genre || '-').slice(0, 40),
                id: ID.pick(i + j)
            }))
        })
    }

    try {
        await sendListButton(sock, m, {
            body: `Hasil: "${keyword}"\nDitemukan ${results.length} anime\n\nTap tombol untuk memilih.`,
            footer: 'Source: Kusonime',
            title: 'Pilih Anime',
            sections
        })
    } catch (e) {
        let txt = `Hasil: "${keyword}"\n${results.length} anime\n\n`
        txt += results.map((r, i) => `*${i + 1}.* ${r.title}\n     ${r.genre || '-'}`).join('\n\n')
        txt += `\n\n_Balas nomor untuk memilih atau ketik *batal*_`
        await m.reply(txt)
    }
}

async function showEpisodePicker(m, sock, detail) {
    cacheSet(m, { detail })

    const sections = detail.downloads.map((dl, bi) => ({
        title: (dl.batch || `Batch ${bi + 1}`).slice(0, 24),
        rows: dl.episodes.map((ep, ei) => ({
            title: (ep.episode || `Episode ${ei + 1}`).slice(0, 24),
            description: Object.keys(ep.resolutions).join(' | ') || '-',
            id: ID.episode(bi, ei)
        }))
    }))

    try {
        await sendListButton(sock, m, {
            body: `*${detail.title}*\nPilih episode yang ingin didownload.`,
            footer: 'Source: Kusonime',
            title: 'Pilih Episode',
            sections
        })
    } catch (e) {
        let txt = `*${detail.title}*\n\n`
        detail.downloads.forEach((dl, bi) => {
            txt += `*${dl.batch || `Batch ${bi + 1}`}*\n`
            dl.episodes.forEach((ep, ei) => {
                txt += `  ${ei + 1}. ${ep.episode || `Episode ${ei + 1}`}\n`
            })
            txt += '\n'
        })
        txt += `_Balas nomor atau ketik *batal*_`
        await m.reply(txt)
    }
}

async function sendDownloadLinks(m, detail, bi, ei) {
    const ep = detail.downloads[bi]?.episodes[ei]
    if (!ep) return m.reply('Episode tidak ditemukan.')

    const resKeys = Object.keys(ep.resolutions)
    if (!resKeys.length) return m.reply('Tidak ada link tersedia.')

    let msg = `*${detail.title}*\n*${ep.episode}*\n━━━━━━━━━━━━━━━━━━━━\n\n`

    resKeys.forEach(res => {
        msg += `*— ${res} —*\n`
        ep.resolutions[res].slice(0, 5).forEach(l => {
            msg += `${l.host}: ${l.href}\n`
        })
        msg += '\n'
    })

    msg += `_Ketik .anime <judul> untuk cari anime lain._`
    cacheClear(m)
    await m.reply(msg)
}

export async function handler(m, { sock }) {
    const text = (m.text || '').trim()
    const body = (m.body || '').trim()

    const k = cacheKey(m)
    const c = cache[k]

    const parsed = ID.parse(text) || ID.parse(body)
    if (parsed) {
        const { action, bi, ei } = parsed

        if (action === 'cancel') {
            cacheClear(m)
            return m.reply('Dibatalkan.')
        }

        if (action === 'pick') {
            if (!c?.results || bi >= c.results.length)
                return m.reply('Sesi expired. Cari ulang dengan .anime <judul>')
            const anime = c.results[bi]
            await m.reply(`Mengambil detail *${anime.title}*...`)
            try {
                const detail = await getDetail(anime.url)
                if (detail.thumb) {
                    try {
                        await sock.sendMessage(m.chat, {
                            image: { url: detail.thumb },
                            caption:
                                `*${detail.title}*\n` +
                                `Genre   : ${detail.genre}\n` +
                                `Status  : ${detail.status}\n` +
                                `Episode : ${detail.episode}\n` +
                                `Score   : ${detail.score}`
                        }, { quoted: m })
                    } catch (_) {}
                }
                return showEpisodePicker(m, sock, detail)
            } catch (e) {
                cacheClear(m)
                return m.reply(`Gagal ambil detail: ${e.message}`)
            }
        }

        if (action === 'episode') {
            if (!c?.detail) return m.reply('Sesi expired. Cari ulang dengan .anime <judul>')
            return sendDownloadLinks(m, c.detail, bi, ei)
        }

        return
    }

    if (c && text.toLowerCase() === 'batal') {
        cacheClear(m)
        return m.reply('Dibatalkan.')
    }

    const keyword = text
    if (!keyword) {
        return m.reply(
            `*Anime Downloader*\n\n` +
            `Gunakan: *.anime <judul>*\n` +
            `Contoh : *.anime naruto*\n\n` +
            `Source: Kusonime`
        )
    }

    await m.reply(`Mencari *${keyword}*...`)
    try {
        const results = await searchAnime(keyword)
        if (!results?.length) return m.reply(`Anime *${keyword}* tidak ditemukan.`)
        await showAnimeList(m, sock, results, keyword)
    } catch (e) {
        cacheClear(m)
        return m.reply(`Gagal mengambil data.\n\n_${e.message}_`)
    }
}