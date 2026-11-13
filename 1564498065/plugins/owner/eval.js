import fs from 'fs'
import path from 'path'
import axios from 'axios'
import os from 'os'
import { getDatabase } from '../../src/lib/ichigo-database.js'
import { getAssetBuffer } from '../../src/lib/ichigo-asset-manager.js'
import { sharp as _sharpLazy } from '../../src/lib/ichigo-lazy.js'

import config from '../../config.js'
import util from 'util'
import crypto from 'crypto'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { exec, execSync } from 'child_process'
import * as baileys from 'ichigo'
import IchigoBuilder from '../../src/lib/ichigo-builder.js';

// Dibuat tersedia langsung di scope eval (=> / > / .$), jadi snippet bisa
// langsung pakai Toolkit, AIRich, Button, generateWAMessageFromContent, dll
const { BaseBuilder, Button, ButtonV2, Carousel, AIRich, Toolkit, Typenames, Enums } = IchigoBuilder;
const {
    proto,
    generateWAMessageFromContent,
    generateWAMessage,
    prepareWAMessageMedia,
    generateMessageIDV2,
    encodeWAMessage,
    encodeSignedDeviceIdentity,
    jidDecode,
    jidEncode,
    jidNormalizedUser,
    areJidsSameUser,
    getContentType,
    downloadMediaMessage,
    downloadContentFromMessage,
    getBinaryNodeChild,
    getBinaryNodeChildren,
    generateForwardMessageContent
} = baileys;
const Baileys = baileys

// Modul ESM tidak punya require/__dirname/__filename secara default,
// jadi snippet gaya CommonJS (const { x } = require('crypto')) error. Disediakan di sini.
const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pluginConfig = {
    name: 'eval',
    alias: ['$', 'ev', 'evaluate', '=>'],
    category: 'owner',
    description: 'Jalankan kode JavaScript (Owner Only)',
    usage: '=> <code> atau .$ <code>',
    example: '=> m.chat',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 0,
    energi: 0,
    isEnabled: true,
    noPrefix: ['=>'],
    customTrigger: (body) => body?.startsWith('=>')
}

// true = balasan kartu acara (eventMessage) | false = balasan teks biasa lewat m.reply (gaya .setreply)
const USE_EVAL_CARD = false

const INTERACTIVE_TYPES = new Set(['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage'])

const PAYMENT_FLOW_BUTTONS = new Set(['review_and_pay', 'review_order', 'payment_info', 'payment_status', 'order_details', 'order_status', 'payment_method', 'send_location_payment']);

function isPaymentFlowMessage(content) {
  const buttons = content?.interactiveMessage?.nativeFlowMessage?.buttons;
  return Array.isArray(buttons) && buttons.some((b) => PAYMENT_FLOW_BUTTONS.has(b?.name));
}

function prepareRelayContent(content) {
    const type = Object.keys(content || {}).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v))

    if (!type) return content
    if (type === 'richResponseMessage') return { botForwardedMessage: { message: content } }
    // Pesan payment (review_and_pay / order_details) dikirim polos, jangan dibungkus viewOnceMessage
    if (type === 'interactiveMessage' && isPaymentFlowMessage(content)) return content
    if (type === 'interactiveMessage') fixInteractiveHeader(content.interactiveMessage)
    if (INTERACTIVE_TYPES.has(type)) {
        // messageContextInfo.deviceListMetadata wajib ada, kalau tidak WhatsApp
        // hanya menampilkan header (gambar saja) tanpa body/tombol.
        const inner = {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            ...content
        }
        return { viewOnceMessage: { message: inner } }
    }

    return content
}

// Header dengan media (image/video/document) harus punya hasMediaAttachment: true,
// dan field body/footer yang kosong dibuang supaya tidak merusak render.
function fixInteractiveHeader(im) {
    if (!im || typeof im !== 'object') return
    const h = im.header
    if (h && (h.imageMessage || h.videoMessage || h.documentMessage || h.locationMessage)) {
        if (h.hasMediaAttachment === undefined) h.hasMediaAttachment = true
    }
    if (h && !h.title && !h.subtitle && !h.imageMessage && !h.videoMessage && !h.documentMessage && !h.locationMessage) {
        delete im.header
    }
}


// ── Dukungan statement di eval ──────────────────────────────────────────────
// Sebelumnya `const msg = {...}` (atau statement lain) dijalankan apa adanya tanpa
// `return`, sehingga hasilnya selalu "undefined". Sekarang nilai statement terakhir
// otomatis di-return (ekspresi → nilainya, const/let/var → nilai variabelnya),
// seperti REPL. Top-level await tetap jalan karena kode dibungkus async function.
async function loadAcorn() {
    try {
        const mod = await import('acorn')
        return mod.parse || mod.default?.parse || null
    } catch {
        return null
    }
}

function collectBoundNames(pattern, out = []) {
    if (!pattern) return out
    switch (pattern.type) {
        case 'Identifier': out.push(pattern.name); break
        case 'ObjectPattern':
            pattern.properties.forEach((p) => collectBoundNames(p.type === 'RestElement' ? p.argument : p.value, out))
            break
        case 'ArrayPattern': pattern.elements.forEach((e) => collectBoundNames(e, out)); break
        case 'AssignmentPattern': collectBoundNames(pattern.left, out); break
        case 'RestElement': collectBoundNames(pattern.argument, out); break
    }
    return out
}

async function withAutoReturn(code) {
    const parse = await loadAcorn()
    if (!parse) return code

    let ast
    try {
        ast = parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true
        })
    } catch {
        return code
    }

    const last = ast.body[ast.body.length - 1]
    if (!last) return code

    if (last.type === 'ExpressionStatement') {
        const expr = code.slice(last.expression.start, last.expression.end)
        return `${code.slice(0, last.start)}return (${expr})\n${code.slice(last.end)}`
    }

    if (last.type === 'VariableDeclaration') {
        const names = last.declarations.flatMap((d) => collectBoundNames(d.id))
        if (!names.length) return code
        const ret = names.length === 1 ? names[0] : `{ ${names.join(', ')} }`
        return `${code}\nreturn ${ret}`
    }

    return code
}

// ── Balasan eval berbentuk kartu acara (eventMessage) ───────────────────────
// Tampilan: gambar cover + judul + isi ```hasil``` + tombol "Lihat acara",
// mengutip pesan eval.
async function sendEvalCard(sock, m, output) {
    const chat = m.chat
    const name = config.bot?.name || 'lyniX\'s'
    const body = '```\n' + output + '\n```'
    const now = Math.floor(Date.now() / 1000)

    const contextInfo = {
        stanzaId: m.key?.id,
        participant: m.sender,
        quotedMessage: m.message,
        mentionedJid: []
    }

    let cover = null
    try {
        const raw = getAssetBuffer('ichigo3') || getAssetBuffer('ichigo')
        if (raw) {
            const jpeg = await _sharpLazy(raw).resize(720, 720, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
            const media = await prepareWAMessageMedia({ image: jpeg }, { upload: sock.waUploadToServer })
            cover = media.imageMessage
        }
    } catch {}

    const build = (withCover) => ({
        eventMessage: {
            contextInfo,
            isCanceled: false,
            name,
            description: body,
            joinLink: '',
            startTime: String(now),
            endTime: String(now + 3600),
            extraGuestsAllowed: false,
            isScheduleCall: false,
            hasReminder: false,
            ...(withCover && cover ? { eventCoverImage: cover } : {})
        }
    })

    try {
        return await sock.relayMessage(chat, build(true), {})
    } catch {
        return await sock.relayMessage(chat, build(false), {})
    }
}

async function handler(m, { sock, store }) {
    if (!config.isOwner(m.sender)) {
        return m.reply('❌ *Owner Only!*')
    }

    const code = m.fullArgs?.trim() || m.text?.trim()

    if (!code) {
        return m.reply(
            `⚙️ *ᴇᴠᴀʟ*\n\n` +
            `> Masukkan kode JavaScript!\n\n` +
            `*Contoh:*\n` +
            `> .$ 1 + 1\n` +
            `> .$ m.chat\n` +
            `> .$ db.getUser(m.sender)`
        )
    }

    // Snippet hasil .crm (=> / >) dikirim lewat relayMessage dengan pembungkus yang sama seperti .relay
    const conn = m.evalMode
        ? new Proxy(sock, {
            get(target, prop) {
                if (prop === 'relayMessage') {
                    return (jid, content, options = {}) => target.relayMessage(jid, prepareRelayContent(content), options)
                }
                const value = target[prop]
                return typeof value === 'function' ? value.bind(target) : value
            }
        })
        : sock
    const ryyn = sock;

    const jid = m.chat
    const sender = m.sender
    const from = m.chat
    const userJid = m.sender
    const groupJid = m.chat
    const quoted = m.quoted || m
    const text = m.text
    const args = m.args || []

    const db = getDatabase()

    let result
    let isError = false

    const exprMode = m.evalMode === 'expr' || m.command === '=>'

    try {
        let fn
        if (exprMode) {
            const expr = code.replace(/[;\s]+$/, '')
            try {
                fn = eval(`(async () => { return (${expr}\n) })`)
            } catch (e) {
                if (!(e instanceof SyntaxError)) throw e
            }
        }
        if (!fn) {
            // Mode statement: coba ekspresi dulu, lalu auto-return statement terakhir
            if (!exprMode) {
                const expr = code.replace(/[;\s]+$/, '')
                try {
                    fn = eval(`(async () => { return (${expr}\n) })`)
                } catch (e) {
                    if (!(e instanceof SyntaxError)) throw e
                }
            }
            if (!fn) {
                const body = await withAutoReturn(code)
                fn = eval(`(async () => { ${body}\n })`)
            }
        }
        result = await fn()
    } catch (e) {
        isError = true
        result = e
    }

    let output
    if (isError) {
        output = `❌ ${result?.stack?.split('\n').slice(0, 4).join('\n') || result?.message || String(result)}`
    } else if (typeof result === 'string') {
        output = result
    } else if (typeof result === 'undefined') {
        output = 'undefined'
    } else if (result === null) {
        output = 'null'
    } else if (typeof result === 'object' || typeof result === 'function') {
        try {
            output = util.inspect(result, { depth: 4, maxArrayLength: 50 })
        } catch {
            output = String(result)
        }
    } else {
        output = String(result)
    }

    if (output.length > 3000) {
        output = output.slice(0, 3000) + '\n\n... (truncated)'
    }

    // Default: balasan teks biasa (quote pesan eval + hasil apa adanya),
    // jadi `return '✅ Sharp mode ringan aktif.'` tampil persis seperti itu.
    if (!USE_EVAL_CARD) {
        return m.reply(output)
    }

    try {
        await sendEvalCard(sock, m, output)
    } catch {
        // fallback kalau kartu acara gagal terkirim
        await m.reply(output)
    }
}

export { pluginConfig as config, handler }