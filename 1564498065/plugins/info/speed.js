// ============================================================
//  PING / SPEED / OS — tampilan AIRich: thumbnail video + teks markdown
//  Pemakaian: .ping2  |  .speed  |  .os
//  (.ping sudah dipakai plugin ping lama, jadi di sini jadi .ping2)
//  Video thumbnail: teks.mp4 di folder yang sama
//  Cadangan: kalau rich gagal, teks polos dikirim lewat m.reply
// ============================================================
import os from 'os'
import fs from 'fs'
import path from 'path'
import {
    fileURLToPath
} from 'url'
import {
    execFile,
    execSync
} from 'child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import IchigoBuilder from '../../src/lib/ichigo-builder.js'
const {
    AIRich
} = IchigoBuilder

const pluginConfig = {
    name: 'speed',
    alias: ['os', 'ping2'],
    category: 'info',
    description: 'Cek kecepatan bot, resource server, dan info sistem dengan thumbnail video',
    usage: '.speed | .os | .ping2',
    example: '.speed',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0, // cooldown 5 detik sudah ditangani di dalam handler
    energi: 0,
    isEnabled: true
}

// ffmpeg bawaan paket @ffmpeg-installer (di panel biasanya tidak ada ffmpeg di PATH).
// ffprobe tidak disertakan paket itu; kalau tidak ada, durasi memakai LOOP_SEC.
const FFMPEG = ffmpegInstaller?.path || 'ffmpeg'

// ---- thumbnail: video -> gambar animasi base64 (cache di memori) ----
// taruh video di folder yang sama dengan file plugin ini dengan nama teks.mp4 (atau ubah path-nya di sini)
// dicari di folder plugin ini dulu, lalu di plugins/game/ (tempat .setumb menyimpan)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_CANDIDATES = [
    path.join(HERE, 'teks.mp4'),
    path.join(process.cwd(), 'plugins', 'game', 'teks.mp4'),
    path.join(HERE, '..', 'game', 'teks.mp4'),
    path.join(process.cwd(), 'assets', 'video', 'ichigo.mp4') // cadangan kalau teks.mp4 rusak
]
const findVideo = () => VIDEO_CANDIDATES.find(f => fs.existsSync(f)) || VIDEO_CANDIDATES[0]
const MAX_VID = 700 * 1024 // maks ukuran gambar animasi (byte) — turunkan lagi kalau tidak muncul, naikkan kalau mau lebih tajam
let lastErr = ''
let videoP = null

const run = (cmd, args) => new Promise((res, rej) =>
    execFile(cmd, args, {
        timeout: 180000
    }, (e) => e ? rej(e) : res())
).catch(e => {
    // binary installer tidak ada / tidak bisa dijalankan -> coba ffmpeg di PATH
    if (cmd === FFMPEG && cmd !== 'ffmpeg' && (e.code === 'ENOENT' || e.code === 'EACCES')) return run('ffmpeg', args)
    throw e
})

// simpan penyebab gagal (ujung pesan error ffmpeg) supaya tampil di balasan
const noteErr = (tag, e) => {
    lastErr = tag + ': ' + String(e?.message || e).replace(/\s+/g, ' ').slice(-350)
}

const LOOP_SEC = 30 // batas maksimal panjang yang dipakai (detik) — video penuh selama di bawah ini
const FADE_SEC = 0 // crossfade ujung->awal (0 = mati, video diputar penuh). Isi mis. 0.5 kalau mau loop lebih halus tapi lebih pendek

// filter ffmpeg: crossfade ujung klip ke awal klip supaya loop tidak patah
function loopVf(w, fps, T, d) {
    const base = 'fps=' + fps + ',scale=' + w + ':-2'
    if (!(d > 0 && T >= 2 * d + 0.5)) return base // klip terlalu pendek -> tanpa fade
    return base + ',split=3[a][b][c];' +
        '[a]trim=0:' + d + ',setpts=PTS-STARTPTS[h];' +
        '[b]trim=' + (T - d) + ':' + T + ',setpts=PTS-STARTPTS[t];' +
        '[c]trim=' + d + ':' + (T - d) + ',setpts=PTS-STARTPTS[m];' +
        '[t][h]xfade=transition=fade:duration=' + d + ':offset=0[x];' +
        '[x][m]concat=n=2:v=1:a=0'
}

// ambil durasi sumber supaya potongan tidak melebihi panjang video asli
async function pickLen(src) {
    try {
        const out = await new Promise((res, rej) =>
            execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], {
                timeout: 15000
            }, (e, so) => e ? rej(e) : res(String(so)))
        )
        const dur = parseFloat(out)
        if (dur > 0) return Math.min(LOOP_SEC, Math.floor(dur * 10) / 10)
    } catch {}
    return LOOP_SEC
}

async function makeVideoFrom(VIDEO_FILE) {
    lastErr = ''
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teks-'))
    const src = path.join(dir, 'in.mp4')
    try {
        if (!fs.existsSync(VIDEO_FILE)) throw new Error('teks.mp4 tidak ditemukan. Dicari di: ' + VIDEO_CANDIDATES.join(' | '))
        fs.copyFileSync(VIDEO_FILE, src)
        const T = await pickLen(src)

        // WebP animasi dulu, bertahap makin kecil
        // [lebar, fps, kualitas] dari paling tajam turun bertahap sampai muat di MAX_VID
        // (video pendek/kecil otomatis dapat kualitas tertinggi; video panjang turun sendiri)
        for (const [w, fps, q] of [
                [480, 15, 65],
                [440, 15, 60],
                [420, 15, 55],
                [400, 15, 50],
                [400, 12, 45],
                [360, 12, 40],
                [330, 12, 35],
                [300, 12, 30],
                [280, 12, 30],
                [260, 12, 35],
                [260, 12, 30],
                [240, 12, 35],
                [260, 10, 28],
                [240, 10, 25],
                [200, 8, 20],
                [160, 8, 15]
            ]) {
            const out = path.join(dir, 'o' + w + '.webp')
            try {
                await run(FFMPEG, ['-y', '-t', String(T), '-i', src, '-an',
                    '-vf', loopVf(w, fps, T, FADE_SEC),
                    '-c:v', 'libwebp', '-loop', '0', '-q:v', String(q),
                    '-compression_level', '6', '-preset', 'picture', out
                ])
                const buf = fs.readFileSync(out)
                if (buf.length <= MAX_VID) return 'data:image/webp;base64,' + buf.toString('base64')
            } catch (e) {
                noteErr('webp', e)
                break // ffmpeg/libwebp tidak ada -> coba GIF
            }
        }
        // cadangan GIF
        for (const [w, fps] of [
                [240, 10],
                [180, 8]
            ]) {
            const out = path.join(dir, 'o' + w + '.gif')
            try {
                await run(FFMPEG, ['-y', '-t', String(T), '-i', src, '-an',
                    '-vf', loopVf(w, fps, T, FADE_SEC) + ',split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse',
                    '-loop', '0', out
                ])
                const buf = fs.readFileSync(out)
                if (buf.length <= MAX_VID) return 'data:image/gif;base64,' + buf.toString('base64')
            } catch (e) {
                noteErr('gif', e)
                break
            }
        }
        if (!lastErr) lastErr = 'hasil lebih besar dari MAX_VID (' + Math.round(MAX_VID / 1024) + ' KB)'
        return ''
    } finally {
        fs.rmSync(dir, {
            recursive: true,
            force: true
        })
    }
}

// coba tiap kandidat video yang ada; kalau satu rusak (mis. moov atom not found), lanjut ke berikutnya
async function makeVideo() {
    const list = VIDEO_CANDIDATES.filter(f => fs.existsSync(f))
    if (!list.length) return makeVideoFrom(VIDEO_CANDIDATES[0])
    let res = ''
    for (const f of list) {
        res = await makeVideoFrom(f)
        if (res) return res
    }
    return res
}

// cache dibuat ulang otomatis kalau teks.mp4 diganti
let videoStamp = 0

function getVideo() {
    let stamp = 0
    try {
        stamp = fs.statSync(findVideo()).mtimeMs
    } catch {}
    if (videoP && stamp !== videoStamp) videoP = null
    if (!videoP) {
        videoStamp = stamp
        videoP = makeVideo().catch(e => {
            lastErr = String(e?.message || e)
            console.error('[TEKS] video gagal:', lastErr)
            videoP = null
            return ''
        })
    }
    return videoP
}

// ---- HTML: hanya thumbnail, tanpa teks, tanpa latar (sisi memudar ke chat) ----
function buildTeksHtml(thumb) {
    return `<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{background:transparent!important}
body{padding:4px 6px 8px;overflow-x:hidden;-webkit-text-size-adjust:100%}
.wrap{width:100%;max-width:420px;margin:0 auto}
.thumb{display:block;width:100%;height:auto;max-height:230px;object-fit:cover;pointer-events:none;
-webkit-mask-image:linear-gradient(to right,transparent 0,#000 16%,#000 84%,transparent 100%),linear-gradient(to bottom,transparent 0,#000 22%,#000 78%,transparent 100%);
-webkit-mask-composite:source-in;-webkit-mask-repeat:no-repeat;-webkit-mask-size:100% 100%;
mask-image:linear-gradient(to right,transparent 0,#000 16%,#000 84%,transparent 100%),linear-gradient(to bottom,transparent 0,#000 22%,#000 78%,transparent 100%);
mask-composite:intersect;mask-repeat:no-repeat;mask-size:100% 100%}
</style>

<div class="wrap">
  <img class="thumb" id="th" alt="" src="${thumb}">
</div>

<script>
(function(){
try{
  var meta=document.createElement("meta");
  meta.name="viewport";
  meta.content="width=device-width, initial-scale=1, viewport-fit=cover";
  document.head.appendChild(meta);
}catch(e){}
try{
  var t=document.getElementById("th");
  if(t)t.addEventListener("error",function(){t.remove()});
}catch(e){}
})();
</script>`
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0,
        v = bytes
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024
        i++
    }
    return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function durasi(ms) {
    const t = Math.floor(ms / 1000)
    const d = Math.floor(t / 86400)
    const h = Math.floor((t % 86400) / 3600)
    const m = Math.floor((t % 3600) / 60)
    const s = t % 60
    return [
        ...(d ? [`${d} hari`] : []),
        ...(h ? [`${h} jam`] : []),
        ...(m ? [`${m} menit`] : []),
        `${s} detik`,
    ].join(', ')
}

function getUsername() {
    try {
        return os.userInfo().username
    } catch {
        return '-'
    }
}

function getDisk() {
    try {
        const out = execSync('df -kP /', {
            timeout: 3000
        }).toString().trim().split('\n')
        const row = out.slice(1).map(l => l.trim().split(/\s+/))[0]
        const total = +row[1] * 1024
        const used = +row[2] * 1024
        return {
            total,
            used,
            percent: +(used / total * 100).toFixed(1)
        }
    } catch {
        return null
    }
}

function getSwap() {
    try {
        const f = fs.readFileSync('/proc/meminfo', 'utf8')
        const total = ((f.match(/^SwapTotal:\s+(\d+)/m) || [0, 0])[1]) * 1024
        const free = ((f.match(/^SwapFree:\s+(\d+)/m) || [0, 0])[1]) * 1024
        if (!total) return null
        const used = total - free
        return {
            total,
            used,
            free,
            percent: +(used / total * 100).toFixed(1)
        }
    } catch {
        return null
    }
}

function cpuSnap() {
    return os.cpus().reduce((a, c) => {
        const t = Object.values(c.times).reduce((x, y) => x + y, 0)
        a.idle += c.times.idle
        a.total += t
        return a
    }, {
        idle: 0,
        total: 0
    })
}

function cpuPct(a, b) {
    const dt = b.total - a.total,
        di = b.idle - a.idle
    return dt > 0 ? +Math.max(0, Math.min(100, (1 - di / dt) * 100)).toFixed(1) : 0
}

function collect(conn, speed, cpuPercent) {
    const cores = os.cpus().length
    const load = os.loadavg()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const heap = process.memoryUsage()
    const isBun = typeof Bun !== 'undefined'

    return {
        botName: conn?.user?.name || String(conn?.user?.id || '').split('@')[0] || 'WhatsApp Bot',
        speed,
        osType: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        cpuShort: (os.cpus()[0]?.model || 'Unknown').replace(/\(R\)|\(TM\)/g, '').trim(),
        cores,
        hostname: os.hostname(),
        username: getUsername(),
        cpuPercent,
        load1: load[0].toFixed(2),
        load5: load[1].toFixed(2),
        load15: load[2].toFixed(2),
        memPercent: +((usedMem / totalMem) * 100).toFixed(1),
        memUsed: formatSize(usedMem),
        memTotal: formatSize(totalMem),
        rss: formatSize(heap.rss),
        heapUsed: formatSize(heap.heapUsed),
        disk: getDisk(),
        swap: getSwap(),
        runtimeName: isBun ? 'Bun' : 'Node.js',
        runtimeVersion: isBun ? Bun.version : process.version,
        botUptime: durasi(process.uptime() * 1000),
        sysUptime: durasi(os.uptime() * 1000)
    }
}


const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const COOLDOWN_MS = 5000
const lastUse = new Map()

const mdList = (rows) => rows.filter(Boolean).map(([k, v]) => '- **' + k + '** : ' + v).join('\n')
const plain = (title, rows) => '*' + title + '*\n' + rows.filter(Boolean).map(([k, v]) => '• ' + k + ': ' + v).join('\n')

async function handler(m, {
    sock
}) {
    const conn = sock || m.conn
    const command = m.command
    const usedPrefix = m.prefix

    const elapsed = Date.now() - (lastUse.get(m.sender) || 0)
    if (elapsed < COOLDOWN_MS) {
        const sisa = ((COOLDOWN_MS - elapsed) / 1000).toFixed(1)
        return m.reply(`⏳ Tunggu ${sisa} detik lagi sebelum pakai ${usedPrefix + command}`)
    }
    lastUse.delete(m.sender)
    if (lastUse.size >= 500) {
        const now = Date.now()
        for (const [user, ts] of lastUse) {
            if (now - ts >= COOLDOWN_MS) lastUse.delete(user)
        }
    }
    lastUse.set(m.sender, Date.now())

    // latency = waktu bolak-balik ke WhatsApp (react), tidak termasuk pengukuran CPU
    const start = Date.now()
    await m.react('🍡').catch(() => {})
    const speed = Date.now() - start

    const prevCpu = cpuSnap()
    await sleep(250)
    const d = collect(conn, speed, cpuPct(prevCpu, cpuSnap()))
    const isOs = String(command).toLowerCase() === 'os'
    const botName = String(global.namebot || conn?.user?.name || 'Kyoko')

    let heading, sections
    if (isOs) {
        heading = '🖥️ SYSTEM'
        sections = [
            ['SERVER', [
                ['Host', `${d.hostname} (${d.username})`],
                ['OS', `${d.osType} (${d.arch})`],
                ['CPU', `${d.cpuShort} (${d.cores} Core)`],
                ['Runtime', `${d.runtimeName} ${d.runtimeVersion}`],
            ]],
            ['RESOURCE', [
                ['CPU', `${d.cpuPercent}%`],
                ['Load', `${d.load1} · ${d.load5} · ${d.load15}`],
                ['RAM', `${d.memPercent}% (${d.memUsed} / ${d.memTotal})`],
                d.swap ? ['Swap', `${d.swap.percent}% (${formatSize(d.swap.used)} / ${formatSize(d.swap.total)})`] : null,
                d.disk ? ['Disk', `${d.disk.percent}% (${formatSize(d.disk.used)} / ${formatSize(d.disk.total)})`] : null,
                ['RSS Bot', d.rss],
            ]],
            ['UPTIME', [
                ['Bot', d.botUptime],
                ['Server', d.sysUptime],
            ]],
        ]
    } else {
        heading = '⚡ PONG'
        sections = [
            ['LATENCY', [
                ['Speed', `${d.speed} ms`],
                ['Status', d.speed < 200 ? 'Sangat Cepat 🟢' : d.speed < 600 ? 'Stabil 🟡' : 'Tinggi 🔴'],
            ]],
            ['SERVER', [
                ['CPU', `${d.cpuPercent}% (${d.cores} Core)`],
                ['RAM', `${d.memPercent}% (${d.memUsed} / ${d.memTotal})`],
                d.disk ? ['Disk', `${d.disk.percent}% (${formatSize(d.disk.used)} / ${formatSize(d.disk.total)})`] : null,
                ['Runtime', `${d.runtimeName} ${d.runtimeVersion}`],
                ['Heap / RSS', `${d.heapUsed} / ${d.rss}`],
            ]],
            ['UPTIME', [
                ['Bot', d.botUptime],
            ]],
        ]
    }

    // pertama kali agak lama (konversi video), sesudahnya instan dari cache
    const thumb = await getVideo()
    if (!thumb) await m.reply('⚠️ Video gagal dibuat: ' + (lastErr || 'hasil kosong (ffmpeg tidak ada / video terlalu besar untuk MAX_VID)'))

    try {
        const rich = new AIRich(conn)

        if (thumb) {
            rich.addSection({
                view_model: {
                    __typename: 'GenAISingleLayoutViewModel',
                    primitive: {
                        __typename: 'FOAHtmlPrimitiveDemoDONOTUSE',
                        trusted_sources: [],
                        payload: buildTeksHtml(thumb)
                    }
                }
            })
        }

        rich.addText(
            `# ${heading}

## ♡ ${botName} ♡

---

` + sections.map(([title, rows]) => `### ${title}\n${mdList(rows)}`).join('\n\n---\n\n'))

        await rich.send(m.chat, {
            quoted: m
        })
        try {
            await m.react('')
        } catch {}
    } catch (e) {
        console.error('[PING] kirim rich gagal, pakai teks polos:', e?.message || e)
        await m.reply([
            heading + ' — ' + botName,
            '',
            ...sections.map(([title, rows]) => plain(title, rows) + '\n')
        ].join('\n'))
    }
}

export {
    pluginConfig as config,
    handler
}