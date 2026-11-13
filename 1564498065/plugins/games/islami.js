import { f } from '../../src/lib/ichigo-http.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'islami',
    alias: ['islamigame', 'tebakislami'],
    category: 'games',
    description: 'Game tebak-tebakan Islami',
    usage: '.islami',
    example: '.islami',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: true,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

const activeSessions = new Map()

async function handler(m) {
    const chatId = m.chat

    if (m.text && activeSessions.has(chatId)) {
        const session = activeSessions.get(chatId)
        const jawaban = m.text.trim().toLowerCase()
        const kunci = session.answer.toLowerCase()

        activeSessions.delete(chatId)

        if (jawaban === kunci) {
            return m.reply(`✅ *Benar!*\n\n🎉 Selamat *${m.pushName}*, jawaban kamu tepat!\n\n💡 *Jawaban:* ${session.answer}`)
        } else {
            return m.reply(`❌ *Salah!*\n\n😢 Jawaban yang benar adalah: *${session.answer}*`)
        }
    }

    m.react('🕕')

    try {
        const data = await f('https://api.nexray.eu.cc/games/islami')

        if (!data?.status) throw new Error('API error')

        const soal = data?.result?.soal ?? data?.result?.pertanyaan ?? data?.result?.question ?? data?.soal
        const jawaban = data?.result?.jawaban ?? data?.result?.answer ?? data?.jawaban

        if (!soal || !jawaban) throw new Error('Field tidak ditemukan: ' + JSON.stringify(data))

        activeSessions.set(chatId, { answer: jawaban })

        setTimeout(() => activeSessions.delete(chatId), 60_000)

        m.react('✅')
        await m.reply(
            `🕌 *TEBAK ISLAMI*\n\n` +
            `❓ *Pertanyaan:*\n${soal}\n\n` +
            `⏳ Ketik jawabanmu dalam 60 detik!`
        )
    } catch (error) {
        console.error('[islami]', error.message)
        m.react('☢')
        m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }