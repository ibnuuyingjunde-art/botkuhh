import config from "../../config.js";
import crypto from "crypto";

const pluginConfig = {
  name: "ichigocalc",
  alias: ["ccalc", "calcHTML"],
  category: "tools",
  description: "Kalkulator Interaktif berbasis HTML Widget",
  usage: ".ichigocalc",
  example: ".ichigocalc",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  m.react("🧮");

  const htmlContent = `<style>@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700;900&display=swap');*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;box-sizing:border-box}</style>\n<body style=\"margin:0;background:#0A0A0F;font-family:'Roboto',Arial,sans-serif;color:#fff;touch-action:manipulation\">\n<div style=\"width:100%;max-width:420px;margin:auto;padding:16px\">\n<div style=\"background:linear-gradient(180deg,#111118 0%,#0A0A0F 100%);border:2px solid #2A2A35;border-radius:18px;padding:20px;box-shadow:0 0 25px rgba(0,140,255,.12)\">\n<div style=\"font-size:11px;letter-spacing:2px;color:#00A2FF;margin-bottom:8px;font-weight:900\">LYNIX CALCULATOR</div>\n<div id=\"display\" style=\"background:#16161F;border:2px solid #2E2E3A;border-radius:12px;padding:18px;margin-bottom:16px;text-align:right;font-size:32px;font-weight:900;min-height:60px;word-wrap:break-word;box-shadow:inset 0 0 15px rgba(0,0,0,.4)\">0</div>\n<div id=\"sub\" style=\"text-align:right;font-size:14px;color:#8A8A9E;margin-top:-12px;margin-bottom:16px;height:18px\"> </div>\n<div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:10px\">\n<button class=\"btn op\" data-v=\"C\">C</button>\n<button class=\"btn op\" data-v=\"DEL\">⌫</button>\n<button class=\"btn op\" data-v=\"%\">%</button>\n<button class=\"btn op\" data-v=\"/\">÷</button>\n<button class=\"btn num\" data-v=\"7\">7</button>\n<button class=\"btn num\" data-v=\"8\">8</button>\n<button class=\"btn num\" data-v=\"9\">9</button>\n<button class=\"btn op\" data-v=\"*\">×</button>\n<button class=\"btn num\" data-v=\"4\">4</button>\n<button class=\"btn num\" data-v=\"5\">5</button>\n<button class=\"btn num\" data-v=\"6\">6</button>\n<button class=\"btn op\" data-v=\"-\">−</button>\n<button class=\"btn num\" data-v=\"1\">1</button>\n<button class=\"btn num\" data-v=\"2\">2</button>\n<button class=\"btn num\" data-v=\"3\">3</button>\n<button class=\"btn op\" data-v=\"+\">+</button>\n<button class=\"btn num\" data-v=\"0\" style=\"grid-column:span 2\">0</button>\n<button class=\"btn num\" data-v=\".\">.</button>\n<button class=\"btn eq\" data-v=\"=\">=</button>\n</div></div></div>\n<style>\n.btn{border:none;border-radius:10px;padding:16px;font-size:20px;font-weight:900;cursor:pointer;transition:.15s;background:#1F1F29;color:#fff;border:1px solid #2E2E3A}\n.btn:active{transform:scale(.92)}\n.num:hover{background:#25252F}\n.op{background:#23232E;color:#00A2FF}\n.op:hover{background:#2A2A35;box-shadow:0 0 10px rgba(0,162,255,.3)}\n.eq{background:linear-gradient(135deg,#00A2FF,#0080FF);color:#fff;box-shadow:0 0 15px rgba(0,162,255,.4)}\n.eq:hover{filter:brightness(1.15)}\n</style>\n<script>\nlet expr='',display=document.getElementById('display'),sub=document.getElementById('sub');\nfunction update(){\ndisplay.textContent=expr||'0';\n}\nfunction calc(){\ntry{\nlet res=Function('return '+expr.replace(/×/g,'*').replace(/÷/g,'/'))();\nsub.textContent=expr+' =';\nexpr=String(res);\n}catch(e){expr='Error';setTimeout(()=>{expr=''},1200)}\nupdate();\n}\ndocument.querySelectorAll('.btn').forEach(b=>{\nb.onclick=()=>{\nlet v=b.dataset.v;\nif(v==='C'){expr='';sub.textContent=' '}\nelse if(v==='DEL'){expr=expr.slice(0,-1)}\nelse if(v==='='){calc();return}\nelse{expr+=v}\nupdate();\n}\n});\n</script></body>`;

  const unifiedData = Buffer.from(
    JSON.stringify({
      response_id: "calc-" + crypto.randomUUID(),
      sections: [
        {
          view_model: {
            primitive: {
              __typename: "GenAIaeacdsnwHtmlPrimitive",
              payload: htmlContent,
              trusted_sources: ["ichigo.dev"],
            },
            __typename: "GenAISingleLayoutViewModel",
          },
        },
      ],
    })
  ).toString("base64");

  const messagePayload = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: "",
        botResponseId: "calc-" + crypto.randomUUID(),
        verificationMetadata: {
          proofs: [
            {
              version: 1,
              useCase: 1,
              signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
              certificateChain: [
                "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
              ]
            }
          ]
        }
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [
            {
              messageType: 2,
              messageText: "LYNIX CALC"
            }
          ],
          unifiedResponse: {
            data: unifiedData
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "867051314767696@bot"
            },
            forwardOrigin: 4
          }
        }
      }
    }
  };

  await sock.relayMessage(m.chat, messagePayload, {
    additionalNodes: []
  });
  
  m.react("✅");
}

export { pluginConfig as config, handler };