import { getAllPlugins, getCategories } from '../../src/lib/ichigo-plugins.js'
import config from '../../config.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'totalfitur',
    alias: ['totalfeature', 'totalcmd', 'countplugin', 'distribusi'],
    category: 'main',
    description: 'Lihat total fitur/command bot beserta jumlah per kategori',
    usage: '.totalfitur',
    example: '.totalfitur',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

// Batas kategori di poll; kalau lebih, sisanya digabung jadi "Lainnya"
const POLL_TOP_CATEGORIES = 9

function formatNumber(number) {
    return new Intl.NumberFormat('id-ID').format(Number(number) || 0)
}

function formatPercent(part, total) {
    if (!total) return '0%'
    return `${((part / total) * 100).toFixed(1)}%`
}

async function handler(m, { sock }) {
    try {
        let total = 0
        let enabled = 0
        let disabled = 0
        const perCategory = new Map()

        for (const cat of getCategories()) perCategory.set(cat, 0)

        for (const plugin of getAllPlugins()) {
            if (!plugin?.config) continue
            total++
            if (plugin.config.isEnabled !== false) enabled++
            else disabled++
            const cat = String(plugin.config.category || 'lainnya').trim().toLowerCase()
            perCategory.set(cat, (perCategory.get(cat) || 0) + 1)
        }

        const sorted = [...perCategory.entries()]
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

        const totalCategories = sorted.length
        const botName = config.bot?.name || 'BOT'

        await m.react('📊')

        const saluranId = config.saluran?.id || '120363409557700746@newsletter'
        const saluranName = config.saluran?.name || botName

        const top = sorted.slice(0, POLL_TOP_CATEGORIES)
        const rest = sorted.slice(POLL_TOP_CATEGORIES)
        const restCount = rest.reduce((sum, [, c]) => sum + c, 0)

        // Total/Aktif/Nonaktif ada di judul, opsi poll hanya kategori
        // (jumlah opsi dijaga <= 10 seperti contoh poll yang terbukti tampil)
        const pollVotes = top.map(([cat, count], i) => ({
            optionName: `${i + 1}. ${cat} • ${formatNumber(count)}`,
            optionVoteCount: count
        }))

        if (rest.length) {
            pollVotes.push({
                optionName: `+ ${formatNumber(rest.length)} kategori lainnya • ${formatNumber(restCount)}`,
                optionVoteCount: restCount
            })
        }

        // Dikirim langsung lewat relayMessage (format pollResultSnapshotMessage)
        await sock.relayMessage(
            m.chat,
            {
                pollResultSnapshotMessage: {
                    name: `📊 ${botName} · ${formatNumber(totalCategories)} kategori\nTotal ${formatNumber(total)} fitur · Aktif ${formatNumber(enabled)} · Nonaktif ${formatNumber(disabled)}`,
                    pollVotes,
                    contextInfo: {
                        forwardingScore: 9,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: saluranId,
                            serverMessageId: 127,
                            newsletterName: saluranName
                        }
                    },
                    pollType: 0
                }
            },
            {}
        )

        await m.react('✅')
    } catch (error) {
        console.error('[totalfitur]', error)
        await m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }