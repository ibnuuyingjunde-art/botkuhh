import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;
import te from '../../src/lib/ichigo-error.js';
import { getDatabase } from '../../src/lib/ichigo-database.js';

const pluginConfig = {
    name: 'ai',
    alias: ['ai4chat', 'gemini', 'lynix'],
    category: 'ai',
    description: 'Chat cerdas dengan lyniX\'s AI (session aktif, mendukung tabel, kode, video, dll via AIRich)',
    usage: '.ai <pertanyaan> | reply pesan AI untuk lanjut topik',
    example: '.ai buatkan tabel perbandingan vue dan react',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
};

const API_BASE = 'https://api.theresav.eu/api/ai/gemini';

const API_KEY_ENC = 'VGF5Um9vQVBJa2V5';
const API_KEY = Buffer.from(API_KEY_ENC, 'base64').toString('utf-8');

const MAX_SESSION_HISTORY = 16;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 jam

function getAiSessions() {
    const db = getDatabase();
    if (!db?.db?.data) return null;
    if (!db.db.data.ai_sessions) db.db.data.ai_sessions = {};
    return db.db.data.ai_sessions;
}

function sessionKey(chatId, sender) {
    const s = String(sender || '').split('@')[0].split(':')[0];
    return `${chatId}|${s}`;
}

function loadHistory(chatId, sender) {
    const sessions = getAiSessions();
    if (!sessions) return [];
    const key = sessionKey(chatId, sender);
    const sess = sessions[key];
    if (!sess) return [];
    if (Date.now() - (sess.updatedAt || 0) > SESSION_TTL_MS) {
        delete sessions[key];
        return [];
    }
    return Array.isArray(sess.history) ? sess.history : [];
}

function saveHistory(chatId, sender, history) {
    const sessions = getAiSessions();
    if (!sessions) return;
    const key = sessionKey(chatId, sender);
    const trimmed = (history || []).slice(-MAX_SESSION_HISTORY).map((h) => ({
        role: h.role,
        content: String(h.content || '').substring(0, 800),
    }));
    sessions[key] = { history: trimmed, updatedAt: Date.now() };
    try {
        const db = getDatabase();
        db.save?.();
    } catch {}
}

function isReplyToBot(m, sock) {
    if (!m.quoted) return false;
    const botNum = sock?.user?.id?.split(':')[0] || '';
    const quotedSender = m.quoted.sender || m.quoted.key?.participant || '';
    if (m.quoted.key?.fromMe) return true;
    if (quotedSender && botNum && String(quotedSender).includes(botNum)) return true;
    return false;
}

function buildHistoryContext(history) {
    if (!history?.length) return '';
    const lines = history.slice(-12).map((h) => {
        const role = h.role === 'assistant' ? 'lyniX\'s' : 'User';
        return `${role}: ${h.content}`;
    });
    return `\n\n[RIWAYAT PERCAKAPAN — lanjutkan topik yang sama, jangan reset konteks]\n${lines.join('\n')}\n[/RIWAYAT]\n`;
}

