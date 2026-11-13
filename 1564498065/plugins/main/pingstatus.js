import config from '../../config.js'

const pluginConfig = {
    name: 'pingstatus',
    alias: ['pings', 'stat', 'cekstatus'],
    category: 'main',
    description: 'Cek ping, uptime, RAM, dan status bot dengan Interactive UI',
    usage: '.pingstatus',
    example: '.pingstatus',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function fmtUptime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${h}h ${m}m ${s}s`
}

function fmtRam(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

async function handler(m, { sock }) {
    try {
        const start = Date.now()

        const ramUsed = process.memoryUsage().rss
        const uptime = fmtUptime(process.uptime())

        const textStatus = 
            `*Ping:* ${Date.now() - start}ms\n` +
            `*Up:* ${uptime}\n` +
            `*RAM:* ${fmtRam(ramUsed)}\n` +
            `*Status:* Online`

        const interactiveData = {
          "response_id": "742a451a-0c33-45ca-a205-42c2b1666bca",
          "sections": [
            {
              "view_model": {
                "primitive": {
                  "__typename": "FOATextPrimitive",
                  "text": "# 📊 Bot System Status"
                },
                "__typename": "GenAISingleLayoutViewModel"
              }
            },
            {
              "view_model": {
                "primitive": {
                  "text": textStatus,
                  "__typename": "GenAIMarkdownTextUXPrimitive"
                },
                "__typename": "GenAISingleLayoutViewModel"
              }
            },
            {
              "view_model": {
                "primitive": {
                  "__typename": "GenAIImagePrimitive",
                  "preview_image": {
                    "__typename": "GenAIMediaItem",
                    "mime_type": "image/jpeg",
                    "url": "https://cdn.ornzora.eu.cc/f4ec8425-c846-4937-b838-9291bf0514e2-FIORA.jpg"
                  },
                  "full_image": {
                    "__typename": "GenAIMediaItem",
                    "mime_type": "image/jpeg",
                    "url": "https://cdn.ornzora.eu.cc/2fa0763e-011f-4d18-b69b-32dd24282393-FIORA.jpg"
                  }
                },
                "__typename": "GenAISingleLayoutViewModel"
              }
            },
            {
              "view_model": {
                "primitives": [
                  {
                    "__typename": "GenAI3PExtWidgetPrimitive",
                    "header": {
                      "__typename": "GenAI3PExtWidgetStandardHeader",
                      "title": "Menu-1" 
                    },
                    "body": {
                      "__typename": "GenAI3PExtCalendarEventList",
                      "sections": [],
                      "ctas": [
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xmenu",
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "00",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        },
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xprofile",
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "01",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        },
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xscript",
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "02",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        }
                      ]
                    }
                  },
                  {
                    "__typename": "GenAI3PExtWidgetPrimitive",
                    "header": {
                      "__typename": "GenAI3PExtWidgetStandardHeader",
                      "title": "Menu-2" 
                    },
                    "body": {
                      "__typename": "GenAI3PExtCalendarEventList",
                      "sections": [],
                      "ctas": [
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xallmenu", 
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "10",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        },
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xmenucat", 
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "11",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        },
                        {
                          "__typename": "GenAI3PExtWidgetCTA",
                          "label": "Xping", 
                          "state": "PENDING",
                          "kind": "OTHER",
                          "tool_call_id": "12",
                          "toast": {
                            "__typename": "GenAI3PExtWidgetToast",
                            "label": "NIX"
                          }
                        }
                      ]
                    }
                  }
                ],
                "__typename": "GenAIHScrollLayoutViewModel"
              }
            },
            {
              "view_model": {
                "primitives": [
                  {
                    "__typename": "GenAIFooterActionPrimitive",
                    "cta_text": "WhatsApp Group",
                    "cta_type": "OPEN_URL",
                    "cta_url": "https://chat.whatsapp.com/J4bfe0Bhxwa0hVMkJJnogG"
                  },
                  {
                    "__typename": "GenAIFooterActionPrimitive",
                    "cta_text": "WhatsApp Channel",
                    "cta_type": "OPEN_URL",
                    "cta_url": "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c"
                  }
                ],
                "__typename": "GenAIHScrollLayoutViewModel"
              }
            }
          ]
        };

        await sock.relayMessage(
          m.chat,
          {
            messageContextInfo: {
              messageSecret: "v/3VN8Gfr2dbKzgt1GKDEU7ovyYW+nswh4Duwq6KDuU="
            },
            botForwardedMessage: {
              message: {
                richResponseMessage: {
                  messageType: 1,
                  unifiedResponse: {
                    data: Buffer.from(JSON.stringify(interactiveData)).toString('base64')
                  },
                  contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardOrigin: 4
                  }
                }
              }
            }
          },
          { quoted: m }
        );
        
    } catch (error) {
        console.log(error)
        m.reply('❌ Gagal mengambil status bot.')
    }
}

export { pluginConfig as config, handler }