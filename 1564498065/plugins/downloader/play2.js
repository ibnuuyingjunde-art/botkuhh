/*
 * ============================================================
 *  PLAY2 — YT Music + HTML Player + Lirik Sinkron (Ichigo)
 * ============================================================
 *  Letak file : plugins/downloader/play2.js
 *
 *  CARA PAKAI:
 *    .play2 peterpan walau habis terang
 *    .play2 https://youtu.be/xxxxxxxxxxx
 *
 *  ALUR:
 *    YT Search -> LRCLIB (lirik pintar) -> audio berlapis
 *    (ytdl2/yt-dlp -> SaveTube -> Gencipta -> scraper ytmp3.mobi, divalidasi magic byte)
 *    -> FFmpeg Opus -> pemutar HTML (kartu AI Rich)
 *
 *  RICH HTML (versi Ichigo):
 *    Ichigo TIDAK punya attachRich / ourin-send.js — conn.sendAIRich
 *    dan conn.builders.AIRich sudah native di socket (sama kayak
 *    ping.js & mlbuild.js). Jadi gak ada import tambahan.
 *    Delivery berlapis:
 *      1) placeholder AIRich (bypassDownload) "Menyiapkan lagu…"
 *      2) EDIT pesan yg sama via builders.AIRich + sendEdit
 *      3) fallback sendAIRich full
 *      4) fallback relayRich manual (botForwardedMessage +
 *         richResponseMessage + protocolMessage type 14)
 * ============================================================
 */

'use strict';

import { createDecipheriv, randomUUID, createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ytSearch, ytFindVideo } from '../../src/scraper/ytsearch-safe.js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import config from '../../config.js';
import { ytdl2, readResultBuffer } from '../../src/scraper/ytdl2.js';

const jalankan = promisify(execFile);

/* =========================================================
 * CONFIG & METADATA
 * ========================================================= */

const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const HEADERS = {
  'Content-Type': 'application/json',
  'Origin': 'https://yt.savetube.me',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};

const pluginConfig = {
  name: 'play2',
  alias: ['ytplay2', 'music2'],
  category: 'downloader',
  description: 'Putar lagu YT Music dengan pemutar HTML interaktif & lirik tersinkronisasi pintar',
  usage: '.play2 <judul lagu / url>',
  example: '.play2 peterpan walau habis terang',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

/* =========================================================
 * FFMPEG AUDIO CONFIG
 * ========================================================= */

const FFMPEG_SAMPLE_RATE = '24000';
const FFMPEG_CHANNELS = '1';
const FFMPEG_CODEC = 'libopus';
const FFMPEG_FORMAT = 'ogg';

const MAX_ORIGINAL_AUDIO_MB = 25;
const MAX_ORIGINAL_AUDIO_SIZE = MAX_ORIGINAL_AUDIO_MB * 1024 * 1024;

const MAX_COMPRESSED_AUDIO_MB = 6;
const MAX_COMPRESSED_AUDIO_SIZE = MAX_COMPRESSED_AUDIO_MB * 1024 * 1024;

/* =========================================================
 * LRCLIB SMART LYRICS ENGINE
 * ========================================================= */

const API_LRCLIB = 'https://lrclib.net/api';
const UA_LRCLIB = "lyniX's MD-Play2/1.0 (https://github.com/)";
const DATA_DIR = join(process.cwd(), 'src', 'data', 'lyrics');
const TIMEOUT_MS = 8000;
const TOLERANSI_DETIK = 5;
const BATAS_LIRIK = 8 * 1024;
const KATA_SAMPAH = /\b(official|officiel|music|musik|video|lyrics?|lirik|audio|mv|hd|4k|8k|visuali[sz]er|full album|clip|klip|terbaru|new)\b/gi;

function berkasCache(kunci) {
  const hash = createHash('sha1').update(kunci).digest('hex');
  return join(DATA_DIR, `${hash}.json`);
}

function bacaCache(kunci) {
  try { return JSON.parse(readFileSync(berkasCache(kunci), 'utf8')); } catch { return null; }
}

function tulisCache(kunci, isi) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(berkasCache(kunci), JSON.stringify(isi));
  } catch {}
}

const normal = (t) => String(t ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

function pecahJudul(title, channel = '') {
  const bersih = String(title ?? '').replace(/[([{][^)\]}]*[)\]}]/g, ' ').replace(KATA_SAMPAH, ' ').replace(/\s{2,}/g, ' ').trim();
  const bagian = bersih.split(/\s+[-–—|]\s+|\s+[-–—|]$|^[-–—|]\s+/).map((s) => s.trim()).filter(Boolean);
  if (bagian.length < 2) return { artis: channel, judul: bersih || String(title ?? ''), tukar: true };
  const ch = normal(channel);
  const kiri = normal(bagian[0]);
  const kanan = normal(bagian[1]);
  const mirip = (a) => a && ch && (a.includes(ch) || ch.includes(a));
  if (mirip(kiri)) return { artis: bagian[0], judul: bagian[1], tukar: false };
  if (mirip(kanan)) return { artis: bagian[1], judul: bagian[0], tukar: false };
  return { artis: bagian[0], judul: bagian[1], tukar: true };
}

function parseLrc(lrc) {
  const keluar = [];
  for (const baris of String(lrc ?? '').split(/\r?\n/)) {
    const stempel = [...baris.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stempel.length) continue;
    const teks = baris.replace(/\[[^\]]*\]/g, '').trim();
    for (const [, mm, ss, pecahan] of stempel) {
      const ms = pecahan ? Number(pecahan.padEnd(3, '0')) : 0;
      keluar.push({ time: (Number(mm) * 60000 + Number(ss) * 1000 + ms) / 1000, text: teks });
    }
  }
  return keluar.sort((a, b) => a.time - b.time);
}

