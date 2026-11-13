/*
 * ping — monitor server 3 halaman di dalam chat (AIRich HTML)
 *   Halaman 1: RAM    Halaman 2: Disk    Halaman 3: CPU
 *   Header berisi ping, runtime bot, dan mode (VPS / Panel / Container / Termux).
 *
 * Perintah
 *   .ping                snapshot
 *   .ping live [detik]   pantau langsung, pesan diedit tiap 5 detik (default 60, maks 180)
 *   .ping stop           hentikan pantauan live di chat ini
 *
 * Semua angka diukur dari server. Di panel/container, RAM dan CPU dibaca dari batas cgroup
 * sehingga sesuai paket panel, bukan RAM seluruh mesin.
 *
 * Taruh di: plugins/main/ping.js  (hapus atau ganti plugin ping lama supaya tidak bentrok)
 */

import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import config from '../../config.js';

const pluginConfig = {
  name: 'ping',
  alias: ['pinglive', 'livestat'],
  category: 'main',
  description: 'Monitor server 3 halaman (RAM, Disk, CPU) dengan ping dan runtime, mode snapshot atau live',
  usage: '.ping [live [detik] | stop]',
  example: '.ping live 60',
  cooldown: 8,
  isEnabled: true
};

const LIVE_EVERY_MS = 5000;
const LIVE_DEFAULT_S = 60;
const LIVE_MIN_S = 15;
const LIVE_MAX_S = 180;
const HIST_MAX = 40;

const PROBES = [
  ['Cloudflare', 'https://www.cloudflare.com/cdn-cgi/trace'],
  ['Google', 'https://www.google.com/generate_204']
];

const sessions = new Map();

/* ------------------------------------------------------------------ util */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const r1 = (v) => Math.round(v * 10) / 10;

function readSync(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function parseKV(text) {
  const o = {};
  if (!text) return o;
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length >= 2) o[p[0].replace(':', '')] = Number(p[1]);
  }
  return o;
}

/* ------------------------------------------------------------------ memori */

function cgroupMem(hostTotal) {
  let cur = null, lim = null, inactive = 0;
  const c2 = readSync('/sys/fs/cgroup/memory.current');
  if (c2 !== null) {
    cur = Number(c2);
    const mx = (readSync('/sys/fs/cgroup/memory.max') || 'max').trim();
    lim = mx === 'max' ? null : Number(mx);
    inactive = parseKV(readSync('/sys/fs/cgroup/memory.stat')).inactive_file || 0;
  } else {
    const c1 = readSync('/sys/fs/cgroup/memory/memory.usage_in_bytes');
    if (c1 !== null) {
      cur = Number(c1);
      lim = Number(readSync('/sys/fs/cgroup/memory/memory.limit_in_bytes'));
      inactive = parseKV(readSync('/sys/fs/cgroup/memory/memory.stat')).total_inactive_file || 0;
    }
  }
  if (!Number.isFinite(cur) || !Number.isFinite(lim) || !lim || lim >= hostTotal) return null;
  const used = Math.max(0, cur - inactive);
  const cache = clamp(inactive, 0, Math.max(0, lim - used));
  return { total: lim, used, cache, free: Math.max(0, lim - used - cache) };
}

function memNow() {
  const mi = parseKV(readSync('/proc/meminfo'));
  const hostTotal = mi.MemTotal ? mi.MemTotal * 1024 : os.totalmem();
  const avail = mi.MemAvailable ? mi.MemAvailable * 1024 : os.freemem();
  const reclaim = ((mi.Cached || 0) + (mi.Buffers || 0) + (mi.SReclaimable || 0)) * 1024;
  const swapTotal = (mi.SwapTotal || 0) * 1024;
  const swapFree = (mi.SwapFree || 0) * 1024;

  const cg = cgroupMem(hostTotal);
  if (cg) return { ...cg, hostTotal, swapTotal, swapFree, limited: true };

  const used = Math.max(0, hostTotal - avail);
  const cache = clamp(reclaim, 0, avail);
  return { total: hostTotal, used, cache, free: Math.max(0, avail - cache), hostTotal, swapTotal, swapFree, limited: false };
}

/* ------------------------------------------------------------------ cpu */

function cpuLimitCores() {
  const m = readSync('/sys/fs/cgroup/cpu.max');
  if (m) {
    const [q, p] = m.trim().split(/\s+/);
    return q !== 'max' && Number(p) > 0 ? Number(q) / Number(p) : null;
  }
  const q = Number(readSync('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const p = Number(readSync('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
  return q > 0 && p > 0 ? q / p : null;
}

function cgCpuMicros() {
  const v = parseKV(readSync('/sys/fs/cgroup/cpu.stat')).usage_usec;
  if (Number.isFinite(v)) return v;
  const n = Number(readSync('/sys/fs/cgroup/cpuacct/cpuacct.usage')) || Number(readSync('/sys/fs/cgroup/cpu,cpuacct/cpuacct.usage'));
  return n > 0 ? n / 1000 : null;
}

function usageBetween(a, b) {
  const sum = (t) => t.user + t.nice + t.sys + t.idle + t.irq;
  let total = 0, idle = 0;
  const cores = [];
  for (let i = 0; i < b.length; i++) {
    const p = a[i]?.times || b[i].times;
    const t = sum(b[i].times) - sum(p);
    const id = b[i].times.idle - p.idle;
    total += t;
    idle += id;
    cores.push(t > 0 ? clamp(Math.round(100 * (1 - id / t)), 0, 100) : 0);
  }
  return { cores, avg: total > 0 ? clamp(100 * (1 - idle / total), 0, 100) : 0 };
}

function cpuTemp() {
  let best = null;
  for (let i = 0; i < 6; i++) {
    const t = Number(readSync(`/sys/class/thermal/thermal_zone${i}/temp`));
    if (t > 1000 && t < 120000) best = Math.max(best ?? 0, t / 1000);
  }
  return best === null ? null : Math.round(best);
}

/* ------------------------------------------------------------------ ping */

async function httpPing(url, timeout = 2500) {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeout);
  const t = performance.now();
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'manual', headers: { 'user-agent': 'ping' } });
    const ms = performance.now() - t;
    try { await res.body?.cancel(); } catch {}
    return r1(ms);
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

async function netProbe(rounds) {
  let best = null;
  for (let r = 0; r < rounds; r++) {
    const row = (await Promise.all(PROBES.map(([, url]) => httpPing(url)))).filter((x) => x !== null);
    if (row.length) best = Math.min(best ?? Infinity, ...row);
  }
  return best;
}

/* ------------------------------------------------------------------ disk */

function runDf() {
  return new Promise((resolve) => {
    execFile('df', ['-kP'], { timeout: 2500 }, (err, out) => resolve(err ? '' : String(out)));
  });
}

async function readDisks() {
  const out = await runDf();
  const list = [];
  const seen = new Set();
  const badFs = /^(tmpfs|devtmpfs|udev|shm|none|efivarfs|cgroup\d*|proc|sysfs|squashfs|overlayfs)$/;
  const badMount = /^\/(proc|sys|dev|run|snap|boot\/efi|var\/lib\/(docker|kubelet|containers))(\/|$)|^\/etc\/(hosts|hostname|resolv\.conf)$/;

  for (const line of out.split('\n').slice(1)) {
    const p = line.trim().split(/\s+/);
    if (p.length < 6) continue;
    const used = Number(p[2]) * 1024, free = Number(p[3]) * 1024;
    const total = used + free;
    const mount = p.slice(5).join(' ');
    if (!(total > 0) || badFs.test(p[0]) || badMount.test(mount)) continue;
    const key = `${total}:${used}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const pct = clamp(Math.round((used / total) * 100), 0, 100);
    list.push({ mount, fs: p[0], total, used, free, pct });
  }

  if (!list.length) {
    try {
      const s = await fs.promises.statfs(process.cwd());
      const free = s.bavail * s.bsize, used = (s.blocks - s.bfree) * s.bsize, total = used + free;
      if (total > 0) list.push({ mount: process.cwd(), fs: 'statfs', total, used, free, pct: clamp(Math.round((used / total) * 100), 0, 100) });
    } catch {}
  }

  list.sort((a, b) => (a.mount === '/' ? -1 : b.mount === '/' ? 1 : b.total - a.total));
  return list.slice(0, 4);
}

/* ------------------------------------------------------------------ sistem */

function detectMode(memLimited, cpuLimit) {
  if (process.env.P_SERVER_UUID || process.env.P_SERVER_LOCATION) return ['Panel', 'Pterodactyl'];
  if (/com\.termux/.test(process.env.PREFIX || '')) return ['Termux', 'Android'];
  if (fs.existsSync('/.dockerenv') || memLimited || cpuLimit) return ['Container', 'Docker'];
  return ['VPS', 'server mandiri'];
}

/* ------------------------------------------------------------------ pengukuran */

async function measure({ steps, stepMs, rounds }) {
  const cores = os.cpus().length || 1;
  const limit = cpuLimitCores();
  const allot = limit || cores;
  const take = () => ({ t: performance.now(), cpus: os.cpus(), cg: cgCpuMicros(), pc: process.cpuUsage(), mem: memNow() });

  const pingP = netProbe(rounds);
  const diskP = readDisks();

  const snaps = [take()];
  let lag = 0;
  for (let i = 0; i < steps; i++) {
    const t = performance.now();
    await sleep(stepMs);
    lag = Math.max(lag, performance.now() - t - stepMs);
    snaps.push(take());
  }

  const cpuPts = [], hostPts = [], ramPts = [];
  let scoped = false;
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i];
    const dt = b.t - a.t;
    const host = usageBetween(a.cpus, b.cpus).avg;
    hostPts.push(host);
    if (a.cg !== null && b.cg !== null && dt > 0) {
      scoped = true;
      cpuPts.push(clamp(((b.cg - a.cg) / (dt * 1000) / allot) * 100, 0, 100));
    } else {
      cpuPts.push(host);
    }
    ramPts.push((b.mem.used / Math.max(1, b.mem.total)) * 100);
  }

  const first = snaps[0], last = snaps[snaps.length - 1];
  const wall = Math.max(1, last.t - first.t);
  const procPct = clamp(((last.pc.user + last.pc.system - first.pc.user - first.pc.system) / (wall * 1000)) * 100, 0, 100 * cores);

  return {
    cpuPts, hostPts, ramPts,
    cores: usageBetween(first.cpus, last.cpus).cores,
    scoped, limit, allot, procPct,
    lag: Math.max(0, lag), mem: last.mem,
    net: await pingP, disks: await diskP
  };
}

function pushHist(state, raw) {
  const put = (arr, pts) => {
    const add = state.first ? pts : (pts.length ? [mean(pts)] : []);
    for (const v of add) arr.push(r1(v));
    while (arr.length > HIST_MAX) arr.shift();
  };
  put(state.hist.ram, raw.ramPts);
  state.first = false;
}

function build(m, state, raw, wa, live) {
  const cpus = (() => { try { return os.cpus() || []; } catch { return []; } })();
  const mu = process.memoryUsage();
  const mem = raw.mem;
  const load = (() => { try { return os.loadavg().map((v) => Number(v.toFixed(2))); } catch { return [0, 0, 0]; } })();
  const now = new Date();
  const pingMs = wa !== null ? Math.round(wa) : (raw.net !== null ? Math.round(raw.net) : null);

  return {
    sid: state.sid,
    name: config.bot?.name || 'Ourin-AI',
    prefix: m.prefix || '.',
    mode: detectMode(mem.limited, raw.limit),
    live,
    time: now.toLocaleTimeString('en-GB', { hour12: false }),
    ping: pingMs,
    lag: r1(raw.lag),
    botUp: Math.floor(process.uptime()),
    mem: { ...mem, pct: clamp(Math.round((mem.used / Math.max(1, mem.total)) * 100), 0, 100) },
    node: { heapUsed: mu.heapUsed, rss: mu.rss },
    disks: raw.disks,
    cpu: {
      avg: Math.round(mean(raw.cpuPts)), host: Math.round(mean(raw.hostPts)), scoped: raw.scoped,
      cores: cpus.length || raw.cores.length, usage: raw.cores.slice(0, 64),
      model: (cpus[0]?.model || 'CPU tidak dikenal').replace(/\s+/g, ' ').trim(),
      load, allot: raw.allot, limit: raw.limit ? r1(raw.limit) : null,
      proc: r1(raw.procPct), temp: cpuTemp()
    },
    hist: { ram: state.hist.ram }
  };
}

/* ------------------------------------------------------------------ tampilan */

function createDash(D) {
  const json = JSON.stringify(D)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `<style>
  :root{color-scheme:dark;--screen:#000;--ink:#e4e7ec;--mute:#8a919c;--dim:#505762;--rule:#1c2026;--well:#12161b;--ok:#46d68c;--warn:#f0a63a;--bad:#ff5d5d;--ram:#6b9bff;--disk:#4ccfe8;--cpu:#46d68c;--ease:cubic-bezier(.2,.8,.2,1)}
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:none}
  button{font:inherit;color:inherit;background:none;border:none;cursor:pointer}
  html,body{background:transparent;color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;width:100%}
  .wrap{display:flex;justify-content:center;padding:10px}
  .app{width:100%;max-width:340px;background:var(--screen);border:1px solid #20252c;border-radius:22px;overflow:hidden;box-shadow:0 20px 44px rgba(0,0,0,.55)}

  .head{display:flex;justify-content:space-between;align-items:center;gap:12px;height:62px;padding:0 16px;border-bottom:1px solid var(--rule)}
  .who{flex:1;min-width:0}
  .who .tx{min-width:0;overflow:hidden;text-overflow:ellipsis;font-style:normal}
  .who b{display:block;font-size:15px;font-weight:700;letter-spacing:-.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .who span{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:11px;color:var(--mute);white-space:nowrap}
  .who i{width:6px;height:6px;border-radius:50%;background:var(--dim);flex:none}
  .who .live i{background:var(--ok);animation:pulse 1.4s ease-in-out infinite}
  .hs{display:flex;gap:14px;flex:none}
  .hs em{font-style:normal}
  .hs span{display:block;font-size:10.5px;color:var(--mute)}
  .hs b{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
  .hs i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
  .hs i.warn{background:var(--warn)}
  .hs i.bad{background:var(--bad)}
  @keyframes pulse{50%{opacity:.25}}

  .nx{display:none;height:2px;background:var(--rule)}
  .nx i{display:block;height:100%;width:0;background:var(--ok);animation:nx var(--d,5s) linear forwards}
  @keyframes nx{to{width:100%}}

  .vp{overflow:hidden;touch-action:pan-y;height:416px}
  .track{display:flex;width:300%;height:100%;will-change:transform}
  .pg{flex:0 0 33.3333%;height:100%;padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:32px 124px 60px 56px 1fr;gap:8px;overflow:hidden}

  .ph{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  .ph b{display:block;font-size:16px;font-weight:700}
  .ph span{display:block;margin-top:2px;max-width:190px;font-size:11px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chip{display:flex;align-items:center;gap:6px;flex:none;padding:4px 11px 4px 9px;border-radius:999px;border:1px solid var(--rule);font-size:11.5px;font-weight:600}
  .chip i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
  .chip.warn{color:var(--warn);border-color:rgba(240,166,58,.35)}
  .chip.warn i{background:var(--warn)}
  .chip.bad{color:var(--bad);border-color:rgba(255,93,93,.4)}
  .chip.bad i{background:var(--bad);animation:pulse 1s ease-in-out infinite}

  .gz{position:relative;display:flex;justify-content:center}
  .gz svg{width:224px;height:123px;overflow:visible}
  .gt{fill:none;stroke:var(--well);stroke-width:14;stroke-linecap:round}
  .gp{fill:none;stroke-width:14;stroke-linecap:round;stroke-dasharray:314.16;stroke-dashoffset:314.16}
  .tk{stroke:#fff;stroke-opacity:.3;stroke-width:1.5}
  .nd{transform-origin:120px 120px}
  .ndk{fill:#fff}
  .ndr{fill:none;stroke:#fff;stroke-opacity:.55;stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:ring 1.9s ease-out infinite}
  @keyframes ring{from{transform:scale(1);opacity:.8}to{transform:scale(2.6);opacity:0}}
  .gc{position:absolute;left:0;right:0;bottom:0;text-align:center}
  .gc b{display:block;font-size:46px;font-weight:200;letter-spacing:-2px;line-height:1;font-variant-numeric:tabular-nums}
  .gc em{font-style:normal}
  .gc u{margin-left:3px;font-size:16px;font-weight:400;letter-spacing:0;text-decoration:none;color:var(--mute)}
  .gc span{display:block;margin-top:5px;font-size:11.5px;color:var(--mute)}

  .bs{display:flex;flex-direction:column;justify-content:center;gap:6px}
  .bar{position:relative;display:flex;gap:2px;height:14px;border-radius:7px;background:var(--well);overflow:hidden}
  .bar i{display:block;flex:none;width:0;height:100%;border-radius:2px;transition:width 1.1s var(--ease)}
  .bar b{position:absolute;top:0;bottom:0;width:2px;background:#000;z-index:2}
  .sc{position:relative;height:11px;font-size:9px;color:var(--dim)}
  .sc span{position:absolute;top:0;transform:translateX(-50%)}
  .lg{display:flex;justify-content:space-between;gap:4px;font-size:10.5px;color:var(--mute)}
  .lg span{display:flex;align-items:center;gap:4px;white-space:nowrap}
  .lg i{display:block;width:8px;height:8px;border-radius:2px}
  .lg b{margin-left:2px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}

  .lm{display:grid;grid-template-columns:44px 1fr 78px;gap:8px;align-items:center;height:18px;font-size:11.5px;color:var(--mute)}
  .lm .trk{height:8px;border-radius:4px;background:var(--well);overflow:hidden}
  .lm .trk i{display:block;width:0;height:100%;border-radius:4px;transition:width 1.1s var(--ease)}
  .lm em{font-style:normal;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}

  .tl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .tl div{min-width:0;padding:8px 10px;border:1px solid var(--rule);border-radius:12px}
  .tl span{display:block;font-size:10.5px;color:var(--mute)}
  .tl b{display:block;margin-top:4px;font-size:17px;font-weight:600;letter-spacing:-.3px;white-space:nowrap;font-variant-numeric:tabular-nums}
  .tl u{margin-left:3px;font-size:11px;font-weight:400;text-decoration:none;color:var(--mute)}

  .ft{display:flex;flex-direction:column;gap:6px;min-height:0}
  .th{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--mute);height:14px;white-space:nowrap}
  .th em{font-style:normal;color:var(--ink);font-variant-numeric:tabular-nums}
  .tw{position:relative;height:38px}
  .tw svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible}
  .bl{stroke:#171b21;stroke-width:1}
  .ft1{stroke-width:1;stroke-dasharray:2 3;opacity:.7}
  .ln{fill:none;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.2s var(--ease)}
  .ar{opacity:0;fill-opacity:.14;transition:opacity 1.2s ease}
  .ex{display:flex;justify-content:space-between;font-size:11px;color:var(--mute);height:16px}
  .ex b{margin-left:4px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}

  .pr{display:grid;grid-template-columns:1fr 84px 34px;gap:8px;align-items:center;height:21px;font-size:11.5px;color:var(--mute)}
  .pr span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pr .trk{height:6px;border-radius:3px;background:var(--well);overflow:hidden}
  .pr .trk i{display:block;width:0;height:100%;border-radius:3px;transition:width 1.1s var(--ease)}
  .pr em{font-style:normal;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums}
  .kv{display:flex;justify-content:space-between;gap:12px;height:21px;align-items:center;font-size:11.5px;color:var(--mute)}
  .kv b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink)}
  .none{font-size:11.5px;line-height:1.5;color:var(--mute)}

  .cb{display:flex;align-items:stretch;gap:5px;height:60px}
  .cbc{flex:1;max-width:44px;display:flex;flex-direction:column;gap:3px;min-width:0}
  .cbt{position:relative;flex:1;border-radius:6px;background:var(--well);overflow:hidden}
  .cbf{position:absolute;left:0;right:0;bottom:0;height:0;border-radius:6px;transition:height 1.1s var(--ease)}
  .cbc small{display:block;height:10px;font-size:9px;line-height:10px;text-align:center;color:var(--dim)}
  .cg{display:flex;flex-wrap:wrap;align-content:flex-start;height:60px}
  .hc{display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:9.5px;font-weight:700;font-variant-numeric:tabular-nums;transform:scale(.4);opacity:0;transition:transform .5s cubic-bezier(.3,1.4,.4,1),opacity .3s ease}
  .hc.in{transform:none;opacity:1}
  .sel{box-shadow:0 0 0 1.5px var(--ink)}

  .foot{padding:0 16px 10px;font-size:10.5px;text-align:center;color:var(--dim)}
  .keys{position:relative;display:flex;gap:4px;padding:8px;border-top:1px solid var(--rule)}
  .pill{position:absolute;top:8px;bottom:8px;left:0;width:0;border-radius:10px;background:var(--ink);transition:transform .45s var(--ease),width .45s var(--ease)}
  .keys button{position:relative;z-index:1;flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 0;border-radius:10px;font-size:12.5px;font-weight:600;color:var(--mute);transition:color .25s ease}
  .keys button.on{color:#000}
  .keys i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
  .keys i.warn{background:var(--warn)}
  .keys i.bad{background:var(--bad)}

  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  </style>

  <div class="wrap">
    <div class="app">
      <div class="head">
        <div class="who"><b id="name">Bot</b><span id="sub"></span></div>
        <div class="hs">
          <div><span>Ping</span><b><i id="pdot"></i><em id="ping">-</em></b></div>
          <div><span>Runtime</span><b id="rt">-</b></div>
        </div>
      </div>
      <div class="nx" id="nx"><i></i></div>
      <div class="vp" id="vp"><div class="track" id="track"></div></div>
      <div class="foot" id="foot"></div>
      <nav class="keys" id="keys"></nav>
    </div>
  </div>

  <script>
  (function(){
    var D = ${json};
    var NS = 'http://www.w3.org/2000/svg';
    var $ = function(id){ return document.getElementById(id); };
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var raf = window.requestAnimationFrame ? function(f){ return window.requestAnimationFrame(f); } : function(f){ return setTimeout(f, 33); };
    var t0 = Date.now(), GB = 1073741824, MB = 1048576, KB = 1024, ARC = 314.16;
    var EASE = 'cubic-bezier(.2,.8,.2,1)';
    var calm = D.live.state === 'live' && D.live.tick > 1;

    function h(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt !== undefined && txt !== null) e.textContent = txt; return e; }
    function sv(tag, at){ var e = document.createElementNS(NS, tag); for(var k in at) e.setAttribute(k, at[k]); return e; }
    function pad(n){ return String(n).padStart(2, '0'); }
    function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
    function nn(v){ return String(Math.round(v * 100) / 100); }
    function bp(b){
      if(b === null || b === undefined || isNaN(b)) return ['-', ''];
      if(b >= GB) return [(b / GB).toFixed(b >= 100 * GB ? 0 : b >= 10 * GB ? 1 : 2), 'GB'];
      if(b >= MB) return [String(Math.round(b / MB)), 'MB'];
      return [String(Math.round(b / KB)), 'KB'];
    }
    function bytes(b){ var p = bp(b); return p[1] ? p[0] + ' ' + p[1] : p[0]; }
    function up(s){
      var d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60);
      return d ? d + 'h ' + hh + 'j ' + pad(m) + 'm' : hh + 'j ' + pad(m) + 'm ' + pad(x) + 'd';
    }
    function lvl(p){ return p === null || p === undefined ? '' : p >= 90 ? 'bad' : p >= 75 ? 'warn' : ''; }
    function word(l){ return l === 'bad' ? 'Kritis' : l === 'warn' ? 'Padat' : 'Aman'; }
    function tone(p, accent){ var l = lvl(p); return l === 'bad' ? 'var(--bad)' : l === 'warn' ? 'var(--warn)' : accent; }
    function pctTxt(x){ return x === null || x === undefined ? '-' : String(Math.round(x)); }

    /* ---------- animasi terdaftar per halaman ---------- */
    var fx = [[], [], []];
    function reg(i, f){ fx[i].push(f); }
    function playPg(i, anim){ for(var k = 0; k < fx[i].length; k++) fx[i][k](true, anim && !reduce); }
    function resetPg(i){ for(var k = 0; k < fx[i].length; k++) fx[i][k](false, false); }
    function setNum(el, to, fmt, on, anim){
      el._tk = (el._tk || 0) + 1;
      var tk = el._tk;
      if(to === null || to === undefined){ el.textContent = fmt(null); return; }
      if(!on){ el.textContent = fmt(0); return; }
      if(!anim){ el.textContent = fmt(to); return; }
      var s = Date.now();
      (function step(){
        if(el._tk !== tk) return;
        var k = Math.min(1, (Date.now() - s) / 1200);
        el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
        if(k < 1) raf(step);
      })();
    }
    function grow(i, el, prop, to, delay){
      reg(i, function(on, anim){
        el.style.transition = anim ? '' : 'none';
        el.style.transitionDelay = (anim ? delay : 0) + 'ms';
        el.style[prop] = on ? to + '%' : '0%';
      });
    }

    /* ---------- kerangka halaman ---------- */
    var track = $('track');
    function mkpg(){ var p = h('section', 'pg'); track.appendChild(p); return p; }
    function head(pg, title, sub, pct){
      var ph = h('div', 'ph');
      var l = h('div');
      l.appendChild(h('b', '', title));
      l.appendChild(h('span', '', sub));
      var l2 = lvl(pct);
      var chip = h('div', 'chip ' + l2);
      chip.appendChild(h('i'));
      chip.appendChild(document.createTextNode(pct === null ? 'Tidak ada data' : word(l2)));
      ph.appendChild(l); ph.appendChild(chip);
      pg.appendChild(ph);
    }
    function gauge(i, pg, o){
      var gz = h('div', 'gz');
      var svg = sv('svg', { viewBox: '0 0 240 132' });
      var d = 'M 20 120 A 100 100 0 0 1 220 120';
      svg.appendChild(sv('path', { d: d, 'class': 'gt' }));
      var arc = sv('path', { d: d, 'class': 'gp' });
      arc.style.stroke = tone(o.pct, o.color);
      svg.appendChild(arc);
      [75, 90].forEach(function(t){
        var a = Math.PI * t / 100;
        svg.appendChild(sv('line', {
          x1: (120 - 90 * Math.cos(a)).toFixed(1), y1: (120 - 90 * Math.sin(a)).toFixed(1),
          x2: (120 - 110 * Math.cos(a)).toFixed(1), y2: (120 - 110 * Math.sin(a)).toFixed(1), 'class': 'tk'
        }));
      });
      var nd = sv('g', { 'class': 'nd' });
      nd.appendChild(sv('circle', { cx: 20, cy: 120, r: 7.5, 'class': 'ndr' }));
      nd.appendChild(sv('circle', { cx: 20, cy: 120, r: 4, 'class': 'ndk' }));
      svg.appendChild(nd);
      gz.appendChild(svg);
      var gc = h('div', 'gc');
      var b = h('b'), em = h('em', '', '0');
      b.appendChild(em);
      b.appendChild(h('u', '', o.pct === null ? '' : '%'));
      gc.appendChild(b);
      gc.appendChild(h('span', '', o.cap));
      gz.appendChild(gc);
      pg.appendChild(gz);
      reg(i, function(on, anim){
        var tr = anim ? '1.2s ' + EASE : '';
        arc.style.transition = anim ? 'stroke-dashoffset ' + tr : 'none';
        arc.style.strokeDashoffset = String(on && o.pct !== null ? ARC * (1 - o.pct / 100) : ARC);
        nd.style.transition = anim ? 'transform ' + tr : 'none';
        nd.style.transform = 'rotate(' + (on && o.pct !== null ? o.pct * 1.8 : 0) + 'deg)';
        setNum(em, o.pct, pctTxt, on, anim);
      });
    }
    function legendItem(parent, color, label, val){
      var s = h('span');
      var sw = h('i'); sw.style.background = color;
      s.appendChild(sw);
      s.appendChild(document.createTextNode(label));
      s.appendChild(h('b', '', val));
      parent.appendChild(s);
    }
    function stackBar(i, pg, segs){
      var bs = h('div', 'bs');
      var bar = h('div', 'bar');
      segs.forEach(function(s, k){
        var el = h('i'); el.style.background = s.color;
        bar.appendChild(el);
        grow(i, el, 'width', s.pct.toFixed(2), 120 * k);
      });
      [75, 90].forEach(function(t){ var m = h('b'); m.style.left = t + '%'; bar.appendChild(m); });
      bs.appendChild(bar);
      var sc = h('div', 'sc');
      [75, 90].forEach(function(t){ var s = h('span', '', String(t)); s.style.left = t + '%'; sc.appendChild(s); });
      bs.appendChild(sc);
      var lg = h('div', 'lg');
      segs.forEach(function(s){ legendItem(lg, s.color, s.label, s.val); });
      bs.appendChild(lg);
      pg.appendChild(bs);
    }
    function tiles(pg, list){
      var tl = h('div', 'tl');
      list.forEach(function(t){
        var d = h('div');
        d.appendChild(h('span', '', t[0]));
        var b = h('b', '', t[1]);
        if(t[2]) b.appendChild(h('u', '', t[2]));
        d.appendChild(b);
        tl.appendChild(d);
      });
      pg.appendChild(tl);
    }
    function kv(parent, k, v){
      var r = h('div', 'kv');
      r.appendChild(h('span', '', k));
      r.appendChild(h('b', '', v));
      parent.appendChild(r);
    }
    function trend(i, box, d, color){
      var r = box.getBoundingClientRect();
      var W = Math.max(80, Math.round(r.width || 300)), H = Math.max(20, Math.round(r.height || 38));
      var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H });
      box.appendChild(svg);
      svg.appendChild(sv('line', { x1: 0, x2: W, y1: H - 0.5, y2: H - 0.5, 'class': 'bl' }));
      var n = d.length, P = 4;
      function yy(v){ return H - P - (clamp(v, 0, 100) / 100) * (H - 2 * P); }
      if(n < 2){
        var y = yy(n ? d[0] : 0);
        var fl = sv('line', { x1: 0, x2: W, y1: y, y2: y, 'class': 'ft1' });
        fl.style.stroke = color;
        svg.appendChild(fl);
        return;
      }
      var line = '', x;
      for(var k = 0; k < n; k++){
        x = k / (n - 1) * (W - 4) + 2;
        line += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + yy(d[k]).toFixed(1);
      }
      var area = sv('path', { d: line + 'L' + (W - 2) + ' ' + H + 'L2 ' + H + 'Z', 'class': 'ar' });
      area.style.fill = color;
      svg.appendChild(area);
      var p = sv('path', { d: line, pathLength: '1', 'class': 'ln' });
      p.style.stroke = color;
      svg.appendChild(p);
      var dot = sv('circle', { cx: x.toFixed(1), cy: yy(d[n - 1]).toFixed(1), r: 3 });
      dot.style.fill = color;
      svg.appendChild(dot);
      reg(i, function(on, anim){
        p.style.transition = anim ? '' : 'none';
        p.style.strokeDashoffset = on ? '0' : '1';
        area.style.transition = anim ? '' : 'none';
        area.style.opacity = on ? '1' : '0';
      });
    }

    /* ---------- halaman 1: RAM ---------- */
    function pRam(i){
      var M = D.mem, pg = mkpg(), c = tone(M.pct, 'var(--ram)');
      head(pg, 'RAM', 'Memori ' + (M.limited ? 'panel' : 'server'), M.pct);
      gauge(i, pg, { pct: M.pct, color: 'var(--ram)', cap: bytes(M.used) + ' dari ' + bytes(M.total) });
      var pc = function(v){ return Math.max(0, v / Math.max(1, M.total) * 100); };
      stackBar(i, pg, [
        { pct: pc(M.used), color: c, label: 'Pakai', val: bytes(M.used) },
        { pct: pc(M.cache), color: 'rgba(107,155,255,.38)', label: 'Cache', val: bytes(M.cache) },
        { pct: 0, color: '#222831', label: 'Bebas', val: bytes(M.free) }
      ]);
      var b = bp(M.used), f = bp(M.free), t = bp(M.total);
      tiles(pg, [['Terpakai', b[0], b[1]], ['Bebas', f[0], f[1]], ['Total', t[0], t[1]]]);

      var ft = h('div', 'ft');
      var th = h('div', 'th');
      var hs = D.hist.ram;
      th.appendChild(h('span', '', hs.length > 1 ? 'Tren memori' : 'Tren memori (mengumpulkan data)'));
      th.appendChild(h('em', '', hs.length ? 'puncak ' + Math.round(Math.max.apply(null, hs)) + '%' : ''));
      ft.appendChild(th);
      var tw = h('div', 'tw');
      ft.appendChild(tw);
      var ex = h('div', 'ex');
      var sw = M.swapTotal ? bytes(M.swapTotal - M.swapFree) : 'mati';
      [['Swap', sw], ['Heap bot', bytes(D.node.heapUsed)], ['RSS bot', bytes(D.node.rss)]].forEach(function(x){
        var s = h('span', '', x[0]);
        s.appendChild(h('b', '', x[1]));
        ex.appendChild(s);
      });
      ft.appendChild(ex);
      pg.appendChild(ft);
      trend(i, tw, hs, c);
    }

    /* ---------- halaman 2: Disk ---------- */
    function pDisk(i){
      var pg = mkpg(), d0 = D.disks[0] || null;
      var pct = d0 ? d0.pct : null, c = tone(pct, 'var(--disk)');
      head(pg, 'Disk', d0 ? d0.mount + ', ' + d0.fs : 'Penyimpanan tidak terbaca', pct);
      gauge(i, pg, { pct: pct, color: 'var(--disk)', cap: d0 ? bytes(d0.used) + ' dari ' + bytes(d0.total) : 'data tidak tersedia' });
      if(d0){
        var pc = function(v){ return Math.max(0, v / Math.max(1, d0.total) * 100); };
        stackBar(i, pg, [
          { pct: pc(d0.used), color: c, label: 'Pakai', val: bytes(d0.used) },
          { pct: 0, color: '#222831', label: 'Bebas', val: bytes(d0.free) }
        ]);
        var u = bp(d0.used), f = bp(d0.free), t = bp(d0.total);
        tiles(pg, [['Terpakai', u[0], u[1]], ['Bebas', f[0], f[1]], ['Total', t[0], t[1]]]);
      } else {
        pg.appendChild(h('div'));
        pg.appendChild(h('div'));
      }
      var ft = h('div', 'ft');
      var others = D.disks.slice(1, 4);
      if(others.length){
        var th = h('div', 'th');
        th.appendChild(h('span', '', 'Partisi lain'));
        ft.appendChild(th);
        others.forEach(function(d, k){
          var r = h('div', 'pr');
          r.appendChild(h('span', '', d.mount));
          var trk = h('div', 'trk'), fl = h('i');
          fl.style.background = tone(d.pct, 'var(--disk)');
          trk.appendChild(fl);
          r.appendChild(trk);
          r.appendChild(h('em', '', d.pct + '%'));
          ft.appendChild(r);
          grow(i, fl, 'width', Math.max(1, d.pct), 140 + k * 100);
        });
      } else if(d0){
        var th2 = h('div', 'th');
        th2.appendChild(h('span', '', 'Rincian partisi'));
        ft.appendChild(th2);
        kv(ft, 'Titik mount', d0.mount);
        kv(ft, 'Sistem berkas', d0.fs);
        kv(ft, 'Hanya satu partisi terbaca', 'ya');
      } else {
        ft.appendChild(h('div', 'none', 'Perintah df dan statfs tidak tersedia di platform ini.'));
      }
      pg.appendChild(ft);
    }

    /* ---------- halaman 3: CPU ---------- */
    function pCpu(i){
      var C = D.cpu, pg = mkpg(), c = tone(C.avg, 'var(--cpu)');
      var model = C.model.split('(R)').join('').split('(TM)').join('').split('CPU').join('').trim();
      head(pg, 'CPU', model, C.avg);
      var cap = C.cores + ' core' + (C.limit ? ', batas ' + nn(C.limit) : '') + (C.scoped ? ', host ' + C.host + '%' : '');
      gauge(i, pg, { pct: C.avg, color: 'var(--cpu)', cap: cap });

      var bs = h('div', 'bs');
      bs.style.gap = '3px';
      ['1 mnt', '5 mnt', '15 mnt'].forEach(function(n, k){
        var p = clamp(C.load[k] / Math.max(0.1, C.allot) * 100, 0, 100);
        var r = h('div', 'lm');
        r.appendChild(h('span', '', n));
        var trk = h('div', 'trk'), fl = h('i');
        fl.style.background = tone(p, 'var(--cpu)');
        trk.appendChild(fl);
        r.appendChild(trk);
        r.appendChild(h('em', '', C.load[k].toFixed(2) + ' (' + Math.round(p) + '%)'));
        bs.appendChild(r);
        grow(i, fl, 'width', Math.max(1, p), 100 * k);
      });
      pg.appendChild(bs);

      var t3 = C.temp !== null ? ['Suhu', String(C.temp), 'C'] : ['Lag loop', String(D.lag), 'ms'];
      tiles(pg, [['Core', String(C.cores)], ['Proses bot', String(C.proc), '%'], t3]);

      var ft = h('div', 'ft');
      var th = h('div', 'th');
      th.appendChild(h('span', '', 'Beban per core'));
      var info = h('em', '', C.usage.length ? 'ketuk untuk detail' : '');
      th.appendChild(info);
      ft.appendChild(th);
      pg.appendChild(ft);

      var n = C.usage.length;
      if(!n){ ft.appendChild(h('div', 'none', 'Data per core tidak tersedia di platform ini.')); return; }
      var sel = null;
      function pick(el, k){
        if(sel) sel.classList.remove('sel');
        sel = el; el.classList.add('sel');
        info.textContent = 'Core ' + (k + 1) + ' di ' + C.usage[k] + '%';
      }
      function col(v){ return v >= 90 ? 'var(--bad)' : v >= 75 ? 'var(--warn)' : 'var(--cpu)'; }

      if(n <= 12){
        var cb = h('div', 'cb');
        C.usage.forEach(function(v, k){
          var cc = h('div', 'cbc'), t = h('div', 'cbt'), f = h('div', 'cbf');
          f.style.background = col(v);
          t.appendChild(f);
          cc.appendChild(t);
          cc.appendChild(h('small', '', String(k + 1)));
          cc.onclick = function(){ pick(t, k); };
          cb.appendChild(cc);
          grow(i, f, 'height', Math.max(3, v), 70 * k);
        });
        ft.appendChild(cb);
      } else {
        var grid = h('div', 'cg');
        ft.appendChild(grid);
        var W = Math.max(200, Math.round(grid.getBoundingClientRect().width || 308)), H = 60, gap = 3, size = 10, cols = 1;
        for(var s = 34; s >= 8; s--){
          cols = Math.floor((W + gap) / (s + gap));
          if(Math.ceil(n / cols) * (s + gap) - gap <= H){ size = s; break; }
          size = s;
        }
        var cells = [];
        C.usage.forEach(function(v, k){
          var cell = h('button', 'hc', size >= 16 ? String(v) : '');
          var rgb = v >= 90 ? '255,93,93' : v >= 75 ? '240,166,58' : '70,214,140';
          cell.style.width = size + 'px';
          cell.style.height = size + 'px';
          cell.style.margin = '0 ' + gap + 'px ' + gap + 'px 0';
          cell.style.background = 'rgba(' + rgb + ',' + (0.14 + v / 100 * 0.86).toFixed(2) + ')';
          cell.style.color = v >= 55 ? '#000' : 'var(--ink)';
          cell.style.transitionDelay = (k * 22) + 'ms';
          cell.onclick = function(){ pick(cell, k); };
          grid.appendChild(cell);
          cells.push(cell);
        });
        reg(i, function(on, anim){
          cells.forEach(function(c){
            c.style.transition = anim ? '' : 'none';
            c.classList.toggle('in', on);
          });
        });
      }
    }

    /* ---------- kepala ---------- */
    $('name').textContent = D.name;
    var sub = $('sub');
    var stText = D.live.state === 'live' ? 'Live ' + D.live.tick + '/' + D.live.total : D.live.state === 'done' ? 'Live selesai' : 'Snapshot';
    var dot = h('i');
    sub.className = D.live.state === 'live' ? 'live' : '';
    sub.appendChild(dot);
    sub.appendChild(h('em', 'tx', stText + ', ' + D.mode[0]));
    sub.title = D.time;
    if(D.live.state === 'live'){
      $('nx').style.display = 'block';
      $('nx').style.setProperty('--d', D.live.every + 's');
    }
    $('ping').textContent = D.ping === null ? '-' : D.ping + ' ms';
    $('pdot').className = D.ping === null ? 'bad' : D.ping > 600 ? 'bad' : D.ping > 300 ? 'warn' : '';
    function tickRt(){ $('rt').textContent = up(D.botUp + (Date.now() - t0) / 1000); }
    tickRt();
    setInterval(tickRt, 1000);
    $('foot').textContent = D.live.state === 'live' ? 'Hentikan dengan ' + D.prefix + 'ping stop' : 'Geser untuk pindah halaman';

    /* ---------- susun halaman ---------- */
    pRam(0); pDisk(1); pCpu(2);
    var statuses = [D.mem.pct, D.disks[0] ? D.disks[0].pct : null, D.cpu.avg];
    var names = ['RAM', 'Disk', 'CPU'];

    /* ---------- navigasi: tab, pil, geser ---------- */
    var keys = $('keys'), vp = $('vp');
    var pill = h('div', 'pill');
    pill.style.transition = 'none';
    keys.appendChild(pill);
    var btns = names.map(function(n, i){
      var b = h('button');
      b.appendChild(h('i', lvl(statuses[i])));
      b.appendChild(document.createTextNode(n));
      b.onclick = function(){ go(i, false); };
      keys.appendChild(b);
      return b;
    });
    var cur = 0, visited = {};
    function setT(i, dx, anim){
      track.style.transition = anim && !reduce ? 'transform .5s ' + EASE : 'none';
      track.style.transform = 'translateX(calc(' + (-i * 33.3333) + '% + ' + dx + 'px))';
    }
    function mark(i){
      btns.forEach(function(b, k){ b.classList.toggle('on', k === i); });
      pill.style.width = btns[i].offsetWidth + 'px';
      pill.style.transform = 'translateX(' + btns[i].offsetLeft + 'px)';
    }
    function go(i, viaDrag){
      i = clamp(i, 0, 2);
      var changed = i !== cur;
      cur = i;
      setT(i, 0, true);
      mark(i);
      if(!calm){
        if(!viaDrag && changed){ resetPg(i); void document.body.offsetWidth; playPg(i, true); visited[i] = 1; }
        else if(!visited[i]){ visited[i] = 1; playPg(i, true); }
      }
      try{ sessionStorage.setItem('ping_' + D.sid, String(i)); }catch(e){}
    }
    var drag = null;
    vp.addEventListener('pointerdown', function(e){
      drag = { x: e.clientX, y: e.clientY, t: Date.now(), lock: null, dx: 0, w: vp.clientWidth || 300 };
    });
    vp.addEventListener('pointermove', function(e){
      if(!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if(drag.lock === null){
        if(Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if(Math.abs(dx) > Math.abs(dy) * 1.2){
          drag.lock = 'x';
          try{ vp.setPointerCapture(e.pointerId); }catch(x){}
          var nb = cur + (dx < 0 ? 1 : -1);
          if(!calm && nb >= 0 && nb <= 2 && !visited[nb]){ visited[nb] = 1; playPg(nb, true); }
        } else { drag = null; return; }
      }
      var edge = (cur === 0 && dx > 0) || (cur === 2 && dx < 0);
      drag.dx = dx;
      setT(cur, edge ? dx * 0.3 : dx, false);
    });
    function endDrag(){
      if(!drag) return;
      var d = drag; drag = null;
      if(d.lock !== 'x'){ return; }
      var v = d.dx / Math.max(1, Date.now() - d.t);
      var next = cur;
      if(d.dx < -d.w * 0.2 || v < -0.5) next = cur + 1;
      else if(d.dx > d.w * 0.2 || v > 0.5) next = cur - 1;
      go(next, true);
    }
    vp.addEventListener('pointerup', endDrag);
    vp.addEventListener('pointercancel', endDrag);

    /* ---------- mulai ---------- */
    var start = 0;
    try{ start = parseInt(sessionStorage.getItem('ping_' + D.sid), 10) || 0; }catch(e){}
    cur = clamp(start, 0, 2);
    setT(cur, 0, false);
    mark(cur);
    if(calm){
      for(var k = 0; k < 3; k++) playPg(k, false);
    } else {
      for(var k2 = 0; k2 < 3; k2++) resetPg(k2);
      visited[cur] = 1;
      void document.body.offsetWidth;
      raf(function(){ playPg(cur, true); });
    }
    raf(function(){ pill.style.transition = ''; });
  })()
  </script>`;
}

/* ------------------------------------------------------------------ pengiriman */

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

/** Placeholder dikirim lebih dulu; lamanya sekaligus jadi ukuran waktu kirim ke WhatsApp (ping). */
async function sendPlaceholder(conn, m, text) {
  const t = performance.now();
  try {
    const sent = await conn.sendAIRich(m.chat, (r) => r.addText(text), { quoted: m, bypassDownload: false });
    const ms = performance.now() - t;
    return sent?.key?.id ? { sent, ms } : { sent: null, ms };
  } catch {
    return { sent: null, ms: null };
  }
}

async function editRich(conn, chat, id, html, title) {
  const rich = new conn.builders.AIRich(conn);
  rich.setTitle(title);
  rich.addSection(richSection(html));
  await rich.sendEdit(chat, id);
}

async function dropMessage(conn, chat, sent) {
  if (sent?.key) await conn.sendMessage(chat, { delete: sent.key }).catch(() => {});
}

async function deliver(conn, m, html, title, sent) {
  if (sent?.key?.id) {
    try {
      await editRich(conn, m.chat, sent.key.id, html, title);
      return sent.key.id;
    } catch (e) {
      console.error('[PING] edit placeholder gagal, kirim langsung:', e?.message || e);
      await dropMessage(conn, m.chat, sent);
    }
  }
  try {
    const res = await conn.sendAIRich(m.chat, (r) => {
      r.setTitle(title);
      r.addSection(richSection(html));
    }, { quoted: m });
    return res?.key?.id || null;
  } catch (e) {
    console.error('[PING] sendAIRich gagal, pakai relay:', e?.message || e);
    await relayRich(conn, m.chat, html, title);
    return null;
  }
}

async function waitFor(ms, stopped) {
  const end = Date.now() + ms;
  while (Date.now() < end && !stopped()) await sleep(Math.min(250, end - Date.now()));
}

/* ------------------------------------------------------------------ handler */

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  const prefix = m.prefix || '.';
  const args = (m.text || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sub = args[0];
  const react = (e) => Promise.resolve().then(() => m.react(e)).catch(() => {});

  if (sub === 'stop') {
    const s = sessions.get(m.chat);
    if (!s) return m.reply('Tidak ada pantauan live yang sedang berjalan di chat ini.');
    s.stop();
    return react('🛑');
  }

  if (sessions.has(m.chat)) {
    return m.reply(`Pantauan live masih berjalan di chat ini.\nKetik \`${prefix}ping stop\` untuk menghentikannya.`);
  }

  const isLive = sub === 'live';
  const seconds = isLive ? clamp(parseInt(args[1], 10) || LIVE_DEFAULT_S, LIVE_MIN_S, LIVE_MAX_S) : 0;
  const total = isLive ? Math.max(2, Math.floor((seconds * 1000) / LIVE_EVERY_MS)) : 0;
  const title = `${config.bot?.name || 'Ourin-AI'} status server`;

  react('📡');
  const state = { sid: randomUUID().slice(0, 8), hist: { ram: [] }, first: true };

  try {
    const pending = sendPlaceholder(conn, m, 'Mengukur server…');
    const rawP = measure({ steps: 6, stepMs: 150, rounds: 2 });
    const [ph, raw] = await Promise.all([pending, rawP]);
    pushHist(state, raw);

    let wa = ph.ms;
    let D = build(m, state, raw, wa, isLive
      ? { state: 'live', tick: 1, total, every: LIVE_EVERY_MS / 1000 }
      : { state: 'snap' });

    const t1 = performance.now();
    const id = await deliver(conn, m, createDash(D), title, ph.sent);
    if (!isLive) {
      react('✅');
      return;
    }

    wa = performance.now() - t1;
    let stopFlag = false;
    sessions.set(m.chat, { stop: () => { stopFlag = true; } });

    try {
      if (!id) throw new Error('pesan tidak bisa diedit, mode live dihentikan');

      for (let tick = 2; tick <= total && !stopFlag; tick++) {
        const tStart = Date.now();
        const next = await measure({ steps: 2, stepMs: 250, rounds: 1 });
        pushHist(state, next);
        D = build(m, state, next, wa, { state: 'live', tick, total, every: LIVE_EVERY_MS / 1000 });

        const te = performance.now();
        await editRich(conn, m.chat, id, createDash(D), title);
        wa = performance.now() - te;

        const rest = LIVE_EVERY_MS - (Date.now() - tStart);
        if (tick < total && rest > 0) await waitFor(rest, () => stopFlag);
      }

      D.live = { state: 'done', tick: D.live.tick, total, every: LIVE_EVERY_MS / 1000 };
      await editRich(conn, m.chat, id, createDash(D), title);
      react('✅');
    } catch (e) {
      console.error('[PING live]', e?.message || e);
    } finally {
      sessions.delete(m.chat);
    }
  } catch (e) {
    console.error('[PING Error]', e);
    sessions.delete(m.chat);
    react('❌');
    m.reply(`❌ ${e.message}`);
  }
}

export { pluginConfig as config, handler };