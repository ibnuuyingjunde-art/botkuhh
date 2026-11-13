import { prepareWAMessageMedia, generateWAMessageFromContent } from 'ichigo';

const pluginConfig = {
    name: "pairedmedia",
    alias: ["pmedia", "sendalbum"],
    category: "tools",
    description: "Mengirim gambar dan video yang ditautkan (Paired Media).",
    usage: ".pairedmedia",
    example: ".pairedmedia",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, prefix, command }) {
    const conn = sock || m.conn;

    try {
        await m.react('⏳');

        // 1. Mempersiapkan media gambar
        const image = await prepareWAMessageMedia(
            {
                image: {
                    url: 'https://cdn.ornzora.eu.cc/a6a1e8f4-b83d-4694-9bba-0f22a58bfd4f-FIORA.jpg'
                }
            },
            {
                upload: conn.waUploadToServer
            }
        );

        // 2. Mempersiapkan media video
        const video = await prepareWAMessageMedia(
            {
                video: {
                    url: 'https://cdn.ornzora.eu.cc/ed7ebb66-9bf4-44b6-858a-b6b7405e53c5-FIORA.mp4'
                }
            },
            {
                upload: conn.waUploadToServer
            }
        );

        // 3. Membuat pesan gambar dengan konteks paired media
        const msg = generateWAMessageFromContent(
            m.chat,
            {
                imageMessage: {
                    ...image.imageMessage,
                    contextInfo: {
                        pairedMediaType: 5,
                        statusSourceType: 0
                    }
                }
            },
            {}
        );

        // 4. Mengirim pesan gambar pertama
        await conn.relayMessage(m.chat, msg.message, {
            messageId: msg.key.id
        });

        // 5. Mengirim pesan video yang diasosiasikan (parentMessageKey) dengan gambar sebelumnya
        await conn.relayMessage(
            m.chat,
            {
                videoMessage: {
                    ...video.videoMessage,
                    contextInfo: {
                        pairedMediaType: 6,
                        statusSourceType: 0
                    },
                },
                messageContextInfo: {
                    messageAssociation: {
                        associationType: 12,
                        parentMessageKey: msg.key
                    }
                }
            },
            {}
        );

        await m.react('✅');

    } catch (error) {
        console.error("[PairedMedia Plugin Error]:", error);
        await m.react('❌');
        m.reply(`Maaf *${m.pushName}*, terjadi kesalahan saat mengirim media: ${error.message || error}`);
    }
}

export { pluginConfig as config, handler };