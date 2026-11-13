import { getUnifiedLog, getKoinStat, getExpStat } from "../../src/lib/ichigo-koin-log.js"
import { getDatabase } from "../../src/lib/ichigo-database.js"

const pluginConfig = {
    name: "riwayat",
    alias: ["history", "mutasi", "logkoin", "transaksi", "logexp"],
    category: "rpg",
    description: "Lihat riwayat & sumber koin/EXP kamu",
    usage: ".riwayat [@user] [log|stat] [koin|exp]",
    example: ".riwayat\n.riwayat stat\n.riwayat log exp\n.riwayat stat koin",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true,
}

function formatWaktu(ts) {
    const diff  = Date.now() - ts
    const menit = Math.floor(diff / 60000)
    const jam   = Math.floor(diff / 3600000)
    const hari  = Math.floor(diff / 86400000)
    if (menit < 1)  return "baru saja"
    if (menit < 60) return `${menit} menit lalu`
    if (jam < 24)   return `${jam} jam lalu`
    if (hari < 7)   return `${hari} hari lalu`
    const d = new Date(ts)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function idr(n) {
    return Math.abs(n).toLocaleString("id-ID")
}

function buildHeader(target, user) {
    const koin  = (user?.koin ?? 0).toLocaleString("id-ID")
    const exp   = (user?.exp  ?? 0).toLocaleString("id-ID")
    const level = user?.rpg?.level ?? user?.level ?? 1
    let txt  = `╭─▣「 📜 *RIWAYAT* 」\n`
    txt     += `│ 👤 @${target.split("@")[0]}\n`
    txt     += `│ 💰 Koin   : Rp ${koin}\n`
    txt     += `│ ⭐ EXP    : ${exp}\n`
    txt     += `│ 🏅 Level  : ${level}\n`
    txt     += `├────────────────────▣\n`
    return txt
}

function buildLog(target, user, filter) {
    const logs = getUnifiedLog(target, 15, filter)
    const filterLabel = filter === "koin" ? "💰 Koin" : filter === "exp" ? "⭐ EXP" : "💰 Koin & ⭐ EXP"

    let txt  = buildHeader(target, user)
    txt     += `│ 🔍 Filter: ${filterLabel}\n`
    txt     += `├────────────────────▣\n`

    if (logs.length === 0) {
        txt += `│ Belum ada riwayat.\n`
    } else {
        for (const log of logs) {
            const waktu = formatWaktu(log.t)
            if (log.type === "koin") {
                const icon  = log.a > 0 ? "🟢" : "🔴"
                const tanda = log.a > 0 ? "+" : "-"
                txt += `│ ${icon} 💰 *${tanda}Rp ${idr(log.a)}*\n`
                txt += `│   📌 ${log.k}  ·  🕐 ${waktu}\n`
                txt += `│   💼 Saldo: Rp ${idr(log.s ?? 0)}\n│\n`
            } else {
                txt += `│ 🔵 ⭐ *+${idr(log.a)} EXP*\n`
                txt += `│   📌 ${log.k}  ·  🕐 ${waktu}\n`
                txt += `│   📊 Total EXP: ${idr(log.e ?? 0)}\n│\n`
            }
        }
    }

    txt += `╰────────────────────▣`
    return txt
}

function buildStat(target, user, filter) {
    const koinStat = filter !== "exp"  ? getKoinStat(target) : null
    const expStat  = filter !== "koin" ? getExpStat(target)  : null

    let txt = buildHeader(target, user)

    if (koinStat) {
        const entries = Object.entries(koinStat)
        txt += `│ 💰 *SUMBER KOIN*\n`
        if (entries.length === 0) {
            txt += `│   Belum ada data.\n`
        } else {
            entries.sort((a, b) => (b[1].masuk - b[1].keluar) - (a[1].masuk - a[1].keluar))
            for (const [sumber, s] of entries) {
                const net   = s.masuk - s.keluar
                const icon  = net >= 0 ? "🟢" : "🔴"
                const tanda = net >= 0 ? "+" : "-"
                txt += `│  ${icon} *${sumber}* (${s.count}x)\n`
                if (s.masuk  > 0) txt += `│     ↑ Masuk : Rp ${idr(s.masuk)}\n`
                if (s.keluar > 0) txt += `│     ↓ Keluar: Rp ${idr(s.keluar)}\n`
                txt += `│     Net: ${tanda}Rp ${idr(Math.abs(net))}\n`
            }
        }
        txt += `├────────────────────▣\n`
    }

    if (expStat) {
        const entries = Object.entries(expStat)
        txt += `│ ⭐ *SUMBER EXP*\n`
        if (entries.length === 0) {
            txt += `│   Belum ada data.\n`
        } else {
            entries.sort((a, b) => b[1].masuk - a[1].masuk)
            for (const [sumber, s] of entries) {
                txt += `│  🔵 *${sumber}* (${s.count}x)\n`
                txt += `│     ↑ Total: ${idr(s.masuk)} EXP\n`
            }
        }
    }

    txt += `╰────────────────────▣`
    return txt
}

async function handler(m, { sock }) {
    const botJid = sock.user?.id?.replace(/:.*@/, "@") || ""
    const args   = (m.args || []).map(a => a.toLowerCase())

    const mode   = args.includes("stat") ? "stat" : "log"
    const filter = args.includes("koin") ? "koin"
                 : args.includes("exp")  ? "exp"
                 : "all"

    const mentionedTarget = m.mentionedJid?.[0]
    const target = (mentionedTarget && mentionedTarget !== botJid)
        ? mentionedTarget
        : m.sender

    const db   = getDatabase()
    const user = db.getUser(target)

    const txt = mode === "stat"
        ? buildStat(target, user, filter)
        : buildLog(target, user, filter)

    await m.reply(txt, { mentions: [target] })
}

export { pluginConfig as config, handler }