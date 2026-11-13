import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "tiktokstalk",
  alias: ["ttstalk", "stalktiktok", "stalktt"],
  category: "stalker",
  description: "Stalk profil TikTok dengan kartu profil (centang verified) dan foto cover video",
  usage: ".tiktokstalk <username>",
  example: ".tiktokstalk @kazee291",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const MAX_PHOTOS = 6;
const API = "https://api-cloud.my.id/stalk/tiktok";

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

function engagementRate(posts) {
  const plays = posts.reduce((a, p) => a + (Number(p.plays) || 0), 0);
  if (!plays) return null;
  const inter = posts.reduce(
    (a, p) => a + (Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.shares) || 0),
    0,
  );
  return ((inter / plays) * 100).toFixed(2);
}

async function handler(m, { sock }) {
  const input = (m.text || "").trim().split(/\s+/)[0] || "";
  const username = input
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0];

  if (!username) {
    return m.reply(
      `🎵 *ᴛɪᴋᴛᴏᴋ sᴛᴀʟᴋ *\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} @kazee291\``,
    );
  }

  if (!/^[a-zA-Z0-9._]{2,24}$/.test(username)) {
    return m.reply("❌ Username TikTok tidak valid. Gunakan huruf, angka, titik, atau underscore.");
  }

  await m.react("🕕");

  try {
    const data = await f(`${API}?username=${encodeURIComponent("@" + username)}`);
    const r = data?.result;

    if (!data?.status || !r?.username) {
      await m.react("❌");
      return m.reply(`❌ Akun *@${username}* tidak ditemukan atau bersifat privat.`);
    }

    const posts = Array.isArray(r.posts) ? r.posts : [];
    const photos = posts.map((p) => p?.cover).filter(Boolean).slice(0, MAX_PHOTOS);
    const profileUrl = `https://www.tiktok.com/@${r.username}`;
    const s = r.stats || {};

    const ai = new AIRich(sock);

    // 1. Judul
    ai.setTitle(`TikTok @${r.username}`);

    // 2. Kartu profil (centang biru mengikuti status verified akun)
    const entity = {
      __typename: "GenAICompactEntityPrimitive",
      title: safe(r.nickname) || r.username,
      subtitle: `@${r.username} • ${fmt(s.followers)} pengikut`,
      secondary_subtitle: r.bio ? cut(safe(r.bio), 60) : "TikTok",
      entity_id: String(r.id || r.username),
      entity_url: profileUrl,
      entity_type: "PAGE",
      action_type: "FOLLOW",
      is_verified: !!r.verified,
    };
    if (r.avatar) entity.image = { url: r.avatar, url_fallback: r.avatar };

    ai.addSection({
      view_model: {
        primitive: entity,
        __typename: "GenAISingleLayoutViewModel",
      },
    });

    // 3. Teks statistik
    const er = engagementRate(posts);
    const top = posts.reduce((best, p) => (!best || (p.plays || 0) > (best.plays || 0) ? p : best), null);

    let info =
      `🎵 *Profil TikTok*\n\n` +
      `👥 Pengikut: *${full(s.followers)}*\n` +
      `➕ Mengikuti: *${full(s.following)}*\n` +
      `❤️ Total suka: *${full(s.likes)}*\n` +
      `🎬 Video: *${full(s.videos)}*`;
    if (er) info += `\n\n📈 Engagement: *${er}%*`;
    if (top?.plays) info += `\n🔥 Terpopuler: *${fmt(top.plays)}* views`;
    if (r.bio) info += `\n\n> ${safe(cut(r.bio, 200))}`;
    ai.addFOAText(info);

    // 4. Foto cover saja (tanpa video)
    if (photos.length > 0) ai.addImage(photos, { resolveUrl: true });

    ai.addMetadata("TikTok Stalk • By lyniX's MD");

    await ai.send(m.chat, { quoted: m, bypassDownload: true });
    await m.react("✅");
  } catch (err) {
    console.error("[TikTokStalk] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };