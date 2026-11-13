import { decodeJid } from '../../src/lib/ichigo-serialize.js'

const challenges    = new Map()
const leaderboard   = new Map()
const pendingResult = new Map()

const toSC = (t) => t.replace(/[a-zA-Z]/g, c => {
    const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const to   = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ'
    const i = from.indexOf(c)
    return i >= 0 ? to[i] : c
})

const genId = () => Math.random().toString(36).slice(2, 8).toUpperCase()

function getStats(jid) {
    if (!leaderboard.has(jid)) leaderboard.set(jid, { menang: 0, kalah: 0, poin: 0 })
    return leaderboard.get(jid)
}

function updateStats(winnerId, loserId) {
    const w = getStats(winnerId)
    const l = getStats(loserId)
    w.menang += 1
    w.poin   += 10
    l.kalah  += 1
    l.poin    = Math.max(0, l.poin - 5)
}

function getRank(poin) {
    if (poin >= 200) return '🏆 Grandmaster'
    if (poin >= 100) return '💎 Diamond'
    if (poin >= 50)  return '🥇 Gold'
    if (poin >= 20)  return '🥈 Silver'
    return '🥉 Bronze'
}

function isInChallenge(jid) {
    for (const [, c] of challenges) {
        if (c.status !== 'done' && c.status !== 'rejected' && c.status !== 'cancelled') {
            if (c.challenger === jid || c.opponent === jid) return true
        }
    }
    return false
}

function setAutoExpire(id, sock, chat) {
    setTimeout(() => {
        const c = challenges.get(id)
        if (c && c.status === 'pending') {
            c.status = 'cancelled'
            challenges.set(id, c)
            sock.sendMessage(chat, {
                text: `⏰ *Challenge #${id} kedaluwarsa!*\n@${c.challenger.split('@')[0]} tantangan tidak direspons dalam 5 menit.`,
                mentions: [c.challenger]
            })
        }
    }, 5 * 60 * 1000)
}

const pluginConfig = {
    name: '1v1',
    alias: ['tantang1v1'],
    category: 'game',
    description: 'Tantang player lain duel 1v1 CS Elite Free Fire',
    usage: '.1v1 @lawan [nickFF]',
    example: '.1v1 @lawan Hazelight',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const sender   = decodeJid(m.sender || '')
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const opponent = mentions[0]
    const args     = (m.body || '').trim().split(/\s+/).slice(1)
    const nickFF   = args.filter(a => !a.startsWith('@')).join(' ') || null

    if (!opponent)               return m.reply('❌ Tag lawan kamu!\nContoh: *.1v1 @lawan NickFF*')
    if (opponent === sender)     return m.reply('❌ Gabisa tantang diri sendiri bro 💀')
    if (isInChallenge(sender))   return m.reply('⚠️ Kamu masih ada di challenge yang belum selesai!')
    if (isInChallenge(opponent)) return m.reply('⚠️ Lawan kamu masih ada di challenge lain!')

    const id = genId()
    challenges.set(id, {
        id,
        challenger: sender,
        opponent,
        nickChallenger: nickFF,
        nickOpponent: null,
        status: 'pending',
        chat: m.chat,
        roomCode: null,
        pin: null,
        time: Date.now()
    })

    setAutoExpire(id, sock, m.chat)
    m.react('⚔️')

    await sock.sendMessage(m.chat, {
        text:
`╔══════════════════════╗
║  ⚔️  ${toSC('1v1 Challenge FF')}  ║
╚══════════════════════╝

@${sender.split('@')[0]} menantang @${opponent.split('@')[0]} untuk duel *1v1 CS Elite!*
${nickFF ? `\n🎮 Nick FF Challenger: *${nickFF}*` : ''}

📌 *ID Challenge:* \`#${id}\`
⏰ Waktu tunggu: *5 menit*

@${opponent.split('@')[0]}, balas dengan:
▸ *.gas [nickFF]* — untuk menerima
▸ *.gamau*        — untuk menolak`,
        mentions: [sender, opponent]
    }, { quoted: m })
}

