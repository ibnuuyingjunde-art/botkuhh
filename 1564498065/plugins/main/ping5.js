import fs from "fs";
import os from "os";
import { performance } from "perf_hooks";
import { execSync } from "child_process";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import moment from "moment-timezone";
import { prepareWAMessageMedia, generateWAMessageFromContent } from "ichigo";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "ping5",
  alias: ["speed5", "p5", "latency5", "sys5", "status5"],
  category: "main",
  description: "Cek ping & status sistem lengkap (canvas + RSS/heap/memori) dalam pesan interaktif",
  usage: ".ping5",
  example: ".ping5",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

/* ───────────────────────── util ───────────────────────── */
const BOT = () => config.bot?.name || "lyniX's MD";
const TZ = "Asia/Makassar";

const fmtSize = (b) => {
  b = Number(b);
  if (!b || b < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + u[i];
};

const fmtUp = (s) => {
  s = Math.floor(Number(s));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sc}s`;
  return `${m}m ${sc}s`;
};

const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const level = (v, warn, bad) => (v < warn ? "🟢" : v < bad ? "🟡" : "🔴");
const levelColor = (v, warn, bad) => (v < warn ? "#4ade80" : v < bad ? "#fbbf24" : "#f87171");

const cpuTimes = () =>
  os.cpus().reduce(
    (a, c) => {
      a.total += Object.values(c.times).reduce((x, y) => x + y, 0);
      a.idle += c.times.idle;
      return a;
    },
    { total: 0, idle: 0 },
  );

async function sampleCpu() {
  const a = cpuTimes();
  await new Promise((r) => setTimeout(r, 300));
  const b = cpuTimes();
  const total = b.total - a.total;
  const idle = b.idle - a.idle;
  if (total > 0) return Math.max(0.1, ((total - idle) / total) * 100);
  return Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100);
}

function measureLoopLag() {
  return new Promise((resolve) => {
    const t = performance.now();
    setImmediate(() => resolve(performance.now() - t));
  });
}

function getDisk() {
  try {
    const out = execSync("df -k --output=size,used / 2>/dev/null", { encoding: "utf8" })
      .trim()
      .split("\n");
    const [size, used] = out[1].trim().split(/\s+/).map(Number);
    return { total: size * 1024, used: used * 1024 };
  } catch {
    return { total: 0, used: 0 };
  }
}

function getNetwork() {
  const out = { iface: "N/A", rx: 0, tx: 0 };
  try {
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
      if (addrs.some((a) => a.family === "IPv4" && !a.internal)) {
        out.iface = name;
        break;
      }
    }
    if (process.platform === "linux") {
      for (const line of fs.readFileSync("/proc/net/dev", "utf8").split("\n")) {
        if (!line.includes(":")) continue;
        const [n, rest] = line.split(":");
        if (n.trim() !== out.iface) continue;
        const p = rest.trim().split(/\s+/);
        out.rx = parseInt(p[0]) || 0;
        out.tx = parseInt(p[8]) || 0;
        break;
      }
    }
  } catch {}
  return out;
}

/* ───────────────────────── canvas ───────────────────────── */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function render(s) {
  const W = 1000, H = 592;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const F = (size, weight = "") => `${weight} ${size}px monospace`.trim();

  // latar
  ctx.fillStyle = "#0b0b10";
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [
    [0, 0, 380, "#5b6af21a"],
    [W, H, 340, "#22d3ee14"],
  ]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // header
  ctx.fillStyle = "#13131a";
  ctx.fillRect(0, 0, W, 68);
  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, "#5b6af200");
  line.addColorStop(0.3, "#5b6af2dd");
  line.addColorStop(0.7, "#22d3eedd");
  line.addColorStop(1, "#22d3ee00");
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 68);
  ctx.lineTo(W, 68);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = F(20, "bold");
  ctx.fillText(BOT().toUpperCase(), 28, 28);
  ctx.fillStyle = "#5b5b72";
  ctx.font = F(11);
  ctx.fillText("PING · SYSTEM MONITOR", 28, 50);
  ctx.textAlign = "right";
  ctx.fillStyle = "#6a6a82";
  ctx.fillText(moment().tz(TZ).format("ddd, DD MMM YYYY · HH:mm:ss") + " WITA", W - 28, 38);

  // hero ping
  const pc = levelColor(s.ping, 100, 300);
  const plabel = s.ping < 100 ? "EXCELLENT" : s.ping < 300 ? "GOOD" : "SLOW";
  ctx.save();
  ctx.shadowColor = pc;
  ctx.shadowBlur = 24;
  ctx.fillStyle = pc;
  ctx.textAlign = "left";
  ctx.font = F(58, "bold");
  ctx.fillText(`${s.ping}`, 28, 118);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = F(58, "bold");
  const pw = ctx.measureText(`${s.ping}`).width;
  ctx.fillStyle = "#8a8aa2";
  ctx.font = F(20);
  ctx.fillText("ms", 28 + pw + 10, 126);
  ctx.fillStyle = pc;
  ctx.font = F(12, "bold");
  ctx.fillText(plabel, 28, 154);

  // gauge
  const gauge = (cx, cy, r, v, color, label, text) => {
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5;
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1c1c26";
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + span);
    ctx.stroke();
    if (v > 0) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + (span * Math.min(v, 100)) / 100);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#f2f2fa";
    ctx.font = F(15, "bold");
    ctx.fillText(text, cx, cy - 4);
    ctx.fillStyle = "#5b5b72";
    ctx.font = F(10);
    ctx.fillText(label, cx, cy + 13);
  };
  gauge(330, 122, 40, s.cpu, "#5b6af2", "CPU", `${s.cpu.toFixed(0)}%`);
  gauge(430, 122, 40, s.ramPct, "#22d3ee", "RAM", `${s.ramPct.toFixed(0)}%`);
  gauge(530, 122, 40, s.diskPct, "#f472b6", "DISK", `${s.diskPct.toFixed(0)}%`);
  gauge(630, 122, 40, s.heapPct, "#fbbf24", "HEAP", `${s.heapPct.toFixed(0)}%`);

  // uptime kanan atas
  ctx.textAlign = "right";
  ctx.fillStyle = "#a78bfa";
  ctx.font = F(26, "bold");
  ctx.fillText(s.uptimeBot, W - 28, 112);
  ctx.fillStyle = "#5b5b72";
  ctx.font = F(11);
  ctx.fillText("BOT UPTIME", W - 28, 134);
  ctx.fillText(`server ${s.uptimeServer}`, W - 28, 152);

  // kartu
  const card = (x, y, w, h, color, title) => {
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = "#12121a";
    ctx.fill();
    ctx.strokeStyle = "#20202c";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    rr(ctx, x + 14, y, 34, 3, 1.5);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = color;
    ctx.font = F(11, "bold");
    ctx.fillText(title, x + 14, y + 14);
    ctx.textBaseline = "middle";
  };
  const rowAt = (x, y, w, label, val, color = "#d0d0e0") => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#555570";
    ctx.font = F(11);
    ctx.fillText(label.toUpperCase(), x + 14, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = F(11, "bold");
    ctx.fillText(String(val).slice(0, 24), x + w - 14, y);
  };
  const bar = (x, y, w, v, c1, c2) => {
    rr(ctx, x + 14, y, w - 28, 4, 2);
    ctx.fillStyle = "#1a1a25";
    ctx.fill();
    if (v > 0) {
      const bw = Math.max(5, ((w - 28) * Math.min(v, 100)) / 100);
      const g = ctx.createLinearGradient(x + 14, 0, x + 14 + bw, 0);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.save();
      ctx.fillStyle = g;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 6;
      rr(ctx, x + 14, y, bw, 4, 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const PAD = 24, GAP = 12;
  const cw = (W - PAD * 2 - GAP * 3) / 4; // 4 kolom
  const colX = (i) => PAD + i * (cw + GAP);
  const R = 19;

  // baris 1
  const y1 = 180, h1 = 140;
  let x = colX(0), y;
  card(x, y1, cw, h1, "#a78bfa", "SERVER");
  y = y1 + 42;
  rowAt(x, y, cw, "Host", s.hostname); y += R;
  rowAt(x, y, cw, "OS", s.os, "#22d3ee"); y += R;
  rowAt(x, y, cw, "Arch", s.arch); y += R;
  rowAt(x, y, cw, "Node", s.node, "#4ade80"); y += R;
  rowAt(x, y, cw, "V8", s.v8ver, "#a78bfa");

  x = colX(1);
  card(x, y1, cw, h1, "#5b6af2", "CPU");
  y = y1 + 42;
  rowAt(x, y, cw, "Model", s.cpuModel.slice(0, 16)); y += R;
  rowAt(x, y, cw, "Core", s.mhz ? `${s.cores}C @ ${s.mhz}MHz` : `${s.cores} Core`, "#5b6af2"); y += R;
  rowAt(x, y, cw, "Load", `${s.cpu.toFixed(1)}%`, levelColor(s.cpu, 50, 80)); y += R;
  rowAt(x, y, cw, "Avg", s.loadAvg, "#fbbf24"); y += R + 2;
  bar(x, y, cw, s.cpu, "#5b6af2", "#818cf8");

  x = colX(2);
  card(x, y1, cw, h1, "#22d3ee", "RAM SISTEM");
  y = y1 + 42;
  rowAt(x, y, cw, "Total", fmtSize(s.ramTotal)); y += R;
  rowAt(x, y, cw, "Used", fmtSize(s.ramUsed), "#fbbf24"); y += R;
  rowAt(x, y, cw, "Free", fmtSize(s.ramTotal - s.ramUsed), "#4ade80"); y += R;
  rowAt(x, y, cw, "Usage", `${s.ramPct.toFixed(1)}%`, levelColor(s.ramPct, 60, 85)); y += R + 2;
  bar(x, y, cw, s.ramPct, "#22d3ee", "#67e8f9");

  x = colX(3);
  card(x, y1, cw, h1, "#f472b6", "STORAGE");
  y = y1 + 42;
  rowAt(x, y, cw, "Total", fmtSize(s.diskTotal)); y += R;
  rowAt(x, y, cw, "Used", fmtSize(s.diskUsed), "#fbbf24"); y += R;
  rowAt(x, y, cw, "Free", fmtSize(s.diskTotal - s.diskUsed), "#4ade80"); y += R;
  rowAt(x, y, cw, "Usage", `${s.diskPct.toFixed(1)}%`, levelColor(s.diskPct, 70, 90)); y += R + 2;
  bar(x, y, cw, s.diskPct, "#f472b6", "#f9a8d4");

  // baris 2 — memori proses (RSS lengkap) lebar 2 kolom
  const y2 = y1 + h1 + GAP, h2 = 150;
  const wide = cw * 2 + GAP;
  x = colX(0);
  card(x, y2, wide, h2, "#fbbf24", "MEMORI PROSES (RSS · HEAP · EXTERNAL)");
  const half = wide / 2;
  y = y2 + 42;
  rowAt(x, y, half, "RSS", fmtSize(s.mem.rss), "#fbbf24"); y += R;
  rowAt(x, y, half, "Heap Total", fmtSize(s.mem.heapTotal)); y += R;
  rowAt(x, y, half, "Heap Used", fmtSize(s.mem.heapUsed), "#22d3ee"); y += R;
  rowAt(x, y, half, "External", fmtSize(s.mem.external)); y += R;
  rowAt(x, y, half, "ArrayBuffers", fmtSize(s.mem.arrayBuffers));
  y = y2 + 42;
  const hx = x + half - 14;
  rowAt(hx, y, half, "RSS / RAM", `${s.rssPct.toFixed(2)}%`, "#fbbf24"); y += R;
  rowAt(hx, y, half, "Heap Usage", `${s.heapPct.toFixed(1)}%`, levelColor(s.heapPct, 70, 90)); y += R;
  rowAt(hx, y, half, "Heap Limit", fmtSize(s.heapLimit)); y += R;
  rowAt(hx, y, half, "Malloced", fmtSize(s.v8stat.malloced)); y += R;
  rowAt(hx, y, half, "Peak Malloc", fmtSize(s.v8stat.peak));

  x = colX(2);
  card(x, y2, cw, h2, "#4ade80", "NETWORK");
  y = y2 + 42;
  rowAt(x, y, cw, "Iface", s.net.iface, "#22d3ee"); y += R;
  rowAt(x, y, cw, "Download", fmtSize(s.net.rx), "#22d3ee"); y += R;
  rowAt(x, y, cw, "Upload", fmtSize(s.net.tx), "#f472b6"); y += R;
  rowAt(x, y, cw, "Handles", s.handles); y += R;
  rowAt(x, y, cw, "Requests", s.requests);

  x = colX(3);
  card(x, y2, cw, h2, "#22d3ee", "DATABASE");
  y = y2 + 42;
  rowAt(x, y, cw, "Users", s.db.users); y += R;
  rowAt(x, y, cw, "Premium", s.db.premium, "#fbbf24"); y += R;
  rowAt(x, y, cw, "Groups", s.db.groups, "#4ade80"); y += R;
  rowAt(x, y, cw, "PID", `#${process.pid}`); y += R;
  rowAt(x, y, cw, "Plugins", s.db.plugins);

  // baris 3 — perf trace
  const y3 = y2 + h2 + GAP, h3 = 62;
  card(PAD, y3, W - PAD * 2, h3, "#a78bfa", "PERF TRACE");
  const items = [
    ["WA Roundtrip", `${s.ping}ms`, levelColor(s.ping, 100, 300)],
    ["CPU Sample", `${s.t.cpu}ms`, "#5b6af2"],
    ["Loop Lag", `${s.t.lag.toFixed(1)}ms`, "#22d3ee"],
    ["Data Collect", `${s.t.collect}ms`, "#fbbf24"],
  ];
  const iw = (W - PAD * 2 - 28) / items.length;
  items.forEach(([l, v, c], i) => {
    const ix = PAD + 14 + i * iw;
    ctx.textAlign = "left";
    ctx.fillStyle = "#555570";
    ctx.font = F(10);
    ctx.fillText(l.toUpperCase(), ix, y3 + 38);
    ctx.fillStyle = c;
    ctx.font = F(14, "bold");
    ctx.fillText(v, ix + 118, y3 + 38);
  });

  // footer
  ctx.fillStyle = "#3a3a4e";
  ctx.font = F(10);
  ctx.textAlign = "center";
  ctx.fillText(`${BOT()} · Node ${s.node} · ${s.os}`, W / 2, H - 14);

  return canvas.toBuffer("image/png");
}

/* ───────────────────────── caption & footer ───────────────────────── */
function buildCaption(s) {
  const sec = (title, ...lines) => [title, ...lines.map((l) => `• ${l}`)].join("\n");
  const pingTxt = s.ping < 100 ? "Excellent" : s.ping < 300 ? "Good" : "Slow";
  return [
    `${level(s.ping, 100, 300)} PING ${s.ping}ms (${pingTxt})`,
    sec(
      "🖥️ SERVER",
      `Host: ${s.hostname}`,
      `OS: ${s.os} ${s.arch}`,
      `Node: ${s.node}`,
      `V8: ${s.v8ver}`,
    ),
    sec(
      `💻 CPU ${level(s.cpu, 50, 80)}`,
      `Model: ${s.cpuModel.slice(0, 30)}`,
      `Core: ${s.cores}${s.mhz ? ` @ ${s.mhz} MHz` : ""}`,
      `Load: ${s.cpu.toFixed(1)}%`,
      `Load Avg: ${s.loadAvg}`,
    ),
    sec(
      `🧠 RAM SISTEM ${level(s.ramPct, 60, 85)}`,
      `Used: ${fmtSize(s.ramUsed)} / ${fmtSize(s.ramTotal)} (${s.ramPct.toFixed(1)}%)`,
      `Free: ${fmtSize(s.ramTotal - s.ramUsed)}`,
    ),
    sec(
      `📦 MEMORI PROSES ${level(s.heapPct, 70, 90)}`,
      `RSS: ${fmtSize(s.mem.rss)} (${s.rssPct.toFixed(2)}% RAM)`,
      `Heap Total: ${fmtSize(s.mem.heapTotal)}`,
      `Heap Used: ${fmtSize(s.mem.heapUsed)} (${s.heapPct.toFixed(1)}%)`,
      `External: ${fmtSize(s.mem.external)}`,
      `ArrayBuffers: ${fmtSize(s.mem.arrayBuffers)}`,
      `Heap Limit: ${fmtSize(s.heapLimit)}`,
    ),
    sec(
      `💾 STORAGE ${level(s.diskPct, 70, 90)}`,
      `Used: ${fmtSize(s.diskUsed)} / ${fmtSize(s.diskTotal)} (${s.diskPct.toFixed(1)}%)`,
      `Free: ${fmtSize(s.diskTotal - s.diskUsed)}`,
    ),
    sec(
      `🌐 NETWORK (${s.net.iface})`,
      `Download: ${fmtSize(s.net.rx)}`,
      `Upload: ${fmtSize(s.net.tx)}`,
    ),
    sec(
      "🗄️ DATABASE",
      `Users: ${s.db.users}`,
      `Premium: ${s.db.premium}`,
      `Groups: ${s.db.groups}`,
    ),
    sec("⏱️ UPTIME", `Bot: ${s.uptimeBot}`, `Server: ${s.uptimeServer}`),
    sec(
      "📊 PERF TRACE",
      `Roundtrip: ${s.ping}ms`,
      `CPU Sample: ${s.t.cpu}ms`,
      `Loop Lag: ${s.t.lag.toFixed(1)}ms`,
      `Collect: ${s.t.collect}ms`,
      `Canvas: ${s.t.canvas}ms`,
      `Total: ${s.t.total}ms`,
    ),
  ].join("\n\n");
}

