import { getDatabase } from "../../src/lib/ichigo-database.js";
import { addExpWithLevelCheck } from "../../src/lib/ichigo-level.js";
import { calculateLevel } from "../../plugins/user/level.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
    name: "kyubigame",
    alias: ["kyubi", "naruto", "shinobi"],
    category: "game",
    description: "Jelajahi dunia shinobi dan hadapi musuh Ninja terkuat",
    usage: ".kyubigame",
    example: ".kyubigame",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 0,
    isEnabled: true,
};

const LOCATIONS = [
    {
        id: 1,
        name: "🍃 Desa Konoha",
        levelReq: 1,
        monsters: [
            "Genin Pemula",
            "Bandit Liar",
            "Anjing Hutan",
            "Ninja Pengintai",
        ],
        minReward: 100,
        maxReward: 300,
        dropChance: 40,
    },
    {
        id: 2,
        name: "🌳 Hutan Kematian",
        levelReq: 5,
        monsters: [
            "Ninja Otogakure",
            "Harimau Raksasa",
            "Lipan Racun",
            "Ular Orochimaru",
        ],
        minReward: 250,
        maxReward: 500,
        dropChance: 45,
    },
    {
        id: 3,
        name: "☁️ Padang Petir",
        levelReq: 10,
        monsters: [
            "Ninja Kumo",
            "Samurai Besi",
            "Burung Hantu Petir",
            "Serigala Listrik",
        ],
        minReward: 400,
        maxReward: 800,
        dropChance: 50,
    },
    {
        id: 4,
        name: "🦇 Gua Akatsuki",
        levelReq: 15,
        monsters: [
            "Klon Zetsu Putih",
            "Kelelawar Beracun",
            "Boneka Sasori",
            "Ninja Pelarian",
        ],
        minReward: 600,
        maxReward: 1200,
        dropChance: 55,
    },
    {
        id: 5,
        name: "🌊 Lembah Akhir",
        levelReq: 25,
        monsters: [
            "Ninja Pembunuh",
            "Mizukage Klon",
            "Uchiha Hantu",
            "Patung Golem",
        ],
        minReward: 900,
        maxReward: 1700,
        dropChance: 60,
    },
    {
        id: 6,
        name: "💥 Medan Perang Shinobi",
        levelReq: 35,
        monsters: [
            "Zetsu Raksasa",
            "Edo Tensei Kage",
            "Shinobi Undead",
            "Pasukan Klon",
        ],
        minReward: 1300,
        maxReward: 2400,
        dropChance: 65,
    },
    {
        id: 7,
        name: "🦊 Kurama's Cage",
        levelReq: 50,
        monsters: [
            "Chakra Ekor Sembilan",
            "Kyubi Liar",
            "Kurama Kegelapan",
            "Roh Bijuu",
        ],
        minReward: 2500,
        maxReward: 4500,
        dropChance: 75,
    },
    {
        id: 8,
        name: "🌑 Markas Akatsuki",
        levelReq: 75,
        monsters: [
            "Pain Rinnegan",
            "Konan Kertas",
            "Kisame Hoshigaki",
            "Itachi Uchiha",
        ],
        minReward: 5000,
        maxReward: 9000,
        dropChance: 80,
    },
    {
        id: 9,
        name: "🔥 Medan Perang Shinobi Dunia",
        levelReq: 100,
        monsters: [
            "Madara Uchiha",
            "Edo Tensei Hokage",
            "Obito Bertopeng",
            "Pasukan Shinobi Aliansi",
        ],
        minReward: 10000,
        maxReward: 20000,
        dropChance: 90,
    },
    {
        id: 10,
        name: "🌀 Dimensi Kaguya",
        levelReq: 150,
        monsters: [
            "Kaguya Otsutsuki",
            "Tentara Zetsu Hitam",
            "Getsuga Dimensi",
            "Roh Chakra Purba",
        ],
        minReward: 25000,
        maxReward: 50000,
        dropChance: 100,
    },
    {
        id: 11,
        name: "🗡️ Penjara Shinobi Abadi",
        levelReq: 200,
        monsters: [
            "Narapidana Jonin",
            "Penjaga Rahasia",
            "Samurai Hantu",
            "Kimimaro Reinkarnasi",
        ],
        minReward: 60000,
        maxReward: 120000,
        dropChance: 110,
    },
    {
        id: 12,
        name: "⚡ Gerbang Petir Kumogakure",
        levelReq: 250,
        monsters: [
            "Raikage Klon",
            "Killerbee Amuk",
            "Samurai Petir",
            "Bijuu Hachibi Liar",
        ],
        minReward: 150000,
        maxReward: 300000,
        dropChance: 120,
    },
    {
        id: 13,
        name: "🌊 Kedalaman Kirigakure",
        levelReq: 300,
        monsters: [
            "Tujuh Pedang Kabut",
            "Mizukage Hantu",
            "Hiu Chakra Raksasa",
            "Suigetsu Bayang",
        ],
        minReward: 400000,
        maxReward: 800000,
        dropChance: 130,
    },
    {
        id: 14,
        name: "🏔️ Puncak Iwagakure",
        levelReq: 400,
        monsters: [
            "Tsuchikage Golem",
            "Deidara Klon Ledakan",
            "Raksasa Tanah",
            "Onoki Terbang",
        ],
        minReward: 1000000,
        maxReward: 2000000,
        dropChance: 150,
    },
    {
        id: 15,
        name: "🌸 Reruntuhan Sunagakure",
        levelReq: 500,
        monsters: [
            "Gaara Shukaku Liar",
            "Pasir Iblis",
            "Scorpion Golem",
            "Bayang Kazekage",
        ],
        minReward: 2500000,
        maxReward: 5000000,
        dropChance: 170,
    },
    {
        id: 16,
        name: "👁️ Labirin Infinite Tsukuyomi",
        levelReq: 600,
        monsters: [
            "Ilusi Madara",
            "Klon Mimpi Naruto",
            "Roh Terjebak Genjutsu",
            "Penjaga Tsukuyomi",
        ],
        minReward: 7000000,
        maxReward: 15000000,
        dropChance: 200,
    },
    {
        id: 17,
        name: "🌌 Altar Otsutsuki",
        levelReq: 700,
        monsters: [
            "Momoshiki Otsutsuki",
            "Kinshiki Otsutsuki",
            "Pion Karma",
            "Roh Otsutsuki Purba",
        ],
        minReward: 20000000,
        maxReward: 45000000,
        dropChance: 250,
    },
    {
        id: 18,
        name: "💠 Dimensi Isshiki",
        levelReq: 800,
        monsters: [
            "Isshiki Otsutsuki",
            "Karma Amuk",
            "Klon Sukunahikona",
            "Daikokuten Manifestasi",
        ],
        minReward: 60000000,
        maxReward: 130000000,
        dropChance: 300,
    },
    {
        id: 19,
        name: "🔯 Kuil Para Otsutsuki",
        levelReq: 900,
        monsters: [
            "Shibai Otsutsuki",
            "Daemon Shinju",
            "Penjaga Eida",
            "Makhluk Claw Grimes",
        ],
        minReward: 200000000,
        maxReward: 450000000,
        dropChance: 380,
    },
    {
        id: 20,
        name: "♾️ Inti Pohon Dewa",
        levelReq: 1000,
        monsters: [
            "Ten-Tails Otsutsuki",
            "Manifestasi Chakra Semesta",
            "Dewa Shinobi Sejati",
            "Hagoromo & Hamura",
        ],
        minReward: 600000000,
        maxReward: 1000000000,
        dropChance: 500,
    },
    {
        id: 21,
        name: "🌠 Takhta Otsutsuki Agung",
        levelReq: 1200,
        monsters: [
            "Dewa Otsutsuki Purba",
            "Penjaga Takhta Kosmik",
            "Naga Antar Bintang",
            "Roh Leluhur Shinobi",
        ],
        minReward: 2000000000,
        maxReward: 4000000000,
        dropChance: 600,
    },
    {
        id: 22,
        name: "🔯 Altar Penciptaan Chakra",
        levelReq: 1400,
        monsters: [
            "Arsitek Chakra Pertama",
            "Pemutus Hukum Alam",
            "Otsutsuki Primordial",
            "Sang Pencipta Ninjutsu",
        ],
        minReward: 6000000000,
        maxReward: 12000000000,
        dropChance: 700,
    },
    {
        id: 23,
        name: "🌀 Pusaran Lahirnya Bijuu",
        levelReq: 1600,
        monsters: [
            "Induk Sepuluh Ekor",
            "Anomali Chakra Kosmik",
            "Bijuu Tanpa Nama",
            "Ksatria Nihilisme Shinobi",
        ],
        minReward: 20000000000,
        maxReward: 45000000000,
        dropChance: 800,
    },
    {
        id: 24,
        name: "✨ Cahaya Sebelum Ninjutsu",
        levelReq: 1800,
        monsters: [
            "Bayang Penciptaan Pertama",
            "Malaikat Chakra Tanpa Nama",
            "Kehendak Semesta Shinobi",
            "Sang Cahaya Asal Mula",
        ],
        minReward: 70000000000,
        maxReward: 150000000000,
        dropChance: 900,
    },
    {
        id: 25,
        name: "🪐 Singularitas Shinobi Abadi",
        levelReq: 2000,
        monsters: [
            "Titik Nol Chakra Semesta",
            "Kehampaan Sadar Otsutsuki",
            "Dewa Sebelum Para Dewa",
            "Sang Awal & Akhir Shinobi",
        ],
        minReward: 300000000000,
        maxReward: 600000000000,
        dropChance: 1000,
    },
];

