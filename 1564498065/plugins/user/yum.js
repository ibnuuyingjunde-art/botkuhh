import { randomUUID } from 'crypto';
import { getDatabase } from "../../src/lib/ichigo-database.js";
import { getRole } from "./level.js";
import { getUserStatusLabel } from "../../src/lib/ichigo-level.js";
import config from "../../config.js";
import { isPremiumGroup } from "../../src/lib/ichigo-premium-group.js";

const DEFAULT_ENERGI = config.energi?.default ?? 25;
const EXP_PER_LEVEL = 10000;

const pluginConfig = {
  name: "yumprofile",
  alias: ["yumprofil", "yumme", "yumstats", "yumyp"],
  category: "user",
  description: "Melihat profil user dengan HTML Aesthetic",
  usage: ".yumprofile [@user]",
  example: ".yumprofile",
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatNumber(num) {
  return (num ?? 0).toLocaleString("id-ID");
}

function isVipActive(user) {
  if (!user?.isVip) return false;
  if (!user.vipExpired || user.vipExpired === -1) return true;
  return Date.now() < user.vipExpired;
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTierColor(level) {
  if (level >= 250) return { name: "MYTHIC", color: "#F43F5E" };
  if (level >= 100) return { name: "DIAMOND", color: "#A78BFA" };
  if (level >= 50) return { name: "PLATINUM", color: "#67E8F9" };
  if (level >= 25) return { name: "GOLD", color: "#FFD700" };
  if (level >= 10) return { name: "SILVER", color: "#C0C0C0" };
  return { name: "BRONZE", color: "#CD7F32" };
}

async function getImageBase64(url, width = 200, quality = 70) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    try {
      const sharp = (await import('sharp')).default;
      const compressed = await sharp(buffer)
        .resize(width, width, { fit: 'cover', position: 'centre' })
        .jpeg({ quality })
        .toBuffer();
      return `data:image/jpeg;base64,${compressed.toString('base64')}`;
    } catch {
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch {
    return `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#f3e8ff"/><text x="100" y="110" font-size="60" text-anchor="middle" fill="#7c3aed">?</text></svg>').toString('base64')}`;
  }
}

function createProfileHtml({ avatar, name, statusLabel, role, level, expInLevel, expNeeded, hp, maxHp, mana, maxMana, stamina, maxStamina, koin, bank, energi, spouse }) {
  const tier = getTierColor(level);
  const statusColor = statusLabel === 'OWNER' ? '#FBBF24' : statusLabel === 'VIP' ? '#F472B6' : tier.color;
  
  const hpPercent = Math.min((hp / maxHp) * 100, 100);
  const manaPercent = Math.min((mana / maxMana) * 100, 100);
  const staminaPercent = Math.min((stamina / maxStamina) * 100, 100);
  const expPercent = Math.min((expInLevel / expNeeded) * 100, 100);

  return `
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  .profile-wrapper {
    font-family: 'Quicksand', sans-serif;
    background: linear-gradient(180deg, #fdfaff 0%, #f3e8ff 40%, #e9d5ff 100%);
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 15px;
    border-radius: 16px;
    position: relative;
    overflow: hidden;
  }
  .lightning {
    position: absolute;
    pointer-events: none;
    z-index: 0;
    opacity: 0.12;
    animation: flash 6s infinite ease-in-out;
  }
  .lightning:nth-child(1) { top: -5%; left: 5%; width: 90px; height: 180px; animation-delay: 0s; }
  .lightning:nth-child(2) { top: -2%; right: 10%; width: 70px; height: 150px; animation-delay: 1.8s; }
  .lightning:nth-child(3) { top: 40%; left: 2%; width: 60px; height: 130px; animation-delay: 3.2s; }
  .lightning:nth-child(4) { top: 60%; right: 5%; width: 80px; height: 170px; animation-delay: 0.6s; }
  @keyframes flash {
    0%, 90%, 100% { opacity: 0.08; }
    92% { opacity: 0.4; }
    94% { opacity: 0.15; }
    96% { opacity: 0.35; }
  }
  .container {
    position: relative;
    z-index: 1;
  }
  .header {
    text-align: center;
    margin-bottom: 15px;
  }
  .header-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: #2d1b4e;
    font-weight: 700;
    letter-spacing: 3px;
  }
  .header-subtitle {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    color: #7c3aed;
    margin-top: 3px;
  }
  .card {
    background: rgba(255,255,255,0.92);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 15px;
    box-shadow: 0 8px 30px rgba(124,58,237,0.12);
    border: 1px solid rgba(124,58,237,0.15);
    backdrop-filter: blur(10px);
  }
  .profile-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
  }
  .avatar {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px solid ${statusColor};
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 18px;
    font-weight: 700;
    color: #1e1b4b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status-badge {
    display: inline-block;
    background: ${statusColor};
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 12px;
    letter-spacing: 1px;
    margin-top: 4px;
  }
  .role-text {
    font-size: 13px;
    color: #6b21a8;
    margin-top: 4px;
  }
  .level-section {
    margin-bottom: 15px;
  }
  .level-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }
  .level-label {
    font-size: 12px;
    color: #5b21b6;
    font-weight: 600;
  }
  .level-number {
    font-size: 16px;
    font-weight: 700;
    color: ${tier.color};
  }
  .progress-bar {
    height: 8px;
    background: #e9d5ff;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #a855f7, #7c3aed);
    border-radius: 4px;
    width: ${expPercent}%;
  }
  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 15px;
  }
  .stat-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .stat-label {
    width: 70px;
    font-size: 12px;
    color: #4c1d95;
    font-weight: 600;
  }
  .stat-bar {
    flex: 1;
    height: 8px;
    background: #e9d5ff;
    border-radius: 4px;
    overflow: hidden;
  }
  .stat-fill-hp { background: linear-gradient(90deg, #f87171, #ef4444); height: 100%; width: ${hpPercent}%; border-radius: 4px; }
  .stat-fill-mana { background: linear-gradient(90deg, #38bdf8, #0ea5e9); height: 100%; width: ${manaPercent}%; border-radius: 4px; }
  .stat-fill-stamina { background: linear-gradient(90deg, #34d399, #10b981); height: 100%; width: ${staminaPercent}%; border-radius: 4px; }
  .stat-value {
    width: 80px;
    font-size: 11px;
    color: #4c1d95;
    text-align: right;
  }
  .economy {
    display: flex;
    justify-content: space-around;
    gap: 10px;
    margin-bottom: 15px;
    text-align: center;
  }
  .economy-item {
    background: #faf5ff;
    border-radius: 12px;
    padding: 10px;
    flex: 1;
    border: 1px solid #e9d5ff;
  }
  .economy-label {
    font-size: 10px;
    color: #7c3aed;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  .economy-value {
    font-size: 14px;
    font-weight: 700;
    color: #1e1b4b;
    margin-top: 4px;
  }
  .spouse {
    text-align: center;
    font-size: 13px;
    color: #db2777;
    margin-bottom: 15px;
  }
  .footer {
    text-align: center;
    font-size: 11px;
    color: #a78bfa;
    padding-top: 10px;
    border-top: 1px dashed #e9d5ff;
  }
  @media (max-width: 480px) {
    .profile-wrapper { padding: 12px; }
    .header-title { font-size: 24px; }
    .profile-header { gap: 10px; }
    .avatar { width: 60px; height: 60px; }
    .economy { flex-direction: column; }
  }
</style>
<div class="profile-wrapper">
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#a855f7"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#9333ea"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>
  <svg class="lightning" viewBox="0 0 24 24" fill="#7c3aed"><path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z"/></svg>

  <div class="container">
    <div class="header">
      <div class="header-title">PROFILE</div>
      <div class="header-subtitle">— Yumiela Multi Device —</div>
    </div>

    <div class="card">
      <div class="profile-header">
        <div class="avatar">
          <img src="${avatar}" alt="Avatar">
        </div>
        <div class="info">
          <div class="name">${escapeHtml(name)}</div>
          <span class="status-badge">${escapeHtml(statusLabel.toUpperCase())}</span>
          <div class="role-text">Class: ${escapeHtml(role)}</div>
        </div>
      </div>

      <div class="level-section">
        <div class="level-row">
          <span class="level-label">LEVEL ${formatNumber(level)}</span>
          <span class="level-number">${formatNumber(expInLevel)} / ${formatNumber(expNeeded)} EXP</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">HP</span>
          <div class="stat-bar"><div class="stat-fill-hp"></div></div>
          <span class="stat-value">${formatNumber(hp)}/${formatNumber(maxHp)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">MANA</span>
          <div class="stat-bar"><div class="stat-fill-mana"></div></div>
          <span class="stat-value">${formatNumber(mana)}/${formatNumber(maxMana)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">STAMINA</span>
          <div class="stat-bar"><div class="stat-fill-stamina"></div></div>
          <span class="stat-value">${formatNumber(stamina)}/${formatNumber(maxStamina)}</span>
        </div>
      </div>

      <div class="economy">
        <div class="economy-item">
          <div class="economy-label">KOIN</div>
          <div class="economy-value">Rp ${formatNumber(koin)}</div>
        </div>
        <div class="economy-item">
          <div class="economy-label">BANK</div>
          <div class="economy-value">Rp ${formatNumber(bank)}</div>
        </div>
        <div class="economy-item">
          <div class="economy-label">ENERGI</div>
          <div class="economy-value">${energi}</div>
        </div>
      </div>

      ${spouse ? `<div class="spouse">💞 Pasangan: @${escapeHtml(spouse.split("@")[0])}</div>` : ''}
    </div>

    <div class="footer">• YumProfile Aesthetic •</div>
  </div>
</div>`;
}

async function handler(m, { sock }) {
  await m.react('🕕');

  try {
    const db = getDatabase();
    const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender;
    const user = db.getUser(target) || db.setUser(target);

    if (!user.rpg) user.rpg = {};
    const userExp = user.exp || 0;
    const userLevel = Math.min(Math.floor(userExp / EXP_PER_LEVEL) + 1, 900001);

    user.rpg.level = userLevel;
    user.rpg.health = user.rpg.health || 100;
    user.rpg.maxHealth = 100 + (userLevel - 1) * 10;
    user.rpg.mana = user.rpg.mana || 100;
    user.rpg.maxMana = 100 + (userLevel - 1) * 5;
    user.rpg.stamina = user.rpg.stamina || 100;
    user.rpg.maxStamina = 100 + (userLevel - 1) * 5;

    const currentLevelExp = (userLevel - 1) * EXP_PER_LEVEL;
    const levelUpExp = userLevel * EXP_PER_LEVEL;
    const expInLevel = userExp - currentLevelExp;
    const expNeeded = levelUpExp - currentLevelExp;
    const role = getRole(userLevel);

    const isOwnerUser = config.isOwner ? config.isOwner(target) : false;
    const isPremiumUser = (config.isPremium ? config.isPremium(target) : false) || (m.isGroup && isPremiumGroup(m.chat));
    const vipActive = isVipActive(user);

    const { label: statusLabel } = getUserStatusLabel({
      isOwner: isOwnerUser,
      isVip: vipActive,
      isPremium: isPremiumUser,
    });

    const energiDisplay = isOwnerUser || vipActive || isPremiumUser
      ? "Unlimited"
      : (user.energi === -1 ? "Unlimited" : (user.energi ?? DEFAULT_ENERGI));

    let avatarBase64;
    try {
      const ppUrl = await sock.profilePictureUrl(target, "image");
      avatarBase64 = await getImageBase64(ppUrl);
    } catch {
      avatarBase64 = await getImageBase64("https://i.imgur.com/TuItj4L.png");
    }

    const nameText = user.name || (target === m.sender ? m.pushName : target.split("@")[0]) || "Unknown";

    const html = createProfileHtml({
      avatar: avatarBase64,
      name: nameText,
      statusLabel,
      role,
      level: userLevel,
      expInLevel,
      expNeeded,
      hp: user.rpg.health,
      maxHp: user.rpg.maxHealth,
      mana: user.rpg.mana,
      maxMana: user.rpg.maxMana,
      stamina: user.rpg.stamina,
      maxStamina: user.rpg.maxStamina,
      koin: user.koin,
      bank: user.rpg.bank || 0,
      energi: energiDisplay,
      spouse: user.rpg.spouse,
    });

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
            submessages: [{ messageType: 2, messageText: `Profile ${nameText}` }],
            unifiedResponse: { data: Buffer.from(unifiedData).toString("base64") },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
              forwardOrigin: 4,
              mentionedJid: [target, ...(user.rpg.spouse ? [user.rpg.spouse] : [])],
            }
          }
        }
      }
    };

    await sock.relayMessage(m.chat, messagePayload, { messageId: responseId });
    await m.react('✅');
  } catch (error) {
    console.error("[YUMPROFILE_ERROR]", error);
    await m.react('❌');
    m.reply(`❌ Gagal memuat profil.\n\n> ${error?.message || error}`);
  }
}

export { pluginConfig as config, handler };