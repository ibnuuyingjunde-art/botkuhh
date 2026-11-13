import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "igstalk2",
  alias: ["instagramstalk2", "stalkig2", "stalkinstagram2"],
  category: "stalker",
  description: "Stalk profil Instagram dengan kartu profil (centang verified) dan foto story - versi 2",
  usage: ".igstalk2 <username>",
  example: ".igstalk2 @qwerty276_",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const MAX_PHOTOS = 6;
const API = "https://api-cloud.my.id/stalk/instagram";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n) => compact.format(Number(n) || 0);
const full = (n) => (Number(n) || 0).toLocaleString("id-ID");

function cut(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;
}

// Buang karakter markdown supaya teks dari user tidak merusak format pesan
function safe(text) {
  return String(text || "").replace(/[\[\]()<>*_`]/g, " ").replace(/\s+/g, " ").trim();
}

async function handler(m, { sock }) {
  const input = (m.text || "").trim().split(/\s+/)[0] || "";
  const username = input
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0];

  if (!username) {
    return m.reply(
      `📸 *ɪɴsᴛᴀɢʀᴀᴍ sᴛᴀʟᴋ (ᴠ2)*\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} @qwerty276_\``,
    );
  }

  if (!/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
    return m.reply("❌ Username Instagram tidak valid. Gunakan huruf, angka, titik, atau underscore.");
  }

  await m.react("🕕");

  try {
    const data = await f(`${API}?username=${encodeURIComponent("@" + username)}`);
    const r = data?.result;
    const p = r?.profile;

    if (!data?.status || !p?.username) {
      await m.react("❌");
      return m.reply(`❌ Akun *@${username}* tidak ditemukan.`);
    }

    const stories = Array.isArray(r.stories) ? r.stories : [];
    // Foto story saja: story foto pakai url, story video pakai thumbnail
    const photos = stories
      .map((s) => (s?.isVideo ? s.thumb : s.url || s.thumb))
      .filter(Boolean)
      .slice(0, MAX_PHOTOS);
    const profileUrl = `https://www.instagram.com/${p.username}`;

    const ai = new AIRich(sock);

    // 1. Judul
    ai.setTitle(`Instagram @${p.username}`);

    // 2. Kartu profil (centang biru mengikuti status verified akun)
    const entity = {
      __typename: "GenAICompactEntityPrimitive",
      title: safe(p.fullName) || p.username,
      subtitle: `@${p.username} • ${fmt(p.followers)} pengikut`,
      secondary_subtitle: p.bio ? cut(safe(p.bio), 60) : "Instagram",
      entity_id: String(p.id || p.username),
      entity_url: profileUrl,
      entity_type: "PAGE",
      action_type: "FOLLOW",
      is_verified: !!p.verified,
    };
    if (p.avatar) entity.image = { url: p.avatar, url_fallback: p.avatar };

    ai.addSection({
      view_model: {
        primitive: entity,
        __typename: "GenAISingleLayoutViewModel",
      },
    });

    // 3. Teks statistik
    let info =
      `📸 *Profil Instagram*\n\n` +
      `👥 Pengikut: *${full(p.followers)}*\n` +
      `➕ Mengikuti: *${full(p.following)}*\n` +
      `🖼️ Postingan: *${full(p.posts)}*\n` +
      `🔒 Akun: *${p.isPrivate ? "Privat" : "Publik"}*`;
    if (r.storyCount) info += `\n📖 Story aktif: *${full(r.storyCount)}*`;
    if (p.bio && safe(p.bio).length > 1) info += `\n\n> ${safe(cut(p.bio, 200))}`;
    ai.addFOAText(info);

    // 4. Foto story (jika ada)
    if (photos.length > 0) ai.addImage(photos, { resolveUrl: true });

    ai.addMetadata("Instagram Stalk • By lyniX's MD");

    await ai.send(m.chat, { quoted: m, bypassDownload: true });
    await m.react("✅");
  } catch (err) {
    console.error("[IGStalk2] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };