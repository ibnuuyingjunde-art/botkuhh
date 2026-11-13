const pluginConfig = {
    name: 'albumpack',
    alias: ['albumtopack', 'apack'],
    category: 'sticker',
    description: 'Kirim album foto (banyak foto sekaligus) lalu jadikan satu sticker pack native',
    usage: '.albumpack namapack|deskripsi',
    example: 'Kirim beberapa foto sekaligus (album) → .albumpack Ichigo Pack|Sticker keren',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true
};

const albumBuffers = new Map();
const ALBUM_MAX_AGE_MS = 120000; 
const ALBUM_MAX_ITEMS = 30;
const STABILITY_WAIT_MS = 300;
const STABILITY_ROUNDS = 3;

function hashBuf(buf) {
    let h = 0;
    for (let i = 0; i < buf.length; i += 97) {
        h = (h * 31 + buf[i]) >>> 0;
    }
    return `${buf.length}-${h}`;
}

function hookAlbumCollector(sock) {
    if (sock.__albumpackHooked) return;
    sock.__albumpackHooked = true;

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;
                const imgMsg = msg.message.imageMessage;
                if (!imgMsg) continue;

                const chat = msg.key.remoteJid;
                const sender = msg.key.participant || msg.key.remoteJid;

                let entry = albumBuffers.get(chat);
                if (!entry || Date.now() - entry.updatedAt > ALBUM_MAX_AGE_MS || entry.sender !== sender) {
                    entry = { items: [], hashes: new Set(), sender, updatedAt: Date.now() };
                    albumBuffers.set(chat, entry);
                }

                const { downloadContentFromMessage } = await import('ichigo');
                const stream = await downloadContentFromMessage(imgMsg, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                const h = hashBuf(buffer);
                if (!entry.hashes.has(h)) {
                    entry.hashes.add(h);
                    entry.items.push(buffer);
                    if (entry.items.length > ALBUM_MAX_ITEMS) entry.items.shift();
                }
                entry.updatedAt = Date.now();
            } catch (e) {
                
            }
        }
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handler(m, { sock, config: botConfig, args }) {
    hookAlbumCollector(sock);

    const chat = m.chat;
    const sender = m.sender || m.key?.participant || chat;

    const input = args.join(' ').trim();
    const [packname, description] = input.includes('|')
        ? input.split('|').map((s) => s.trim())
        : [input || null, null];

    let entry = albumBuffers.get(chat);

    if (!entry || entry.sender !== sender) {
        await m.reply(
            `⚠️ *ᴀʟʙᴜᴍ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
            `> Kirim beberapa foto sekaligus (pilih multi lalu kirim sebagai album), baru ketik command ini.\n\n` +
            `*Cara penggunaan:*\n` +
            `> Kirim album foto → \`.albumpack namapack|deskripsi\``
        );
        return;
    }

    let lastLen = entry.items.length;
    let stableCount = 0;
    for (let i = 0; i < 15; i++) {
        await sleep(STABILITY_WAIT_MS);
        if (entry.items.length === lastLen) {
            stableCount++;
            if (stableCount >= STABILITY_ROUNDS) break;
        } else {
            stableCount = 0;
            lastLen = entry.items.length;
        }
    }

    const items = entry.items.slice();

    if (items.length === 0) {
        await m.reply(
            `⚠️ *ᴛɪᴅᴀᴋ ᴀᴅᴀ ꜰᴏᴛᴏ*\n\n` +
            `> Kirim album foto dulu, baru ketik \`.albumpack namapack|deskripsi\`.`
        );
        return;
    }

    await m.react('🕕');

    const finalPackname = packname || botConfig.sticker?.packname || botConfig.bot?.name || 'Ichigo Album Pack';
    const finalAuthor = botConfig.sticker?.author || botConfig.owner?.name || "lyniX's MD";
    const finalDescription = description || `Sticker pack dari ${items.length} foto album`;

    try {
        await sock.sendStickerPack(chat, items, m, {
            name: finalPackname,
            packname: finalPackname,
            publisher: finalAuthor,
            author: finalAuthor,
            description: finalDescription,
            emojis: ['🖼️'],
        });

        albumBuffers.delete(chat);
        await m.react('✅');
        await m.reply(`✅ Sticker pack *"${finalPackname}"* berhasil dibuat dari *${items.length}* foto.`);
    } catch (error) {
        await m.react('❌');
        await m.reply(
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal membuat sticker pack.\n` +
            `> _${error.message}_`
        );
    }
}

export { pluginConfig as config, handler };