// Footer WhatsApp tidak merender markdown, jadi teks dibuat polos tanpa box
const buildFooter = (s) => buildCaption(s);

/* ───────────────────────── handler ───────────────────────── */
async function handler(m, { sock }) {
  const t0 = performance.now();
  await m.react("🕕");

  try {
    const ts = m.messageTimestamp ? Number(m.messageTimestamp) * 1000 : Date.now();
    const ping = Math.max(1, Date.now() - ts);

    const tCpu = performance.now();
    const cpu = await sampleCpu();
    const cpuMs = Math.round(performance.now() - tCpu);
    const lag = await measureLoopLag();

    const cpus = os.cpus();
    const ramTotal = os.totalmem();
    const ramUsed = ramTotal - os.freemem();
    const disk = getDisk();
    const mem = process.memoryUsage();
    const heapStats = (await import("v8")).default.getHeapStatistics();

    let users = 0, premium = 0, groups = 0, plugins = 0;
    try {
      const db = getDatabase();
      const u = db?.data?.users || {};
      users = Object.keys(u).length;
      premium = Object.values(u).filter((x) => x?.isPremium).length;
      groups = Object.keys(db?.data?.groups || {}).length;
    } catch {}
    try {
      const { pluginStore } = await import("../../src/lib/ichigo-plugins.js");
      plugins = pluginStore.commands.size;
    } catch {}

    const osLabel =
      { linux: "Linux", darwin: "macOS", win32: "Windows", android: "Android" }[os.platform()] ||
      os.platform();

    const s = {
      ping,
      hostname: os.hostname(),
      os: osLabel,
      arch: os.arch(),
      node: process.version,
      v8ver: process.versions.v8,
      uptimeBot: fmtUp(process.uptime()),
      uptimeServer: fmtUp(os.uptime()),
      cpuModel: cpus[0]?.model?.trim() || "Unknown",
      cores: cpus.length,
      mhz: cpus[0]?.speed || 0,
      cpu,
      loadAvg: os.loadavg().map((l) => l.toFixed(2)).join(", "),
      ramTotal,
      ramUsed,
      ramPct: pct(ramUsed, ramTotal),
      diskTotal: disk.total,
      diskUsed: disk.used,
      diskPct: pct(disk.used, disk.total),
      mem,
      heapPct: pct(mem.heapUsed, mem.heapTotal),
      rssPct: pct(mem.rss, ramTotal),
      heapLimit: heapStats.heap_size_limit,
      v8stat: {
        malloced: heapStats.malloced_memory,
        peak: heapStats.peak_malloced_memory,
      },
      net: getNetwork(),
      handles: process._getActiveHandles?.()?.length ?? "N/A",
      requests: process._getActiveRequests?.()?.length ?? "N/A",
      db: { users, premium, groups, plugins },
      t: { cpu: cpuMs, lag, collect: Math.round(performance.now() - t0), canvas: 0, total: 0 },
    };
    const tCanvas = performance.now();
    const img = render(s);
    s.t.canvas = Math.round(performance.now() - tCanvas);
    s.t.total = Math.round(performance.now() - t0);

    const media = await prepareWAMessageMedia(
      { image: img },
      { upload: sock.waUploadToServer },
    );

    const saluranId = config.saluran?.id || "120363409557700746@newsletter";
    const saluranName = config.saluran?.name || BOT();

    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: {
              header: {
                title: "",
                hasMediaAttachment: true,
                imageMessage: media.imageMessage,
              },
              body: { text: "\u200e" },
              footer: { text: buildFooter(s) },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "🔄 Ping Lagi",
                      id: `${m.prefix}ping5`,
                    }),
                  },
                ],
              },
              contextInfo: {
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: saluranId,
                  newsletterName: saluranName,
                  serverMessageId: 127,
                },
              },
            },
          },
        },
      },
      { quoted: m },
    );

    await sock.relayMessage(m.chat, msg.message, {
      messageId: msg.key.id,
      additionalAttributes: { expiration: "86400" },
      additionalNodes: [
        {
          tag: "biz",
          attrs: {},
          content: [
            {
              tag: "interactive",
              attrs: { type: "native_flow", v: "1" },
              content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
            },
          ],
        },
      ],
    });

    await m.react("✅");
  } catch (error) {
    console.log(error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };