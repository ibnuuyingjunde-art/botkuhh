import { uploadImage } from '../../src/lib/ichigo-uploader.js';
import te from '../../src/lib/ichigo-error.js';

const pluginConfig = {
    name: 'removebg2',
    alias: ['rmbg2', 'nobg2'],
    category: 'tools',
    description: 'Menghapus background gambar (API alternatif)',
    usage: '.removebg2 (reply/kirim gambar)',
    example: '.removebg2',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
};

const API_URL = 'https://api-cloud.my.id/tools/removebg';

// Dokumentasi resmi: endpoint ini balikin JSON
// { status: true, creator: "Kaze", result: "data:image/png;base64,...." }
// "result" SELALU data URI base64, bukan link https biasa.
async function callRemoveBg2(imageUrl) {
    const res = await fetch(`${API_URL}?url=${encodeURIComponent(imageUrl)}`);
    if (!res.ok) throw new Error(`API removebg2 gagal (${res.status})`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('image/')) {
        return Buffer.from(await res.arrayBuffer());
    }

    const data = await res.json();
    if (data?.status === false || data?.success === false) {
        throw new Error(data?.message || data?.error || 'API removebg2 gagal');
    }

    const resultRaw =
        data?.result?.url || data?.result ||
        data?.data?.url || data?.data ||
        data?.url;

    if (typeof resultRaw !== 'string' || !resultRaw) {
        console.error('[RemoveBG2] Raw response:', JSON.stringify(data));
        throw new Error('Format respons API removebg2 tidak dikenali');
    }

    // Kasus 1: data URI base64 langsung (bentuk asli endpoint ini)
    const dataUriMatch = resultRaw.match(/^data:image\/\w+;base64,(.+)$/);
    if (dataUriMatch) {
        return Buffer.from(dataUriMatch[1], 'base64');
    }

    // Kasus 2: link https biasa (jaga-jaga kalau providernya ganti bentuk)
    if (/^https?:\/\//i.test(resultRaw)) {
        const imgRes = await fetch(resultRaw);
        if (!imgRes.ok) throw new Error('Gagal mengunduh hasil dari API removebg2');
        return Buffer.from(await imgRes.arrayBuffer());
    }

    console.error('[RemoveBG2] Raw response:', JSON.stringify(data));
    throw new Error('Format respons API removebg2 tidak dikenali');
}

async function handler(m, { sock }) {
    try {
        const target = m.isImage
            ? m
            : (m.quoted && (m.quoted.isImage || m.quoted.type === 'imageMessage'))
                ? m.quoted
                : null;

        if (!target) {
            return await m.reply('❌ *ɢᴀᴍʙᴀʀ ᴅɪʙᴜᴛᴜʜᴋᴀɴ*\n\n> Reply atau kirim gambar dengan caption .removebg2');
        }

        await m.react('🕕');

        const mediaBuffer = await target.download();
        if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
            return await m.reply('❌ Gagal mengunduh gambar');
        }

        const tempUrl = await uploadImage(mediaBuffer, `rmbg2_${Date.now()}.jpg`);
        const result = await callRemoveBg2(tempUrl);

        await sock.sendMessage(m.chat, {
            image: result,
            caption: `✅ *ʙᴀᴄᴋɢʀᴏᴜɴᴅ ᴅɪʜᴀᴘᴜs*\n\n> Background gambar berhasil dihapus (removebg2)`
        }, { quoted: m });

        await m.react('✅');
    } catch (error) {
        console.error('[RemoveBG2 Error]', error);
        m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler };