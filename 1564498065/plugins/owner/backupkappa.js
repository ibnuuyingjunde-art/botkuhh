import { backupAssetToKappa } from '../../src/lib/ichigo-uploader.js'
import te from '../../src/lib/ichigo-error.js'
import config from '../../config.js'

const pluginConfig = {
    name: 'backupkappa',
    alias: ['backupasset', 'cadangkappa'],
    category: 'owner',
    description: 'Cadangin asset berupa link ke kappa.lol (jadi link cadangan di config)',
    usage: '.backupkappa (semua asset link) atau .backupkappa <key>',
    example: '.backupkappa ichigo',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    try {
        const arg = String(m.args?.[0] || '').trim()
        const keys = arg && arg !== 'all'
            ? [arg]
            : Object.keys(config.assets || {})

        await m.react('⏳')
        const ok = []
        const skipped = []
        const failed = []

        for (const key of keys) {
            try {
                const r = await backupAssetToKappa(key)
                if (r.status === 'ok') ok.push(`${key} → ${r.url}`)
                else if (arg && arg !== 'all') skipped.push(`${key}: ${r.reason}`)
            } catch (e) {
                failed.push(`${key}: ${e.message}`)
            }
        }

        await m.react(failed.length ? '⚠️' : '✅')
        let text = `📦 *ʙᴀᴄᴋᴜᴘ ᴋᴀᴘᴘᴀ*\n\n> Berhasil: ${ok.length}\n> Gagal: ${failed.length}`
        if (ok.length) text += `\n\n*Berhasil*\n${ok.map((x) => `• ${x}`).join('\n')}`
        if (skipped.length) text += `\n\n*Dilewati*\n${skipped.map((x) => `• ${x}`).join('\n')}`
        if (failed.length) text += `\n\n*Gagal*\n${failed.map((x) => `• ${x}`).join('\n')}`
        if (!ok.length && !failed.length && !skipped.length) text += `\n\n> Semua asset link sudah punya cadangan kappa.`
        await m.reply(text)
    } catch (error) {
        await m.react('☢')
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
