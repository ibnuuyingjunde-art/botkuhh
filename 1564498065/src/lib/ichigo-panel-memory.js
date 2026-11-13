/**
 * Memori seperti yang ditampilkan panel (Pterodactyl/Docker): pemakaian cgroup
 * container dikurangi page-cache (inactive_file). Itu mencakup proses bot DAN
 * proses anak (ffmpeg dll), jadi lebih besar dari process.memoryUsage().rss.
 * Dibaca langsung tiap dipanggil (tanpa cache) supaya realtime.
 */
import fs from "fs";

const readNum = (p) => {
  try {
    const t = fs.readFileSync(p, "utf8").trim();
    if (!t || t === "max") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

const readStat = (p) => {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const [k, v] = line.trim().split(/\s+/);
      if (k && v !== undefined) out[k] = Number(v);
    }
  } catch {}
  return out;
};

// batas > 1 TB dianggap "tanpa batas"
const NO_LIMIT = 1024 ** 4;

function fromCgroup() {
  // cgroup v2
  let usage = readNum("/sys/fs/cgroup/memory.current");
  if (usage !== null) {
    const st = readStat("/sys/fs/cgroup/memory.stat");
    const limit = readNum("/sys/fs/cgroup/memory.max");
    return {
      source: "cgroup v2",
      used: Math.max(0, usage - (st.inactive_file || 0)),
      limit: limit && limit < NO_LIMIT ? limit : null,
    };
  }
  // cgroup v1
  usage = readNum("/sys/fs/cgroup/memory/memory.usage_in_bytes");
  if (usage !== null) {
    const st = readStat("/sys/fs/cgroup/memory/memory.stat");
    const limit = readNum("/sys/fs/cgroup/memory/memory.limit_in_bytes");
    return {
      source: "cgroup v1",
      used: Math.max(0, usage - (st.total_inactive_file || st.inactive_file || 0)),
      limit: limit && limit < NO_LIMIT ? limit : null,
    };
  }
  return null;
}

// Cadangan kalau cgroup tidak terbaca: jumlah RSS bot + semua proses anaknya.
function fromProcessTree() {
  try {
    const kb = {};
    const parent = {};
    for (const pid of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
      try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        const after = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        parent[pid] = after[1];
        const m = fs.readFileSync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+)/);
        kb[pid] = m ? Number(m[1]) : 0;
      } catch {}
    }
    const me = String(process.pid);
    let total = kb[me] || 0;
    const stack = [me];
    while (stack.length) {
      const cur = stack.pop();
      for (const pid of Object.keys(parent)) {
        if (parent[pid] === cur) {
          total += kb[pid] || 0;
          stack.push(pid);
        }
      }
    }
    return total ? { source: "proses bot + anak", used: total * 1024, limit: null } : null;
  } catch {
    return null;
  }
}

export function getPanelMemory() {
  return (
    fromCgroup() ||
    fromProcessTree() || { source: "process.rss", used: process.memoryUsage().rss, limit: null }
  );
}
