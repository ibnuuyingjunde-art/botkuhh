import crypto from "crypto";
import fs from "fs";
import http from "http";

/**
 * Server HTTP kecil untuk menyajikan file hasil yt-dlp lewat link publik
 * (butuh oleh plugin yang memutar video lewat URL, mis. ytplay2).
 * Hanya jalan kalau diminta (opts.wantUrl di ytdl2) dan hanya kalau
 * config.mediaServer.publicUrl + port (atau env MEDIA_PUBLIC_URL / MEDIA_SERVER_PORT) terisi.
 * Mendukung Range supaya video bisa di-seek.
 */

const G = (globalThis.__ytdl2serve ||= { server: null, starting: null, failed: false, files: new Map() });

async function getCfg() {
  let cfg = {};
  try {
    const m = await import("../../config.js");
    cfg = m.default?.mediaServer || {};
  } catch {
    /* config tidak ada, pakai env saja */
  }
  return {
    publicUrl: String(process.env.MEDIA_PUBLIC_URL || cfg.publicUrl || "").replace(/\/+$/, ""),
    port: Number(process.env.MEDIA_SERVER_PORT || cfg.port) || 0,
    ttl: Number(cfg.fileTtlMs) || 30 * 60 * 1000,
  };
}

function handle(req, res) {
  const m = /^\/m\/([a-f0-9]{24})(?:\.\w+)?$/.exec(String(req.url || "").split("?")[0]);
  const ent = m && G.files.get(m[1]);
  if (!ent || ent.exp < Date.now() || !fs.existsSync(ent.file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  const size = fs.statSync(ent.file).size;
  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (range && (range[1] !== "" || range[2] !== "")) {
    if (range[1] !== "") {
      start = Number(range[1]);
      if (range[2] !== "") end = Math.min(Number(range[2]), size - 1);
    } else {
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    status = 206;
  }
  res.writeHead(status, {
    "Content-Type": ent.mime,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Access-Control-Allow-Origin": "*",
    ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  if (req.method === "HEAD") return res.end();
  const rs = fs.createReadStream(ent.file, { start, end });
  rs.on("error", () => res.destroy());
  res.on("close", () => rs.destroy());
  rs.pipe(res);
}

function start(port) {
  return new Promise((resolve) => {
    const srv = http.createServer(handle);
    srv.once("error", (e) => {
      console.error(`[ytdl2-serve] gagal listen di port ${port}: ${e.message}`);
      resolve(null);
    });
    srv.listen(port, "0.0.0.0", () => {
      srv.on("error", () => {});
      srv.unref();
      console.log(`[ytdl2-serve] media server jalan di port ${port}`);
      resolve(srv);
    });
  });
}

/**
 * @returns {Promise<string|null>} URL publik file, atau null kalau media server tidak tersedia
 */
export async function serveFile(file, mime = "application/octet-stream") {
  const cfg = await getCfg();
  if (!cfg.publicUrl || !cfg.port || G.failed) return null;

  if (!G.server) {
    G.starting ||= start(cfg.port);
    G.server = await G.starting;
    if (!G.server) {
      G.failed = true;
      G.starting = null;
      return null;
    }
  }

  const now = Date.now();
  for (const [t, e] of G.files) {
    if (e.exp < now) G.files.delete(t);
  }
  const ext = mime.startsWith("audio") ? "mp3" : "mp4";
  for (const [t, e] of G.files) {
    if (e.file === file && e.exp > now + 60_000) return `${cfg.publicUrl}/m/${t}.${ext}`;
  }
  const token = crypto.randomBytes(12).toString("hex");
  G.files.set(token, { file, mime, exp: now + cfg.ttl });
  return `${cfg.publicUrl}/m/${token}.${ext}`;
}

export default serveFile;
