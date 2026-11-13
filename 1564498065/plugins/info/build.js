import { createCanvas, loadImage } from "../../src/lib/ichigo-canvas-lazy.js"
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import config from '../../config.js'

const pluginConfig = {
    name: 'build',
    alias: ['buildkarakter', 'buildchar', 'karakter'],
    category: 'info',
    description: 'Lihat rekomendasi build karakter Genshin Impact dalam bentuk gambar',
    usage: '.build <nama karakter>',
    example: '.build Freminet',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 15,
    energi: 0,
    isEnabled: true
}

const SPLASH_URLS = {
    freminet: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Freminet.png',
        'https://genshin.jmp.blue/characters/freminet/gacha-splash',
        'https://static.wikia.nocookie.net/gensin-impact/images/9/9e/Character_Freminet_Game.png',
    ],
    hutao: [
        'https://rerollcdn.com/GENSHIN/Characters/new/HuTao.png',
        'https://genshin.jmp.blue/characters/hu-tao/gacha-splash',
    ],
    raiden: [
        'https://rerollcdn.com/GENSHIN/Characters/new/RaidenShogun.png',
        'https://genshin.jmp.blue/characters/raiden-shogun/gacha-splash',
    ],
    zhongli: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Zhongli.png',
        'https://genshin.jmp.blue/characters/zhongli/gacha-splash',
    ],
    neuvillette: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Neuvillette.png',
        'https://genshin.jmp.blue/characters/neuvillette/gacha-splash',
    ],
    furina: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Furina.png',
        'https://genshin.jmp.blue/characters/furina/gacha-splash',
    ],
    nahida: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Nahida.png',
        'https://genshin.jmp.blue/characters/nahida/gacha-splash',
    ],
    bennett: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Bennett.png',
        'https://genshin.jmp.blue/characters/bennett/gacha-splash',
    ],
    kazuha: [
        'https://rerollcdn.com/GENSHIN/Characters/new/KaedeharaKazuha.png',
        'https://genshin.jmp.blue/characters/kaedehara-kazuha/gacha-splash',
    ],
    yelan: [
        'https://rerollcdn.com/GENSHIN/Characters/new/Yelan.png',
        'https://genshin.jmp.blue/characters/yelan/gacha-splash',
    ],
}

const BUILD_DB = {
    freminet: {
        name: 'Freminet',
        element: 'Cryo',
        weapon: 'Claymore',
        rarity: 4,
        role: 'Physical / Cryo DPS',
        elementColor: '#7EC8E3',
        bgFrom: '#0A1628',
        bgTo: '#0D2137',
        accentDark: '#0A3050',
        elementEmoji: '❄️',
        constellation: 'Bestia Meticulosa',
        birthday: '20 September',
        nation: 'Fontaine',
        description: 'Spesialis Shatter & Physical DMG. Paling efektif di Superconduct team. Skill-nya mengisi Pers Level untuk ledakan DMG besar.',
        builds: [
            {
                label: 'Physical DPS',
                badge: '🏆 META',
                badgeColor: '#FFD700',
                weapons: [
                    { name: 'Skyward Pride', stars: 5, note: 'BiS C0 — ER + DMG Buff' },
                    { name: 'Song of Broken Pines', stars: 5, note: 'BiS C2+ — ATK SPD buff' },
                    { name: 'The Unforged', stars: 5, note: 'Alt 5★ — Shield bonus' },
                    { name: 'Serpent Spine', stars: 4, note: 'Best 4★ — CRIT Rate +' },
                    { name: 'Snow-Tombed Starsilver', stars: 4, note: 'F2P crafted — Phys%' },
                    { name: 'Prototype Archaic', stars: 4, note: 'Craftable — ATK%' },
                ],
                artifact: {
                    name: 'Pale Flame (4pc)',
                    set: 'Domain: Ridge Watch',
                    bonus2: 'Physical DMG +25%',
                    bonus4: 'Elemental Skill hit → ATK +9% (2 stack = bonus 2pc meningkat 100%)',
                    alt: '2pc Pale Flame + 2pc Emblem of Severed Fate (saat farming)',
                },
                stats: {
                    sands: 'ATK%',
                    goblet: 'Physical DMG Bonus%',
                    circlet: 'CRIT Rate / CRIT DMG',
                    sub: ['CRIT Rate', 'CRIT DMG', 'ATK%', 'Energy Recharge'],
                },
                requirements: { er: '≥ 140%', cr: '≥ 60%', cd: '≥ 120%' },
                rotation: 'Skill (tap) → Burst → Normal x2 → Skill (hold L4)',
                tips: [
                    'ER minimal 140% agar Burst selalu tersedia',
                    'Superconduct dengan Fischl/Beidou turunkan Physical RES musuh 40%',
                    'Pale Flame 4pc aktif otomatis saat Skill digunakan berkali-kali',
                    'C2 unlock — Skill 2x isi Pers Level lebih cepat',
                ],
            },
            {
                label: 'Cryo DPS',
                badge: '❄️ ALT',
                badgeColor: '#7EC8E3',
                weapons: [
                    { name: 'Serpent Spine R5', stars: 4, note: 'BiS — CRIT Rate +' },
                    { name: 'Skyward Pride', stars: 5, note: 'Alt — ER sangat berguna' },
                    { name: "Wolf's Gravestone", stars: 5, note: 'Alt — ATK% team buff' },
                    { name: 'Tidal Shadow', stars: 4, note: '4★ Alt — HP ke ATK' },
                    { name: 'Favonius Greatsword', stars: 4, note: 'Support — bantu ER' },
                ],
                artifact: {
                    name: 'Blizzard Strayer (4pc)',
                    set: 'Domain: Peak of Vindagnyr',
                    bonus2: 'Cryo DMG +15%',
                    bonus4: 'CRIT Rate +20% vs Cryo, +40% vs Frozen enemy',
                    alt: '2pc Blizzard Strayer + 2pc Pale Flame',
                },
                stats: {
                    sands: 'ATK%',
                    goblet: 'Cryo DMG Bonus%',
                    circlet: 'CRIT DMG (CRIT Rate lebih mudah dari Blizzard)',
                    sub: ['CRIT DMG', 'CRIT Rate', 'ATK%', 'Energy Recharge'],
                },
                requirements: { er: '≥ 130%', cr: '≥ 50%', cd: '≥ 140%' },
                rotation: 'Skill L0 → Burst → Normal Attack combo',
                tips: [
                    'Fokus Pers Level 0 untuk Cryo DMG tertinggi (bukan Level 4)',
                    'Pair dengan Hydro untuk Frozen — CRIT Rate +40% dari artifact',
                    'Mona/Kokomi + Freminet untuk Freeze team yang stabil',
                    'Blizzard 4pc sangat berguna jika Frozen terjaga konsisten',
                ],
            },
        ],
        teams: [
            {
                name: 'Superconduct Physical',
                members: [
                    { name: 'Freminet', role: 'Main DPS' },
                    { name: 'Fischl', role: 'Electro Off-field' },
                    { name: 'Diona', role: 'Shield + Heal' },
                    { name: 'Bennett', role: 'Buff + Heal' },
                ],
            },
            {
                name: 'Freeze Cryo',
                members: [
                    { name: 'Freminet', role: 'Main DPS' },
                    { name: 'Mona', role: 'Hydro Freeze' },
                    { name: 'Rosaria', role: 'Cryo CRIT buff' },
                    { name: 'Zhongli', role: 'Shield' },
                ],
            },
            {
                name: 'Premium Physical',
                members: [
                    { name: 'Freminet', role: 'Main DPS' },
                    { name: 'Zhongli', role: 'Shield' },
                    { name: 'Fischl', role: 'Electro Off-field' },
                    { name: 'Bennett', role: 'Buff + Heal' },
                ],
            },
        ],
    },

    hutao: {
        name: 'Hu Tao',
        element: 'Pyro',
        weapon: 'Polearm',
        rarity: 5,
        role: 'Pyro Main DPS',
        elementColor: '#FF7043',
        bgFrom: '#1A0A00',
        bgTo: '#2D0F00',
        accentDark: '#3D1500',
        elementEmoji: '🔥',
        constellation: 'Papilio Charontis',
        birthday: '15 Juli',
        nation: 'Liyue',
        description: 'Queen of Vaporize. DMG berbasis HP tinggi saat dibawah 50% HP. Burst serap HP untuk skill berikutnya. Salah satu DPS tertinggi di game.',
        builds: [
            {
                label: 'Vaporize DPS',
                badge: '🏆 META',
                badgeColor: '#FFD700',
                weapons: [
                    { name: 'Staff of Homa', stars: 5, note: 'BiS — HP → DMG + CRIT' },
                    { name: 'Staff of the Scarlet Sands', stars: 5, note: 'Alt 5★ — EM CRIT' },
                    { name: "Crimson Moon's Semblance", stars: 5, note: 'Alt 5★ — HP + shield' },
                    { name: "Dragon's Bane", stars: 4, note: 'Best 4★ — EM Vaporize' },
                    { name: 'Deathmatch', stars: 4, note: 'Battlepass — CRIT Rate' },
                    { name: 'White Tassel', stars: 3, note: 'F2P alt — Normal ATK%' },
                ],
                artifact: {
                    name: 'Crimson Witch of Flames (4pc)',
                    set: 'Domain: Hidden Palace of Zhou Formula',
                    bonus2: 'Pyro DMG +15%',
                    bonus4: 'Vaporize/Melt DMG +15%, Pyro Reaction DMG +8% (3 stack)',
                    alt: '2pc Crimson Witch + 2pc Wanderer\'s Troupe (jika kekurangan EM)',
                },
                stats: {
                    sands: 'HP%',
                    goblet: 'Pyro DMG Bonus%',
                    circlet: 'CRIT Rate / CRIT DMG',
                    sub: ['CRIT Rate', 'CRIT DMG', 'HP%', 'Elemental Mastery'],
                },
                requirements: { er: '≥ 110%', cr: '≥ 50%', cd: '≥ 160%' },
                rotation: 'Skill → N1C spam (N1 + Charged) → Burst saat HP rendah → Skill lagi',
                tips: [
                    'Jaga HP di bawah 50% untuk bonus DMG Skill Hu Tao',
                    'Burst menyembuhkan HP — pakai saat hampir mati, lalu Skill lagi',
                    'Pair dengan Xingqiu/Yelan untuk trigger Vaporize tiap Charged Attack',
                    'Zhongli shield penting agar tidak mati saat HP rendah',
                    'C1 lepas Stamina cost Charged Attack — sangat worthit',
                ],
            },
        ],
        teams: [
            {
                name: 'Vaporize Premium',
                members: [
                    { name: 'Hu Tao', role: 'Main DPS' },
                    { name: 'Yelan', role: 'Hydro Off-field' },
                    { name: 'Zhongli', role: 'Shield' },
                    { name: 'Furina', role: 'DMG Amplify' },
                ],
            },
            {
                name: 'Vaporize F2P',
                members: [
                    { name: 'Hu Tao', role: 'Main DPS' },
                    { name: 'Xingqiu', role: 'Hydro Off-field' },
                    { name: 'Albedo', role: 'Sub DPS' },
                    { name: 'Zhongli', role: 'Shield' },
                ],
            },
        ],
    },

    raiden: {
        name: 'Raiden Shogun',
        element: 'Electro',
        weapon: 'Polearm',
        rarity: 5,
        role: 'ER Support / Hyperbloom DPS',
        elementColor: '#BB86FC',
        bgFrom: '#0D0020',
        bgTo: '#1A0035',
        accentDark: '#2D0050',
        elementEmoji: '⚡',
        constellation: 'Imperatrix Umbrosa',
        birthday: '26 Juni',
        nation: 'Inazuma',
        description: 'Support universal terbaik. Burst mengisi energy seluruh tim sekaligus. Bisa jadi DPS di Hyperbloom atau Overloaded team.',
        builds: [
            {
                label: 'ER Support / Sub DPS',
                badge: '🏆 META',
                badgeColor: '#FFD700',
                weapons: [
                    { name: 'Engulfing Lightning', stars: 5, note: 'BiS — ER → ATK + Burst buff' },
                    { name: 'Staff of Homa', stars: 5, note: 'Alt — tinggi DMG Burst' },
                    { name: 'Favonius Lance', stars: 4, note: 'Best Support — ER tim' },
                    { name: "'The Catch'", stars: 4, note: 'Best F2P — Burst DMG+' },
                    { name: 'Kitain Cross Spear', stars: 4, note: 'Craftable — EM Hyperbloom' },
                    { name: 'Moonpiercer', stars: 4, note: 'Dendro Passive — ER alt' },
                ],
                artifact: {
                    name: 'Emblem of Severed Fate (4pc)',
                    set: 'Domain: Momiji-Dyed Court',
                    bonus2: 'Energy Recharge +20%',
                    bonus4: 'Burst DMG +25% per 10% ER (max +75%)',
                    alt: '2pc Emblem + 2pc Thundering Fury (jika ER sudah cukup)',
                },
                stats: {
                    sands: 'Energy Recharge%',
                    goblet: 'Electro DMG Bonus%',
                    circlet: 'CRIT Rate / CRIT DMG',
                    sub: ['Energy Recharge', 'CRIT Rate', 'CRIT DMG', 'ATK%'],
                },
                requirements: { er: '200-250%', cr: '≥ 55%', cd: '≥ 110%' },
                rotation: 'Skill → switch tim full rotation → kembali Raiden Burst',
                tips: [
                    'ER 200-250% untuk regenerasi energi semua anggota tim',
                    'Passive Eye of Stormy Judgement: tiap anggota tim yang pakai Burst → stack DMG',
                    'Dalam Hyperbloom: pair dengan Nahida + Kokomi untuk DMG masif',
                    'Favonius Lance bisa buat seluruh tim infinite energy',
                    'C2 unlock — Burst meningkat drastis, mulai layak jadi main DPS',
                ],
            },
        ],
        teams: [
            {
                name: 'Hyperbloom',
                members: [
                    { name: 'Raiden', role: 'Hyperbloom Trigger' },
                    { name: 'Nahida', role: 'Dendro Core' },
                    { name: 'Yelan', role: 'Hydro Bloom' },
                    { name: 'Furina', role: 'Amplify' },
                ],
            },
            {
                name: 'National Team',
                members: [
                    { name: 'Raiden', role: 'Battery + DPS' },
                    { name: 'Xiangling', role: 'Pyro Off-field' },
                    { name: 'Xingqiu', role: 'Hydro Off-field' },
                    { name: 'Bennett', role: 'Buff + Heal' },
                ],
            },
        ],
    },

    zhongli: {
        name: 'Zhongli',
        element: 'Geo',
        weapon: 'Polearm',
        rarity: 5,
        role: 'Universal Shield Support',
        elementColor: '#DBA44E',
        bgFrom: '#1A1000',
        bgTo: '#2D1F00',
        accentDark: '#3D2A00',
        elementEmoji: '🪨',
        constellation: 'Lapis Dei',
        birthday: '31 Desember',
        nation: 'Liyue',
        description: 'Shield terkuat di game. Shield-nya menurunkan RES semua elemen musuh 20%. Tidak perlu refresh sering — set and forget.',
        builds: [
            {
                label: 'Shield Support',
                badge: '🏆 META',
                badgeColor: '#FFD700',
                weapons: [
                    { name: 'Black Tassel', stars: 3, note: 'BiS F2P — HP% terbaik' },
                    { name: 'Favonius Lance', stars: 4, note: 'Alt — bantu ER tim' },
                    { name: 'Staff of Homa', stars: 5, note: 'Alt — HP + DMG Burst' },
                    { name: 'Vortex Vanquisher', stars: 5, note: 'Signature — Shield + ATK' },
                    { name: 'Prototype Starglitter', stars: 4, note: 'Craftable alt' },
                ],
                artifact: {
                    name: 'Tenacity of the Millelith (4pc)',
                    set: 'Domain: Ridge Watch',
                    bonus2: 'HP +20%',
                    bonus4: 'Skill hit → ATK +20% & Shield Str +30% seluruh tim',
                    alt: '2pc Tenacity + 2pc Archaic Petra (jika ingin DMG Burst juga)',
                },
                stats: {
                    sands: 'HP%',
                    goblet: 'HP%',
                    circlet: 'HP%',
                    sub: ['HP%', 'HP flat', 'ER%', 'DEF%'],
                },
                requirements: { er: '≥ 120%', hp: '≥ 50.000', shield: 'Tidak perlu CRIT' },
                rotation: 'Hold Skill (shield + RES shred) → Burst → swap DPS → refresh shield',
                tips: [
                    'Black Tassel 3★ sudah BiS untuk pure shield build — jangan ganti',
                    'Passive Stone Stele menurunkan semua elemental RES musuh -20%',
                    'HP 50k+ dengan Tenacity 4pc membuat shield hampir tidak bisa pecah',
                    'Tidak perlu CRIT sama sekali, full HP%',
                    'Bisa dipasang di tim manapun — support paling universal',
                ],
            },
        ],
        teams: [
            {
                name: 'Universal Pair',
                members: [
                    { name: 'Zhongli', role: 'Shield Support' },
                    { name: 'Hu Tao', role: 'Main DPS' },
                    { name: 'Yelan', role: 'Hydro Off-field' },
                    { name: 'Furina', role: 'Amplify' },
                ],
            },
            {
                name: 'Hydro DPS',
                members: [
                    { name: 'Zhongli', role: 'Shield Support' },
                    { name: 'Neuvillette', role: 'Main DPS' },
                    { name: 'Fischl', role: 'Electro Off-field' },
                    { name: 'Nahida', role: 'Dendro Core' },
                ],
            },
        ],
    },
}

