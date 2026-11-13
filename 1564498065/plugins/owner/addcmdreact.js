import { getPlugin } from "../../src/lib/ichigo-plugins.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "addcmdreact",
  alias: ["delcmdreact", "listcmdreact", "cmdreact"],
  category: "owner",
  description: "Jadikan reaksi emoji sebagai pemicu command",
  usage: ".addcmdreact <emoji> <command> [argumen]",
  example: ".addcmdreact 😁 menu",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 2,
  energi: 0,
  isEnabled: true,
};

const norm = (e) => String(e || "").replace(/\uFE0F/g, "").trim();
const isEmoji = (s) => /\p{Extended_Pictographic}/u.test(s) && !/[a-z0-9]/i.test(s);

async function handler(m, { text }) {
  const db = getDatabase();
  const map = db.setting("cmdReact") || {};
  const p = m.prefix;
  const mode = String(m.command || "").toLowerCase();
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);

  if (mode === "listcmdreact" || (mode === "cmdreact" && parts[0] === "list")) {
    const rows = Object.entries(map);
    if (!rows.length) return m.reply(`Belum ada reaksi yang diatur.\nTambah: ${p}addcmdreact 😁 menu`);
    return m.reply(`*Reaksi command*\n\n${rows.map(([e, v]) => `${e}  ${p}${v.command}${v.args ? " " + v.args : ""}`).join("\n")}`);
  }

  if (mode === "delcmdreact" || (mode === "cmdreact" && parts[0] === "del")) {
    const emoji = norm(mode === "cmdreact" ? parts[1] : parts[0]);
    if (!emoji) return m.reply(`Contoh: ${p}delcmdreact 😁`);
    if (!map[emoji]) return m.reply("Emoji itu belum diatur.");
    delete map[emoji];
    db.setting("cmdReact", map);
    return m.reply(`Reaksi ${emoji} sudah dihapus.`);
  }

  const [rawEmoji, cmdName, ...rest] = parts;
  if (!rawEmoji || !cmdName) {
    return m.reply(
      `*Reaksi command*\n\n` +
        `${p}addcmdreact 😁 menu\n` +
        `${p}addcmdreact 🎥 tiktokdl\n` +
        `${p}addcmdreact 🌐 tr id {text}\n` +
        `${p}addcmdreact 🤔 rvo {reply}\n` +
        `${p}addcmdreact 👀 rvo {quoted}\n\n` +
        `${p}delcmdreact 😁\n` +
        `${p}listcmdreact\n\n` +
        `Reaksi ke pesan apa pun dengan emoji itu akan menjalankan command-nya. ` +
        `Token:\n` +
        `{reply}  pesan yang direaksi dibaca sebagai reply (ini sudah bawaan)\n` +
        `{quoted}  pesan yang di-reply oleh pesan yang direaksi dipakai sebagai reply\n` +
        `{text}  isi pesan yang direaksi disisipkan sebagai argumen\n` +
        `Kalau isi pesan berupa link, link-nya otomatis ikut dikirim.`,
    );
  }

  const emoji = norm(rawEmoji);
  if (!isEmoji(emoji)) return m.reply("Yang pertama harus emoji ya.");
  const name = cmdName.replace(/^[^\w]+/, "").toLowerCase();
  const plugin = getPlugin(name);
  if (!plugin) return m.reply(`Command ${p}${name} tidak ditemukan.`);

  map[emoji] = { command: [].concat(plugin.config.name)[0], args: rest.join(" ") };
  db.setting("cmdReact", map);
  return m.reply(`Siap. Reaksi ${emoji} sekarang menjalankan ${p}${map[emoji].command}${map[emoji].args ? " " + map[emoji].args : ""}.`);
}

export { pluginConfig as config, handler };