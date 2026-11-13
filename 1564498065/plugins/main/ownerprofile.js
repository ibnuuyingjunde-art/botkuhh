/*
 * ownerprofile — profil & portofolio owner (AIRich HTML, tema gelap)
 * Tiga halaman rata yang bisa digeser: Profil · Keahlian · Proyek.
 *
 * Pakai:   .ownerprofile   (alias: .profileowner, .aboutowner, .portoowner)
 * Ubah isi kartu lewat objek OWNER, SKILLS, dan PROJECTS di bawah.
 *
 * Taruh di: plugins/main/ownerprofile.js
 */

import { randomUUID } from 'crypto';
import { sharp } from '../../src/lib/ichigo-lazy.js';
import config from '../../config.js';
import { getAllPlugins } from '../../src/lib/ichigo-plugins.js';
import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;

// name & alias sengaja dibedakan dari plugins/main/owner.js (.owner)
// dan plugins/tools/portofolio.js (.portfolio) supaya tidak bentrok.
const pluginConfig = {
  name: 'ownerprofile',
  alias: ['profileowner', 'aboutowner', 'portoowner'],
  category: 'main',
  description: 'Profil & portofolio owner (tema gelap, halaman geser)',
  usage: '.ownerprofile',
  example: '.ownerprofile',
  cooldown: 10,
  isEnabled: true
};

const BOT_NAME = config.bot?.name || "lyniX's MD";
const OWNER_NUMBER = String((config.owner?.number || [])[0] || '').replace(/\D/g, '');

const OWNER = {
  name: config.owner?.name || config.bot?.developer || 'Owner',
  roles: ['WhatsApp Bot Developer', 'Plugin & Engine Engineer', 'Interface Craftsman'],
  tagline: 'Merancang bot WhatsApp yang rapi, cepat, dan nyaman dipakai.',
  about: `Mengembangkan dan memelihara ${BOT_NAME} di atas Baileys: mulai dari plugin harian, perbaikan engine inti, hingga pesan interaktif seperti AIRich, Carousel, dan A2UI.`
};

const SKILLS = [
  { t: 'Inti', items: [
    ['JavaScript (ESM)', 'Modul ES, async/await, dan kode yang ringkas serta mudah dirawat.'],
    ['Node.js', 'Proses, stream, dan child process untuk alur kerja bot yang stabil.'],
    ['Baileys', 'Protokol WhatsApp multi-device: relay pesan, enkripsi, dan node biz.']
  ] },
  { t: 'Ekosistem bot', items: [
    ["lyniX's MD", 'Framework bot: plugin, handler, konteks, dan hot reload.'],
    ['Engine patch', 'Perbaikan handler, serializer, dan pustaka inti tanpa merusak plugin lama.'],
    ['Scraper', 'Integrasi sumber unduhan dan pencarian dengan cadangan berlapis.']
  ] },
  { t: 'Pesan interaktif', items: [
    ['AIRich', 'Pesan kaya: teks, kode, dan bagian HTML di dalam chat.'],
    ['Carousel', 'Kartu geser untuk katalog dan hasil pencarian.'],
    ['A2UI', 'Widget bergaya Bloks: kartu, kolom, tombol, dan kolom teks.'],
    ['HTML rich', 'Halaman interaktif langsung di dalam percakapan.']
  ] },
  { t: 'Media & alat', items: [
    ['FFmpeg', 'Transcode audio dan video, termasuk stiker animasi.'],
    ['Sharp', 'Olah gambar: ubah ukuran, potong, dan buat thumbnail.'],
    ['Canvas', 'Gambar kartu dan visual dinamis lewat canvas.'],
    ['REST API', 'Integrasi pengunduh dan pencarian konten.']
  ] }
];

