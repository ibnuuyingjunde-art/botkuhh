import { getDatabase } from './ichigo-database.js'
/**
 * Kompatibilitas @itsliaaa/baileys
 * Menambahkan method lama (fork ichigokurosaki-baileys) di atas API bawaan itsliaaa:
 * sendPreview, sendTable(V2), sendList, sendCodeBlock(V2), sendLinkV2, swgc, cekIDSaluran
 */
async function toThumb(img) {
  try {
    let buf = img
    if (typeof img === 'string' && /^https?:\/\//i.test(img)) {
      const res = await fetch(img)
      buf = Buffer.from(await res.arrayBuffer())
    }
    if (!Buffer.isBuffer(buf)) return undefined
    const sharp = (await import('sharp')).default
    return await sharp(buf).resize(300, 300, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer()
  } catch {
    return Buffer.isBuffer(img) ? img : undefined
  }
}

function channelKey(input) {
  const s = String(input || '').trim()
  const m = s.match(/(?:whatsapp\.com|wa\.me)\/channel\/([^/?#\s]+)/i)
  return m ? m[1] : s
}


// --- interactiveButtons (format Baileys lama: { name, buttonParamsJson })
//     diterjemahkan ke nativeFlow milik @itsliaaa/baileys: { text, id | url | copy | call | sections }
const MEDIA_KEYS = ['image', 'video', 'audio', 'document', 'sticker', 'location']

function parseParams(b) {
  if (!b || typeof b !== 'object') return null
  const raw = b.buttonParamsJson
  if (raw && typeof raw === 'object') return raw
  try { return JSON.parse(raw || '{}') } catch { return null }
}

function toNativeFlowButton(b) {
  const p = parseParams(b)
  if (!p) return null
  const text = p.display_text || p.title || ''
  switch (b.name) {
    case 'quick_reply': return { text, id: p.id ?? '' }
    case 'cta_url': return { text, url: p.url || p.merchant_url, ...(p.use_webview ? { useWebview: true } : {}) }
    case 'cta_copy': return { text, copy: p.copy_code ?? p.id ?? '' }
    case 'cta_call': return { text, call: String(p.phone_number || '').replace(/[^\d]/g, '') }
    case 'single_select': return Array.isArray(p.sections) ? { text: p.title || text, sections: p.sections } : null
    default: return null // tipe lain (inapp_signup, send_location, dll) tidak punya padanan
  }
}

// Default OFF: library terpasang (ichigokurosaki-baileys) sudah mengerti `interactiveButtons`
// secara native. Nyalakan hanya jika memakai @itsliaaa/baileys: `.setnativeflow on`
function isNativeFlowOn() {
  try {
    return getDatabase()?.setting('nativeFlowCompat') === true
  } catch {
    return false
  }
}

function convertInteractiveButtons(content) {
  if (!isNativeFlowOn()) return content
  if (!content || typeof content !== 'object') return content
  if (!Array.isArray(content.interactiveButtons) || content.interactiveButtons.length === 0) return content
  if (content.nativeFlow) return content
  // Tombol penanda format lama (inapp_signup, single_select kosong, dll) tidak punya padanan:
  // dilewati saja, jangan sampai membatalkan semua tombol lain.
  const flow = content.interactiveButtons.map(toNativeFlowButton).filter(Boolean)
  if (flow.length === 0) return content // tidak ada satupun yang bisa dikonversi: biarkan apa adanya
  const { interactiveButtons, ...rest } = content
  const out = { ...rest, nativeFlow: flow }
  const hasMedia = MEDIA_KEYS.some((k) => out[k])
  if (!hasMedia && out.caption && !out.text) {
    out.text = out.caption
    delete out.caption
  }
  return out
}

export function patchCompat(sock) {
  const send = (jid, content, quoted) => sock.sendMessage(jid, content, quoted ? { quoted } : undefined)

  if (typeof sock.sendPreview !== 'function') {
    sock.sendPreview = async (jid, preview = {}, options = {}) => {
      const { contextInfo, ...sendOptions } = options
      const thumb = preview.jpegThumbnail || (preview.image ? await toThumb(preview.image) : undefined)
      const content = {
        text: preview.caption || preview.text || '',
        linkPreview: {
          'matched-text': preview.matchedText || preview.url || '',
          title: preview.title,
          description: preview.description,
          previewType: preview.previewType ?? 0,
          jpegThumbnail: thumb
        }
      }
      if (contextInfo) content.contextInfo = contextInfo
      const msg = await sock.sendMessage(jid, content, sendOptions)
      return msg?.key?.id
    }
  }

  if (typeof sock.sendTable !== 'function') {
    sock.sendTable = (jid, title, headers, rows, quoted, options = {}) =>
      send(jid, {
        headerText: options.headerText,
        title,
        table: [headers.map(String), ...rows.map((r) => r.map(String))],
        footerText: options.footer
      }, quoted)
  }

  if (typeof sock.sendList !== 'function') {
    sock.sendList = (jid, title, items, quoted, options = {}) =>
      send(jid, {
        headerText: options.headerText,
        title,
        table: items.map((i) => (Array.isArray(i) ? i.map(String) : [String(i)])),
        noHeading: true,
        footerText: options.footer
      }, quoted)
  }

  if (typeof sock.sendCodeBlock !== 'function') {
    sock.sendCodeBlock = (jid, code, quoted, options = {}) =>
      send(jid, {
        headerText: options.title,
        code,
        language: options.language || 'javascript',
        footerText: options.footer
      }, quoted)
  }

  // --- V2: format input lama ("a | b;;c | d") dipertahankan
  const splitCols = (str) =>
    typeof str !== 'string' ? [] : (str.includes('|') ? str.split('|') : str.split(',')).map((x) => x.trim())

  if (typeof sock.sendTableV2 !== 'function') {
    sock.sendTableV2 = (jid, arr, quoted, options = {}) => {
      const [tableTitle, headerStr, ...rest] = arr
      const header = splitCols(headerStr)
      const rows = rest.flatMap((r) => (typeof r === 'string' ? r.split(';;').map(splitCols) : []))
      return send(jid, {
        headerText: options.headerText || options.title,
        contentText: options.text,
        title: tableTitle,
        table: [header, ...rows],
        footerText: options.footer
      }, quoted)
    }
  }

  if (typeof sock.sendCodeBlockV2 !== 'function') {
    sock.sendCodeBlockV2 = (jid, code, quoted, options = {}) =>
      send(jid, {
        headerText: options.text || options.title,
        code,
        language: options.language || 'javascript',
        footerText: options.footer
      }, quoted)
  }

  if (typeof sock.sendLinkV2 !== 'function') {
    sock.sendLinkV2 = (jid, text, links = [], quoted, options = {}) =>
      send(jid, {
        links: links.map((l, i) => {
          const o = typeof l === 'string' ? { url: l } : l
          const name = o.displayName || `Link ${i + 1}`
          return {
            text: i === 0 ? text : name,
            title: name,
            url: o.url,
            displayName: name,
            sources: [{ displayName: o.sourceDisplayName || `Source ${i + 1}`, subtitle: o.sourceSubtitle || ' ', url: o.url }]
          }
        }),
        footerText: options.footer
      }, quoted)
  }

  if (typeof sock.cekIDSaluran !== 'function') {
    sock.cekIDSaluran = async (url) => {
      const r = await sock.newsletterMetadata('invite', channelKey(url))
      if (!r) return null
      const t = r.thread_metadata || {}
      return {
        id: r.id,
        state: r.state?.type ?? r.state,
        creation_time: +(t.creation_time ?? r.creation_time) || 0,
        name: t.name?.text ?? r.name,
        description: t.description?.text ?? r.description,
        invite: t.invite ?? r.invite,
        subscribers: +(t.subscribers_count ?? r.subscribers) || 0,
        verification: t.verification ?? r.verification,
        viewer_metadata: r.viewer_metadata
      }
    }
  }

  if (typeof sock.swgc !== 'function') {
    sock.swgc = (jid, content = {}, options = {}) => {
      if (!String(jid).endsWith('@g.us')) throw new Error('JID must be a group')
      const payload = { ...content, groupStatus: true }
      if (options.closeFriends) {
        payload.contextInfo = {
          ...(content.contextInfo || {}),
          statusAudienceMetadata: {
            audienceType: 2,
            listName: options.listName || 'Close Friends',
            listEmoji: options.listEmoji || '\u{1F49A}'
          }
        }
      }
      return sock.sendMessage(jid, payload)
    }
  }

  if (!sock.__nativeFlowCompat) {
    const _send = sock.sendMessage.bind(sock)
    sock.sendMessage = (jid, content, options) => _send(jid, convertInteractiveButtons(content), options)
    sock.__nativeFlowCompat = true
  }

  return sock
}