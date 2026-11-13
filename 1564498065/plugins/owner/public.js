import config from '../../config.js'
/**
 * @file plugins/owner/public.js
 * @description Plugin untuk mengaktifkan mode public (semua bisa akses)
 */
import { getDatabase } from '../../src/lib/ichigo-database.js'
import te from '../../src/lib/ichigo-error.js'
const pluginConfig = {
    name: 'public',
    alias: ['publicmode', 'open'],
    category: 'owner',
    description: 'Mengaktifkan mode public (semua user bisa akses)',
    usage: '.public',
    example: '.public',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

/**
 * Handler untuk command public
 */
async function handler(m, { sock }) {
    try {
        const isRealOwner = validateOwner(m);
        if (!isRealOwner) {
            return await m.reply('🚫 *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> _Hanya owner yang dapat mengubah mode bot!_');
        }
        const currentMode = config.mode;
        if (currentMode === 'public') {
            return await m.reply('ℹ️ *ɪɴꜰᴏʀᴍᴀsɪ*\n\n> Bot saat ini sudah berada dalam mode *Public*.');
        }
        config.mode = 'public';
        const db = getDatabase();
        db.setting('botMode', 'public');
        
        const responseText = `🌐 *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ*\n\n` +
            `> Bot sekarang telah beralih ke mode *Public*.\n` +
            `> Semua pengguna kini dapat mengakses perintah bot.\n\n` +
            `*Status*: 🟢 Terbuka untuk umum\n` +
            `_Gunakan .self untuk kembali ke mode privat._`;
        await m.reply(responseText);
        console.log(`[Mode] Changed to PUBLIC by ${m.pushName} (${m.sender})`);
    } catch (error) {
        console.error('[Public Command Error]', error);
        await m.reply(te(m.prefix, m.command, m.pushName));
    }
}

/**
 * Validasi owner dengan multiple checks
 */
function validateOwner(m) {
    if (!m.isOwner) return false;
    if (m.fromMe) return true;
    const senderNumber = m.sender?.replace(/[^0-9]/g, '') || '';
    const ownerNumbers = config.owner?.number || [];
    
    const isInOwnerList = ownerNumbers.some(owner => {
        const cleanOwner = owner.replace(/[^0-9]/g, '');
        return senderNumber.includes(cleanOwner) || cleanOwner.includes(senderNumber);
    });
    if (!isInOwnerList) return false;
    if (!m.sender || !m.sender.includes('@')) return false;
    return true;
}

export { pluginConfig as config, handler }