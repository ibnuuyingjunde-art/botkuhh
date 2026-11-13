import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BASE_URL = 'https://webappcreator.amethystlab.org';
const API_URL = `${BASE_URL}/api/build-apk`;

const pluginConfig = {
  name: 'web2apk',
  alias: ['website2apk', 'webtoapk'],
  category: 'tools',
  description: 'Membuat aplikasi Android APK dari website',
  usage: '.web2apk <url>|<nama aplikasi>|<url icon>|<package name>|<versi>|<kode versi>',
  example: '.web2apk https://example.com|UdunJadiBot|https://example.com/icon.png|app.udunjadibot.com|1.0.0|1',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 5,
  isEnabled: true
};

function normalizeHttpUrl(value, label) {
  let raw = String(value || '').trim();
  if (!raw) throw new Error(`${label} wajib diisi.`);
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} tidak valid.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} harus menggunakan HTTP atau HTTPS.`);
  }
  return parsed.toString();
}

function normalizePackageName(value, appName) {
  const candidate = String(value || '').trim() ||
    `com.${String(appName).toLowerCase().replace(/[^a-z0-9]/g, '') || 'app'}.web2apk`;
  // Android package names are dot-separated identifiers, not URLs.
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(candidate)) {
    throw new Error('Package name tidak valid. Contoh: com.contoh.aplikasi');
  }
  return candidate;
}

async function downloadIcon(iconUrl) {
  const response = await axios.get(iconUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' }
  });
  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  const buffer = Buffer.from(response.data);
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error('File icon kosong atau lebih besar dari 5 MB.');
  }
  if (!contentType.startsWith('image/')) {
    throw new Error('URL icon tidak mengembalikan file gambar. Gunakan URL PNG/JPG/WebP langsung.');
  }
  return buffer;
}

async function buildApk({ websiteUrl, appName, iconBuffer, packageName, versionName, versionCode }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web2apk-'));
  const iconPath = path.join(tempDir, 'icon.png');
  fs.writeFileSync(iconPath, iconBuffer);

  try {
    const form = new FormData();
    form.append('websiteUrl', websiteUrl);
    form.append('appName', appName);
    form.append('icon', fs.createReadStream(iconPath), {
      filename: 'icon.png',
      contentType: 'image/png'
    });
    form.append('packageName', packageName);
    form.append('versionName', versionName);
    form.append('versionCode', String(versionCode));

    const { data } = await axios.post(API_URL, form, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        ...form.getHeaders()
      },
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (!data?.success) {
      throw new Error(data?.message || 'Layanan Web2APK gagal membuat APK.');
    }
    if (!data?.downloadUrl) {
      throw new Error('API berhasil merespons tetapi tidak memberikan URL unduhan APK.');
    }

    const downloadUrl = new URL(data.downloadUrl, BASE_URL).toString();
    if (!['https:', 'http:'].includes(new URL(downloadUrl).protocol)) {
      throw new Error('API memberikan URL unduhan yang tidak valid.');
    }
    return { downloadUrl, packageName };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

async function handler(m, { sock }) {
  const raw = (m.args || []).join(' ').trim();
  if (!raw) {
    return m.reply(
      `📱 *WEB2APK — Website jadi APK*\\n\\n` +
      `Format:\\n${m.prefix}web2apk <url>|<nama aplikasi>|<url icon>|<package name>|<versi>|<kode versi>\\n\\n` +
      `Contoh:\\n${m.prefix}web2apk https://example.com|UdunJadiBot|https://example.com/icon.png|app.udunjadibot.com|1.0.0|1\\n\\n` +
      `Icon harus berupa URL gambar langsung (PNG/JPG/WebP).`
    );
  }

  const parts = raw.includes('|')
    ? raw.split('|').map(v => v.trim())
    : raw.split(',').map(v => v.trim());

  const [rawWebsite, rawName, rawIcon, rawPackage, rawVersion, rawCode] = parts;
  if (!rawWebsite || !rawName || !rawIcon) {
    return m.reply(`❌ Format belum lengkap.\\nContoh:\\n${m.prefix}web2apk https://example.com|UdunJadiBot|https://example.com/icon.png|app.udunjadibot.com|1.0.0|1`);
  }

  let websiteUrl;
  let iconUrl;
  let packageName;
  const appName = rawName.slice(0, 50);
  const versionName = rawVersion || '1.0.0';
  const versionCode = Number.parseInt(rawCode || '1', 10);

  try {
    websiteUrl = normalizeHttpUrl(rawWebsite, 'URL website');
    iconUrl = normalizeHttpUrl(rawIcon, 'URL icon');
    packageName = normalizePackageName(rawPackage, appName);
    if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/.test(versionName)) {
      throw new Error('Versi tidak valid. Contoh: 1.0.0');
    }
    if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
      throw new Error('Kode versi harus berupa angka bulat minimal 1.');
    }
  } catch (error) {
    return m.reply(`❌ ${error.message}`);
  }

  await m.react?.('🛠️');
  try {
    await m.reply('⏳ Sedang membuat APK. Proses dapat memerlukan beberapa menit.');
    const iconBuffer = await downloadIcon(iconUrl);
    const result = await buildApk({
      websiteUrl,
      appName,
      iconBuffer,
      packageName,
      versionName,
      versionCode
    });

    await sock.sendMessage(m.chat, {
      document: { url: result.downloadUrl },
      mimetype: 'application/vnd.android.package-archive',
      fileName: `${appName.replace(/[^a-z0-9_-]/gi, '_') || 'app'}.apk`,
      caption:
        `╭───┈ *WEB2APK* ┈───\\n` +
        `│ 📱 Nama: ${appName}\\n` +
        `│ 🌐 Website: ${websiteUrl}\\n` +
        `│ 📦 Package: ${packageName}\\n` +
        `│ 🔖 Versi: ${versionName} (${versionCode})\\n` +
        `│ ✅ Status: APK berhasil dibuat\\n` +
        `╰──────────────────`
    }, { quoted: m });
    await m.react?.('✅');
  } catch (error) {
    console.error('[web2apk]', error?.response?.data || error);
    await m.react?.('❌');
    return m.reply(`❌ Gagal membuat APK: ${error?.response?.data?.message || error.message || 'Terjadi kesalahan pada layanan Web2APK.'}`);
  }
}

export { pluginConfig as config, handler };