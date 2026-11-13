import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "amfind",
  alias: ["amlink", "findpreset", "cariam", "amsearch"],
  category: "tools",
  description: "Cari link preset Alight Motion dari link TikTok (video + preset)",
  usage: ".amfind <link tiktok>",
  example: ".amfind https://vt.tiktok.com/ZSbCPUQFA/",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API = "https://api-cloud.my.id/tools/amfind";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n) => compact.format(Number(n) || 0);

function cut(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t;
}

function date(v) {
  const d = new Date(v);
  if (!v || isNaN(d)) return "-";
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FOUND_IN = {
  comment: "komentar",
  caption: "caption",
  bio: "bio",
  description: "deskripsi",
};

async function handler(m, { sock }) {
  const url = (m.text || m.quoted?.text || "").trim().split(/\s+/).find((v) => /^https?:\/\//i.test(v));

  if (!url) {
    return m.reply(
      `🎞️ *ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ ᴘʀᴇsᴇᴛ ꜰɪɴᴅᴇʀ*\n\n` +
        `> Kirim link TikTok video edit AM\n\n` +
        `\`${m.prefix}${m.command} https://vt.tiktok.com/ZSbCPUQFA/\``,
    );
  }

  if (!/tiktok\.com/i.test(url)) {
    return m.reply("❌ Link harus berasal dari TikTok (tiktok.com / vt.tiktok.com).");
  }

  await m.react("🕕");

  try {
    const res = await f(`${API}?url=${encodeURIComponent(url)}`);
    const d = res?.result?.data;

    // result {} / tidak ada data = preset tidak ditemukan
    if (!res?.status || !d) {
      await m.react("❌");
      return m.reply("❌ Preset tidak ditemukan untuk link tersebut.\n\n> Pastikan video punya link preset di komentar/caption.");
    }

    const v = d.video || {};
    const u = d.user || {};
    const p = d.preset || null;
    const items = Array.isArray(p?.items) ? p.items.filter((i) => i?.url) : [];
    const videoLink = v.url || d.query_url || url;

    let caption = `🎞️ *ᴀʟɪɢʜᴛ ᴍᴏᴛɪᴏɴ ᴘʀᴇsᴇᴛ*\n\n`;
    if (u.username) caption += `👤 *Kreator:* @${u.username}\n`;
    if (v.caption) caption += `📝 *Caption:* ${cut(v.caption, 150)}\n`;
    caption +=
      `👁️ ${fmt(v.views)}  ❤️ ${fmt(v.likes)}  💬 ${fmt(v.comments)}  🔁 ${fmt(v.shares)}\n` +
      (v.created_at ? `📅 *Upload:* ${date(v.created_at)}\n` : "");

    caption += `\n🔗 *Video TikTok:*\n${videoLink}\n`;

    if (items.length) {
      const src = FOUND_IN[d.found_in];
      caption += `\n📦 *Preset${src ? ` (dari ${src}${p?.username ? ` @${p.username}` : ""})` : ""}:*\n`;
      for (const it of items) {
        caption += `• *${it.label || "Preset"}*\n${it.url}\n`;
      }
    } else {
      caption += `\n⚠️ Video ditemukan, tapi link preset tidak ada.`;
    }

    await m.react("✅");

    const media = v.play_url || v.play_wm_url;
    let sent = false;

    if (media) {
      try {
        await sock.sendMedia(m.chat, media, null, m, { caption, type: "video" });
        sent = true;
      } catch (e) {
        console.error("[AMFind] gagal kirim video:", e.message);
      }
    }

    if (!sent && d.thumbnail) {
      try {
        await sock.sendMedia(m.chat, d.thumbnail, null, m, { caption, type: "image" });
        sent = true;
      } catch {}
    }

    if (!sent) await m.reply(caption);
  } catch (err) {
    console.error("[AMFind] Error:", err.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };