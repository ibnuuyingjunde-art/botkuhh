import { randomUUID } from 'crypto';

const pluginConfig = {
  name: "yumiela",
  alias: ["yumiela", "yumielamd", "yumielabot", "ymd"],
  category: "utility",
  description: "Menampilkan informasi Yumiela Multi Device",
  usage: ".yumiela",
  example: ".yumiela",
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

/* =========================================================
 * HELPER: Ambil gambar & kompres menjadi base64
 * ========================================================= */
async function getImageBase64(url, width = 300, height = null, quality = 70) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    try {
      const sharp = (await import('sharp')).default;
      let compressed;
      if (height) {
        compressed = await sharp(buffer)
          .resize(width, height, { fit: 'fill' })
          .jpeg({ quality })
          .toBuffer();
      } else {
        compressed = await sharp(buffer)
          .resize(width, width, { fit: 'cover', position: 'centre' })
          .jpeg({ quality })
          .toBuffer();
      }
      return `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch {
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.error('[Yumiela] Gagal ambil gambar:', url, e.message);
    return `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#f3e8ff"/><text x="150" y="160" font-size="40" text-anchor="middle" fill="#7c3aed">YUMIELA</text></svg>').toString('base64')}`;
  }
}

/* =========================================================
 * ICON SVG (small inline)
 * ========================================================= */
const icons = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4m9-9h-4M7 12H3m16.364-6.364l-2.828 2.828M7.05 16.95l-2.828 2.828m0-16.556l2.828 2.828m9.9 9.9l2.828 2.828"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h4m-2-2v4M15 11h.01M18 13h.01M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>',
  flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12"/></svg>'
};

/* =========================================================
 * HTML TEMPLATE YUMIELA MULTI DEVICE (STATIC THUMBNAIL)
 * ========================================================= */
function createYumielaHtml(images) {
  const { hero, gallery1, gallery2, gallery3, gallery4 } = images;
  
  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  .yumiela-wrapper {
    font-family: 'Quicksand', sans-serif;
    background: linear-gradient(180deg, #fdfaff 0%, #f3e8ff 30%, #e9d5ff 70%, #fdfaff 100%);
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 15px;
    position: relative;
    overflow: hidden;
    border-radius: 16px;
  }
  .lightning {
    position: absolute;
    pointer-events: none;
    z-index: 0;
    opacity: 0.15;
    animation: flash 5s infinite ease-in-out;
  }
  .lightning:nth-child(1) { top: -5%; left: 5%; width: 90px; height: 180px; animation-delay: 0s; }
  .lightning:nth-child(2) { top: -2%; right: 10%; width: 70px; height: 150px; animation-delay: 1.8s; }
  .lightning:nth-child(3) { top: 35%; left: 2%; width: 60px; height: 130px; animation-delay: 3.2s; }
  .lightning:nth-child(4) { top: 55%; right: 5%; width: 80px; height: 170px; animation-delay: 0.6s; }
  .lightning:nth-child(5) { top: 70%; left: 12%; width: 50px; height: 110px; animation-delay: 2.4s; }
  .lightning:nth-child(6) { top: 65%; right: 3%; width: 65px; height: 140px; animation-delay: 4s; }
  @keyframes flash {
    0%, 90%, 100% { opacity: 0.1; }
    92% { opacity: 0.5; }
    94% { opacity: 0.2; }
    96% { opacity: 0.45; }
  }
  .container {
    max-width: 100%;
    margin: 0;
    padding: 0;
    position: relative;
    z-index: 1;
  }
  .yumiela-header {
    text-align: center;
    margin-bottom: 15px;
  }
  .hero-title {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    color: #2d1b4e;
    font-weight: 700;
    letter-spacing: 3px;
    line-height: 1;
  }
  .hero-subtitle {
    font-family: 'Caveat', cursive;
    font-size: 20px;
    color: #7c3aed;
    margin-top: 4px;
    letter-spacing: 2px;
  }
  .hero-tagline {
    font-size: 11px;
    color: #5b21b6;
    margin-top: 5px;
    font-style: italic;
  }
  .hero-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 6px;
  }
  .hero-divider .line {
    width: 30px;
    height: 1px;
    background: rgba(124,58,237,0.5);
  }
  .hero-divider .bolt-icon {
    color: #7c3aed;
    width: 16px;
    height: 16px;
  }
  .hero-card {
    background: rgba(255,255,255,0.85);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(124,58,237,0.15);
    margin-bottom: 15px;
    border: 1px solid rgba(124,58,237,0.2);
  }
  .hero-thumbnail {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
  }
  .hero-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .info-section {
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 15px;
    box-shadow: 0 5px 20px rgba(124,58,237,0.1);
    border: 2px dashed rgba(124,58,237,0.2);
    position: relative;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
  }
  .section-header h2 {
    font-family: 'Caveat', cursive;
    font-size: 26px;
    color: #5b21b6;
  }
  .sparkle {
    color: #7c3aed;
    width: 18px;
    height: 18px;
  }
  .info-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 18px;
  }
  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(124,58,237,0.05);
    border-radius: 12px;
    border: 1px solid rgba(124,58,237,0.1);
  }
  .info-icon {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 3px 10px rgba(124,58,237,0.25);
  }
  .info-icon svg {
    width: 18px;
    height: 18px;
  }
  .info-text { flex: 1; }
  .info-text .label {
    font-size: 10px;
    color: #7c3aed;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
  }
  .info-text .value {
    font-size: 14px;
    color: #2d1b4e;
    font-weight: 600;
    margin-top: 1px;
  }
  .quote-box {
    text-align: center;
    padding: 12px 15px;
    background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04));
    border-radius: 12px;
    margin-bottom: 18px;
    border: 1px dashed rgba(124,58,237,0.2);
  }
  .quote-text {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    color: #5b21b6;
    line-height: 1.4;
    font-style: italic;
  }
  .quote-line {
    width: 25px;
    height: 2px;
    background: #a855f7;
    margin: 8px auto 0;
    border-radius: 2px;
  }
  .features-section { margin-bottom: 5px; }
  .features-label {
    font-size: 10px;
    color: #7c3aed;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .feature-card {
    background: rgba(255,255,255,0.95);
    border-radius: 14px;
    padding: 14px 8px;
    text-align: center;
    box-shadow: 0 3px 12px rgba(124,58,237,0.1);
    border: 1px solid rgba(124,58,237,0.15);
    transition: all 0.3s ease;
    cursor: pointer;
  }
  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(124,58,237,0.2);
    border-color: rgba(124,58,237,0.3);
  }
  .feature-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #a855f7, #7c3aed);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 8px;
    color: white;
    box-shadow: 0 4px 12px rgba(124,58,237,0.3);
  }
  .feature-icon svg {
    width: 22px;
    height: 22px;
  }
  .feature-name {
    font-family: 'Caveat', cursive;
    font-size: 15px;
    color: #5b21b6;
    font-weight: 700;
  }
  .gallery-section {
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 15px;
    box-shadow: 0 5px 20px rgba(124,58,237,0.1);
    border: 2px dashed rgba(124,58,237,0.2);
  }
  .gallery-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
    flex-wrap: wrap;
    gap: 5px;
  }
  .gallery-title { display: flex; align-items: center; gap: 8px; }
  .gallery-title svg {
    width: 20px;
    height: 20px;
    color: #5b21b6;
  }
  .gallery-title h2 {
    font-family: 'Caveat', cursive;
    font-size: 26px;
    color: #5b21b6;
  }
  .gallery-subtitle {
    font-family: 'Caveat', cursive;
    font-size: 13px;
    color: #7c3aed;
    letter-spacing: 2px;
  }
  .gallery-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .polaroid {
    background: #fff;
    padding: 7px 7px 32px 7px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(124,58,237,0.15);
    position: relative;
    transform: rotate(var(--rotation, 0deg));
    transition: transform 0.3s;
  }
  .polaroid:hover {
    transform: rotate(0deg) scale(1.04);
    z-index: 10;
  }
  .polaroid:nth-child(1) { --rotation: -2.5deg; }
  .polaroid:nth-child(2) { --rotation: 2deg; }
  .polaroid:nth-child(3) { --rotation: 1.5deg; }
  .polaroid:nth-child(4) { --rotation: -1.5deg; }
  .polaroid-tape {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 35px;
    height: 12px;
    background: rgba(124,58,237,0.3);
    border-radius: 2px;
    z-index: 2;
  }
  .polaroid img {
    width: 100%;
    height: 110px;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }
  .polaroid-caption {
    position: absolute;
    bottom: 7px;
    left: 0;
    right: 0;
    text-align: center;
    font-family: 'Caveat', cursive;
    font-size: 13px;
    color: #5b21b6;
  }
  .footer {
    text-align: center;
    padding: 15px;
    position: relative;
  }
  .footer-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #5b21b6;
    font-family: 'Caveat', cursive;
    font-size: 16px;
  }
  .footer-line {
    width: 25px;
    height: 1px;
    background: #a855f7;
  }
  .footer-sparkle {
    color: #7c3aed;
    width: 14px;
    height: 14px;
  }
  .compass-icon {
    position: absolute;
    bottom: 8px;
    right: 15px;
    width: 35px;
    height: 35px;
    opacity: 0.25;
  }
  .deco-bolt {
    position: absolute;
    color: #7c3aed;
    opacity: 0.3;
    width: 18px;
    height: 18px;
  }
  .info-section .deco-bolt-1 { top: 8px; right: 15px; }
  .info-section .deco-bolt-2 { bottom: 15px; right: 35px; }
  @media (max-width: 480px) {
    .yumiela-wrapper { padding: 12px; }
    .hero-title { font-size: 26px; }
    .hero-subtitle { font-size: 17px; }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .gallery-header { flex-direction: column; align-items: flex-start; }
  }