const pluginConfigTerima = {
    name: 'gas',
    alias: ['accept1v1', 'terima1v1'],
    category: 'game',
    description: 'Terima challenge 1v1 FF',
    usage: '.gas [nickFF]',
    example: '.gas Hazelight',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerTerima(m, { sock }) {
    const sender = decodeJid(m.sender || '')
    const args   = (m.body || '').trim().split(/\s+/).slice(1) 
    const nickFF = args.join(' ') || null

    let id = null
    for (const [cid, c] of challenges) {
        if (c.opponent === sender && c.status === 'pending') {
            id = cid
            break
        }
    }

    if (!id) return m.reply('❌ Tidak ada challenge untukmu yang perlu diterima!')
    const c = challenges.get(id)

    c.nickOpponent = nickFF
    c.status = 'accepted'
    challenges.set(id, c)
    m.react('✅')

    await sock.sendMessage(m.chat, {
        text:
`✅ *Challenge Diterima!*

⚔️ @${c.challenger.split('@')[0]} vs @${c.opponent.split('@')[0]}
📌 ID: \`#${id}\`
${c.nickChallenger ? `🎮 @${c.challenger.split('@')[0]}: *${c.nickChallenger}*\n` : ''}${nickFF ? `🎮 @${c.opponent.split('@')[0]}: *${nickFF}*\n` : ''}
━━━━━━━━━━━━━━━━━
Buat room *CS Elite* di FF, lalu share kodenya:

*.room ${id} <kode_room> <pin>*
Contoh: *.room ${id} ABCDEF 1234*`,
        mentions: [c.challenger, c.opponent]
    }, { quoted: m })
}

const pluginConfigTolak = {
    name: 'gamau',
    alias: ['decline1v1', 'tolak1v1'],
    category: 'game',
    description: 'Tolak challenge 1v1 FF',
    usage: '.gamau',
    example: '.gamau',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerTolak(m, { sock }) {
    const sender = decodeJid(m.sender || '')

    let id = null
    for (const [cid, c] of challenges) {
        if (c.opponent === sender && c.status === 'pending') {
            id = cid
            break
        }
    }

    if (!id) return m.reply('❌ Tidak ada challenge untukmu yang perlu ditolak!')
    const c = challenges.get(id)

    c.status = 'rejected'
    challenges.set(id, c)
    m.react('❌')

    await sock.sendMessage(m.chat, {
        text: `❌ *Challenge Ditolak!*\n\n@${c.opponent.split('@')[0]} menolak tantangan dari @${c.challenger.split('@')[0]}.\n📌 ID: \`#${id}\``,
        mentions: [c.challenger, c.opponent]
    }, { quoted: m })
}

const pluginConfigRoom = {
    name: 'room',
    alias: ['roomff'],
    category: 'game',
    description: 'Share kode room CS Elite FF',
    usage: '.room <id> <kode_room> <pin>',
    example: '.room ABC123 XYZABC 1234',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerRoom(m, { sock }) {
    const sender = decodeJid(m.sender || '')
    const args   = (m.body || '').trim().split(/\s+/).slice(1)
    const id     = args[0]?.toUpperCase()
    const kode   = args[1]
    const pin    = args[2] || '-'

    if (!id || !challenges.has(id)) return m.reply('❌ ID challenge tidak ditemukan!')
    const c = challenges.get(id)
    if (c.challenger !== sender && c.opponent !== sender) return m.reply('❌ Kamu bukan peserta challenge ini!')
    if (c.status !== 'accepted') return m.reply('❌ Challenge belum diterima atau sudah selesai.')
    if (!kode) return m.reply('❌ Sertakan kode room!\nContoh: *.room ABC123 XYZABC 1234*')

    c.status   = 'playing'
    c.roomCode = kode
    c.pin      = pin
    challenges.set(id, c)
    m.react('🎮')

    await sock.sendMessage(m.chat, {
        text:
`🎮 *Room CS Elite Siap!*

⚔️ @${c.challenger.split('@')[0]} vs @${c.opponent.split('@')[0]}
📌 ID: \`#${id}\`
━━━━━━━━━━━━━━━━━
🏠 Kode Room : *${kode}*
🔐 PIN Room  : *${pin}*
━━━━━━━━━━━━━━━━━
🕹️ Mode: *Custom Squad Elite | 1v1*
⚠️ Jangan share ke orang lain!

Setelah selesai, lapor hasil:
▸ *.hasilmenang ${id}* — kamu yang menang
▸ *.hasilkalah ${id}*  — kamu yang kalah

*Kedua pemain harus konfirmasi!*`,
        mentions: [c.challenger, c.opponent]
    }, { quoted: m })
}

const pluginConfigMenang = {
    name: 'hasilmenang',
    alias: ['winff'],
    category: 'game',
    description: 'Lapor kamu menang di duel 1v1 FF',
    usage: '.hasilmenang <id>',
    example: '.hasilmenang ABC123',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const pluginConfigKalah = {
    name: 'hasilkalah',
    alias: ['loseff'],
    category: 'game',
    description: 'Lapor kamu kalah di duel 1v1 FF',
    usage: '.hasilkalah <id>',
    example: '.hasilkalah ABC123',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerHasil(m, { sock }, isWin) {
    const sender = decodeJid(m.sender || '')
    const id     = (m.body || '').trim().split(/\s+/)[1]?.toUpperCase()

    if (!id || !challenges.has(id)) return m.reply('❌ ID challenge tidak ditemukan!')
    const c = challenges.get(id)
    if (c.challenger !== sender && c.opponent !== sender) return m.reply('❌ Kamu bukan peserta challenge ini!')
    if (c.status !== 'playing') return m.reply('❌ Duel belum dimulai atau sudah selesai.')

    const winner = isWin ? sender : (sender === c.challenger ? c.opponent : c.challenger)
    const loser  = winner === c.challenger ? c.opponent : c.challenger

    if (!pendingResult.has(id)) {
        pendingResult.set(id, { reportedBy: sender, winner, loser })
        const lawan = sender === c.challenger ? c.opponent : c.challenger
        m.react('📋')

        await sock.sendMessage(m.chat, {
            text:
`📋 *Laporan Hasil Diterima!*

📌 ID: \`#${id}\`
🏆 Dilaporkan pemenang: @${winner.split('@')[0]}

⏳ Menunggu konfirmasi dari @${lawan.split('@')[0]}...
Ketik *.hasilmenang ${id}* atau *.hasilkalah ${id}*`,
            mentions: [winner, lawan]
        }, { quoted: m })
    } else {
        const prev = pendingResult.get(id)

        if (prev.reportedBy === sender) return m.reply('⚠️ Kamu sudah lapor duluan, tunggu konfirmasi lawan!')

        if (prev.winner === winner) {
            c.status = 'done'
            challenges.set(id, c)
            pendingResult.delete(id)

            updateStats(winner, loser)
            const ws = getStats(winner)
            const ls = getStats(loser)
            m.react('🏆')

            await sock.sendMessage(m.chat, {
                text:
`╔══════════════════════╗
║  🏆  ${toSC('Hasil 1v1 FF')}     ║
╚══════════════════════╝

⚔️ @${c.challenger.split('@')[0]} vs @${c.opponent.split('@')[0]}
📌 ID: \`#${id}\`
━━━━━━━━━━━━━━━━━
🏆 *MENANG:* @${winner.split('@')[0]}
   ▸ Poin: *+10* (Total: ${ws.poin})
   ▸ Rank: ${getRank(ws.poin)}
   ▸ Rekord: ${ws.menang}W / ${ws.kalah}L

💀 *KALAH:* @${loser.split('@')[0]}
   ▸ Poin: *-5* (Total: ${ls.poin})
   ▸ Rank: ${getRank(ls.poin)}
   ▸ Rekord: ${ls.menang}W / ${ls.kalah}L
━━━━━━━━━━━━━━━━━
GG WP! Lihat ranking: *.lb1v1*`,
                mentions: [winner, loser]
            }, { quoted: m })
        } else {
            c.status = 'dispute'
            challenges.set(id, c)
            pendingResult.delete(id)
            m.react('⚠️')

            await sock.sendMessage(m.chat, {
                text:
`⚠️ *Hasil Tidak Sesuai!*

📌 ID: \`#${id}\`
@${c.challenger.split('@')[0]} dan @${c.opponent.split('@')[0]} melaporkan hasil berbeda.

📢 Admin, tolong resolusi dengan:
*.resolusi ${id} @pemenang*`,
                mentions: [c.challenger, c.opponent]
            }, { quoted: m })
        }
    }
}

async function handlerMenang(m, { sock }) { return handlerHasil(m, { sock }, true) }
async function handlerKalah(m, { sock })  { return handlerHasil(m, { sock }, false) }

const pluginConfigResolusi = {
    name: 'resolusi',
    alias: ['resolve1v1'],
    category: 'game',
    description: '[Admin] Resolusi dispute hasil 1v1 FF',
    usage: '.resolusi <id> @pemenang',
    example: '.resolusi ABC123 @pemenang',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerResolusi(m, { sock, isAdmin }) {
    if (!isAdmin) return m.reply('❌ Hanya admin yang bisa resolusi dispute!')
    const args     = (m.body || '').trim().split(/\s+/).slice(1)
    const id       = args[0]?.toUpperCase()
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const winner   = mentions[0]

    if (!id || !challenges.has(id)) return m.reply('❌ ID challenge tidak ditemukan!')
    const c = challenges.get(id)
    if (c.status !== 'dispute') return m.reply('❌ Challenge ini tidak dalam status dispute!')
    if (!winner) return m.reply('❌ Tag siapa yang menang!\nContoh: *.resolusi ABC123 @pemenang*')
    if (winner !== c.challenger && winner !== c.opponent) return m.reply('❌ User itu bukan peserta challenge ini!')

    const loser = winner === c.challenger ? c.opponent : c.challenger
    c.status = 'done'
    challenges.set(id, c)
    pendingResult.delete(id)

    updateStats(winner, loser)
    const ws = getStats(winner)
    const ls = getStats(loser)
    m.react('⚖️')

    await sock.sendMessage(m.chat, {
        text:
`⚖️ *Resolusi Admin*

📌 ID: \`#${id}\`
✅ Admin memutuskan pemenang: @${winner.split('@')[0]}

🏆 @${winner.split('@')[0]}: +10 poin (Total: ${ws.poin}) | ${getRank(ws.poin)}
💀 @${loser.split('@')[0]}: -5 poin (Total: ${ls.poin}) | ${getRank(ls.poin)}`,
        mentions: [winner, loser, m.sender]
    }, { quoted: m })
}

const pluginConfigLB = {
    name: 'lb1v1',
    alias: ['leaderboard1v1', 'top1v1'],
    category: 'game',
    description: 'Lihat leaderboard 1v1 FF grup',
    usage: '.lb1v1',
    example: '.lb1v1',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

async function handlerLB(m, { sock }) {
    if (!leaderboard.size) return m.reply('📭 Belum ada data leaderboard!\nMain dulu dengan *.1v1 @lawan*')

    const sorted = [...leaderboard.entries()]
        .sort((a, b) => b[1].poin - a[1].poin)
        .slice(0, 10)

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
    const rows   = sorted.map(([jid, s], i) =>
        `${medals[i]} @${jid.split('@')[0]}\n   ${getRank(s.poin)} | ${s.poin} poin | ${s.menang}W ${s.kalah}L`
    ).join('\n\n')

    await sock.sendMessage(m.chat, {
        text:
`╔══════════════════════╗
║  🏆  ${toSC('Leaderboard 1v1 FF')} ║
╚══════════════════════╝

${rows}

━━━━━━━━━━━━━━━━━
🎮 Menang: *+10 poin* | Kalah: *-5 poin*
━━━━━━━━━━━━━━━━━`,
        mentions: sorted.map(([jid]) => jid)
    }, { quoted: m })
}

const pluginConfigStat = {
    name: 'statff',
    alias: ['stats1v1', 'rank1v1'],
    category: 'game',
    description: 'Lihat statistik 1v1 FF kamu atau user lain',
    usage: '.statff [@user]',
    example: '.statff @user',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerStat(m, { sock }) {
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target   = mentions[0] || decodeJid(m.sender || '')
    const s        = getStats(target)
    const total    = s.menang + s.kalah
    const wr       = total > 0 ? ((s.menang / total) * 100).toFixed(1) : '0.0'

    await sock.sendMessage(m.chat, {
        text:
`╔══════════════════════╗
║  📊  ${toSC('Statistik 1v1 FF')}  ║
╚══════════════════════╝

👤 @${target.split('@')[0]}
━━━━━━━━━━━━━━━━━
🏅 Rank     : ${getRank(s.poin)}
💰 Poin     : ${s.poin}
🏆 Menang   : ${s.menang}
💀 Kalah    : ${s.kalah}
🎮 Total    : ${total} game
📈 Win Rate : ${wr}%
━━━━━━━━━━━━━━━━━`,
        mentions: [target]
    }, { quoted: m })
}

const pluginConfigCek = {
    name: 'cek1v1',
    alias: ['cekchallenge'],
    category: 'game',
    description: 'Cek status challenge 1v1 FF',
    usage: '.cek1v1 <id>',
    example: '.cek1v1 ABC123',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerCek(m) {
    const id = (m.body || '').trim().split(/\s+/)[1]?.toUpperCase()
    if (!id || !challenges.has(id)) return m.reply('❌ ID challenge tidak ditemukan!')
    const c = challenges.get(id)

    const statusMap = {
        pending:   '⏳ Menunggu jawaban lawan',
        accepted:  '✅ Diterima, belum setup room',
        playing:   '🎮 Sedang berlangsung',
        done:      '🏁 Selesai',
        rejected:  '❌ Ditolak',
        cancelled: '🚫 Dibatalkan / Kedaluwarsa',
        dispute:   '⚠️ Dispute — tunggu admin'
    }

    m.reply(
`📋 *Info Challenge #${id}*

⚔️ Challenger : @${c.challenger.split('@')[0]}
🎯 Opponent   : @${(c.opponent || '-').split('@')[0]}
📌 Status     : ${statusMap[c.status] || c.status}
${c.roomCode ? `🏠 Room Code  : *${c.roomCode}*\n🔐 PIN        : *${c.pin}*\n` : ''}⏰ Dibuat     : ${new Date(c.time).toLocaleString('id-ID')}`)
}

const pluginConfigBatal = {
    name: 'batal1v1',
    alias: ['cancel1v1'],
    category: 'game',
    description: 'Batalkan challenge 1v1 FF (challenger/admin)',
    usage: '.batal1v1 <id>',
    example: '.batal1v1 ABC123',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handlerBatal(m, { sock, isAdmin }) {
    const sender = decodeJid(m.sender || '')
    const id     = (m.body || '').trim().split(/\s+/)[1]?.toUpperCase()

    if (!id || !challenges.has(id)) return m.reply('❌ ID challenge tidak ditemukan!')
    const c = challenges.get(id)
    if (!isAdmin && c.challenger !== sender) return m.reply('❌ Hanya challenger atau admin yang bisa membatalkan!')
    if (c.status === 'done') return m.reply('❌ Challenge sudah selesai.')

    c.status = 'cancelled'
    challenges.set(id, c)
    pendingResult.delete(id)
    m.react('🚫')

    await sock.sendMessage(m.chat, {
        text: `🚫 *Challenge #${id} Dibatalkan*\n\nOleh: @${sender.split('@')[0]}`,
        mentions: [sender, c.challenger, c.opponent].filter(Boolean)
    }, { quoted: m })
}

export {
    pluginConfig         as config,          handler,
    pluginConfigTerima   as configTerima,    handlerTerima   as gas,
    pluginConfigTolak    as configTolak,     handlerTolak    as gamau,
    pluginConfigRoom     as configRoom,      handlerRoom     as room,
    pluginConfigMenang   as configMenang,    handlerMenang   as hasilmenang,
    pluginConfigKalah    as configKalah,     handlerKalah    as hasilkalah,
    pluginConfigResolusi as configResolusi,  handlerResolusi as resolusi,
    pluginConfigLB       as configLB,        handlerLB       as lb1v1,
    pluginConfigStat     as configStat,      handlerStat     as statff,
    pluginConfigCek      as configCek,       handlerCek      as cek1v1,
    pluginConfigBatal    as configBatal,     handlerBatal    as batal1v1
}