const PROJECTS = [
  { n: BOT_NAME, d: 'Bot WhatsApp utama',
    b: 'Plugin, perbaikan engine, dan integrasi pembangun pesan, dirawat sebagai satu kesatuan.',
    tags: ['Plugin', 'Engine', 'Builder'] },
  { n: 'Pesan HTML interaktif', d: 'Dashboard & kartu di dalam chat',
    b: 'Halaman HTML yang tampil langsung di WhatsApp lewat AIRich: status bot, statistik fitur, dan profil.',
    tags: ['AIRich', 'HTML', 'UI'] },
  { n: 'Media downloader', d: 'Unduh audio & video dengan cadangan sumber',
    b: 'Beberapa sumber dicoba berurutan dan tiap link diperiksa sebelum dikirim, supaya file yang masuk selalu bisa diputar.',
    tags: ['YouTube', 'Fallback', 'Scraper'] },
  { n: 'Kartu interaktif A2UI', d: 'Pencarian lagu dengan tombol cepat',
    b: 'Hasil pencarian tampil sebagai kartu dengan tombol MP3 dan Video yang langsung bisa ditekan.',
    tags: ['A2UI', 'Quick reply', 'Musik'] }
];

const escapeHtml = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function createOwnerHtml(d) {
  const e = escapeHtml;
  const chip = ([label, note]) => `<button class="chip" data-note="${e(note)}">${e(label)}</button>`;
  const skills = d.skills.map((g, i) => `<div class="grp rise" style="--i:${i + 1}"><div class="gt">${e(g.t)}</div><div class="chips">${g.items.map(chip).join('')}</div></div>`).join('');
  const projects = d.projects.map((p, i) => `
        <article class="proj rise" style="--i:${i + 1}">
          <button class="ph"><span class="pn">0${i + 1}</span><span class="pt"><b>${e(p.n)}</b><em>${e(p.d)}</em></span><i class="chev"></i></button>
          <div class="pb"><p>${e(p.b)}</p><div class="tags">${p.tags.map((t) => `<span>${e(t)}</span>`).join('')}</div></div>
        </article>`).join('');
  const avatar = d.avatar ? `<img src="${d.avatar}" alt="">` : `<b>${e(d.name.charAt(0).toUpperCase())}</b>`;
  const cta = d.waLink ? `<a class="cta" href="${e(d.waLink)}"><span>Hubungi via WhatsApp</span></a>` : '';

  return `<style>
  :root{--bg:#090b10;--card:#0e1118;--line:rgba(255,255,255,.075);--ink:#eef0f6;--mute:#8d95a8;--a:#8b9cff;--a2:#5eead4;--glow:rgba(139,156,255,.32);--ph:368px}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
  html,body{background:transparent;color:var(--ink);width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif}
  .wrap{display:flex;justify-content:center;padding:10px}

  .card{position:relative;width:100%;max-width:340px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#10131b 0%,#0a0c11 100%);border:1px solid var(--line);box-shadow:0 22px 46px rgba(0,0,0,.55);animation:enter .6s cubic-bezier(.2,.8,.2,1) both}
  @keyframes enter{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
  .grid{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 70%);mask-image:linear-gradient(180deg,#000 0%,transparent 70%)}
  .orb{position:absolute;border-radius:50%;pointer-events:none;will-change:transform}
  .o1{width:230px;height:230px;left:-70px;top:-80px;background:radial-gradient(circle,rgba(139,156,255,.34),transparent 68%)}
  .o2{width:210px;height:210px;right:-80px;top:120px;background:radial-gradient(circle,rgba(94,234,212,.2),transparent 68%)}

  .head{position:relative;display:flex;justify-content:space-between;align-items:center;padding:16px 18px 6px}
  .brand{display:flex;align-items:center;gap:8px;font-size:9.5px;letter-spacing:2.2px;font-weight:700;color:var(--mute)}
  .logo{width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,var(--a),var(--a2));display:inline-flex;align-items:center;justify-content:center;color:#0a0c11;font-size:10px;font-weight:900}
  .count{font-size:11px;color:var(--mute);font-variant-numeric:tabular-nums;font-weight:600}
  .count b{color:var(--ink);font-size:13px}

  .pages{position:relative;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain}
  .pages::-webkit-scrollbar{display:none}
  .page{flex:0 0 100%;width:100%;height:var(--ph);scroll-snap-align:start;scroll-snap-stop:always;padding:10px 18px 4px;overflow:hidden}
  .rise{opacity:0;transform:translateY(12px);transition:opacity .55s ease,transform .55s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i,0) * 70ms)}
  .page.in .rise{opacity:1;transform:none}

  .who{display:flex;align-items:center;gap:14px}
  .avatar{position:relative;width:76px;height:76px;flex:none}
  .ring{position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(from 0deg,var(--a),var(--a2),var(--a));animation:spin 6s linear infinite;will-change:transform}
  @keyframes spin{to{transform:rotate(360deg)}}
  .pic{position:absolute;inset:0;border-radius:50%;border:3px solid #0e1118;background:#161a24;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .pic img{width:100%;height:100%;object-fit:cover}
  .pic b{font-size:30px;font-weight:800;background:linear-gradient(135deg,var(--a),var(--a2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .live{position:absolute;right:1px;bottom:3px;width:15px;height:15px;border-radius:50%;background:#34d399;border:3px solid #0e1118}
  .live::after{content:'';position:absolute;inset:-3px;border-radius:50%;border:2px solid #34d399;opacity:0;animation:ping 2s ease-out infinite}
  @keyframes ping{from{transform:scale(.8);opacity:.7}to{transform:scale(1.7);opacity:0}}
  .nm{font-size:30px;line-height:1;font-weight:800;letter-spacing:-1.2px}
  .role{margin-top:7px;font-size:12px;font-weight:600;color:var(--a2);min-height:16px;white-space:nowrap}
  .caret{display:inline-block;width:2px;height:12px;margin-left:2px;vertical-align:-2px;background:var(--a2);animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}

  .lead{margin-top:18px;font-size:15px;line-height:1.45;font-weight:600;letter-spacing:-.2px}
  .about{margin-top:9px;font-size:12.5px;line-height:1.6;color:var(--mute)}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
  .st{padding:11px 10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);min-width:0}
  .st b{display:block;font-size:15px;font-weight:800;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
  .st span{display:block;margin-top:3px;font-size:10px;color:var(--mute);font-weight:600;letter-spacing:.3px}
  .status{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:6px 12px;border-radius:20px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);font-size:11px;font-weight:600;color:#7ee7bd}
  .status i{width:6px;height:6px;border-radius:50%;background:#34d399}

  .shead{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .stitle{font-size:20px;font-weight:800;letter-spacing:-.8px}
  .hint{font-size:10.5px;color:var(--mute);font-weight:600}
  .grp{margin-top:9px}
  .gt{font-size:9px;letter-spacing:1.6px;font-weight:700;color:var(--mute);text-transform:uppercase;margin-bottom:5px}
  .chips{display:flex;flex-wrap:wrap;gap:5px}
  .chip{padding:6px 9px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#cfd4e2;font-size:11px;font-weight:600;cursor:pointer;transition:background .2s ease,border-color .2s ease,color .2s ease,transform .15s ease}
  .chip:active{transform:scale(.95)}
  .chip.on{background:linear-gradient(135deg,rgba(139,156,255,.22),rgba(94,234,212,.16));border-color:rgba(139,156,255,.55);color:#fff;box-shadow:0 0 18px var(--glow)}
  .note{margin-top:10px;padding:9px 12px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:11.5px;line-height:1.5;color:#c4cadb;min-height:52px}
  .note.flash{animation:flash .45s ease}
  @keyframes flash{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

  .plist{display:grid;gap:7px;margin-top:11px}
  .proj{border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);overflow:hidden;transition:border-color .25s ease,background .25s ease}
  .proj.open{border-color:rgba(139,156,255,.45);background:rgba(139,156,255,.07)}
  .ph{display:flex;align-items:center;gap:11px;width:100%;padding:9px 13px;background:none;border:none;color:inherit;text-align:left;cursor:pointer}
  .pn{font-size:11px;font-weight:800;color:var(--a);font-variant-numeric:tabular-nums;letter-spacing:.5px}
  .pt{flex:1;min-width:0}
  .pt b{display:block;font-size:13.5px;font-weight:700;letter-spacing:-.2px}
  .pt em{display:block;margin-top:2px;font-style:normal;font-size:11.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chev{width:8px;height:8px;border-right:2px solid var(--mute);border-bottom:2px solid var(--mute);transform:rotate(45deg);transition:transform .3s ease;margin-right:3px}
  .proj.open .chev{transform:rotate(225deg)}
  .pb{max-height:0;overflow:hidden;transition:max-height .35s ease;padding:0 13px}
  .proj.open .pb{max-height:96px}
  .pb p{font-size:11.5px;line-height:1.5;color:#c4cadb;padding-bottom:8px}
  .tags{display:flex;flex-wrap:wrap;gap:5px;padding-bottom:11px}
  .tags span{padding:4px 9px;border-radius:9px;background:rgba(139,156,255,.14);color:#b9c3ff;font-size:10.5px;font-weight:700}

  .dock{position:relative;padding:8px 18px 16px}
  .tabs{position:relative;display:flex;padding:4px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid var(--line)}
  .tabs button{position:relative;z-index:1;flex:1;padding:9px 0;border:none;background:none;color:var(--mute);font-size:12.5px;font-weight:700;cursor:pointer;transition:color .25s ease}
  .tabs button.on{color:#fff}
  .pill{position:absolute;left:4px;top:4px;bottom:4px;width:calc((100% - 8px) / 3);border-radius:12px;background:linear-gradient(135deg,rgba(139,156,255,.42),rgba(94,234,212,.28));box-shadow:0 0 16px var(--glow);will-change:transform}
  .cta{position:relative;display:flex;align-items:center;justify-content:center;margin-top:10px;padding:13px;border-radius:15px;background:linear-gradient(135deg,var(--a),var(--a2));color:#0a0c11;font-size:13.5px;font-weight:800;letter-spacing:-.1px;text-decoration:none;overflow:hidden}
  .cta::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-130%);animation:shine 4.5s ease-in-out infinite}
  @keyframes shine{0%,60%{transform:translateX(-130%)}85%,100%{transform:translateX(130%)}}
  .cta:active{transform:scale(.98)}
  .foot{margin-top:11px;text-align:center;font-size:9.5px;letter-spacing:1.6px;font-weight:700;color:rgba(255,255,255,.28)}

  @media (max-width:340px){.chip{padding:5px 7px;font-size:10.5px}.chips{gap:4px}.nm{font-size:27px}.stats{gap:6px}.st b{font-size:13.5px}}
  @media (prefers-reduced-motion:reduce){.ring,.caret,.live::after,.cta::after,.card{animation:none}}
  </style>

  <div class="wrap">
    <div class="card" id="card">
      <i class="grid"></i><i class="orb o1" id="o1"></i><i class="orb o2" id="o2"></i>

      <div class="head">
        <div class="brand"><span class="logo">◆</span><span>PORTOFOLIO</span></div>
        <div class="count"><b id="cur">01</b> / 03</div>
      </div>

      <div class="pages" id="pages">
        <section class="page in">
          <div class="who rise" style="--i:0">
            <div class="avatar"><i class="ring"></i><div class="pic">${avatar}</div><span class="live"></span></div>
            <div>
              <h1 class="nm">${e(d.name)}</h1>
              <div class="role"><span id="role" data-roles="${e(JSON.stringify(d.roles))}">${e(d.roles[0])}</span><i class="caret"></i></div>
            </div>
          </div>
          <p class="lead rise" style="--i:1">${e(d.tagline)}</p>
          <p class="about rise" style="--i:2">${e(d.about)}</p>
          <div class="stats rise" style="--i:3">
            <div class="st"><b data-n="${e(d.plugins)}">${e(d.plugins)}</b><span>Plugin aktif</span></div>
            <div class="st"><b>${e(d.uptime)}</b><span>Waktu aktif</span></div>
            <div class="st"><b>${e(d.framework)}</b><span>Framework</span></div>
          </div>
          <div class="status rise" style="--i:4"><i></i>Aktif mengembangkan ${e(d.botName)}</div>
        </section>

        <section class="page">
          <div class="shead rise" style="--i:0"><div class="stitle">Keahlian</div><div class="hint">ketuk untuk detail</div></div>
          ${skills}
          <div class="note rise" id="note" style="--i:5">Pilih satu keahlian di atas untuk melihat penjelasan singkatnya.</div>
        </section>

        <section class="page" id="pg3">
          <div class="shead rise" style="--i:0"><div class="stitle">Proyek pilihan</div><div class="hint">ketuk untuk detail</div></div>
          <div class="plist">${projects}
          </div>
        </section>
      </div>

      <div class="dock">
        <div class="tabs" id="tabs"><i class="pill" id="pill"></i><button class="on">Profil</button><button>Keahlian</button><button>Proyek</button></div>
        ${cta}
        <div class="foot">${e(d.botName).toUpperCase()}</div>
      </div>
    </div>
  </div>

  <script>
  (function(){
    const $ = function(id){ return document.getElementById(id); };
    const pages = $('pages'), pill = $('pill'), cur = $('cur'), o1 = $('o1'), o2 = $('o2');
    const tabs = Array.prototype.slice.call(document.querySelectorAll('#tabs button'));
    const secs = Array.prototype.slice.call(document.querySelectorAll('.page'));
    let idx = 0;

    function go(i){
      const x = i * pages.clientWidth;
      if(pages.scrollTo) pages.scrollTo({ left: x, behavior: 'smooth' }); else pages.scrollLeft = x;
    }
    tabs.forEach(function(b, i){ b.onclick = function(){ go(i); }; });

    function sync(){
      const w = pages.clientWidth || 1;
      const p = pages.scrollLeft / w;
      const i = Math.max(0, Math.min(secs.length - 1, Math.round(p)));
      pill.style.transform = 'translateX(' + (p * 100) + '%)';
      o1.style.transform = 'translate3d(' + (-p * 46) + 'px,' + (p * 14) + 'px,0)';
      o2.style.transform = 'translate3d(' + (-p * 70) + 'px,' + (-p * 24) + 'px,0)';
      secs.forEach(function(s, k){ s.classList.toggle('in', Math.abs(p - k) < 0.6); });
      if(i !== idx){
        idx = i;
        cur.textContent = '0' + (i + 1);
        tabs.forEach(function(b, k){ b.classList.toggle('on', k === i); });
      }
    }
    pages.addEventListener('scroll', sync, { passive: true });
    sync();

    const roleEl = $('role');
    let roles = [];
    try { roles = JSON.parse(roleEl.getAttribute('data-roles')); } catch(e) {}
    if(roles.length > 1){
      let r = 0, c = roles[0].length, del = false;
      (function tick(){
        const word = roles[r];
        roleEl.textContent = word.slice(0, c);
        let wait = del ? 28 : 60;
        if(!del && c === word.length){ del = true; wait = 1700; }
        else if(del && c === 0){ del = false; r = (r + 1) % roles.length; wait = 350; }
        else c += del ? -1 : 1;
        setTimeout(tick, wait);
      })();
    }

    document.querySelectorAll('[data-n]').forEach(function(el){
      const to = parseInt(el.getAttribute('data-n'), 10);
      if(!(to > 0)) return;
      const t0 = Date.now();
      (function step(){
        const k = Math.min(1, (Date.now() - t0) / 1000);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if(k < 1) requestAnimationFrame(step);
      })();
    });

    const note = $('note');
    document.querySelectorAll('.chip').forEach(function(ch){
      ch.onclick = function(){
        document.querySelectorAll('.chip.on').forEach(function(o){ o.classList.remove('on'); });
        ch.classList.add('on');
        note.textContent = ch.getAttribute('data-note');
        note.classList.remove('flash');
        void note.offsetWidth;
        note.classList.add('flash');
      };
    });

    const projs = Array.prototype.slice.call(document.querySelectorAll('.proj'));
    projs.forEach(function(p){
      p.querySelector('.ph').onclick = function(){
        const open = p.classList.contains('open');
        projs.forEach(function(o){ o.classList.remove('open'); });
        if(!open) p.classList.add('open');
      };
    });
  })()
  </script>`;
}

