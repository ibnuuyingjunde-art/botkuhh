const state = global.fakeTypingState || (global.fakeTypingState = {
    active: false,
    source: null,
    phase: 'idle',
    phaseUntil: 0,
    since: 0,
    token: 0,
    sock: null,
    groups: []
})

const pluginConfig = {
    name: 'faketyping',
    alias: ['faketype', 'ftyping'],
    category: 'owner',
    description: 'Fake typing otomatis di semua grup (ikut aktif saat AFK)',
    usage: '.faketyping <on/off/status>',
    example: '.faketyping on',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const TYPING_MS = [3 * 60 * 1000, 4 * 60 * 1000]
const PAUSE_MS = [2 * 60 * 1000, 3 * 60 * 1000]
const REFRESH_MS = 8000
const GAP_MS = [150, 350]

const rand = (min, max) => Math.floor(min + Math.random() * (max - min))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function formatMs(ms) {
    const s = Math.max(0, Math.round(ms / 1000))
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

async function refreshGroups() {
    try {
        const all = await state.sock.groupFetchAllParticipating()
        state.groups = Object.keys(all || {})
    } catch { }
}

async function sendPresenceAll(type, keepGoing) {
    for (const jid of [...state.groups]) {
        if (!keepGoing()) return
        try {
            await state.sock.sendPresenceUpdate(type, jid)
        } catch { }
        await sleep(rand(GAP_MS[0], GAP_MS[1]))
    }
}

async function runLoop(token) {
    const alive = () => state.active && state.token === token

    while (alive()) {
        await refreshGroups()

        state.phase = 'typing'
        const typingEnd = Date.now() + rand(TYPING_MS[0], TYPING_MS[1])
        state.phaseUntil = typingEnd
        while (alive() && Date.now() < typingEnd) {
            const t0 = Date.now()
            await sendPresenceAll('composing', alive)
            const took = Date.now() - t0
            if (took < REFRESH_MS) await sleep(REFRESH_MS - took)
        }
        if (!alive()) break
        await sendPresenceAll('paused', alive)

        state.phase = 'pause'
        const pauseEnd = Date.now() + rand(PAUSE_MS[0], PAUSE_MS[1])
        state.phaseUntil = pauseEnd
        while (alive() && Date.now() < pauseEnd) await sleep(1000)
    }
}

function startFakeTyping(sock, source = 'manual') {
    state.sock = sock
    if (state.active) {
        if (source === 'manual') state.source = 'manual'
        return false
    }
    state.active = true
    state.source = source
    state.since = Date.now()
    state.token += 1
    runLoop(state.token).catch(() => { })
    return true
}

function stopFakeTyping(source = null) {
    if (!state.active) return false
    if (source && state.source !== source) return false
    state.active = false
    state.token += 1
    state.phase = 'idle'
    const sock = state.sock
    if (sock) {
        sendPresenceAll('paused', () => true).catch(() => { })
    }
    return true
}

function isFakeTypingActive() {
    return state.active
}

function touchFakeTypingSock(sock) {
    if (sock) state.sock = sock
}

async function handler(m, { sock }) {
    if (!m.fromMe) {
        return m.reply(`Hah? Cuma nomor sendiri yang bisa.`)
    }

    const arg = (m.args?.[0] || 'status').toLowerCase()

    if (arg === 'on') {
        const started = startFakeTyping(sock, 'manual')
        await m.react('⌨️')
        return m.reply(
            `⌨️ *Fake Typing ${started ? 'Jalan' : 'Udah Jalan'}*\n\n` +
            `> Ngetik 3-4 menit, terus rehat 2-3 menit. Begitu terus.\n` +
            `> Mau matiin? Tinggal \`${m.prefix}faketyping off\`.`
        )
    }

    if (arg === 'off') {
        const stopped = stopFakeTyping()
        const afkStorage = global.afkStorage
        const afkWasOn = !!afkStorage?.has(m.sender)
        if (afkWasOn) afkStorage.delete(m.sender)
        await m.react(stopped || afkWasOn ? '✅' : '❕')
        if (!stopped && !afkWasOn) return m.reply(`Memang lagi ga jalan kok fake typing-nya.`)
        return m.reply(
            `✅ *Fake Typing Dimatiin*\n\n` +
            `> Fake typing: ${stopped ? 'off' : 'udah off'}\n` +
            `> AFK: ${afkWasOn ? 'ikut off' : 'memang ga aktif'}`
        )
    }

    if (!state.active) {
        return m.reply(
            `⌨️ *Fake Typing*\n\n` +
            `> Status: off\n` +
            `> Aktifin pake \`${m.prefix}faketyping on\` atau \`${m.prefix}afk\`.`
        )
    }

    const phaseName = state.phase === 'typing' ? 'lagi ngetik' : 'lagi istirahat'
    return m.reply(
        `⌨️ *Fake Typing*\n\n` +
        `> Status: on (${state.source === 'afk' ? 'efek AFK' : 'manual'})\n` +
        `> Kondisi: ${phaseName} (sisa ${formatMs(state.phaseUntil - Date.now())})\n` +
        `> Total grup: ${state.groups.length}\n` +
        `> Jalan sejak: ${formatMs(Date.now() - state.since)} lalu`
    )
}

export {
    pluginConfig as config,
    handler,
    startFakeTyping,
    stopFakeTyping,
    isFakeTypingActive,
    touchFakeTypingSock
}