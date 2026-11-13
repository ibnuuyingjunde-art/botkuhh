/*
 * crmstore
 * by Nixel
 *
 * Do not remove this watermark.
 * Channel: https://whatsapp.com/channel/0029VbCV1ck8fewpdNb2TY2k
 *
 * Version: v1-b
 * Source: lib/crmstore.js
 */

import fs from 'fs'
import path from 'path'
import { openStore } from './ichigo-sqlite-store.js'
import { proto, generateWAMessage, generateWAMessageFromContent, generateMessageIDV2 } from 'ichigo'

const dbPath = './data/crmdb.db'
const CRM_STORE = 'crm'
const SAVE_DELAY = 5000
const AUTO_PURGE_INTERVAL = 5 * 60 * 1000 // kosongkan store crmdb tiap 5 menit
const MAX_DB_BYTES = 2 * 1024 * 1024 // 2 MB: kalau lewat, isi store dihapus otomatis
let approxBytes = 0

function rowBytes(row) {
	return Math.ceil((row?.data?.length || 0) * 1.34) + 200 // base64 + metadata
}

function wipeStore() {
	messages = []
	nodes = []
	approxBytes = 0
	msgIndex.clear()
	msgByIdIndex.clear()
	nodeIndex.clear()
	nodeByIdIndex.clear()
	scheduleSave()
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = openStore(dbPath)
const CRM_DEFAULT = { seq: 0, messages: [], nodes: [] }
// kompatibel dengan export lama `db` (cuma menyimpan snapshot data terakhir)
const db = { data: null }

let seq = 0
let messages = []
let nodes = []

const msgIndex = new Map()
const msgByIdIndex = new Map()
const nodeIndex = new Map()
const nodeByIdIndex = new Map()

const mkey = (id, chat) => `${chat}\u0000${id}`

function indexMessage(row) {
	msgIndex.set(mkey(row.id, row.chat), row)
	msgByIdIndex.set(row.id, row)
}

function indexNode(row) {
	nodeIndex.set(mkey(row.id, row.chat), row)
	nodeByIdIndex.set(row.id, row)
}

function rebuildIndex() {
	msgIndex.clear()
	msgByIdIndex.clear()
	nodeIndex.clear()
	nodeByIdIndex.clear()

	for (const row of messages) indexMessage(row)
	for (const row of nodes) indexNode(row)
}

function load() {
	try {
		db.data = sqlite.load(CRM_STORE, CRM_DEFAULT)

		const raw = db.data || {}

		messages = (raw.messages || []).map(row => ({
			...row,
			data: Buffer.from(row.data, 'base64')
		}))

		nodes = raw.nodes || []

		seq = Number(raw.seq || 0)

		for (const row of messages) {
			if (row.rowid > seq) seq = row.rowid
		}

		rebuildIndex()

		approxBytes = messages.reduce((n, r) => n + rowBytes(r), 0)
		if (approxBytes >= MAX_DB_BYTES) wipeStore()
	} catch {
		try {
			sqlite.clear(CRM_STORE)
		} catch {}

		messages = []
		nodes = []
		seq = 0
		rebuildIndex()
	}
}

let saveTimer = null
let dirty = false

function flush() {
	if (!dirty) return

	dirty = false

	db.data = {
		seq,
		messages: messages.map(row => ({
			...row,
			data: row.data.toString('base64')
		})),
		nodes
	}

	sqlite.save(CRM_STORE, db.data)
}

function scheduleSave() {
	dirty = true

	if (saveTimer) return

	saveTimer = setTimeout(() => {
		saveTimer = null

		try {
			flush()
		} catch {}
	}, SAVE_DELAY)

	if (saveTimer.unref) saveTimer.unref()
}

load()

if (!global.__crmStoreExitHook) {
	global.__crmStoreExitHook = true

	process.on('exit', () => {
		try {
			flush()
		} catch {}
	})
}

function serializeNode(value) {
	return JSON.stringify(value, (_, value) => {
		if (Buffer.isBuffer(value)) {
			return {
				type: 'Buffer',
				data: value.toString('base64')
			}
		}

		if (value instanceof Uint8Array) {
			return {
				type: 'Buffer',
				data: Buffer.from(value).toString('base64')
			}
		}

		return value
	})
}

function deserializeNode(value) {
	if (!value) return null

	return JSON.parse(value, (_, value) => {
		if (value && value.type === 'Buffer') {
			if (typeof value.data === 'string') {
				return Buffer.from(value.data, 'base64')
			}

			if (Array.isArray(value.data)) {
				return Buffer.from(value.data)
			}
		}

		return value
	})
}

function decodeRow(row) {
	let data = null

	try {
		data = proto.WebMessageInfo.decode(row.data)
	} catch {}

	return {
		rowid: row.rowid,
		id: row.id,
		chat: row.chat,
		sender: row.sender,
		timestamp: row.timestamp,
		data
	}
}

function saveMessage(message, chat) {
	if (!message || !chat) return false

	try {
		const id = message?.key?.id

		if (!id) return false

		const encoded = proto.WebMessageInfo.encode(message).finish()

		const row = {
			rowid: ++seq,
			id: String(id),
			chat: String(chat),
			sender:
				message.participant ||
				message.key?.participant ||
				null,
			timestamp: Number(
				message.messageTimestamp ||
				Math.floor(Date.now() / 1000)
			),
			data: Buffer.from(encoded)
		}

		messages.push(row)
		indexMessage(row)
		approxBytes += rowBytes(row)
		if (approxBytes >= MAX_DB_BYTES) wipeStore()
		else scheduleSave()

		return true
	} catch {
		return false
	}
}

function loadMessage(id, chat) {
	if (!id) return null

	try {
		const row = chat
			? msgIndex.get(mkey(String(id), String(chat)))
			: msgByIdIndex.get(String(id))

		if (!row?.data) return null

		return proto.WebMessageInfo.decode(row.data)
	} catch {
		return null
	}
}

function loadMessageById(id) {
	if (!id) return null

	try {
		const row = msgByIdIndex.get(String(id))

		if (!row?.data) return null

		return proto.WebMessageInfo.decode(row.data)
	} catch {
		return null
	}
}

function saveNode(id, chat, node) {
	if (!id || !chat || !node) return false

	try {
		const key = mkey(String(id), String(chat))
		const data = serializeNode(node)
		const existing = nodeIndex.get(key)

		if (existing) {
			existing.data = data
			existing.created_at = Math.floor(Date.now() / 1000)
		} else {
			const row = {
				id: String(id),
				chat: String(chat),
				data,
				created_at: Math.floor(Date.now() / 1000)
			}

			nodes.push(row)
			indexNode(row)
		}

		scheduleSave()

		return true
	} catch {
		return false
	}
}

function loadNode(messageId, jid) {
	if (!messageId) return null

	try {
		let row = null

		if (jid) {
			row = nodeIndex.get(
				mkey(String(messageId), String(jid))
			)
		}

		if (!row?.data) {
			row = nodeByIdIndex.get(String(messageId))
		}

		if (!row?.data) return null

		return deserializeNode(row.data)
	} catch {
		return null
	}
}

function saveAdditionalNode(id, chat, content, attrs = {}) {
	if (!id || !chat) return false

	try {
		const existing = nodeIndex.get(
			mkey(String(id), String(chat))
		)

		if (existing?.data) {
			const node = deserializeNode(existing.data)

			if (node && typeof node === 'object') {
				node.content = content
				node.attrs = { ...node.attrs, ...attrs }

				return saveNode(id, chat, node)
			}
		}

		return saveNode(id, chat, {
			tag: 'message',
			attrs: {
				id: String(id),
				from: String(chat),
				t: String(Math.floor(Date.now() / 1000)),
				type: 'text',
				...attrs
			},
			content
		})
	} catch {
		return false
	}
}

function loadAdditionalNode(id, chat) {
	const node = loadNode(id, chat)

	if (!node) return null

	return node.content ?? null
}

function hasMessage(id, chat) {
	if (!id) return false

	try {
		if (chat) {
			return msgIndex.has(
				mkey(String(id), String(chat))
			)
		}

		return msgByIdIndex.has(String(id))
	} catch {
		return false
	}
}

function deleteMessage(id, chat) {
	if (!id) return false

	try {
		id = String(id)

		const match = row =>
			row.id === id &&
			(!chat || row.chat === String(chat))

		messages = messages.filter(row => !match(row))
		nodes = nodes.filter(row => !match(row))

		rebuildIndex()
		scheduleSave()

		return true
	} catch {
		return false
	}
}

function getMessages(chat, limit = 100) {
	if (!chat) return []

	try {
		const out = []
		const max = Math.max(1, Number(limit) || 100)

		for (let i = messages.length - 1; i >= 0 && out.length < max; i--) {
			if (messages[i].chat === String(chat)) {
				out.push(decodeRow(messages[i]))
			}
		}

		return out
	} catch {
		return []
	}
}

function getAllMessages(limit = 100) {
	try {
		return messages
			.slice(-Math.max(1, Number(limit) || 100))
			.reverse()
			.map(decodeRow)
	} catch {
		return []
	}
}

function getRowById(rowid) {
	const n = Number(rowid)

	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].rowid === n) return messages[i]
	}

	return null
}

function getRow(id, chat) {
	if (!id || !chat) return null

	return msgIndex.get(mkey(String(id), String(chat))) || null
}

function getRowsBefore(chat, timestamp, limit) {
	const out = []

	const sorted = messages
		.filter(row => row.chat === chat && row.timestamp <= timestamp)
		.sort((a, b) => b.timestamp - a.timestamp || b.rowid - a.rowid)

	for (const row of sorted) {
		if (out.length >= limit) break
		out.push(row)
	}

	return out
}

function getRowsAfter(chat, timestamp, limit) {
	return messages
		.filter(row => row.chat === chat && row.timestamp > timestamp)
		.sort((a, b) => a.timestamp - b.timestamp || a.rowid - b.rowid)
		.slice(0, limit)
}

function countMessages() {
	return messages.length
}

function cleanup() {
	try {
		const cutoff =
			Math.floor(Date.now() / 1000) -
			7 * 24 * 60 * 60

		messages = messages.filter(
			row => !row.timestamp || row.timestamp >= cutoff
		)

		const limit = Number(global.MESSAGE_CACHE_LIMIT || 0)

		if (limit > 0 && messages.length > limit) {
			messages = messages.slice(-limit)
		}

		approxBytes = messages.reduce((n, r) => n + rowBytes(r), 0)
		rebuildIndex()

		nodes = nodes.filter(row =>
			msgIndex.has(mkey(row.id, row.chat))
		)

		rebuildIndex()
		scheduleSave()
	} catch {}
}