function richSection(html) {
  return {
    view_model: {
      __typename: 'GenAISingleLayoutViewModel',
      primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', trusted_sources: [], payload: html }
    }
  };
}

// Pola sama dengan plugin botactive (sudah terbukti jalan di bot ini):
// build pesan rich -> ganti sections dengan HTML -> relay -> sendEdit
async function relayRich(conn, jid, html, title) {
  const responseId = randomUUID();
  const ai = new AIRich(conn);
  ai.setResponseId(responseId);
  ai.setBotResponseId(responseId);
  ai.addText(title);

  const payload = await ai.build(jid, {
    messageId: responseId,
    forwarded: true,
    includesUnifiedResponse: true,
    includesSubmessages: true
  });

  const unified = payload.message?.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse;
  if (!unified) throw new Error('unifiedResponse tidak ditemukan pada pesan rich');

  const decoded = JSON.parse(Buffer.from(unified.data, 'base64').toString('utf8'));
  decoded.sections = [richSection(html)];
  unified.data = Buffer.from(JSON.stringify(decoded)).toString('base64');

  await conn.relayMessage(jid, payload.message, {
    messageId: payload.key.id,
    additionalNodes: [
      {
        tag: 'biz',
        attrs: {},
        content: [
          {
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
          }
        ]
      }
    ]
  });

  await ai.sendEdit(jid, payload.key.id, { msg: payload.message });
}

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

