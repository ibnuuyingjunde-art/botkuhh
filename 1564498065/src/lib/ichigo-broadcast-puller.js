// Penarik broadcast dari Cloud API ke saluran WhatsApp (mode tarik, tanpa buka port).
// Tiap beberapa detik bot menanyakan ke API apakah ada pesan broadcast baru, lalu mengirimnya ke saluran
// dan melapor balik (ack). Atur token di panel admin Cloud API > Broadcast, lalu samakan di config.broadcast.token.
import config from '../../config.js'
import { logger } from './ichigo-logger.js'

let sock = null
let timer = null
let running = false
let failStreak = 0

const cfg = () => config.broadcast || {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(method, path, body) {
  const base = String(cfg().apiUrl || '').replace(/\/+$/, '')
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + cfg().token,
      'Content-Type': 'application/json',
      'User-Agent': 'ichigo-md-broadcast-puller/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data.status === false) throw new Error(data.error || 'HTTP ' + r.status)
  return data
}

async function tick() {
  let wait = cfg().intervalMs || 5000
  try {
    if (!sock?.user) throw new Error('bot belum terhubung ke WhatsApp') // jangan ambil pesan kalau belum bisa kirim
    const data = await api('GET', '/api/broadcast/pull')
    failStreak = 0
    const msgs = data.messages || []
    const results = []
    for (const m of msgs) {
      try {
        const caption = String(m.caption || '')
        if (m.image) await sock.sendMessage(m.jid, { image: Buffer.from(m.image, 'base64'), caption })
        else await sock.sendMessage(m.jid, { text: caption })
        results.push({ id: m.id, ok: true })
        logger.success('Broadcast', `Terkirim ke saluran (${m.id})`)
      } catch (e) {
        results.push({ id: m.id, ok: false, error: String(e?.message || e).slice(0, 200) })
        logger.error('Broadcast', `Gagal kirim ${m.id}: ${e?.message}`)
      }
      await sleep(3000) // jeda antar pesan supaya tidak dianggap spam
    }
    if (results.length) await api('POST', '/api/broadcast/ack', { results })
    if (msgs.length) wait = 1000 // mungkin masih ada antrean, tarik lagi cepat
  } catch (e) {
    failStreak++
    wait = Math.min(60000, wait * Math.pow(2, Math.min(failStreak, 4))) // mundur bertahap kalau error
    if (failStreak === 1 || failStreak % 10 === 0) logger.warn('Broadcast', e?.message || String(e))
  }
  timer = setTimeout(tick, wait)
}

// Aman dipanggil berulang (tiap koneksi WhatsApp tersambung ulang): cukup mengganti socket, loop tidak dobel.
export function startBroadcastPuller(socketInstance) {
  sock = socketInstance
  if (running) return
  if (!cfg().token || String(cfg().token).length < 12) {
    logger.info('Broadcast', 'Token broadcast belum diisi (config.broadcast.token), penarik tidak dijalankan')
    return
  }
  running = true
  timer = setTimeout(tick, 3000)
  logger.info('Broadcast', `Penarik aktif, cek ${cfg().apiUrl} tiap ${Math.round((cfg().intervalMs || 5000) / 1000)} dtk`)
}

export function stopBroadcastPuller() {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
}
