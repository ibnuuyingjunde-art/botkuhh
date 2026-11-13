/**
 * lyniX's AI Agent
 * - Trigger: kata "ai" terpisah / custom nama / mention / reply bot
 * - Session + custom call-name per user
 * - Bisa pakai fitur bot (reactch, dll) via ACTION tags + slot-filling
 * - Loading = composing only (tanpa bubble)
 * - Bisa kirim rich message (AIRich) kalau ada tabel/kode
 */
import { getDatabase } from "./ichigo-database.js";
import config from "../../config.js";
import { setBounded } from "./ichigo-bounded.js";
import axios from "axios";
import { getPlugin } from "./ichigo-plugins.js";

const COOLDOWN_MS = 3500;
const MAX_HISTORY = 18;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BOREDOM_INTERVAL_MS = 45 * 60 * 1000;
const MIN_IDLE_FOR_BOREDOM_MS = 25 * 60 * 1000;
const FREQ_TRACK_MAX = 40;
const PENDING_TTL_MS = 10 * 60 * 1000;

const userCooldowns = new Map();
let lastBoredomCheck = 0;
let sockRef = null;

const API_BASE = "https://api.theresav.eu/api/ai/gemini";
const API_KEY = Buffer.from("VGF5Um9vQVBJa2V5", "base64").toString("utf-8");
const CLOUD_URL = "https://api-cloud.my.id/ai/gemini";
const REACT_API = "https://api.theresav.eu/api/premium";

const CHANNEL_REGEX =
  /https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/\d+/i;
const EMOJI_REGEX =
  /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;

const PERSONA = `Kamu adalah asisten AI WhatsApp bernama lyniX's (bisa diganti nama panggilan oleh user).
Kamu hidup, ramah, santai, punya perasaan, bahasa Indonesia natural.

KEMAMPUAN FITUR BOT — kalau user minta fitur, bantu kumpulkan data lalu keluarkan ACTION di akhir jawaban:
1) Reaction saluran/channel WhatsApp
   Butuh: link POSTINGAN channel (bukan cuma link channel) + 1 emoji
   Contoh link valid: https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c/1452
   Kalau user belum kasih link/emoji, TANYAKAN yang kurang. Jangan bilang "sudah dikirim" sebelum ACTION.
   Format ACTION (taruh di baris akhir):
   [ACTION:REACTCH url=https://whatsapp.com/channel/xxx/123 emoji=🥹]

2) Ganti nama panggilan AI (user bilang "panggil kamu titut" / "nama kamu jadi X")
   [ACTION:SETNAME name=titut]
   Setelah set, user bisa panggil dengan nama itu tanpa bilang "ai".

3) Hapus nama panggilan custom
   [ACTION:CLEARNAME]

4) Sticker dari gambar (user kirim/reply gambar + minta sticker)
   [ACTION:STICKER]

5) Jalankan fitur bot asli (plugin yang ada di bot)
   Kalau user minta fitur yang jelas (sticker, hidetag, play, yts, dll) dan argumen cukup:
   [ACTION:PLUGIN name=reactch args=link_emoji]
   [ACTION:PLUGIN name=sticker args=]
   [ACTION:PLUGIN name=yts args=query lagu]
   name = nama command tanpa prefix. args = teks argumen (boleh kosong).
   Jangan pakai PLUGIN untuk fitur berbahaya owner-only kecuali user owner.
   Kalau argumen kurang, TANYA dulu — jangan bilang sudah dijalankan.

ATURAN ACTION:
- Hanya keluarkan ACTION jika data sudah lengkap & valid.
- Boleh lebih dari satu ACTION.
- Teks jawaban tetap natural; ACTION di baris paling akhir.
- Jangan tulis ACTION palsu.

ATURAN CHAT:
- Jawab singkat-sedang kecuali diminta panjang.
- Kalau tidak perlu jawab (spam/bukan untukmu), balas persis: SKIP\n- Kalau user kirim gambar dan vision aktif, WAJIB analisis isi gambar. Jangan bilang "tidak ada gambar" atau "saya tidak bisa melihat".
- Jangan mengaku sebagai model/API.
- Untuk tabel/perbandingan, pakai markdown table (| col |).
- Untuk kode, bungkus dengan \`\`\`bahasa ... \`\`\`.
`;

function getAgentState() {
  const db = getDatabase();
  if (!db?.db?.data) return null;
  if (!db.db.data.ai_agent) {
    db.db.data.ai_agent = {
      enabled: false,
      mode: "smart",
      personality: "lyniX's",
      allowPrivate: true,
      allowGroup: true,
      boredomChat: true,
      nimbrung: true, // boleh nyaut tanpa dipanggil (smart)
      sessions: {},
      pending: {},
      customNames: {}, // senderNumber -> [names]
      lastReplyAt: {}, // chatId -> timestamp (lanjut obrolan)
      freq: {},
      lastOwnerChat: 0,
      stats: { replies: 0, skips: 0, actions: 0 },
    };
  }
  const a = db.db.data.ai_agent;
  if (!a.customNames) a.customNames = {};
  if (!a.pending) a.pending = {};
  if (!a.lastReplyAt) a.lastReplyAt = {};
  if (typeof a.nimbrung !== "boolean") a.nimbrung = true;
  if (!a.stats) a.stats = { replies: 0, skips: 0, actions: 0 };
  return a;
}

function saveDb() {
  try {
    getDatabase()?.save?.();
  } catch {}
}

function isOnCooldown(id) {
  const t = userCooldowns.get(id);
  return t && Date.now() - t < COOLDOWN_MS;
}
function setCooldown(id) {
  setBounded(userCooldowns, id, Date.now(), 3000);
}

function sessionKey(chatId, sender) {
  return `${chatId}|${String(sender || "").split("@")[0].split(":")[0]}`;
}