// Foto profil owner -> data URI kecil (tampil di dalam HTML). Gagal = pakai inisial.
async function getAvatar(conn, jid) {
  try {
    const buf = await conn.profileBuffer(jid);
    if (!buf || !buf.length) return null;
    const out = await sharp(buf).resize(160, 160, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return null;
  }
}

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  await m.react('⏳');

  try {
    let pluginCount = 0;
    try {
      pluginCount = getAllPlugins().filter((p) => p?.config).length;
    } catch {}

    const ownerJid = OWNER_NUMBER ? `${OWNER_NUMBER}@s.whatsapp.net` : null;
    const avatar = ownerJid ? await getAvatar(conn, ownerJid) : null;

    const html = createOwnerHtml({
      ...OWNER,
      skills: SKILLS,
      projects: PROJECTS,
      avatar,
      botName: BOT_NAME,
      plugins: pluginCount,
      uptime: formatUptime(Math.floor(process.uptime())),
      framework: 'Baileys',
      waLink: OWNER_NUMBER ? `https://wa.me/${OWNER_NUMBER}` : ''
    });

    await relayRich(conn, m.chat, html, `👤 Profil ${OWNER.name}`);
    await m.react('✅');
  } catch (err) {
    console.error('[OwnerProfile]', err);
    await m.react('❌');
    m.reply(`⚠️ Gagal menampilkan profil owner.\n\n> ${err?.message || err}`);
  }
}

export { pluginConfig as config, handler };