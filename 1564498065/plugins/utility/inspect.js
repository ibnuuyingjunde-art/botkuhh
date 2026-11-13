import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'inspect',
    alias: ['jsoninspect', 'rawmsg'],
    category: 'owner',
    description: 'Ambil JSON message dari pesan yang direply',
    usage: '.inspect (reply pesan)',
    isOwner: true,
    cooldown: 3,
    isEnabled: true
}

function safeStringify(obj, maxLength = 3000) {
    const seen = new WeakSet()

    const json = JSON.stringify(obj, function (key, value) {
        
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]'
            }
            seen.add(value)
        }

        if (value && (value.type === 'Buffer' || value instanceof Uint8Array)) {
            const len = value.data?.length ?? value.length ?? 0
            return `[Buffer, ${len} bytes]`
        }

        if (typeof value === 'bigint') {
            return value.toString()
        }

        return value
    }, 2)

    if (!json) return 'null'

    if (json.length > maxLength) {
        return json.slice(0, maxLength) + `\n...\n[dipotong, total ${json.length} karakter]`
    }

    return json
}

async function handler(m) {
    if (!m.quoted) {
        return m.reply('❌ *Reply pesan yang ingin di-inspect*')
    }

    try {
        const quoted = m.quoted || {}
        const result = safeStringify(quoted)

        await m.reply('```' + result + '```')
    } catch (err) {
        console.error('[inspect] error:', err.message || err)
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }