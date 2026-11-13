import { getDatabase } from '../../src/lib/ichigo-database.js'
import { addKoin } from '../../src/lib/ichigo-koin-log.js'
import { addExpWithLevelCheck } from '../../src/lib/ichigo-level.js'

const pluginConfig = {
    name: 'kuis',
    alias: ['quiz', 'kuisgrup'],
    category: 'game',
    description: 'Kuis berhadiah koin & EXP — cepat jawab, cepat menang!',
    usage: '.kuis [kategori]',
    example: '.kuis sains',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const SOAL = {
    sains: [
        { q: 'Apa simbol kimia untuk air?', a: 'h2o', hint: 'H_O' },
        { q: 'Planet terbesar di tata surya kita?', a: 'jupiter', hint: 'J______' },
        { q: 'Berapa jumlah kromosom manusia normal?', a: '46', hint: '4_' },
        { q: 'Gas apa yang paling banyak di atmosfer bumi?', a: 'nitrogen', hint: 'N_______' },
        { q: 'Apa nama proses tumbuhan membuat makanannya sendiri?', a: 'fotosintesis', hint: 'F__________' },
        { q: 'Berapa kecepatan cahaya (km/s)?', a: '300000', hint: '3_____' },
        { q: 'Organ tubuh manusia yang paling besar?', a: 'kulit', hint: 'K____' },
        { q: 'Apa nama ilmuwan yang menemukan teori relativitas?', a: 'einstein', hint: 'E_______' },
        { q: 'Satuan dasar massa dalam SI?', a: 'kilogram', hint: 'K_______' },
        { q: 'Hewan apa yang memiliki DNA paling mirip dengan manusia?', a: 'simpanse', hint: 'S_______' },
    ],
    sejarah: [
        { q: 'Siapa proklamator kemerdekaan Indonesia?', a: 'soekarno', hint: 'S_______' },
        { q: 'Tahun berapa Indonesia merdeka?', a: '1945', hint: '1___' },
        { q: 'Siapa penemu bola lampu?', a: 'edison', hint: 'E_____' },
        { q: 'Kerajaan Hindu pertama di Indonesia?', a: 'kutai', hint: 'K____' },
        { q: 'Siapa yang menulis buku Bumi Manusia?', a: 'pramoedya', hint: 'P________' },
        { q: 'Perang Dunia II berakhir tahun berapa?', a: '1945', hint: '1___' },
        { q: 'Siapa presiden pertama Amerika Serikat?', a: 'washington', hint: 'W_________' },
        { q: 'Candi terbesar di Indonesia?', a: 'borobudur', hint: 'B________' },
        { q: 'Siapa pahlawan wanita dari Aceh?', a: 'cut nyak dien', hint: 'C__ N__ D__' },
        { q: 'Organisasi pemuda pertama Indonesia tahun 1908?', a: 'budi utomo', hint: 'B___ U____' },
    ],
    olahraga: [
        { q: 'Berapa jumlah pemain sepak bola dalam satu tim di lapangan?', a: '11', hint: '1_' },
        { q: 'Olahraga apa yang menggunakan shuttlecock?', a: 'badminton', hint: 'B________' },
        { q: 'Berapa set dalam pertandingan tenis grand slam pria?', a: '5', hint: '_' },
        { q: 'Siapa pemain bola dengan julukan "La Pulga"?', a: 'messi', hint: 'M____' },
        { q: 'Negara penyelenggara Piala Dunia 2022?', a: 'qatar', hint: 'Q____' },
        { q: 'Olimpiade modern pertama diadakan di kota apa?', a: 'athena', hint: 'A_____' },
        { q: 'Olahraga apa yang dimainkan di Wimbledon?', a: 'tenis', hint: 'T____' },
        { q: 'Berapa poin untuk slam dunk di basket?', a: '2', hint: '_' },
        { q: 'Siapa pelatih timnas Indonesia saat ini (2024)?', a: 'shin tae yong', hint: 'S___ T__ Y___' },
        { q: 'Induk organisasi sepak bola dunia?', a: 'fifa', hint: 'F___' },
    ],
    teknologi: [
        { q: 'Kepanjangan dari CPU?', a: 'central processing unit', hint: 'C______ P_________ U___' },
        { q: 'Siapa pendiri Microsoft?', a: 'bill gates', hint: 'B___ G____' },
        { q: 'Bahasa pemrograman yang dibuat oleh Guido van Rossum?', a: 'python', hint: 'P_____' },
        { q: 'Kepanjangan dari HTML?', a: 'hypertext markup language', hint: 'H________ M_____ L________' },
        { q: 'Siapa CEO Tesla saat ini?', a: 'elon musk', hint: 'E___ M___' },
        { q: 'Sistem operasi mobile yang dikembangkan Google?', a: 'android', hint: 'A_______' },
        { q: 'Kepanjangan dari RAM?', a: 'random access memory', hint: 'R_____ A_____ M_____' },
        { q: 'Perusahaan yang membuat chip M1?', a: 'apple', hint: 'A____' },
        { q: 'Protokol yang digunakan untuk transfer file di internet?', a: 'ftp', hint: 'F__' },
        { q: 'Bahasa pemrograman untuk web yang berjalan di browser?', a: 'javascript', hint: 'J__________' },
    ],
    geografi: [
        { q: 'Ibukota Australia?', a: 'canberra', hint: 'C_______' },
        { q: 'Gunung tertinggi di dunia?', a: 'everest', hint: 'E______' },
        { q: 'Negara terluas di dunia?', a: 'rusia', hint: 'R____' },
        { q: 'Sungai terpanjang di dunia?', a: 'nil', hint: 'N__' },
        { q: 'Benua terkecil di dunia?', a: 'australia', hint: 'A________' },
        { q: 'Ibukota Jepang?', a: 'tokyo', hint: 'T____' },
        { q: 'Negara dengan jumlah penduduk terbanyak di dunia (2024)?', a: 'india', hint: 'I____' },
        { q: 'Danau terbesar di dunia?', a: 'kaspia', hint: 'K_____' },
        { q: 'Ibukota Brasil?', a: 'brasilia', hint: 'B_______' },
        { q: 'Gunung berapi aktif tertinggi di Indonesia?', a: 'kerinci', hint: 'K______' },
    ],
    hiburan: [
        { q: 'Siapa pemeran Iron Man di MCU?', a: 'robert downey jr', hint: 'R_____ D_____ J_' },
        { q: 'Film animasi Disney tentang putri beku?', a: 'frozen', hint: 'F_____' },
        { q: 'Penyanyi lagu "Shape of You"?', a: 'ed sheeran', hint: 'E_ S______' },
        { q: 'Manga/anime tentang ninja dari Konoha?', a: 'naruto', hint: 'N_____' },
        { q: 'Siapa penulis seri Harry Potter?', a: 'j.k. rowling', hint: 'J.K. R______' },
        { q: 'Film dengan pendapatan tertinggi sepanjang masa?', a: 'avatar', hint: 'A_____' },
        { q: 'Aplikasi streaming musik terpopuler?', a: 'spotify', hint: 'S______' },
        { q: 'Anime tentang perburuan titan?', a: 'attack on titan', hint: 'A_____ O_ T____' },
        { q: 'Penyanyi K-Pop dari grup BTS dengan nama panggung "RM"?', a: 'kim namjoon', hint: 'K__ N______' },
        { q: 'Game battle royale buatan PUBG Corporation?', a: 'pubg', hint: 'P___' },
    ],
}

const KATEGORI = Object.keys(SOAL)

const sessions = new Map() 
const WAKTU = 30_000       
const SOAL_PER_GAME = 5
const REWARD_KOIN = { 1: 500, 2: 300, 3: 150 }
const REWARD_EXP  = { 1: 200, 2: 120, 3:  60 }
const REWARD_BENAR_KOIN = 50
const REWARD_BENAR_EXP  = 20

function acakSoal(kategori) {
    const pool = kategori === 'campur'
        ? KATEGORI.flatMap(k => SOAL[k])
        : SOAL[kategori] || []
    const arr = [...pool]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, SOAL_PER_GAME)
}

function normalisasi(str) {
    return String(str ?? '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ')
}

function skorboard(pemain) {
    return [...pemain.entries()]
        .sort((a, b) => b[1].skor - a[1].skor || a[1].waktu - b[1].waktu)
        .map(([jid, data], i) => ({
            rank: i + 1,
            jid,
            nama: data.nama,
            skor: data.skor,
            waktu: data.waktu
        }))
}

function hapusSesi(chatId) {
    const s = sessions.get(chatId)
    if (s) {
        s.selesai = true
        clearTimeout(s.timer)
        // lepas listener cadangan supaya tidak menumpuk
        try { if (s.listener) s.sock?.ev?.off?.('messages.upsert', s.listener) } catch {}
        sessions.delete(chatId)
    }
}

// Jadwalkan langkah berikutnya tanpa menahan handler (tidak ada await sleep di handler)
function jadwal(session, chatId, ms, fn) {
    clearTimeout(session.timer)
    session.timer = setTimeout(async () => {
        if (sessions.get(chatId) !== session || session.selesai) return
        try {
            await fn()
        } catch (e) {
            console.error('[kuis] error:', e)
            hapusSesi(chatId)
        }
    }, ms)
}

function normJid(jid) {
    return String(jid || '').replace(/:\d+@/, '@')
}

// Ambil teks dari pesan mentah Baileys (termasuk balasan/quote, ephemeral, view once)
function ambilTeks(message) {
    if (!message) return ''
    const msg = message.ephemeralMessage?.message
        || message.viewOnceMessage?.message
        || message.viewOnceMessageV2?.message
        || message.documentWithCaptionMessage?.message
        || message
    return msg.conversation
        || msg.extendedTextMessage?.text
        || msg.imageMessage?.caption
        || msg.videoMessage?.caption
        || ''
}

// Ambil teks dari objek m milik framework (nama field bisa berbeda-beda)
function teksDari(m) {
    for (const v of [m.body, m.text, m.msg?.text, m.msg?.conversation, m.message?.conversation, m.message?.extendedTextMessage?.text]) {
        if (typeof v === 'string' && v) return v
    }
    return ambilTeks(m.message)
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const chatId = m.chat
    const arg = m.args?.[0]?.toLowerCase() || 'campur'

    if (sessions.has(chatId)) {
        return m.reply(`⚠️ Kuis sedang berlangsung di grup ini!\nTunggu sampai selesai atau ketik *nyerah* untuk menyerah.`)
    }

    const validKategori = [...KATEGORI, 'campur']
    if (!validKategori.includes(arg)) {
        return m.reply(
            `🎯 *ᴋᴜɪs ʙᴇʀʜᴀᴅɪᴀʜ*\n\n` +
            `Pilih kategori:\n` +
            KATEGORI.map(k => `• \`${m.prefix}kuis ${k}\``).join('\n') +
            `\n• \`${m.prefix}kuis campur\` _(semua kategori)_\n\n` +
            `🏆 Hadiah per soal benar: *${REWARD_BENAR_KOIN} koin + ${REWARD_BENAR_EXP} EXP*\n` +
            `🥇 Juara 1: *${REWARD_KOIN[1]} koin + ${REWARD_EXP[1]} EXP*`
        )
    }

    const soalList = acakSoal(arg)
    const session = {
        kategori: arg,
        starter: m.sender,
        soalList,
        soalIndex: 0,
        pemain: new Map(),
        timer: null,
        selesai: false,
        kunci: true,
        menyerah: false,
        mulai: 0,
        sock,
        baseM: m,
        listener: null
    }
    sessions.set(chatId, session)

    // Listener cadangan: membaca jawaban langsung dari event pesan,
    // jadi kuis tetap jalan walau framework tidak memanggil answerHandler.
    // Aman dobel dengan answerHandler karena ada flag `kunci`.
    if (sock?.ev?.on) {
        session.listener = ({ messages }) => {
            for (const raw of messages || []) {
                try {
                    if (!raw?.message || raw.key?.fromMe) continue
                    if (raw.key?.remoteJid !== chatId) continue
                    const body = ambilTeks(raw.message)
                    if (!body) continue
                    const sender = normJid(raw.key.participantPn || raw.key.participant || '')
                    if (!sender) continue
                    prosesJawaban(chatId, { sender, pushName: raw.pushName, body, raw }, sock)
                        .catch(e => console.error('[kuis] listener error:', e))
                } catch (e) {
                    console.error('[kuis] listener error:', e)
                }
            }
        }
        sock.ev.on('messages.upsert', session.listener)
    }

    try {
        await sock.sendMessage(chatId, {
            text:
                `🎯 *ᴋᴜɪs ʙᴇʀʜᴀᴅɪᴀʜ ᴅɪᴍᴜʟᴀɪ!*\n\n` +
                `📚 Kategori : *${arg.toUpperCase()}*\n` +
                `❓ Jumlah   : *${soalList.length} soal*\n` +
                `⏱️ Waktu    : *${WAKTU / 1000} detik* per soal\n\n` +
                `🏆 *Hadiah:*\n` +
                `🥇 Juara 1 — ${REWARD_KOIN[1]} koin + ${REWARD_EXP[1]} EXP\n` +
                `🥈 Juara 2 — ${REWARD_KOIN[2]} koin + ${REWARD_EXP[2]} EXP\n` +
                `🥉 Juara 3 — ${REWARD_KOIN[3]} koin + ${REWARD_EXP[3]} EXP\n` +
                `✅ Per jawaban benar — ${REWARD_BENAR_KOIN} koin + ${REWARD_BENAR_EXP} EXP\n\n` +
                `> Jawab langsung di chat! Game dimulai dalam 3 detik...`
        }, { quoted: m })
    } catch (e) {
        console.error('[kuis] gagal kirim pesan awal:', e)
        hapusSesi(chatId)
        return
    }

    // soal pertama dikirim 3 detik lagi, handler langsung selesai
    jadwal(session, chatId, 3000, () => kirimSoal(chatId, sock, db, m))
}

async function lanjut(session, chatId, sock, db, m) {
    if (sessions.get(chatId) !== session || session.selesai) return
    session.soalIndex++
    if (session.soalIndex >= session.soalList.length) {
        await selesaiGame(chatId, sock, db, m)
    } else {
        await kirimSoal(chatId, sock, db, m)
    }
}

async function kirimSoal(chatId, sock, db, m) {
    const session = sessions.get(chatId)
    if (!session || session.selesai) return

    const { soalList, soalIndex } = session
    const soal = soalList[soalIndex]
    const nomor = soalIndex + 1

    // buka kunci SEBELUM kirim, supaya jawaban cepat tidak terlewat
    session.kunci = false
    session.mulai = Date.now()

    await sock.sendMessage(chatId, {
        text:
            `❓ *Soal ${nomor}/${soalList.length}*\n\n` +
            `${soal.q}\n\n` +
            `💡 Hint: \`${soal.hint}\`\n` +
            `⏱️ Waktu: *${WAKTU / 1000} detik*`
    })

    // jawaban benar bisa masuk selagi pesan soal dikirim; kalau begitu jangan pasang timer lagi
    if (session.kunci || sessions.get(chatId) !== session || session.selesai) return

    jadwal(session, chatId, WAKTU, async () => {
        if (session.kunci) return
        session.kunci = true

        await sock.sendMessage(chatId, {
            text: `⏰ Waktu habis!\n✅ Jawaban: *${soal.a.toUpperCase()}*`
        })

        jadwal(session, chatId, 2000, () => lanjut(session, chatId, sock, db, m))
    })
}

// Dipanggil framework (kalau didukung)
async function answerHandler(m, { sock }) {
    const body = teksDari(m)
    if (!body) return false
    return prosesJawaban(m.chat, { sender: m.sender, pushName: m.pushName, body, m }, sock)
}

// Logika jawaban, dipakai oleh answerHandler dan listener cadangan
async function prosesJawaban(chatId, { sender, pushName, body, m, raw }, sock) {
    const session = sessions.get(chatId)
    if (!session || session.selesai) return false

    const db = getDatabase()
    const baseM = m || { ...session.baseM, sender, pushName, body, key: raw?.key, message: raw?.message }
    const jawaban = normalisasi(body)

    if (jawaban === 'nyerah') {
        if (sender !== session.starter || session.menyerah) return false
        session.menyerah = true
        session.kunci = true
        clearTimeout(session.timer)
        try {
            await sock.sendMessage(chatId, { text: `🏳️ Kuis dihentikan.` })
            await selesaiGame(chatId, sock, db, baseM)
        } catch (e) {
            console.error('[kuis] error nyerah:', e)
            hapusSesi(chatId)
        }
        return true
    }

    if (session.kunci) return false

    const soal = session.soalList[session.soalIndex]
    if (!soal || jawaban !== normalisasi(soal.a)) return false

    // kunci sebelum await apa pun supaya tidak ada hadiah ganda
    session.kunci = true
    clearTimeout(session.timer)

    const jid = sender
    const nama = pushName || jid.split('@')[0]

    if (!session.pemain.has(jid)) {
        session.pemain.set(jid, { nama, skor: 0, waktu: 0 })
    }
    const pemain = session.pemain.get(jid)
    pemain.skor++
    pemain.waktu += Date.now() - session.mulai

    try {
        addKoin(jid, REWARD_BENAR_KOIN, 'Kuis')
        const user = db.getUser(jid)
        if (user) await addExpWithLevelCheck(sock, baseM, db, user, REWARD_BENAR_EXP)

        await sock.sendMessage(chatId, {
            text:
                `✅ *Benar!* @${jid.split('@')[0]} menjawab dengan tepat!\n` +
                `📖 Jawaban: *${soal.a.toUpperCase()}*\n` +
                `🎁 +${REWARD_BENAR_KOIN} koin +${REWARD_BENAR_EXP} EXP`,
            mentions: [jid]
        })
    } catch (e) {
        console.error('[kuis] error jawaban:', e)
        hapusSesi(chatId)
        return true
    }

    // lanjut ke soal berikutnya 2 detik lagi, tanpa menahan handler
    jadwal(session, chatId, 2000, () => lanjut(session, chatId, sock, db, baseM))

    return true
}

async function selesaiGame(chatId, sock, db, m) {
    const session = sessions.get(chatId)
    if (!session || session.selesai) return
    session.selesai = true
    clearTimeout(session.timer)

    try {
        const board = skorboard(session.pemain)

        if (board.length === 0) {
            await sock.sendMessage(chatId, {
                text: `🎯 *Kuis Selesai!*\n\nTidak ada yang menjawab. Sayang sekali! 😢`
            })
            return
        }

        for (const p of board.slice(0, 3)) {
            const rank = p.rank
            if (REWARD_KOIN[rank]) {
                addKoin(p.jid, REWARD_KOIN[rank], 'Kuis Juara')
                const user = db.getUser(p.jid)

                if (user) {
                    const fakM = { ...m, sender: p.jid, pushName: p.nama }
                    await addExpWithLevelCheck(sock, fakM, db, user, REWARD_EXP[rank])
                }
            }
        }

        const top = board.slice(0, 5)
        const mentions = top.map(p => p.jid)

        const medal = ['🥇', '🥈', '🥉']
        const boardText = top.map((p, i) =>
            `${medal[i] || `${i + 1}.`} @${p.jid.split('@')[0]} — *${p.skor} benar*`
        ).join('\n')

        await sock.sendMessage(chatId, {
            text:
                `🏆 *ᴋᴜɪs sᴇʟᴇsᴀɪ!*\n\n` +
                `📊 *Papan Skor:*\n${boardText}\n\n` +
                `🎁 *Hadiah diberikan ke juara 1-3!*\n` +
                `> Ketik \`${m.prefix}kuis\` untuk main lagi`,
            mentions
        })
    } catch (e) {
        console.error('[kuis] error selesai:', e)
    } finally {
        hapusSesi(chatId)
    }
}

export { pluginConfig as config, handler, answerHandler }