async function fetchImageBuffer(urls) {
    const list = Array.isArray(urls) ? urls : [urls]
    for (const url of list) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 6000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            })
            if (res.data && res.data.byteLength > 1000) return Buffer.from(res.data)
        } catch {}
    }
    return null
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

function wrapText(ctx, text, maxW) {
    const words = text.split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
        const test = line ? line + ' ' + word : word
        if (ctx.measureText(test).width > maxW && line) {
            lines.push(line)
            line = word
        } else {
            line = test
        }
    }
    if (line) lines.push(line)
    return lines
}

async function generateBuildCard(data, buildIndex = 0) {
    const W = 1100
    const build = data.builds[buildIndex]
    const ec = data.elementColor
    const PAD = 36

    const tipsH = build.tips.length * 34 + 60
    const teamsH = data.teams.length * 130 + 60
    const H = 320 + 80 + 220 + 210 + 160 + 90 + 70 + tipsH + teamsH + 80

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, data.bgFrom)
    bgGrad.addColorStop(0.5, data.bgTo)
    bgGrad.addColorStop(1, data.bgFrom)
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = hexAlpha(ec, 0.03)
    ctx.lineWidth = 1
    for (let i = -H; i < W + H; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke()
    }

    const lgGrad = ctx.createLinearGradient(0, 0, 300, 0)
    lgGrad.addColorStop(0, hexAlpha(ec, 0.12))
    lgGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = lgGrad
    ctx.fillRect(0, 0, 300, H)

    const topBar = ctx.createLinearGradient(0, 0, W, 0)
    topBar.addColorStop(0, ec)
    topBar.addColorStop(0.5, hexAlpha(ec, 0.6))
    topBar.addColorStop(1, 'transparent')
    ctx.fillStyle = topBar
    ctx.fillRect(0, 0, W, 4)

    const hdrGrad = ctx.createLinearGradient(0, 0, W, 320)
    hdrGrad.addColorStop(0, hexAlpha(ec, 0.22))
    hdrGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = hdrGrad
    ctx.fillRect(0, 0, W, 320)

    ctx.fillStyle = hexAlpha(ec, 0.3)
    ctx.fillRect(0, 316, W, 1)

    let splashImg = null
    const urls = SPLASH_URLS[Object.keys(SPLASH_URLS).find(k => data.name.toLowerCase().replace(' ', '').includes(k) || k.includes(data.name.toLowerCase().replace(/\s/g, '')))] || []
    if (urls.length) {
        const buf = await fetchImageBuffer(urls)
        if (buf) {
            try { splashImg = await loadImage(buf) } catch {}
        }
    }

    if (splashImg) {
        const imgH = 310
        const imgW = Math.round((splashImg.width / splashImg.height) * imgH)
        const ix = 10, iy = 5

        ctx.save()
        const fadeGrad = ctx.createLinearGradient(ix, 0, ix + imgW, 0)
        fadeGrad.addColorStop(0.6, 'rgba(0,0,0,1)')
        fadeGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalCompositeOperation = 'destination-out'
        
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(splashImg, ix, iy, imgW, imgH)

        const fadeRight = ctx.createLinearGradient(ix + imgW * 0.55, 0, ix + imgW, 0)
        fadeRight.addColorStop(0, 'transparent')
        fadeRight.addColorStop(1, data.bgFrom)
        ctx.fillStyle = fadeRight
        ctx.fillRect(ix, iy, imgW, imgH)
        ctx.restore()
    }

    const nameX = splashImg ? 320 : PAD

    roundRect(ctx, nameX, 32, 110, 28, 14)
    ctx.fillStyle = hexAlpha(ec, 0.25)
    ctx.fill()
    roundRect(ctx, nameX, 32, 110, 28, 14)
    ctx.strokeStyle = hexAlpha(ec, 0.7)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = ec
    ctx.textAlign = 'center'
    ctx.fillText(`${data.elementEmoji} ${data.element}`, nameX + 55, 51)
    ctx.textAlign = 'left'

    ctx.font = 'bold 22px sans-serif'
    ctx.fillStyle = '#FFD700'
    ctx.fillText('★'.repeat(data.rarity), nameX, 96)
    if (data.rarity < 5) {
        ctx.fillStyle = '#444'
        ctx.fillText('★'.repeat(5 - data.rarity), nameX + data.rarity * 22, 96)
    }

    ctx.font = 'bold 58px sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = hexAlpha(ec, 0.5)
    ctx.shadowBlur = 20
    ctx.fillText(data.name, nameX, 162)
    ctx.shadowBlur = 0

    ctx.font = '16px sans-serif'
    ctx.fillStyle = '#AAB4BE'
    ctx.fillText(`🗡️ ${data.weapon}   🏛️ ${data.nation}   🎂 ${data.birthday}`, nameX, 192)

    roundRect(ctx, nameX, 206, 280, 32, 6)
    ctx.fillStyle = hexAlpha(ec, 0.18)
    ctx.fill()
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = ec
    ctx.fillText(`⚔️  ${data.role}`, nameX + 12, 227)

    const buildBadgeX = nameX + 296
    roundRect(ctx, nameX, 248, 220, 28, 6)
    ctx.fillStyle = hexAlpha(build.badgeColor || ec, 0.2)
    ctx.fill()
    roundRect(ctx, nameX, 248, 220, 28, 6)
    ctx.strokeStyle = hexAlpha(build.badgeColor || ec, 0.6)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = build.badgeColor || ec
    ctx.fillText(`${build.badge}  ${build.label}`, nameX + 10, 267)

    ctx.font = '13px sans-serif'
    ctx.fillStyle = hexAlpha('#FFFFFF', 0.4)
    ctx.fillText(`✨ ${data.constellation}`, nameX, 298)

    let y = 330

    ctx.font = '15px sans-serif'
    ctx.fillStyle = hexAlpha('#FFFFFF', 0.65)
    const descLines = wrapText(ctx, data.description, W - PAD * 2)
    descLines.forEach((line, i) => {
        ctx.fillText(line, PAD, y + i * 22)
    })
    y += descLines.length * 22 + 30

    function sectionHeader(title) {
        
        roundRect(ctx, 0, y - 22, W, 36, 0)
        const secBg = ctx.createLinearGradient(0, y - 22, W, y + 14)
        secBg.addColorStop(0, hexAlpha(ec, 0.15))
        secBg.addColorStop(1, 'transparent')
        ctx.fillStyle = secBg
        ctx.fill()

        ctx.fillStyle = ec
        ctx.fillRect(0, y - 22, 4, 36)

        ctx.font = 'bold 17px sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(title, 20, y + 4)
        y += 24
    }

    sectionHeader('⚔️  SENJATA REKOMENDASI')
    y += 8

    const wpnPerRow = 3
    const wpnW = (W - PAD * 2 - (wpnPerRow - 1) * 12) / wpnPerRow
    const wpnH = 72

    build.weapons.forEach((w, i) => {
        const col = i % wpnPerRow
        const row = Math.floor(i / wpnPerRow)
        const wx = PAD + col * (wpnW + 12)
        const wy = y + row * (wpnH + 10)

        roundRect(ctx, wx, wy, wpnW, wpnH, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        roundRect(ctx, wx, wy, wpnW, wpnH, 10)
        ctx.strokeStyle = w.stars === 5 ? hexAlpha('#FFB300', 0.4) : hexAlpha(ec, 0.2)
        ctx.lineWidth = 1.5
        ctx.stroke()

        const starC = w.stars === 5 ? '#FFB300' : w.stars === 4 ? '#BB86FC' : '#78909C'
        ctx.font = 'bold 13px sans-serif'
        ctx.fillStyle = starC
        ctx.fillText('★'.repeat(w.stars), wx + 12, wy + 20)

        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#E8EDF2'
        const wName = w.name.length > 22 ? w.name.slice(0, 20) + '…' : w.name
        ctx.fillText(wName, wx + 12, wy + 40)

        ctx.font = '12px sans-serif'
        ctx.fillStyle = hexAlpha(ec, 0.85)
        ctx.fillText(w.note, wx + 12, wy + 58)
    })

    y += Math.ceil(build.weapons.length / wpnPerRow) * (wpnH + 10) + 20

    sectionHeader('🏺  ARTIFACT SET')
    y += 8

    roundRect(ctx, PAD, y, W - PAD * 2, 160, 12)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    roundRect(ctx, PAD, y, W - PAD * 2, 160, 12)
    ctx.strokeStyle = hexAlpha(ec, 0.25)
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.font = 'bold 20px sans-serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(build.artifact.name, PAD + 16, y + 30)

    ctx.font = '13px sans-serif'
    ctx.fillStyle = hexAlpha('#FFFFFF', 0.45)
    ctx.fillText(`📍 ${build.artifact.set}`, PAD + 16, y + 52)

    const bW = (W - PAD * 2 - 36) / 2
    roundRect(ctx, PAD + 16, y + 64, bW, 34, 6)
    ctx.fillStyle = hexAlpha(ec, 0.12)
    ctx.fill()
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = ec
    ctx.fillText('2pc: ' + build.artifact.bonus2, PAD + 24, y + 82)

    roundRect(ctx, PAD + 20 + bW, y + 64, bW, 34, 6)
    ctx.fillStyle = hexAlpha(ec, 0.12)
    ctx.fill()
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = ec
    const b4text = build.artifact.bonus4.length > 58 ? build.artifact.bonus4.slice(0, 56) + '…' : build.artifact.bonus4
    ctx.fillText('4pc: ' + b4text, PAD + 28 + bW, y + 82)

    ctx.font = '13px sans-serif'
    ctx.fillStyle = hexAlpha('#FFFFFF', 0.5)
    const altLines = wrapText(ctx, '🔄 Alt: ' + build.artifact.alt, W - PAD * 2 - 32)
    altLines.forEach((line, li) => ctx.fillText(line, PAD + 16, y + 108 + li * 18))

    y += 176

    sectionHeader('📊  MAIN STATS ARTIFACT')
    y += 8

    const slotData = [
        { icon: '⏳', name: 'Sands', val: build.stats.sands },
        { icon: '🏺', name: 'Goblet', val: build.stats.goblet },
        { icon: '🎭', name: 'Circlet', val: build.stats.circlet },
    ]
    const slotW = (W - PAD * 2 - 24) / 3
    const slotH = 76

    slotData.forEach((s, i) => {
        const sx = PAD + i * (slotW + 12)

        roundRect(ctx, sx, y, slotW, slotH, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        roundRect(ctx, sx, y, slotW, slotH, 10)
        ctx.strokeStyle = hexAlpha(ec, 0.3)
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.font = 'bold 13px sans-serif'
        ctx.fillStyle = hexAlpha(ec, 0.8)
        ctx.fillText(`${s.icon} ${s.name}`, sx + 12, y + 22)

        ctx.font = 'bold 16px sans-serif'
        ctx.fillStyle = '#FFFFFF'
        const vLines = wrapText(ctx, s.val, slotW - 24)
        vLines.forEach((vl, vi) => ctx.fillText(vl, sx + 12, y + 44 + vi * 18))
    })

    y += slotH + 14

    roundRect(ctx, PAD, y, W - PAD * 2, 46, 10)
    ctx.fillStyle = hexAlpha(ec, 0.08)
    ctx.fill()
    roundRect(ctx, PAD, y, W - PAD * 2, 46, 10)
    ctx.strokeStyle = hexAlpha(ec, 0.25)
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = hexAlpha(ec, 0.8)
    ctx.fillText('📌 Sub-stats priority:', PAD + 16, y + 18)

    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#E8EDF2'
    ctx.fillText(build.stats.sub.join('  >  '), PAD + 16, y + 38)

    y += 62

    sectionHeader('📈  STAT REQUIREMENTS')
    y += 8

    const reqs = Object.entries(build.requirements)
    const reqW = (W - PAD * 2 - (reqs.length - 1) * 12) / reqs.length

    reqs.forEach(([key, val], i) => {
        const rx = PAD + i * (reqW + 12)
        roundRect(ctx, rx, y, reqW, 54, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fill()
        roundRect(ctx, rx, y, reqW, 54, 10)
        ctx.strokeStyle = hexAlpha(ec, 0.2)
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.font = '12px sans-serif'
        ctx.fillStyle = hexAlpha('#FFFFFF', 0.45)
        ctx.fillText(key.toUpperCase(), rx + 12, y + 18)

        ctx.font = 'bold 18px sans-serif'
        ctx.fillStyle = ec
        ctx.fillText(val, rx + 12, y + 40)
    })

    y += 70

    sectionHeader('🔄  ROTASI / COMBO')
    y += 8

    roundRect(ctx, PAD, y, W - PAD * 2, 46, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#E8EDF2'
    const rotLines = wrapText(ctx, build.rotation, W - PAD * 2 - 24)
    rotLines.forEach((rl, ri) => ctx.fillText(rl, PAD + 14, y + 20 + ri * 18))

    y += 62

    sectionHeader('💡  TIPS PENTING')
    y += 10

    build.tips.forEach((tip, ti) => {
        const tipY = y + ti * 34

        roundRect(ctx, PAD, tipY, W - PAD * 2, 28, 6)
        ctx.fillStyle = ti % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)'
        ctx.fill()

        ctx.font = 'bold 12px sans-serif'
        ctx.fillStyle = ec
        ctx.fillText(`${ti + 1}`, PAD + 10, tipY + 19)

        ctx.font = '13px sans-serif'
        ctx.fillStyle = '#D0D8E0'
        ctx.fillText(tip, PAD + 28, tipY + 19)
    })

    y += build.tips.length * 34 + 20

    sectionHeader('👥  KOMPOSISI TIM')
    y += 10

    data.teams.forEach((team, ti) => {
        
        roundRect(ctx, PAD, y, W - PAD * 2, 108, 12)
        ctx.fillStyle = 'rgba(255,255,255,0.04)'
        ctx.fill()
        roundRect(ctx, PAD, y, W - PAD * 2, 108, 12)
        ctx.strokeStyle = hexAlpha(ec, 0.2)
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.font = 'bold 14px sans-serif'
        ctx.fillStyle = ec
        ctx.fillText(`Tim ${ti + 1}: ${team.name}`, PAD + 16, y + 22)

        const memW = (W - PAD * 2 - 40) / team.members.length
        team.members.forEach((mem, mi) => {
            const mx = PAD + 16 + mi * (memW + 8)
            const my = y + 32

            roundRect(ctx, mx, my, memW - 8, 60, 8)
            ctx.fillStyle = mem.name === data.name ? hexAlpha(ec, 0.25) : 'rgba(255,255,255,0.06)'
            ctx.fill()

            if (mem.name === data.name) {
                roundRect(ctx, mx, my, memW - 8, 60, 8)
                ctx.strokeStyle = hexAlpha(ec, 0.7)
                ctx.lineWidth = 2
                ctx.stroke()
            }

            ctx.font = mem.name === data.name ? 'bold 15px sans-serif' : '14px sans-serif'
            ctx.fillStyle = mem.name === data.name ? ec : '#E8EDF2'
            ctx.textAlign = 'center'
            ctx.fillText(mem.name, mx + (memW - 8) / 2, my + 24)

            ctx.font = '11px sans-serif'
            ctx.fillStyle = hexAlpha('#FFFFFF', 0.45)
            ctx.fillText(mem.role, mx + (memW - 8) / 2, my + 44)
            ctx.textAlign = 'left'
        })

        y += 120
    })

    y += 10
    ctx.fillStyle = hexAlpha(ec, 0.25)
    ctx.fillRect(PAD, y, W - PAD * 2, 1)
    y += 18

    ctx.font = '13px sans-serif'
    ctx.fillStyle = hexAlpha('#FFFFFF', 0.3)
    ctx.textAlign = 'center'
    ctx.fillText(`© ${config.bot?.name || 'Bot'} • Genshin Impact Build Guide • Data: icy-veins.com / game8.co / HoYoverse`, W / 2, y)
    ctx.textAlign = 'left'
    y += 24

    const botBar = ctx.createLinearGradient(0, 0, W, 0)
    botBar.addColorStop(0, ec)
    botBar.addColorStop(0.5, hexAlpha(ec, 0.4))
    botBar.addColorStop(1, 'transparent')
    ctx.fillStyle = botBar
    ctx.fillRect(0, H - 4, W, 4)

    return canvas.toBuffer('image/png')
}

async function handler(m, { sock }) {
    const input = m.args.join(' ').trim().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/shogun/g, '')
        .trim()

    if (!input) {
        const list = Object.values(BUILD_DB)
            .map(c => `${c.elementEmoji} *${c.name}* — ${c.role}`)
            .join('\n')
        return m.reply(
            `❌ *Masukkan nama karakter!*\n\n` +
            `Penggunaan: \`.build <nama>\`\nContoh: \`.build Freminet\`\n\n` +
            `*📋 Karakter tersedia:*\n${list}\n\n` +
            `> Karakter lain segera ditambahkan!`
        )
    }

    const key = Object.keys(BUILD_DB).find(k => {
        const name = BUILD_DB[k].name.toLowerCase().replace(/\s/g, '')
        return k === input || name === input ||
            input.includes(k) || k.includes(input) ||
            input.includes(name) || name.includes(input)
    })

    if (!key) {
        const list = Object.values(BUILD_DB).map(c => c.name).join(', ')
        return m.reply(
            `❌ Karakter *"${m.args.join(' ')}"* tidak ditemukan!\n\n` +
            `*Tersedia:* ${list}\n\n> Ketik nama dengan benar ya!`
        )
    }

    const data = BUILD_DB[key]
    await m.react('⏳')

    for (let i = 0; i < data.builds.length; i++) {
        try {
            const imgBuf = await generateBuildCard(data, i)

            const isFirst = i === 0
            const caption = isFirst
                ? `${data.elementEmoji} *Build Guide: ${data.name}*\n\n` +
                  `│ Element  : *${data.element}*\n` +
                  `│ Senjata  : *${data.weapon}*\n` +
                  `│ Nation   : *${data.nation}*\n` +
                  `│ Role     : *${data.role}*\n\n` +
                  (data.builds.length > 1
                    ? `📦 Menampilkan *${data.builds.length} build option* untuk ${data.name}`
                    : `✅ Build terbaik berdasarkan meta terkini`)
                : `${data.elementEmoji} *${data.name} — ${data.builds[i].badge} ${data.builds[i].label}*`

            await sock.sendMessage(m.chat, {
                image: imgBuf,
                caption,
                mimetype: 'image/png',
            }, { quoted: m })

            if (i < data.builds.length - 1) await new Promise(r => setTimeout(r, 1000))
        } catch (e) {
            console.error(`[Build] Error build ${i}:`, e.message)
            await m.reply(`❌ Gagal generate gambar build ${i + 1}: ${e.message}`)
        }
    }

    await m.react('✅')
}

export { pluginConfig as config, handler }