const systemPrompt = `Kamu adalah asisten AI yang cerdas dan canggih bernama lyniX's (bukan Ichigo).
Gunakan format markdown secara ketat:
1. Jika membuat daftar perbandingan atau sekumpulan data, SELALU gunakan format tabel markdown (diawali dan diakhiri dengan '|').
2. Jika memberikan kode pemrograman, SELALU bungkus dengan markdown code block (\`\`\`bahasa ... \`\`\`).
3. Gunakan formatting teks tebal (*teks*) untuk menekankan sesuatu, atau hashtag (#) untuk judul / penjelas besar.
4. Pisahkan setiap ide/poin berbeda dengan baris kosong, supaya setiap bagian bisa dirender sebagai bubble percakapan terpisah.
5. Jika kamu ingin menampilkan VIDEO (misalnya hasil pencarian/download yang menghasilkan link video langsung), JANGAN tulis sebagai link markdown biasa atau teks penjelasan panjang. Tulis di BARIS TERSENDIRI dengan format persis:
   VIDEO: <url-video-langsung>
   - URL harus link file video langsung (biasanya berakhiran .mp4, .mkv, .webm, atau .mov), bukan halaman/link perantara.
   - Jangan bungkus dengan tanda kurung, kutip, atau markdown link [teks](url) — cukup "VIDEO: " diikuti URL mentah.
   - Kalau ada teks penjelasan untuk video itu, tulis di baris/paragraf terpisah SEBELUM baris "VIDEO: ..." tersebut, jangan digabung satu baris.
6. WAJIB akhiri seluruh jawabanmu dengan SATU baris terakhir berformat persis:
   SARAN: pertanyaan lanjutan 1 | pertanyaan lanjutan 2 | pertanyaan lanjutan 3
   Isi dengan 2-3 pertanyaan lanjutan singkat (maks 8 kata) yang relevan dengan topik jawabanmu. Baris ini harus jadi baris paling akhir, tidak boleh ada teks lain sesudahnya.
7. Jika user meminta dibuatkan PLUGIN untuk bot WhatsApp ini (ESM/JavaScript), WAJIB ikuti struktur project bot secara persis, jangan pakai gaya bebas atau library lain:
   - Import wajib pakai ES Module ("import ... from ..."), tidak boleh pakai require().
   - Selalu ada objek "pluginConfig" berisi minimal field: name, alias (array), category, description, usage, example, isOwner, isPremium, isGroup, isPrivate, cooldown, energi, isEnabled (semua boolean kecuali disebutkan lain).
   - Selalu ada fungsi "async function handler(m, { sock }) { ... }" sebagai entry point command, JANGAN ubah nama parameter ini.
   - Ambil teks perintah dari "m.text?.trim()", balas pesan pakai "m.reply(...)", reaksi emoji pakai "m.react('emoji')".
   - Kalau butuh helper error standar, import "te" dari "../../src/lib/ichigo-error.js" dan panggil di blok catch: "m.reply(te(m.prefix, m.command, m.pushName))".
   - Kalau butuh HTTP request ke API eksternal, import "f" dari "../../src/lib/ichigo-http.js" alih-alih pakai axios/fetch langsung, kecuali user secara eksplisit minta pakai axios/fetch.
   - Selalu tutup plugin dengan baris ekspor persis: "export { pluginConfig as config, handler };".
   - Bungkus SELURUH kode plugin dalam SATU blok kode markdown (\`\`\`javascript ... \`\`\`), jangan dipecah jadi beberapa blok kode terpisah untuk satu plugin yang sama.

   FORMATTING KODE (WAJIB, ini yang paling sering dilanggar):
   - Tulis kode seperti kode JavaScript pada umumnya yang rapi: SATU statement per baris. JANGAN PERNAH menumpuk banyak statement/pernyataan dalam satu baris panjang meskipun itu valid secara sintaks (misalnya jangan tulis "const pluginConfig = { name: 'x', alias: [...] };" semuanya nempel jadi satu baris — setiap field pluginConfig ada di barisnya sendiri).
   - Indentasi konsisten 2 spasi per level kedalaman kurung kurawal/kurung siku. Isi function, object literal, if/try/catch WAJIB diindentasi ke dalam, jangan rata kiri semua.
   - Beri satu baris kosong di antara blok logis yang berbeda: setelah blok import, setelah pluginConfig, sebelum/sesudah try-catch, dan antar langkah besar di dalam handler. Jangan tulis semuanya mepet tanpa jarak.
   - Nama variabel, penutup kurung "}", ")" , ");" masing-masing sesuai konteksnya sendiri di baris yang wajar — jangan pernah membiarkan sisa kode "terpotong" atau menempel ke baris lain seperti hasil auto-generate yang belum dirapikan.
   - Sebelum menulis blok kode akhir, bayangkan hasilnya akan dibaca manusia di editor kode (VS Code) — kalau terlihat seperti satu paragraf panjang yang dipaksa masuk ke code block, itu SALAH dan harus ditulis ulang dengan baris-baris terpisah.

   Kalau butuh kirim pesan kaya (gambar/tabel/kode/video/dsb), SELALU pakai class "AIRich" dari "../../src/lib/ichigo-builder.js" — JANGAN pernah pakai class lain (Button, Carousel, dsb) walaupun user minta tampilan "carousel" atau "card", tetap render pakai AIRich (misalnya banyak gambar cukup dipanggil addImage() berkali-kali secara berurutan). AIRich HANYA punya method-method berikut, JANGAN PERNAH mengarang method lain (seperti setTitle, setBody, setFooter, setImage, addReply, addUrl, toCard, build — method-method itu TIDAK ADA di AIRich):
      - new AIRich(sock)
      - .addText(string, opts?)
      - .addImage(url, opts?)
      - .addVideo(url, opts?)
      - .addTable(rows: string[][], opts?)   // baris pertama = header
      - .addCode(language, codeString, opts?)
      - .addPost(objectAtauArrayOfObject, opts?)
      - .addSuggest(arrayOfString)
      - .send(m.chat, { quoted: m })          // kirim pesan baru, WAJIB di-await, hasilnya bisa disimpan ke variabel kalau nanti perlu di-sendEdit
      - .sendEdit()                            // edit pesan yang SAMA yang tadi di-send (dipakai kalau mau update status/loading jadi hasil akhir), WAJIB di-await

   KAPAN WAJIB PAKAI .addTable() DI DALAM PLUGIN YANG DIGENERATE:
   - Setiap kali hasil dari API eksternal berbentuk DAFTAR/LIST dengan beberapa item yang masing-masing punya beberapa atribut (misalnya hasil pencarian lagu/video dengan judul+durasi+channel, daftar produk dengan nama+harga, daftar statistik, dsb) — JANGAN dirender sebagai teks panjang berulang lewat addText(), render sebagai SATU .addTable() dengan baris pertama = header kolom.
   - Kolom tabel harus singkat (maks 3-4 kolom, teks tiap sel diringkas) supaya enak dibaca di layar WhatsApp yang sempit.
   - Kalau cuma ada 1 item / 1 pasang key-value sederhana, cukup pakai addText(), tidak perlu dipaksakan jadi tabel.
   - Kalau hasil dari API eksternal berupa link video langsung (misalnya hasil download), render pakai .addVideo(url), JANGAN ditaruh sebagai teks link biasa lewat addText().
   - Method chaining harus konsisten: setiap baris "aiRichVar.addXxx(...)" hanya boleh memanggil method dari daftar di atas. Kalau ragu fitur tertentu tidak ada method-nya di AIRich, JANGAN dipaksakan — cukup render sebagai addText() biasa dengan teks yang menjelaskan info tersebut.
8. Kalau user minta kode LAIN yang bukan plugin bot (misalnya snippet umum, HTML, Python, dsb) dan tidak menyebutkan bahwa itu untuk bot ini, ikuti gaya penulisan yang rapi, idiomatik, dan konsisten dengan bahasa yang diminta — TIDAK perlu memaksakan struktur plugin di atas.

CONTOH PLUGIN YANG BENAR (ikuti persis pola formatting dan penggunaan addTable ini, ganti isi sesuai permintaan user):

\`\`\`javascript
import { f } from "../../src/lib/ichigo-http.js";
import te from "../../src/lib/ichigo-error.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "contoh",
  alias: ["contohalias"],
  category: "tools",
  description: "Deskripsi singkat fitur ini",
  usage: ".contoh <input>",
  example: ".contoh halo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const query = m.text?.trim();

  if (!query) {
    return m.reply(\`Penggunaan: \${m.prefix}\${m.command} <input>\`);
  }

  m.react("🕕");

  try {
    const data = await f(\`https://api.contoh.com/search?q=\${encodeURIComponent(query)}\`);

    if (!data || !data.results || !data.results.length) {
      m.react("❌");
      return m.reply("Data tidak ditemukan.");
    }

    const rows = [
      ["No", "Judul", "Durasi"],
      ...data.results.map((item, i) => [
        String(i + 1),
        item.title,
        item.duration,
      ]),
    ];

    const rich = new AIRich(sock)
      .addText(\`# Hasil pencarian: \${query}\`)
      .addTable(rows);

    await rich.send(m.chat, { quoted: m });
    m.react("✅");
  } catch (err) {
    console.error("[Contoh] Error:", err.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
\`\`\`

Pastikan semua respon terstruktur dengan baik agar sistem AIRich dapat merendernya dengan cantik.`;

const MAX_GET_PROMPT_LENGTH = 3500;

async function parseGeminiResponse(res) {
    if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    return data.result ?? data.message ?? data.text ?? '';
}

async function askGeminiViaPost(prompt) {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-apikey': API_KEY
        },
        body: JSON.stringify({ prompt })
    });

    return parseGeminiResponse(res);
}

async function askGeminiViaGet(prompt) {

    const safePrompt = prompt.length > MAX_GET_PROMPT_LENGTH
        ? prompt.slice(0, MAX_GET_PROMPT_LENGTH)
        : prompt;

    const url = new URL(API_BASE);
    url.searchParams.set('prompt', safePrompt);

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'x-apikey': API_KEY }
    });

    return parseGeminiResponse(res);
}

async function askGemini(message, history = []) {
    const historyCtx = buildHistoryContext(history);
    const prompt = `${systemPrompt}${historyCtx}\n\nPesan user sekarang:\n${message}`;

    try {
        return await askGeminiViaPost(prompt);
    } catch (postErr) {
        console.error('[AI] POST gagal, coba fallback GET:', postErr.message);
        return await askGeminiViaGet(prompt);
    }
}

const CODE_LANGS = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'json', 'bash', 'sh',
    'html', 'css', 'sql', 'jsx', 'tsx', 'java', 'kotlin', 'swift', 'go', 'rust',
    'php', 'csharp', 'cpp', 'c'
];

