

import config from "../../config.js";
import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), 'storage', 'pm-notif.json');
const COOLDOWN_MS = 2 * 60 * 1000;

if (!global._pmNotifTracker) global._pmNotifTracker = new Map();

function readStore() {
    try {
        if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    } catch {}
    return { enabled: true }
}

function writeStore(data) {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch {}
}

async function handlePmNotif(m, sock) {
    if (m.isGroup) return;
    if (m.fromMe) return;
    if (m.isOwner) return;
    if (!m.sender) return;

    const store = readStore();
    if (!store.enabled) return;

    const senderNum = m.sender.split('@')[0].split(':')[0];
    const now = Date.now();
    const lastNotif = global._pmNotifTracker.get(senderNum) || 0;
    if (now - lastNotif < COOLDOWN_MS) return;
    global._pmNotifTracker.set(senderNum, now);

    const nama = m.pushName || senderNum;
    const isiPesan = m.body
        ? (m.body.length > 200 ? m.body.slice(0, 200) + '...' : m.body)
        : `[${m.type || 'media'}]`;

    const waktu = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const teks =
        `📩 *ᴘᴇsᴀɴ ᴘʀɪʙᴀᴅɪ ᴍᴀsᴜᴋ!*\n\n` +
        `┃ 👤 Dari    : *${nama}*\n` +
        `┃ 📞 Nomor   : *+${senderNum}*\n` +
        `┃ 🕐 Waktu   : *${waktu}*\n` +
        `┃ 💬 Pesan   : ${isiPesan}\n\n` +
        `> Balas langsung ke: wa.me/${senderNum}`;

    const targets = [];

    const ownerNumbers = Array.isArray(config.owner?.number)
        ? config.owner.number
        : config.owner?.number ? [config.owner.number] : [];
    for (const num of ownerNumbers) {
        const clean = num.replace(/[^0-9]/g, '');
        if (clean) targets.push(clean + '@s.whatsapp.net');
    }

    const notifGroup = store.notifGroup || config.autoSession?.notifGroup;
    if (notifGroup) targets.push(notifGroup);

    for (const target of targets) {
        try {
            await sock.sendMessage(target, {
                text: teks,
                mentions: [`${senderNum}@s.whatsapp.net`]
            });
        } catch {}
    }
}

export { handlePmNotif, readStore, writeStore };
