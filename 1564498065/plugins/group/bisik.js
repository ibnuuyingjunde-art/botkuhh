import { sendBatchPrivateRelayUnified } from "../../src/spr/sbpr.js";

const pluginConfig = {
    name: "bisik",
    alias: ["bisikreply", "secretreply", "hiddenreply"],
    category: "group",
    description: "Kirim pesan rahasia (sBPR) via Reply atau Tag target",
    usage: ".bisik <reply pesan / tag target> <pesan rahasia>",
    example: ".bisik @628123456789 woi lu mau kmna",
    isGroup: true,
    isEnabled: true,
};

async function handler(m, { sock, text, prefix, command }) {
    const conn = sock || m.conn;

    // 1. Tentukan Target JID (Bisa dari Reply atau dari Tag Pertama)
    let targetJid = m.quoted ? m.quoted.sender : (m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : null);

    if (!targetJid) {
        return m.reply(
            `❌ *Format Salah!*\n\n` +
            `> *Cara 1 (Reply):* Balas pesan target lalu ketik:\n` +
            `> *${prefix + command} <pesan rahasianya>*\n\n` +
            `> *Cara 2 (Tag):* Ketik langsung dengan mention target:\n` +
            `> *${prefix + command} @tag_target <pesan rahasianya>*`
        );
    }

    if (!text) {
        return m.reply(`❌ *Pesan tidak boleh kosong!*\n\n> Contoh: *${prefix + command} woy besok jadi nongkrong ga?*`);
    }

    // Bersihkan teks pesan (jika memakai cara Tag, hapus teks tag angka/username di depan agar pesan rapi)
    let secretMessage = text.trim();
    if (!m.quoted && m.mentionedJid && m.mentionedJid.length > 0) {
        // Hapus tag pertama jika pengguna mengetik .bisik @user pesan
        secretMessage = secretMessage.replace(/@\d+/g, '').trim();
    }

    if (!secretMessage) {
        return m.reply(`❌ *Tuliskan isi pesan rahasianya!*`);
    }

    await m.react("⏳");

    try {
        // 2. Format Pesan Asli (Teks murni + support tag/mentions)
        const privateProtoMsg = {
            extendedTextMessage: {
                text: secretMessage,
                contextInfo: {
                    mentionedJid: m.mentionedJid || []
                }
            }
        };

        // 3. Eksekusi sBPR
        await sendBatchPrivateRelayUnified(
            conn, 
            m.chat, 
            [targetJid], 
            privateProtoMsg, 
            {
                // Pesan kamuflase untuk member grup lain
                msgForOthers: "🔒 _Seseorang mengirim pesan rahasia._",
                verbose: false
            }
        );

        await m.react("✅");

    } catch (e) {
        console.error('[Bisik sBPR Error]', e);
        await m.react("❌");
        return m.reply(`⚠️ *Gagal mengirim pesan rahasia.*\n\n> Error: ${e.message || e}`);
    }
}

export { pluginConfig as config, handler };