const LOOT_TABLE = [
    { item: "kunai", chance: 40, qty: [2, 5], icon: "🗡️" },
    { item: "shuriken", chance: 35, qty: [3, 6], icon: "⚔️" },
    { item: "chakra", chance: 30, qty: [1, 3], icon: "🌀" },
    { item: "scroll", chance: 15, qty: [1, 2], icon: "📜" },
    { item: "bowlramen", chance: 20, qty: [1, 2], icon: "🍜" },
];

async function handler(m, { sock }) {
    try {
        const db = getDatabase()
        const user = db.getUser(m.sender)

        if (!user.rpg) user.rpg = {}
        if (!user.inventory) user.inventory = {}

        const session = user.rpg.kyubigame_session || null

        const userLevel = calculateLevel(user.exp || 0)
        const maxStamina = user.rpg.maxStamina || 100
        const curStamina = user.rpg.stamina ?? maxStamina

        if (session) {
            return m.reply(
                `⚔️ *SESI SHINOBI MASIH AKTIF*\n\n` +
                `Kamu sedang berada di pertengahan misi!\n` +
                `> Balas chat terakhir bot untuk membatalkan (ketik \`batal\`) atau melanjutkan aksi (ketik \`serang\` / \`lari\`).`
            )
        }

        const available = LOCATIONS.filter(d => userLevel >= d.levelReq)
        if (available.length === 0) {
            return m.reply(`❌ *LEVEL TERLALU RENDAH*\n\n> Level kamu saat ini adalah *${userLevel}*. Kamu butuh minimal level *1* untuk memulai petualangan shinobi.`)
        }

        user.rpg.kyubigame_session = {
            stage: 'lobi',
            time: Date.now()
        }
        db.save()

        let txt = `⛩️ *LOBI SHINOBI*\n\n`
        txt += `📊 *Statistik Shinobi:*\n`
        txt += `> Level: *${userLevel}*\n`
        txt += `> Stamina: *${curStamina}/${maxStamina}*\n`
        txt += `> Energi: *${user.energi ?? 25}*\n\n`
        txt += `Pilih lokasi misi yang ingin kamu jelajahi:\n\n`

        for (const d of LOCATIONS) {
            if (userLevel >= d.levelReq) {
                txt += `🔓 *${d.id}.* ${d.name} (Lv ${d.levelReq}+)\n`
            } else {
                txt += `> 🔒 *${d.id}.* ${d.name} (Butuh Lv ${d.levelReq})\n`
            }
        }
        txt += `\n> 💡 Balas pesan ini dengan *angka* lokasi yang 🔓 (contoh: \`1\`) atau ketik \`batal\` untuk keluar.`

        return m.reply(txt)
    } catch (error) {
        console.error(error)
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

async function kyubigameAnswerHandler(m, sock) {

    if (!m.body) return false

    const db = getDatabase()
    const user = db.getUser(m.sender)

    if (!user || !user.rpg || !user.rpg.kyubigame_session) return false

    const session = user.rpg.kyubigame_session
    const text = m.body.trim().toLowerCase()

    const userLevel = calculateLevel(user.exp || 0)

    if (text === 'batal' || text === 'cancel' || text === 'keluar') {
        delete user.rpg.kyubigame_session
        db.save()
        await m.reply(`🚪 Kamu berhasil keluar dari area misi shinobi dengan selamat.`)
        return true
    }

    if (session.stage === 'lobi') {
        const choiceId = parseInt(text)
        if (isNaN(choiceId)) return false

        const location = LOCATIONS.find(d => d.id === choiceId)

        if (!location) {
            await m.reply(`❌ *PILIHAN TIDAK VALID*\n\n> Lokasi nomor ${choiceId} tidak ditemukan di peta shinobi.`)
            return true
        }

        if (userLevel < location.levelReq) {
            await m.reply(`🔒 *MISI TERKUNCI*\n\n> Level kamu (*Lv ${userLevel}*) belum cukup untuk memasuki *${location.name}*.\n> Kamu butuh minimal *Lv ${location.levelReq}*.`)
            return true
        }

        const staminaCost = 30
        const maxStamina = user.rpg.maxStamina || 100
        user.rpg.stamina = user.rpg.stamina ?? maxStamina

        if (user.rpg.stamina < staminaCost) {
            await m.reply(
                `⚡ *STAMINA TIDAK CUKUP*\n\n` +
                `Kamu butuh setidaknya *${staminaCost} stamina* untuk masuk.\n` +
                `Sisa stamina kamu saat ini hanya *${user.rpg.stamina}/${maxStamina}*.\n\n` +
                `> 💡 *Tips:* Gunakan perintah \`.rest\` atau batalkan dulu (ketik \`batal\`).`
            )
            return true
        }

        user.rpg.stamina -= staminaCost
        const monster = location.monsters[Math.floor(Math.random() * location.monsters.length)]
        const monsterPower = (location.levelReq * 10) + Math.floor(Math.random() * 30)

        user.rpg.kyubigame_session = {
            stage: 'encounter',
            locationId: location.id,
            locationName: location.name,
            levelReq: location.levelReq,
            monster: monster,
            monsterPower: monsterPower,
            maxReward: location.maxReward,
            minReward: location.minReward,
            dropChance: location.dropChance,
            time: Date.now()
        }

        db.save()

        await m.react('⛩️')
        let txt = `⛩️ *MEMASUKI AREA MISI*\n\n`
        txt += `Kamu melangkah perlahan ke dalam *${location.name}*...\n`
        txt += `> ⚡ Stamina berkurang *${staminaCost}* (Sisa: *${user.rpg.stamina}/${maxStamina}*)\n\n`
        txt += `Tiba-tiba, seorang *👹 ${monster}* melesat dari kegelapan dan menghadang jalanmu!\n\n`
        txt += `*⚔️ APA YANG INGIN KAMU LAKUKAN?*\n`
        txt += `> Ketik \`serang\` untuk melawan\n`
        txt += `> Ketik \`lari\` untuk kabur (berisiko)`

        await m.reply(txt)
        return true
    }

    if (session.stage === 'encounter') {
        if (text === 'serang' || text === 'attack' || text === 'lawan') {
            const userPower = (user.rpg.attack || 10) + (userLevel * 4) + Math.floor(Math.random() * 20)
            const isWin = userPower >= session.monsterPower || Math.random() > 0.4

            let reportText = ''

            if (isWin) {
                const expReward = (150 * (session.levelReq / 2)) + Math.floor(Math.random() * 200)
                const ryoReward = Math.floor(Math.random() * (session.maxReward - session.minReward)) + session.minReward

                const droppedItems = []
                for (const loot of LOOT_TABLE) {
                    if ((Math.random() * 100) < (loot.chance * (session.dropChance / 50))) {
                        const qty = Math.floor(Math.random() * (loot.qty[1] - loot.qty[0] + 1)) + loot.qty[0]
                        user.inventory[loot.item] = (user.inventory[loot.item] || 0) + qty
                        droppedItems.push(`${loot.icon} ${loot.item} (x${qty})`)
                    }
                }

                user.koin = (user.koin || 0) + ryoReward

                db.save()
                await addExpWithLevelCheck(sock, m, db, user, expReward)

                reportText += `🎉 *MISI BERHASIL!*\n\n`
                reportText += `Dengan jutsu mematikan, kamu berhasil mengalahkan *${session.monster}*!\n\n`
                reportText += `*🎁 HADIAH YANG DIDAPAT:*\n`
                reportText += `> ✨ EXP: *+${Math.floor(expReward).toLocaleString("id-ID")}*\n`
                reportText += `> 💰 Koin: *+${ryoReward.toLocaleString("id-ID")}*\n`

                if (droppedItems.length > 0) {
                    reportText += `\n*📦 BARANG JARAHAN SHINOBI:*\n`
                    reportText += `> ${droppedItems.join('\n> ')}\n`
                }

                await m.react('🏆')
            } else {
                const ryoLoss = Math.floor((user.koin || 0) * 0.15)
                user.koin = Math.max(0, (user.koin || 0) - ryoLoss)

                const maxHealth = user.rpg.maxHealth || 100
                user.rpg.health = Math.max(1, (user.rpg.health || maxHealth) - 40)

                reportText += `💀 *MISI GAGAL!*\n\n`
                reportText += `Kekuatanmu belum sebanding! *${session.monster}* memukul mundur dirimu dengan telak.\n`
                reportText += `Kamu berhasil menggunakan jutsu substitusi dan merangkak keluar dengan tubuh penuh luka.\n\n`
                reportText += `*💔 KERUGIAN:*\n`
                reportText += `> 💸 Uang jatuh: *-${ryoLoss.toLocaleString("id-ID")} Koin*\n`
                reportText += `> ❤️ Darah berkurang: *-40 HP* (Sisa: *${user.rpg.health}/${maxHealth} HP*)\n\n`
                reportText += `> 💡 *Tips:* Naikan levelmu, makan ramen, atau perkuat jutsumu!`

                await m.react('💀')
            }

            delete user.rpg.kyubigame_session
            db.save()
            await m.reply(reportText)
            return true

        } else if (text === 'lari' || text === 'kabur' || text === 'run') {
            const escapeChance = Math.random() > 0.5
            let reportText = ''

            if (escapeChance) {
                reportText += `🏃‍♂️ *BERHASIL KABUR!*\n\n`
                reportText += `Kamu melemparkan bom asap dan berlari sekuat tenaga. *${session.monster}* kehilangan jejakmu!\n`
                reportText += `Kamu selamat tanpa cedera, tapi petualangan ini sia-sia.`
                await m.react('💨')
            } else {
                const hpLoss = 25
                const maxHealth = user.rpg.maxHealth || 100
                user.rpg.health = Math.max(1, (user.rpg.health || maxHealth) - hpLoss)

                reportText += `💥 *GAGAL KABUR!*\n\n`
                reportText += `Kakimu tersandung jebakan ninja! *${session.monster}* mengejarmu dan mendaratkan serangannya di tubuhmu!\n\n`
                reportText += `*💔 KERUGIAN:*\n`
                reportText += `> ❤️ Darah berkurang: *-${hpLoss} HP* (Sisa: *${user.rpg.health}/${maxHealth} HP*)`
                await m.react('🩸')
            }

            delete user.rpg.kyubigame_session
            db.save()
            await m.reply(reportText)
            return true

        } else {

            await m.reply(
                `❓ *PILIHAN TIDAK DIKENAL*\n\n` +
                `> Ketik \`serang\` untuk melawan musuh.\n` +
                `> Ketik \`lari\` untuk kabur.\n` +
                `> Ketik \`batal\` jika benar-benar menyerah.`
            )
            return true
        }
    }

    return false
}

export { pluginConfig as config, handler, kyubigameAnswerHandler }