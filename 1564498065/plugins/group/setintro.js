import { getDatabase } from '../../src/lib/ichigo-database.js'

const pluginConfig = {
    name: 'setintro',
    alias: ['setperkenalan', 'introset'],
    category: 'group',
    description: 'Set pesan intro grup (admin only)',
    usage: '.setintro <pesan>',
    example: '.setintro Selamat datang @user di @group!',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: true
}

async function handler(m) {
    const db        = getDatabase()
    const introText = m.fullArgs?.trim() || m.text?.trim()

    if (!introText) {
        return m.reply(
            `📝 *sᴇᴛ ɪɴᴛʀᴏ*\n\n` +
            `╭┈┈⬡「 📋 *ᴘʟᴀᴄᴇʜᴏʟᴅᴇʀ* 」\n` +
            `┃ ◦ \`@user\`    - Nama member\n` +
            `┃ ◦ \`@group\`   - Nama grup\n` +
            `┃ ◦ \`@count\`   - Jumlah member\n` +
            `┃ ◦ \`@date\`    - Tanggal hari ini\n` +
            `┃ ◦ \`@time\`    - Waktu sekarang\n` +
            `┃ ◦ \`@desc\`    - Deskripsi grup\n` +
            `┃ ◦ \`@botname\` - Nama bot\n` +
            `╰┈┈⬡\n\n` +
            `*Contoh:*\n` +
            `\`${m.prefix}setintro Halo @user! 👋\nSilakan perkenalan di @group yaa\``
        )
    }

    db.setGroup(m.chat, { intro: introText })
    db.save()

    m.react('✅')
    await m.reply(
        `╔═══════════════════╗\n` +
        `║  ✅ *ɪɴᴛʀᴏ ᴅɪsᴀᴠᴇ*\n` +
        `╚═══════════════════╝\n\n` +
        `> Pesan intro berhasil diubah!\n\n` +
        `_Ketik \`${m.prefix}intro\` untuk preview._\n` +
        `_Intro ini akan dikirim otomatis saat member baru klik tombol *Perkenalan* di welcome message._`
    )
}

export { pluginConfig as config, handler }