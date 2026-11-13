import chalk from "chalk";
import * as timeHelper from "./ichigo-time.js";
import { getCachedJid, isLidConverted } from "./ichigo-lid.js";

// ─────────────────────────────────────────────────────────────
//  Palet warna (tema Ichigo: oranye hangat + aksen dingin)
// ─────────────────────────────────────────────────────────────
const cAccent = chalk.hex("#ff9248");
const cInfo = chalk.hex("#38bdf8");
const cSuccess = chalk.hex("#4ade80");
const cWarn = chalk.hex("#fbbf24");
const cError = chalk.hex("#f87171");
const cSystem = chalk.hex("#c084fc");
const cWhite = chalk.whiteBright;
const cText = chalk.hex("#e2e8f0");
const cGray = chalk.gray;
const cDim = chalk.hex("#64748b");

let _gradient = null;
try {
  const g = await import("gradient-string");
  _gradient = g.default || g;
} catch { }

const gradientMock = (text) => text;
const gradient = () => gradientMock;

const BANNER_GRADIENT = ["#ffb347", "#ff6a3d", "#ff3d7f"];
const LINE_WIDTH = 58;
const PILL_WIDTH = 8;
const INDENT = " ".repeat(8 + 1 + PILL_WIDTH + 1);

// ─────────────────────────────────────────────────────────────
//  Helper kecil (tidak boleh melempar error)
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;
const stripAnsi = (s) => String(s).replace(ANSI_RE, "");

function center(str, width) {
  const s = String(str);
  const total = width - stripAnsi(s).length;
  if (total <= 0) return s;
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + s + " ".repeat(right);
}

function safeTime(fmt = "HH:mm:ss") {
  try {
    return timeHelper.formatTime(fmt);
  } catch {
    const d = new Date();
    return fmt === "HH:mm:ss"
      ? d.toTimeString().slice(0, 8)
      : d.toLocaleDateString("id-ID");
  }
}

const KIND = {
  ok: { color: cSuccess, hex: "#4ade80", text: "OK" },
  no: { color: cError, hex: "#f87171", text: "ERR" },
  wn: { color: cWarn, hex: "#fbbf24", text: "WARN" },
  info: { color: cInfo, hex: "#38bdf8", text: "INFO" },
  sys: { color: cSystem, hex: "#c084fc", text: "SYS" },
  dbg: { color: cDim, hex: "#94a3b8", text: "DBG" },
  cmd: { color: cAccent, hex: "#ff9248", text: "CMD" },
};

// Pill berwarna dengan lebar tetap supaya kolom log selalu rapi.
function makePill(label, kind = "info") {
  const k = KIND[kind] || KIND.info;
  const text = center(String(label || k.text).toUpperCase().substring(0, PILL_WIDTH), PILL_WIDTH);
  return chalk.bgHex(k.hex).hex("#0b0f19").bold(text);
}

// Dipertahankan agar nama lama tetap ada (dipakai spinner dll).
function makeTag(label, kind = "info") {
  return makePill(label, kind);
}

function asText(v) {
  if (v === undefined || v === null) return "";
  if (v instanceof Error) return v.message || String(v);
  return String(v);
}

function emit(kind, label, detail = "", opts = {}) {
  try {
    const k = KIND[kind] || KIND.info;
    const time = cDim(safeTime("HH:mm:ss"));
    const pill = makePill(opts.pill || k.text, kind);
    const lbl = asText(label);
    const det = asText(detail);

    let head;
    if (det) {
      head = `${time} ${pill} ${cAccent.bold(lbl)} ${cDim("❯")} `;
    } else {
      head = `${time} ${pill} `;
    }

    const body = det || lbl;
    const bodyColor = kind === "no" ? cError : kind === "wn" ? cWarn : cText;
    const lines = body.split("\n");
    const out = [head + (det ? bodyColor(lines[0]) : cWhite.bold(lines[0]))];
    for (let i = 1; i < lines.length; i++) {
      out.push(INDENT + cDim("│ ") + bodyColor(lines[i]));
    }
    console.log(out.join("\n"));
  } catch {
    console.log(`[${kind}] ${label}${detail ? " > " + detail : ""}`);
  }
}

function writeLog(kind, label, detail = "") {
  const map = {
    info: "info",
    success: "ok",
    warn: "wn",
    error: "no",
    system: "sys",
    debug: "dbg",
  };
  emit(map[kind] || "info", label, detail);
}

