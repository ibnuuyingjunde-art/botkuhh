import os from "os";
import { performance } from "perf_hooks";
import { execSync } from "child_process";
import { createCanvas } from "../../src/lib/ichigo-canvas-lazy.js";
import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "ping3",
  alias: ["speed3", "p3", "status3", "sysstat"],
  category: "main",
  description: "Cek performa dan status sistem bot — output canvas image",
  usage: ".ping3",
  example: ".ping3",
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
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
    mn = Math.floor((s % 3600) / 60), sc = Math.floor(s % 60);
  if (d > 0) return `${d}d ${h}h ${mn}m`;
  if (h > 0) return `${h}h ${mn}m ${sc}s`;
  return `${mn}m ${sc}s`;
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getPingColor(ms) {
  if (ms < 100) return "#22d3ee";
  if (ms < 300) return "#fbbf24";
  return "#f87171";
}

function card(ctx, x, y, w, h, r = 12, alpha = 0.45) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = `rgba(15,23,42,${alpha})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(99,102,241,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function progressBar(ctx, x, y, w, h, pct, colorStart, colorEnd) {
  
  ctx.save();
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(30,41,59,0.8)";
  ctx.fill();

  const fw = Math.max(h, (w * Math.min(pct, 100)) / 100);
  rr(ctx, x, y, fw, h, h / 2);
  const grad = ctx.createLinearGradient(x, y, x + fw, y);
  grad.addColorStop(0, colorStart);
  grad.addColorStop(1, colorEnd);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = colorEnd;
  ctx.shadowBlur = 6;
  rr(ctx, x, y, fw, h, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.restore();
}

function label(ctx, txt, x, y, size = 12, color = "#94a3b8", bold = false) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px sans-serif`;
  ctx.fillText(txt, x, y);
}

async function generateCanvas(s) {
  const W = 780, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#060b18");
  bg.addColorStop(0.5, "#0d1527");
  bg.addColorStop(1, "#0a0e1f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const blob = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace(")", `,${a})`).replace("rgb", "rgba"));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(120, 100, 200, "rgb(99,102,241)", 0.15);
  blob(W - 100, H - 120, 180, "rgb(139,92,246)", 0.12);
  blob(W / 2, H / 2, 250, "rgb(6,182,212)", 0.04);

  ctx.strokeStyle = "rgba(99,102,241,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  card(ctx, 20, 18, W - 40, 64, 14, 0.7);

  rr(ctx, 20, 18, W - 40, 3, 2);
  const accentLine = ctx.createLinearGradient(20, 0, W - 20, 0);
  accentLine.addColorStop(0, "#6366f1");
  accentLine.addColorStop(0.5, "#a78bfa");
  accentLine.addColorStop(1, "#06b6d4");
  ctx.fillStyle = accentLine;
  ctx.fill();

  const iconX = 50, iconY = 50;
  ctx.save();
  ctx.beginPath(); ctx.arc(iconX, iconY, 18, 0, Math.PI * 2);
  const iconGrad = ctx.createRadialGradient(iconX - 4, iconY - 4, 2, iconX, iconY, 18);
  iconGrad.addColorStop(0, "#818cf8");
  iconGrad.addColorStop(1, "#4f46e5");
  ctx.fillStyle = iconGrad;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("⚡", iconX - 9, iconY + 6);

  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(s.botName, 78, 45);
  ctx.fillStyle = "#64748b";
  ctx.font = "12px sans-serif";
  ctx.fillText("System Performance Monitor", 78, 64);

  const bw = 80, bh = 26, bx = W - 40 - bw, by = 29;
  rr(ctx, bx, by, bw, bh, 13);
  ctx.fillStyle = "rgba(34,197,94,0.15)";
  ctx.fill();
  rr(ctx, bx, by, bw, bh, 13);
  ctx.strokeStyle = "rgba(34,197,94,0.4)";
  ctx.lineWidth = 1; ctx.stroke();
  
  ctx.beginPath(); ctx.arc(bx + 14, by + 13, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#22c55e"; ctx.fill();
  ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 8; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("ONLINE", bx + 22, by + 17);

  const pingItems = [
    { label: "WA Roundtrip", value: `${s.waRoundtrip}ms`, color: getPingColor(s.waRoundtrip), sub: s.waRoundtrip < 100 ? "Excellent" : s.waRoundtrip < 300 ? "Good" : "Slow" },
    { label: "Exec Time", value: `${s.execTime}ms`, color: "#a78bfa", sub: "Response" },
    { label: "Bot Uptime", value: s.uptime, color: "#34d399", sub: "Running" },
    { label: "Server Up", value: fmtUp(os.uptime()), color: "#60a5fa", sub: "System" },
  ];

  const cw = (W - 40 - 3 * 10) / 4;
  for (let i = 0; i < pingItems.length; i++) {
    const cx = 20 + i * (cw + 10);
    const cy = 98;
    card(ctx, cx, cy, cw, 80, 12, 0.5);

    rr(ctx, cx, cy, cw, 3, 2);
    ctx.fillStyle = pingItems[i].color;
    ctx.fill();

    ctx.fillStyle = pingItems[i].color;
    ctx.font = `bold ${pingItems[i].value.length > 6 ? 18 : 22}px sans-serif`;
    ctx.fillText(pingItems[i].value, cx + 12, cy + 36);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(pingItems[i].label, cx + 12, cy + 54);

    ctx.fillStyle = pingItems[i].color + "99";
    ctx.font = "10px sans-serif";
    ctx.fillText(pingItems[i].sub, cx + 12, cy + 70);
  }

  const ramPct = (s.ramUsed / s.ramTotal) * 100;
  const heapPct = (s.heapUsed / s.heapTotal) * 100;
  const diskPct = s.diskTotal > 0 ? (s.diskUsed / s.diskTotal) * 100 : 0;
  const cpuPct = parseFloat(s.cpuLoad);

  const bars = [
    { label: "CPU", pct: cpuPct, val: `${s.cpuLoad}%`, c1: "#f97316", c2: "#ef4444" },
    { label: "RAM", pct: ramPct, val: `${fmtSize(s.ramUsed)} / ${fmtSize(s.ramTotal)}`, c1: "#6366f1", c2: "#a78bfa" },
    { label: "Heap", pct: heapPct, val: `${fmtSize(s.heapUsed)} / ${fmtSize(s.heapTotal)}`, c1: "#0ea5e9", c2: "#06b6d4" },
    { label: "Disk", pct: diskPct, val: `${fmtSize(s.diskUsed)} / ${fmtSize(s.diskTotal)}`, c1: "#f59e0b", c2: "#fbbf24" },
  ];

  card(ctx, 20, 194, W - 40, 168, 12, 0.5);
  label(ctx, "RESOURCE USAGE", 34, 216, 11, "#475569", true);

  let barY = 228;
  for (const b of bars) {
    const barX = 34, barW = W - 68 - 120;

    label(ctx, b.label, barX, barY + 10, 12, "#cbd5e1", true);

    const pctTxt = `${b.pct.toFixed(1)}%`;
    ctx.fillStyle = b.c2;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(pctTxt, barX + 50, barY + 10);

    label(ctx, b.val, W - 40 - ctx.measureText(b.val).width, barY + 10, 11, "#64748b");

    progressBar(ctx, barX, barY + 16, barW + 60, 8, b.pct, b.c1, b.c2);

    barY += 36;
  }

  const infos = [
    { icon: "👥", k: "Users", v: s.dbUsers },
    { icon: "💎", k: "Premium", v: s.dbPremium },
    { icon: "🏠", k: "Groups", v: s.dbGroups },
    { icon: "🖥️", k: "Platform", v: s.platform },
    { icon: "🟢", k: "Node.js", v: s.nodeVer },
    { icon: "🌐", k: "Network", v: s.netIface },
  ];

  const igY = 378, igH = 60, igW = (W - 40 - 20) / 3;
  label(ctx, "SYSTEM INFO", 34, igY - 8, 11, "#475569", true);

  for (let i = 0; i < infos.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const ix = 20 + col * (igW + 10);
    const iy = igY + row * (igH + 8);
    card(ctx, ix, iy, igW, igH, 10, 0.4);

    ctx.font = "18px sans-serif";
    ctx.fillText(infos[i].icon, ix + 10, iy + 28);

    label(ctx, infos[i].k, ix + 36, iy + 20, 11, "#64748b");

    const vStr = String(infos[i].v).slice(0, 18);
    label(ctx, vStr, ix + 36, iy + 38, 13, "#e2e8f0", true);
  }

  const now = new Date();
  const wita = new Date(now.getTime() + 8 * 3600000);
  const timeStr = `${String(wita.getUTCHours()).padStart(2,"0")}:${String(wita.getUTCMinutes()).padStart(2,"0")} WITA`;
  label(ctx, `${timeStr}  •  Powered by ${s.botName}`, 20, H - 10, 11, "#334155");

  rr(ctx, 20, H - 4, W - 40, 2, 1);
  const bottomLine = ctx.createLinearGradient(20, 0, W - 20, 0);
  bottomLine.addColorStop(0, "rgba(99,102,241,0)");
  bottomLine.addColorStop(0.5, "rgba(167,139,250,0.6)");
  bottomLine.addColorStop(1, "rgba(6,182,212,0)");
  ctx.fillStyle = bottomLine;
  ctx.fill();

  return canvas.toBuffer("image/jpeg", 92);
}

async function handler(m, { sock }) {
  const execStart = performance.now();
  await m.react("🕕");

  try {
    const t0 = m.messageTimestamp ? m.messageTimestamp * 1000 : Date.now();
    const waRoundtrip = Math.max(1, Date.now() - t0);

    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuLoad = Math.max(0.1, Math.min(100, (os.loadavg()[0] / cpus.length) * 100)).toFixed(1);

    let diskTotal = 0, diskUsed = 0;
    try {
      if (process.platform === "win32") {
        const w = execSync("wmic logicaldisk where \"DeviceID='C:'\" get Size,FreeSpace /format:value", { encoding: "utf-8" });
        const fm = w.match(/FreeSpace=(\d+)/), sm = w.match(/Size=(\d+)/);
        if (sm && fm) { diskTotal = parseInt(sm[1]); diskUsed = diskTotal - parseInt(fm[1]); }
      } else {
        const df = execSync("df -k --output=size,used /").toString().trim().split("\n");
        if (df.length > 1) {
          const p = df[1].trim().split(/\s+/).map(Number);
          if (p.length >= 2) { diskTotal = p[0] * 1024; diskUsed = p[1] * 1024; }
        }
      }
    } catch {}

    const heap = process.memoryUsage();

    let netIface = "N/A";
    try {
      for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        if (name.toLowerCase().includes("lo")) continue;
        for (const a of addrs) {
          if (a.family === "IPv4" && !a.internal) { netIface = name; break; }
        }
      }
    } catch {}

    let dbUsers = 0, dbGroups = 0, dbPremium = 0;
    try {
      const db = getDatabase();
      if (db?.data) {
        dbUsers = Object.keys(db.data.users || {}).length;
        dbGroups = Object.keys(db.data.groups || {}).length;
        dbPremium = Object.values(db.data.users || {}).filter(u => u.isPremium).length;
      }
    } catch {}

    const execTime = Math.round(performance.now() - execStart);

    const imgBuf = await generateCanvas({
      botName: config.bot?.name || "lyniX's MD",
      waRoundtrip,
      execTime,
      uptime: fmtUp(process.uptime()),
      cpuLoad,
      ramUsed: totalMem - freeMem,
      ramTotal: totalMem,
      heapUsed: heap.heapUsed,
      heapTotal: heap.heapTotal,
      diskUsed,
      diskTotal,
      dbUsers,
      dbGroups,
      dbPremium,
      platform: `${os.platform()} ${os.arch()}`,
      nodeVer: process.version,
      netIface,
    });

    await sock.sendMessage(
      m.chat,
      { image: imgBuf, mimetype: "image/jpeg" },
      { quoted: m },
    );

    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };