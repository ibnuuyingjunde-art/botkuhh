import { getAllPlugins } from '../../src/lib/ichigo-plugins.js';
import config from '../../config.js';
import te from '../../src/lib/ichigo-error.js';
import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;
import { randomUUID } from 'crypto';

const pluginConfig = {
    name: 'totalfitur2',
    alias: ['totalfeature2', 'totalcmd2', 'countplugin2', 'distribusi2'],
    category: 'main',
    description: 'Lihat total fitur bot dengan bar progres dan grid tombol scroll',
    usage: '.totalfitur2',
    example: '.totalfitur2',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

const ICONS = {
    main: '🏠', tools: '🔧', downloader: '📥', download: '📥', sticker: '🎨',
    ai: '🤖', media: '📷', game: '🎮', rpg: '⚔️', maker: '🖼️', fun: '🎭',
    group: '👥', owner: '👑', premium: '💎', info: '📊', search: '🔍',
    canvas: '🎨', anime: '🌸', nsfw: '🔞', utility: '🛠️', economy: '💰',
    stalker: '🔎', random: '🎲', religi: '🕌', islamic: '☪️', cek: '✅',
    store: '🛒', panel: '🖥️', convert: '🔄', primbon: '🔮', tts: '🗣️',
    otp: '🔑', vps: '☁️', pushkontak: '📱', jpm: '🎰', ephoto: '📸',
    user: '👤', clan: '🏰', cecan: '👩', colorgrade: '🌈', asupan: '📹',
    internet: '🌐', music: '🎵', linode: '☁️', general: '📋', berita: '📰',
    information: 'ℹ️', entertainment: '🎪', quotes: '💬',
    other: '📦'
};

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateHtml({ total, enabled, sortedCategories, botName }) {
  const safeBotName = escapeHtml(String(botName || 'OURIN BOT').toUpperCase());
  const activePercent = total > 0 ? ((enabled / total) * 100).toFixed(1) : '100';

  const categoryBoxes = sortedCategories.map(([cat, data]) => {
    const icon = ICONS[cat] || '📦';
    const name = escapeHtml(cat.toUpperCase());
    const count = data.total;

    return `
      <div class="cat-box">
        <div class="cat-icon">${icon}</div>
        <div class="cat-info">
          <div class="cat-name">${name}</div>
          <div class="cat-count">${count} Cmd</div>
        </div>
      </div>
    `;
  }).join('');

  return `
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:transparent;color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;padding:4px}

  .dashboard{width:100%;max-width:320px;background:#090a0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,0.9);padding:14px}

  .sys-header{display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700}
  .sys-status{color:#3fb950;display:flex;align-items:center;gap:4px}
  .sys-status::before{content:'';width:6px;height:6px;background:#3fb950;border-radius:50%;display:inline-block;box-shadow:0 0 6px #3fb950}

  .title{font-size:13px;font-weight:800;color:#fff;margin-bottom:10px;display:flex;align-items:center;gap:6px}

  .matrix-grid{display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;margin-bottom:10px}
  .matrix-box{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px;text-align:center}
  .matrix-num{font-size:14px;font-weight:800;color:#58a6ff;margin-bottom:1px}
  .matrix-label{font-size:7.5px;color:#8b949e;text-transform:uppercase;font-weight:600}

  .progress-section{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:8px 10px;margin-bottom:10px}
  .prog-header{display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;font-weight:600}
  .prog-title{color:#e6edf3}
  .prog-pct{color:#3fb950}
  .progress-track{width:100%;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden}
  .progress-bar{height:100%;background:linear-gradient(90deg, #3b82f6, #3fb950);border-radius:3px}

  .section-label{font-size:9.5px;color:#8b949e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-weight:700}

  .scroll-area-wrapper{display:flex;gap:6px;align-items:center}
  .grid-container{flex:1;display:grid;grid-template-columns:repeat(2, 1fr);gap:6px;max-height:140px;overflow-y:auto;padding-right:2px;scroll-behavior:smooth;scrollbar-width:none}
  .grid-container::-webkit-scrollbar{display:none}

  .scroll-controls{display:flex;flex-direction:column;gap:4px;width:20px;flex-shrink:0}
  .sc-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:9px;height:66px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
  .sc-btn:active{background:rgba(255,255,255,0.2);transform:scale(0.95)}

  .cat-box{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:6px;display:flex;align-items:center;gap:6px}
  .cat-icon{font-size:14px}
  .cat-info{overflow:hidden}
  .cat-name{font-size:9px;font-weight:700;color:#e6edf3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cat-count{font-size:8px;color:#8b949e;font-weight:500}

  .sys-footer{border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;padding-top:6px;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#6e7681;font-weight:600}
  .tag{background:rgba(255,255,255,0.05);color:#c9d1d9;padding:2px 6px;border-radius:4px}
</style>

<div class="dashboard">
  <div class="sys-header">
    <span class="sys-status">CORE ACTIVE</span>
    <span>SYSTEM METRICS</span>
  </div>

  <div class="title">📊 STATISTIK FITUR BOT</div>

  <div class="matrix-grid">
    <div class="matrix-box">
      <div class="matrix-num" style="color:#58a6ff">${total}</div>
      <div class="matrix-label">Total Fitur</div>
    </div>
    <div class="matrix-box">
      <div class="matrix-num" style="color:#3fb950">${enabled}</div>
      <div class="matrix-label">Fitur Aktif</div>
    </div>
  </div>

  <div class="progress-section">
    <div class="prog-header">
      <span class="prog-title">Keaktifan Sistem</span>
      <span class="prog-pct">${activePercent}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" style="width: ${activePercent}%"></div>
    </div>
  </div>

  <div class="section-label">Daftar Kategori</div>

  <div class="scroll-area-wrapper">
    <div class="grid-container" id="gridBox">
      ${categoryBoxes}
    </div>
    <div class="scroll-controls">
      <button class="sc-btn" onclick="document.getElementById('gridBox').scrollBy({top: -90, behavior: 'smooth'})">▲</button>
      <button class="sc-btn" onclick="document.getElementById('gridBox').scrollBy({top: 90, behavior: 'smooth'})">▼</button>
    </div>
  </div>

  <div class="sys-footer">
    <span class="tag">${safeBotName}</span>
    <span>DISTRIBUSI SYSTEM</span>
    <span class="tag">${enabled} AKTIF</span>
  </div>
</div>`;
}

function buildTextStats({ total, enabled, sortedCategories }) {
    const pct = total > 0 ? ((enabled / total) * 100).toFixed(1) : '100';
    const lines = sortedCategories.map(([cat, d]) => {
        const icon = ICONS[cat] || '📦';
        const p = total > 0 ? ((d.total / total) * 100).toFixed(1) : '0';
        return `${icon} *${cat.toUpperCase()}* — ${d.total} cmd (${p}%)`;
    });
    return (
        `📊 *STATISTIK FITUR BOT*\n\n` +
        `Total: *${total}* | Aktif: *${enabled}* (${pct}%)\n` +
        `Kategori: *${sortedCategories.length}*\n\n` +
        lines.join('\n')
    );
}

async function handler(m, { sock }) {
    await m.react('⏳');

    let statsData = null;

    try {
        const allPlugins = getAllPlugins();
        const cats = {};
        let total = 0, enabled = 0;

        for (const p of allPlugins) {
            if (!p.config) continue;
            const cat = (p.config.category || 'other').toLowerCase();
            if (!cats[cat]) cats[cat] = { total: 0, enabled: 0 };
            cats[cat].total++;
            total++;
            if (p.config.isEnabled !== false) {
                cats[cat].enabled++;
                enabled++;
            }
        }

        const sortedCategories = Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
        const botName = config.bot?.name || config.name || 'OURIN BOT';

        statsData = { total, enabled, sortedCategories, botName };

        const conn = sock || m.conn;
        const htmlContent = generateHtml({ total, enabled, sortedCategories, botName });
        const responseId = randomUUID();

        // Pola sama dengan plugin botactive (sudah terbukti jalan):
        // build pesan rich -> ganti sections dengan HTML -> relay -> sendEdit
        const ai = new AIRich(conn);
        ai.setResponseId(responseId);
        ai.setBotResponseId(responseId);
        ai.addText('📊 Statistik total fitur bot');

        const payload = await ai.build(m.chat, {
            messageId: responseId,
            forwarded: true,
            includesUnifiedResponse: true,
            includesSubmessages: true,
        });

        const unified = payload.message?.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse;
        if (!unified) throw new Error('unifiedResponse tidak ditemukan pada pesan rich');

        const decoded = JSON.parse(Buffer.from(unified.data, 'base64').toString('utf8'));
        decoded.sections = [
            {
                view_model: {
                    primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: htmlContent,
                        trusted_sources: [],
                    },
                    __typename: 'GenAISingleLayoutViewModel',
                },
            },
        ];
        unified.data = Buffer.from(JSON.stringify(decoded)).toString('base64');

        await conn.relayMessage(m.chat, payload.message, {
            messageId: payload.key.id,
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

        await ai.sendEdit(m.chat, payload.key.id, { msg: payload.message });

        await m.react('✅');

    } catch (error) {
        console.error('[TotalFitur]', error);
        await m.react('❌');

        // Fallback: kirim statistik teks biasa biar user tetap dapet datanya
        try {
            if (statsData) {
                await m.reply(buildTextStats(statsData));
            } else {
                m.reply(te(m.prefix, m.command, m.pushName));
            }
        } catch {
            m.reply(te(m.prefix, m.command, m.pushName));
        }
    }
}

export { pluginConfig as config, handler };