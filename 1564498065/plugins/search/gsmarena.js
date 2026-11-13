import axios from 'axios';
import crypto from 'crypto';
import te from '../../src/lib/ichigo-error.js';

const TIMEOUT = Math.max(5000, parseInt(process.env.GS_TIMEOUT_MS, 10) || 25000);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const GS_BASE = (process.env.GSMA_BASE || 'https://www.gsmarena.com').replace(/\/+$/, '');
const GS_SITEKEY = process.env.GSMA_SITEKEY || '0x4AAAAAACOgUCNk2xmYkcq8';
const GENCPTA_URL = process.env.GENCPTA_URL || 'https://gateway.gencipta.com/api/tools/bypass-cf';
const GENCPTA_KEY = process.env.GENCPTA_KEY || 'gencipta_live_0ZvAhmD_7z_GolCB-Icyizvz-pYt3CGl';

const pluginConfig = {
    name: 'gsmarena',
    alias: ['gsm', 'phonespec', 'spesifikasi'],
    category: 'search',
    description: 'Cari spesifikasi HP lengkap di GSMArena (scraper langsung, tanpa API)',
    usage: '.gsmarena <nama hp>',
    example: '.gsmarena infinix hot 50',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true,
};

// ======================= BANTU: ENTITAS & STRIP =======================

/** Decode entity HTML umum + numerik (nama device sering ada &amp;/&Prime;). */
export function decodeEntities(s) {
    return String(s || '')
        .replace(/&Prime;/g, '″')
        .replace(/&deg;/g, '°')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Buang tag HTML + entity + collapse spasi (nilai spec itu satu baris). */
export function strip(s) {
    return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// ======================= DEKRIP HASIL SEARCH =======================

/**
 * Halaman search GSMArena nyimpen hasil di JS var KEY/IV/DATA (AES-CBC,
 * didekrip browser lewat decrypt.js). Plugin niru: node:crypto.
 * Return HTML hasil (string) atau null kalau gak ada blob terenkripsi.
 */
export function decryptResults(html) {
    if (!html || typeof html !== 'string') return null;
    const kb = html.match(/const KEY\s*=\s*"([^"]+)"/);
    const ib = html.match(/const IV\s*=\s*"([^"]+)"/);
    const db = html.match(/const DATA\s*=\s*"([^"]+)"/);
    if (!kb || !ib || !db) return null;
    try {
        const key = Buffer.from(kb[1], 'base64');
        const iv = Buffer.from(ib[1], 'base64');
        const data = Buffer.from(db[1], 'base64');
        const algo = 'aes-' + key.length * 8 + '-cbc'; // 16 byte -> aes-128
        const d = crypto.createDecipheriv(algo, key, iv);
        return Buffer.concat([d.update(data), d.final()]).toString('utf8');
    } catch (e) {
        console.error('[GsmArena decrypt]', e?.message || e);
        return null;
    }
}

// ======================= TURNSTILE (CLEARANCE) =======================

// Cookie jar ala browser: satu cookie ts_ok per domain, di-cache per
// PATHNAME (bukan query — eksperimen t162: clear res.php3 dgn query A
// ikut nge-buka query B; detail/homepage tetap minta clear sendiri).
// lastTsOk = nilai paling baru yang pernah keliatan — fallback buat path
// yang belum pernah dicache (mirip browser yang bawa jar ke path baru).
const tsCache = new Map(); // pathname -> nilai cookie ts_ok
const TS_CACHE_MAX = 300;
let lastTsOk = null;

function cacheSet(key, val) {
    lastTsOk = val;
    tsCache.set(key, val);
    if (tsCache.size > TS_CACHE_MAX) {
        const oldest = tsCache.keys().next().value;
        tsCache.delete(oldest);
    }
}
function cookieFor(pathKey) {
    return tsCache.get(pathKey.split('?')[0]) || lastTsOk || null;
}

const CHAL_RE = /turnstile-verify\.php3|GSMArena Turnstile check/i;

/**
 * Solve Turnstile GSMArena via gencipta. Return token atau null.
 */
async function solveTurnstile(pathKey) {
    try {
        const r = await axios.post(
            GENCPTA_URL,
            { url: GS_BASE + pathKey, sitekey: GS_SITEKEY },
            {
                headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Authorization: 'Bearer ' + GENCPTA_KEY },
                timeout: Math.max(TIMEOUT, 60000),
                validateStatus: () => true,
            },
        );
        const j = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        if (r.status === 200 && j?.status && j?.token) return j.token;
        console.error('[GsmArena solver]', j?.error || j?.message || 'HTTP ' + r.status);
        return null;
    } catch (e) {
        console.error('[GsmArena solver]', e?.message || e);
        return null;
    }
}

