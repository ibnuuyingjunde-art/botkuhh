import axios from 'axios'

const DEFAULT_TIMEOUT = 30000
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null
    const matches = url.match(/https?:\/\//g) || []
    if (matches.length <= 1) return url || null
    const lastIndex = url.lastIndexOf('http')
    return url.slice(lastIndex)
}

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') return 0
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0
    const cleaned = String(value).replace(/[^0-9.KMB]/gi, '')
    const num = parseFloat(cleaned)
    if (!Number.isFinite(num)) return 0
    const upper = String(value).toUpperCase()
    if (upper.includes('B')) return Math.round(num * 1_000_000_000)
    if (upper.includes('M')) return Math.round(num * 1_000_000)
    if (upper.includes('K')) return Math.round(num * 1_000)
    return Math.round(num)
}

function pick(...values) {
    for (const v of values) {
        if (v !== undefined && v !== null && v !== '') return v
    }
    return undefined
}

function toNormalizedItem({
    title, cover, link, watermarkLink, music, duration, region, id,
    authorNickname, authorFullname, authorAvatar,
    plays, likes, comments, shares, downloads
}) {
    return {
        title: title || '',
        cover: normalizeUrl(cover),
        originCover: normalizeUrl(cover),
        link: normalizeUrl(link),
        watermarkLink: normalizeUrl(watermarkLink || link),
        music: normalizeUrl(music) || (typeof music === 'string' ? music : ''),
        duration: duration || '',
        region: region || '',
        id: id || '',
        author: {
            nickname: authorNickname || authorFullname || '',
            fullname: authorFullname || '',
            avatar: normalizeUrl(authorAvatar)
        },
        stats: {
            plays: normalizeNumber(plays),
            likes: normalizeNumber(likes),
            comments: normalizeNumber(comments),
            shares: normalizeNumber(shares),
            downloads: normalizeNumber(downloads)
        }
    }
}

/**
 * Daftar provider pencarian TikTok. Dicoba berurutan (fallback) sampai
 * ada satu yang berhasil dan mengembalikan minimal satu hasil.
 * Jika kamu menambah/mengganti API di masa depan, cukup tambahkan
 * entri baru di sini tanpa perlu mengubah pemanggil (tiktokSearchVideo).
 */
const PROVIDERS = [
    {
        name: 'nexray-web',
        async run(query) {
            const { data } = await axios.get('https://api.nexray.web.id/search/tiktok', {
                params: { q: query },
                timeout: DEFAULT_TIMEOUT,
                headers: { 'user-agent': DEFAULT_UA }
            })
            const list = data?.result ?? data?.data ?? data?.results
            if (!Array.isArray(list) || !list.length) {
                throw new Error(data?.message || 'Tidak ada hasil (nexray-web)')
            }
            return list.map((item) => toNormalizedItem({
                title: item?.title || item?.desc || item?.description,
                cover: item?.cover || item?.thumbnail,
                link: item?.data || item?.url || item?.play || item?.video,
                watermarkLink: item?.wmplay || item?.data,
                music: item?.music_info?.url || item?.music,
                duration: item?.duration,
                region: item?.region,
                id: item?.id,
                authorNickname: item?.author?.nickname || item?.author?.fullname,
                authorFullname: item?.author?.fullname,
                authorAvatar: item?.author?.avatar,
                plays: item?.stats?.views ?? item?.stats?.plays,
                likes: item?.stats?.likes,
                comments: item?.stats?.comment ?? item?.stats?.comments,
                shares: item?.stats?.share ?? item?.stats?.shares,
                downloads: item?.stats?.download ?? item?.stats?.downloads
            })).filter((v) => v.link)
        }
    },
    {
        name: 'nexray-eu',
        async run(query) {
            const { data } = await axios.get('https://api.nexray.eu.cc/search/tiktok', {
                params: { q: query },
                timeout: DEFAULT_TIMEOUT,
                headers: { 'user-agent': DEFAULT_UA }
            })
            const list = data?.result ?? data?.data
            if (!Array.isArray(list) || !list.length) {
                throw new Error(data?.message || 'Tidak ada hasil (nexray-eu)')
            }
            return list.map((item) => toNormalizedItem({
                title: item?.title,
                cover: item?.cover,
                link: item?.data,
                watermarkLink: item?.data,
                music: item?.music_info?.url,
                duration: item?.duration,
                region: item?.region,
                id: item?.id,
                authorNickname: item?.author?.nickname || item?.author?.fullname,
                authorFullname: item?.author?.fullname,
                authorAvatar: item?.author?.avatar,
                plays: item?.stats?.views,
                likes: item?.stats?.likes,
                comments: item?.stats?.comment,
                shares: item?.stats?.share,
                downloads: item?.stats?.download
            })).filter((v) => v.link)
        }
    },
    {
        name: 'lexcode',
        async run(query) {
            const { data } = await axios.get('https://api.lexcode.biz.id/api/search/tiktok', {
                params: { q: query },
                timeout: DEFAULT_TIMEOUT,
                headers: { 'user-agent': DEFAULT_UA }
            })
            const list = data?.results
            if (!data?.success || !Array.isArray(list) || !list.length) {
                throw new Error(data?.message || 'Tidak ada hasil (lexcode)')
            }
            return list.map((item) => toNormalizedItem({
                title: item?.description,
                cover: item?.cover || item?.thumbnail,
                link: item?.url,
                watermarkLink: item?.url,
                music: pick(item?.music?.title, item?.music?.url),
                id: item?.id,
                authorNickname: item?.author?.nickname || item?.author?.username,
                authorFullname: item?.author?.username,
                authorAvatar: item?.author?.avatar,
                plays: item?.stats?.views,
                likes: item?.stats?.likes,
                comments: item?.stats?.comments,
                shares: item?.stats?.shares
            })).filter((v) => v.link)
        }
    }
]

async function tiktokSearchVideo(query) {
    if (!query || !String(query).trim()) {
        throw new Error('Kata kunci pencarian tidak boleh kosong')
    }

    const errors = []

    for (const provider of PROVIDERS) {
        try {
            const result = await provider.run(String(query).trim())
            if (Array.isArray(result) && result.length) return result
            errors.push(`${provider.name}: hasil kosong`)
        } catch (err) {
            errors.push(`${provider.name}: ${err?.message || err}`)
        }
    }

    throw new Error(`TikTok search gagal dari semua provider (${errors.join(' | ')})`)
}

export { tiktokSearchVideo }