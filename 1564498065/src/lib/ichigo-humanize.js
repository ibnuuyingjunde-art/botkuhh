import config from "../../config.js";

const DEFAULTS = {
  enabled: true,
  msPerChar: 22,
  minTyping: 500,
  maxTyping: 3500,
  jitterMin: 150,
  jitterMax: 600,
  minGap: 700,
  maxGap: 1500,
};

const lastSlot = new Map();

const rand = (a, b) => Math.floor(a + Math.random() * (b - a));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cfg() {
  const c = config.features?.humanize;
  if (c === false) return { ...DEFAULTS, enabled: false };
  return { ...DEFAULTS, ...(typeof c === "object" ? c : {}) };
}

function isHumanChat(jid) {
  return (
    typeof jid === "string" &&
    !jid.endsWith("@newsletter") &&
    !jid.endsWith("@broadcast") &&
    jid !== "status@broadcast"
  );
}

function getText(content) {
  if (!content || typeof content !== "object") return null;
  if (content.react || content.delete || content.protocolMessage) return null;
  if (content.sticker) return "";
  const t = content.text ?? content.caption;
  if (typeof t === "string") return t;
  if (content.image || content.video || content.audio || content.document) return "";
  return null;
}

export async function humanizeBeforeSend(sock, jid, content, options) {
  const c = cfg();
  if (!c.enabled || options?.noHumanize || !isHumanChat(jid)) return;

  const text = getText(content);
  if (text === null) return;

  const now = Date.now();
  const gap = rand(c.minGap, c.maxGap);
  const slot = Math.max(now, (lastSlot.get(jid) || 0) + gap);
  lastSlot.set(jid, slot);
  if (lastSlot.size > 500) lastSlot.delete(lastSlot.keys().next().value);
  if (slot > now) await sleep(slot - now);

  const typing = Math.min(
    c.maxTyping,
    Math.max(c.minTyping, text.length * c.msPerChar),
  );
  const wait = typing + rand(c.jitterMin, c.jitterMax);

  try {
    await sock.sendPresenceUpdate("composing", jid);
    await sleep(wait);
    await sock.sendPresenceUpdate("paused", jid);
  } catch {}
}
