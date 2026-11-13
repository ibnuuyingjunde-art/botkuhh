import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "ffstalk2",
  alias: ["freefireid2", "stalkff2", "freefirestalk2"],
  category: "stalker",
  description: "Stalk ID Free Fire dengan kartu profil, karakter, dan pet - versi 2",
  usage: ".ffstalk2 <uid>",
  example: ".ffstalk2 9104119236",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/stalk/freefire";

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

function date(v) {
  const d = new Date(v);
  if (!v || v === "0" || isNaN(d)) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function handler(m, { sock }) {
  const uid = (m.text || "").trim().split(/\s+/)[0] || "";

  if (!uid) {
    return m.reply(
      `🔥 *ꜰʀᴇᴇ ꜰɪʀᴇ sᴛᴀʟᴋ (ᴠ2)*\n\n` +
        `> Contoh:\n` +
        `\`${m.prefix}${m.command} 9104119236\``,
    );
  }

  if (!/^\d{5,15}$/.test(uid)) {
    return m.reply("❌ UID Free Fire tidak valid. Gunakan angka saja (5-15 digit).");
  }

  await m.react("🕕");

  try {
    const data = await f(`${API}?uid=${encodeURIComponent(uid)}`);
    const r = data?.result;

    if (!data?.status || !r?.uid) {
      await m.react("❌");
      return m.reply(`❌ UID *${uid}* tidak ditemukan.`);
    }

    const guild = r.guild || null;
    const pet = r.pet || null;
    const ban = r.ban || null;
    const banned = !!ban?.isBanned;
    const avatar = r.avatarUrl || r.character?.icon;

    const ai = new AIRich(sock);

    // 1. Judul
    ai.setTitle(`Free Fire ${r.uid}`);

    // 2. Kartu profil
    const entity = {
      __typename: "GenAICompactEntityPrimitive",
      title: safe(r.nickname) || r.uid,
      subtitle: `UID ${r.uid} • Lv.${r.level ?? "-"} • ${r.region || "-"}`,
      secondary_subtitle: r.social?.signature ? cut(safe(r.social.signature), 60) : "Free Fire",
      entity_id: String(r.uid),
      entity_url: "https://ff.garena.com",
      entity_type: "PAGE",
      action_type: "FOLLOW",
      is_verified: false,
    };
    if (avatar) entity.image = { url: avatar, url_fallback: avatar };

    ai.addSection({
      view_model: {
        primitive: entity,
        __typename: "GenAISingleLayoutViewModel",
      },
    });

    // 3. Teks statistik
    let info =
      `🔥 *Profil Free Fire*\n\n` +
      `🆔 UID: *${r.uid}*\n` +
      `📊 Level: *${r.level ?? "-"}*\n` +
      `🌍 Region: *${r.region || "-"}*\n` +
      `❤️ Likes: *${full(r.liked)}*\n` +
      `👑 Prime Level: *${r.primeLevel ?? "-"}*\n\n` +
      `🏆 BR Rank Point: *${full(r.rankingPoints)}*` +
      (r.rank != null ? ` (rank ${r.rank})` : "") +
      `\n🎯 CS Rank: *${r.csRank ?? "-"}*`;

    if (r.credit?.creditScore != null) info += `\n💳 Credit Score: *${r.credit.creditScore}*`;

    if (guild?.guildName) {
      info +=
        `\n\n👥 Guild: *${safe(guild.guildName)}*` +
        (guild.guildLevel != null ? ` (Lv.${guild.guildLevel})` : "") +
        (guild.memberNum != null ? `\n🧑‍🤝‍🧑 Member: *${guild.memberNum}/${guild.capacity ?? "-"}*` : "");
    }

    if (r.character?.name) info += `\n\n🧍 Karakter: *${safe(r.character.name)}*`;
    if (pet?.speciesName) {
      info += `\n🐾 Pet: *${safe(pet.speciesName)}* Lv.${pet.level ?? "-"}`;
      if (pet.skinName) info += `\n🎨 Skin pet: ${safe(pet.skinName)}`;
      if (pet.skillName) info += `\n✨ Skill: ${safe(pet.skillName)}`;
    }

    info +=
      `\n\n🚫 Status: *${banned ? "BANNED" : "Aman"}*` +
      `\n📅 Dibuat: ${date(r.createdAt)}` +
      `\n🕒 Login terakhir: ${date(r.lastLoginAt)}`;

    if (r.social?.signature) info += `\n\n> ${safe(cut(r.social.signature, 200))}`;
    ai.addFOAText(info);

    // 4. Gambar karakter + skin pet
    const photos = [r.character?.icon, pet?.skinIconUrl].filter(Boolean);
    if (photos.length > 0) ai.addImage(photos, { resolveUrl: true });

    ai.addMetadata("Free Fire Stalk • By lyniX's MD");

    await ai.send(m.chat, { quoted: m, bypassDownload: true });
    await m.react("✅");
  } catch (err) {
    console.error("[FFStalk2] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };