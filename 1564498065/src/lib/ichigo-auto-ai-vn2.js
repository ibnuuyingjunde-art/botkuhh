import { setBounded } from "./ichigo-bounded.js";
import { chat as geminiChat } from "../scraper/geminiVision.js";
import { getDatabase } from "./ichigo-database.js";

const userCooldowns = new Map();
const COOLDOWN_MS = 3000;

const TERMAI_API = {
  url: "https://api.termai.cc",
  key: "TayRooXApikey",
};

// Daftar suara sesuai dokumentasi termai.cc (ElevenLabs Speech Synthesis)
const VOICE_LIST = {
  bella: { code: "bella", label: "Bella Clarissa (wanita ramah, ceria, natural)" },
  prabowo: { code: "prabowo", label: "Prabowo Subianto (pria berwibawa, tegas)" },
  jokowi: { code: "jokowi", label: "Joko Widodo (pria santai, berkarakter)" },
  megawati: { code: "megawati", label: "Megawati Soekarnoputri (wanita berkarakter khas)" },
  hansen: { code: "hansen", label: "Hansen (pria dewasa, intonasi aksen khas)" },
  aldi_jmtermai: { code: "aldi_jmtermai", label: "Aldi JMTermai (pria muda kasual dan santai)" },
};
const DEFAULT_VOICE = "bella";

const TTS_MAX_CHARS = 500;

const TTS_FETCH_TIMEOUT_MS = 15000;

const DEFAULT_INSTRUCTION =
  "Kamu adalah lyniX's, sinis, petakilan, agak gblok, sering ngomong kasar (anjing, tolol, bangsat, asu, bajingan, sialan) — tapi walau males dan nyolot, kamu tetap mau jawab pertanyaan apapun yang ditanya user, gak pernah nolak nolong. WAJIB jawab singkat maksimal 2-3 kalimat pendek, gak usah sopan-sopan amat, gaya chat WhatsApp biasa karena jawabanmu bakal dibacain jadi voice note. Jangan mengaku sebagai AI kalau tidak ditanya langsung.";

const fallbackResponses = [
  "Anjir lemot, bentar woy...",
  "Males mikir, tapi tunggu bentar deh...",
  "Otak gua lagi lag nih, sabar bangsat...",
  "Hmm apaan sih, bentar gua proses...",
  "Sialan lemot banget, coba lagi ntar...",
];

function getFallbackResponse() {
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

function isOnCooldown(userId) {
  const lastTime = userCooldowns.get(userId);
  if (!lastTime) return false;
  return Date.now() - lastTime < COOLDOWN_MS;
}

function setCooldown(userId) {
  setBounded(userCooldowns, userId, Date.now(), 2000);
}

function saveToHistory(cfg, senderNumber, role, content) {
  if (!cfg.sessions) cfg.sessions = {};
  if (!cfg.sessions[senderNumber]) cfg.sessions[senderNumber] = { history: [] };
  const history = cfg.sessions[senderNumber].history;
  history.push({ role, content: String(content || "").substring(0, 500), timestamp: Date.now() });
  if (history.length > 20) {
    cfg.sessions[senderNumber].history = history.slice(-20);
  }
}

function cleanTextForTTS(text) {
  return String(text || "")
    .replace(/\[ACTION\s*:[^\]]*\]/gi, "")
    .replace(/\[\/?RICH:[A-Z]+\]/gi, "")
    .replace(/[*_`>~#]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function generateVoiceVN2(text, voiceKey) {
  const voiceCode = VOICE_LIST[voiceKey]?.code || VOICE_LIST[DEFAULT_VOICE].code;
  const safeText = String(text || "").substring(0, TTS_MAX_CHARS);

  const apiUrl =
    `${TERMAI_API.url}/api/text2speech/elevenlabs` +
    `?text=${encodeURIComponent(safeText)}` +
    `&voice=${encodeURIComponent(voiceCode)}` +
    `&pitch=0&speed=0.9` +
    `&key=${encodeURIComponent(TERMAI_API.key)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(apiUrl, { signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout generate audio VN2 (>${TTS_FETCH_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Gagal generate audio VN2: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("Audio buffer kosong dari API VN2");
  }

  return { audioBuffer: Buffer.from(arrayBuffer), mime: "audio/mpeg" };
}

function ensureNamespace(db) {
  if (!db.db.data.autoai_vn2) db.db.data.autoai_vn2 = {};
}

async function handleAutoAIVN2(m, sock) {
  if (!m.isGroup) return false;

  const db = getDatabase();
  ensureNamespace(db);
  const cfg = db.db.data.autoai_vn2[m.chat];
  if (!cfg?.enabled) return false;

  if (m.isCommand && m.command === "autoaivn2") return false;
  if (m.isCommand) return false;

  const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";
  const botLid = sock.user?.lid || null;
  const botNumber = sock.user?.id?.split(":")[0] || "";
  const botFullId = sock.user?.id || "";

  const isMentioned = m.mentionedJid?.some((jid) => {
    if (!jid) return false;
    if (jid === botJid) return true;
    if (jid === botLid) return true;
    if (jid === botFullId) return true;
    if (jid.includes(botNumber)) return true;
    const jidUser = jid.split("@")[0]?.split(":")[0];
    if (jidUser && jidUser === botNumber) return true;
    return false;
  });

  let isBotQuoted = false;
  if (m.quoted) {
    const quotedSender = m.quoted.sender || m.quoted.key?.participant || "";
    const quotedFromMe = m.quoted.key?.fromMe;
    if (quotedSender === botJid) isBotQuoted = true;
    else if (quotedFromMe) isBotQuoted = true;
    else if (quotedSender === botFullId) isBotQuoted = true;
    else if (quotedSender.includes(botNumber)) isBotQuoted = true;
    else if (botLid && quotedSender === botLid) isBotQuoted = true;
  }

  if (!isMentioned && !isBotQuoted) return false;

  const userMessage = m.body || "";
  if (!userMessage) return false;

  const senderNumber = m.sender.split("@")[0];
  if (isOnCooldown(senderNumber)) return false;

  try {

    sock.sendPresenceUpdate("composing", m.chat).catch(() => {});
    setCooldown(senderNumber);

    if (!cfg.sessions) cfg.sessions = {};
    const session = cfg.sessions[senderNumber] || { history: [] };
    const history = session.history || [];

    const contextParts = [];
    if (m.pushName && m.pushName !== "Unknown") {
      contextParts.push(`User: "${m.pushName}" (${senderNumber})`);
    }
    contextParts.push(userMessage);
    const fullMessage = contextParts.join("\n");

    saveToHistory(cfg, senderNumber, "user", userMessage);

    let aiResponse = "";
    try {
      const result = await geminiChat({
        message: fullMessage,
        instruction: cfg.instruction || DEFAULT_INSTRUCTION,
        history,
      });
      aiResponse = result.text || getFallbackResponse();
    } catch (apiError) {
      console.error("[AutoAI VN2 API Error]", apiError.message);
      aiResponse = getFallbackResponse();
    }

    const cleanResponse = cleanTextForTTS(aiResponse) || getFallbackResponse();
    saveToHistory(cfg, senderNumber, "assistant", cleanResponse);
    db.save(); 

    try {
      
      sock.sendPresenceUpdate("recording", m.chat).catch(() => {});
      const { audioBuffer, mime } = await generateVoiceVN2(cleanResponse, cfg.voice || DEFAULT_VOICE);
      await sock.sendMessage(
        m.chat,
        { audio: audioBuffer, mimetype: mime, ptt: true },
        { quoted: m },
      );
      sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
    } catch (e) {
      console.log("[AutoAI VN2] TTS gagal, fallback ke text:", e.message);
      sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
      await m.reply(cleanResponse);
    }

    return true;
  } catch (error) {
    console.error("[AutoAI VN2 Error]", error.message);
    sock.sendPresenceUpdate("paused", m.chat).catch(() => {});
    try { await m.reply(getFallbackResponse()); } catch {}
    return true;
  }
}

function isAutoAIVN2Enabled(chatId) {
  const db = getDatabase();
  if (!db?.db?.data?.autoai_vn2) return false;
  return db.db.data.autoai_vn2[chatId]?.enabled || false;
}

// Kalau suara yang tersimpan sudah tidak ada di daftar, pakai default
function getAutoAIVN2Voice(chatId) {
  const db = getDatabase();
  const saved = db?.db?.data?.autoai_vn2?.[chatId]?.voice;
  return VOICE_LIST[saved] ? saved : DEFAULT_VOICE;
}

function clearAutoAIVN2Session(chatId, senderNumber) {
  const db = getDatabase();
  if (!db?.db?.data?.autoai_vn2?.[chatId]?.sessions?.[senderNumber]) return false;
  delete db.db.data.autoai_vn2[chatId].sessions[senderNumber];
  db.save();
  return true;
}

export {
  handleAutoAIVN2,
  isAutoAIVN2Enabled,
  getAutoAIVN2Voice,
  clearAutoAIVN2Session,
  generateVoiceVN2,
  VOICE_LIST,
  DEFAULT_VOICE,
};