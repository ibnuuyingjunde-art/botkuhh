import * as pakasir from '../../src/lib/ichigo-pakasir.js'
import { getDatabase } from '../../src/lib/ichigo-database.js'

const pluginConfig = {
    name: 'botmode',
    alias: ['setmode', 'mode'],
    category: 'group',
    description: 'Atur mode bot untuk grup ini',
    usage: '.botmode <md/cpanel/pushkontak/store/otp/all/jagagrup>',
    example: '.botmode store',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const MODES = {
    md: {
        name: 'Multi-Device',
        desc: 'Mode default dengan semua fitur standar',
        allowedCategories: null,
        excludeCategories: ['cpanel', 'pushkontak', 'store']
    },
    all: {
        name: 'All Features',
        desc: 'Semua fitur dari semua mode bisa diakses',
        allowedCategories: null,
        excludeCategories: null
    },
    cpanel: {
        name: 'CPanel Pterodactyl',
        desc: 'Mode khusus untuk panel server',
        allowedCategories: ['main', 'group', 'sticker', 'owner', 'tools', 'panel'],
        excludeCategories: null
    },
    pushkontak: {
        name: 'Push Kontak',
        desc: 'Mode khusus untuk push kontak ke member',
        allowedCategories: ['owner', 'main', 'group', 'sticker', 'pushkontak'],
        excludeCategories: null
    },
    store: {
        name: 'Store/Toko',
        desc: 'Mode khusus untuk toko online',
        allowedCategories: ['main', 'group', 'sticker', 'owner', 'store'],
        excludeCategories: null
    },
    otp: {
        name: 'OTP Service',
        desc: 'Mode layanan OTP otomatis',
        allowedCategories: ['main', 'group', 'sticker', 'owner'],
        excludeCategories: null
    },
    jagagrup: {
        name: 'Jaga Grup',
        desc: 'Mode minimalis khusus penjaga grup',
        allowedCategories: ['main', 'group', 'owner', 'sticker', 'cek', 'download'],
        excludeCategories: null
    }
}

const MODE_EMOJI = {
    md: '📱',
    all: '🌐',
    cpanel: '🖥️',
    pushkontak: '📤',
    store: '🛒',
    otp: '🔐',
    jagagrup: '🛡️'
}

function buildSelectRows(currentMode, prefix) {
    return Object.entries(MODES).map(([key, val]) => ({
        title: `${MODE_EMOJI[key]} ${key.toUpperCase()}${key === currentMode ? ' ✓' : ''} — ${val.name}`,
        description: val.desc,
        id: `${prefix}botmode ${key}`
    }))
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const mode = (args[0] || '').toLowerCase()

    const groupData = db.getGroup(m.chat) || {}
    const currentMode = groupData.botMode || 'md'

    const sendModeMenu = async (extraText = '') => {
        const rows = buildSelectRows(currentMode, m.prefix)

        const buttons = [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: '🔧 Pilih Mode Bot',
                    sections: [{ title: 'Mode Tersedia', rows }]
                })
            }
        ]

        const autoorderStatus = groupData.storeConfig?.autoorder ? '✅ ON' : '❌ OFF'

        const bodyText =
            `🔧 *ʙᴏᴛ ᴍᴏᴅᴇ*\n\n` +
            (extraText ? `${extraText}\n\n` : '') +
            `> Mode saat ini: *${currentMode.toUpperCase()}* (${MODES[currentMode]?.name || 'Unknown'})\n` +
            (currentMode === 'store' ? `> Autoorder: *${autoorderStatus}*\n` : '') +
            `\n*📋 DESKRIPSI MODE:*\n\n` +
            Object.entries(MODES).map(([key, val]) =>
                `- *${MODE_EMOJI[key]} ${key.toUpperCase()} — ${val.name}*\n  ${val.desc}`
            ).join('\n\n') +
            `\n\n> Pilih mode dari tombol di bawah 👇\n` +
            `> _Pengaturan berlaku per-grup_`

        await sock.sendButton(
            m.chat,
            null,
            bodyText,
            m,
            { buttons }
        )
    }

    if (!mode) {
        return await sendModeMenu()
    }

    if (!Object.keys(MODES).includes(mode)) {
        return await sendModeMenu(`❌ Mode *"${mode}"* tidak valid. Pilih dari daftar berikut:`)
    }

    const isAutoorder = false

    const newGroupData = {
        ...groupData,
        botMode: mode
    }

    if (mode === 'store') {
        let pakasirEnabled = false
        try {
            pakasirEnabled = pakasir.isEnabled()
        } catch (e) {}

        if (isAutoorder && !pakasirEnabled) {
            return m.reply(
                `⚠️ *ᴀᴜᴛᴏᴏʀᴅᴇʀ ᴛɪᴅᴀᴋ ʙɪsᴀ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n\n` +
                `> Pakasir belum dikonfigurasi!\n\n` +
                `*ᴄᴀʀᴀ sᴇᴛᴜᴘ:*\n` +
                `1. Buka \`config.js\`\n` +
                `2. Set \`pakasir.slug\` dan \`pakasir.apiKey\`\n` +
                `3. Restart bot\n\n` +
                `> Atau gunakan mode manual:\n` +
                `\`${m.prefix}botmode store\``
            )
        }

        newGroupData.storeConfig = {
            ...(groupData.storeConfig || {}),
            autoorder: isAutoorder,
            products: groupData.storeConfig?.products || []
        }
    }

    db.setGroup(m.chat, newGroupData)
    db.save()

    await m.react('✅')

    let extraInfo = ''
    if (mode === 'store') {
        const products = newGroupData.storeConfig?.products || []
        extraInfo = isAutoorder
            ? `\n\n✅ *Autoorder aktif!*\n> Pembayaran otomatis via Pakasir\n> Product: \`${products.length}\` item`
            : `\n\n📋 *Manual mode*\n> Admin perlu confirm order manual\n> Product: \`${products.length}\` item\n\n` +
              `*ᴘᴀɴᴅᴜᴀɴ:*\n` +
              `> \`${m.prefix}addprod <kode> <harga> <nama>\`\n` +
              `> \`${m.prefix}listprod\` - Lihat produk`
    }

    if (mode === 'jagagrup') {
        extraInfo = `\n\n🛡️ *Jaga Grup aktif!*\n` +
            `> Plugin aktif: main, group, owner, sticker, cek, download\n` +
            `> Plugin lain dinonaktifkan untuk grup ini`
    }

    const rows = buildSelectRows(mode, m.prefix)
    const buttons = [
        {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
                title: '🔄 Ganti Mode',
                sections: [{ title: 'Mode Lainnya', rows }]
            })
        }
    ]

    await sock.sendButton(
        m.chat,
        null,
        `✅ *ᴍᴏᴅᴇ ᴅɪᴜʙᴀʜ*\n\n` +
        `> Mode: *${MODE_EMOJI[mode]} ${mode.toUpperCase()}* (${MODES[mode].name})\n` +
        `> Grup: *${m.chat.split('@')[0]}*\n` +
        (mode === 'store' ? `> Autoorder: *${isAutoorder ? 'ON' : 'OFF'}*\n` : '') +
        extraInfo +
        `\n\n> Ketik \`${m.prefix}menu\` untuk melihat menu.\n` +
        `> Mau ganti mode lain? Pilih dari tombol di bawah 👇`,
        m,
        { buttons }
    )
}

function getGroupMode(chatJid, db) {
    const globalMode = db.setting('botMode') || 'md'
    if (!chatJid?.endsWith('@g.us')) return globalMode
    const groupData = db.getGroup(chatJid) || {}
    return groupData.botMode || globalMode
}

function getModeCategories(mode) {
    const modeConfig = MODES[mode] || MODES.md
    return {
        allowed: modeConfig.allowedCategories,
        excluded: modeConfig.excludeCategories
    }
}

function filterCategoriesByMode(categories, mode) {
    const modeConfig = MODES[mode] || MODES.md

    if (modeConfig.allowedCategories) {
        return categories.filter(cat => modeConfig.allowedCategories.includes(cat.toLowerCase()))
    }

    if (modeConfig.excludeCategories) {
        return categories.filter(cat => !modeConfig.excludeCategories.includes(cat.toLowerCase()))
    }

    return categories
}

export { pluginConfig as config, handler, getGroupMode, getModeCategories, filterCategoriesByMode, MODES }