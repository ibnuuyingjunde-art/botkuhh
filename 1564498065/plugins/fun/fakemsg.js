const pluginConfig = {
    name: 'fakemsg',
    alias: ['fakereply', 'fq', 'fakequote'],
    category: 'fun',
    description: 'Kirim pesan dengan tampilan quote/reply dari nomor & teks palsu',
    usage: '.fakemsg <nomor>|<pesan palsu>|<balasan>',
    example: '.fakemsg 6281234567890|Halo, apa kabar?|Baik, kamu?',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: false
};

async function handler(m, { sock, args }) {
    const input = args.join(' ').trim();

    if (!input || !input.includes('|')) {
        await m.reply(
            `⚠️ *ꜰᴏʀᴍᴀᴛ ꜱᴀʟᴀʜ*\n\n` +
            `*Cara penggunaan:*\n` +
            `> \`.fakemsg nomor|pesan palsu|balasan\`\n\n` +
            `*Contoh:*\n` +
            `> \`.fakemsg 6281234567890|Halo, apa kabar?|Baik, kamu?\`\n\n` +
            `*Catatan:*\n` +
            `> Nomor cukup angka saja (tanpa + atau spasi).\n` +
            `> Bisa juga reply gambar untuk kirim fake quote bergambar.`
        );
        return;
    }

    const parts = input.split('|').map(p => p.trim());
    const [rawNumber, fakeText, ...replyParts] = parts;
    const replyText = replyParts.join('|').trim();

    if (!rawNumber || !fakeText || !replyText) {
        await m.reply(
            `⚠️ *ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ʟᴇɴɢᴋᴀᴘ*\n\n` +
            `> Pastikan 3 bagian terisi: nomor, pesan palsu, dan balasan.\n` +
            `> Format: \`.fakemsg nomor|pesan palsu|balasan\``
        );
        return;
    }

    const number = rawNumber.replace(/[^0-9]/g, '');
    if (number.length < 8 || number.length > 15) {
        await m.reply(
            `⚠️ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
            `> Nomor harus berupa angka 8-15 digit (format internasional, tanpa 0 di depan).\n` +
            `> Contoh: \`6281234567890\``
        );
        return;
    }

    const fakeJid = `${number}@s.whatsapp.net`;
    
    const randomMsgId = 'BAE5' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const fakeQuotedMsg = {
        key: {
            fromMe: false,
            participant: fakeJid,
            remoteJid: m.chat,
            id: randomMsgId
        },
        message: { conversation: fakeText },
        pushName: rawNumber
    };

    try {
        if (m.quoted && m.quoted.isImage) {
            const buffer = await m.quoted.download();
            await sock.sendMessage(
                m.chat,
                { image: buffer, caption: replyText },
                { quoted: fakeQuotedMsg }
            );
        } else {
            
            await sock.sendMessage(
                m.chat,
                { text: replyText },
                { quoted: fakeQuotedMsg }
            );
        }
    } catch (error) {
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal mengirim fake message.\n` +
            `> _${error.message}_`
        );
    }
}

export { pluginConfig as config, handler };