async function ambilJson(url) {
  const ac = new AbortController();
  const jam = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA_LRCLIB }, signal: ac.signal });
    if (res.status === 404 || !res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(jam); }
}

async function cariDekat(judul, artis, targetDetik) {
  const url = new URL(`${API_LRCLIB}/search`);
  url.searchParams.set('track_name', judul);
  if (artis) url.searchParams.set('artist_name', artis);
  const hasil = await ambilJson(url);
  if (!Array.isArray(hasil)) return null;
  const bersinkron = hasil.filter((r) => r?.syncedLyrics || r?.plainLyrics);
  if (!bersinkron.length) return null;
  bersinkron.sort((a, b) => Math.abs((a.duration ?? 0) - targetDetik) - Math.abs((b.duration ?? 0) - targetDetik));
  const terbaik = bersinkron[0];
  if (targetDetik > 0 && Math.abs((terbaik.duration ?? 0) - targetDetik) > TOLERANSI_DETIK * 2) return null;
  return terbaik;
}

async function cariLirikSmart(video) {
  const targetDetik = Number(video?.duration?.seconds || video?.seconds) || 0;
  const judulMentah = String(video?.title ?? '');
  const channel = String(video?.author?.name ?? '');
  const kunci = `${judulMentah}|${channel}|${targetDetik}`;
  const tersimpan = bacaCache(kunci);
  if (tersimpan) return tersimpan.hasil;

  const { artis, judul, tukar } = pecahJudul(judulMentah, channel);
  let hit = null;
  let sumber = '';

  const urlGet = new URL(`${API_LRCLIB}/get`);
  urlGet.searchParams.set('artist_name', artis);
  urlGet.searchParams.set('track_name', judul);
  if (targetDetik > 0) urlGet.searchParams.set('duration', String(targetDetik));

  const exact = await ambilJson(urlGet);
  if ((exact?.syncedLyrics || exact?.plainLyrics) && !exact?.instrumental) {
    hit = exact;
    sumber = 'get';
  }

  if (!hit) { const r = await cariDekat(judul, artis, targetDetik); if (r) { hit = r; sumber = 'search'; } }
  if (!hit && tukar) { const r = await cariDekat(artis, judul, targetDetik); if (r) { hit = r; sumber = 'search-balik'; } }
  if (!hit) {
    const r = await cariDekat(judul, '', targetDetik);
    if (r) { hit = r; sumber = 'search-judul'; }
  }

  if (!hit || (!hit.syncedLyrics && !hit.plainLyrics) || hit.instrumental) {
    tulisCache(kunci, { hasil: null });
    return null;
  }

  let baris = [];
  if (hit.syncedLyrics) {
    baris = parseLrc(hit.syncedLyrics);
  } else if (hit.plainLyrics) {
    const lines = hit.plainLyrics.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const interval = targetDetik > 0 ? Math.max(2, targetDetik / lines.length) : 4;
    baris = lines.map((text, idx) => ({ time: idx * interval, text }));
  }

  if (!baris.length) { tulisCache(kunci, { hasil: null }); return null; }

  const hasil = {
    baris,
    artis: hit.artistName || artis,
    judul: hit.trackName || judul,
    durasi: hit.duration || targetDetik,
    sumber
  };

  while (JSON.stringify(hasil.baris).length > BATAS_LIRIK) {
    hasil.baris = hasil.baris.slice(0, Math.floor(hasil.baris.length * 0.8));
    if (hasil.baris.length < 4) { tulisCache(kunci, { hasil: null }); return null; }
  }

  tulisCache(kunci, { hasil });
  return hasil;
}

/* =========================================================
 * HELPERS
 * ========================================================= */

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(text = '') {
  return escapeHtml(text);
}

function formatDuration(seconds = 0) {
  seconds = Number(seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
}

/* =========================================================
 * SAVETUBE DOWNLOADER
 * ========================================================= */

async function savetube(url, { downloadType = 'audio', quality = '128kbps' } = {}) {
  const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  if (!idMatch) throw new Error('URL YouTube tidak valid');
  const videoId = idMatch[1];

  const cdnRes = await fetch('https://media.savetube.vip/api/random-cdn', { headers: HEADERS })
    .then(v => v.json())
    .catch(() => null);

  if (!cdnRes?.cdn) throw new Error('CDN tidak tersedia');
  const cdn = cdnRes.cdn;

  const info = await fetch(`https://${cdn}/v2/info`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` })
  })
    .then(v => v.json())
    .catch(() => null);

  if (!info?.data) throw new Error('Metadata kosong');

  let metadata;
  try {
    const encrypted = Buffer.from(info.data, 'base64');
    const decipher = createDecipheriv(
      'aes-128-cbc',
      METADATA_DECRYPTION_KEY,
      encrypted.subarray(0, 16)
    );
    const decrypted = Buffer.concat([
      decipher.update(encrypted.subarray(16)),
      decipher.final()
    ]);
    metadata = JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw new Error('Decrypt metadata gagal');
  }

  if (!metadata?.key) throw new Error('Key download tidak ditemukan');

  const dl = await fetch(`https://${cdn}/download`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: videoId,
      downloadType,
      quality,
      key: metadata.key
    })
  })
    .then(v => v.json())
    .catch(() => null);

  if (!dl?.data?.downloadUrl) {
    throw new Error(dl?.message || 'Download gagal');
  }

  return {
    title: metadata.title,
    duration: metadata.durationLabel,
    thumbnail: metadata.thumbnail,
    url: dl.data.downloadUrl
  };
}

async function savetubeRetry(url, opts, retry = 3) {
  let lastErr;
  for (let i = 0; i < retry; i++) {
    try {
      return await savetube(url, opts);
    } catch (e) {
      lastErr = e;
      if (i < retry - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastErr;
}

/* =========================================================
 * AUDIO SOURCE ENGINE — validasi magic byte + fallback berlapis
 * SaveTube (divalidasi) -> Gencipta API -> scraper ytmp3.mobi
 * ========================================================= */

/* Deteksi isi buffer dari magic bytes. Return format ('mp3'|'m4a'|'ogg'|'wav'|'flac'|'webm')
   atau null kalau BUKAN audio (HTML/JSON/garbage) — mencegah error ffmpeg "Invalid data found". */
function sniffAudio(buf) {
  if (!buf || buf.length < 16) return null;
  const s = buf.subarray(0, 16);
  if (s[0] === 0x49 && s[1] === 0x44 && s[2] === 0x33) return 'mp3';
  if (s[0] === 0xFF && (s[1] & 0xE0) === 0xE0) return 'mp3';
  if (s.subarray(4, 8).toString('latin1') === 'ftyp') return 'm4a';
  if (s.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (s.subarray(0, 4).toString('latin1') === 'RIFF') return 'wav';
  if (s.subarray(0, 4).toString('latin1') === 'fLaC') return 'flac';
  if (s[0] === 0x1A && s[1] === 0x45 && s[2] === 0xDF && s[3] === 0xA3) return 'webm';
  return null;
}

/* Download audio streaming dgn batas ukuran (gak numpuk buffer sembarangan) */
async function downloadAudioBuffer(url, { timeoutMs = 90000 } = {}) {
  if (!url) throw new Error('URL audio kosong');
  const res = await fetch(url, {
    headers: { 'User-Agent': HEADERS['User-Agent'] },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`Download audio gagal (${res.status})`);
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const parts = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_ORIGINAL_AUDIO_SIZE) {
        try { reader.cancel(); } catch {}
        throw new Error(`Audio asli kebesaran (>${MAX_ORIGINAL_AUDIO_MB}MB)`);
      }
      parts.push(value);
    }
    return Buffer.concat(parts);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_ORIGINAL_AUDIO_SIZE) {
    throw new Error('Buffer audio bermasalah');
  }
  return buffer;
}

/* Sumber 2: Gencipta API — MP3 langsung atau JSON + link.
   Key diambil dari config.APIkey.gencipta; kalau belum diisi, sumber ini otomatis dilewati. */
async function genciptaBuffer(ytUrl) {
  const key = config?.APIkey?.gencipta || null;
  if (!key) throw new Error('API key Gencipta tidak tersedia');

  const res = await fetch(`https://gateway.gencipta.com/api/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`, {
    headers: {
      Accept: 'application/json, audio/*, */*',
      Authorization: `Bearer ${key}`,
      'User-Agent': HEADERS['User-Agent']
    },
    signal: AbortSignal.timeout(90000)
  });

  const ct = String(res.headers.get('content-type') || '');
  if (ct.includes('audio') || ct.includes('octet-stream')) {
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length < 1000) throw new Error('Audio Gencipta kosong');
    return b;
  }

  let data = {};
  try { data = JSON.parse(Buffer.from(await res.arrayBuffer()).toString('utf8')); } catch {}
  const link = data?.data?.audio?.download?.downloadUrl || data?.data?.downloadUrl || data?.url;
  if (!link) throw new Error(data?.error || data?.message || `Gencipta HTTP ${res.status}`);
  return downloadAudioBuffer(link);
}

/* Sumber 3: scraper ytmp3.mobi (src/scraper/ytdl.js) */
async function scraperBuffer(ytUrl) {
  let ytdl = null;
  try { ({ ytdl } = await import('../../src/scraper/ytdl.js')); } catch {}
  if (typeof ytdl !== 'function') throw new Error('Scraper ytdl tidak tersedia');
  const r = await ytdl(ytUrl, 'mp3');
  if (!r?.status || !r?.dl) throw new Error(r?.mess || 'Scraper ytmp3.mobi gagal');
  return downloadAudioBuffer(r.dl);
}

/* Pipeline utama: coba semua sumber berurutan, validasi tiap hasil.
   Balikin { buffer, sumber } atau lempar error ringkas berisi alasan tiap sumber. */
async function ambilAudioAsli(ytUrl) {
  const alasan = [];

  /* 0) ytdl2 — scraper ytmp3.js (tanpa yt-dlp) */
  try {
    const r = await ytdl2(ytUrl, 'mp3');
    if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || 'ytdl2 gagal');
    const b = await readResultBuffer(r, { minBytes: 20000, maxBytes: MAX_ORIGINAL_AUDIO_SIZE });
    if (sniffAudio(b)) return { buffer: b, sumber: `ytdl2 (${r.source})` };
    alasan.push('ytdl2: bukan audio');
  } catch (e) { alasan.push(`ytdl2: ${e?.message || e}`); }

  /* 3) Scraper ytmp3.mobi */
  try {
    const b = await scraperBuffer(ytUrl);
    if (sniffAudio(b)) return { buffer: b, sumber: 'Scraper' };
    alasan.push('Scraper: bukan audio');
  } catch (e) { alasan.push(`Scraper: ${e?.message || e}`); }

  throw new Error('Semua sumber audio gagal — ' + alasan.join(' | '));
}

