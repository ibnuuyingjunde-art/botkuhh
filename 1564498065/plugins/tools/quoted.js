import te from '../../src/lib/ichigo-error.js'
import { proto } from 'ichigo'

const pluginConfig = {
    name: 'quoted',
    alias: ['q'],
    category: 'tools',
    description: 'Munculkan ulang pesan yang di-reply (atau pesan nested-nya kalau ada) tanpa reply lagi',
    usage: '.quoted (reply pesan)',
    isOwner: false,
    cooldown: 3,
    isEnabled: true
}

const SKIP_TYPES = ['messageContextInfo', 'senderKeyDistributionMessage']
const INTERACTIVE_TYPES = new Set(['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage'])
const PAYMENT_FLOW_BUTTONS = new Set(['review_and_pay', 'review_order', 'payment_info', 'payment_status', 'order_details', 'order_status', 'payment_method', 'send_location_payment'])
const QUOTE_FIELDS = ['quotedMessage', 'stanzaId', 'participant', 'remoteJid', 'quotedType', 'quotedMessageTimestamp']
const IGNORED_TAGS = new Set(['device-identity', 'quality_control', 'enc', 'hsm', 'verified_name', 'multicast', 'reporting', 'unavailable', 'rcat'])
const IGNORED_ATTRS = new Set(['id', 'from', 'to', 'participant', 'recipient', 'type', 'sts', 'verified_level', 'notify', 'addressing_mode', 'verified_name', 'participant_pn', 't', 'count', 'offline'])

const toPlain = (msg) =>
    proto.Message.toObject(proto.Message.fromObject(msg), { enums: Number, longs: Number, bytes: Buffer, defaults: false })

function typeOf(message) {
    return Object.keys(message || {}).find((k) => !SKIP_TYPES.includes(k))
}

/**
 * Cari contextInfo yang punya quotedMessage di pesan apa pun:
 * teks, media, interactive, payment, poll, wrapper (viewOnce/ephemeral/dll), dsb.
 */
function findQuotedContext(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 6) return null

    const ctx = node.contextInfo
    if (ctx?.quotedMessage) return ctx

    for (const key of Object.keys(node)) {
        if (key === 'contextInfo' || key === 'quotedMessage') continue

        const value = node[key]
        if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
            const found = findQuotedContext(value, depth + 1)
            if (found) return found
        }
    }

    return null
}

/** Buang info reply dari pesan nested supaya tampil sebagai pesan biasa (tidak ngereply lagi). */
function stripQuote(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 8 || Buffer.isBuffer(node) || node instanceof Uint8Array) return

    if (node.contextInfo && typeof node.contextInfo === 'object') {
        for (const f of QUOTE_FIELDS) delete node.contextInfo[f]
        if (node.contextInfo.messageAssociation) delete node.contextInfo.messageAssociation
    }

    if (node.messageContextInfo?.messageAssociation) delete node.messageContextInfo.messageAssociation

    for (const key of Object.keys(node)) {
        if (key === 'contextInfo') continue
        const value = node[key]
        if (value && typeof value === 'object') stripQuote(value, depth + 1)
    }
}

function isPaymentFlow(content) {
    const buttons = content?.interactiveMessage?.nativeFlowMessage?.buttons
    return Array.isArray(buttons) && buttons.some((b) => PAYMENT_FLOW_BUTTONS.has(b?.name))
}

/** Interactive polos dibungkus viewOnce biar tampil, kecuali payment (harus polos). Lainnya dibiarkan. */
function prepareContent(content) {
    const type = typeOf(content)
    if (!type) return content
    if (type === 'richResponseMessage') return { botForwardedMessage: { message: content } }
    if (isPaymentFlow(content)) return content
    if (INTERACTIVE_TYPES.has(type)) return { viewOnceMessage: { message: content } }
    return content
}

function getRelayOptions(chat, id) {
    const options = {}

    try {
        const node = id ? global.crmstore?.loadNode?.(id, chat) : null
        if (!node) return options

        const attrs = { ...(node.attrs || {}) }
        for (const k of IGNORED_ATTRS) delete attrs[k]

        const nodes = (Array.isArray(node.content) ? node.content : []).filter((v) => !IGNORED_TAGS.has(v?.tag))

        if (Object.keys(attrs).length) options.additionalAttributes = attrs
        if (nodes.length) options.additionalNodes = nodes
    } catch {}

    return options
}

/** Ambil pesan yang di-reply: utamakan data mentah dari SQLite crmstore (struktur asli), fallback ke m.quoted.message. */
function getQuotedMessage(m) {
    try {
        const row = global.crmstore?.loadMessage?.(m.quoted?.id, m.quoted?.chat || m.chat)
        const msg = row?.message ? proto.WebMessageInfo.toObject(row, { enums: Number, longs: Number, bytes: Buffer, defaults: false }).message : null
        if (msg) return msg
    } catch {}

    return m.quoted?.message || null
}

async function handler(m, { sock } = {}) {
    if (!m.quoted) {
        return m.reply('❌ *Reply pesan yang ingin di-munculkan*')
    }

    if (!sock) {
        return m.reply('❌ *Fitur ini butuh akses sock, cek signature handler plugin*')
    }

    try {
        const quotedRaw = getQuotedMessage(m)

        if (!quotedRaw) {
            return m.reply('❌ *Pesan yang kamu reply tidak ditemukan*')
        }

        // Kalau pesan yang di-reply punya reply lain -> munculkan pesan nested-nya.
        // Kalau tidak -> munculkan pesan yang di-reply itu sendiri. Dua-duanya tampil tanpa reply lagi.
        const ctx = findQuotedContext(quotedRaw)
        const source = ctx?.quotedMessage || quotedRaw
        const sourceId = ctx?.quotedMessage ? ctx.stanzaId : m.quoted.id

        let target

        try {
            target = toPlain(source)
        } catch {
            target = structuredClone(source)
        }

        stripQuote(target)

        if (!typeOf(target)) {
            return m.reply('❌ *Pesan kosong, tidak ada yang bisa dimunculkan*')
        }

        const options = getRelayOptions(m.chat, sourceId)

        options.messageId = '3EB0' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()

        await sock.relayMessage(m.chat, prepareContent(target), options)
    } catch (err) {
        console.log(err)
        await m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }