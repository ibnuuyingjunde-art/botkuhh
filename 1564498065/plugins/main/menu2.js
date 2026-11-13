/*
 * menu2 — AIRich liquid-glass menu (page-based, SVG icons only, scrollable)
 * .menu tetap menu lama. .menu2 = UI modern.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { sharp } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import { getAiAgentStatus } from "../../src/lib/ichigo-ai-agent.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "menu2",
  alias: ["fitur", "menuhd", "statistik"],
  category: "main",
  description: "Menu liquid-glass: profil, kategori, fitur & statistik (AIRich)",
  usage: ".menu2",
  example: ".menu2",
  cooldown: 8,
  isEnabled: true,
};

const BOT_JID = "867051314767696@bot";
const CACHE_MS = 5 * 60 * 1000;
const HIDE_CATEGORIES = [];
const xpNeeded = (level) => 1000 * (level + 1);
const FOOTER = () => `By ${config.bot?.developer || config.owner?.name || "owner"}`;

const CAT_LABEL = {
  main: "Main", info: "Info", group: "Grup", sticker: "Stiker", stiker: "Stiker",
  downloader: "Downloader", download: "Downloader", game: "Game", fun: "Fun", tools: "Tools",
  saluran: "Saluran", channel: "Saluran", owner: "Owner", audio: "Audio",
  document: "Dokumen", dokumen: "Dokumen", image: "Gambar", gambar: "Gambar",
  islam: "Islam", premium: "Premium", video: "Video", ai: "AI", search: "Cari",
  anime: "Anime", music: "Musik", musik: "Musik", religi: "Religi", economy: "Ekonomi",
  rpg: "RPG", convert: "Konversi", maker: "Maker", random: "Random", text: "Teks",
  store: "Store", jpm: "JPM", panel: "Panel", user: "User", cek: "Cek",
  canvas: "Canvas", ephoto: "Ephoto", nsfw: "NSFW", stalker: "Stalker", quotes: "Quotes",
};

const CAT_TONE = {
  main: "#c4a574", ai: "#6b9e9a", group: "#7a8fa0", sticker: "#b8956c",
  downloader: "#6d8f7a", download: "#6d8f7a", game: "#a67c6d", fun: "#9a7b8a",
  tools: "#7d8a74", owner: "#c4a574", search: "#6b8a9a", anime: "#9a7a8c",
  music: "#7a8a9a", store: "#a8906c", premium: "#c4a574", rpg: "#8a7a6a", default: "#8a8a82",
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dir, "..");
const escapeHtml = (t = "") => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
let cache = { at: 0, data: null };

function readHead(file, bytes = 7000) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString("utf8", 0, n);
  } catch { return ""; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}

function parsePlugin(src, folder) {
  const open = src.search(/(?:const|let|var)\s+(?:pluginConfig|config)\s*=\s*\{/);
  if (open < 0) return null;
  const blk = src.slice(open, open + 2600);
  if (/isEnabled\s*:\s*false/.test(blk)) return null;
  const name = blk.match(/\bname\s*:\s*['"`]([^'"`]+)['"`]/)?.[1];
  if (!name) return null;
  const aliasRaw = blk.match(/\balias(?:es)?\s*:\s*\[([^\]]*)\]/)?.[1] || "";
  const alias = [...aliasRaw.matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
  const category = (blk.match(/\bcategory\s*:\s*['"`]([^'"`]+)['"`]/)?.[1] || folder).toLowerCase();
  const desc = blk.match(/\bdescription\s*:\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`)/);
  const description = (desc?.[1] ?? desc?.[2] ?? desc?.[3] ?? "").trim();
  const usage = blk.match(/\busage\s*:\s*['"`]([^'"`]+)['"`]/)?.[1] || "";
  return { name, alias, category, description, usage, folder };
}

function scanPlugins() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const byCat = new Map();
  let folders = [];
  try { folders = fs.readdirSync(PLUGIN_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && !/^[._]/.test(d.name)); } catch {}
  for (const f of folders) {
    let files = [];
    try { files = fs.readdirSync(path.join(PLUGIN_ROOT, f.name)).filter((x) => x.endsWith(".js") && !x.startsWith("_")); } catch {}
    for (const file of files) {
      const p = parsePlugin(readHead(path.join(PLUGIN_ROOT, f.name, file)), f.name);
      if (!p || HIDE_CATEGORIES.includes(p.category)) continue;
      if (!byCat.has(p.category)) byCat.set(p.category, []);
      byCat.get(p.category).push(p);
    }
  }
  const cats = [...byCat.entries()].map(([k, list]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    return {
      k,
      label: CAT_LABEL[k] || k.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      tone: CAT_TONE[k] || CAT_TONE.default,
      count: list.length,
      list,
    };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = cats.reduce((s, c) => s + c.count, 0);
  cache = { at: Date.now(), data: { cats, total } };
  return cache.data;
}

function greeting() {
  const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}
function fmtUp(sec) {
  sec = Math.floor(sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (d ? d + "d " : "") + (h || d ? h + "h " : "") + m + "m " + s + "s";
}
function numOf(j) { return String(j || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, ""); }
function userInfo(m, ctx) {
  const jid = m.sender || m.key?.participant || m.key?.remoteJid || "";
  let rec = null;
  try { rec = global.db?.users?.[jid] || null; } catch {}
  const level = Math.max(0, Number(rec?.level ?? 0) || 0);
  const xp = Math.max(0, Number(rec?.exp ?? rec?.xp ?? 0) || 0);
  const need = Math.max(1, xpNeeded(level));
  const owners = (global.owner || []).map((o) => numOf(Array.isArray(o) ? o[0] : o));
  const isOwner = ctx.isOwner ?? owners.includes(numOf(jid));
  const isPrem = ctx.isPremium ?? ctx.isPrem ?? rec?.premium ?? false;
  return { jid, name: m.pushName || rec?.name || numOf(jid) || "Pengguna", role: isOwner ? "Owner" : isPrem ? "Premium" : "Member", where: m.isGroup ? "Grup" : "Private", level, xp, need, pct: Math.min(100, Math.floor((xp / need) * 100)) };
}
async function avatarOf(conn, jid) {
  try {
    const url = await Promise.race([conn.profilePictureUrl(jid, "image"), new Promise((r) => setTimeout(() => r(""), 3500))]);
    if (!url) return "";
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return "";
    const img = await sharp(Buffer.from(await res.arrayBuffer())).resize(160, 160, { fit: "cover" }).jpeg({ quality: 70 }).toBuffer();
    return `data:image/jpeg;base64,${img.toString("base64")}`;
  } catch { return ""; }
}

const SVG = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17v-6"/><path d="M12 17V8"/><path d="M16 17v-4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16.5 16.5L21 21"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l2.4 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.6L12 3z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M6 18l2.5-2.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 6h14a2 2 0 012 2v7a2 2 0 01-2 2H9l-4 3v-3H5a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 19h14"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="7" width="20" height="11" rx="3"/><path d="M8 12h2M9 11v2"/><circle cx="15" cy="11.5" r="0.8" fill="currentColor"/><circle cx="17.5" cy="13.5" r="0.8" fill="currentColor"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18V6l12-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 4"/></svg>',
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.5 4.5a4 4 0 015 5L12 17l-4 1 1-4 7.5-9.5z"/><path d="M11 13l-6 6"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8l1.5-4h13L20 8"/><path d="M4 8v11a1 1 0 001 1h14a1 1 0 001-1V8"/><path d="M9 21v-7h6v7"/></svg>',
};

function iconForCat(k) {
  const map = {
    main: "home", ai: "spark", group: "chat", sticker: "image", stiker: "image",
    downloader: "download", download: "download", game: "game", fun: "star", tools: "tool",
    owner: "shield", search: "search", music: "music", musik: "music", image: "image",
    gambar: "image", store: "store", premium: "star", audio: "music", video: "image",
    info: "folder", user: "user",
  };
  return SVG[map[k] || "folder"] || SVG.folder;
}


function groupFeatureStatus(chatId, isGroup) {
  if (!isGroup) return [];
  let g = null;
  try { g = getDatabase()?.getGroup?.(chatId) || {}; } catch { g = {}; }
  g = g || {};
  const on = (v) => v === true || v === "on" || v === 1 || v === "1";
  const rows = [
    { key: "welcome", label: "Welcome", cmd: "welcome", active: on(g.welcome) || on(g.welcomeJoin) },
    { key: "leave", label: "Goodbye", cmd: "goodbye", active: on(g.leave) || on(g.goodbye) },
    { key: "antilink", label: "Anti Link", cmd: "antilinkgc", active: on(g.antilink) || on(g.antilinkgc) || on(g.antilinkall) },
    { key: "antibot", label: "Anti Bot", cmd: "antibot", active: on(g.antibot) },
    { key: "antispam", label: "Anti Spam", cmd: "antispam", active: on(g.antispam) },
    { key: "antitoxic", label: "Anti Toxic", cmd: "antitoxic", active: on(g.antitoxic) },
    { key: "autoai", label: "Auto AI", cmd: "autoai", active: on(g.autoai) },
    { key: "autosticker", label: "Auto Sticker", cmd: "autosticker", active: on(g.autosticker) },
    { key: "nsfw", label: "NSFW", cmd: "nsfw", active: on(g.nsfw) },
  ];
  return rows;
}

function systemStatusBlock(e, d) {
  const a = d.agent || {};
  const feats = d.groupFeats || [];
  const agentLine = a.enabled
    ? `Agent <b style="color:var(--ok)">ON</b> · ${e(a.mode || "smart")} · Nimbrung ${a.nimbrung !== false ? "ON" : "OFF"}`
    : `Agent <b style="color:#c47a6a">OFF</b> · aktifkan .aiagent on`;
  let featHtml = "";
  if (d.isGroup && feats.length) {
    const onC = feats.filter((f) => f.active).length;
    const chips = feats.map((f) => {
      const col = f.active ? "var(--ok)" : "var(--dim)";
      const mark = f.active ? "ON" : "OFF";
      return `<span class="fchip" style="--fc:${col}"><i></i>${e(f.label)} ${mark}</span>`;
    }).join("");
    featHtml = `<div class="featwrap"><div class="sec" style="margin-top:8px"><h2>Fitur grup · ${onC}/${feats.length} aktif</h2></div><div class="fchips">${chips}</div>
    <div class="hint">Admin: nyalakan yang OFF lewat perintah masing-masing (contoh .antilinkgc on)</div></div>`;
  } else if (!d.isGroup) {
    featHtml = `<div class="hint">Di private chat. Fitur proteksi grup tampil saat .menu2 dipanggil di grup.</div>`;
  }
  return `<div class="glass sys"><div class="sysrow"><span class="ico">${SVG.spark}</span><div><div class="sysh">Sistem</div><div class="sysd">${agentLine}</div></div></div>${featHtml}</div>`;
}

function createMenuHtml(d) {
  const e = escapeHtml;
  const catsJson = JSON.stringify(
    d.cats.map((c) => ({
      k: c.k, label: c.label, tone: c.tone, count: c.count,
      list: c.list.map((p) => ({
        n: p.name, a: (p.alias || []).slice(0, 3),
        d: (p.description || "").slice(0, 80), u: p.usage || "",
      })),
    })),
  ).replace(/</g, "\\u003c");

  const catTiles = d.cats.slice(0, 12).map((c, i) => {
    const ic = iconForCat(c.k);
    return `<button type="button" class="gbtn tile" data-go="cat" data-k="${e(c.k)}" style="--tone:${c.tone}"><span class="ico">${ic}</span><span class="tmeta"><span class="tl">${e(c.label)}</span><span class="tc">${c.count}</span></span></button>`;
  }).join("");

  const av = d.avatar
    ? `<img class="av" src="${d.avatar}" alt=""/>`
    : `<span class="av ph">${SVG.user}</span>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{--bg0:#0c0d10;--bg1:#14161c;--glass:rgba(255,255,255,.06);--line:rgba(255,255,255,.1);--line2:rgba(255,255,255,.16);--text:#e8e6e1;--mute:#9a968c;--dim:#6a675f;--accent:#c4a574;--accent2:#6b9e9a;--radius:18px;--safe-b:env(safe-area-inset-bottom,0px)}
html,body{height:100%;background:var(--bg0);color:var(--text);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
body{background:radial-gradient(120% 80% at 10% -10%,rgba(196,165,116,.12),transparent 50%),radial-gradient(90% 70% at 100% 0%,rgba(107,158,154,.1),transparent 45%),radial-gradient(80% 60% at 50% 100%,rgba(30,34,44,.9),var(--bg0))}
#app{display:flex;flex-direction:column;height:100%;max-width:480px;margin:0 auto;position:relative}
.scroll{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scroll-behavior:smooth;padding:14px 14px 96px;overscroll-behavior:contain}
.scroll::-webkit-scrollbar{width:3px}.scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
.glass{background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.03));border:1px solid var(--line);border-radius:var(--radius);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),inset 0 -1px 0 rgba(0,0,0,.2),0 8px 28px rgba(0,0,0,.28);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%);position:relative;overflow:hidden}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(125deg,rgba(255,255,255,.16) 0%,transparent 38%,transparent 62%,rgba(255,255,255,.04) 100%);opacity:.55}
.gbtn{appearance:none;border:1px solid var(--line);background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03));color:var(--text);border-radius:14px;padding:12px 14px;cursor:pointer;font:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 4px 14px rgba(0,0,0,.2);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,border-color .18s,background .18s;position:relative;overflow:hidden;touch-action:manipulation;user-select:none}
.gbtn::after{content:"";position:absolute;top:-40%;left:-30%;width:40%;height:180%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:translateX(-120%) rotate(18deg);transition:transform .55s ease;pointer-events:none}
.gbtn:active,.gbtn.press{transform:scale(.96);border-color:var(--line2);box-shadow:inset 0 2px 8px rgba(0,0,0,.35),0 1px 2px rgba(0,0,0,.2);background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02))}
.gbtn:active::after,.gbtn.press::after{transform:translateX(280%) rotate(18deg)}
.gbtn .ico,.ico{display:inline-flex;width:20px;height:20px;color:var(--accent);flex-shrink:0}
.gbtn .ico svg,.ico svg{width:100%;height:100%}
.top{padding:12px 14px 0;flex-shrink:0}
.brand{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.brand h1{font-size:15px;font-weight:650;letter-spacing:.02em}
.brand .sub{font-size:11px;color:var(--mute)}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:11px;color:var(--mute);background:rgba(255,255,255,.05);border:1px solid var(--line)}
.chip .ico{width:14px;height:14px;color:var(--accent2)}
.prof{display:flex;gap:12px;align-items:center;padding:14px;margin-bottom:12px}
.av{width:54px;height:54px;border-radius:16px;object-fit:cover;border:1px solid var(--line2);flex-shrink:0;background:#1a1d26}
.av.ph{display:grid;place-items:center;color:var(--mute)}.av.ph svg{width:26px;height:26px}
.pinfo{flex:1;min-width:0}.pinfo .nm{font-weight:650;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pinfo .rl{font-size:11px;color:var(--mute);margin-top:2px}
.bar{height:5px;border-radius:99px;background:rgba(255,255,255,.06);margin-top:8px;overflow:hidden}
.bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--accent),var(--accent2))}
.xp{font-size:10px;color:var(--dim);margin-top:4px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.stat{padding:12px 10px;text-align:center}.stat b{display:block;font-size:16px;font-weight:700}.stat span{font-size:10px;color:var(--mute);letter-spacing:.04em;text-transform:uppercase}
.sec{display:flex;align-items:center;justify-content:space-between;margin:6px 2px 10px}
.sec h2{font-size:12px;font-weight:650;color:var(--mute);letter-spacing:.08em;text-transform:uppercase}
.sec a{font-size:11px;color:var(--accent);cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.tile{display:flex;align-items:center;gap:10px;text-align:left;min-height:58px}
.tile .ico{width:28px;height:28px;padding:5px;border-radius:10px;background:color-mix(in srgb,var(--tone,var(--accent)) 22%,transparent);color:var(--tone,var(--accent))}
.tile .tmeta{display:flex;flex-direction:column;gap:2px;min-width:0}
.tile .tl{font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .tc{font-size:10px;color:var(--mute)}
.cmd{display:flex;align-items:flex-start;gap:10px;padding:12px;margin-bottom:8px;text-align:left;width:100%}
.cmd .cn{font-weight:650;font-size:13px;color:var(--accent)}
.cmd .cd{font-size:11px;color:var(--mute);margin-top:3px;line-height:1.35}
.cmd .ca{font-size:10px;color:var(--dim);margin-top:4px}
.cmd .icopy{margin-left:auto;width:18px;height:18px;color:var(--dim);flex-shrink:0}
.search{display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:12px}
.search input{flex:1;background:transparent;border:0;outline:0;color:var(--text);font:inherit;min-width:0}
.search input::placeholder{color:var(--dim)}.search .ico{color:var(--mute);width:18px;height:18px}
.page{display:none}.page.on{display:block}
.headbar{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.headbar h2{font-size:15px;font-weight:650}.headbar .gbtn{padding:8px;border-radius:12px}.headbar .gbtn .ico{width:18px;height:18px}
.nav{position:absolute;left:12px;right:12px;bottom:calc(10px + var(--safe-b));display:flex;gap:4px;padding:6px;border-radius:20px;z-index:20}
.nav .gbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:14px;font-size:9px;color:var(--mute);letter-spacing:.02em}
.nav .gbtn .ico{width:18px;height:18px;color:var(--mute)}
.nav .gbtn.on{color:var(--text);border-color:rgba(196,165,116,.35);background:linear-gradient(160deg,rgba(196,165,116,.18),rgba(255,255,255,.04))}
.nav .gbtn.on .ico{color:var(--accent)}
.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(12px);background:rgba(20,22,28,.92);border:1px solid var(--line2);color:var(--text);padding:8px 14px;border-radius:12px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:50;backdrop-filter:blur(12px)}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.empty{text-align:center;padding:28px 12px;color:var(--mute);font-size:13px}

.sys{padding:12px;margin-bottom:12px}
.sysrow{display:flex;gap:10px;align-items:center}
.sysh{font-weight:650;font-size:13px}
.sysd{font-size:11px;color:var(--mute);margin-top:2px}
.fchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.fchip{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;font-size:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--mute)}
.fchip i{width:6px;height:6px;border-radius:50%;background:var(--fc,var(--dim));display:inline-block}
.hint{font-size:10px;color:var(--dim);margin-top:8px;line-height:1.4}
.foot{text-align:center;font-size:10px;color:var(--dim);padding:16px 8px 8px}
</style></head><body>
<div id="app">
  <div class="top"><div class="brand"><div><h1>${e(d.botName || "lyniX's MD")}</h1><div class="sub">${e(d.greeting)} · ${e(d.name)}</div></div>
  <div class="chip"><span class="ico">${SVG.clock}</span><span id="clk">${e(d.clock)}</span></div></div></div>
  <div class="scroll" id="sc">
    <div class="page on" id="p-home">
      ${systemStatusBlock(e, d)}
      <div class="glass prof">${av}<div class="pinfo"><div class="nm">${e(d.name)}</div><div class="rl">${e(d.role)} · ${e(d.where)} · Lv ${d.level}</div>
      <div class="bar"><i style="width:${d.pct}%"></i></div><div class="xp">${d.xp} / ${d.need} XP</div></div></div>
      <div class="stats"><div class="glass stat"><b>${d.total}</b><span>Fitur</span></div><div class="glass stat"><b>${d.cats.length}</b><span>Kategori</span></div><div class="glass stat"><b id="up" data-s="${d.upSec}">${e(d.up)}</b><span>Uptime</span></div></div>
      <div class="sec"><h2>Kategori</h2><a data-go="cats">Lihat semua</a></div>
      <div class="grid">${catTiles}</div>
      <div class="foot">${e(d.footer)}</div>
    </div>
    <div class="page" id="p-cats"><div class="headbar"><button type="button" class="gbtn" data-go="home"><span class="ico">${SVG.back}</span></button><h2>Semua kategori</h2></div><div class="grid" id="allCats"></div></div>
    <div class="page" id="p-cat"><div class="headbar"><button type="button" class="gbtn" data-go="cats"><span class="ico">${SVG.back}</span></button><h2 id="catTitle">Kategori</h2></div><div id="catList"></div></div>
    <div class="page" id="p-search"><div class="glass search"><span class="ico">${SVG.search}</span><input id="q" type="search" placeholder="Cari perintah..." autocomplete="off"/></div><div id="searchList"></div></div>
    <div class="page" id="p-stats"><div class="headbar"><button type="button" class="gbtn" data-go="home"><span class="ico">${SVG.back}</span></button><h2>Statistik</h2></div>
      <div class="stats"><div class="glass stat"><b>${d.total}</b><span>Total</span></div><div class="glass stat"><b>${d.cats.length}</b><span>Kategori</span></div><div class="glass stat"><b>${d.level}</b><span>Level</span></div></div>
      <div id="statBars"></div><div class="foot">Prefix <b>${e(d.prefix || ".")}</b> · data dari plugins bot</div></div>
  </div>
  <nav class="glass nav" id="nav">
    <button type="button" class="gbtn on" data-go="home"><span class="ico">${SVG.home}</span>Home</button>
    <button type="button" class="gbtn" data-go="cats"><span class="ico">${SVG.grid}</span>Menu</button>
    <button type="button" class="gbtn" data-go="search"><span class="ico">${SVG.search}</span>Cari</button>
    <button type="button" class="gbtn" data-go="stats"><span class="ico">${SVG.chart}</span>Stats</button>
  </nav>
  <div class="toast" id="toast"></div>
</div>
<script>
(function(){
  var CATS = ${catsJson};
  var PREFIX = ${JSON.stringify(d.prefix || ".")};
  var COPY_SVG = ${JSON.stringify(SVG.copy)};
  var FOLDER_SVG = ${JSON.stringify(SVG.folder)};
  function $(id){ return document.getElementById(id); }
  function toast(t){ var el=$('toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){ el.classList.remove('on'); },1600); }
  document.addEventListener('pointerdown', function(ev){ var b=ev.target.closest('.gbtn'); if(b) b.classList.add('press'); });
  document.addEventListener('pointerup', function(){ document.querySelectorAll('.gbtn.press').forEach(function(b){ b.classList.remove('press'); }); });
  document.addEventListener('pointercancel', function(){ document.querySelectorAll('.gbtn.press').forEach(function(b){ b.classList.remove('press'); }); });
  function showPage(id){
    document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('on'); });
    var el=document.getElementById('p-'+id); if(el) el.classList.add('on');
    document.querySelectorAll('#nav .gbtn').forEach(function(b){
      var g=b.getAttribute('data-go');
      b.classList.toggle('on', g===id || (id==='cat' && g==='cats'));
    });
    $('sc').scrollTop=0;
  }
  function catByK(k){ for(var i=0;i<CATS.length;i++) if(CATS[i].k===k) return CATS[i]; return null; }
  function cmdBtn(p){
    var cmd=PREFIX+p.n;
    var al=(p.a||[]).map(function(x){ return PREFIX+x; }).join(' · ');
    var b=document.createElement('button'); b.type='button'; b.className='gbtn cmd glass';
    b.innerHTML='<div><div class="cn">'+cmd+'</div>'+(p.d?'<div class="cd">'+p.d+'</div>':'')+(al?'<div class="ca">'+al+'</div>':'')+'</div><span class="icopy">'+COPY_SVG+'</span>';
    b.addEventListener('click', function(){
      try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(cmd).then(function(){ toast('Disalin: '+cmd); }, function(){ toast(cmd); }); } else toast(cmd); } catch(e){ toast(cmd); }
    });
    return b;
  }
  function renderAllCats(){
    var box=$('allCats'); box.innerHTML='';
    CATS.forEach(function(c){
      var b=document.createElement('button'); b.type='button'; b.className='gbtn tile';
      b.style.setProperty('--tone', c.tone); b.setAttribute('data-go','cat'); b.setAttribute('data-k', c.k);
      b.innerHTML='<span class="ico" style="color:'+c.tone+'">'+FOLDER_SVG+'</span><span class="tmeta"><span class="tl"></span><span class="tc"></span></span>';
      b.querySelector('.tl').textContent=c.label; b.querySelector('.tc').textContent=c.count+' fitur';
      box.appendChild(b);
    });
  }
  function openCat(k){
    var c=catByK(k); if(!c) return;
    $('catTitle').textContent=c.label;
    var box=$('catList'); box.innerHTML='';
    if(!c.list.length) box.innerHTML='<div class="empty">Tidak ada fitur</div>';
    else c.list.forEach(function(p){ box.appendChild(cmdBtn(p)); });
    showPage('cat');
  }
  function renderStats(){
    var box=$('statBars'); box.innerHTML='';
    var max=Math.max.apply(null, CATS.map(function(c){ return c.count; }).concat([1]));
    CATS.slice(0,14).forEach(function(c){
      var row=document.createElement('div'); row.className='glass'; row.style.cssText='padding:10px 12px;margin-bottom:8px';
      var pct=Math.round(c.count/max*100);
      row.innerHTML='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>'+c.label+'</span><span style="color:var(--mute)">'+c.count+'</span></div><div class="bar"><i style="width:'+pct+'%;background:'+c.tone+'"></i></div>';
      box.appendChild(row);
    });
  }
  function doSearch(q){
    q=(q||'').toLowerCase().trim();
    var box=$('searchList'); box.innerHTML='';
    if(!q){ box.innerHTML='<div class="empty">Ketik nama perintah atau kategori</div>'; return; }
    var hits=[];
    CATS.forEach(function(c){ c.list.forEach(function(p){ var hay=(p.n+' '+(p.a||[]).join(' ')+' '+(p.d||'')+' '+c.label).toLowerCase(); if(hay.indexOf(q)>=0) hits.push(p); }); });
    if(!hits.length) box.innerHTML='<div class="empty">Tidak ditemukan</div>';
    else hits.slice(0,60).forEach(function(p){ box.appendChild(cmdBtn(p)); });
  }
  document.addEventListener('click', function(ev){
    var go=ev.target.closest('[data-go]'); if(!go) return;
    var page=go.getAttribute('data-go'), k=go.getAttribute('data-k');
    if(page==='cat'&&k) openCat(k);
    else if(page==='cats'){ renderAllCats(); showPage('cats'); }
    else if(page==='stats'){ renderStats(); showPage('stats'); }
    else if(page==='search'){ showPage('search'); $('q').focus(); }
    else if(page==='home') showPage('home');
  });
  $('q').addEventListener('input', function(){ doSearch(this.value); });
  var t0=Date.now(), base=parseInt(($('up')||{}).getAttribute&&$('up').getAttribute('data-s')||'0',10)||0;
  function tick(){
    var s=base+Math.floor((Date.now()-t0)/1000);
    var d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60);
    if($('up')) $('up').textContent=(d?d+'d ':'')+(h||d?h+'h ':'')+m+'m '+(s%60)+'s';
    try{ if($('clk')) $('clk').textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Jakarta'}).format(new Date()); }catch(e){}
  }
  tick(); setInterval(tick,1000);
})();
</script></body></html>`;
}

function richSection(html) {
  return {
    view_model: {
      __typename: "GenAISingleLayoutViewModel",
      primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", trusted_sources: [], payload: html },
    },
  };
}

async function relayRich(conn, jid, html, title) {
  const messageId = randomUUID();
  const unifiedData = JSON.stringify({ response_id: messageId, sections: [richSection(html)] });
  const content = {
    messageContextInfo: {
      deviceListMetadata: {}, deviceListMetadataVersion: 2,
      botMetadata: { messageDisclaimerText: "", botResponseId: messageId },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: title }],
          unifiedResponse: { data: Buffer.from(unifiedData).toString("base64") },
          contextInfo: {
            forwardingScore: 1, isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: BOT_JID }, forwardOrigin: 4,
          },
        },
      },
    },
  };
  await conn.relayMessage(jid, content, { messageId });
  await conn.relayMessage(jid, {
    protocolMessage: {
      key: { remoteJid: jid, fromMe: true, id: messageId },
      type: 14, editedMessage: content, timestampMs: Date.now(),
    },
  }, { additionalAttributes: { edit: "1" } });
}

function openPlaceholder(conn, m) {
  return Promise.resolve()
    .then(() => conn.sendAIRich(m.chat, (r) => r.addText("Menyiapkan menu…"), { quoted: m, bypassDownload: true }))
    .then((sent) => (sent?.key?.id ? sent : null))
    .catch(() => null);
}

async function dropPlaceholder(conn, m, sent) {
  if (sent?.key) await conn.sendMessage(m.chat, { delete: sent.key }).catch(() => {});
}

async function deliver(conn, m, html, title, sent) {
  if (sent?.key?.id) {
    try {
      const rich = new conn.builders.AIRich(conn);
      rich.setTitle(title);
      rich.addSection(richSection(html));
      await rich.sendEdit(m.chat, sent.key.id);
      return;
    } catch (e) {
      console.error("[MENU2] edit placeholder gagal:", e?.message || e);
      await dropPlaceholder(conn, m, sent);
    }
  }
  try {
    await conn.sendAIRich(m.chat, (r) => { r.setTitle(title); r.addSection(richSection(html)); }, { quoted: m });
  } catch (e) {
    console.error("[MENU2] sendAIRich gagal, relay:", e?.message || e);
    await relayRich(conn, m.chat, html, title);
  }
}

async function handler(m, ctx = {}) {
  const conn = ctx.sock || m.conn;
  const react = (em) => Promise.resolve().then(() => m.react(em)).catch(() => {});
  react("⚙️");
  const pending = openPlaceholder(conn, m);
  try {
    const u = userInfo(m, ctx);
    const [avatar, data] = await Promise.all([
      avatarOf(conn, u.jid),
      Promise.resolve().then(scanPlugins),
    ]);
    const upSec = process.uptime();
    let agentSt = {};
    try { agentSt = getAiAgentStatus() || {}; } catch {}
    const groupFeats = groupFeatureStatus(m.chat, !!m.isGroup);
    const html = createMenuHtml({
      ...u, avatar, cats: data.cats, total: data.total,
      prefix: ctx.prefix || m.prefix || config.command?.prefix || ".",
      greeting: greeting(),
      botName: config.bot?.name || "lyniX's MD",
      up: fmtUp(upSec), upSec: Math.floor(upSec),
      clock: new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta",
      }).format(new Date()),
      footer: FOOTER(),
      agent: agentSt,
      groupFeats,
      isGroup: !!m.isGroup,
    });
    await deliver(conn, m, html, `Menu · ${data.total} fitur`, await pending);
    await react("✅");
  } catch (e) {
    console.error("[MENU2 Error]", e);
    await dropPlaceholder(conn, m, await pending);
    await react("❌");
    m.reply(`Gagal memuat menu: ${e.message}`);
  }
}

export { pluginConfig as config, handler };
