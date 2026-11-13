import { getDatabase } from '../../src/lib/ichigo-database.js'

const pluginConfig = {
    name: 'resetintro',
    alias: ['delintro', 'clearintro'],
    category: 'group',
    description: 'Reset intro message ke default',
    usage: '.resetintro',
    example: '.resetintro',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m) {
    const db        = getDatabase()
    const groupData = db.getGroup(m.chat)

    if (!groupData?.intro) {
        return m.reply(
            `╔═══════════════════╗\n` +
            `║  ⚠️ *sᴜᴅᴀʜ ᴅᴇꜰᴀᴜʟᴛ*\n` +
            `╚═══════════════════╝\n\n` +
            `> Intro message sudah menggunakan template default.`
        )
    }

    db.setGroup(m.chat, { intro: null })
    db.save()

    m.react('✅')
    await m.reply(
        `╔═══════════════════╗\n` +
        `║  ✅ *ɪɴᴛʀᴏ ᴅɪʀᴇsᴇᴛ*\n` +
        `╚═══════════════════╝\n\n` +
        `> Intro message kembali ke template default.`
    )
}

export { pluginConfig as config, handler }