</style>
<div class="yumiela-wrapper">
  <!-- Lightning Effects -->
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed">${icons.bolt}</svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#a855f7">${icons.bolt}</svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#9333ea">${icons.bolt}</svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed">${icons.bolt}</svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#a855f7">${icons.bolt}</svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#9333ea">${icons.bolt}</svg>

  <div class="container">
    <!-- Header teks di atas thumbnail -->
    <div class="yumiela-header">
      <div class="hero-title">YUMIELA</div>
      <div class="hero-subtitle">Multi Device</div>
      <div class="hero-tagline">"Stay Connected, Even in Another World"</div>
      <div class="hero-divider">
        <div class="line"></div>
        <div class="bolt-icon">${icons.bolt}</div>
        <div class="line"></div>
      </div>
    </div>

    <!-- Thumbnail statis -->
    <div class="hero-card">
      <div class="hero-thumbnail">
        <img src="${hero}" alt="Yumiela">
      </div>
    </div>

    <!-- Info section -->
    <div class="info-section">
      <div class="deco-bolt deco-bolt-1">${icons.bolt}</div>
      <div class="deco-bolt deco-bolt-2">${icons.bolt}</div>
      <div class="section-header">
        <h2>Informasi</h2>
        <span class="sparkle">${icons.sparkle}</span>
      </div>
      <div class="info-list">
        <div class="info-item">
          <div class="info-icon">${icons.user}</div>
          <div class="info-text">
            <div class="label">NAMA</div>
            <div class="value">Yumiela Multi Device</div>
          </div>
        </div>
        <div class="info-item">
          <div class="info-icon">${icons.box}</div>
          <div class="info-text">
            <div class="label">Version</div>
            <div class="value">5.1.0</div>
          </div>
        </div>
        <div class="info-item">
          <div class="info-icon">${icons.pen}</div>
          <div class="info-text">
            <div class="label">Author</div>
            <div class="value">Bayu Official</div>
          </div>
        </div>
        <div class="info-item">
          <div class="info-icon">${icons.gear}</div>
          <div class="info-text">
            <div class="label">Features</div>
            <div class="value">Ai, Downloader, Games, Group Manager</div>
          </div>
        </div>
      </div>
      <div class="quote-box">
        <div class="quote-text">"Hal terbaik selalu datang di waktu yang tepat."</div>
        <div class="quote-line"></div>
      </div>
      <div class="features-section">
        <div class="features-label">Features</div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">${icons.ai}</div>
            <div class="feature-name">Ai</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icons.download}</div>
            <div class="feature-name">Downloader</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icons.gamepad}</div>
            <div class="feature-name">Games</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icons.group}</div>
            <div class="feature-name">Group Manager</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Gallery section -->
    <div class="gallery-section">
      <div class="gallery-header">
        <div class="gallery-title">
          ${icons.camera}
          <h2>Gallery Yumiela</h2>
        </div>
        <div class="gallery-subtitle">— Memories ✦ Moments ✦ Yumiela —</div>
      </div>
      <div class="gallery-grid">
        <div class="polaroid">
          <div class="polaroid-tape"></div>
          <img src="${gallery1}" alt="Yumiela">
          <div class="polaroid-caption">Yumiela ✦</div>
        </div>
        <div class="polaroid">
          <div class="polaroid-tape"></div>
          <img src="${gallery2}" alt="The Journey">
          <div class="polaroid-caption">The Journey ⚡</div>
        </div>
        <div class="polaroid">
          <div class="polaroid-tape"></div>
          <img src="${gallery3}" alt="Peace">
          <div class="polaroid-caption">Peace ✦</div>
        </div>
        <div class="polaroid">
          <div class="polaroid-tape"></div>
          <img src="${gallery4}" alt="Yumiela">
          <div class="polaroid-caption">Yumiela ♡</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-content">
        <div class="footer-line"></div>
        <span class="footer-sparkle">${icons.sparkle}</span>
        <span>Yumiela Multi Device</span>
        <span class="footer-sparkle">${icons.sparkle}</span>
        <div class="footer-line"></div>
      </div>
      <svg class="compass-icon" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2v20M2 12h20"/>
        <path d="M12 7l3 5-3 5-3-5z" fill="#7c3aed" opacity="0.3"/>
      </svg>
    </div>
  </div>
</div>`;
}

/* =========================================================
 * HANDLER
 * ========================================================= */
async function handler(m, { sock }) {
  const conn = sock || m.conn;
  await m.react('⚡');

  try {
    // Hero: resize ke 520x292 (16:9) dengan fit fill agar tidak crop
    const hero = await getImageBase64('https://files.catbox.moe/zjfzd2.png', 520, 292, 70);
    // Galeri: persegi 250x250 (cover)
    const gallery1 = await getImageBase64('https://files.catbox.moe/i5sgao.jpg', 250, null, 65);
    const gallery2 = await getImageBase64('https://files.catbox.moe/8c0xui.jpg', 250, null, 65);
    const gallery3 = await getImageBase64('https://files.catbox.moe/jr1onq.jpg', 250, null, 65);
    const gallery4 = await getImageBase64('https://files.catbox.moe/esken7.jpg', 250, null, 65);

    const html = createYumielaHtml({ hero, gallery1, gallery2, gallery3, gallery4 });
    const responseId = randomUUID();

    const unifiedData = JSON.stringify({
      response_id: responseId,
      sections: [{
        view_model: {
          primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] },
          __typename: "GenAISingleLayoutViewModel"
        }
      }]
    });

    const messagePayload = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: { messageDisclaimerText: "", botResponseId: responseId }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: "Yumiela Multi Device" }],
            unifiedResponse: { data: Buffer.from(unifiedData).toString("base64") },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
              forwardOrigin: 4
            }
          }
        }
      }
    };

    await conn.relayMessage(m.chat, messagePayload, { messageId: responseId });
    await m.react('✅');
  } catch (error) {
    console.error("[Yumiela Error]", error);
    await m.react('❌');
    m.reply(`❌ Gagal memuat informasi Yumiela.\n\n> ${error?.message || 'Unknown error'}`);
  }
}

export { pluginConfig as config, handler };