async function compressAudio(inputBuffer, bps = '48000', sampleRate = FFMPEG_SAMPLE_RATE) {
  if (!Buffer.isBuffer(inputBuffer) || !inputBuffer.length) {
    throw new Error('Input buffer kosong');
  }
  if (!sniffAudio(inputBuffer)) {
    throw new Error(`Data bukan audio (${inputBuffer.length}B) — sumber download bermasalah`);
  }

  return new Promise((resolve, reject) => {
    let ffmpeg;
    try {
      ffmpeg = spawn(ffmpegInstaller.path, [
        '-hide_banner',
        '-loglevel', 'error',
        '-analyzeduration', '10000000',
        '-probesize', '10000000',
        '-i', 'pipe:0',
        '-vn',
        '-c:a', FFMPEG_CODEC,
        '-b:a', String(bps),
        '-ar', sampleRate,
        '-ac', FFMPEG_CHANNELS,
        '-application', 'audio',
        '-frame_duration', Number(bps) >= 28000 ? '20' : '60',
        '-f', FFMPEG_FORMAT,
        'pipe:1'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      return reject(error);
    }

    const chunks = [];
    const errTail = [];
    let outputSize = 0;
    let finished = false;

    const fail = error => {
      if (finished) return;
      finished = true;
      try { ffmpeg.kill('SIGKILL'); } catch {}
      reject(error);
    };

    ffmpeg.stdout.on('data', chunk => {
      outputSize += chunk.length;
      if (outputSize > MAX_COMPRESSED_AUDIO_SIZE) {
        return fail(new Error('Audio compress terlalu besar'));
      }
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', c => {
      errTail.push(c);
      if (errTail.length > 6) errTail.shift();
    });

    ffmpeg.on('error', error => {
      fail(error?.code === 'ENOENT' ? new Error('FFmpeg tidak ditemukan.') : error);
    });

    ffmpeg.on('close', code => {
      if (finished) return;
      if (code !== 0) {
        const detail = Buffer.concat(errTail).toString('utf8').trim()
          .split(/\r?\n/).slice(-2).join(' | ').slice(0, 300);
        return fail(new Error(`FFmpeg gagal (${code})${detail ? ': ' + detail : ''}`));
      }

      const output = Buffer.concat(chunks);
      if (!output.length) return fail(new Error('FFmpeg menghasilkan audio kosong'));

      finished = true;
      resolve(output);
    });

    ffmpeg.stdin.on('error', error => {
      if (error?.code !== 'EPIPE') fail(error);
    });

    ffmpeg.stdin.end(inputBuffer);
  });
}

/* =========================================================
 * COVER ARTWORK
 * ========================================================= */

async function getThumbDataUri(url) {
  if (!url) return '';
  const dir = mkdtempSync(join(tmpdir(), 'play2-cover-'));
  const masuk = join(dir, 'masuk');
  const keluar = join(dir, 'keluar.jpg');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) return '';
    writeFileSync(masuk, buf);
    await jalankan(ffmpegInstaller.path, ['-y', '-i', masuk, '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=240:240", '-q:v', '6', keluar]);
    const kecil = readFileSync(keluar);
    return `data:image/jpeg;base64,${kecil.toString('base64')}`;
  } catch {
    return '';
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* =========================================================
 * HTML MUSIC PLAYER TEMPLATE
 * ========================================================= */

function createMusicPlayer({ title, artist, duration, audioSrc, imageSrc, lyrics }) {
  const safeTitle = escapeHtml(title);
  const safeArtist = escapeHtml(artist);
  const safeDuration = escapeHtml(duration || '0:00');
  const safeImage = imageSrc || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFhMGQxMiIvPjx0ZXh0IHg9IjIwMCIgeT0iMjEwIiBmb250LXNpemU9IjM0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TUFJTiBQQ0xAYVlFUlI8L3RleHQ+PC9zdmc+';

  const lyricsJson = Buffer.from(
    JSON.stringify(Array.isArray(lyrics) ? lyrics : []),
    'utf8'
  ).toString('base64');

  return `
<style>
  :root {
    --ink: #ffffff;
    --muted: #b9b1b6;
    --sys: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { background: transparent; color: var(--ink); font-family: var(--sys); -webkit-font-smoothing: antialiased; }
  .wrap { display: flex; align-items: center; justify-content: center; padding: 10px; }
  .player { position: relative; width: 100%; max-width: 330px; border-radius: 18px; overflow: hidden; background: #1a0d12; box-shadow: 0 18px 40px rgba(0,0,0,.5); }
  .bg { position: absolute; inset: -30%; width: 160%; height: 160%; object-fit: cover; filter: blur(38px) saturate(1.5); opacity: .85; z-index: 0; }
  .veil { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(20,8,12,.65) 0%, rgba(20,8,12,.8) 45%, rgba(12,5,8,.96) 100%); }
  .content { position: relative; z-index: 2; padding: 16px 18px 18px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .head__icon { width: 18px; height: 18px; color: var(--ink); opacity: .85; flex: none; }
  .head__mid { text-align: center; flex: 1; min-width: 0; }
  .head__from { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .head__album { font-size: 12px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .poster { width: 100%; aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.06); box-shadow: 0 12px 26px rgba(0,0,0,.45); margin-bottom: 14px; }
  .poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .info { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .info__names { min-width: 0; }
  .info__title { font-size: 17px; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .info__artist { font-size: 12px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .info__heart { width: 34px; height: 34px; flex: none; display: flex; align-items: center; justify-content: center; background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; }
  .info__heart.is-on { color: #ff5c8a; }
  .mini-lyrics { position: relative; height: 82px; overflow-x: hidden; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; margin-bottom: 10px; overscroll-behavior: contain; scroll-behavior: auto; mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%); -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%); }
  .mini-lyrics::-webkit-scrollbar { display: none; }
  .lyrics-text { width: 100%; padding: 32px 0; display: flex; flex-direction: column; gap: 5px; }
  .lyric-line { font-size: 10.5px; color: rgba(255,255,255,.4); line-height: 1.4; transition: color .25s ease, font-size .25s ease, opacity .25s ease, transform .25s ease; text-align: left; white-space: normal; word-wrap: break-word; overflow-wrap: anywhere; font-weight: 500; opacity: .75; transform: translateX(0) scale(1); transform-origin: left center; }
  .lyric-line.is-active { font-size: 12px; color: #fff; font-weight: 700; opacity: 1; transform: translateX(2px) scale(1.01); }
  .lyrics-empty { font-size: 10.5px; color: var(--muted); text-align: left; padding: 16px 0; }
  .bar { position: relative; height: 4px; border-radius: 4px; background: rgba(255,255,255,.22); cursor: pointer; margin-bottom: 6px; touch-action: none; }
  .bar__fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 4px; background: #fff; pointer-events: none; }
  .bar__dot { position: absolute; top: 50%; left: 0; width: 11px; height: 11px; border-radius: 50%; background: #fff; transform: translate(-50%,-50%); pointer-events: none; }
  .time { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 12px; font-variant-numeric: tabular-nums; }
  .controls { display: flex; align-items: center; justify-content: space-between; }
  .ctrl { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: var(--ink); background: none; border: none; cursor: pointer; padding: 0; transition: opacity .2s ease, transform .15s ease; }
  .ctrl:active { opacity: .6; transform: scale(.92); }
  .play { width: 52px; height: 52px; border-radius: 50%; background: #fff; color: #12070b; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex: none; padding: 0; box-shadow: 0 6px 16px rgba(0,0,0,.4); transition: transform .15s ease; }
  .play:active { transform: scale(.93); }
  .note { margin-top: 12px; text-align: center; font-size: 10px; color: var(--muted); line-height: 1.6; }
</style>

<div class="wrap">
  <div class="player">
    <img class="bg" src="${escapeAttr(safeImage)}" alt="">
    <div class="veil"></div>
    <div class="content">
      <div class="head">
        <svg class="head__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        <div class="head__mid">
          <div class="head__from">YT Music Audio</div>
          <div class="head__album">${safeArtist}</div>
        </div>
        <svg class="head__icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </div>

      <div class="poster">
        <img src="${escapeAttr(safeImage)}" alt="${escapeAttr(safeTitle)}">
      </div>

      <div class="info">
        <div class="info__names">
          <div class="info__title">${safeTitle}</div>
          <div class="info__artist">${safeArtist}</div>
        </div>
        <button class="info__heart" id="heart" aria-label="Favorite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M20.8 5.6 a5.1 5.1 0 0 0-7.2 0 L12 7.2 l-1.6-1.6 a5.1 5.1 0 0 0-7.2 7.2 l1.6 1.6 L12 21.6 l7.2-7.2 1.6-1.6 a5.1 5.1 0 0 0 0-7.2z"/></svg>
        </button>
      </div>

      <div class="mini-lyrics" id="mini-lyrics">
        <div class="lyrics-text" id="lyrics-text"></div>
      </div>

      <div class="bar" id="bar">
        <div class="bar__fill" id="fill"></div>
        <div class="bar__dot" id="dot"></div>
      </div>

      <div class="time">
        <span id="cur">0:00</span>
        <span id="dur">${safeDuration}</span>
      </div>

      <div class="controls">
        <button class="ctrl" style="opacity:.5; cursor:default;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </button>

        <button class="ctrl" id="btn-rw" aria-label="Mundur 10 detik">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><text x="12" y="16.5" font-size="7.5" font-family="sans-serif" font-weight="bold" stroke="none" fill="currentColor" text-anchor="middle">10</text></svg>
        </button>

        <button class="play" id="play" aria-label="Play">
          <svg id="icon-play" viewBox="0 0 24 24" fill="currentColor" width="26" height="26"><path d="M8 5.6 v12.8 a.6.6 0 0 0 .92.5 l10-6.4 a.6.6 0 0 0 0-1 l-10-6.4 a.6.6 0 0 0-.92.5z"/></svg>
          <svg id="icon-pause" viewBox="0 0 24 24" fill="currentColor" width="26" height="26" style="display:none"><rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/></svg>
        </button>

        <button class="ctrl" id="btn-fw" aria-label="Maju 10 detik">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="16.5" font-size="7.5" font-family="sans-serif" font-weight="bold" stroke="none" fill="currentColor" text-anchor="middle">10</text></svg>
        </button>

        <button class="ctrl" style="opacity:.5; cursor:default;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1 a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1 a4 4 0 0 1-4 4H3"/></svg>
        </button>
      </div>

      <div class="note">support terus kami yaaa</div>
    </div>
  </div>
</div>

<audio id="audio" preload="auto" autoplay src="${escapeAttr(audioSrc)}"></audio>

<script>
(function() {
  'use strict';

  /* Media engine 3 tahap:
   * stage 0 = data URI langsung -> stage 1 = Blob URL -> stage 2 = WebAudio.
   * WebView kartu WA kadang menolak data:audio, tapi lolos lewat blob:/WebAudio. */
  const el = document.getElementById('audio');
  const dataUrl = el.getAttribute('src');
  let media = el;
  let stage = -1;
  const play = document.getElementById('play');
  const bar = document.getElementById('bar');
  const fill = document.getElementById('fill');
  const dot = document.getElementById('dot');
  const cur = document.getElementById('cur');
  const dur = document.getElementById('dur');
  const heart = document.getElementById('heart');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const lyricsContainer = document.getElementById('mini-lyrics');
  const lyricsText = document.getElementById('lyrics-text');
  const btnRw = document.getElementById('btn-rw');
  const btnFw = document.getElementById('btn-fw');

  let lyrics = [];
  try {
    const encoded = '${lyricsJson}';
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      lyrics = parsed
        .filter(item => item && Number.isFinite(Number(item.time)))
        .map(item => ({ time: Number(item.time), text: String(item.text || '♪') }))
        .sort((a, b) => a.time - b.time);
    }
  } catch {
    lyrics = [];
  }

  const lyricElements = [];
  function renderLyrics() {
    lyricsText.innerHTML = '';
    lyricElements.length = 0;

    if (!Array.isArray(lyrics) || !lyrics.length) {
      lyricsText.innerHTML = '<div class="lyrics-empty">Lirik belum tersedia untuk lagu ini.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    lyrics.forEach((line, index) => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.dataset.time = String(line.time);
      el.dataset.index = String(index);
      el.textContent = line.text || '♪';
      fragment.appendChild(el);
      lyricElements.push(el);
    });
    lyricsText.appendChild(fragment);
  }
  renderLyrics();

  let activeLyricIndex = -1;
  function findLyricIndex(time) {
    if (!lyrics.length) return -1;
    let low = 0, high = lyrics.length - 1, result = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (Number(lyrics[mid].time) <= time) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return result;
  }

  let targetScrollTop = 0, currentScrollTop = 0, scrollAnimationFrame = null;
  const SCROLL_SMOOTHNESS = 0.18;

  function calculateLyricScroll(element) {
    if (!element || !lyricsContainer) return 0;
    const elementTop = element.offsetTop;
    const elementHeight = element.offsetHeight;
    const containerHeight = lyricsContainer.clientHeight;
    let target = elementTop - (containerHeight / 2) + (elementHeight / 2);
    const maxScroll = Math.max(0, lyricsContainer.scrollHeight - containerHeight);
    return Math.max(0, Math.min(target, maxScroll));
  }

  function setLyricScrollTarget(element, immediate = false) {
    if (!element || !lyricsContainer) return;
    targetScrollTop = calculateLyricScroll(element);
    if (immediate) {
      currentScrollTop = targetScrollTop;
      lyricsContainer.scrollTop = targetScrollTop;
      return;
    }
    startScrollAnimation();
  }

  function startScrollAnimation() {
    if (scrollAnimationFrame !== null) return;
    function animate() {
      const difference = targetScrollTop - currentScrollTop;
      if (Math.abs(difference) < 0.5) {
        currentScrollTop = targetScrollTop;
        lyricsContainer.scrollTop = currentScrollTop;
        scrollAnimationFrame = null;
        return;
      }
      currentScrollTop += difference * SCROLL_SMOOTHNESS;
      lyricsContainer.scrollTop = currentScrollTop;
      scrollAnimationFrame = requestAnimationFrame(animate);
    }
    scrollAnimationFrame = requestAnimationFrame(animate);
  }

  function updateLyrics(currentTime, { immediate = false } = {}) {
    if (!lyrics.length || !lyricElements.length) return;
    const time = Number(currentTime) || 0;
    const index = findLyricIndex(time);

    if (index < 0) {
      if (activeLyricIndex !== -1) {
        activeLyricIndex = -1;
        lyricElements.forEach(el => el.classList.remove('is-active'));
      }
      return;
    }

    if (index === activeLyricIndex && !immediate) return;

    activeLyricIndex = index;
    lyricElements.forEach((el, i) => el.classList.toggle('is-active', i === index));
    const active = lyricElements[index];
    if (active) setLyricScrollTarget(active, immediate);
  }

  function resetLyrics() {
    activeLyricIndex = -1;
    lyricElements.forEach(el => el.classList.remove('is-active'));
    targetScrollTop = 0;
    currentScrollTop = 0;
    if (lyricsContainer) lyricsContainer.scrollTop = 0;
  }

  function formatTime(sec) {
    sec = Number(sec);
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateProgress() {
    const duration = Number(media.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const current = Math.max(0, Math.min(duration, Number(media.currentTime) || 0));
    const percent = (current / duration) * 100;
    fill.style.width = percent + '%';
    dot.style.left = percent + '%';
    cur.textContent = formatTime(current);
    updateLyrics(current);
  }

  function setPlaying() {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    startScrollAnimation();
  }

  function setPaused() {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }

  play.addEventListener('click', async () => {
    const s = stage;
    try {
      if (media.paused) {
        await media.play();
        setPlaying();
      } else {
        media.pause();
        setPaused();
      }
    } catch (e) {
      /* Gagal play bukan karena autoplay-policy -> naik ke tahap berikutnya */
      if (media === el && e && e.name !== 'NotAllowedError') next(s);
      else setPaused();
    }
  });

  heart.addEventListener('click', () => heart.classList.toggle('is-on'));

  btnRw.addEventListener('click', () => {
    const duration = Number(media.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    media.currentTime = Math.max(0, (Number(media.currentTime) || 0) - 10);
    updateLyrics(media.currentTime, { immediate: true });
    updateProgress();
  });

  btnFw.addEventListener('click', () => {
    const duration = Number(media.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    media.currentTime = Math.min(duration, (Number(media.currentTime) || 0) + 10);
    updateLyrics(media.currentTime, { immediate: true });
    updateProgress();
  });

  function seekFromPointer(clientX) {
    const duration = Number(media.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    if (!rect.width) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    media.currentTime = (x / rect.width) * duration;
    updateLyrics(media.currentTime, { immediate: true });
    updateProgress();
  }

  bar.addEventListener('pointerdown', event => seekFromPointer(event.clientX));

  function onEnded() {
    setPaused();
    fill.style.width = '0%';
    dot.style.left = '0%';
    cur.textContent = '0:00';
    resetLyrics();
  }

  /* ---------- Engine 3 tahap: data URI -> Blob URL -> WebAudio ---------- */

  function audioBytes() {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  function decodeBuffer(ctx, ab) {
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  /* Player penuh di atas WebAudio — dipakai bila elemen <audio> gagal total.
   * Interface-nya sama: paused/duration/currentTime/volume/play/pause/load. */
  function webAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('WebAudio tidak tersedia');
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    let buf = null, node = null, t0 = 0, off = 0, run = false, tick = 0, spd = 1;

    const w = {
      paused: true,
      ended: false,
      get duration() { return buf ? buf.duration : NaN; },
      get currentTime() { return run ? Math.min(buf.duration, off + (ctx.currentTime - t0) * spd) : off; },
      set currentTime(v) {
        if (!buf) return;
        const was = run;
        halt();
        off = Math.max(0, Math.min(buf.duration, v));
        if (was) go();
      },
      get volume() { return gain.gain.value; },
      set volume(v) { gain.gain.value = v; },
      get playbackRate() { return spd; },
      set playbackRate(v) {
        if (run) {
          off = w.currentTime;
          t0 = ctx.currentTime;
          node.playbackRate.value = v;
        }
        spd = v;
      },
      play() {
        return ctx.resume().then(() => {
          if (!buf) throw new Error('audio belum siap');
          if (!run) go();
        });
      },
      pause() {
        if (!run) return;
        off = w.currentTime;
        halt();
        if (w.onpause) w.onpause();
      },
      load() {
        return decodeBuffer(ctx, audioBytes().buffer).then((b) => {
          buf = b;
          if (w.onloadedmetadata) w.onloadedmetadata();
        });
      }
    };

    function halt() {
      run = false;
      w.paused = true;
      clearInterval(tick);
      if (node) {
        node.onended = null;
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
        node = null;
      }
    }

    function go() {
      node = ctx.createBufferSource();
      node.buffer = buf;
      node.playbackRate.value = spd;
      node.connect(gain);
      node.onended = function() {
        halt();
        off = 0;
        if (w.onended) w.onended();
      };
      w.ended = false;
      w.paused = false;
      run = true;
      t0 = ctx.currentTime;
      node.start(0, off);
      tick = setInterval(() => { if (w.ontimeupdate) w.ontimeupdate(); }, 250);
      if (w.onplay) w.onplay();
    }

    return w;
  }

  function mediaLoaded(x) {
    if (Number.isFinite(x.duration)) dur.textContent = formatTime(x.duration);
    updateProgress();
    tryPlay();
  }

  function tryPlay() {
    media.play().then(() => setPlaying()).catch(() => setPaused());
  }

  function showAudioError() {
    setPaused();
    if (lyricsText) lyricsText.innerHTML = '<div class="lyrics-empty">Audio gagal dimuat, coba kirim ulang perintah.</div>';
  }

  /* chain[0] sengaja kosong: stage 0 = elemen <audio> dengan data URI apa adanya */
  const chain = [
    null,
    function() {
      el.src = URL.createObjectURL(new Blob([audioBytes()], { type: 'audio/ogg' }));
      el.load();
    },
    function() {
      const wa = webAudio();
      wa.onplay = setPlaying;
      wa.onpause = () => { if (!wa.ended) setPaused(); };
      wa.onended = onEnded;
      wa.ontimeupdate = updateProgress;
      wa.onloadedmetadata = () => mediaLoaded(wa);
      media = wa;
      wa.load().catch(showAudioError);
    }
  ];

  function next(from) {
    if (from !== stage) return;
    if (stage + 1 < chain.length) begin(stage + 1);
    else showAudioError();
  }

  function begin(i) {
    stage = i;
    if (i > 0) {
      try { chain[i](); } catch (e) { next(i); return; }
    }
    setTimeout(() => {
      /* Masih mentok di elemen & belum siap apa pun setelah 3.5 dtk -> lanjut tahap */
      if (stage === i && media === el && el.readyState === 0) next(i);
    }, 3500);
  }

  /* ---------- Wiring elemen & kontrol ---------- */

  el.addEventListener('loadedmetadata', () => mediaLoaded(el));
  el.addEventListener('durationchange', () => {
    if (Number.isFinite(el.duration)) dur.textContent = formatTime(el.duration);
  });
  el.addEventListener('timeupdate', updateProgress);
  el.addEventListener('play', setPlaying);
  el.addEventListener('pause', () => { if (!el.ended) setPaused(); });
  el.addEventListener('ended', onEnded);
  el.onerror = () => next(stage);

  begin(0);
  if (el.error) next(0);

  setPaused();
})();
</script>
`;
}

/* =========================================================
 * ENCODE BUDGET — audio <= 470KB, max 48kbps, 24kHz
 * (kartu ~690KB terbukti ke-render & play mulus di WA)
 * ========================================================= */

const FFMPEG_MIN_KBPS = 8;            /* di bawah ini = artefak parah */
const ENCODE_PROFILE = { bytes: 470 * 1000, maxKbps: 48, sampleRate: FFMPEG_SAMPLE_RATE };

/* Encode iteratif: mulai dari bitrate yang muat budget, lalu koreksi
 * maksimal 2x dari hasil aktual (kebesaran -> turun, sisa ruang >= 10%
 * -> naik). Berhenti di floor 8kbps. */
async function encodeToBudget(input, seconds, { bytes, maxKbps, sampleRate }) {
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 240;
  const maxBps = maxKbps * 1000;
  let bps = Math.min(maxBps, Math.floor((bytes * 8) / seconds));
  let out = await compressAudio(input, bps, sampleRate);

  for (let i = 0; i < 2; i++) {
    const tooBig = out.length > bytes;
    const hasRoom = out.length < bytes * 0.9 && bps < maxBps;
    if (!tooBig && !hasRoom) break;

    const nextBps = Math.min(maxBps, Math.floor(bps * (bytes / out.length) * 0.98));
    if (nextBps < FFMPEG_MIN_KBPS * 1000) break;

    const retry = await compressAudio(input, nextBps, sampleRate);
    if (tooBig || retry.length <= bytes) {
      out = retry;
      bps = nextBps;
    } else break;
  }

  if (out.length > bytes * 1.1) throw new Error('Audio terlalu besar untuk player');
  return out;
}

/* =========================================================
 * RICH DELIVERY (Ichigo) — pola ping.js / mlbuild.js
 * placeholder AIRich -> EDIT jadi kartu (builders.AIRich + sendEdit)
 * Fallback: sendAIRich full -> relayRich manual
 * ========================================================= */

function richSection(html) {
  return {
    view_model: {
      __typename: 'GenAISingleLayoutViewModel',
      primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', trusted_sources: [], payload: html }
    }
  };
}

const BOT_JID = '867051314767696@bot';
const CARD_TITLE = '🎧 Now Playing';

/* Fallback terakhir: relay mentah + self-edit type 14 */
async function relayRich(conn, jid, html) {
  const messageId = randomUUID();
  const unifiedData = JSON.stringify({ response_id: messageId, sections: [richSection(html)] });
  const content = {
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { messageDisclaimerText: '', botResponseId: messageId } },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: CARD_TITLE }],
          unifiedResponse: { data: Buffer.from(unifiedData).toString('base64') },
          contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: BOT_JID }, forwardOrigin: 4 }
        }
      }
    }
  };
  await conn.relayMessage(jid, content, { messageId });
  await conn.relayMessage(jid, {
    protocolMessage: { key: { remoteJid: jid, fromMe: true, id: messageId }, type: 14, editedMessage: content, timestampMs: Date.now() }
  }, { additionalAttributes: { edit: '1' } });
}

async function editRich(conn, chat, id, html) {
  const rich = new conn.builders.AIRich(conn);
  rich.setTitle(CARD_TITLE);
  rich.addSection(richSection(html));
  await rich.sendEdit(chat, id);
}

async function sendMusicPlayer(conn, m, html) {
  /* 1) Placeholder 1 baris -> langsung di-edit jadi kartu (gak nyisa teks) */
  let sent = null;
  try {
    sent = await conn.sendAIRich(m.chat, (r) => r.addText('🎵 Menyiapkan lagu…'), { quoted: m, bypassDownload: true });
    if (!sent || !sent.key || !sent.key.id) sent = null;
  } catch { sent = null; }

  /* 2) Edit placeholder jadi kartu, atau kirim langsung */
  try {
    if (sent) {
      await editRich(conn, m.chat, sent.key.id, html);
      return;
    }
    await conn.sendAIRich(m.chat, (r) => {
      r.setTitle(CARD_TITLE);
      r.addSection(richSection(html));
    }, { quoted: m });
  } catch (e) {
    /* 3) Fallback terakhir */
    console.error('[PLAY2] sendAIRich gagal, pakai relay:', e?.message || e);
    await relayRich(conn, m.chat, html);
  }
}

/* =========================================================
 * HANDLER
 * ========================================================= */

async function handler(m, { sock }) {
  const conn = sock || m.conn;
  const prefix = m.prefix || '.';
  const command = m.command || 'play2';
  const react = (e) => Promise.resolve().then(() => m.react(e)).catch(() => {});

  let input = String(m.text || '').trim();
  if (!input && Array.isArray(m.args) && m.args.length) input = m.args.join(' ').trim();
  if (!input) input = String(m.quoted?.text || '').trim();

  if (!input) {
    return m.reply(`🎧 *Format Penggunaan:*\n\nContoh:\n\`${prefix}${command} peterpan walau habis terang\``);
  }

  await react('🎧');

  try {
    let ytUrl = input;
    let video = null;

    if (!/youtube\.com|youtu\.be/i.test(input)) {
      const search = await ytSearch(input);
      video = search?.videos?.[0];
      if (!video) throw new Error('Lagu tidak ditemukan di YouTube');
      ytUrl = video.url;
    } else {
      video = await ytFindVideo(ytUrl);
      if (!video) throw new Error('Video tidak ditemukan');
    }

    let lirikHasil = null;
    try {
      lirikHasil = await cariLirikSmart(video);
    } catch (e) {
      console.error('[PLAY2] Smart Lyric error:', e?.message || e);
    }

    const formatLirik = lirikHasil?.baris ? lirikHasil.baris.map(b => ({ time: b.time, text: b.text })) : [];

    const title = lirikHasil?.judul || video.title || 'Unknown';
    const artist = lirikHasil?.artis || video.author?.name || 'Unknown Artist';
    const duration = video.timestamp || formatDuration(video.seconds || 0);
    const thumbUrl = video.thumbnail || '';

    const imageSrc = await getThumbDataUri(thumbUrl);

    /* Sumber audio berlapis: SaveTube -> Gencipta -> scraper, semua divalidasi magic byte */
    const { buffer: originalBuffer, sumber: sumberAudio } = await ambilAudioAsli(ytUrl);
    console.log('[PLAY2] audio dari:', sumberAudio);

    /* Encode budget: <=470KB, max 48kbps */
    const secs = Number(video?.seconds) || 0;
    if (secs > 0 && (ENCODE_PROFILE.bytes * 8) / secs / 1000 < FFMPEG_MIN_KBPS) {
      throw new Error(`Durasi terlalu panjang (maks ${Math.floor(ENCODE_PROFILE.bytes * 8 / (FFMPEG_MIN_KBPS * 1000) / 60)} menit)`);
    }
    const compressedBuffer = await encodeToBudget(originalBuffer, secs > 0 ? secs : 240, ENCODE_PROFILE);
    console.log('[PLAY2] encode', (compressedBuffer.length * 8 / (secs > 0 ? secs : 240) / 1000).toFixed(1) + 'kbps,', (compressedBuffer.length / 1024).toFixed(0) + 'KB');

    const audioSrc = `data:audio/ogg;base64,${compressedBuffer.toString('base64')}`;

    if (Buffer.byteLength(audioSrc, 'utf8') > 8 * 1024 * 1024) {
      throw new Error('Audio Base64 terlalu besar.');
    }

    const html = createMusicPlayer({
      title,
      artist,
      duration,
      audioSrc,
      imageSrc,
      lyrics: formatLirik
    });

    await sendMusicPlayer(conn, m, html);
    await react('✅');
  } catch (error) {
    console.error('[PLAY2] Error:', error?.message || error);
    await react('❌');
    await m.reply(`❌ *GAGAL MEMPROSES LAGU*\n\n> ${error?.message || 'Unknown error'}`);
  }
}

export { pluginConfig as config, handler };