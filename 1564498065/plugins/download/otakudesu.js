import axios from 'axios'
import * as cheerio from '../../src/lib/ichigo-cheerio-lazy.js'

const BASE = 'https://otakudesu.blog'
const AJAX = `${BASE}/wp-admin/admin-ajax.php`
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
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
    name: 'otakudesu',
    alias: ['odesu', 'otaku'],
    category: 'download',
    description: 'Cari anime, lihat jadwal, episode, dan link download dari Otakudesu',
    usage: '.otakudesu <subcommand>',
    example: '.otakudesu cari naruto',
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
    ep:     (i) => `.otakudesu __ep:${i}__`,
    dl:     (i) => `.otakudesu __dl:${i}__`,
    anime:  (i) => `.otakudesu __anime:${i}__`,
    cancel: ()  => `.otakudesu __cancel__`,
    parse:  (s) => {
        const r = String(s || '').match(/__(\w+)(?::(\d+))?__/)
        return r ? { action: r[1], idx: r[2] != null ? +r[2] : null } : null
    }
}

async function fetchHTML(url) {
    const { data } = await axios.get(url, {
        headers: HEADERS,
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: (s) => s < 500
    })
    return cheerio.load(data)
}

async function searchAnime(keyword) {
    const url = `${BASE}/?s=${encodeURIComponent(keyword)}&post_type=anime`
    const $ = await fetchHTML(url)
    const results = []
    $('.chivsrc li').each((i, el) => {
        if (i >= 10) return false
        const a     = $(el).find('h2 a').first()
        const title = a.text().trim()
        const href  = a.attr('href') || ''
        const status = $(el).find('.epz').text().trim() || '-'
        if (title && href) results.push({ title, url: href, status })
    })
    return results
}

async function getAnimeDetail(animeUrl) {
    const $ = await fetchHTML(animeUrl)
    const title = $('h1.entry-title').text().trim()
    const info  = {}
    $('.infozingle p').each((_, p) => {
        const txt = $(p).text()
        const idx = txt.indexOf(':')
        if (idx === -1) return
        info[txt.slice(0, idx).trim().toLowerCase()] = txt.slice(idx + 1).trim()
    })
    const episodes = []
    $('.episodelist li').each((_, li) => {
        const a   = $(li).find('a').first()
        const lbl = a.text().trim()
        const url = a.attr('href') || ''
        if (lbl && url) episodes.push({ label: lbl, url })
    })
    return { title, info, episodes }
}

async function getEpisodeDetail(epUrl) {
    const $ = await fetchHTML(epUrl)
    const title = $('h1.posttl').text().trim()
    const downloads = []
    $('.download ul').each((_, ul) => {
        $(ul).find('li').each((_, li) => {
            const quality = $(li).find('strong').text().trim()
            const size    = $(li).find('i').text().trim()
            const links   = []
            $(li).find('a').each((_, a) => {
                links.push({ host: $(a).text().trim(), url: $(a).attr('href') || '' })
            })
            if (quality && links.length) downloads.push({ quality, size, links })
        })
    })
    return { title, downloads }
}

async function getJadwal() {
    const $ = await fetchHTML(`${BASE}/jadwal-rilis/`)
    const result = {}
    $('.kglist321').each((_, el) => {
        const day = $(el).find('h2').first().text().trim()
        const list = []
        $(el).find('ul li a').each((_, a) => {
            list.push({ title: $(a).text().trim(), url: $(a).attr('href') || '' })
        })
        if (day && list.length) result[day] = list
    })
    return result
}

async function getOngoing() {
    const $ = await fetchHTML(`${BASE}/ongoing-anime/`)
    const result = []
    $('.venz ul li').each((i, el) => {
        if (i >= 15) return false
        const title   = $(el).find('.jdlflm').text().trim()
        const url     = $(el).find('a').attr('href') || ''
        const episode = $(el).find('.epz').text().trim()
        const date    = $(el).find('.newnime').text().trim()
        if (title) result.push({ title, url, episode, date })
    })
    
    if (!result.length) {
        const $2 = await fetchHTML(`${BASE}/`)
        $2('.venz ul li').each((i, el) => {
            if (i >= 15) return false
            const title   = $2(el).find('.jdlflm').text().trim()
            const url     = $2(el).find('a').attr('href') || ''
            const episode = $2(el).find('.epz').text().trim()
            const date    = $2(el).find('.newnime').text().trim()
            if (title) result.push({ title, url, episode, date })
        })
    }
    return result
}

async function sendList(sock, m, { body, footer, title, sections }) {
    await sock.sendButton(m.chat, null, body, m, {
        footer,
        buttons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({ title, sections })
        }],
        contextInfo: { mentionedJid: [m.sender], isForwarded: true, forwardingScore: 9 }
    })
}

async function showDownloadPicker(m, sock, detail) {
    if (!detail.downloads.length) {
        cacheClear(m)
        return m.reply(`*${detail.title}*\n\nTidak ada link download.`)
    }

    const rows = detail.downloads.map((dl, i) => ({
        title: dl.quality,
        description: dl.size || `${dl.links.length} host`,
        id: ID.dl(i)
    }))

    try {
        await sendList(sock, m, {
            body: `*${detail.title}*\n\nPilih kualitas download:`,
            footer: 'Tap untuk lihat link',
            title: 'Pilih Kualitas',
            sections: [{ title: 'Kualitas Tersedia', rows }]
        })
    } catch {
        let txt = `*${detail.title}*\n\n`
        detail.downloads.forEach((dl, i) => {
            txt += `*${i + 1}.* ${dl.quality} ${dl.size ? `(${dl.size})` : ''}\n`
        })
        txt += `\n_Balas angka untuk pilih kualitas_`
        await m.reply(txt)
    }
}