/** Ambil nilai cookie ts_ok dari array set-cookie axios. */
function takeTsOk(res) {
    const arr = res?.headers?.['set-cookie'] || [];
    for (const c of arr) {
        const m = String(c).match(/(?:^|;\s*)ts_ok=([^;]+)/);
        if (m) return m[1].trim();
    }
    return null;
}

/**
 * POST form turnstile-verify.php3 (host + return + token) -> cookie ts_ok
 * dicache utk pathKey. Return true kalau cookie dapet.
 */
async function clearPath(pathKey) {
    const token = await solveTurnstile(pathKey);
    if (!token) return false;
    try {
        const form = new URLSearchParams({
            host: new URL(GS_BASE).hostname,
            return: pathKey,
            'cf-turnstile-response': token,
        }).toString();
        const r = await axios.post(GS_BASE + '/turnstile-verify.php3', form, {
            headers: {
                'User-Agent': UA,
                'Content-Type': 'application/x-www-form-urlencoded',
                Origin: GS_BASE,
                Referer: GS_BASE + pathKey,
            },
            timeout: Math.max(TIMEOUT, 30000),
            maxRedirects: 0,
            validateStatus: () => true,
        });
        const ck = takeTsOk(r);
        if (ck) {
            cacheSet(pathKey.split('?')[0], ck);
            return true;
        }
        console.error('[GsmArena verify] gak ada cookie ts_ok (HTTP ' + r.status + ')');
        return false;
    } catch (e) {
        console.error('[GsmArena verify]', e?.message || e);
        return false;
    }
}

/**
 * GET halaman gsmarena dengan auto-clearance:
 *   coba cookie cache -> kalau challenge: solve+verify (maks 2x) -> retry.
 * Ikut redirect 301/302 manual (slug koreksi diri, mis. ID salah -> slug
 * bener) — path tujuan baru di-clear sendiri kalau perlu.
 * Return { html, pathKey }. Throw { code:'solver'|'challenge' }.
 */
async function gsGet(pathKey, depth = 0) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const ck = cookieFor(pathKey);
        let res;
        try {
            res = await axios.get(GS_BASE + pathKey, {
                headers: { 'User-Agent': UA, Cookie: ck ? 'ts_ok=' + ck : '', Referer: GS_BASE + '/' },
                timeout: TIMEOUT,
                maxRedirects: 0,
                validateStatus: () => true,
            });
        } catch (e) {
            throw { code: 'network', detail: e?.message || 'network' };
        }
        const fresh = takeTsOk(res);
        if (fresh) cacheSet(pathKey.split('?')[0], fresh);
        // redirect (koreksi slug dll) — ikuti manual, bawa cookie terbaru
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers?.location;
            if (!loc || depth >= 3) throw { code: 'challenge', detail: 'redirect ' + res.status };
            const next = new URL(loc, GS_BASE + pathKey);
            const nextKey = next.pathname + next.search;
            if (fresh) cacheSet(next.pathname, fresh); // optimis, kalau ditolak nanti di-clear sendiri
            return gsGet(nextKey, depth + 1);
        }
        const html = typeof res.data === 'string' ? res.data : String(res.data || '');
        if (res.status === 200 && !CHAL_RE.test(html)) return { html, pathKey };
        // challenge (atau status aneh) -> clear clearance lalu retry;
        // solve CUMA di antara attempt (maks 2x per halaman — hemat apikey)
        if (attempt === 2) break;
        if (!(await clearPath(pathKey))) throw { code: 'solver' };
    }
    throw { code: 'challenge', detail: 'masih challenge setelah 2x solve' };
}

// ======================= PARSER SEARCH =======================

/**
 * Parse halaman hasil search (dekrip dulu kalau perlu).
 * Return { devices: [{id, name, description}], noResults: bool }.
 */
export function parseSearch(html) {
    const dec = decryptResults(html) || html || '';
    const noResults = /found no results|we'?re sorry/i.test(dec) && !/class="makers"/.test(dec);
    const devices = [];
    // area list device = <div class="makers"> ... </ul> (biar gak ketelen
    // item news/review yang juga <li><a>)
    const mk = dec.match(/<div class="makers">([\s\S]*?)<\/ul>/i);
    const seg = mk ? mk[1] : '';
    const liRe = /<li><a href="([^"]+?\.php)"[^>]*>([\s\S]*?)<\/a><\/li>/g;
    let lm;
    while ((lm = liRe.exec(seg)) !== null) {
        const id = lm[1].replace(/\.php$/i, '');
        const inner = lm[2];
        const tm = inner.match(/<strong><span>([\s\S]*?)<\/span><\/strong>/i);
        const dm = inner.match(/<img[^>]*title="([^"]*)"/i);
        const name = strip(String(tm ? tm[1] : '').replace(/<br\s*\/?>/gi, ' '));
        if (!id || !name) continue;
        devices.push({ id, name, description: dm ? decodeEntities(dm[1]).replace(/\s+/g, ' ').trim() : '' });
    }
    return { devices, noResults: noResults && devices.length === 0 };
}

// ======================= PARSER DETAIL =======================

// Label Indonesia buat quick spec (data-spec *-hl di header page).
// Kunci asli halaman: released/body/os/chipset/storage/displaysize/
// displayres/camerapixels/videopixels/ramsize/batsize/battype.
const HL_LABEL = {
    'released-hl': 'Luncur',
    'body-hl': 'Badan',
    'os-hl': 'OS',
    'chipset-hl': 'Chipset',
    'storage-hl': 'Memori',
    'displaysize-hl': 'Layar',
    'camerapixels-hl': 'Kamera',
    'videopixels-hl': 'Video',
    'ramsize-hl': 'RAM',
    'batsize-hl': 'Baterai',
    'battype-hl': 'Charging',
    'charge-hl': 'Charging',
};
const hlLabel = (k) => HL_LABEL[k] || k.replace(/-hl$/, '').replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * Parse halaman detail device.
 * Return { name, imageUrl, quickSpec: [{name, value}],
 *          detailSpec: [{category, specifications: [{name, value}]}] }.
 */
export function parseDetail(html) {
    const out = { name: '', imageUrl: null, quickSpec: [], detailSpec: [] };
    if (!html || typeof html !== 'string') return out;

    // nama: h1.specs-phone-name-title; fallback <title> ("X - Full phone specifications")
    const nm = html.match(/specs-phone-name-title[^>]*>([\s\S]*?)<\/h1>/i);
    if (nm) out.name = strip(nm[1]);
    if (!out.name) {
        const t = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (t) out.name = strip(t[1].replace(/\s*-\s*Full phone specifications.*$/i, ''));
    }

    // foto utama (img bigpic di block specs-photo-main; src kadang tanpa kutip)
    const im = html.match(/class="specs-photo-main"[\s\S]{0,600}?<img[^>]*src=(?:"([^"]+)"|([^\s>]+))/i);
    if (im) {
        const src = (im[1] || im[2] || '').trim();
        if (/^https?:\/\//i.test(src)) out.imageUrl = src.replace(/&amp;/g, '&');
    }

    // quick specs: semua data-spec="*-hl" sesuai urutan DOM. Satuan (MP / mAh /
    // GB RAM / MB RAM) BUKAN bagian nilai — itu <span> terpisah tepat
    // setelah span nilai (contoh asli: <span data-spec="ramsize-hl">16</span>
    // <span>MB RAM</span> di Nokia 3310) — jadi digabung dari page, jangan
    // di-hardcode (HP jadul pakai MB, bukan GB!).
    const hlRe = /data-spec="([a-z0-9-]+-hl)"[^>]*>([\s\S]*?)<\/(?:span|div)>\s*(?:<span[^>]*>([\s\S]*?)<\/span>)?/g;
    const hl = [];
    let hm;
    while ((hm = hlRe.exec(html)) !== null) {
        const v = strip(hm[2]);
        if (!v) continue; // (battype kosong di beberapa page)
        const unit = hm[3] ? strip(hm[3]) : '';
        hl.push([hm[1], v, unit]);
    }
    const val = (k) => { const f = hl.find(([x]) => x === k); return f ? f[1] : ''; };
    for (const [k, v, unit] of hl) {
        if (k === 'displayres-hl') continue; // udah digabung ke Layar
        if (k === 'displaysize-hl') {
            const res = val('displayres-hl');
            out.quickSpec.push({ name: hlLabel(k), value: res ? v + ' ' + res : v });
            continue;
        }
        const value = unit && !v.toLowerCase().includes(unit.toLowerCase()) ? v + ' ' + unit : v;
        out.quickSpec.push({ name: hlLabel(k), value });
    }

    // spesifikasi lengkap: tabel per kategori di #specs-list
    const li = html.search(/id="specs-list"/i);
    if (li < 0) return out;
    const seg = html.slice(li, li + 150000).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
    const tbRe = /<table[^>]*>([\s\S]*?)<\/table>/g;
    let tb;
    while ((tb = tbRe.exec(seg)) !== null) {
        const table = tb[1];
        const cm = table.match(/<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/i);
        const category = strip(cm ? cm[1] : '');
        if (!category) continue;
        const specifications = [];
        // baris: <tr>(opsional <th kategori>)<td class="ttl">NAMA</td><td class="nfo">NILAI</td></tr>
        const rowRe = /<tr[^>]*>(?:\s*<th[\s\S]*?<\/th>)?\s*<td class="ttl">([\s\S]*?)<\/td>\s*<td class="nfo"[^>]*>([\s\S]*?)<\/td>/g;
        let rm;
        while ((rm = rowRe.exec(table)) !== null) {
            const name = strip(rm[1]);
            const value = strip(rm[2]);
            if (!value || value === '-') continue;
            specifications.push({ name, value });
        }
        if (specifications.length) out.detailSpec.push({ category, specifications });
    }
    return out;
}

// ======================= FORMAT PESAN =======================

function formatList(results, query, prefix) {
    let txt = `📱 *ʜᴀsɪʟ ᴘᴇɴᴄᴀʀɪᴀɴ*\n`;
    txt += `> *${query}*\n\n`;

    results.slice(0, 10).forEach((d, i) => {
        txt += `${i + 1}. 📱 *${d.name}*\n`;
        if (d.description) {
            const desc = d.description.length > 80 ? d.description.slice(0, 80) + '...' : d.description;
            txt += `> ${desc}\n`;
        }
    });

    txt += `\n> Ketik \`${prefix}gsmarena <nama lengkap>\` untuk detail`;
    return txt;
}

/**
 * formatDetail — teks detail lengkap.
 * withImageLink=true (default): baris "🖼️ Gambar: <url>" dimasukin —
 * dipakai saat foto GAGAL dikirim (fallback teks). Saat foto sukses
 * dikirim, teks kedua gak perlu link lagi (withImageLink=false).
 */
function formatDetail(device, withImageLink = true) {
    let txt = `📱 *${device.name}*\n\n`;

    if (withImageLink && device.imageUrl) {
        txt += `🖼️ Gambar: ${device.imageUrl}\n\n`;
    }

    if (device.quickSpec && device.quickSpec.length > 0) {
        txt += `📋 *ʀɪɴɢᴋᴀsᴀɴ:*\n`;
        for (const s of device.quickSpec) {
            txt += `> 🔹 *${s.name}:* ${s.value}\n`;
        }
        txt += '\n';
    }

    if (device.detailSpec && device.detailSpec.length > 0) {
        for (const cat of device.detailSpec.slice(0, 8)) {
            txt += `📌 *${cat.category}:*\n`;
            for (const s of cat.specifications.slice(0, 5)) {
                txt += `> • ${s.name ? `*${s.name}:* ` : ''}${s.value}\n`;
            }
            txt += '\n';
        }
    }
    return txt.trimEnd();
}

/**
 * Caption buat FOTO device (image message). WhatsApp max caption ±1024
 * char — kita jaga di bawah 1000. Isi: nama + ringkasan spek; detail
 * lengkap nyusul sebagai pesan teks terpisah biar gak ada info kepotong.
 */
function buildPhotoCaption(device) {
    let txt = `📱 *${device.name}*\n`;
    if (device.quickSpec && device.quickSpec.length > 0) {
        txt += `\n📋 *ʀɪɴɢᴋᴀsᴀɴ:*\n`;
        for (const s of device.quickSpec) {
            txt += `> 🔹 *${s.name}:* ${s.value}\n`;
        }
    }
    txt += `\n> Detail lengkap di pesan berikutnya ⬇️`;
    if (txt.length > 1000) txt = txt.slice(0, 997) + '...';
    return txt;
}

/**
 * Download foto device (CDN fdn2.gsmarena.com, gak butuh cookie clearance).
 * Return { buffer, contentType } atau null kalau gagal — JANGAN pernah
 * bikin command jebol cuma gara-gara foto mati; caller sudah punya fallback.
 */
async function fetchPhoto(url) {
    try {
        const r = await axios.get(url, {
            headers: { 'User-Agent': UA, Referer: GS_BASE + '/' },
            timeout: TIMEOUT,
            responseType: 'arraybuffer',
            validateStatus: () => true,
        });
        const buf = r.status === 200 && r.data ? Buffer.from(r.data) : null;
        // <1KB = pasti bukan foto device asli (error page/kosong)
        if (buf && buf.length > 1024) return { buffer: buf, contentType: String(r.headers?.['content-type'] || '') };
        console.error('[GsmArena foto] HTTP ' + r.status + ' / ' + (buf ? buf.length : 0) + ' byte, skip foto');
        return null;
    } catch (e) {
        console.error('[GsmArena foto]', e?.message || e);
        return null;
    }
}

function buildHelp(p = '.') {
    return (
        `📱 *ɢsᴍᴀʀᴇɴᴀ*\n\n` +
        `> Cari spesifikasi HP lengkap\n\n` +
        `\`Contoh: ${p}gsmarena samsung galaxy s25\`\n\n` +
        `> Hasil lebih dari 1? Ketik nama yang lebih\n` +
        `> spesifik biar detail-nya langsung muncul.\n` +
        `> Device baru pertama kali dibuka ±5-10 dtk\n` +
        `> (bypass proteksi GSMArena), setelahnya instan.`
    );
}

// ======================= JALUR UTAMA =======================

async function searchDevices(query) {
    const pathKey = '/res.php3?sSearch=' + encodeURIComponent(query);
    const { html } = await gsGet(pathKey);
    return parseSearch(html);
}

async function detailDevice(id) {
    const clean = String(id || '').replace(/^\/+/, '').replace(/\.php$/i, '');
    const { html } = await gsGet('/' + clean + '.php');
    // halaman detail kadang juga dibungkus enkripsi — dekrip dulu kalau ada
    const dec = decryptResults(html) || html;
    const device = parseDetail(dec);
    if (!device.name) throw { code: 'parse', detail: 'nama device gak keparse' };
    return device;
}

async function handler(m, ctx = {}) {
    const sock = ctx?.sock || null;
    // POLA PRODUCTION (ATURAN #9): m.text = ARGUMEN SAJA
    const args = String(m.text || (Array.isArray(m.args) ? m.args.join(' ') : '') || '').trim();

    if (!args || /^(help|-h|--help|cara)$/i.test(args)) {
        return m.reply(buildHelp(m.prefix || '.'));
    }

    m.react('🕕');

    try {
        const { devices, noResults } = await searchDevices(args);

        if (!devices.length) {
            m.react('❌');
            if (noResults) {
                return m.reply(`📱 HP tidak ditemukan untuk *${args}*\n\n> Cek ejaan atau pake nama modelnya aja,\n> contoh: \`${m.prefix || '.'}gsmarena galaxy a15\``);
            }
            throw { code: 'parse', detail: 'list hasil gak keparse (web mungkin berubah)' };
        }

        if (devices.length === 1) {
            const device = await detailDevice(devices[0].id);
            m.react('✅');

            // v2.1: kirim FOTO device sekalian (kayak versi lama), caption
            // nama + ringkasan; teks detail lengkap nyusun sebagai pesan
            // kedua (caption WA max ±1024 char, detail bisa 2600+).
            // Gagal di manapun -> fallback teks lengkap dgn link gambar.
            if (device.imageUrl && sock && typeof sock.sendMessage === 'function') {
                const photo = await fetchPhoto(device.imageUrl);
                if (photo) {
                    try {
                        await sock.sendMessage(m.chat, { image: photo.buffer, caption: buildPhotoCaption(device) }, { quoted: m });
                        return m.reply(formatDetail(device, false));
                    } catch (e) {
                        console.error('[GsmArena foto] gagal kirim, fallback teks:', e?.message || e);
                    }
                }
            }
            return m.reply(formatDetail(device, true));
        }

        m.react('✅');
        return m.reply(formatList(devices, args, m.prefix || '.'));
    } catch (error) {
        console.error('[GsmArena Error]', error?.code || '', error?.detail || error?.message || error);
        if (error && error.code === 'solver') {
            m.react('⚠️');
            return m.reply('⚠️ Solver captcha gencipta gagal/gak bisa ditembus. Coba lagi beberapa saat ya.');
        }
        if (error && error.code === 'challenge') {
            m.react('🤖');
            return m.reply('🤖 GSMArena masih nge-challenge setelah beberapa kali solve. Coba lagi nanti ya.');
        }
        if (error && error.code === 'network') {
            m.react('📡');
            return m.reply('📡 Gagal nyambung ke gsmarena.com (' + String(error.detail || 'network').slice(0, 80) + '). Coba lagi nanti.');
        }
        m.react('☢');
        return m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler };