import te from "../../src/lib/ichigo-error.js";
import {
  setAiAgentEnabled,
  getAiAgentStatus,
  configureAiAgent,
  clearAiAgentSessions,
} from "../../src/lib/ichigo-ai-agent.js";

const pluginConfig = {
  name: "aiagent",
  alias: ["lynixagent", "agentai", "lynixs"],
  category: "owner",
  description:
    "Kontrol AI Agent lyniX's — selalu siap chat, punya perasaan, bisa chat owner saat gabut",
  usage:
    ".aiagent on/off | status | mode smart/always | boredom on/off | clearsession",
  example: ".aiagent on",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function formatStatus(s) {
  if (!s) return "❌ Gagal baca status agent";
  const top =
    s.topChats?.length > 0
      ? s.topChats
          .map(
            (c, i) =>
              `┃ ${i + 1}. ${c.name || c.id.split("@")[0]} (${c.count}x)`,
          )
          .join("\n")
      : "┃ (belum ada data)";

  return (
    `🤖 *lyniX's AI Agent*\n\n` +
    `╭┈┈⬡「 📊 *sᴛᴀᴛᴜs* 」\n` +
    `┃ 🔘 Aktif: ${s.enabled ? "✅ ON" : "❌ OFF"}\n` +
    `┃ 🧠 Mode: *${s.mode}*\n` +
    `┃ 💬 Private: ${s.allowPrivate ? "✅" : "❌"}\n` +
    `┃ 👥 Group: ${s.allowGroup ? "✅" : "❌"}\n` +
    `┃ 😴 Boredom chat: ${s.boredomChat ? "✅" : "❌"}\n` +
    `┃ 🗣️ Nimbrung: ${s.nimbrung !== false ? "✅" : "❌"}\n` +
    `┃ 📨 Replies: ${s.replies}\n` +
    `┃ 🤫 Skips: ${s.skips}\n` +
    `┃ ⚡ Actions: ${s.actions || 0}\n` +
    `┃ 🗂️ Sessions: ${s.sessionCount}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `╭┈┈⬡「 🔥 *ᴄʜᴀᴛ ᴛᴇʀᴀᴋᴛɪꜰ* 」\n` +
    `${top}\n` +
    `╰┈┈┈┈┈┈┈┈⬡\n\n` +
    `> Mode *smart*: panggil pakai kata *ai* terpisah / mention / reply bot\n` +
    `> Mode *always*: jawab hampir semua pesan (hati-hati spam)`
  );
}

async function handler(m) {
  const args = m.args || [];
  const sub = (args[0] || "").toLowerCase();

  if (!sub) {
    return m.reply(
      `🤖 *lyniX's AI Agent*

` +
        `Chat natural tanpa command + bisa pakai fitur bot.

` +
        `*Cara panggil:*
` +
        `> Kata *ai* terpisah: \`lu tau gak ai\` ✅
` +
        `> Bukan nempel: \`AIb siapa\` ❌
` +
        `> Custom nama: bilang \`ai sekarang lu gua panggil titut\`
` +
        `> Lalu cukup ketik \`titut ...\` — agent nyaut
` +
        `> Mention bot / reply pesan bot juga oke

` +
        `*Contoh fitur:*
` +
        `> \`ai gua mau reaction saluran\`
` +
        `> Agent minta link post + emoji, lalu kirim reaksi

` +
        `*Owner commands:*
` +
        `> \`${m.prefix}aiagent on/off\`
` +
        `> \`${m.prefix}aiagent status\`
` +
        `> \`${m.prefix}aiagent mode smart|always\`
` +
        `> \`${m.prefix}aiagent boredom on/off\`
` +
        `> \`${m.prefix}aiagent group/private on/off\`
` +
        `> \`${m.prefix}aiagent clearsession\``,
    );
  }

  try {
    switch (sub) {
      case "on":
      case "enable":
      case "aktif": {
        setAiAgentEnabled(true);
        await m.react("✅");
        return m.reply(
          `✅ *lyniX's AI Agent AKTIF*\n\n` +
            `> Aku siap nemenin chat, bantu cari sesuatu, dan kadang ngechat kalau gabut.\n` +
            `> Mode default: *smart*\n` +
            `> Cek detail: \`${m.prefix}aiagent status\``,
        );
      }

      case "off":
      case "disable":
      case "nonaktif": {
        setAiAgentEnabled(false);
        await m.react("✅");
        return m.reply(
          `❌ *lyniX's AI Agent NONAKTIF*\n\n` +
            `> Agent dimatikan. Nyalain lagi pakai \`${m.prefix}aiagent on\`.`,
        );
      }

      case "status":
      case "info": {
        const s = getAiAgentStatus();
        return m.reply(formatStatus(s));
      }

      case "mode": {
        const mode = (args[1] || "").toLowerCase();
        if (!["smart", "always"].includes(mode)) {
          return m.reply(
            `⚠️ Mode tidak valid.\n\n> Pilih: \`smart\` atau \`always\`\n> Contoh: \`${m.prefix}aiagent mode smart\``,
          );
        }
        configureAiAgent({ mode });
        await m.react("✅");
        return m.reply(`✅ Mode agent diubah ke *${mode}*`);
      }

      case "boredom":
      case "gabut": {
        const v = (args[1] || "").toLowerCase();
        if (!["on", "off"].includes(v)) {
          return m.reply(
            `> \`${m.prefix}aiagent boredom on\` / \`off\``,
          );
        }
        configureAiAgent({ boredomChat: v === "on" });
        await m.react("✅");
        return m.reply(
          `✅ Boredom chat ${v === "on" ? "diaktifkan" : "dimatikan"}`,
        );
      }

      case "group":
      case "grup": {
        const v = (args[1] || "").toLowerCase();
        if (!["on", "off"].includes(v)) {
          return m.reply(`> \`${m.prefix}aiagent group on\` / \`off\``);
        }
        configureAiAgent({ allowGroup: v === "on" });
        await m.react("✅");
        return m.reply(
          `✅ Agent di grup ${v === "on" ? "diizinkan" : "dimatikan"}`,
        );
      }

      case "private":
      case "pc": {
        const v = (args[1] || "").toLowerCase();
        if (!["on", "off"].includes(v)) {
          return m.reply(`> \`${m.prefix}aiagent private on\` / \`off\``);
        }
        configureAiAgent({ allowPrivate: v === "on" });
        await m.react("✅");
        return m.reply(
          `✅ Agent di private ${v === "on" ? "diizinkan" : "dimatikan"}`,
        );
      }

            case "nimbrung": {
        const v = (args[1] || "").toLowerCase();
        if (!["on", "off"].includes(v)) {
          return m.reply(
            `> \`${m.prefix}aiagent nimbrung on\` / \`off\`

` +
              `> ON = agent boleh nyaut tanpa dipanggil (pertanyaan / lanjut obrolan)
` +
              `> OFF = harus panggil *ai* / nama custom / mention

` +
              `> *Syarat:* AI Agent harus aktif dulu (\`${m.prefix}aiagent on\`)`,
          );
        }
        const st = getAiAgentStatus();
        if (v === "on" && !st?.enabled) {
          await m.react("⚠️");
          return m.reply(
            `⚠️ *AI Agent belum aktif*

` +
              `Nimbrung butuh agent hidup dulu.

` +
              `1. \`${m.prefix}aiagent on\`
` +
              `2. \`${m.prefix}aiagent nimbrung on\`

` +
              `Status sekarang:
` +
              `> Agent: ❌ OFF
` +
              `> Nimbrung: ${st?.nimbrung !== false ? "✅" : "❌"}`,
          );
        }
        configureAiAgent({ nimbrung: v === "on" });
        const after = getAiAgentStatus();
        await m.react("✅");
        return m.reply(
          `✅ *Nimbrung ${v === "on" ? "ON" : "OFF"}*

` +
            `> Agent: ${after?.enabled ? "✅ AKTIF" : "❌ OFF"}
` +
            `> Nimbrung: ${after?.nimbrung !== false ? "✅ ON" : "❌ OFF"}
` +
            `> Mode: *${after?.mode || "smart"}*

` +
            (v === "on"
              ? `Agent boleh ikut obrolan tanpa dipanggil (pertanyaan / lanjut chat).`
              : `Agent hanya nyaut kalau dipanggil *ai* / nama custom / mention.`),
        );
      }

      case "clearsession":
      case "resetsession":
      case "clear": {
        clearAiAgentSessions();
        await m.react("✅");
        return m.reply(`✅ Semua session chat lyniX's sudah dihapus.`);
      }

      default:
        return m.reply(
          `⚠️ Subcommand tidak dikenal.\n> Ketik \`${m.prefix}aiagent\` untuk bantuan.`,
        );
    }
  } catch (e) {
    console.error("[aiagent]", e);
    await m.react("☢");
    return m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };
