import path from 'path';
import config from '../../config.js';
import { updateAssetUrl, updateAssetLink } from '../../src/lib/ichigo-uploader.js';
import te from '../../src/lib/ichigo-error.js';

const pluginConfig = {
    name: 'ganti-asset',
    alias: ['gantiasset', 'setasset'],
    category: 'owner',
    description: 'All-in-one tools untuk ganti asset secara interaktif (upload media atau link)',
    usage: '.ganti-asset (reply media) atau .ganti-asset <url>',
    example: '.ganti-asset https://contoh.com/gambar.jpg',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

if (!global.gantiAssetSessions) {
    global.gantiAssetSessions = {};
}

async function handler(m, { sock }) {
    try {
        const isImage = m.isImage || (m.quoted && m.quoted.isImage);
        const isVideo = m.isVideo || (m.quoted && m.quoted.isVideo);
        const isAudio = m.isAudio || (m.quoted && m.quoted.isAudio);
        const isDocument = m.isDocument || (m.quoted && m.quoted.isDocument);

        const isMedia = isImage || isVideo || isAudio || isDocument;

        const argUrl = (m.args?.[0] || '').trim();
        const quotedText = (m.quoted?.text || '').trim();
        const linkCandidate = /^https?:\/\//i.test(argUrl)
            ? argUrl
            : (/^https?:\/\//i.test(quotedText) ? quotedText : null);

        if (!isMedia && !linkCandidate) {
            return m.reply(
                `🖼️ *ɢᴀɴᴛɪ ᴀssᴇᴛ*\n\n` +
                `> Reply media (gambar/video/audio/document) dengan \`${m.prefix}ganti-asset\`\n` +
                `> atau kirim link: \`${m.prefix}ganti-asset <url>\``
            );
        }

        m.react('🕕');

        let buffer = null;
        let linkUrl = null;
        let detectedType = null;

        if (linkCandidate) {
            linkUrl = linkCandidate;
            const cleanPath = linkUrl.split('?')[0].toLowerCase();
            const ext = path.extname(cleanPath);
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) detectedType = 'image';
            else if (ext === '.mp4') detectedType = 'video';
            else if (['.mp3', '.ogg', '.wav'].includes(ext)) detectedType = 'audio';
            else if (['.ttf', '.otf'].includes(ext)) detectedType = 'font';

        } else {
            if (m.quoted && m.quoted.isMedia) {
                buffer = await m.quoted.download();
            } else if (m.isMedia) {
                buffer = await m.download();
            }
            if (!buffer) {
                return m.reply('❌ Gagal mendownload media.');
            }
            detectedType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : isDocument ? 'font' : null;
        }

        const assets = config.assets || {};
        const keys = Object.keys(assets);
        if (keys.length === 0) {
            return m.reply('❌ Tidak ada asset di config.js.');
        }

        const imageKeys = [];
        const videoKeys = [];
        const audioKeys = [];
        const fontKeys = [];
        const otherKeys = [];

        keys.forEach(k => {
            const rawVal = Array.isArray(assets[k]) ? assets[k][0] : assets[k];
            const pathUrl = String(rawVal || '').split('?')[0].toLowerCase();
            if (pathUrl.endsWith('.jpg') || pathUrl.endsWith('.png') || pathUrl.endsWith('.jpeg') || pathUrl.endsWith('.webp')) {
                imageKeys.push(k);
            } else if (pathUrl.endsWith('.mp4')) {
                videoKeys.push(k);
            } else if (pathUrl.endsWith('.mp3') || pathUrl.endsWith('.ogg') || pathUrl.endsWith('.wav')) {
                audioKeys.push(k);
            } else if (pathUrl.endsWith('.ttf') || pathUrl.endsWith('.otf')) {
                fontKeys.push(k);
            } else {
                otherKeys.push(k);
            }
        });

        const orderedKeys = [...imageKeys, ...videoKeys, ...audioKeys, ...fontKeys, ...otherKeys];

        let listText = `📂 *PILIH ASSET YANG INGIN DIGANTI*\n\n`;
        listText += `_Silakan reply pesan ini dengan nomor (1-${orderedKeys.length})_\n\n`;

        let idx = 1;
        if (imageKeys.length > 0) {
            listText += `*🖼️ Image Assets:*\n`;
            imageKeys.forEach(k => { listText += `> ${idx++}. ${k}\n`; });
            listText += `\n`;
        }
        if (videoKeys.length > 0) {
            listText += `*🎥 Video Assets:*\n`;
            videoKeys.forEach(k => { listText += `> ${idx++}. ${k}\n`; });
            listText += `\n`;
        }
        if (audioKeys.length > 0) {
            listText += `*🎵 Audio Assets:*\n`;
            audioKeys.forEach(k => { listText += `> ${idx++}. ${k}\n`; });
            listText += `\n`;
        }
        if (fontKeys.length > 0) {
            listText += `*🔤 Font Assets:*\n`;
            fontKeys.forEach(k => { listText += `> ${idx++}. ${k}\n`; });
            listText += `\n`;
        }
        if (otherKeys.length > 0) {
            listText += `*📁 Other Assets:*\n`;
            otherKeys.forEach(k => { listText += `> ${idx++}. ${k}\n`; });
            listText += `\n`;
        }

        global.gantiAssetSessions[m.chat] = {
            sender: m.sender,
            buffer,
            linkUrl,
            detectedType,
            keys: orderedKeys,
            imageKeys,
            videoKeys,
            audioKeys,
            fontKeys
        };

        if (linkUrl) {
            listText += `_Sumber: link_ (${linkUrl})\n`;
            if (!detectedType) {
                listText += `_⚠️ Tipe file tidak terdeteksi dari URL, pastikan pilih key yang sesuai._\n`;
            }
            listText += `\n`;
        }

        await m.reply(listText.trim());

        setTimeout(() => {
            if (global.gantiAssetSessions[m.chat]) {
                delete global.gantiAssetSessions[m.chat];
            }
        }, 120000);

        m.react('✅');
    } catch (error) {
        m.react('☢');
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

async function gantiAssetAnswerHandler(m, sock) {
    if (!m.body) return false;
    if (!global.gantiAssetSessions) return false;

    const session = global.gantiAssetSessions[m.chat];
    if (!session) return false;
    if (session.sender !== m.sender) return false;

    const num = parseInt(m.body.trim());
    if (isNaN(num)) return false;

    if (num < 1 || num > session.keys.length) {
        if (m.quoted && m.quoted.fromMe) {
            await m.reply(`❌ Nomor tidak valid. Pilih antara 1-${session.keys.length}.`);
        }
        return false;
    }

    const selectedKey = session.keys[num - 1];
    const detectedType = session.detectedType;

    const typeChecks = [
        ['imageKeys', 'image', 'gambar (Image)'],
        ['videoKeys', 'video', 'video'],
        ['audioKeys', 'audio', 'audio'],
        ['fontKeys', 'font', 'dokumen font (.ttf/.otf)'],
    ];
    if (detectedType) {
        for (const [listName, type, label] of typeChecks) {
            if (session[listName]?.includes(selectedKey) && detectedType !== type) {
                await m.reply(`❌ Format tidak sesuai!\n> Asset *${selectedKey}* membutuhkan file ${label}.`);
                return true;
            }
        }
    }

    await m.react('🕕');

    try {
        let newPath;
        if (session.linkUrl) {
            newPath = await updateAssetLink(selectedKey, session.linkUrl);
        } else {
            let ext = '.jpg';
            if (detectedType === 'video') ext = '.mp4';
            else if (detectedType === 'audio') ext = '.mp3';
            else if (detectedType === 'font') ext = '.ttf';

            const filename = selectedKey + ext;
            newPath = await updateAssetUrl(selectedKey, session.buffer, filename);
        }

        await m.reply(`✅ *BERHASIL*\n\n> Asset *${selectedKey}* telah diganti ke:\n> ${newPath}\n> Config telah diupdate secara realtime!`);
        delete global.gantiAssetSessions[m.chat];
        await m.react('✅');
    } catch (e) {
        await m.react('❌');
        await m.reply(`❌ Gagal mengganti asset: ${e.message}`);
    }

    return true;
}

export { pluginConfig as config, handler, gantiAssetAnswerHandler };