function senderNum(sender) {
  return String(sender || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

function loadHistory(agent, key) {
  const sess = agent.sessions?.[key];
  if (!sess) return [];
  if (Date.now() - (sess.updatedAt || 0) > SESSION_TTL_MS) {
    delete agent.sessions[key];
    return [];
  }
  return Array.isArray(sess.history) ? sess.history : [];
}

function saveHistory(agent, key, history) {
  if (!agent.sessions) agent.sessions = {};
  agent.sessions[key] = {
    history: (history || []).slice(-MAX_HISTORY).map((h) => ({
      role: h.role,
      content: String(h.content || "").substring(0, 700),
    })),
    updatedAt: Date.now(),
  };
}

function getCustomNames(agent, sender) {
  const n = senderNum(sender);
  const list = agent.customNames?.[n];
  return Array.isArray(list) ? list.map((x) => String(x).toLowerCase()) : [];
}

function setCustomName(agent, sender, name) {
  const n = senderNum(sender);
  const clean = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/gi, "")
    .slice(0, 24);
  if (!clean || clean.length < 2) return null;
  if (["ai", "bot", "admin", "owner"].includes(clean)) return null;
  if (!agent.customNames) agent.customNames = {};
  const cur = new Set(agent.customNames[n] || []);
  cur.add(clean);
  agent.customNames[n] = [...cur].slice(-5); // max 5 nama
  return clean;
}

function clearCustomNames(agent, sender) {
  const n = senderNum(sender);
  if (agent.customNames) delete agent.customNames[n];
}

function hasStandaloneWord(text, word) {
  const w = String(word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!w) return false;
  const re = new RegExp(`(?:^|[^a-zA-Z0-9_])${w}(?=[^a-zA-Z0-9_]|$)`, "i");
  return re.test(String(text || ""));
}

function hasStandaloneAiWord(text) {
  return hasStandaloneWord(text, "ai");
}

function hasCustomCall(text, names) {
  return (names || []).some((n) => hasStandaloneWord(text, n));
}

function trackFrequency(agent, chatId, name) {
  if (!agent.freq) agent.freq = {};
  const cur = agent.freq[chatId] || { count: 0, lastAt: 0, name: name || "" };
  cur.count += 1;
  cur.lastAt = Date.now();
  if (name) cur.name = name;
  agent.freq[chatId] = cur;
  const keys = Object.keys(agent.freq);
  if (keys.length > FREQ_TRACK_MAX) {
    keys
      .sort((a, b) => (agent.freq[a].lastAt || 0) - (agent.freq[b].lastAt || 0))
      .slice(0, keys.length - FREQ_TRACK_MAX)
      .forEach((k) => delete agent.freq[k]);
  }
}

function getTopChats(agent, limit = 5) {
  return Object.entries(agent.freq || {})
    .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
    .slice(0, limit)
    .map(([id, v]) => ({ id, ...v }));
}

function ownerJids() {
  return (config.owner?.number || [])
    .map((n) => String(n).replace(/[^0-9]/g, ""))
    .filter(Boolean)
    .map((n) => `${n}@s.whatsapp.net`);
}

function isOwnerMsg(m) {
  const n = senderNum(m.sender);
  return (config.owner?.number || []).some(
    (o) => String(o).replace(/[^0-9]/g, "") === n,
  );
}

function shouldRespond(m, agent, sock) {
  if (!agent.enabled) return false;
  if (m.fromMe) return false;
  if (m.isCommand) return false;

  if (m.isGroup && agent.allowGroup === false) return false;
  if (!m.isGroup && agent.allowPrivate === false) return false;

  const body = (m.body || m.text || "").trim();
  const hasImg = !!(m.isImage || m.quoted?.isImage || m.type === "imageMessage");
  if (!body && !hasImg) return false;

  if (agent.mode === "always") return true;

  // pending feature dialog → selalu lanjut
  const key = sessionKey(m.chat, m.sender);
  const pend = agent.pending?.[key];
  if (pend && Date.now() - (pend.updatedAt || 0) < PENDING_TTL_MS) return true;

  // lanjut obrolan: agent baru balas di chat ini (< 8 menit) → boleh tanpa panggil nama
  const lastAt = agent.lastReplyAt?.[m.chat] || 0;
  const recentChat = Date.now() - lastAt < 8 * 60 * 1000;

  const botNum = sock?.user?.id?.split(":")[0] || "";
  const mentioned = (m.mentionedJid || []).some((j) =>
    String(j).includes(botNum),
  );
  const quotedBot =
    m.quoted &&
    (m.quoted.key?.fromMe ||
      String(m.quoted.sender || "").includes(botNum));
  const callName = /\b(lynix|lyni.?x|lynix'?s)\b/i.test(body);
  const callAi = hasStandaloneAiWord(body);
  const custom = hasCustomCall(body, getCustomNames(agent, m.sender));

  if (callAi || custom || mentioned || quotedBot || callName) return true;

  // Private: kalau lagi sesi aktif / kirim gambar → boleh nimbrung
  if (!m.isGroup) {
    if (hasImg) return true;
    if (recentChat) return true;
    // private tanpa panggil: hanya kalau nimbrung + pertanyaan/bantuan
    if (agent.nimbrung !== false) {
      if (/\?$/.test(body) || /\b(tolong|bantu|gimana|bagaimana|kenapa|apa itu)\b/i.test(body))
        return true;
    }
    return false;
  }

  // Grup + nimbrung: ikut obrolan tanpa harus dipanggil (tetap selektif biar ga spam)
  if (agent.nimbrung === false) return false;

  // gambar di grup + nimbrung → boleh analisis (biar ga harus nulis "ai")
  if (hasImg) return true;
  if (recentChat && body.length >= 2) return true;

  // pertanyaan / minta bantuan di grup
  if (
    /\?\s*$/.test(body) ||
    /\b(tolong|bantu|gimana|bagaimana|kenapa|apa itu|ada yang tau|ada yg tau)\b/i.test(body)
  ) {
    return true;
  }

  return false;
}

function detectMime(buf) {
  if (!buf || buf.length < 4) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Tanya model. Kalau ada imageBuffer → pakai Google Gemini vision (bisa lihat gambar beneran).
 */
async function askLynix(prompt, imageBuffer = null) {
  // VISION path: Google Gemini dengan inlineData (wajib kalau ada gambar)
  if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
    try {
      const key = config.geminiApiKey || config.APIkey?.google;
      if (!key) throw new Error("Gemini API key kosong — vision butuh key");
      const mime = detectMime(imageBuffer);
      const b64 = imageBuffer.toString("base64");
      // model yang support vision
      const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
      let lastErr = null;
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const res = await axios.post(
            url,
            {
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: mime, data: b64 } },
                  ],
                },
              ],
              generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
            },
            { timeout: 45000 },
          );
          const text =
            res.data?.candidates?.[0]?.content?.parts
              ?.map((p) => p.text)
              .filter(Boolean)
              .join("\n") || "";
          if (text) return text.trim();
          lastErr = new Error("empty vision response");
        } catch (e) {
          lastErr = e;
          console.error("[AIAgent] vision", model, e.message);
        }
      }
      if (lastErr) throw lastErr;
    } catch (e) {
      console.error("[AIAgent] vision fail:", e.message);
      // fallback: lanjut text-only dengan catatan
      prompt =
        prompt +
        "\n\n[Sistem: User mengirim gambar tapi vision gagal dibaca. Jujur bilang kamu belum bisa lihat gambarnya saat ini, minta user deskripsikan.]";
    }
  }

  // TEXT path
  try {
    const res = await axios.post(
      API_BASE,
      { prompt },
      {
        headers: { "Content-Type": "application/json", "x-apikey": API_KEY },
        timeout: 28000,
      },
    );
    const text =
      res.data?.result ?? res.data?.message ?? res.data?.text ?? "";
    if (text) return String(text).trim();
  } catch (e) {
    console.error("[AIAgent] theresav:", e.message);
  }

  try {
    const res = await axios.get(CLOUD_URL, {
      params: { message: prompt.slice(0, 5500), model: "auto" },
      timeout: 28000,
    });
    const r = res.data?.result;
    const text =
      typeof r === "string"
        ? r
        : r?.text || r?.response || r?.message || res.data?.message || "";
    if (text) return String(text).trim();
  } catch (e) {
    console.error("[AIAgent] cloud:", e.message);
  }

  try {
    const key = config.geminiApiKey || config.APIkey?.google;
    if (!key) throw new Error("no key");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const res = await axios.post(
      url,
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { timeout: 28000 },
    );
    const text =
      res.data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "";
    if (text) return text.trim();
  } catch (e) {
    console.error("[AIAgent] gemini:", e.message);
  }
  return null;
}

function pickMood(agent) {
  const moods = [
    "ceria",
    "santai",
    "penasaran",
    "peduli",
    "agak gabut",
    "semangat bantu",
    "tenang",
  ];
  return moods[Math.floor(((agent.stats?.replies || 0) + Date.now() / 60000) % moods.length)];
}

function buildPrompt({ history, userMessage, contextParts, mood, customNames, pending }) {
  const hist = (history || [])
    .slice(-12)
    .map((h) => `${h.role === "assistant" ? "lyniX's" : "User"}: ${h.content}`)
    .join("\n");

  const names =
    customNames?.length > 0
      ? `Nama panggilan custom user ini: ${customNames.join(", ")}`
      : "Belum ada nama panggilan custom.";

  const pendInfo = pending
    ? `Sedang menunggu data fitur: ${pending.feature} | slots=${JSON.stringify(pending.slots || {})}`
    : "Tidak ada pending fitur.";

  return `${PERSONA}

Mood: ${mood || "netral"}
${names}
${pendInfo}
${contextParts?.length ? `Konteks:\n- ${contextParts.join("\n- ")}` : ""}

${hist ? `[Riwayat]\n${hist}\n[/Riwayat]` : ""}

Pesan user: ${userMessage}

Balas natural. Kalau fitur butuh data, tanya yang kurang. Kalau data lengkap, sertakan ACTION di akhir. Kalau tidak perlu jawab: SKIP`;
}

function parseActions(text) {
  const actions = [];
  const re = /\[ACTION\s*:\s*(\w+)([^\]]*)\]/gi;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const type = m[1].toUpperCase();
    const params = {};
    const rest = m[2] || "";
    const pre = /(\w+)=([^\s\]]+)/g;
    let pm;
    while ((pm = pre.exec(rest)) !== null) {
      params[pm[1].toLowerCase()] = pm[2].trim();
    }
    // emoji may need special: emoji=🥹 or emoji after
    if (!params.emoji) {
      const em = rest.match(EMOJI_REGEX);
      if (em) params.emoji = em[0];
    }
    actions.push({ type, params });
  }
  return actions;
}

function stripActions(text) {
  return String(text || "")
    .replace(/\[ACTION\s*:\s*\w+[^\]]*\]/gi, "")
    .replace(/\n?SKIP\s*$/i, "")
    .trim();
}

function extractUrlEmojiFromText(text) {
  const t = String(text || "");
  const url = (t.match(CHANNEL_REGEX) || [])[0] || null;
  const emoji = (t.match(EMOJI_REGEX) || [])[0] || null;
  return { url, emoji };
}

function detectFeatureIntent(text) {
  const t = String(text || "").toLowerCase();
  if (
    /(react|reaksi|reaction).*(saluran|channel|ch\b)/i.test(t) ||
    /(saluran|channel).*(react|reaksi|reaction)/i.test(t) ||
    /reactch/i.test(t)
  ) {
    return "reactch";
  }
  if (
    /(panggil|nama).*(jadi|kamu|lu|loe|elo)|sekarang.*(panggil|nama)|ganti nama/i.test(
      t,
    )
  ) {
    return "setname";
  }
  if (/(jadiin|bikin|buat).*sticker|stiker/i.test(t)) return "sticker";
  return null;
}

function extractSetNameFromText(text) {
  const t = String(text || "");
  const patterns = [
    /panggil(?:an)?(?:\s+(?:kamu|lu|loe|elo|nama(?:mu)?))?\s*(?:jadi|dengan|pake|pakai|=)?\s*[\"']?([a-zA-Z0-9_\-]{2,24})[\"']?/i,
    /nama(?:mu| kamu| lu)?\s*(?:jadi|=)\s*[\"']?([a-zA-Z0-9_\-]{2,24})[\"']?/i,
    /sekarang\s+(?:gua|aku|saya)?\s*panggil\s+[\"']?([a-zA-Z0-9_\-]{2,24})[\"']?/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function execReactch(url, emoji) {
  if (!CHANNEL_REGEX.test(url)) throw new Error("Link postingan channel tidak valid");
  if (!emoji || !EMOJI_REGEX.test(emoji)) throw new Error("Emoji tidak valid");
  const response = await axios.get(`${REACT_API}/reactch`, {
    params: { url, reaction: emoji },
    timeout: 45000,
    headers: { "x-apikey": API_KEY },
    validateStatus: () => true,
  });
  const data = response.data || {};
  if (response.status < 200 || response.status >= 300 || data.status === false) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function runActions(actions, m, sock, agent) {
  const results = [];
  for (const act of actions) {
    try {
      if (act.type === "REACTCH") {
        const url = act.params.url || act.params.link;
        const emoji = act.params.emoji || act.params.reaction;
        await execReactch(url, emoji);
        results.push({ ok: true, msg: `✅ Reaksi ${emoji} terkirim ke postingan channel.` });
        agent.stats.actions = (agent.stats.actions || 0) + 1;
        // clear pending
        const key = sessionKey(m.chat, m.sender);
        if (agent.pending?.[key]) delete agent.pending[key];
      } else if (act.type === "SETNAME") {
        const name = setCustomName(agent, m.sender, act.params.name || act.params.nama);
        if (name) {
          results.push({
            ok: true,
            msg: `✅ Oke, mulai sekarang panggil aku *${name}* — aku bakal nyaut.`,
          });
        } else {
          results.push({ ok: false, msg: "❌ Nama panggilan tidak valid (min 2 huruf, tanpa spasi aneh)." });
        }
      } else if (act.type === "CLEARNAME") {
        clearCustomNames(agent, m.sender);
        results.push({ ok: true, msg: "✅ Nama panggilan custom dihapus. Panggil pakai *ai* lagi." });
      } else if (act.type === "STICKER") {
        let buf = null;
        try {
          if (m.isImage && m.download) buf = await m.download();
          else if (m.quoted?.download) buf = await m.quoted.download();
        } catch {}
        if (!buf) {
          results.push({ ok: false, msg: "❌ Kirim atau reply gambar dulu buat jadi sticker." });
        } else {
          try {
            if (sock.sendImageAsSticker) {
              await sock.sendImageAsSticker(m.chat, buf, m, {
                packname: "lyniX's",
                author: "AI Agent",
              });
              results.push({ ok: true, msg: "✅ Sticker siap." });
            } else {
              results.push({ ok: false, msg: "❌ Fitur sticker tidak tersedia di socket ini." });
            }
          } catch (e) {
            results.push({ ok: false, msg: `❌ Gagal bikin sticker: ${e.message}` });
          }
        }
      } else if (act.type === "PLUGIN") {
        const cmdName = String(act.params.name || act.params.cmd || "").toLowerCase().trim();
        const argsText = String(act.params.args || act.params.text || "").trim();
        if (!cmdName) {
          results.push({ ok: false, msg: "❌ Nama fitur (plugin) kosong." });
        } else {
          let plugin = null;
          try { plugin = getPlugin(cmdName); } catch {}
          if (!plugin?.handler) {
            results.push({ ok: false, msg: `❌ Fitur *${cmdName}* tidak ditemukan di bot.` });
          } else if (plugin.config?.isOwner && !isOwnerMsg(m)) {
            results.push({ ok: false, msg: `❌ Fitur *${cmdName}* khusus owner.` });
          } else {
            try {
              const fake = Object.create(m);
              fake.text = argsText;
              fake.args = argsText ? argsText.split(/\s+/) : [];
              fake.command = cmdName;
              fake.prefix = m.prefix || ".";
              fake.body = argsText ? `${fake.prefix}${cmdName} ${argsText}` : `${fake.prefix}${cmdName}`;
              // jalankan handler plugin asli
              await plugin.handler(fake, { sock, store: null, config, plugins: null });
              results.push({ ok: true, msg: `✅ Fitur *${cmdName}* dijalankan.` });
              agent.stats.actions = (agent.stats.actions || 0) + 1;
            } catch (e) {
              results.push({ ok: false, msg: `❌ Gagal jalankan *${cmdName}*: ${e.message}` });
            }
          }
        }
      }
    } catch (e) {
      results.push({ ok: false, msg: `❌ ${act.type}: ${e.message}` });
    }
  }
  return results;
}

function updatePendingFromMessage(agent, key, body, intent) {
  if (!agent.pending) agent.pending = {};
  let pend = agent.pending[key];
  if (intent === "reactch" || pend?.feature === "reactch") {
    const { url, emoji } = extractUrlEmojiFromText(body);
    if (!pend || pend.feature !== "reactch") {
      pend = { feature: "reactch", slots: { url: null, emoji: null }, updatedAt: Date.now() };
    }
    if (url) pend.slots.url = url;
    if (emoji) pend.slots.emoji = emoji;
    pend.updatedAt = Date.now();
    agent.pending[key] = pend;
    return pend;
  }
  return pend || null;
}

async function trySendRich(sock, m, text) {
  // Pakai AIRich kalau ada tabel/kode — gabung kemampuan .ai
  const hasTable = /^\s*\|.+\|/m.test(text);
  const hasCode = /```[\s\S]+?```/.test(text);
  if (!hasTable && !hasCode) {
    await sock.sendMessage(m.chat, { text }, { quoted: m });
    return;
  }
  try {
    const IchigoBuilder = (await import("./ichigo-builder.js")).default;
    const { AIRich } = IchigoBuilder;
    const rich = new AIRich(sock, { dynamic: true });
    // simple split: prefer full text if builder parse is complex
    if (hasCode) {
      const parts = text.split(/(```[\s\S]*?```)/);
      for (const part of parts) {
        const cm = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
        if (cm) rich.addCode(cm[1] || "text", cm[2]);
        else if (part.trim()) rich.addText(part.trim());
      }
    } else {
      rich.addText(text);
    }
    await rich.send(m.chat, { quoted: m });
  } catch {
    await sock.sendMessage(m.chat, { text }, { quoted: m });
  }
}

/**
 * Main handler
 */
async function handleAiAgent(m, sock) {
  sockRef = sock;
  const agent = getAgentState();
  if (!agent || !agent.enabled) return false;
  if (!shouldRespond(m, agent, sock)) return false;

  const sender = m.sender || "";
  const senderId = senderNum(sender);
  if (isOnCooldown(senderId)) return false;

  let body = (m.body || m.text || "").trim();
  const hasImg = !!(
    m.isImage ||
    m.quoted?.isImage ||
    m.type === "imageMessage" ||
    m.quoted?.type === "imageMessage"
  );
  if (!body && !hasImg) return false;
  if (m.isGroup && !hasImg && body.length < 2) return false;
  if (!body && hasImg) body = "(user mengirim gambar)";

  setCooldown(senderId);

  // Download gambar untuk vision
  let imageBuffer = null;
  if (hasImg) {
    try {
      if (m.isImage && m.download) imageBuffer = await m.download();
      else if (m.quoted?.isImage && m.quoted?.download)
        imageBuffer = await m.quoted.download();
      else if (m.download) imageBuffer = await m.download();
      else if (m.quoted?.download) imageBuffer = await m.quoted.download();
    } catch (e) {
      console.error("[AIAgent] image download:", e.message);
    }
  }

  const key = sessionKey(m.chat, sender);
  const history = loadHistory(agent, key);
  const customNames = getCustomNames(agent, sender);

  trackFrequency(
    agent,
    m.chat,
    m.isGroup ? m.groupMetadata?.subject || "" : m.pushName || "",
  );

  // Intent + pending slot fill (reactch dll)
  const intent = detectFeatureIntent(body);
  let pend = updatePendingFromMessage(agent, key, body, intent);

  // Auto-set name from natural language (tanpa nunggu model)
  const maybeName = extractSetNameFromText(body);
  if (maybeName && /(panggil|nama)/i.test(body)) {
    // biarkan model juga emit ACTION; eksekusi lokal sebagai backup
  }

  // Kalau pending reactch sudah lengkap → langsung eksekusi
  if (pend?.feature === "reactch" && pend.slots?.url && pend.slots?.emoji) {
    try {
      await sock.sendPresenceUpdate("composing", m.chat).catch(() => {});
      await execReactch(pend.slots.url, pend.slots.emoji);
      delete agent.pending[key];
      agent.stats.actions = (agent.stats.actions || 0) + 1;
      const msg = `✅ Reaksi ${pend.slots.emoji} sudah dikirim ke postingan channel itu.`;
      saveHistory(agent, key, [
        ...history,
        { role: "user", content: body },
        { role: "assistant", content: msg },
      ]);
      saveDb();
      await sock.sendMessage(m.chat, { text: msg }, { quoted: m });
      await sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
      return true;
    } catch (e) {
      // lanjut ke AI biar jelasin error / minta data ulang
      pend.error = e.message;
    }
  }

  const contextParts = [];
  if (m.pushName) contextParts.push(`Nama user: ${m.pushName}`);
  contextParts.push(m.isGroup ? "Lokasi: grup" : "Lokasi: private");
  if (isOwnerMsg(m)) contextParts.push("User OWNER bot");
  if (m.isAdmin) contextParts.push("User admin grup");
  if (customNames.length) contextParts.push(`Custom call names: ${customNames.join(", ")}`);
  if (imageBuffer) {
    contextParts.push(
      "User mengirim GAMBAR. Kamu BISA melihat isinya. Deskripsikan/analisis gambar dengan akurat. JANGAN bilang kamu tidak bisa melihat gambar.",
    );
  }
  if (intent) contextParts.push(`Intent terdeteksi: ${intent}`);
  if (pend) contextParts.push(`Pending: ${JSON.stringify(pend)}`);
  if (/\b(cari|tolong|bantu|rekomendasi|saran|cara)\b/i.test(body)) {
    contextParts.push("User butuh bantuan praktis");
  }

  const mood = pickMood(agent);
  const prompt = buildPrompt({
    history,
    userMessage: body,
    contextParts,
    mood,
    customNames,
    pending: pend,
  });

  try {
    await sock.sendPresenceUpdate("composing", m.chat).catch(() => {});
    const reply = await askLynix(prompt, imageBuffer);

    if (!reply || /^SKIP$/i.test(reply.trim())) {
      agent.stats.skips = (agent.stats.skips || 0) + 1;
      saveDb();
      await sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
      return true;
    }

    let actions = parseActions(reply);
    // backup setname dari teks user
    if (!actions.some((a) => a.type === "SETNAME") && maybeName && /(panggil|nama)/i.test(body)) {
      actions.push({ type: "SETNAME", params: { name: maybeName } });
    }
    // backup reactch dari teks + pending
    if (!actions.some((a) => a.type === "REACTCH")) {
      const { url, emoji } = extractUrlEmojiFromText(body);
      const u = url || pend?.slots?.url;
      const e = emoji || pend?.slots?.emoji;
      if (u && e && (intent === "reactch" || pend?.feature === "reactch")) {
        actions.push({ type: "REACTCH", params: { url: u, emoji: e } });
      }
    }

    const clean = stripActions(reply);
    const actionResults = actions.length
      ? await runActions(actions, m, sock, agent)
      : [];

    let finalText = clean;
    if (actionResults.length) {
      const extra = actionResults.map((r) => r.msg).join("\n");
      finalText = finalText ? `${finalText}\n\n${extra}` : extra;
    }

    if (!finalText) {
      await sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
      return true;
    }

    saveHistory(agent, key, [
      ...history,
      { role: "user", content: body },
      { role: "assistant", content: finalText.substring(0, 900) },
    ]);
    agent.stats.replies = (agent.stats.replies || 0) + 1;
    if (!agent.lastReplyAt) agent.lastReplyAt = {};
    agent.lastReplyAt[m.chat] = Date.now();
    if (isOwnerMsg(m)) agent.lastOwnerChat = Date.now();
    saveDb();

    const delay = Math.min(Math.max(finalText.length * 10, 350), 1400);
    await new Promise((r) => setTimeout(r, delay));
    await trySendRich(sock, m, finalText);
    await sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
    return true;
  } catch (e) {
    console.error("[AIAgent]", e.message);
    try {
      await sock.sendPresenceUpdate("paused", m.chat);
    } catch {}
    return false;
  }
}

async function tickAiAgentBoredom(sock) {
  sockRef = sock || sockRef;
  if (!sockRef) return;
  const agent = getAgentState();
  if (!agent?.enabled || agent.boredomChat === false) return;

  const now = Date.now();
  if (now - lastBoredomCheck < BOREDOM_INTERVAL_MS) return;
  lastBoredomCheck = now;
  if (now - (agent.lastOwnerChat || 0) < MIN_IDLE_FOR_BOREDOM_MS) return;
  if (Math.random() > 0.35) return;

  const owners = ownerJids();
  if (!owners.length) return;

  const prompt = `${PERSONA}\n\nKamu lagi gabut. Kirim SATU pesan singkat (1-2 kalimat) ke owner, santai kayak temen. Jangan sebut dirimu agent.`;
  try {
    const text = await askLynix(prompt);
    if (!text || /^SKIP/i.test(text)) return;
    await sockRef.sendMessage(owners[0], { text: text.trim().slice(0, 400) });
    agent.lastOwnerChat = now;
    saveDb();
  } catch (e) {
    console.error("[AIAgent] boredom:", e.message);
  }
}

function setAiAgentEnabled(enabled) {
  const agent = getAgentState();
  if (!agent) return false;
  agent.enabled = !!enabled;
  saveDb();
  return true;
}

function getAiAgentStatus() {
  const agent = getAgentState();
  if (!agent) return null;
  return {
    enabled: !!agent.enabled,
    mode: agent.mode || "smart",
    allowPrivate: agent.allowPrivate !== false,
    allowGroup: agent.allowGroup !== false,
    boredomChat: agent.boredomChat !== false,
    nimbrung: agent.nimbrung !== false,
    replies: agent.stats?.replies || 0,
    skips: agent.stats?.skips || 0,
    actions: agent.stats?.actions || 0,
    topChats: getTopChats(agent, 5),
    sessionCount: Object.keys(agent.sessions || {}).length,
    customNameUsers: Object.keys(agent.customNames || {}).length,
  };
}

function configureAiAgent(opts = {}) {
  const agent = getAgentState();
  if (!agent) return null;
  if (opts.mode && ["smart", "always"].includes(opts.mode)) agent.mode = opts.mode;
  if (typeof opts.allowPrivate === "boolean") agent.allowPrivate = opts.allowPrivate;
  if (typeof opts.allowGroup === "boolean") agent.allowGroup = opts.allowGroup;
  if (typeof opts.boredomChat === "boolean") agent.boredomChat = opts.boredomChat;
  if (typeof opts.nimbrung === "boolean") agent.nimbrung = opts.nimbrung;
  saveDb();
  return getAiAgentStatus();
}

function clearAiAgentSessions() {
  const agent = getAgentState();
  if (!agent) return;
  agent.sessions = {};
  agent.pending = {};
  saveDb();
}

export {
  handleAiAgent,
  tickAiAgentBoredom,
  setAiAgentEnabled,
  getAiAgentStatus,
  configureAiAgent,
  clearAiAgentSessions,
  getAgentState,
  setCustomName,
  clearCustomNames,
  getCustomNames,
};
