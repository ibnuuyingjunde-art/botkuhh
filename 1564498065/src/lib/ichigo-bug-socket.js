/**
 * Helper Bug Socket & Validasi Target untuk Ourin
 * Path: src/lib/ourin-bug-socket.js
 */

export function getSocket(m, sock, conn) {
    const cli = conn || sock || m.sock || global.sock || global.conn
    return cli
}

export async function validateSocket(m, sock, conn) {
    const cli = getSocket(m, sock, conn)
    if (!cli) {
        await m.reply("Error: Socket WhatsApp tidak ditemukan atau terputus.")
        return null
    }
    return cli
}

export async function sendComposing(cli, jid, duration = 1000) {
    try {
        await cli.presenceSubscribe(jid).catch(() => {})
        await cli.sendPresenceUpdate('composing', jid).catch(() => {})
        if (duration > 0) {
            await new Promise(resolve => setTimeout(resolve, duration))
        }
    } catch (e) {
        // Abaikan jika gagal update presence
    }
}

export function validateInternationalNumber(arg) {
    let rawInput = arg ? arg.trim() : ''
    const isValid = /^(\+?[1-9]\d{6,14})$/.test(rawInput)
    if (!isValid) return null

    let cleanNumber = rawInput.replace(/\D/g, '')
    return {
        clean: cleanNumber,
        jid: cleanNumber + '@s.whatsapp.net'
    }
}