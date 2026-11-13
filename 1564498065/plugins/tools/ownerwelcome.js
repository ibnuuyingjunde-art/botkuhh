import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
    name: 'ownerwelcome',
    alias: [],
    category: 'tools',
    description: 'Auto sambutan + tag owner (toggle on/off)',
    usage: '.ownerwelcome <on/off>',
    example: '.ownerwelcome off',
    isOwner: true,
    isGroup: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

const SETTING_KEY = 'ownerWelcome';

// default AKTIF (biar perilaku lama tetap sama sebelum toggle pernah dipakai)
function isOwnerWelcomeOn() {
    return getDatabase().setting(SETTING_KEY) !== false;
}

if (!global._ownerWelcomeTracker) global._ownerWelcomeTracker = new Map();
const COOLDOWN_MS = 60 * 60 * 1000; 

async function autoWelcome(m, { sock }) {
    if (!m.isGroup || m.fromMe) return;
    if (m.isCommand && m.command === pluginConfig.name) return;
    if (!isOwnerWelcomeOn()) return;

    const senderNum = (m.sender || m.key?.participant || '').split('@')[0].split(':')[0];
    const senderJid = `${senderNum}@s.whatsapp.net`;

    const ownerList = Array.isArray(config.owner?.number)
        ? config.owner.number.map(n => n.replace(/[^0-9]/g, ''))
        : [String(config.owner?.number || '').replace(/[^0-9]/g, '')];

    if (!ownerList.includes(senderNum)) return;

    const trackerKey = `${m.chat}_${senderNum}`;
    const now = Date.now();
    if (now - (global._ownerWelcomeTracker.get(trackerKey) || 0) < COOLDOWN_MS) return;
    global._ownerWelcomeTracker.set(trackerKey, now);

    const teks1 = `𝜙﹒GEMPAR! 𝅄
 ╰─  𓆩 @${senderNum} 𓆪 owner bot turun gunung nih 🏔️
semuanya sujud dulu, jangan kabur~ 🫡
gas aja langsung, gak gigit kok 😂`;

    const teks2 = `𝜙﹒INFO! 𝅄
 ╰─ @${senderNum} bot siap melayani 24 jam nonstop~ ⚡
ada yang perlu dibantu? bilang aja bos! 🫶`;

    const teks3 = `𝜙﹒TOXIC! 𝅄
 ╰─ anjir @${senderNum} dateng, pada diem semua
bos dateng malah pada pura-pura sibuk 💀`;

    const teks4 = `𝜙﹒KANGEN! 𝅄
 ╰─ aduh @${senderNum} online, auto dag dig dug nih jantungnya 😩
siapa yang kangen? gw tau kalian kangen 🫦`;

    const teks5 = `𝜙﹒SALTING! 𝅄
 ╰─ @${senderNum} dateng langsung pada salting semua 😏
tenang aja, gw juga kangen kok sama kalian~ 💀🫶`;

    const teks6 = `𝜙﹒SIAGA! 𝅄
 ╰─ WOY BOS DATENG @${senderNum} 🚨
buruan rapiin chat, jangan sampe ketauan bucin di grup sebelah 🏃‍♂️`;

    const teks7 = `𝜙﹒HORMAT! 𝅄
 ╰─ 𓆩 @${senderNum} 𓆪 sudah memasuki grup
mohon tundukkan kepala, angkat gelas, hormat grak 🫡🥂`;

    const teks8 = `𝜙﹒PANIK! 𝅄
 ╰─ ANJAY @${senderNum} online 😱
yang tadi ngegas di grup buruan hapus chat sebelum ketauan 💀`;

    const teks9 = `𝜙﹒VVIP! 𝅄
 ╰─ karpet merah digelar, @${senderNum} owner kesayangan telah tiba 👑
selamat datang bos, semoga harimu menyenangkan~ ✨`;

    const teks10 = `𝜙﹒SANTUY! 𝅄
 ╰─ eh @${senderNum} dateng, woy pada woles aja
gak perlu formal-formal, anggep aja lagi nongkrong bareng ☕`;

    const teks11 = `𝜙﹒RADAR! 𝅄
 ╰─ *beep beep* radar bot mendeteksi @${senderNum} masuk grup 📡
status: owner terverifikasi, akses penuh diberikan ✅`;

    const teks12 = `𝜙﹒NOSTALGIA! 𝅄
 ╰─ @${senderNum} balik lagi ke sini nih 🥹
udah lama gak keliatan, kangen suasana rame bareng bos~`;

    const teks13 = `𝜙﹒WARNING! 𝅄
 ╰─ ⚠️ @${senderNum} owner terdeteksi memasuki area grup
seluruh member harap tenang, sistem lagi dipantau langsung 👀`;

    const teks14 = `𝜙﹒GACOR! 𝅄
 ╰─ mantap @${senderNum} udah standby 🔥
grup auto rame kalo bos udah online kayak gini~`;

    const teks15 = `𝜙﹒MISTERI! 𝅄
 ╰─ kabut menghilang, sosok @${senderNum} muncul dari balik layar 🌫️
katanya sih owner, tapi aslinya baik banget kok 😇`;

    const teks16 = `𝜙﹒UPGRADE! 𝅄
 ╰─ sistem grup ke-upgrade otomatis karena @${senderNum} join 📶
performa naik 200%, member auto semangat 💪`;

    const teks17 = `𝜙﹒LEGEND! 𝅄
 ╰─ the legend has arrived~ @${senderNum} 🏆
grup ini resmi jadi lebih berfaedah sekarang`;

    const teks18 = `𝜙﹒ALARM! 𝅄
 ╰─ 🔔 alarm owner berbunyi, @${senderNum} resmi online
siapa yang tadi julid di belakang, buruan tobat 🙏`;

    const allTeks = [
        teks1, teks2, teks3, teks4, teks5, teks6,
        teks7, teks8, teks9, teks10, teks11, teks12,
        teks13, teks14, teks15, teks16, teks17, teks18,
    ];

    const randomTeks = allTeks[Math.floor(Math.random() * allTeks.length)];

    await sock.readMessages([m.key]);

    await m.reply(randomTeks, {
        mentions: [senderJid],
    });
}

async function handler(m, { db }) {
    const action = (m.args?.[0] || '').toLowerCase();
    const current = db.setting(SETTING_KEY) !== false;

    if (!['on', 'off'].includes(action)) {
        return m.reply(
            `👑 *ᴏᴡɴᴇʀ ᴡᴇʟᴄᴏᴍᴇ*\n\n` +
            `> Sambutan otomatis pas owner chat di grup\n\n` +
            `╭┈┈⬡「 📊 *sᴛᴀᴛᴜs* 」\n` +
            `┃ ${current ? '✅ *AKTIF*' : '❌ *NONAKTIF*'}\n` +
            `╰┈┈┈┈┈┈┈┈⬡\n\n` +
            `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
            `┃ ${m.prefix}ownerwelcome on\n` +
            `┃ ${m.prefix}ownerwelcome off\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        );
    }

    const status = action === 'on';
    db.setting(SETTING_KEY, status);
    await db.save();
    await m.react(status ? '✅' : '❌');

    return m.reply(
        status
            ? `✅ *ᴏᴡɴᴇʀ ᴡᴇʟᴄᴏᴍᴇ ᴏɴ*\n\n> Owner bakal disambut otomatis pas chat di grup.`
            : `❌ *ᴏᴡɴᴇʀ ᴡᴇʟᴄᴏᴍᴇ ᴏꜰꜰ*\n\n> Sambutan otomatis owner dimatiin.`
    );
}

export { pluginConfig as config, handler, autoWelcome };