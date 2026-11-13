import * as baileys from "ichigo";
import util from "util";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";
import config from "../../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);

const pluginConfig = {
  name: "exec",
  // "eval" dan "=>" dipakai plugin eval.js (nama/alias sama bikin bentrok), jadi tidak diulang di sini
  alias: ["js", ">"],
  category: "owner",
  description: "Menjalankan kode JavaScript secara langsung (eval)",
  usage: ".exec <kode> | .> <kode> | .=> <ekspresi>",
  example: ".exec 2 + 2 | .=> m.chat",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function inspectOutput(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (Buffer.isBuffer(value)) return `<Buffer ${value.length} bytes>`;
  if (typeof value === "string") return value;
  return util.inspect(value, {
    depth: null,
    showHidden: false,
    colors: false,
    maxArrayLength: null,
    maxStringLength: null,
  });
}

async function handler(m, context) {
  const { sock, conn, client, text, command, prefix, db, plugins } = context;
  const bot = sock;

  // Enforcement owner beneran ada di sini, bukan di pluginConfig.isOwner
  // (itu cuma metadata buat menu). Sama kayak pola di resetdb.js.
  if (!config.isOwner(m.sender)) {
    return m.reply("❎ Command ini cuma buat owner.");
  }

  if (!text) {
    return m.reply(`Contoh: \`${prefix}${command} 2 + 2\``);
  }

  // "=>" auto-wrap jadi expression return, ">" / "eval" / "js" jalanin apa adanya
  const isReturn = command === "=>";
  const codeText = (isReturn ? "return " : "") + text;

  let groupMetadata = null;
  let participants = [];
  if (m.isGroup) {
    groupMetadata = await sock.groupMetadata(m.chat).catch(() => null);
    participants = groupMetadata?.participants || [];
  }

  let _return;

  try {
    const f = { exports: {} };
    const exec = new (async () => {}).constructor(
      "print",
      "m",
      "require",
      "conn",
      "sock",
      "client",
      "bot",
      "baileys",
      "groupMetadata",
      "participants",
      "jid",
      "userJid",
      "db",
      "plugins",
      "module",
      "exports",
      "argument",
      codeText,
    );

    _return = await exec.call(
      sock,
      (...args) => {
        console.log(...args);
        const out = args.length === 1 ? inspectOutput(args[0]) : util.format(...args);
        return m.reply(out);
      },
      m,
      require,
      conn,
      sock,
      client,
      bot,
      baileys,
      groupMetadata,
      participants,
      m.chat,
      m.sender,
      db,
      plugins,
      f,
      f.exports,
      [sock, context],
    );
  } catch (e) {
    _return = e;
  } finally {
    const output = String(inspectOutput(_return) ?? "undefined");
    await m.reply(output);
  }
}

export { pluginConfig as config, handler };