export async function handler(m, { sock }) {
    const text = (m.text || '').trim()
    const body = (m.body || '').trim()
    const k    = cacheKey(m)
    const c    = cache[k]

    const parsed = ID.parse(text) || ID.parse(body)
    if (parsed) {
        const { action, idx } = parsed

        if (action === 'cancel') {
            cacheClear(m)
            return m.reply('Dibatalkan.')
        }

        if (action === 'anime') {
            if (!c?.searchResults || idx >= c.searchResults.length)
                return m.reply('Sesi expired. Cari ulang dengan .otakudesu cari <judul>')
            const anime = c.searchResults[idx]
            await m.reply(`Mengambil detail *${anime.title}*...`)
            try {
                const detail = await getAnimeDetail(anime.url)
                if (!detail.episodes.length)
                    return m.reply(`*${detail.title}*\n\nBelum ada episode.`)
                cacheSet(m, { episodes: detail.episodes })
                await showEpisodePicker(m, sock, detail)
            } catch (e) {
                cacheClear(m)
                return m.reply(`Gagal ambil detail: ${e.message}`)
            }
            return
        }

        if (action === 'ep') {
            if (!c?.episodes || idx >= c.episodes.length)
                return m.reply('Sesi expired.')
            const ep = c.episodes[idx]
            await m.reply(`Mengambil *${ep.label}*...`)
            try {
                const detail = await getEpisodeDetail(ep.url)
                cacheSet(m, { downloads: detail.downloads })
                return showDownloadPicker(m, sock, detail)
            } catch (e) {
                cacheClear(m)
                return m.reply(`Gagal: ${e.message}`)
            }
        }

        if (action === 'dl') {
            if (!c?.downloads || idx >= c.downloads.length)
                return m.reply('Sesi expired.')
            cacheClear(m)
            const dl = c.downloads[idx]
            let msg = `*${dl.quality}*${dl.size ? ` (${dl.size})` : ''}\n\n`
            dl.links.forEach(l => { msg += `*${l.host}*\n${l.url}\n\n` })
            return m.reply(msg.trim())
        }

        return
    }

    const [sub, ...rest] = text.split(/\s+/)
    const arg = rest.join(' ').trim()

    if (sub === 'jadwal') {
        await m.reply('Mengambil jadwal rilis...')
        try {
            const jadwal = await getJadwal()
            const days   = Object.entries(jadwal)
            if (!days.length) return m.reply('Jadwal tidak ditemukan.')
            let msg = '*Jadwal Rilis Anime Otakudesu*\n\n'
            for (const [day, list] of days) {
                msg += `*${day}*\n`
                list.slice(0, 5).forEach(a => { msg += `- ${a.title}\n` })
                if (list.length > 5) msg += `  _...+${list.length - 5} lainnya_\n`
                msg += '\n'
            }
            return m.reply(msg.trim())
        } catch (e) {
            return m.reply(`Gagal ambil jadwal: ${e.message}`)
        }
    }

    if (sub === 'ongoing') {
        await m.reply('Mengambil anime ongoing terbaru...')
        try {
            const list = await getOngoing()
            if (!list.length) return m.reply('Tidak ada data ongoing.')
            let msg = '*Anime Ongoing Terbaru*\n\n'
            list.forEach((a, i) => {
                msg += `*${i + 1}.* ${a.title}\n`
                if (a.episode) msg += `   ${a.episode}`
                if (a.date) msg += ` | ${a.date}`
                msg += '\n\n'
            })
            return m.reply(msg.trim())
        } catch (e) {
            return m.reply(`Gagal ambil ongoing: ${e.message}`)
        }
    }

    if (sub === 'cari') {
        if (!arg) return m.reply('Masukkan judul.\nContoh: *.otakudesu cari naruto*')
        await m.reply(`Mencari *${arg}*...`)
        try {
            const results = await searchAnime(arg)
            if (!results.length) return m.reply(`Anime *${arg}* tidak ditemukan.`)
            cacheSet(m, { searchResults: results })

            const rows = results.map((r, i) => ({
                title: r.title.slice(0, 24),
                description: `Status: ${r.status}`,
                id: ID.anime(i)
            }))

            try {
                await sendList(sock, m, {
                    body: `Hasil: "${arg}"\nDitemukan ${results.length} anime`,
                    footer: 'Tap untuk lihat episode',
                    title: 'Pilih Anime',
                    sections: [{ title: `Hasil (${results.length})`, rows }]
                })
            } catch {
                let txt = `*Hasil: "${arg}"*\n\n`
                results.forEach((r, i) => { txt += `*${i + 1}.* ${r.title} (${r.status})\n` })
                txt += `\n_Balas: .otakudesu pilih <nomor>_`
                await m.reply(txt)
            }
        } catch (e) {
            cacheClear(m)
            return m.reply(`Gagal mencari: ${e.message}`)
        }
        return
    }

    if (/^\d+$/.test(sub) && c) {
        const n = +sub - 1
        if (c.downloads) {
            if (n < 0 || n >= c.downloads.length) return m.reply('Angka tidak valid.')
            cacheClear(m)
            const dl = c.downloads[n]
            let msg = `*${dl.quality}*${dl.size ? ` (${dl.size})` : ''}\n\n`
            dl.links.forEach(l => { msg += `*${l.host}*\n${l.url}\n\n` })
            return m.reply(msg.trim())
        }
        if (c.episodes) {
            if (n < 0 || n >= c.episodes.length) return m.reply('Angka tidak valid.')
            const ep = c.episodes[n]
            await m.reply(`Mengambil *${ep.label}*...`)
            try {
                const detail = await getEpisodeDetail(ep.url)
                cacheSet(m, { downloads: detail.downloads })
                return showDownloadPicker(m, sock, detail)
            } catch (e) {
                return m.reply(`Gagal: ${e.message}`)
            }
        }
        if (c.searchResults) {
            if (n < 0 || n >= c.searchResults.length) return m.reply('Angka tidak valid.')
            const anime = c.searchResults[n]
            await m.reply(`Mengambil *${anime.title}*...`)
            try {
                const detail = await getAnimeDetail(anime.url)
                if (!detail.episodes.length) return m.reply('Belum ada episode.')
                cacheSet(m, { episodes: detail.episodes })
                return showEpisodePicker(m, sock, detail)
            } catch (e) {
                return m.reply(`Gagal: ${e.message}`)
            }
        }
    }

    return m.reply(
        `*Otakudesu Anime*\n\n` +
        `*.otakudesu cari <judul>* - Cari anime\n` +
        `*.otakudesu ongoing* - Anime terbaru\n` +
        `*.otakudesu jadwal* - Jadwal rilis\n\n` +
        `Source: otakudesu.blog`
    )
}

async function showEpisodePicker(m, sock, detail) {
    const rows = detail.episodes.slice(0, 20).map((ep, i) => ({
        title: ep.label.slice(0, 24),
        description: '',
        id: ID.ep(i)
    }))

    const info = detail.info
    let infoTxt = `*${detail.title}*\n`
    if (info.status) infoTxt += `Status: ${info.status}\n`
    if (info.genre) infoTxt += `Genre: ${info.genre}\n`
    if (info['total episode']) infoTxt += `Total: ${info['total episode']} ep\n`
    infoTxt += `\n${detail.episodes.length} episode tersedia`

    try {
        await sock.sendButton(m.chat, null, infoTxt, m, {
            footer: 'Tap untuk lihat link download',
            buttons: [{
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: 'Pilih Episode',
                    sections: [{ title: 'Daftar Episode', rows }]
                })
            }],
            contextInfo: { mentionedJid: [m.sender], isForwarded: true, forwardingScore: 9 }
        })
    } catch {
        let txt = infoTxt + '\n\n'
        detail.episodes.slice(0, 15).forEach((ep, i) => { txt += `*${i + 1}.* ${ep.label}\n` })
        txt += `\n_Balas angka untuk pilih episode_`
        await m.reply(txt)
    }
}