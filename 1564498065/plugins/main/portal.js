/*
 * portal — halaman status bot bergaya "website" di dalam chat (AIRich HTML)
 * Tab: Beranda (radar core CPU) · CPU · Memori · Info
 * Semua angka diambil langsung dari server saat command dijalankan.
 *
 * Taruh di: plugins/main/portal.js  (atau kategori lain)
 */

import os from 'os';
import { randomUUID } from 'crypto';
import config from '../../config.js';

const pluginConfig = {
  name: 'portal',
  alias: ['webui', 'dash'],
  category: 'main',
  description: 'Portal status bot bergaya website (radar CPU, memori, info sistem)',
  usage: '.portal',
  example: '.portal',
  cooldown: 10,
  isEnabled: true
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sampleCpu(ms = 280) {
  try {
    const a = os.cpus();
    if (!a?.length) return [];
    await sleep(ms);
    const b = os.cpus();
    const sum = (t) => Object.values(t).reduce((s, v) => s + v, 0);
    return b.map((c, i) => {
      const p = a[i]?.times || c.times;
      const total = sum(c.times) - sum(p);
      const idle = c.times.idle - p.idle;
      return total > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - idle / total)))) : 0;
    });
  } catch {
    return [];
  }
}

function collect(m, usage, tookMs) {
  const cpus = (() => { try { return os.cpus() || []; } catch { return []; } })();
  const mu = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  return {
    name: config.bot?.name || 'Ourin-AI',
    prefix: m.prefix || '.',
    node: process.version,
    v8: process.versions?.v8 || '-',
    platform: `${os.type()} ${os.arch()}`,
    cpuModel: (cpus[0]?.model || 'Tidak diketahui').replace(/\s+/g, ' ').trim(),
    cores: cpus.length || usage.length || 0,
    usage: usage.slice(0, 24),
    load: (() => { try { return os.loadavg().map((v) => Number(v.toFixed(2))); } catch { return [0, 0, 0]; } })(),
    mem: { total, free, used: total - free },
    heap: { used: mu.heapUsed, total: mu.heapTotal, rss: mu.rss },
    botUp: Math.floor(process.uptime()),
    hostUp: Math.floor(os.uptime()),
    took: tookMs,
    stamp: Date.now()
  };
}

function createPortal(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return `<style>
  :root{color-scheme:dark;--ink:#080c18;--panel:#10172b;--panel2:#162040;--line:rgba(173,196,255,.13);--text:#e8eefc;--mute:#8d9ab8;--amber:#ffb454;--aqua:#4fe3c1;--coral:#ff6b81}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:none;user-select:none}
  html,body{background:transparent;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;width:100%}
  .wrap{display:flex;justify-content:center;padding:10px}
  .site{width:100%;max-width:340px;border-radius:22px;overflow:hidden;background:var(--ink);border:1px solid var(--line);box-shadow:0 22px 48px rgba(0,0,0,.55);position:relative}
  .site::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 60% at 50% -10%,rgba(255,180,84,.10),transparent 60%),radial-gradient(90% 50% at 100% 100%,rgba(79,227,193,.07),transparent 60%)}

  .chrome{position:relative;display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--panel);border-bottom:1px solid var(--line)}
  .dots{display:flex;gap:5px}
  .dots i{width:8px;height:8px;border-radius:50%;background:#2a3558}
  .dots i:first-child{background:var(--coral)}.dots i:nth-child(2){background:var(--amber)}.dots i:nth-child(3){background:var(--aqua)}
  .url{flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:12px;background:rgba(255,255,255,.05);font-size:11px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .url svg{width:10px;height:10px;flex:none;fill:var(--aqua)}
  .live{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--aqua)}
  .live i{width:7px;height:7px;border-radius:50%;background:var(--aqua);animation:blink 1.6s ease-in-out infinite}
  @keyframes blink{50%{opacity:.25;transform:scale(.7)}}

  .nav{position:relative;display:flex;background:var(--panel);border-bottom:1px solid var(--line)}
  .nav button{flex:1;padding:12px 0;background:none;border:none;color:var(--mute);font-size:12.5px;font-weight:600;cursor:pointer;transition:color .2s ease}
  .nav button.on{color:#fff}
  .ink{position:absolute;left:0;bottom:-1px;width:25%;height:2px;background:var(--amber);box-shadow:0 0 12px var(--amber);transition:transform .35s cubic-bezier(.3,.9,.3,1)}

  .pg{display:none;position:relative;padding:18px 16px 20px}
  .pg.on{display:block;animation:pgin .35s ease both}
  @keyframes pgin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  .hello h1{font-size:25px;font-weight:800;letter-spacing:-.6px;line-height:1.1}
  .hello p{margin-top:5px;font-size:12.5px;color:var(--mute);line-height:1.45}

  .radar{position:relative;margin:16px auto 6px;width:100%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#0d1630 0,#0a1126 62%,#080c18 100%);box-shadow:inset 0 0 0 1px var(--line),0 0 40px rgba(255,180,84,.08);cursor:crosshair}
  .radar canvas{position:absolute;inset:0;width:100%;height:100%}
  .rtip{position:absolute;left:50%;top:50%;padding:4px 9px;border-radius:9px;background:#fff;color:#111;font-size:10.5px;font-weight:700;transform:translate(-50%,-140%);opacity:0;pointer-events:none;transition:opacity .15s ease;white-space:nowrap}
  .rtip.show{opacity:1}
  .rnote{text-align:center;font-size:11px;color:var(--mute);margin-bottom:14px}

  .readout{display:flex;align-items:baseline;justify-content:center;gap:6px;margin:4px 0 2px}
  .readout b{font-size:34px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums}
  .readout span{font-size:12px;color:var(--mute)}
  .chips{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin-top:12px}
  .chip{padding:6px 11px;border-radius:14px;background:var(--panel);border:1px solid var(--line);font-size:11px;color:var(--mute)}
  .chip b{color:var(--text);font-weight:700;margin-left:3px}

  .big{display:flex;align-items:baseline;gap:6px}
  .big b{font-size:46px;font-weight:800;letter-spacing:-1.6px;font-variant-numeric:tabular-nums}
  .big span{font-size:14px;color:var(--mute)}
  .sub{font-size:12.5px;color:var(--mute);margin-top:2px;line-height:1.45}
  .cores{display:flex;align-items:flex-end;gap:5px;height:132px;margin:18px 0 6px;padding:12px 10px 0;border-radius:16px;background:var(--panel);border:1px solid var(--line)}
  .core{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
  .core .bar{width:100%;max-width:18px;height:0;border-radius:5px 5px 2px 2px;background:var(--aqua);transition:height 1s cubic-bezier(.2,.9,.2,1),background .3s ease}
  .core small{font-size:8.5px;color:var(--mute);padding-bottom:5px}
  .meters{margin-top:14px;display:grid;gap:11px}
  .meter .lab{display:flex;justify-content:space-between;font-size:12px;color:var(--mute);margin-bottom:5px}
  .meter .lab b{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums}
  .track{height:7px;border-radius:5px;background:rgba(255,255,255,.07);overflow:hidden}
  .fill{height:100%;width:0;border-radius:5px;background:var(--aqua);transition:width 1s cubic-bezier(.2,.9,.2,1),background .3s ease}

  .gauge{position:relative;width:176px;height:176px;margin:6px auto 16px}
  .gauge svg{width:100%;height:100%;transform:rotate(-90deg)}
  .gauge circle{fill:none;stroke-width:11}
  .gauge .gt{stroke:rgba(255,255,255,.07)}
  .gauge .gp{stroke:var(--amber);stroke-linecap:round;stroke-dasharray:339.29;stroke-dashoffset:339.29;transition:stroke-dashoffset 1.2s cubic-bezier(.2,.9,.2,1),stroke .3s ease;filter:drop-shadow(0 0 6px rgba(255,180,84,.55))}
  .gauge .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .gauge .mid b{font-size:34px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums}
  .gauge .mid span{font-size:11.5px;color:var(--mute);margin-top:2px}

  .kv{display:grid;margin-top:14px;border-radius:16px;background:var(--panel);border:1px solid var(--line);overflow:hidden}
  .kv div{display:flex;justify-content:space-between;gap:14px;padding:11px 14px;font-size:12.5px;border-bottom:1px solid var(--line)}
  .kv div:last-child{border-bottom:none}
  .kv span{color:var(--mute);flex:none}
  .kv b{font-weight:600;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  .foot{position:relative;padding:12px 16px 14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:10.5px;color:#66739a}

  @media (prefers-reduced-motion:reduce){.live i,.pg.on{animation:none}}
  </style>

  <div class="wrap">
    <div class="site" id="site">
      <div class="chrome">
        <div class="dots"><i></i><i></i><i></i></div>
        <div class="url"><svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z"/></svg><span id="host">ourin.local/portal</span></div>
        <div class="live"><i></i>online</div>
      </div>

      <div class="nav" id="nav">
        <button class="on" data-i="0">Beranda</button>
        <button data-i="1">CPU</button>
        <button data-i="2">Memori</button>
        <button data-i="3">Info</button>
        <div class="ink" id="ink"></div>
      </div>

      <section class="pg on" id="p0">
        <div class="hello">
          <h1 id="botName">Bot</h1>
          <p>Setiap titik di radar adalah satu core CPU. Makin jauh dari pusat, makin sibuk.</p>
        </div>
        <div class="radar" id="radarBox">
          <canvas id="radar"></canvas>
          <div class="rtip" id="rtip">Core</div>
        </div>
        <div class="rnote" id="rnote">Ketuk radar untuk melihat beban tiap core</div>
        <div class="readout"><b id="up">0j 00m 00d</b><span>aktif sejak bot menyala</span></div>
        <div class="chips">
          <div class="chip">Node<b id="cNode">-</b></div>
          <div class="chip">Sistem<b id="cPlat">-</b></div>
          <div class="chip">Diolah<b id="cTook">-</b></div>
        </div>
      </section>

      <section class="pg" id="p1">
        <div class="big"><b id="cpuAvg">0</b><span>% rata-rata beban</span></div>
        <div class="sub" id="cpuSub">-</div>
        <div class="cores" id="cores"></div>
        <div class="meters" id="loads"></div>
      </section>

      <section class="pg" id="p2">
        <div class="gauge">
          <svg viewBox="0 0 120 120"><circle class="gt" cx="60" cy="60" r="54"/><circle class="gp" id="gp" cx="60" cy="60" r="54"/></svg>
          <div class="mid"><b id="gPct">0%</b><span id="gTxt">-</span></div>
        </div>
        <div class="meters" id="mems"></div>
      </section>

      <section class="pg" id="p3">
        <div class="hello"><h1>Info sistem</h1><p id="stampTxt">-</p></div>
        <div class="kv" id="kv"></div>
      </section>

      <div class="foot"><span id="fL">Ourin Portal</span><span>ketik <b id="fCmd">.portal</b> untuk memuat ulang</span></div>
    </div>
  </div>

  <script>
  (function(){
    const D = ${json};
    const $ = function(id){ return document.getElementById(id); };
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const nextFrame = window.requestAnimationFrame ? function(f){ return window.requestAnimationFrame(f); } : function(f){ return setTimeout(function(){ f(Date.now()); }, 33); };
    const t0 = Date.now();

    function pad(n){ return String(n).padStart(2, '0'); }
    function gb(b){ return (b / 1073741824).toFixed(2) + ' GB'; }
    function mb(b){ return (b / 1048576).toFixed(0) + ' MB'; }
    function up(s){
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60);
      return (d ? d + 'h ' : '') + h + 'j ' + pad(m) + 'm ' + pad(x) + 'd';
    }
    function tone(p){ return p >= 85 ? 'var(--coral)' : p >= 60 ? 'var(--amber)' : 'var(--aqua)'; }
    function tick(el, to, dur, fmt){
      if(reduce){ el.textContent = fmt(to); return; }
      const s = Date.now();
      (function step(){
        const k = Math.min(1, (Date.now() - s) / dur);
        el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
        if(k < 1) nextFrame(step);
      })();
    }

    $('botName').textContent = D.name;
    $('fCmd').textContent = D.prefix + 'portal';
    $('host').textContent = D.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.local/portal';
    $('cNode').textContent = D.node;
    $('cPlat').textContent = D.platform;
    $('cTook').textContent = D.took + ' ms';
    $('fL').textContent = D.name + ' Portal';

    const cores = D.usage;
    const n = cores.length;
    const avg = n ? Math.round(cores.reduce(function(s, v){ return s + v; }, 0) / n) : 0;

    /* ---- uptime berjalan ---- */
    function paintUp(){ $('up').textContent = up(D.botUp + (Date.now() - t0) / 1000); }
    paintUp();
    setInterval(paintUp, 1000);

    /* ---- tab ---- */
    const btns = Array.prototype.slice.call($('nav').querySelectorAll('button'));
    const fired = {};
    function show(i){
      for(let k = 0; k < 4; k++){
        $('p' + k).classList.toggle('on', k === i);
        if(btns[k]) btns[k].classList.toggle('on', k === i);
      }
      $('ink').style.transform = 'translateX(' + (i * 100) + '%)';
      if(i === 1 && !fired[1]){ fired[1] = 1; cpuPage(); }
      if(i === 2 && !fired[2]){ fired[2] = 1; memPage(); }
      if(i === 3 && !fired[3]){ fired[3] = 1; infoPage(); }
    }
    btns.forEach(function(b, i){ b.onclick = function(){ show(i); }; });

    /* ---- halaman CPU ---- */
    function cpuPage(){
      tick($('cpuAvg'), avg, 900, function(v){ return Math.round(v); });
      $('cpuSub').textContent = D.cores + ' core · ' + D.cpuModel;
      const box = $('cores');
      if(!n){
        box.style.height = 'auto';
        box.style.padding = '16px';
        box.textContent = 'Data per core tidak tersedia di platform ini.';
      } else {
        cores.forEach(function(v, i){
          const c = document.createElement('div');
          c.className = 'core';
          const bar = document.createElement('div');
          bar.className = 'bar';
          bar.style.background = tone(v);
          const lb = document.createElement('small');
          lb.textContent = String(i + 1);
          c.appendChild(bar); c.appendChild(lb);
          box.appendChild(c);
          setTimeout(function(){ bar.style.height = Math.max(3, v) + '%'; }, 60 + i * 35);
        });
      }
      const L = $('loads');
      const names = ['1 menit', '5 menit', '15 menit'];
      const have = D.load.some(function(v){ return v > 0; });
      if(!have){
        const p = document.createElement('div');
        p.className = 'sub';
        p.textContent = 'Load average tidak tersedia di platform ini.';
        L.appendChild(p);
        return;
      }
      D.load.forEach(function(v, i){
        const pct = Math.min(100, Math.round(v / Math.max(1, D.cores) * 100));
        const m = document.createElement('div');
        m.className = 'meter';
        m.innerHTML = '<div class="lab"><span>Load ' + names[i] + '</span><b>' + v.toFixed(2) + '</b></div><div class="track"><div class="fill"></div></div>';
        L.appendChild(m);
        const f = m.querySelector('.fill');
        f.style.background = tone(pct);
        setTimeout(function(){ f.style.width = Math.max(2, pct) + '%'; }, 80 + i * 120);
      });
    }

    /* ---- halaman memori ---- */
    function memPage(){
      const pct = Math.round(D.mem.used / D.mem.total * 100);
      const gp = $('gp');
      gp.style.stroke = tone(pct);
      setTimeout(function(){ gp.style.strokeDashoffset = (339.29 * (1 - pct / 100)).toFixed(1); }, 60);
      tick($('gPct'), pct, 1000, function(v){ return Math.round(v) + '%'; });
      $('gTxt').textContent = gb(D.mem.used) + ' dari ' + gb(D.mem.total);
      const rows = [
        ['Heap Node', D.heap.used, D.heap.total, mb(D.heap.used) + ' / ' + mb(D.heap.total)],
        ['Memori proses (RSS)', D.heap.rss, D.mem.total, mb(D.heap.rss)],
        ['RAM bebas', D.mem.free, D.mem.total, gb(D.mem.free)]
      ];
      const M = $('mems');
      rows.forEach(function(r, i){
        const p = Math.min(100, Math.round(r[1] / r[2] * 100));
        const m = document.createElement('div');
        m.className = 'meter';
        m.innerHTML = '<div class="lab"><span>' + r[0] + '</span><b>' + r[3] + '</b></div><div class="track"><div class="fill"></div></div>';
        M.appendChild(m);
        const f = m.querySelector('.fill');
        f.style.background = i === 2 ? 'var(--aqua)' : tone(p);
        setTimeout(function(){ f.style.width = Math.max(2, p) + '%'; }, 80 + i * 120);
      });
    }

    /* ---- halaman info ---- */
    function infoPage(){
      const d = new Date(D.stamp);
      $('stampTxt').textContent = 'Dibuat ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' waktu perangkatmu';
      const rows = [
        ['Bot', D.name], ['Prefix', D.prefix], ['Node.js', D.node], ['V8', D.v8], ['Sistem', D.platform],
        ['Prosesor', D.cpuModel], ['Jumlah core', String(D.cores)], ['Server menyala', up(D.hostUp)]
      ];
      const kv = $('kv');
      rows.forEach(function(r){
        const row = document.createElement('div');
        const a = document.createElement('span'); a.textContent = r[0];
        const b = document.createElement('b'); b.textContent = r[1];
        row.appendChild(a); row.appendChild(b);
        kv.appendChild(row);
      });
    }

    /* ---- radar ---- */
    const cv = $('radar'), cx = cv.getContext ? cv.getContext('2d') : null;
    const box = $('radarBox'), tipEl = $('rtip');
    let S = 300, R = 140, tipTimer = 0;
    function size(){
      const r = box.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      S = Math.max(120, Math.round(r.width || 300));
      cv.width = cv.height = Math.round(S * dpr);
      if(cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = S / 2 - 8;
    }
    size();

    function blip(i){
      const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
      const d = (0.2 + 0.76 * cores[i] / 100) * R;
      return { a: a, x: S / 2 + Math.cos(a) * d, y: S / 2 + Math.sin(a) * d, v: cores[i] };
    }

    function rgba(v, al){
      const c = v >= 85 ? '255,107,129' : v >= 60 ? '255,180,84' : '79,227,193';
      return 'rgba(' + c + ',' + al.toFixed(3) + ')';
    }

    function drawRadar(ts){
      if(!cx) return;
      const c = S / 2;
      cx.clearRect(0, 0, S, S);
      cx.lineWidth = 1;
      cx.strokeStyle = 'rgba(173,196,255,0.14)';
      for(let k = 1; k <= 4; k++){ cx.beginPath(); cx.arc(c, c, R * k / 4, 0, 6.2832); cx.stroke(); }
      for(let k = 0; k < 12; k++){
        const a = k * Math.PI / 6;
        cx.beginPath();
        cx.moveTo(c + Math.cos(a) * R * 0.94, c + Math.sin(a) * R * 0.94);
        cx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
        cx.stroke();
      }
      cx.beginPath(); cx.moveTo(c - R, c); cx.lineTo(c + R, c); cx.moveTo(c, c - R); cx.lineTo(c, c + R); cx.stroke();

      const sw = reduce ? 0 : ((ts / 1000) * 0.9) % 6.2832;
      for(let k = 0; k < 46; k++){
        const a1 = sw - k * 0.022, a0 = sw - (k + 1) * 0.022;
        cx.beginPath();
        cx.moveTo(c, c);
        cx.arc(c, c, R, a0, a1);
        cx.closePath();
        cx.fillStyle = 'rgba(255,180,84,' + (0.2 * (1 - k / 46)).toFixed(3) + ')';
        cx.fill();
      }
      cx.strokeStyle = 'rgba(255,200,120,0.9)';
      cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(c, c); cx.lineTo(c + Math.cos(sw) * R, c + Math.sin(sw) * R); cx.stroke();

      for(let i = 0; i < n; i++){
        const b = blip(i);
        const diff = ((sw - b.a) % 6.2832 + 6.2832) % 6.2832;
        const glow = reduce ? 0.6 : Math.max(0, 1 - diff / 4.2);
        cx.fillStyle = rgba(b.v, 0.12 + glow * 0.4);
        cx.beginPath(); cx.arc(b.x, b.y, 7 + glow * 7, 0, 6.2832); cx.fill();
        cx.fillStyle = rgba(b.v, 0.45 + glow * 0.55);
        cx.beginPath(); cx.arc(b.x, b.y, 3.4 + glow * 1.6, 0, 6.2832); cx.fill();
      }

      const pulse = reduce ? 0 : (Math.sin(ts / 420) + 1) / 2;
      cx.fillStyle = 'rgba(255,180,84,' + (0.25 + pulse * 0.25).toFixed(3) + ')';
      cx.beginPath(); cx.arc(c, c, 8 + pulse * 5, 0, 6.2832); cx.fill();
      cx.fillStyle = '#ffb454';
      cx.beginPath(); cx.arc(c, c, 3.6, 0, 6.2832); cx.fill();
    }

    let lastDraw = 0, running = true;
    function loop(ts){
      if(!running) return;
      nextFrame(loop);
      if(ts - lastDraw < 32) return;
      lastDraw = ts;
      drawRadar(ts);
    }
    if(!n){
      $('rnote').textContent = 'Data per core tidak tersedia di platform ini.';
      drawRadar(0);
    } else if(reduce){
      drawRadar(0);
    } else {
      nextFrame(loop);
    }

    box.onclick = function(e){
      if(!n) return;
      const r = box.getBoundingClientRect();
      const px = (e.clientX - r.left) * (S / (r.width || S)), py = (e.clientY - r.top) * (S / (r.height || S));
      let best = 0, bd = 1e9;
      for(let i = 0; i < n; i++){
        const b = blip(i);
        const d = (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py);
        if(d < bd){ bd = d; best = i; }
      }
      const b = blip(best);
      tipEl.textContent = 'Core ' + (best + 1) + ' · ' + cores[best] + '%';
      tipEl.style.left = (b.x / S * 100).toFixed(1) + '%';
      tipEl.style.top = (b.y / S * 100).toFixed(1) + '%';
      tipEl.classList.add('show');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function(){ tipEl.classList.remove('show'); }, 1800);
    };

    show(0);
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

async function relayRich(conn, jid, html, title) {
  const messageId = randomUUID();
  const unifiedData = JSON.stringify({ response_id: messageId, sections: [richSection(html)] });
  const content = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: { messageDisclaimerText: '', botResponseId: messageId }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: title }],
          unifiedResponse: { data: Buffer.from(unifiedData).toString('base64') },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4
          }
        }
      }
    }
  };

  await conn.relayMessage(jid, content, { messageId });
  await conn.relayMessage(jid, {
    protocolMessage: {
      key: { remoteJid: jid, fromMe: true, id: messageId },
      type: 14,
      editedMessage: content,
      timestampMs: Date.now()
    }
  }, { additionalAttributes: { edit: '1' } });
}

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  const react = (e) => Promise.resolve().then(() => m.react(e)).catch(() => {});
  react('🛰️');

  try {
    const t0 = Date.now();
    const usage = await sampleCpu(280);
    const data = collect(m, usage, Math.max(1, Date.now() - t0 - 280));
    const html = createPortal(data);
    const title = `🛰️ ${data.name} Portal`;

    try {
      // sendAIRich default: kirim pesan lalu langsung di-edit supaya HTML terunduh otomatis
      await conn.sendAIRich(m.chat, (r) => {
        r.setTitle(title);
        r.addSection(richSection(html));
      }, { quoted: m });
    } catch (e) {
      console.error('[PORTAL] sendAIRich gagal, pakai relay:', e?.message || e);
      await relayRich(conn, m.chat, html, title);
    }
    react('✅');
  } catch (e) {
    console.error('[PORTAL Error]', e);
    react('❌');
    m.reply(`❌ ${e.message}`);
  }
}

export { pluginConfig as config, handler };