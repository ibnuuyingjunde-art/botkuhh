import axios from "axios";
import * as cheerio from "cheerio";

const pluginConfig = {
    name: 'stickerly2',
    alias: ['sly2', 'stickersly2'],
    category: 'downloader',
    description: 'Download sticker pack data from Sticker.ly link',
    usage: '.stickerly <url>',
    example: '.stickerly https://sticker.ly/s/CWCW7W',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock, args, text, prefix, command }) {
    try {
        const url = args[0] || text;
        if (!url) {
            return await m.reply(`❌ *Format Salah*\n\nContoh penggunaan:\n> ${prefix + command} https://sticker.ly/s/CWCW7W`);
        }

        if (!url.includes('sticker.ly')) {
            return await m.reply('❌ *Link tidak valid!* Harap masukkan link Sticker.ly yang benar.');
        }

        await m.reply('⏳ *Sedang mengambil data sticker.ly...*');

        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });

        const $ = cheerio.load(res.data);

        // 1. Judul & Author
        const title = $('div.sticker_name strong').text().trim() || 'Unknown';
        const author = $('span.sticker_author').text().trim() || 'Unknown';

        // 2. Pack ID dari URL
        const packMatch = url.match(/\/s\/([A-Z0-9]+)/i);
        const packId = packMatch ? packMatch[1] : null;

        // 3. Ambil URL .png (konversi dari .webp)
        const stickers = [];
        $('#content_images li').each((i, el) => {
            const $img =$(el).find('img').first();
            const src = $img.attr('src');
            if (!src) return;

            const pngUrl = src.replace(/\.webp$/i, '.png');
            const fileName = pngUrl.split('/').pop() || '';
            const id = fileName.replace(/\.png$/i, '');

            stickers.push({
                index: i,
                id: id,
                url: pngUrl,
            });
        });

        if (stickers.length === 0) {
            return await m.reply('❌ *Gagal:* Tidak dapat menemukan stiker dari link tersebut.');
        }

        // Format teks hasil
        let caption = `🎨 *STICKER.LY DOWNLOADER*\n\n`;
        caption += `📌 *Judul:* ${title}\n`;
        caption += `👤 *Author:* ${author}\n`;
        caption += `🆔 *Pack ID:* ${packId || '-'}\n`;
        caption += `📦 *Total Stiker:* ${stickers.length}\n\n`;
        
        // Menampilkan beberapa contoh link stiker teratas (atau dikirim JSON/list sesuai kebutuhan)
        caption += `🔗 *Contoh Link Gambar Pertama:*\n> ${stickers[0].url}`;

        await m.reply(caption);

    } catch (error) {
        console.error('Stickerly Plugin Error:', error);
        await m.reply('❌ *GAGAL*\n\n> ' + error.message);
    }
}

export { pluginConfig as config, handler };