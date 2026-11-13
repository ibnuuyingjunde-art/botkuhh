const pluginConfig = {
    name: 'editmsg',
    alias: ['edit', 'editpesan'],
    category: 'owner',
    description: 'Edit pesan teks yang sudah dikirim bot',
    usage: '.edit <teks baru> (reply pesan bot)',
    example: '.edit ✅ Selesai diproses!',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: false
};

const EDITABLE_QUOTED_TYPES = ['conversation', 'extendedTextMessage', 'textMessage'];

async function handler(m, { sock, args }) {
    const newText = args.join(' ').trim();

    if (!m.quoted || !m.quoted.key || !m.quoted.key.id) {
        await m.reply(
            `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
            `> Reply pesan teks bot yang ingin diedit!\n\n` +
            `*Cara penggunaan:*\n` +
            `> Reply pesan bot → ketik \`.edit teks baru\`\n\n` +
            `*Contoh:*\n` +
            `> \`.edit ✅ Selesai diproses!\``
        );
        return;
    }

    if (!m.quoted.key.fromMe) {
        await m.reply(
            `❌ *ᴛɪᴅᴀᴋ ʙɪsᴀ ᴅɪᴇᴅɪᴛ*\n\n` +
            `> Hanya pesan milik bot sendiri yang bisa diedit.\n` +
            `> WhatsApp tidak mengizinkan edit pesan orang lain.`
        );
        return;
    }

    if (!EDITABLE_QUOTED_TYPES.includes(m.quoted.type)) {
        await m.reply(
            `❌ *ᴛɪᴘᴇ ᴘᴇsᴀɴ ᴛɪᴅᴀᴋ ᴅɪᴅᴜᴋᴜɴɢ*\n\n` +
            `> WhatsApp hanya mengizinkan edit pesan bertipe *teks*, *dokumen*, atau *poll*.\n` +
            `> Pesan yang di-reply bertipe: \`${m.quoted.type}\``
        );
        return;
    }

    if (!newText) {
        await m.reply(
            `⚠️ *ᴛᴇᴋs ᴋᴏsᴏɴɢ*\n\n` +
            `> Sertakan teks baru setelah perintah.\n` +
            `> Contoh: \`.edit Halo, ini teks yang sudah diedit\``
        );
        return;
    }

    try {
        const editKey = {
            remoteJid: m.chat,
            fromMe: true,
            id: m.quoted.key.id,
            participant: m.quoted.key.participant || undefined
        };

        await sock.sendMessage(m.chat, {
            text: newText,
            edit: editKey
        });

        await m.reply(`✅ Pesan berhasil diedit`);
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal mengedit pesan.\n` +
            `> _${error.message}_\n\n` +
            `> Catatan: WhatsApp membatasi jendela waktu edit pesan\n` +
            `> (biasanya ±15 menit sejak pesan dikirim).`
        );
    }
}

export { pluginConfig as config, handler };