/**
 * Kadang API cuma bungkus kode pakai SATU backtick + nama bahasa
 * (`javascript ...kode... `) bukan tiga backtick (```javascript), dan tanpa
 * baris baru sama sekali — bahkan kalau kodenya sendiri mengandung template
 * literal (backtick lagi di dalamnya, contoh: `Status: ${x}`), jadi backtick
 * penutup asli BUKAN backtick pertama yang ketemu setelah pembuka.
 *
 * Strategi: setelah nemu pembuka `bahasa , cari batas akhir blok. Prioritas:
 * 1) Kalau ada closing triple-backtick (```) ASLI sebelum batas lain, itu
 *    dipakai sebagai penutup (paling akurat, karena systemPrompt memang
 *    minta AI nutup kode pakai triple backtick).
 * 2) Kalau tidak ada, cari batas blok berupa markdown hr ("---"), heading
 *    baru ("# ..."), ATAU awal baris tabel ("| ..."), lalu backtick TERAKHIR
 *    sebelum batas itu dianggap penutup.
 * Hasilnya dibungkus jadi ```bahasa ... ``` biasa dengan baris baru sungguhan,
 * plus reformat kasar biar nggak numpuk 1 baris di dalam box kode.
 */

const PROTECT_PATTERNS = [
    {
        standalone: true,
        regex: /\b(?:import|export)\s*\{[^{}]*\}\s*(?:from\s*['"][^'"]+['"])?\s*;?/g,
    },
    {
        standalone: true,
        regex: /\b(?:const|let|var)\s*\{[^{}]*\}\s*=\s*[^;{}]+;?/g,
    },
    {
        standalone: false,
        regex: /\{\s*[a-zA-Z0-9_$]+(?:\s*,\s*[a-zA-Z0-9_$]+)*\s*\}(?=\s*[),])/g,
    },
];

/**
 * Sisipkan newline struktural (setelah '{', sebelum/sesudah '}', setelah
 * ';') HANYA ketika posisi karakter itu benar-benar bagian dari kode,
 * bukan isi string/template literal. Tanpa ini, sesuatu seperti
 * `\`Halo ${nama}\`` akan ikut dicincang karena '{' di dalam `${...}`
 * dianggap sama dengan '{' pembuka blok kode.
 */
function insertStructuralNewlines(src) {
    let out = '';
    let mode = 'code'; 
    let quote = '';
    let inTemplateExpr = false;
    let exprDepth = 0;

    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        const prev = src[i - 1];

        if (mode === 'code') {
            if (c === '"' || c === "'") {
                mode = 'string';
                quote = c;
                out += c;
                continue;
            }
            if (c === '`') {
                mode = 'template';
                out += c;
                continue;
            }
            if (c === '{') {
                out += '{\n';
                continue;
            }
            if (c === '}') {
                out += '\n}\n';
                continue;
            }
            if (c === ';') {
                out += ';\n';
                continue;
            }
            out += c;
            continue;
        }

        if (mode === 'string') {
            out += c;
            if (c === quote && prev !== '\\') mode = 'code';
            continue;
        }

        if (!inTemplateExpr) {
            if (c === '`' && prev !== '\\') {
                mode = 'code';
                out += c;
                continue;
            }
            if (c === '$' && src[i + 1] === '{') {
                inTemplateExpr = true;
                out += '${';
                i++;
                exprDepth = 0;
                continue;
            }
            
            out += c;
            continue;
        }

        if (c === '{') {
            exprDepth++;
            out += c;
            continue;
        }
        if (c === '}') {
            if (exprDepth === 0) {
                inTemplateExpr = false;
                out += '}';
                continue;
            }
            exprDepth--;
            out += c;
            continue;
        }
        out += c;
    }

    return out;
}

function roughlyFormatCode(code) {
    const trimmedInput = code.trim();
    const lines = trimmedInput.split('\n');

    const looksAlreadyFormatted =
        lines.length > 3 && lines.every((l) => l.length < 200);
    if (looksAlreadyFormatted) {
        return lines.map((l) => l.replace(/\s+$/, '')).join('\n');
    }

    const protectedSnippets = [];
    let working = trimmedInput;
    for (const { standalone, regex } of PROTECT_PATTERNS) {
        working = working.replace(regex, (match) => {
            protectedSnippets.push(match.trim());
            const token = `__PROTECT_${protectedSnippets.length - 1}__`;
            return standalone ? `\n${token}\n` : token;
        });
    }

    let formatted = insertStructuralNewlines(working)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

        .reduce((acc, line) => {
            if ((/^;$/.test(line) || /^\)+;?$/.test(line)) && acc.length) {
                acc[acc.length - 1] += line;
            } else {
                acc.push(line);
            }
            return acc;
        }, [])
        .join('\n');

    formatted = formatted.replace(
        /__PROTECT_(\d+)__/g,
        (_, i) => protectedSnippets[Number(i)],
    );

    let depth = 0;
    const indentedLines = formatted.split('\n').map((rawLine) => {
        const line = rawLine.trim();
        if (/^\}/.test(line)) depth = Math.max(depth - 1, 0);
        const withIndent = '  '.repeat(depth) + line;
        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        if (!/^\}/.test(line)) depth = Math.max(depth + opens - closes, 0);
        return withIndent;
    });

    return indentedLines.filter((l) => l.trim().length).join('\n');
}

function normalizePseudoCodeFences(text) {
    const openRe = new RegExp('`(' + CODE_LANGS.join('|') + ')\\b[ \\t]*', 'i');
    let result = '';
    let rest = text;

    while (true) {
        const m = rest.match(openRe);
        if (!m) {
            result += rest;
            break;
        }

        const matchIndex = m.index;
        const lang = m[1].toLowerCase();
        const codeStart = matchIndex + m[0].length;

        result += rest.slice(0, matchIndex);

        const after = rest.slice(codeStart);

        const tripleClose = after.indexOf('```');

        const boundaryMatch = after.match(/\n[ \t]*(?:---|#{1,6}\s|\|)/);
        const boundaryIndex = boundaryMatch ? boundaryMatch.index : after.length;

        let code;
        let consumedLength;

        if (tripleClose !== -1 && tripleClose < boundaryIndex) {
            code = after.slice(0, tripleClose);
            consumedLength = tripleClose + 3;
        } else {
            const segment = after.slice(0, boundaryIndex);
            const lastBacktick = segment.lastIndexOf('`');

            if (lastBacktick !== -1) {
                code = segment.slice(0, lastBacktick);
                consumedLength = lastBacktick + 1;
            } else {
                code = segment;
                consumedLength = segment.length;
            }
        }

        result += `\n\`\`\`${lang}\n${roughlyFormatCode(code.trim())}\n\`\`\`\n`;
        rest = after.slice(consumedLength);
    }

    return result;
}

/**
 * Kadang API mengembalikan tabel markdown tanpa baris baru sama sekali,
 * semua baris tabel nempel jadi satu kalimat panjang dipisah spasi, contoh:
 *   "... | Kategori | Tipe Data | |---|---|---| | Primitif | String | ..."
 * Batas antar-baris tetap bisa dikenali: baris sebelumnya SELALU ditutup '|'
 * lalu baris berikutnya SELALU dibuka '|' lagi, hanya dipisah spasi/kosong
 * (beda dengan isi sel yang selalu ada teksnya di antara dua '|').
 * Fungsi ini mencari rangkaian panjang token '|...|' yang nempel begitu,
 * lalu memecahnya balik jadi baris-baris terpisah supaya parser per-baris
 * di bawah bisa mendeteksinya sebagai tabel.
 */
function normalizeInlineTables(text) {
    return text.replace(/(?:\|[^|\n]*){4,}\|/g, (match) => {
        const withLineBreaks = match.replace(/\|[ \t]*\|/g, '|\n|');
        return `\n${withLineBreaks}\n`;
    });
}

/**
 * Ambil baris "SARAN: pertanyaan 1 | pertanyaan 2 | ..." yang WAJIB ada di
 * paling akhir jawaban (lihat instruksi ke-6 di systemPrompt), lalu pisahkan
 * dari teks jawaban supaya nggak ikut ke-render sebagai bubble teks biasa.
 * Kalau AI-nya nggak nurut (nggak nulis SARAN), fitur ini otomatis nggak
 * aktif — bukan error, cuma nggak ada chip saran yang ditambahin.
 */
function extractSuggestions(text) {
    const match = text.match(/\n?\s*SARAN\s*:\s*(.+)$/i);

    if (!match) {
        return { text, suggestions: [] };
    }

    const suggestions = match[1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);

    return {
        text: text.slice(0, match.index).trim(),
        suggestions
    };
}

/**
 * Memecah teks balasan AI menjadi node-node AIRich sesuai API asli
 * ichigo-builder.js (v4.7):
 *   - aiRich.addText(string)              -> 1 bubble percakapan per paragraf
 *   - aiRich.addTable(string[][])         -> baris pertama = header
 *   - aiRich.addCode(language, codeString)
 *   - aiRich.addVideo(url)                -> baris "VIDEO: <url>" tersendiri
 *
 * Setiap paragraf teks (dipisah baris kosong) jadi addText tersendiri
 * supaya terasa seperti beberapa bubble chat, bukan satu blok teks besar.
 */
function buildAIRich(replyText, sock) {
    const aiRich = new AIRich(sock);

    const { text: cleanedText, suggestions } = extractSuggestions(replyText);

    const preprocessed = normalizeInlineTables(normalizePseudoCodeFences(cleanedText));
    const lines = preprocessed.split('\n');

    let mode = 'text'; 
    let buffer = [];
    let codeLang = '';

    const flushText = () => {
        if (!buffer.length) return;
        const block = buffer.join('\n').trim();
        buffer = [];
        if (!block) return;

        const paragraphs = block
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean);

        for (const paragraph of paragraphs) {
            aiRich.addText(paragraph);
        }
    };

    const flushTable = () => {
        if (!buffer.length) return;
        const rawRows = buffer;
        buffer = [];

        const rows = rawRows
            .map((line) =>
                line
                    .split('|')
                    .map((c) => c.trim())
                    .slice(1, -1)
            )
            
            .filter((row) => !row.every((c) => /^:?-+:?$/.test(c)));

        if (rows.length && rows.every((row) => row.length > 0)) {
            aiRich.addTable(rows);
        } else if (rawRows.length) {
            
            aiRich.addText(rawRows.join('\n'));
        }
    };

    const VIDEO_LINE_RE = /^VIDEO:\s*<?(\S+?)>?$/i;

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();

        if (trimmed.startsWith('```')) {
            if (mode === 'code') {
                aiRich.addCode(codeLang || 'text', buffer.join('\n'));
                buffer = [];
                mode = 'text';
            } else {
                if (mode === 'table') flushTable();
                else flushText();
                mode = 'code';
                codeLang = trimmed.slice(3).trim() || 'text';
            }
            continue;
        }

        if (mode === 'code') {
            buffer.push(rawLine);
            continue;
        }

        const videoMatch = trimmed.match(VIDEO_LINE_RE);
        if (videoMatch) {
            if (mode === 'table') flushTable();
            else flushText();
            mode = 'text';
            aiRich.addVideo(videoMatch[1]);
            continue;
        }

        const isTableRow = trimmed.length > 1 && trimmed.startsWith('|') && trimmed.endsWith('|');

        if (isTableRow) {
            if (mode === 'text') flushText();
            mode = 'table';
            buffer.push(trimmed);
            continue;
        }

        if (mode === 'table') {
            flushTable();
            mode = 'text';
        }

        buffer.push(rawLine);
    }

    if (mode === 'code') {
        aiRich.addCode(codeLang || 'text', buffer.join('\n'));
    } else if (mode === 'table') {
        flushTable();
    } else {
        flushText();
    }

    if (!aiRich.sections.length) {
        aiRich.addText(replyText);
    }

    if (suggestions.length) {
        aiRich.addSuggest(suggestions);
    }

    return aiRich;
}

async function handler(m, { sock }) {
    let text = m.text?.trim() || '';

    // Kalau user reply ke pesan bot tanpa teks command, ambil body saja
    if (!text && m.body) text = String(m.body).trim();

    // Strip prefix+command dari text kalau masih ada
    if (m.prefix && m.command && text) {
        const re = new RegExp(`^\\${m.prefix}?${m.command}\\s*`, 'i');
        text = text.replace(re, '').trim();
    }

    if (!text) {
        return m.reply(
            `🤖 *lyniX's AI*\n\n` +
            `> Halo! Aku *lyniX's*, asisten cerdas dengan memori percakapan.\n\n` +
            `*Cara penggunaan:*\n` +
            `> \`${m.prefix}ai <pertanyaan>\`\n` +
            `> Reply pesan aku + ketik lanjutannya biar tetap 1 topik\n\n` +
            `*Contoh:*\n` +
            `> \`${m.prefix}ai buatkan tabel jadwal piket\`\n` +
            `> (lalu reply jawaban) \`tambahin hari Minggu juga\``
        );
    }

    m.react('🕕').catch(() => {});

    let placeholderMsg;
    const sender = m.sender || m.key?.participant || m.key?.remoteJid || '';
    const chatId = m.chat;

    // Session: selalu load history; lebih kuat kalau reply ke pesan bot
    let history = loadHistory(chatId, sender);
    const continuing = isReplyToBot(m, sock) || history.length > 0;

    try {
        const thinking = continuing
            ? `🕐 _lyniX's lanjut topik sebelumnya..._`
            : `🕐 _lyniX's sedang berpikir..._`;
        const placeholder = new AIRich(sock, { dynamic: true }).addText(thinking);
        placeholderMsg = await placeholder.send(m.chat, { quoted: m });

        const replyText = await askGemini(text, history);

        if (!replyText) {
            throw new Error('Respon AI kosong');
        }

        // Simpan session
        const nextHistory = [
            ...history,
            { role: 'user', content: text },
            { role: 'assistant', content: replyText.substring(0, 1200) },
        ];
        saveHistory(chatId, sender, nextHistory);

        const aiRich = buildAIRich(replyText, sock);
        await aiRich.sendEdit(m.chat, placeholderMsg.key.id);

        m.react('✅').catch(() => {});
    } catch (error) {
        console.error('[AI Error]', error);
        m.react('☢').catch(() => {});

        if (placeholderMsg) {
            try {
                await new AIRich(sock)
                    .addText(te(m.prefix, m.command, m.pushName))
                    .sendEdit(m.chat, placeholderMsg.key.id);
                return;
            } catch {}
        }

        return m.reply(te(m.prefix, m.command, m.pushName));
    }
}

export { pluginConfig as config, handler };