const HELP = `⚠️ *Reply file/pesan hasil* \`.crm\` *dulu, baru ketik* \`.run\`

*Format yang didukung:*
• file \`.js\` dari \`.crm -relay -file\` (\`=> conn.relayMessage(...)\`, atau versi \`> const newParentId = ...\` yang ada child-nya)
• file \`.json\` dari \`.crm -message -file\` (isi pesannya aja) atau \`.crm -raw -file\`
• file lama yang punya penanda \`RELAY_PAYLOAD_START\`

Payload dibaca statis (nggak di-eval), lalu dikirim pakai \`relayMessage\`.
Buat pesan media / yang ada Buffer-nya, pakai \`.relay\` langsung ke pesan aslinya.`;

const MARK_START = 'RELAY_PAYLOAD_START';
const MARK_END = 'RELAY_PAYLOAD_END';
const MAX_BYTES = 2 * 1024 * 1024; // file hasil .crm jauh di bawah ini
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const BUFFER_PLACEHOLDER = /^<Buffer \d+ bytes>$/;

/**
 * Deserialize JSON dengan dukungan Buffer & BigInt.
 */
function deserializePayloadExact(str) {
  return JSON.parse(str, (k, v) => {
    if (v && typeof v === 'object') {
      if (typeof v.__buf === 'string') {
        try {
          return Buffer.from(v.__buf, 'base64');
        } catch {
          return v.__buf;
        }
      }
      if (typeof v.__big === 'string') {
        try {
          return BigInt(v.__big);
        } catch {
          return v.__big;
        }
      }
    }
    return v;
  });
}

/**
 * Format lama: blok di antara marker START dan END (JSON lossless).
 * Pakai indexOf supaya tidak bergantung regex greedy/lazy yang rawan.
 */
function extractMarkerPayload(text) {
  const s = text.indexOf(MARK_START);
  const e = text.lastIndexOf(MARK_END);
  if (s === -1 || e === -1 || e <= s) return null;

  const raw = text.slice(s + MARK_START.length, e).trim();
  if (!raw) return null;

  try {
    return deserializePayloadExact(raw);
  } catch (err) {
    throw new Error(`Payload block ketemu tapi gagal di-parse: ${err.message}`);
  }
}

// ───────────────────────── snippet .js dari .crm ─────────────────────────

function stripFences(text) {
  const m = text.match(/```[a-z]*\n([\s\S]*?)\n```/i);
  return m ? m[1] : text;
}

/** .crm nambahin header komentar `// ...` di file besar, termasuk file .json. */
function stripLeadingComments(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('//'))) i++;
  return lines.slice(i).join('\n');
}

function describeNode(node, src) {
  return src.slice(node.start, Math.min(node.end, node.start + 60)).replace(/\s+/g, ' ');
}

/**
 * Evaluator statis untuk AST snippet .crm. Cuma bentuk yang memang ditulis .crm
 * yang diterima (literal, object/array, template, m.chat, JSON.stringify,
 * Buffer.from(...).toString(...)). Selain itu ditolak, jadi aman dari eksekusi kode.
 */
function evalNode(node, ctx) {
  switch (node.type) {
    case 'Literal':
      if (node.regex) break;
      if (node.bigint) return BigInt(node.bigint);
      return node.value;

    case 'TemplateLiteral': {
      let out = '';
      node.quasis.forEach((q, i) => {
        out += q.value.cooked;
        if (i < node.expressions.length) out += String(evalNode(node.expressions[i], ctx));
      });
      return out;
    }

    case 'Identifier':
      if (node.name === 'undefined') return undefined;
      if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, node.name)) return ctx.vars[node.name];
      break;

    case 'UnaryExpression': {
      if (!['-', '+', '!', 'void'].includes(node.operator)) break;
      const v = evalNode(node.argument, ctx);
      if (node.operator === '-') return -v;
      if (node.operator === '+') return +v;
      if (node.operator === '!') return !v;
      return undefined;
    }

    case 'ArrayExpression':
      return node.elements.map((el) => (el === null ? null : evalNode(el, ctx)));

    case 'ObjectExpression': {
      const obj = {};
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.kind !== 'init' || p.method) {
          throw new Error(`Ekspresi tidak didukung di snippet: \`${describeNode(p, ctx.src)}\``);
        }
        const key = p.computed
          ? String(evalNode(p.key, ctx))
          : p.key.type === 'Identifier'
            ? p.key.name
            : String(p.key.value);
        if (BLOCKED_KEYS.has(key)) continue;
        obj[key] = evalNode(p.value, ctx);
      }
      return obj;
    }

    case 'MemberExpression':
      if (
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.object.name === 'm' &&
        (node.property.name === 'chat' || node.property.name === 'sender')
      ) {
        return ctx.m[node.property.name];
      }
      break;

    case 'CallExpression': {
      const c = node.callee;
      if (c.type === 'MemberExpression' && !c.computed) {
        const args = node.arguments.map((a) => evalNode(a, ctx));

        if (c.object.type === 'Identifier' && c.object.name === 'JSON' && c.property.name === 'stringify') {
          return JSON.stringify(...args.slice(0, 3));
        }

        if (c.object.type === 'Identifier' && c.object.name === 'Buffer' && c.property.name === 'from') {
          if (typeof args[0] !== 'string' && !Array.isArray(args[0])) break;
          return Buffer.from(...args.slice(0, 2));
        }

        if (c.property.name === 'toString' && c.object.type === 'CallExpression') {
          const inner = evalNode(c.object, ctx);
          if (Buffer.isBuffer(inner)) return inner.toString(...args.slice(0, 1));
        }
      }
      break;
    }
  }

  throw new Error(`Ekspresi tidak didukung di snippet: \`${describeNode(node, ctx.src)}\``);
}

function findRelayCall(ast) {
  let found = null;
  (function walk(n) {
    if (!n || found) return;
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      !n.callee.computed &&
      n.callee.property.name === 'relayMessage'
    ) {
      found = n;
      return;
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && walk(x));
      else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast);
  return found;
}

async function loadAcorn() {
  try {
    const mod = await import('acorn');
    return { parse: mod.parse || mod.default?.parse, parseExpressionAt: mod.parseExpressionAt || mod.default?.parseExpressionAt };
  } catch {
    throw new Error('Modul `acorn` belum terinstall. Jalankan `npm i acorn` dulu, lalu coba lagi.');
  }
}

function unwrapAwait(n) {
  while (n && n.type === 'AwaitExpression') n = n.argument;
  return n;
}

function isRelayCall(n) {
  return (
    n?.type === 'CallExpression' &&
    n.callee.type === 'MemberExpression' &&
    !n.callee.computed &&
    n.callee.property.name === 'relayMessage'
  );
}

/**
 * Snippet .crm bisa berisi beberapa relayMessage berurutan (pesan induk + child),
 * child merujuk id hasil relay sebelumnya (`newParentId`, `id_0`, ...).
 */
function collectSteps(ast, src) {
  const steps = [];

  for (const st of ast.body) {
    if (st.type === 'ExpressionStatement') {
      const call = unwrapAwait(st.expression);
      if (!isRelayCall(call)) {
        throw new Error(`Statement tidak didukung di snippet: \`${describeNode(st, src)}\``);
      }
      steps.push({ call, name: null });
      continue;
    }

    if (st.type === 'VariableDeclaration') {
      for (const d of st.declarations) {
        const call = unwrapAwait(d.init);
        if (d.id.type !== 'Identifier' || !isRelayCall(call)) {
          throw new Error(`Statement tidak didukung di snippet: \`${describeNode(st, src)}\``);
        }
        steps.push({ call, name: d.id.name });
      }
      continue;
    }

    if (st.type === 'ReturnStatement' || st.type === 'EmptyStatement') continue;

    throw new Error(`Statement tidak didukung di snippet: \`${describeNode(st, src)}\``);
  }

  return steps;
}

async function parseSnippet(text) {
  const { parse } = await loadAcorn();

  let ast;
  try {
    ast = parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    });
  } catch (e) {
    throw new Error(`Snippet gagal di-parse: ${e.message}`);
  }

  let steps;
  try {
    steps = collectSteps(ast, text);
  } catch (e) {
    const call = findRelayCall(ast);
    if (!call) throw e;
    steps = [{ call, name: null }];
  }

  if (!steps.length) throw new Error('Pemanggilan `relayMessage(...)` nggak ketemu di snippet.');

  for (const { call } of steps) {
    if (call.arguments.length < 2) {
      throw new Error('`relayMessage(...)` di snippet kurang argumen (minimal jid + content).');
    }
  }

  return { steps, src: text };
}

const INTERACTIVE_TYPES = new Set(['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage']);

const PAYMENT_FLOW_BUTTONS = new Set(['review_and_pay', 'review_order', 'payment_info', 'payment_status', 'order_details', 'order_status', 'payment_method', 'send_location_payment']);

function isPaymentFlowMessage(content) {
  const buttons = content?.interactiveMessage?.nativeFlowMessage?.buttons;
  return Array.isArray(buttons) && buttons.some((b) => PAYMENT_FLOW_BUTTONS.has(b?.name));
}

/** Sama seperti `.relay` di crm: bungkus pesan rich/interactive yang polos supaya tampil. */
function prepareRelayContent(content) {
  const type = Object.keys(content || {}).find((v) => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(v));

  if (!type) return content;
  if (type === 'richResponseMessage') return { botForwardedMessage: { message: content } };
  // Pesan payment (review_and_pay / order_details) dikirim polos, jangan dibungkus viewOnceMessage
  if (type === 'interactiveMessage' && isPaymentFlowMessage(content)) return content;
  if (INTERACTIVE_TYPES.has(type)) return { viewOnceMessage: { message: content } };

  return content;
}

// ───────────────────────── deteksi format ─────────────────────────

function unwrapJsonPayload(obj) {
  const isWrapper =
    obj &&
    typeof obj.content === 'object' &&
    obj.content !== null &&
    ('chat' in obj || 'jid' in obj || 'options' in obj);
  return isWrapper ? obj : { chat: '-', content: obj, options: {} };
}

/** Hasil `.crm -raw -file`: { message: <WebMessageInfo>, node, additionalAttributes, additionalNodes } */
function unwrapRawDump(obj) {
  const inner = obj?.message;
  if (!inner || typeof inner !== 'object' || !inner.message || typeof inner.message !== 'object') return null;
  if (!('key' in inner) && !('additionalNodes' in obj) && !('additionalAttributes' in obj)) return null;

  const options = {};
  if (obj.additionalAttributes && Object.keys(obj.additionalAttributes).length) {
    options.additionalAttributes = obj.additionalAttributes;
  }
  if (Array.isArray(obj.additionalNodes) && obj.additionalNodes.length) {
    options.additionalNodes = obj.additionalNodes;
  }

  return { chat: '-', content: inner.message, options };
}

/** @returns {Promise<{format:string, payload?:object, snippet?:object}|null>} null = format nggak dikenali */
async function parseRelayPayload(text, m) {
  if (text.includes(MARK_START)) {
    const payload = extractMarkerPayload(text);
    if (payload) return { format: 'marker', payload };
  }

  // .crm nulis snippet dengan awalan `=>` (satu pemanggilan) atau `>` (beberapa pemanggilan)
  const body = stripLeadingComments(stripFences(text)).replace(/^\s*(?:=>|>)\s*/, '');

  if (/relayMessage\s*\(/.test(body)) {
    return { format: 'snippet', snippet: await parseSnippet(body) };
  }

  const jsonText = stripLeadingComments(body).trim();
  if (jsonText.startsWith('{')) {
    let obj;
    try {
      obj = deserializePayloadExact(jsonText);
    } catch (jsonErr) {
      // .crm nulis nilai `undefined` apa adanya, itu bukan JSON valid tapi masih literal JS yang aman dibaca statis
      try {
        const { parseExpressionAt } = await loadAcorn();
        obj = evalNode(parseExpressionAt(jsonText, 0, { ecmaVersion: 'latest' }), { m, src: jsonText });
      } catch {
        throw new Error(`Isinya mirip JSON tapi gagal di-parse: ${jsonErr.message}`);
      }
    }
    return { format: 'json', payload: unwrapRawDump(obj) || unwrapJsonPayload(obj) };
  }

  return null;
}

// ───────────────────────── validasi ─────────────────────────

function countBufferPlaceholders(value, depth = 0) {
  if (depth > 40 || value == null) return 0;
  if (typeof value === 'string') return BUFFER_PLACEHOLDER.test(value) ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((n, v) => n + countBufferPlaceholders(v, depth + 1), 0);
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.values(value).reduce((n, v) => n + countBufferPlaceholders(v, depth + 1), 0);
  }
  return 0;
}

/**
 * Validasi payload yang sudah di-parse.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload bukan object valid.');
  }
  if (!payload.content || typeof payload.content !== 'object' || Array.isArray(payload.content)) {
    throw new Error('Payload ketemu tapi field `content` kosong / bukan object.');
  }

  // Normalisasi chat: kalau kosong / "undefined" / "null" → fallback ke chat asal
  const rawChat = payload.chat ?? payload.jid;
  let chat = '-';
  if (typeof rawChat === 'string') {
    const t = rawChat.trim();
    if (t && t !== 'undefined' && t !== 'null' && t !== '-') chat = t;
  }
  if (chat !== '-' && !chat.includes('@')) {
    throw new Error(`Target chat di payload bukan JID valid: \`${chat}\``);
  }

  const missing = countBufferPlaceholders(payload.content);
  if (missing > 0) {
    throw new Error(
      `Payload punya ${missing} field Buffer yang di-dump .crm cuma sebagai placeholder ` +
      `(\`<Buffer N bytes>\`), jadi datanya udah hilang dan nggak bisa dikirim ulang.\n\n` +
      `Buat pesan media / yang ada Buffer-nya, pakai \`.relay\` langsung ke pesan aslinya.`
    );
  }

  return {
    chat,
    content: payload.content,
    options: payload.options && typeof payload.options === 'object' ? payload.options : {}
  };
}

// ───────────────────────── ambil isi pesan yang di-reply ─────────────────────────

async function react(conn, m, emoji) {
  try {
    return await conn.sendMessage(m.chat, {
      react: { text: emoji, key: m.reactKey || m.key }
    });
  } catch (e) {
    console.error('[run] Gagal react:', e.message);
  }
}

/**
 * Coba semua cara download file dari quoted.
 */
async function downloadQuotedBuffer(conn, quoted) {
  const methods = [
    ['quoted.download()', typeof quoted.download === 'function' && (() => quoted.download())],
    ['quoted.download1()', typeof quoted.download1 === 'function' && (() => quoted.download1())],
    [
      'conn.downloadMediaMessage(quoted)',
      typeof conn.downloadMediaMessage === 'function' && (() => conn.downloadMediaMessage(quoted))
    ],
    [
      'conn.downloadMediaMessage(quoted.msg)',
      typeof conn.downloadMediaMessage === 'function' && quoted.msg && (() => conn.downloadMediaMessage(quoted.msg))
    ]
  ];

  const attempts = [];
  for (const [label, fn] of methods) {
    if (!fn) {
      attempts.push(`${label} [tidak tersedia]`);
      continue;
    }
    try {
      const buf = await fn();
      if (buf && buf.length) return { buf, via: label };
      attempts.push(`${label} [hasil kosong]`);
    } catch (e) {
      attempts.push(`${label} [error: ${e.message}]`);
    }
  }

  throw new Error(`Gagal download file:\n${attempts.map((a) => `  - ${a}`).join('\n')}`);
}

function quotedInfo(quoted) {
  const inner = (quoted.message && quoted.type && quoted.message[quoted.type]) || quoted.msg || {};
  const mime = quoted.mimetype || inner.mimetype || '';
  const size = Number(inner.fileLength?.toString?.() ?? inner.fileLength ?? 0) || 0;
  const isDoc = quoted.isDocument === true || quoted.type === 'documentMessage';
  return { mime, size, isDoc, body: typeof quoted.body === 'string' ? quoted.body : '' };
}

/**
 * Kumpulin teks kandidat: file dokumen (kalau ada) lalu teks/caption pesan.
 */
async function collectSources(conn, quoted) {
  const info = quotedInfo(quoted);
  const sources = [];

  if (info.isDoc) {
    if (info.size > MAX_BYTES) {
      throw new Error(
        `File terlalu besar (${Math.round(info.size / 1024)} KB, batas ${MAX_BYTES / 1024} KB). ` +
        `Ini pasti bukan file hasil \`.crm\`.`
      );
    }
    const { buf, via } = await downloadQuotedBuffer(conn, quoted);
    if (buf.length > MAX_BYTES) {
      throw new Error(`File terlalu besar (${Math.round(buf.length / 1024)} KB, batas ${MAX_BYTES / 1024} KB).`);
    }
    sources.push({ via: `file (${via})`, text: buf.toString('utf8') });
  } else if (quoted.isMedia) {
    throw new Error('Yang di-reply itu gambar/video/audio/stiker, bukan file hasil `.crm`.');
  }

  if (info.body) sources.push({ via: 'teks pesan', text: info.body });

  if (!sources.length) {
    throw new Error('Pesan yang di-reply nggak punya file maupun teks.');
  }
  return sources;
}

async function runRestore(m, { conn }) {
  const quoted = m.quoted;
  if (!quoted) return m.reply(HELP);

  await react(conn, m, '⏳');

  try {
    const sources = await collectSources(conn, quoted);

    let parsed = null;
    const failures = [];
    for (const src of sources) {
      try {
        const res = await parseRelayPayload(src.text, m);
        if (res) {
          parsed = res;
          break;
        }
      } catch (e) {
        failures.push(`• ${src.via}: ${e.message}`);
      }
    }

    if (!parsed) {
      if (failures.length) throw new Error(failures.join('\n'));

      const first = sources[0].text;
      const preview = first.length > 400 ? first.slice(0, 400) + '\n…(dipotong)' : first;
      throw new Error(
        `Format isinya nggak dikenali (bukan snippet relayMessage, JSON, ataupun blok ${MARK_START}).\n\n` +
        `Bikin ulang pakai \`.crm -file\` (atau \`.crm -message -file\`), lalu reply file-nya.\n\n` +
        `── Preview isi ──\n${preview}`
      );
    }

    if (parsed.format === 'snippet') {
      const ctx = { m, src: parsed.snippet.src, vars: {} };

      for (const { call, name } of parsed.snippet.steps) {
        const step = validatePayload({
          chat: evalNode(call.arguments[0], ctx),
          content: evalNode(call.arguments[1], ctx),
          options: call.arguments[2] ? evalNode(call.arguments[2], ctx) : {},
        });

        const id = await conn.relayMessage(
          step.chat !== '-' ? step.chat : m.chat,
          prepareRelayContent(step.content),
          step.options
        );

        if (name) ctx.vars[name] = id;
      }
    } else {
      const { chat, content, options } = validatePayload(parsed.payload);
      const targetChat = chat !== '-' ? chat : m.chat;

      await conn.relayMessage(targetChat, prepareRelayContent(content), options);
    }

    await react(conn, m, '✅');
  } catch (e) {
    console.error('[run]', e);
    await react(conn, m, '❌');
    return m.reply(`❌ Gagal run: ${e.message}`);
  }
}

const pluginConfig = {
  name: 'run',
  alias: ['crun', 'runcrm'],
  category: 'owner',
  description: 'Eksekusi ulang payload relayMessage dari file hasil .crm — tanpa copy-paste manual',
  usage: '.run (reply file hasil .crm)',
  isOwner: true,
  isEnabled: true,
};

async function handler(m, ctx) {
  const client = ctx.conn || ctx.sock;
  if (!client) {
    return m.reply('❌ Client (conn/sock) tidak tersedia di context.');
  }
  return runRestore(m, { ...ctx, conn: client });
}

export { pluginConfig as config, handler };