const logger = {
  info: (label, detail = "") => writeLog("info", label, detail),
  success: (label, detail = "") => writeLog("success", label, detail),
  warn: (label, detail = "") => writeLog("warn", label, detail),
  error: (label, detail = "") => writeLog("error", label, detail),
  system: (label, detail = "") => writeLog("system", label, detail),
  debug: (label, detail = "") => writeLog("debug", label, detail),
  tag: (label, msg, detail = "") => {
    emit("info", String(label).substring(0, 12), [asText(msg), asText(detail)].filter(Boolean).join("  ·  "));
  },
};

// ─────────────────────────────────────────────────────────────
//  Spinner / loader (tanpa animasi & tanpa timer, biar stabil)
// ─────────────────────────────────────────────────────────────
function createSpinner(label = "SYS", text = "loading", options = {}) {
  let active = false;
  return {
    start() {
      active = true;
      emit("info", label, `${text} …`, { pill: "WAIT" });
    },
    update(nextText) {
      if (active) emit("info", label, `${nextText} …`, { pill: "WAIT" });
    },
    stop() {
      active = false;
    },
    succeed(detail = text) {
      this.stop();
      logger.success(label, detail);
    },
    warn(detail = text) {
      this.stop();
      logger.warn(label, detail);
    },
    fail(detail = text) {
      this.stop();
      logger.error(label, detail);
    },
    isActive() {
      return active;
    },
  };
}

async function spinText(label, text, options = {}) {
  emit("info", label, `${text}`, { pill: "WAIT" });
}

async function typeLine(text, options = {}) {
  emit("ok", "ok", stripAnsi(text));
}

async function runLoader(text = "memuat", options = {}) {
  emit("info", "load", `${text} …`, { pill: "WAIT" });
}

// ─────────────────────────────────────────────────────────────
//  Banner ASCII
// ─────────────────────────────────────────────────────────────
const LYNIX_ART = [
  "██╗  ██╗   ██╗███╗   ██╗██╗██╗  ██╗██╗      ██╗ █████╗ ",
  "██║  ╚██╗ ██╔╝████╗  ██║██║╚██╗██╔╝██║      ██║██╔══██╗",
  "██║   ╚████╔╝ ██╔██╗ ██║██║ ╚███╔╝ ██║      ██║███████║",
  "██║    ╚██╔╝  ██║╚██╗██║██║ ██╔██╗ ██║      ██║██╔══██║",
  "███████╗██║   ██║ ╚████║██║██╔╝ ██╗███████╗ ██║██║  ██║",
  "╚══════╝╚═╝   ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝╚══════╝ ╚═╝╚═╝  ╚═╝",
].join("\n");

function paintBanner() {
  const pad = (l) => "  " + l;
  const art = LYNIX_ART.split("\n").map(pad).join("\n");
  try {
    if (_gradient) return _gradient(BANNER_GRADIENT).multiline(art);
  } catch { }
  return cAccent(art);
}

function kv(key, value, width = 9) {
  return `${cDim(String(key).toUpperCase().padEnd(width))}${cText(value)}`;
}

async function playBootSequence(info = {}) {
  try {
    const { name = "lyniX's MD", version = "1.0.0", mode = "public", developer = "" } = info;

    console.log("");
    console.log(paintBanner());
    console.log(`  ${cDim("─".repeat(40))}`);
    console.log(
      `  ${cAccent("◆")} ${cWhite.bold(name)} ${cDim("v" + version)}` +
        (developer ? `  ${cDim("·")}  ${cDim("by")} ${cText(developer)}` : ""),
    );
    console.log("");

    const rows = [
      [kv("mode", mode), kv("node", process.version)],
      [kv("platform", `${process.platform} ${process.arch}`), kv("pid", process.pid)],
      [kv("start", `${safeTime("DD/MM/YYYY")} ${safeTime("HH:mm:ss")}`), ""],
    ];
    const inner = LINE_WIDTH - 4;
    console.log(`  ${cDim("╭" + "─".repeat(inner) + "╮")}`);
    for (const [a, b] of rows) {
      const left = a + " ".repeat(Math.max(2, 26 - stripAnsi(a).length));
      const line = left + b;
      const fill = " ".repeat(Math.max(0, inner - 2 - stripAnsi(line).length));
      console.log(`  ${cDim("│")} ${line}${fill} ${cDim("│")}`);
    }
    console.log(`  ${cDim("╰" + "─".repeat(inner) + "╯")}`);
    console.log("");
  } catch {
    console.log(`${info?.name || "lyniX's MD"} v${info?.version || ""}`);
  }
}

// ─────────────────────────────────────────────────────────────
//  Log pesan masuk
// ─────────────────────────────────────────────────────────────
function getTypeTag(msgType, isNewsletter) {
  if (isNewsletter) return "Channel";

  const map = {
    imageMessage: "Gambar",
    videoMessage: "Video",
    audioMessage: "Audio",
    stickerMessage: "Stiker",
    documentMessage: "Dokumen",
    contactMessage: "Kontak",
    locationMessage: "Lokasi",
    viewOnceMessageV2: "Sekali Lihat",
    extendedTextMessage: "Teks",
    conversation: "Teks",
    interactiveResponseMessage: "Tombol",
    pollCreationMessage: "Polling",
    reactionMessage: "Reaksi",
  };
  return map[msgType] || "Pesan";
}

const MEDIA_TYPES = new Set(["Gambar", "Video", "Audio", "Stiker", "Dokumen", "Kontak", "Lokasi"]);

function roleBadges(info) {
  const out = [];
  if (info.isOwner) out.push(cAccent.bold("OWNER"));
  if (info.isPartner) out.push(cSuccess("PARTNER"));
  if (info.isPremium && !info.isOwner) out.push(cSystem("PREMIUM"));
  if (info.isAdmin) out.push(cInfo("ADMIN"));
  return out.map((b) => cDim("[") + b + cDim("]")).join(" ");
}

function logMessage(info) {
  if (typeof info === "string") {
    const [chatType, sender, message] = arguments;
    info = {
      chatType,
      sender,
      message,
      pushName: sender,
      groupName: chatType === "group" ? "Unknown" : "Private",
    };
  }

  const { chatType, groupName, pushName, sender, message, messageType, isNewsletter } = info;
  if (!message || message.trim() === "" || !sender) return;

  try {
    const num = String(sender).split("@")[0].split(":")[0];
    let msg = message.replace(/\n/g, " ").substring(0, 100) + (message.length > 100 ? "..." : "");

    msg = msg.replace(/@(\d{10,})/g, (match, num) => {
      const lidJid = num + "@lid";
      const resolved = getCachedJid(lidJid);
      if (resolved && !isLidConverted(resolved)) return "@" + resolved.replace(/@.+/g, "");
      const swJid = num + "@s.whatsapp.net";
      const resolved2 = getCachedJid(swJid);
      if (resolved2 && !isLidConverted(resolved2)) return "@" + resolved2.replace(/@.+/g, "");
      return match;
    });

    const typeTag = getTypeTag(messageType, isNewsletter || chatType === "newsletter");
    const isGroupLike = chatType === "group" || chatType === "newsletter";
    const senderName = pushName || num;

    // Deteksi command: diawali simbol prefix (. ! # / dll) lalu huruf/angka.
    const cmdMatch = msg.match(/^([^\w\s@]\w[\w-]*)(\s+[\s\S]*)?$/u);
    const isCmd = !!cmdMatch;

    // Format label rata kiri: tiap info punya label sendiri supaya jelas asalnya.
    const badges = roleBadges(info);
    const numLabel = /^\d{7,15}$/.test(num) ? ` ${cDim("(+" + num + ")")}` : "";
    const where = isGroupLike ? groupName || "Grup" : "Chat Pribadi";
    const typeColor = MEDIA_TYPES.has(typeTag) ? cSystem : cInfo;
    const typeExtra = [info.device, info.isForwarded ? "diteruskan" : ""].filter(Boolean).join(", ");

    const label = (name) => cDim(name.padEnd(6) + ": ");
    const body = isCmd
      ? cAccent.bold(cmdMatch[1]) + cText(cmdMatch[2] || "")
      : cText(msg);

    console.log(`${cDim(safeTime("HH:mm:ss"))} ${isCmd ? cAccent.bold("CMD") : cInfo.bold("MSG")}`);
    console.log(`${label("Dari")}${cWhite.bold(senderName)}${numLabel}${badges ? " " + badges : ""}`);
    console.log(`${label("Chat")}${isGroupLike ? cAccent(where) : cText(where)}`);
    console.log(`${label("Tipe")}${typeColor(typeTag)}${typeExtra ? cDim(" (" + typeExtra + ")") : ""}`);
    console.log(`${label("Isi")}${body}`);
    console.log("");
  } catch {
    console.log(`[MSG] ${sender}: ${message}`);
  }
}

function logPlugin(name, category) {
  console.log(`  ${cAccent("▸")} ${cText(name)} ${cDim(`· ${category}`)}`);
}

function logConnection(status, info = "") {
  const extra = info ? ` ${cDim("—")} ${cText(info)}` : "";
  const time = cDim(safeTime("HH:mm:ss"));
  if (status === "connected") {
    console.log(`${time} ${makePill("ONLINE", "ok")} ${cSuccess.bold("Tersambung")}${extra}`);
  } else if (status === "connecting") {
    console.log(`${time} ${makePill("WAIT", "info")} ${cInfo.bold("Menyambungkan")}${extra}`);
  } else {
    console.log(`${time} ${makePill("OFFLINE", "no")} ${cError.bold("Terputus")}${extra}`);
  }
}

function logErrorBox(title, message) {
  emit("no", title, asText(message));
}

function printBanner(mini = false) {
  if (mini) {
    console.log(`  ${cAccent("◆")} ${cWhite.bold("LYNIXLIA")}`);
    return;
  }
  console.log("");
  console.log(paintBanner());
  console.log("");
}

function printStartup(info = {}) {

}

const CODES = {
  reset: "", bold: "", dim: "", italic: "", underline: "",
  green: "", purple: "", white: "", gray: "", phantom: "",
  lime: "", silver: "", red: "", yellow: "", blue: "",
  cyan: "", magenta: "", bgBlack: "", bgGray: "",
};

const c = {
  green: cSuccess,
  purple: cSystem,
  white: cWhite,
  gray: cGray,
  bold: (v) => chalk.bold(v),
  dim: cDim,
  greenBold: (v) => chalk.bold(cSuccess(v)),
  purpleBold: (v) => chalk.bold(cSystem(v)),
  whiteBold: (v) => chalk.bold(cWhite(v)),
  grayDim: cDim,
  red: cError,
  yellow: cWarn,
  cyan: cInfo,
  blue: cInfo,
  magenta: cSystem,
};

function divider() {
  console.log(`  ${cDim("─".repeat(LINE_WIDTH - 4))}`);
}

function createBanner(lines, color = "accent") {
  const colorMap = {
    green: cSuccess, accent: cAccent, cyan: cInfo, red: cError,
    yellow: cWarn, purple: cSystem, white: cWhite,
  };
  const colorFn = colorMap[color] || cAccent;

  const clean = lines.map((l) => String(l).trim());
  const width = Math.max(...clean.map((l) => stripAnsi(l).length), 20) + 4;

  const out = [];
  out.push(`  ${colorFn("╭" + "─".repeat(width) + "╮")}`);
  for (const l of clean) {
    out.push(`  ${colorFn("│")}${cWhite(center(l, width))}${colorFn("│")}`);
  }
  out.push(`  ${colorFn("╰" + "─".repeat(width) + "╯")}`);
  return out.join("\n");
}

function getTimestamp() {
  return cDim(safeTime("HH:mm:ss"));
}

const theme = {
  primary: cWhite,
  secondary: cGray,
  accent: cAccent,
  text: cWhite,
  dim: cGray,
  muted: cGray,
  success: cSuccess,
  error: cError,
  warning: cWarn,
  info: cInfo,
  debug: cGray,
  border: cGray,
  tag: cWhite,
  pill: (t, kind = "primary") => {
    const map = {
      accent: cAccent, primary: cWhite, system: cSystem,
      success: cSuccess, warn: cWarn, error: cError, info: cInfo,
    };
    const fn = map[kind] || cWhite;
    return fn(`${t}`);
  },
  rainbow: (t) => {
    try {
      return _gradient ? _gradient(BANNER_GRADIENT)(String(t)) : cAccent(t);
    } catch {
      return cAccent(t);
    }
  },
  borderFx: (t) => cGray(t),
  mintFx: (t) => cSuccess(t),
  warmFx: (t) => cWarn(t),
  colorizeCategory: (t, index = 0) => {
    const palette = [cAccent, cInfo, cSystem, cSuccess, cWarn];
    const fn = palette[index % palette.length];
    return fn(t);
  },
};

export {
  c,
  CODES,
  logger,
  createSpinner,
  spinText,
  typeLine,
  runLoader,
  playBootSequence,
  logMessage,
  logPlugin,
  logConnection,
  logErrorBox,
  printBanner,
  printStartup,
  createBanner,
  getTimestamp,
  divider,
  theme,
  chalk,
  gradient
};