function formatBytes(bytes) {
	if (!bytes) return '0 B'

	const units = ['B', 'KB', 'MB', 'GB', 'TB']

	let value = Number(bytes)
	let index = 0

	while (value >= 1024 && index < units.length - 1) {
		value /= 1024
		index++
	}

	return `${value.toFixed(2)} ${units[index]}`
}

function getStats() {
	try {
		const msgSize = messages.reduce((a, row) => a + row.data.length, 0)
		const nodeSize = nodes.reduce((a, row) => a + row.data.length, 0)

		const totalMessages = messages.length
		const limit = Number(global.MESSAGE_CACHE_LIMIT || 0)

		let dbSize = 0
		for (const ext of ['', '-wal']) {
			try { dbSize += fs.statSync(dbPath + ext).size } catch {}
		}

		return {
			cache: {
				messages: totalMessages,
				limit,
				remaining: limit
					? Math.max(0, limit - totalMessages)
					: 0,
				usagePercent: limit
					? (totalMessages / limit * 100).toFixed(2) + '%'
					: '∞'
			},
			payload: {
				messages: {
					count: totalMessages,
					size: msgSize,
					sizeHuman: formatBytes(msgSize),
					avgSize: totalMessages ? Math.round(msgSize / totalMessages) : 0,
					avgSizeHuman: formatBytes(totalMessages ? msgSize / totalMessages : 0)
				},
				nodes: {
					count: nodes.length,
					size: nodeSize,
					sizeHuman: formatBytes(nodeSize),
					avgSize: nodes.length ? Math.round(nodeSize / nodes.length) : 0,
					avgSizeHuman: formatBytes(nodes.length ? nodeSize / nodes.length : 0)
				}
			},
			files: {
				db: {
					size: dbSize,
					human: formatBytes(dbSize)
				},
				total: {
					size: dbSize,
					human: formatBytes(dbSize)
				}
			},
			ratio: {
				dbPerMessage: totalMessages
					? formatBytes(msgSize / totalMessages)
					: '0 B',
				nodePerMessage: nodes.length
					? formatBytes(nodeSize / nodes.length)
					: '0 B'
			}
		}
	} catch {
		return {
			cache: { messages: 0, limit: 0, remaining: 0, usagePercent: '0%' },
			payload: {
				messages: { count: 0, size: 0, sizeHuman: '0 B', avgSize: 0, avgSizeHuman: '0 B' },
				nodes: { count: 0, size: 0, sizeHuman: '0 B', avgSize: 0, avgSizeHuman: '0 B' }
			},
			files: {
				db: { size: 0, human: '0 B' },
				total: { size: 0, human: '0 B' }
			},
			ratio: { dbPerMessage: '0 B', nodePerMessage: '0 B' }
		}
	}
}

function loadFullMessage(id, chat) {
	const node = loadNode(id, chat)

	return {
		message: loadMessage(id, chat),
		additionalNode: node?.content ?? null
	}
}

function persist(message, id, jid, options = {}) {
	queueMicrotask(() => {
		try {
			const info = message?.key
				? message
				: { key: { remoteJid: jid, fromMe: true, id }, message, messageTimestamp: Math.floor(Date.now() / 1000) }

			saveMessage(proto.WebMessageInfo.fromObject(info), jid)

			saveAdditionalNode(id, jid, options.additionalNodes || [], {
				t: String(Math.floor(Date.now() / 1000)),
				...options.additionalAttributes
			})
		} catch {}
	})
}

if (!global.__crmStoreBoundConns) {
	global.__crmStoreBoundConns = new WeakSet()
}

function bind(conn) {
	if (!conn) return conn
	if (global.__crmStoreBoundConns.has(conn)) return conn

	global.__crmStoreBoundConns.add(conn)

	conn.ev.on('messages.upsert', ({ messages }) => {
		try {
			for (const message of messages || []) {
				if (!message?.key?.id) continue

				const chat = message.key.remoteJid

				if (!chat) continue

				saveMessage(message, chat)
			}
		} catch {}
	})

	conn.ws.on('CB:message', node => {
		try {
			const id = node?.attrs?.id

			if (!id) return

			const chat =
				node?.attrs?.from ||
				node?.attrs?.recipient ||
				node?.attrs?.participant

			if (!chat) return

			saveNode(
				id,
				chat,
				node
			)
		} catch {}
	})

	if (typeof conn.sendMessage === 'function' && !conn.sendMessage.__crmStorePatched) {
		const originalSendMessage = conn.sendMessage.bind(conn)

		const patchedSendMessage = async (jid, content, options = {}) => {
			const messageId = options.messageId || generateMessageIDV2()

			const sent = await originalSendMessage(jid, content, { ...options, messageId })

			// pakai pesan hasil kirim (sudah lengkap), tanpa generate/upload ulang
			try {
				if (sent?.message) persist(sent, messageId, jid, options)
			} catch {}

			return sent
		}

		patchedSendMessage.__crmStorePatched = true
		conn.sendMessage = patchedSendMessage
	}

	if (typeof conn.relayMessage === 'function' && !conn.relayMessage.__crmStorePatched) {
		const originalRelayMessage = conn.relayMessage.bind(conn)

		const patchedRelayMessage = async (jid, content, options = {}) => {
			const messageId = options.messageId || generateMessageIDV2()

			let generated = null

			try {
				generated = generateWAMessageFromContent(jid, content, {
					...options,
					messageId,
					userJid: conn.user?.id,
					upload: conn.waUploadToServer
				})
			} catch {}

			const resultPromise = originalRelayMessage(jid, content, { ...options, messageId })

			if (generated) persist(generated, messageId, jid, options)

			return resultPromise
		}

		patchedRelayMessage.__crmStorePatched = true
		conn.relayMessage = patchedRelayMessage
	}

	return conn
}

if (!global.__crmStoreCleanupTimer) {
	let lastCleanup = 0

	global.__crmStoreCleanupTimer = setInterval(() => {
		const now = Date.now()

		if (
			now - lastCleanup <
			60 * 60 * 1000
		) {
			return
		}

		lastCleanup = now

		cleanup()

		try {
			flush()
		} catch {}
	}, 60 * 1000)
}

function purge(reason = 'manual') {
	try {
		if (saveTimer) {
			clearTimeout(saveTimer)
			saveTimer = null
		}

		dirty = false
		seq = 0
		messages = []
		nodes = []
		approxBytes = 0
		rebuildIndex()

		sqlite.clear(CRM_STORE)
		sqlite.checkpoint()

		return true
	} catch {
		return false
	}
}

if (!global.__crmStorePurgeTimer) {
	global.__crmStorePurgeTimer = setInterval(() => {
		purge('auto')
	}, AUTO_PURGE_INTERVAL)

	if (global.__crmStorePurgeTimer.unref) global.__crmStorePurgeTimer.unref()
}

export {
	db,
	bind,
	saveMessage,
	loadMessage,
	loadMessageById,
	saveNode,
	loadNode,
	saveAdditionalNode,
	loadAdditionalNode,
	hasMessage,
	deleteMessage,
	flush,
	getRowById,
	getRow,
	getRowsBefore,
	getRowsAfter,
	getMessages,
	getAllMessages,
	countMessages,
	cleanup,
	purge,
	getStats,
	loadFullMessage
}

export default {
	db,
	bind,
	saveMessage,
	loadMessage,
	loadMessageById,
	saveNode,
	loadNode,
	saveAdditionalNode,
	loadAdditionalNode,
	hasMessage,
	deleteMessage,
	flush,
	getRowById,
	getRow,
	getRowsBefore,
	getRowsAfter,
	getMessages,
	getAllMessages,
	countMessages,
	cleanup,
	purge,
	getStats,
	loadFullMessage
}