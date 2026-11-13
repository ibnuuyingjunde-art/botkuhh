import os from 'os';
import { randomUUID } from 'crypto';
import config from '../../config.js';
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "botactive",
  alias: ["bot", "aktif"],
  category: "tools",
  description: "Auto reply status aktif bot dengan kartu HTML elegan",
  isOwner: false,
  isGroup: false,
  isEnabled: true,
};

if (!global._botActiveCooldown) global._botActiveCooldown = new Map();
const COOLDOWN_MS = 5 * 1000; 

async function handler(m, { sock }) {
  if (m.fromMe) return;

  const teks = (m.body || m.text || "").trim().toLowerCase();
  if (teks !== "bot") return;

  const senderNum = (m.sender || "").split("@")[0].split(":")[0];
  const key = `${m.chat}_${senderNum}`;
  const now = Date.now();
  if (now - (global._botActiveCooldown.get(key) || 0) < COOLDOWN_MS) return;
  global._botActiveCooldown.set(key, now);

  const conn = sock || m.conn;
  const start = Date.now();
  const responseId = randomUUID();

  const botName = config.bot?.name || "lyniX's MD";
  const botUpSec = Math.floor(process.uptime());
  const speed = Date.now() - start;
  const isBun = typeof Bun !== 'undefined';
  const runtimeEnv = isBun ? `Bun ${Bun.version}` : `Node ${process.version}`;
  const cpuCores = os.cpus().length;

  const DATA = JSON.stringify({
    botUpSec,
    at: Date.now(),
  }).replace(/</g, '\\u003c');

  const HTML_BOT_ACTIVE = `<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
html,body{width:100%}
body{background:#04070f;padding:6px;color:#f1f5f9;overflow-y:auto}
#app{max-width:410px;margin:0 auto;background:linear-gradient(145deg,#0c1425,#070b14);border:1px solid rgba(56,189,248,0.18);border-radius:18px;padding:12px;box-shadow:0 12px 35px -10px rgba(0,0,0,0.6)}

.hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:10px}
.hdr h1{font-size:15px;font-weight:800;letter-spacing:0.3px;color:#f8fafc}
.badge{display:inline-flex;align-items:center;gap:5px;font-size:9.5px;font-weight:600;color:#38bdf8;background:rgba(56,189,248,0.08);padding:2px 7px;border-radius:12px;border:1px solid rgba(56,189,248,0.15)}
.badge i{width:5.5px;height:5.5px;border-radius:50%;background:#38bdf8;box-shadow:0 0 6px #38bdf8;animation:pulse-dot 1.5s infinite}
@keyframes pulse-dot{0%{transform:scale(0.95);opacity:0.8}50%{transform:scale(1.3);opacity:1}100%{transform:scale(0.95);opacity:0.8}}

.uptime-card{background:linear-gradient(135deg,rgba(14,165,233,0.08),rgba(99,102,241,0.05));border:1px solid rgba(14,165,233,0.2);border-radius:12px;padding:10px;text-align:center;margin-bottom:9px}
.uptime-card small{font-size:7.5px;font-weight:700;letter-spacing:1px;color:#38bdf8;text-transform:uppercase}
.uptime-card b{display:block;font-size:15px;font-weight:800;color:#e0f2fe;margin-top:2px;font-variant-numeric:tabular-nums}
.uptime-card span{font-size:9px;color:#94a3b8;margin-top:1px;display:block}

.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}
.cell{background:rgba(255,255,255,0.018);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:7px 9px}
.cell i{display:block;font-size:7.5px;font-style:normal;font-weight:700;letter-spacing:0.7px;color:#64748b;margin-bottom:1px}
.cell b{font-size:10.5px;font-family:monospace;color:#cbd5e1;word-break:break-word}

.status-box{background:rgba(74,222,128,0.03);border:1px solid rgba(74,222,128,0.15);border-radius:10px;padding:7px 10px;margin-bottom:9px;display:flex;align-items:center;gap:6px}
.status-box span{font-size:10.5px;color:#4ade80;font-weight:600}

.footer{display:flex;justify-content:space-between;align-items:center;font-size:8.5px;color:#64748b;font-family:monospace;border-top:1px solid rgba(255,255,255,0.04);padding-top:7px}
.footer b{color:#38bdf8;font-weight:600}
</style>
<div id="app">
<div class="hdr">
  <h1>🤖 ${botName}</h1>
  <div class="badge"><i></i>SYSTEM ONLINE</div>
</div>

<div class="uptime-card">
  <small>⏱️ Bot Active Uptime</small>
  <b id="up">-</b>
  <span id="clock">- WITA</span>
</div>

<div class="grid">
  <div class="cell"><i>LATENCY SPEED</i><b>${speed} ms</b></div>
  <div class="cell"><i>CPU CORES</i><b>${cpuCores} Core</b></div>
  <div class="cell" style="grid-column:1/-1"><i>RUNTIME ENGINE</i><b>${runtimeEnv}</b></div>
</div>

<div class="status-box">
  <span>🟢 Layanan aktif dan siap melayani perintah</span>
</div>

<div class="footer">
  <span id="age">diperbarui baru saja</span>
  <b>✨ Engine v2</b>
</div>
</div>

<script>
var D=${DATA};
function tick(){
  var el=Math.floor((Date.now()-D.at)/1000);
  var currentUp=D.botUpSec+el;
  
  var h=Math.floor(currentUp/3600), m=Math.floor((currentUp%3600)/60), s=Math.floor(currentUp%60);
  var upText=[];
  if(h>0)upText.push(h+' jam');
  if(m>0)upText.push(m+' menit');
  upText.push(s+' detik');
  document.getElementById('up').textContent=upText.join(' ');

  var nowWita=new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
  var timeStr=nowWita.toTimeString().split(' ')[0];
  document.getElementById('clock').textContent='Waktu: '+timeStr+' WITA';

  document.getElementById('age').textContent='diperbarui '+el+' dtk lalu';
}
setInterval(tick,1000);tick();
</script>`;

  try {
    const ai = new AIRich(conn);
    ai.setResponseId(responseId);
    ai.setBotResponseId(responseId);
    ai.addText(`🤖 ${botName} is Online!`);

    const messagePayload = await ai.build(m.chat, {
      messageId: responseId,
      forwarded: true,
      includesUnifiedResponse: true,
      includesSubmessages: true,
    });

    if (messagePayload.message?.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse) {
      let decodedData = JSON.parse(
        Buffer.from(
          messagePayload.message.botForwardedMessage.message.richResponseMessage.unifiedResponse.data,
          'base64'
        ).toString('utf8')
      );

      decodedData.sections = [
        {
          view_model: {
            primitive: {
              __typename: "GenAIaeacdsnwHtmlPrimitive",
              payload: HTML_BOT_ACTIVE,
              trusted_sources: [],
            },
            __typename: "GenAISingleLayoutViewModel",
          },
        },
      ];

      messagePayload.message.botForwardedMessage.message.richResponseMessage.unifiedResponse.data = 
        Buffer.from(JSON.stringify(decodedData)).toString('base64');
    }

    await conn.relayMessage(m.chat, messagePayload.message, {
      messageId: messagePayload.key.id,
      additionalNodes: [
        {
          tag: 'biz',
          attrs: {},
          content: [
            {
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
            },
          ],
        },
      ],
    });

    await ai.sendEdit(m.chat, messagePayload.key.id, {
      msg: messagePayload.message,
    });

  } catch (e) {
    console.error('[BOTACTIVE Error]', e);
    return m.reply('⚠️ Gagal memuat status bot: ' + (e?.message || e));
  }
}

export { pluginConfig as config, handler };