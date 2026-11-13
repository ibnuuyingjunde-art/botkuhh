import fs from 'fs'
import path from 'path'
// javascript-obfuscator dimuat lazy saat dipakai

const pluginConfig = {
    name: 'encfile',
    alias: ['encrypt', 'enfile', 'encript'],
    category: 'tools',
    description: 'Enkripsi file JS tingkat ekstrem (Hard Obfuscation Anti-Bypass)',
    usage: '.encfile (reply file js)',
    example: '.encfile',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 60,
    energi: 15,
    isEnabled: true
}

async function handler(m, { sock, prefix, command }) {
    try {
        
        const steps = [
            { percent: 0, bar: "▒▒▒▒▒▒▒▒▒▒" },
            { percent: 10, bar: "█▒▒▒▒▒▒▒▒▒" },
            { percent: 20, bar: "██▒▒▒▒▒▒▒▒" },
            { percent: 30, bar: "███▒▒▒▒▒▒▒" },
            { percent: 40, bar: "████▒▒▒▒▒▒" },
            { percent: 50, bar: "█████▒▒▒▒▒" },
            { percent: 60, bar: "██████▒▒▒▒" },
            { percent: 70, bar: "███████▒▒▒" },
            { percent: 80, bar: "████████▒▒" },
            { percent: 90, bar: "█████████▒" },
            { percent: 100, bar: "██████████" }
        ]

        const quoted = m.quoted ? m.quoted : (m.msg?.contextInfo?.quotedMessage ? {
            msg: m.msg.contextInfo.quotedMessage,
            download: async () => await sock.downloadMediaMessage(m.msg.contextInfo.quotedMessage)
        } : null)

        if (!quoted) {
            return m.reply(`Hah? Makanya kalau pakai command *${prefix + command}*, file-nya di-reply dulu dong, bodoh!`)
        }

        const qMsg = quoted.msg || quoted
        const originalFilename = qMsg.fileName || qMsg.documentMessage?.fileName || quoted.fileName || `file_${Date.now()}.js`
        const fileExtension = path.extname(originalFilename).toLowerCase()

        if (fileExtension !== '.js' && fileExtension !== '.ts') {
            return m.reply(`Mode *Hard Encrypt Anti-Bypass* khusus untuk file berformat *.js* atau *.ts* ya, bodoh!`)
        }

        await sock.sendMessage(m.chat, { react: { text: "🔃", key: m.key } })

        let initialText = `
⚡ *ULTRA HARD ENCRYPT — LYNIX'S MD* ⚡
> _Menyiapkan enkripsi anti-bypass tingkat lanjut..._

🔐 *Proses Penguncian Skrip*
[ ${steps[0].bar} ] *0%*
> 🔴 Mengunduh file script...
`.trim()

        let msg = await sock.sendMessage(m.chat, { text: initialText }, { quoted: m })

        await new Promise(resolve => setTimeout(resolve, 800))
        
        let mediaBuffer
        try {
            if (typeof quoted.download === 'function') {
                mediaBuffer = await quoted.download()
            } else {
                mediaBuffer = await sock.downloadMediaMessage(quoted)
            }
        } catch (e) {
            console.error("Gagal download:", e)
        }
        
        if (!mediaBuffer) {
            await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } })
            return sock.sendMessage(m.chat, { text: `❌ Gagal mengunduh file-nya! Jangan bikin aku kesal ya.`, edit: msg.key })
        }

        await sock.sendMessage(m.chat, { 
            text: `\n⚡ *ULTRA HARD ENCRYPT — LYNIX'S MD* ⚡\n> _Menerapkan Control Flow Flattening & Dead Code Injection..._\n\n🔐 *Proses Penguncian Skrip*\n[ ${steps[4].bar} ] *40%*\n> 🔴 Mengacak logika struktur kode...\n`.trim(), 
            edit: msg.key 
        })

        const sourceCode = mediaBuffer.toString('utf8')
        await new Promise(resolve => setTimeout(resolve, 1000))

        const JavaScriptObfuscator = (await import('javascript-obfuscator')).default
        const obfuscatedResult = JavaScriptObfuscator.obfuscate(sourceCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 1, 
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4, 
            debugProtection: true, 
            disableConsoleOutput: false,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true, 
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 3,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayCallsTransformThreshold: 1,
            stringArrayEncoding: ['rc4'], 
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 5,
            stringArrayWrappersChainedCalls: true,
            stringArrayWrappersParametersMaxCount: 5,
            stringArrayWrappersType: 'function',
            stringArrayThreshold: 1
        })

        const finalEncryptedBuffer = Buffer.from(obfuscatedResult.getObfuscatedCode(), 'utf8')

        await sock.sendMessage(m.chat, { 
            text: `\n⚡ *ULTRA HARD ENCRYPT — LYNIX'S MD* ⚡\n> _Menanamkan proteksi Anti-Tamper & Self-Defending..._\n\n🔐 *Proses Penguncian Skrip*\n[ ${steps[8].bar} ] *80%*\n> 🟡 Menyelesaikan lapisan enkripsi terakhir...\n`.trim(), 
            edit: msg.key 
        })

        await new Promise(resolve => setTimeout(resolve, 800))

        await sock.sendMessage(m.chat, { 
            text: `\n⚡ *ULTRA HARD ENCRYPT — LYNIX'S MD* ⚡\n> _Enkripsi Ekstrem Selesai!_ \n\n🔐 *Proses Penguncian Skrip*\n[ ${steps[10].bar} ] *100%*\n> 🟢 Berhasil! Mengirim file aman ke chat...\n`.trim(), 
            edit: msg.key 
        })

        const newFilename = `Secure-Hard-${originalFilename}`

        await sock.sendMessage(m.chat, {
            document: finalEncryptedBuffer,
            mimetype: 'application/javascript',
            fileName: newFilename,
            caption: `⚡ *HARD ENCRYPT ANTI-BYPASS BERHASIL* ⚡\n\n📁 Nama File : *${newFilename}*\n🔒 Status    : Terkunci Rapat\n\n_"Kodenu udah aku kunci pakai enkripsi tingkat tinggi. Mau dibongkar pakai cara apapun, tetep bakal pusing sendiri lihatnya!"_\n— lyniX's MD`
        }, { quoted: m })

        await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

    } catch (error) {
        console.error(error)
        await sock.sendMessage(m.chat, { react: { text: "☢", key: m.key } })
        m.reply(`❌ Terjadi kesalahan sistem: ${error.message}`)
    }
}

export { pluginConfig as config, handler }