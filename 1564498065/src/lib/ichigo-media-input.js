import axios from 'axios';

const LINK_FETCH_TIMEOUT_MS = 30000;
const MAX_LINK_BYTES = 50 * 1024 * 1024; 

function extractLinkFromMessage(m) {
    const argUrl = (m.args?.[0] || '').trim();
    if (/^https?:\/\//i.test(argUrl)) return argUrl;

    const quotedText = (m.quoted?.text || m.quoted?.body || m.quoted?.caption || '').trim();
    if (/^https?:\/\//i.test(quotedText)) return quotedText;

    return null;
}

/**
 * Cek cepat (sync, tanpa network) apakah pesan ini punya kandidat link,
 * dipakai buat validasi awal sebelum m.react('🕕') dsb.
 */
export function hasLinkInput(m) {
    return extractLinkFromMessage(m) !== null;
}

/**
 * Ambil buffer dari media (reply/kirim langsung) ATAU dari link (argumen command
 * atau teks yang di-reply). Dipakai semua plugin ganti-ichigo-* / ganti-* biar
 * seragam: bisa upload media seperti biasa, atau kirim `.perintah <url>`.
 *
 * @param {object} m - message object dari handler
 * @returns {Promise<{buffer: Buffer|null, isLink: boolean, linkUrl: string|null}>}
 */
export async function resolveMediaOrLink(m) {
    const linkUrl = extractLinkFromMessage(m);

    if (linkUrl) {
        const response = await axios.get(linkUrl, {
            responseType: 'arraybuffer',
            timeout: LINK_FETCH_TIMEOUT_MS,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: MAX_LINK_BYTES,
            maxBodyLength: MAX_LINK_BYTES
        });

        const buffer = Buffer.from(response.data);
        if (!buffer || buffer.length === 0) {
            throw new Error('File dari link kosong / gagal diunduh');
        }
        return { buffer, isLink: true, linkUrl };
    }

    let buffer = null;
    if (m.quoted && m.quoted.isMedia) {
        buffer = await m.quoted.download();
    } else if (m.isMedia) {
        buffer = await m.download();
    }

    return { buffer, isLink: false, linkUrl: null };
}
