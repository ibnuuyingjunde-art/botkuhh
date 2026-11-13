import { delay } from 'ichigo';

const pluginConfig = {
    name: "fakemsg2",
    alias: ["fakemsg2"],
    category: "owner",
    description: "Memanipulasi atau mengedit pesan yang direply (Fake Edit).",
    usage: ".fakemsg2 <teks>",
    example: ".fakemsg2 Halo test",
    isOwner: true,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    const conn = sock || m.conn;

    if (!m.quoted) {
        return m.reply('Reply pesan yang ingin diproses.');
    }

    if (!text) {
        return m.reply('Masukkan teks pengganti.');
    }

    const stanzaId = m.quoted.id; //target stanza

    try {
        const tempId = await conn.relayMessage(
            m.chat,
            {
                extendedTextMessage: {
                    text: '',
                    contextInfo: {
                        isGroupStatus: true,
                    },
                },
            },
            {}
        );

        const tempId2 = await conn.relayMessage(
            m.chat,
            {
                protocolMessage: {
                    key: {
                        jid: m.chat,
                        fromMe: true,
                        id: tempId,
                    },
                    type: 14,
                    editedMessage: {
                        extendedTextMessage: {
                            text,
                            contextInfo: {
                                isGroupStatus: false,
                            },
                        },
                    },
                },
            },
            {
                messageId: stanzaId,
            }
        );

        await delay(100);

        await Promise.allSettled([
            conn.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    id: tempId,
                    fromMe: true,
                },
            }),
            conn.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    id: tempId2,
                    fromMe: true,
                },
            }),
        ]);
    } catch (e) {
        console.error('[fakemsg2]', e);
        await m.reply('Error: ' + (e?.message || e));
    }
}

export { pluginConfig as config, handler };