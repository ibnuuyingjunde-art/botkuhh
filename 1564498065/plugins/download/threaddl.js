import axios from 'axios'
import * as cheerio from 'cheerio'
import FormData from 'form-data'
import crypto from 'crypto'
import te from '../../src/lib/ichigo-error.js'
import { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } from 'ichigo'
async function threadsdl(url) {
    const form = new FormData()
    form.append('search', url)

    const { data } = await axios.post(
        'https://threadsdownload.net/ms?fresh-partial=true',
        form,
        {
            headers: {
                accept: '*/*',
                origin: 'https://threadsdownload.net',
                referer: 'https://threadsdownload.net/ms',
                'user-agent':
                    'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/137 Mobile Safari/537.36'
            }
        }
    )

    const $ = cheerio.load(data)
    const jsonString = $(`script[type='application/json']`).text().trim()

    let brace = 0, end = -1
    for (let i = 0; i < jsonString.length; i++) {
        if (jsonString[i] === '{') brace++
        if (jsonString[i] === '}') brace--
        if (brace === 0 && jsonString[i] === '}') {
            end = i + 1
            break
        }
    }

    if (end === -1) throw new Error('JSON tidak valid')

    const parsed = JSON.parse(jsonString.slice(0, end))
    return parsed.v[0][1]
}

const pluginConfig = {
    name: 'threaddl',
    alias: ['tdl', 'threads', 'threadsdl'],
    category: 'download',
    description: 'Download foto Threads (album)',
    usage: '.tdl <url>',
    example: '.tdl https://www.threads.net/@xxx/post/xxx',
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const url = m.text?.trim()
    if (!url || !/threads/i.test(url)) {
        return m.reply(`❌ Gunakan URL Threads yang valid`)
    }

    m.react('🕕')

    try {
        const result = await threadsdl(url)

        const captionText =
            result.caption ||
            result.text ||
            'No description available.'

        const username = result.user?.username || '-'
        const images = []
        for (const group of result.images || []) {
            if (!Array.isArray(group)) continue
            const best = group.sort((a, b) => b.width - a.width)[0]
            if (best?.url) images.push(best.url)
        }

        if (images.length === 0) {
            throw new Error('Tidak ada gambar ditemukan')
        }

        const mediaList = []
        for (let i = 0; i < images.length; i++) {
            mediaList.push({
                image: { url: images[i] },
            })
        }

        await sock.sendMessage(m.chat, {
            albumMessage: mediaList
        }, { quoted: m })

        m.react('✅')

    } catch (err) {
        console.error('[ThreadsDL]', err.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }