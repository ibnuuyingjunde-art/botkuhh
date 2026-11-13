import { getDatabase } from '../../src/lib/ichigo-database.js'
import config from '../../config.js'

const pluginConfig = {
    name: 'hapusstok',
    alias: ['delstok', 'delstock', 'deletestok'],
    category: 'store',
    description: '🗑️ Hapus stok item dari produk',
    usage: '.hapusstok <produk> <nomor_item>',
    example: '.hapusstok amlight 2',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function sendInteractive(sock, jid, bodyText, footerText, buttons) {
    try {
        const msg = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: bodyText },
                        footer: { text: footerText },
                        header: { hasMediaAttachment: false },
                        nativeFlowMessage: {
                            buttons,
                            messageVersion: 1,
                        },
                    },
                },
            },
        }
        await sock.relayMessage(jid, msg, {})
    } catch {
        
        await sock.sendMessage(jid, { text: bodyText + '\n\n' + footerText })
    }
}

async function handler(m, { sock }) {
    const db      = getDatabase()
    const stokAll = db.setting('stokProduk') || {}
    const args    = m.args || []

    if (Object.keys(stokAll).length === 0) {
        return m.reply(`📭 Belum ada stok produk.\nTambahkan dulu pakai *.addstok*`)
    }

    if (!args[0]) {
        const produkKeys = Object.keys(stokAll)

        let txt = `🗑️ *HAPUS STOK*\n\n`
        txt += `Format: \`.hapusstok <produk> <nomor_item>\`\n\n`
        txt += `*Produk tersedia:*\n`
        for (const key of produkKeys) {
            const jumlah = Array.isArray(stokAll[key]) ? stokAll[key].length : 0
            txt += `│ • ${key} (${jumlah} item)\n`
        }
        txt += `\nKlik tombol untuk pilih produk.`

        const buttons = produkKeys.slice(0, 5).map(key => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: `🗑️ ${key}`,
                id: `hapusstok_pilih_${key}`,
            }),
        }))

        return await sendInteractive(sock, m.chat, txt, 'Pilih produk yang ingin dihapus itemnya', buttons)
    }

    const produkKey = args[0].toLowerCase()
    const stok      = stokAll[produkKey]

    if (!stok || stok.length === 0) {
        return m.reply(`❌ Produk *${produkKey}* tidak ditemukan atau stok kosong.`)
    }

    if (!args[1]) {
        let txt = `📦 *STOK ${produkKey.toUpperCase()}* (${stok.length} item)\n\n`
        stok.forEach((item, i) => {
            const detail = item.tempmail
                ? `${item.email} : ${item.tempmail}`
                : `${item.email} : ${item.password}`
            txt += `${i + 1}. ${detail}\n`
        })
        txt += `\nFormat hapus: \`.hapusstok ${produkKey} <nomor>\``

        const buttons = stok.slice(0, 5).map((_, i) => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: `🗑️ Hapus item ${i + 1}`,
                id: `hapusstok_item_${produkKey}_${i + 1}`,
            }),
        }))

        return await sendInteractive(sock, m.chat, txt, `Pilih item yang ingin dihapus dari ${produkKey}`, buttons)
    }

    const itemNo = parseInt(args[1]) - 1

    if (isNaN(itemNo) || itemNo < 0 || itemNo >= stok.length) {
        return m.reply(
            `❌ Nomor item tidak valid.\n` +
            `Rentang: 1-${stok.length}\n\n` +
            `📋 Lihat daftar: \`.hapusstok ${produkKey}\``
        )
    }

    const deleted = stok.splice(itemNo, 1)[0]
    stokAll[produkKey] = stok
    db.setting('stokProduk', stokAll)
    await db.save()

    const detail = deleted.tempmail
        ? `${deleted.email} : ${deleted.tempmail}`
        : `${deleted.email} : ${deleted.password}`

    await m.react('✅')
    return m.reply(
        `🗑️ *STOK DIHAPUS*\n\n` +
        `│ Produk  : *${produkKey}*\n` +
        `│ Item    : \`${detail.substring(0, 60)}\`\n` +
        `│ Sisa    : *${stok.length} item*`
    )
}

export { pluginConfig as config, handler }