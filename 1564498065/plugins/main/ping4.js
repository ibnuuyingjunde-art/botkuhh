import nd from "fs";
import { canvasNs as _canvas } from "../../src/lib/ichigo-canvas-lazy.js";
import { performance } from "perf_hooks";
import os from "os";
import { execSync } from "child_process";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import te from "../../src/lib/ichigo-error.js";
import moment from "moment-timezone";

const pluginConfig = {
  name: "ping4",
  alias: ["speed4", "p4", "latency4", "sys4", "status4"],
  category: "main",
  description: "Cek performa dan status sistem bot secara real-time",
  usage: ".ping4",
  example: ".ping4",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const fmtSize = (b) => {
  if (!b || b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + " " + u[i];
};

const fmtUp = (s) => {
  s = Number(s);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sc = Math.floor(s % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sc}s`;
  return `${m}m ${sc}s`;
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

async function render(s, pf) {
  const { createCanvas } = _canvas;
  const W = 960, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0e0e12";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  const glows = [
    { x: 0, y: 0, r: 320, c1: "#5b6af210", c2: "transparent" },
    { x: W, y: H, r: 280, c1: "#22d3ee0d", c2: "transparent" },
    { x: W * 0.5, y: H * 0.5, r: 200, c1: "#ffffff05", c2: "transparent" },
  ];
  for (const g of glows) {
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, g.c1);
    gr.addColorStop(1, g.c2);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  const hdrGrad = ctx.createLinearGradient(0, 0, W, 0);
  hdrGrad.addColorStop(0, "#16161c");
  hdrGrad.addColorStop(1, "#111118");
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(0, 0, W, 64);

  const hdrLine = ctx.createLinearGradient(0, 0, W, 0);
  hdrLine.addColorStop(0, "#5b6af200");
  hdrLine.addColorStop(0.3, "#5b6af2cc");
  hdrLine.addColorStop(0.7, "#22d3eecc");
  hdrLine.addColorStop(1, "#22d3ee00");
  ctx.strokeStyle = hdrLine;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(W, 64); ctx.stroke();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText((config.bot?.name || "lyniX's MD").toUpperCase(), 24, 26);
  ctx.fillStyle = "#3a3a4a";
  ctx.font = "10px monospace";
  ctx.fillText("SYSTEM MONITOR", 24, 46);
  ctx.textAlign = "right";
  ctx.fillStyle = "#4a4a5a";
  ctx.font = "10px monospace";
  ctx.fillText(
    moment().tz("Asia/Makassar").format("ddd, DD MMM YYYY  •  HH:mm:ss") + " WITA",
    W - 24, 36,
  );
  ctx.restore();

  const pingColor = s.ping < 80 ? "#4ade80" : s.ping < 200 ? "#fbbf24" : "#f87171";
  const pingLabel = s.ping < 80 ? "EXCELLENT" : s.ping < 200 ? "GOOD" : "SLOW";

  ctx.save();
  rr(ctx, W - 120, 74, 96, 36, 6);
  ctx.fillStyle = "#16161c";
  ctx.fill();
  ctx.strokeStyle = pingColor + "55";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = pingColor;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = pingColor;
  ctx.shadowBlur = 10;
  ctx.fillText(`${s.ping}ms`, W - 72, 86);
  ctx.shadowBlur = 0;
  ctx.fillStyle = pingColor + "99";
  ctx.font = "8px monospace";
  ctx.fillText(pingLabel, W - 72, 100);
  ctx.restore();

  const ramPct = (s.ramUsed / s.ramTotal) * 100;
  const diskPct = s.diskTotal > 0 ? (s.diskUsed / s.diskTotal) * 100 : 0;
  const cpuN = parseFloat(s.cpuLoad);

  function drawArc(cx, cy, radius, pct, color, label, valText) {
    const startA = Math.PI * 0.75;
    const totalA = Math.PI * 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startA, startA + totalA);
    ctx.strokeStyle = "#1e1e28";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.stroke();
    if (pct > 0) {
      const endA = startA + (totalA * Math.min(pct, 100)) / 100;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = "#f0f0f8";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(valText, cx, cy - 4);
    ctx.fillStyle = "#3a3a4a";
    ctx.font = "8px monospace";
    ctx.fillText(label, cx, cy + 12);
    ctx.restore();
  }

  const arcY = 116, arcR = 34;
  drawArc(60,  arcY, arcR, cpuN,    "#5b6af2", "CPU",  `${s.cpuLoad}%`);
  drawArc(160, arcY, arcR, ramPct,  "#22d3ee", "RAM",  `${ramPct.toFixed(0)}%`);
  drawArc(260, arcY, arcR, diskPct, "#f472b6", "DISK", `${diskPct.toFixed(0)}%`);

  function card(x, y, w, h, accentColor) {
    ctx.save();
    rr(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#13131a";
    ctx.fill();
    ctx.strokeStyle = "#1e1e2a";
    ctx.lineWidth = 1;
    ctx.stroke();
    rr(ctx, x + 8, y, 28, 2, 1);
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function row(x, y, label, val, valColor = "#c0c0d0", maxW = 190) {
    ctx.save();
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3a3a50";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = valColor;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(val).substring(0, 22), x + maxW, y);
    ctx.restore();
  }

  function secTitle(x, y, title, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, x, y);
    ctx.restore();
  }

  const PAD = 20;
  const topY = 74;
  const ROW = 15;

  card(360, topY, 270, 80, "#22d3ee");
  secTitle(376, topY + 10, "NETWORK", "#22d3ee");
  ctx.save();
  ctx.fillStyle = "#22d3ee";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`↓ ${fmtSize(s.networkRx)}`, 376, topY + 38);
  ctx.fillStyle = "#f472b6";
  ctx.fillText(`↑ ${fmtSize(s.networkTx)}`, 510, topY + 38);
  ctx.fillStyle = "#2a2a3a";
  ctx.font = "9px monospace";
  ctx.fillText(s.networkInterface, 376, topY + 60);
  const dotC = s.ping < 100 ? "#4ade80" : "#fbbf24";
  ctx.fillStyle = dotC;
  ctx.shadowColor = dotC;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(612, topY + 60, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#3a3a50";
  ctx.fillText("  online", 614, topY + 60);
  ctx.restore();

  card(650, topY, 290, 80, "#a78bfa");
  secTitle(666, topY + 10, "UPTIME", "#a78bfa");
  ctx.save();
  ctx.fillStyle = "#a78bfa";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s.uptimeBot, 666, topY + 38);
  ctx.fillStyle = "#2a2a3a";
  ctx.font = "9px monospace";
  ctx.fillText(`Server  ${s.uptimeServer}`, 666, topY + 60);
  ctx.restore();

  const midY = 172, cardH = 120, cw = 215, cg = 10;

  card(PAD, midY, cw, cardH, "#a78bfa");
  secTitle(PAD + 12, midY + 10, "SERVER", "#a78bfa");
  let ry = midY + 28;
  row(PAD + 12, ry, "Host",     s.hostname,    "#c0c0d0", cw - 24); ry += ROW;
  row(PAD + 12, ry, "Platform", s.platform,    "#22d3ee", cw - 24); ry += ROW;
  row(PAD + 12, ry, "Arch",     s.arch,        "#c0c0d0", cw - 24); ry += ROW;
  row(PAD + 12, ry, "Node.js",  s.nodeVersion, "#4ade80", cw - 24); ry += ROW;
  row(PAD + 12, ry, "V8",       s.v8Version,   "#a78bfa", cw - 24);

  card(PAD + cw + cg, midY, cw, cardH, "#5b6af2");
  secTitle(PAD + cw + cg + 12, midY + 10, "CPU", "#5b6af2");
  ry = midY + 28;
  const cx2 = PAD + cw + cg + 12;
  row(cx2, ry, "Model", s.cpuModel.substring(0, 18), "#c0c0d0", cw - 24); ry += ROW;
  row(cx2, ry, "Cores", `${s.cpuCores}C @ ${s.cpuSpeed}MHz`, "#5b6af2", cw - 24); ry += ROW;
  row(cx2, ry, "Load",  `${s.cpuLoad}%`, cpuN > 80 ? "#f87171" : "#4ade80", cw - 24); ry += ROW;
  row(cx2, ry, "Avg",   s.loadAvg, "#fbbf24", cw - 24); ry += ROW + 4;
  rr(ctx, cx2, ry, cw - 24, 3, 2);
  ctx.fillStyle = "#1a1a24"; ctx.fill();
  if (cpuN > 0) {
    const fw = Math.max(4, ((cw - 24) * cpuN) / 100);
    ctx.save();
    rr(ctx, cx2, ry, fw, 3, 2);
    const bg2 = ctx.createLinearGradient(cx2, 0, cx2 + fw, 0);
    bg2.addColorStop(0, "#5b6af2"); bg2.addColorStop(1, "#818cf8");
    ctx.fillStyle = bg2; ctx.shadowColor = "#5b6af2"; ctx.shadowBlur = 5; ctx.fill(); ctx.restore();
  }

  card(PAD + (cw + cg) * 2, midY, cw, cardH, "#f472b6");
  secTitle(PAD + (cw + cg) * 2 + 12, midY + 10, "MEMORY", "#f472b6");
  ry = midY + 28;
  const mx = PAD + (cw + cg) * 2 + 12;
  row(mx, ry, "Total",    fmtSize(s.ramTotal),           "#c0c0d0", cw - 24); ry += ROW;
  row(mx, ry, "Used",     fmtSize(s.ramUsed),            "#fbbf24", cw - 24); ry += ROW;
  row(mx, ry, "Free",     fmtSize(s.ramTotal-s.ramUsed), "#4ade80", cw - 24); ry += ROW;
  row(mx, ry, "Heap/RSS", `${s.heapUsed}/${s.rss}`,     "#22d3ee", cw - 24); ry += ROW + 4;
  rr(ctx, mx, ry, cw - 24, 3, 2);
  ctx.fillStyle = "#1a1a24"; ctx.fill();
  if (ramPct > 0) {
    const fw2 = Math.max(4, ((cw - 24) * ramPct) / 100);
    ctx.save();
    rr(ctx, mx, ry, fw2, 3, 2);
    const bg3 = ctx.createLinearGradient(mx, 0, mx + fw2, 0);
    bg3.addColorStop(0, "#f472b6"); bg3.addColorStop(1, "#ec4899");
    ctx.fillStyle = bg3; ctx.shadowColor = "#f472b6"; ctx.shadowBlur = 5; ctx.fill(); ctx.restore();
  }

  card(PAD + (cw + cg) * 3, midY, cw, cardH, "#fbbf24");
  secTitle(PAD + (cw + cg) * 3 + 12, midY + 10, "PERF TRACE", "#fbbf24");
  ry = midY + 28;
  const px = PAD + (cw + cg) * 3 + 12;
  row(px, ry, "WA Roundtrip", `${pf.waRoundtrip}ms`, pf.waRoundtrip < 150 ? "#4ade80" : "#fbbf24", cw - 24); ry += ROW;
  row(px, ry, "CPU Sample",   `${pf.cpuSample}ms`,   "#5b6af2", cw - 24); ry += ROW;
  row(px, ry, "Canvas Render",`${pf.canvasTime}ms`,  "#a78bfa", cw - 24); ry += ROW;
  row(px, ry, "GC Pause",     `${pf.gcPause}ms`,     "#f472b6", cw - 24); ry += ROW;
  row(px, ry, "Total Exec",   `${pf.totalExec}ms`,   pf.totalExec < 2000 ? "#4ade80" : "#fbbf24", cw - 24);

  const botY = 310, botH = 105, bw = 290, bg2 = 10;

  card(PAD, botY, bw, botH, "#fbbf24");
  secTitle(PAD + 12, botY + 10, "PROCESS", "#fbbf24");
  ry = botY + 28;
  row(PAD + 12, ry, "PID",      `#${s.pid}`,      "#fbbf24", bw - 24); ry += ROW;
  row(PAD + 12, ry, "Handles",  s.activeHandles,  "#4ade80", bw - 24); ry += ROW;
  row(PAD + 12, ry, "Requests", s.activeRequests, "#22d3ee", bw - 24); ry += ROW;
  row(PAD + 12, ry, "External", s.external,       "#3a3a50", bw - 24); ry += ROW;
  row(PAD + 12, ry, "Buffers",  s.arrayBuffers,   "#3a3a50", bw - 24);

  card(PAD + bw + bg2, botY, bw, botH, "#4ade80");
  secTitle(PAD + bw + bg2 + 12, botY + 10, "STORAGE", "#4ade80");
  ry = botY + 28;
  const sx = PAD + bw + bg2 + 12;
  row(sx, ry, "Total", fmtSize(s.diskTotal),                              "#c0c0d0", bw - 24); ry += ROW;
  row(sx, ry, "Used",  `${fmtSize(s.diskUsed)} (${diskPct.toFixed(1)}%)`, "#fbbf24", bw - 24); ry += ROW;
  row(sx, ry, "Free",  fmtSize(s.diskTotal - s.diskUsed),                 "#4ade80", bw - 24); ry += ROW + 4;
  rr(ctx, sx, ry, bw - 24, 3, 2);
  ctx.fillStyle = "#1a1a24"; ctx.fill();
  if (diskPct > 0) {
    const fw3 = Math.max(4, ((bw - 24) * diskPct) / 100);
    ctx.save();
    rr(ctx, sx, ry, fw3, 3, 2);
    const bg4 = ctx.createLinearGradient(sx, 0, sx + fw3, 0);
    bg4.addColorStop(0, "#4ade80"); bg4.addColorStop(1, "#22c55e");
    ctx.fillStyle = bg4; ctx.shadowColor = "#4ade80"; ctx.shadowBlur = 5; ctx.fill(); ctx.restore();
  }

  const dbW = W - PAD * 2 - (bw + bg2) * 2;
  card(PAD + (bw + bg2) * 2, botY, dbW, botH, "#22d3ee");
  secTitle(PAD + (bw + bg2) * 2 + 12, botY + 10, "DATABASE", "#22d3ee");
  ry = botY + 28;
  const dx = PAD + (bw + bg2) * 2 + 12;
  row(dx, ry, "Users",   s.dbUsers,   "#c0c0d0", dbW - 24); ry += ROW;
  row(dx, ry, "Premium", s.dbPremium, "#fbbf24", dbW - 24); ry += ROW;
  row(dx, ry, "Groups",  s.dbGroups,  "#4ade80", dbW - 24);

  ctx.save();
  ctx.fillStyle = "#1e1e28";
  ctx.fillRect(0, H - 30, W, 30);
  ctx.strokeStyle = "#1e1e2a";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();
  ctx.fillStyle = "#2a2a3a";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${config.bot?.name || "lyniX's MD"}  ·  rendered in ${pf.canvasTime}ms  ·  ${moment().tz("Asia/Makassar").format("HH:mm:ss")} WITA`,
    W / 2, H - 15
  );
  ctx.restore();

  return canvas.toBuffer("image/png");
}

async function getNetwork() {
  try {
    const ifaces = os.networkInterfaces();
    let active = "N/A";
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (name.toLowerCase().includes("lo")) continue;
      for (const a of addrs) {
        if (a.family === "IPv4" && !a.internal) { active = name; break; }
      }
    }
    let rx = 0, tx = 0;
    try {
      if (process.platform === "linux") {
        const netDev = nd.readFileSync("/proc/net/dev", "utf8");
        for (const line of netDev.split("\n")) {
          if (line.includes(":") && !line.includes("lo:")) {
            const p = line.trim().split(/\s+/);
            if (p.length >= 10) {
              const n = p[0].replace(":", "");
              if (n === active || (active === "N/A" && parseInt(p[1]) > 0)) {
                rx = parseInt(p[1]) || 0;
                tx = parseInt(p[9]) || 0;
                if (active === "N/A") active = n;
                break;
              }
            }
          }
        }
      } else if (process.platform === "win32") {
        const ns = execSync("netstat -e", { encoding: "utf-8" });
        for (const l of ns.split("\n")) {
          if (l.toLowerCase().includes("bytes")) {
            const p = l.trim().split(/\s+/);
            if (p.length >= 3) { rx = parseInt(p[1]) || 0; tx = parseInt(p[2]) || 0; }
            break;
          }
        }
        if (active === "N/A") {
          const f = Object.keys(ifaces).find((n) => !n.toLowerCase().includes("loopback"));
          if (f) active = f;
        }
      }
    } catch {}
    return { rx, tx, iface: active };
  } catch {
    return { rx: 0, tx: 0, iface: "N/A" };
  }
}

async function handler(m, { sock }) {
  const execStart = performance.now();
  await m.react("🕕");

  try {
    sock.sendPresenceUpdate("composing", m.chat).catch(() => {});
    const t0 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
    const waRoundtrip = Math.max(1, Date.now() - t0);

    const cpus = os.cpus();
    const totalMem = os.totalmem(), freeMem = os.freemem();

    const cpuStart = performance.now();
    let cpuPct = 0;
    try {
      const c1 = os.cpus().reduce(
        (a, c) => { const t = Object.values(c.times).reduce((x, y) => x + y, 0); a.total += t; a.idle += c.times.idle; return a; },
        { total: 0, idle: 0 }
      );
      await new Promise((r) => setTimeout(r, 400));
      const c2 = os.cpus().reduce(
        (a, c) => { const t = Object.values(c.times).reduce((x, y) => x + y, 0); a.total += t; a.idle += c.times.idle; return a; },
        { total: 0, idle: 0 }
      );
      const td = c2.total - c1.total, id = c2.idle - c1.idle;
      cpuPct = td > 0
        ? (((td - id) / td) * 100).toFixed(1)
        : Math.min(100, (os.loadavg()[0] / cpus.length) * 100).toFixed(1);
      if (parseFloat(cpuPct) <= 0)
        cpuPct = Math.max(1, Math.min(100, (os.loadavg()[0] / cpus.length) * 100)).toFixed(1);
    } catch {
      cpuPct = Math.max(1, Math.min(100, (os.loadavg()[0] / cpus.length) * 100)).toFixed(1);
    }
    const cpuSample = Math.round(performance.now() - cpuStart);

    let diskTotal = 0, diskUsed = 0;
    try {
      if (process.platform === "win32") {
        const w = execSync("wmic logicaldisk where \"DeviceID='C:'\" get Size,FreeSpace /format:value", { encoding: "utf-8" });
        const fm = w.match(/FreeSpace=(\d+)/), sm = w.match(/Size=(\d+)/);
        if (sm && fm) { diskTotal = parseInt(sm[1]); diskUsed = diskTotal - parseInt(fm[1]); }
      } else {
        const df = execSync("df -k --output=size,used / 2>/dev/null").toString().trim().split("\n");
        if (df.length > 1) {
          const p = df[1].trim().split(/\s+/).map(Number);
          if (p.length >= 2) { diskTotal = p[0] * 1024; diskUsed = p[1] * 1024; }
        }
      }
    } catch {
      diskTotal = 500e9; diskUsed = 250e9;
    }

    const gcStart = performance.now();
    if (global.gc) global.gc();
    const gcPause = Math.round(performance.now() - gcStart);

    const net = await getNetwork();
    const heap = process.memoryUsage();

    let dbUsers = 0, dbGroups = 0, dbPremium = 0;
    try {
      const db = getDatabase();
      if (db?.data) {
        dbUsers   = Object.keys(db.data.users  || {}).length;
        dbGroups  = Object.keys(db.data.groups || {}).length;
        dbPremium = Object.values(db.data.users || {}).filter((u) => u.isPremium).length;
      }
    } catch {}

    const s = {
      ping: waRoundtrip,
      hostname:    os.hostname(),
      platform:    os.platform(),
      arch:        os.arch(),
      nodeVersion: process.version,
      v8Version:   process.versions.v8,
      uptimeBot:    fmtUp(process.uptime()),
      uptimeServer: fmtUp(os.uptime()),
      cpuModel:  cpus[0]?.model?.trim() || "Unknown",
      cpuSpeed:  cpus[0]?.speed || 0,
      cpuCores:  cpus.length,
      cpuLoad:   cpuPct,
      loadAvg:   os.loadavg().map((l) => l.toFixed(2)).join(", "),
      ramTotal:  totalMem,
      ramUsed:   totalMem - freeMem,
      diskTotal, diskUsed,
      networkRx:        net.rx,
      networkTx:        net.tx,
      networkInterface: net.iface,
      heapUsed:  fmtSize(heap.heapUsed),
      heapTotal: fmtSize(heap.heapTotal),
      rss:       fmtSize(heap.rss),
      external:  fmtSize(heap.external),
      arrayBuffers: fmtSize(heap.arrayBuffers || 0),
      pid:            process.pid,
      activeHandles:  process._getActiveHandles?.()?.length ?? "N/A",
      activeRequests: process._getActiveRequests?.()?.length ?? "N/A",
      dbUsers, dbGroups, dbPremium,
    };

    const canvasStart = performance.now();
    const pf = { waRoundtrip, cpuSample, canvasTime: "...", totalExec: "...", gcPause };
    const img = await render(s, pf);
    const canvasTime = Math.round(performance.now() - canvasStart);
    const totalExec  = Math.round(performance.now() - execStart);

    const saluranId   = config.saluran?.id   || "120363409557700746@newsletter";
    const saluranName = config.saluran?.name  || config.bot?.name || "lyniX's MD";

    const ramPct  = ((s.ramUsed / s.ramTotal) * 100).toFixed(1);
    const diskPct = s.diskTotal > 0 ? ((s.diskUsed / s.diskTotal) * 100).toFixed(1) : 0;
    const osLabel = { linux: "Linux", darwin: "macOS", win32: "Windows", android: "Android" }[s.platform] || s.platform;

    const pingIcon = waRoundtrip < 80  ? "🟢" : waRoundtrip < 200 ? "🟡" : "🔴";
    const cpuIcon  = parseFloat(s.cpuLoad) < 50 ? "🟢" : parseFloat(s.cpuLoad) < 80 ? "🟡" : "🔴";
    const ramIcon  = parseFloat(ramPct) < 60 ? "🟢" : parseFloat(ramPct) < 85 ? "🟡" : "🔴";
    const diskIcon = parseFloat(diskPct) < 70 ? "🟢" : parseFloat(diskPct) < 90 ? "🟡" : "🔴";
    const pingStatus = waRoundtrip < 80 ? "Excellent" : waRoundtrip < 200 ? "Good" : "Slow";

    const caption =
      `${pingIcon} *Ping* · \`${waRoundtrip}ms\` — _${pingStatus}_\n` +
      `╭─ 🖥️ *Server*\n` +
      `│·${osLabel} ${s.arch} · Node ${s.nodeVersion}\n` +
      `│·Host: ${s.hostname}\n` +
      `├─ 💻 *CPU* ${cpuIcon}\n` +
      `│·${s.cpuModel.substring(0, 28)}\n` +
      `│·${s.cpuCores} Core @ ${s.cpuSpeed} MHz · Load: ${s.cpuLoad}%\n` +
      `├─ 🧠 *Memory* ${ramIcon}\n` +
      `│·${fmtSize(s.ramUsed)} / ${fmtSize(s.ramTotal)} (${ramPct}%)\n` +
      `│·Heap: ${s.heapUsed} · RSS: ${s.rss}\n` +
      `├─ 💾 *Storage* ${diskIcon}\n` +
      `│·${fmtSize(s.diskUsed)} / ${fmtSize(s.diskTotal)} (${diskPct}%)\n` +
      `│·Free: ${fmtSize(s.diskTotal - s.diskUsed)}\n` +
      `├─ 🌐 *Network* · ${s.networkInterface}\n` +
      `│·↓ ${fmtSize(s.networkRx)}  ↑ ${fmtSize(s.networkTx)}\n` +
      `├─ 🗄️ *Database*\n` +
      `│·Users: ${dbUsers} · Premium: ${dbPremium} · Groups: ${dbGroups}\n` +
      `├─ ⏱️ *Uptime*\n` +
      `│·Bot: ${s.uptimeBot} · Server: ${s.uptimeServer}\n` +
      `├─ 📊 *Perf Trace*\n` +
      `│·RT: ${waRoundtrip}ms · CPU: ${cpuSample}ms\n` +
      `│·Canvas: ${canvasTime}ms · Total: ${totalExec}ms\n` +
      `╰───────────────────────────\n` +
      `> _Powered by ${config.bot?.name || "lyniX's MD"}_`;

    await sock.sendMessage(
      m.chat,
      {
        image: img,
        caption,
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
      { quoted: m },
    );

    await m.react("✅");
  } catch (error) {
    console.log(error);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };