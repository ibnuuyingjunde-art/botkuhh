import fs from 'fs'
import path from 'path'
import config from '../../config.js'
import { uploadImage, updateAssetLink } from '../../src/lib/ichigo-uploader.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'migrasiasset',
    alias: ['assetkelink', 'asset2link'],
    category: 'owner',
    description: 'Upload semua asset lokal (gambar) ke link, lalu config.assets otomatis jadi link',
    usage: '.migrasiasset [semua] [hapus]',
    example: '.migrasiasset hapus',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 30,
    energi: 0,
    isEnabled: true
}

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const MEDIA_EXT = ['.mp3', '.ogg', '.wav', '.mp4']

function isUrl(v) {
    return typeof v === 'string' && /^https?:\/\//i.test(v)
}

async function handler(m, { sock }) {
    const args = (m.args || []).map((a) => a.toLowerCase())
    const includeMedia = args.includes('semua')
    const deleteLocal = args.includes('hapus')
    const allowed = includeMedia ? [...IMAGE_EXT, ...MEDIA_EXT] : IMAGE_EXT

    try {
        const assets = config.assets || {}
        const pending = Object.entries(assets).filter(([, src]) => {
            if (typeof src !== 'string' || isUrl(src)) return false
            return allowed.includes(path.extname(src).toLowerCase())
        })

        if (pending.length === 0) {
            return m.reply('✅ Semua asset sudah berupa link, tidak ada yang perlu dimigrasi.')
        }

        await m.react('🕕')
        await m.reply(
            `📤 *ᴍɪɢʀᴀsɪ ᴀssᴇᴛ ᴋᴇ ʟɪɴᴋ*\n\n` +
            `> Total: ${pending.length} asset\n` +
            `> Mode: ${includeMedia ? 'gambar + audio/video' : 'gambar saja'}\n` +
            `> Hapus file lokal: ${deleteLocal ? 'ya' : 'tidak'}\n\n` +
            `_Sabar ya, upload satu per satu..._`
        )

        const uploadedByPath = {}
        const ok = []
        const failed = []
        const localToDelete = new Set()

        for (const [key, src] of pending) {
            try {
                const full = path.resolve(process.cwd(), src)
                if (!fs.existsSync(full)) throw new Error('file lokal tidak ditemukan')

                let url = uploadedByPath[full]
                if (!url) {
                    const buf = fs.readFileSync(full)
                    url = await uploadImage(buf, path.basename(full))
                    uploadedByPath[full] = url
                }

                await updateAssetLink(key, url)
                ok.push(key)
                localToDelete.add(full)
                await new Promise((r) => setTimeout(r, 1000))
            } catch (e) {
                failed.push(`${key}: ${e.message}`)
            }
        }

        let deleted = 0
        if (deleteLocal) {
            const stillUsed = new Set(
                Object.values(config.assets || {})
                    .filter((v) => typeof v === 'string' && !isUrl(v))
                    .map((v) => path.resolve(process.cwd(), v))
            )
            for (const file of localToDelete) {
                if (stillUsed.has(file)) continue
                try {
                    fs.unlinkSync(file)
                    deleted++
                } catch {}
            }
        }

        let text = `✅ *ᴍɪɢʀᴀsɪ sᴇʟᴇsᴀɪ*\n\n> Berhasil: ${ok.length}/${pending.length}\n`
        if (deleteLocal) text += `> File lokal dihapus: ${deleted}\n`
        if (failed.length) {
            text += `\n⚠️ *Gagal (${failed.length}):*\n${failed.map((f) => `> ${f}`).join('\n')}\n`
            text += `\n_Yang gagal tetap pakai file lokal, jalankan lagi perintahnya untuk mengulang._`
        } else {
            text += `\n> config.js sudah diupdate, tidak perlu restart.`
        }

        await m.reply(text)
        await m.react(failed.length ? '⚠️' : '✅')
    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
