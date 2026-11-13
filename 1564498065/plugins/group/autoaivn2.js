import { getDatabase } from "../../src/lib/ichigo-database.js";
import { VOICE_LIST, DEFAULT_VOICE } from "../../src/lib/ichigo-auto-ai-vn2.js";

const pluginConfig = {
  name: "autoaivn2",
  alias: ["aivn2", "avn2"],
  category: "group",
  description:
    "Auto AI voice note (VN2) — fitur berdiri sendiri dari .autoai, semua balasan otomatis lewat voice note, suara bisa diganti",
  usage: ".autoaivn2 on/off | .autoaivn2 voice <nama> | .autoaivn2 logic <instruksi> | .autoaivn2 clear",
  example: ".autoaivn2 on\n.autoaivn2 voice hansen",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function voiceListText() {
  return Object.entries(VOICE_LIST)
    .map(([key, v]) => `> *${key}* — ${v.label}`)
    .join("\n");
}

// Kalau suara tersimpan sudah tidak ada di daftar, pakai default
function resolveVoice(key) {
  return VOICE_LIST[key] ? key : DEFAULT_VOICE;
}

async function handler(m) {
  const db = getDatabase();
  if (!db.db.data.autoai_vn2) db.db.data.autoai_vn2 = {};

  if (!m.isGroup) {
    return m.reply(`❌ Fitur ini hanya untuk grup!`);
  }
  if (!m.isAdmin && !m.isOwner) {
    return m.reply(`❌ Hanya admin yang bisa menggunakan fitur ini!`);
  }

  const args = m.args || [];
  const sub = (args[0] || "").toLowerCase();
  const cfg = db.db.data.autoai_vn2[m.chat];

  if (!sub) {
    const status = cfg?.enabled ? "✅ AKTIF" : "❌ NONAKTIF";
    const voiceKey = resolveVoice(cfg?.voice);
    const voiceLabel = VOICE_LIST[voiceKey].label;
    let txt = `🎙️ *ᴀᴜᴛᴏ ᴀɪ ᴠɴ2*\n\n`;
    txt += `╭┈┈⬡「 📋 *sᴛᴀᴛᴜs* 」\n`;
    txt += `┃ Status: ${status}\n`;
    txt += `┃ 🔊 Voice: *${voiceLabel}*\n`;
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`;
    txt += `*Perintah:*\n`;
    txt += `> .autoaivn2 on — aktifkan\n`;
    txt += `> .autoaivn2 off — nonaktifkan\n`;
    txt += `> .autoaivn2 voice <nama> — ganti suara\n`;
    txt += `> .autoaivn2 logic <instruksi> — ubah gaya bicara AI\n`;
    txt += `> .autoaivn2 clear — hapus memory chat\n\n`;
    txt += `*Daftar suara:*\n${voiceListText()}\n\n`;
    txt += `ℹ️ Fitur ini berdiri sendiri, terpisah dari .autoai. Semua balasan otomatis selalu berupa voice note. Bot merespon saat di-reply atau di-tag.`;
    return m.reply(txt);
  }

  if (sub === "on") {
    db.db.data.autoai_vn2[m.chat] = {
      enabled: true,
      voice: resolveVoice(cfg?.voice),
      instruction: cfg?.instruction || null,
      sessions: cfg?.sessions || {},
      activatedBy: m.sender,
      activatedAt: new Date().toISOString(),
    };
    db.save();
    const voiceLabel = VOICE_LIST[db.db.data.autoai_vn2[m.chat].voice].label;
    let txt = `🎙️ *ᴀᴜᴛᴏ ᴀɪ ᴠɴ2 ᴅɪᴀᴋᴛɪғᴋᴀɴ*\n\n`;
    txt += `╭┈┈⬡「 📋 *ɪɴғᴏ* 」\n`;
    txt += `┃ 🔊 Voice: *${voiceLabel}*\n`;
    txt += `┃ 👤 Diaktifkan: @${m.sender.split("@")[0]}\n`;
    txt += `╰┈┈┈┈┈┈┈┈⬡\n\n`;
    txt += `> ℹ️ Bot akan balas voice note saat di-reply atau di-tag\n`;
    txt += `> ℹ️ Ketik *.autoaivn2 voice <nama>* untuk ganti suara\n`;
    txt += `> ℹ️ Ketik *.autoaivn2 off* untuk menonaktifkan`;
    return m.reply(txt, { mentions: [m.sender] });
  }

  if (sub === "off") {
    if (db.db.data.autoai_vn2[m.chat]) {
      db.db.data.autoai_vn2[m.chat].enabled = false;
    } else {
      db.db.data.autoai_vn2[m.chat] = { enabled: false };
    }
    db.save();
    return m.reply(
      `🎙️ *ᴀᴜᴛᴏ ᴀɪ ᴠɴ2 ᴅɪɴᴏɴᴀᴋᴛɪғᴋᴀɴ*\n\n> Fitur auto voice note untuk grup ini telah dimatikan`,
    );
  }

  if (sub === "voice") {
    const voiceKey = (args[1] || "").toLowerCase();
    if (!voiceKey) {
      return m.reply(`🔊 *Daftar suara tersedia:*\n\n${voiceListText()}\n\n> Cara ganti: .autoaivn2 voice <nama>`);
    }
    if (!VOICE_LIST[voiceKey]) {
      return m.reply(`❌ Suara "${voiceKey}" tidak dikenali!\n\n${voiceListText()}`);
    }
    if (!db.db.data.autoai_vn2[m.chat]) {
      db.db.data.autoai_vn2[m.chat] = { enabled: false, sessions: {} };
    }
    db.db.data.autoai_vn2[m.chat].voice = voiceKey;
    db.save();
    return m.reply(`✅ Suara VN2 diubah ke *${VOICE_LIST[voiceKey].label}*`);
  }

  if (sub === "logic") {
    const fullArgs = m.fullArgs || "";
    const instruction = fullArgs.replace(/^logic\s*/i, "").trim();
    if (!instruction) {
      return m.reply(
        `❌ Sertakan instruksinya!\n\n> Contoh: .autoaivn2 logic kamu adalah asisten yang ceria dan singkat`,
      );
    }
    if (!db.db.data.autoai_vn2[m.chat]) {
      db.db.data.autoai_vn2[m.chat] = { enabled: false, sessions: {} };
    }
    db.db.data.autoai_vn2[m.chat].instruction = instruction;
    db.save();
    return m.reply(`✅ Gaya bicara AI VN2 diperbarui`);
  }

  if (sub === "clear") {
    if (db.db.data.autoai_vn2[m.chat]) {
      db.db.data.autoai_vn2[m.chat].sessions = {};
      db.save();
    }
    return m.reply(`🧹 Memory chat AutoAI VN2 untuk grup ini telah dihapus`);
  }

  return m.reply(`❌ Sub perintah tidak dikenali!\n\nKetik *.autoaivn2* untuk lihat panduan.`);
}

export { pluginConfig as config, handler };