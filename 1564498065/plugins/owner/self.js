import config from '../../config.js'
/**
 * @file plugins/owner/self.js
 * @description Plugin untuk mengaktifkan mode self (hanya owner & bot)
 */
import { getDatabase } from '../../src/lib/ichigo-database.js'
import te from '../../src/lib/ichigo-error.js'
const pluginConfig = {
    name: 'self',
    alias: ['selfmode', 'private-mode'],
    category: 'owner',
    description: 'Mengaktifkan mode self (hanya owner & bot yang bisa akses)',
    usage: '.self',
    example: '.self',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

/**
 * Handler untuk command self
 */
async function handler(m, { sock }) {
    try {
        const isRealOwner = validateOwner(m);
        if (!isRealOwner) {
            return await m.reply('🚫 *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n> _Hanya owner yang dapat mengubah mode bot!_');
        }
        const currentMode = config.mode;
        if (currentMode === 'self') {
            return await m.reply('ℹ️ *ɪɴꜰᴏʀᴍᴀsɪ*\n\n> Bot saat ini sudah berada dalam mode *Self*.');
        }
        config.mode = 'self';
        const db = getDatabase();
        db.setting('botMode', 'self');
        
        const responseText = `🔒 *sᴇʟꜰ ᴍᴏᴅᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ*\n\n` +
            `> Bot sekarang telah beralih ke mode *Self*.\n` +
            `> Akses dibatasi dan hanya merespon:\n` +
            `> • Owner Bot\n` +
            `> • Bot Sendiri (fromMe)\n\n` +
            `*Status*: 🔴 Hanya untuk owner\n` +
            `_Gunakan .public untuk membuka akses kembali._`;
        await m.reply(responseText);
        console.log(`[Mode] Changed to SELF by ${m.pushName} (${m.sender})`);
    } catch (error) {
        console.error('[Self Command Error]', error);
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