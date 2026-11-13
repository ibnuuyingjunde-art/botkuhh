import fs from "fs";
import path from "path";
import { generateWAMessageContent } from "ichigo";
import sPR from "../../src/spr/sBprv2.js";
import { smartResolve } from "../../src/lib/ichigo-filefinder.js";

const pluginConfig = {
  name: "gf",
  alias: ["gf"],
  category: "owner",
  description:
    "Versi privat dari getfile. Di grup, isi file dikirim lewat sBPR v2 sehingga hanya terlihat oleh yang ditag (atau oleh kamu sendiri kalau tidak menag siapa pun). Cukup nama file saja.",
  usage: ".gf [@user] <nama_file / path> [doc]",
  example: ".gf config.js\n.gf @user sp2.js\n.gf plugins/owner/sp2.js doc",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

// Batas isi file untuk dikirim sebagai teks + tombol salin. Di atas ini dikirim sebagai dokumen.
const TEXT_LIMIT = 15 * 1024;

const TEXT_EXTS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".json", ".env", ".yml", ".yaml", ".md",
  ".html", ".css", ".txt", ".sh", ".sql", ".xml", ".log", ".csv",
]);

const BIZ_NODE = {
  tag: "biz",
  attrs: {},
  content: [
    {
      tag: "interactive",
      attrs: { type: "native_flow", v: "1" },
      content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
    },
  ],
};

function listDir(targetPath, relPath) {
  const items = fs
    .readdirSync(targetPath, { withFileTypes: true })
    .sort((a, b) =>
      a.isDirectory() !== b.isDirectory()
        ? a.isDirectory() ? -1 : 1
        : a.name.localeCompare(b.name)
    )
    .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
    .join("\n");
  return `🗂️ *Folder:* \`/${relPath || "."}\`\n\n${items || "_Folder ini kosong_"}`;
}

async function buildPayload(sock, { targetPath, relPath, forceDoc }) {
  const stat = fs.statSync(targetPath);
  const ext = path.extname(targetPath).toLowerCase();
  const fileName = path.basename(targetPath);
  const sizeKb = (stat.size / 1024).toFixed(2);
  const isText = TEXT_EXTS.has(ext);

  const info =
    `🏷️ *Nama:* ${fileName}\n` +
    `📍 *Path:* /${relPath}\n` +
    `⚖️ *Ukuran:* ${sizeKb} KB`;

  const asText = isText && !forceDoc && stat.size <= TEXT_LIMIT;

  if (asText) {
    const content = fs.readFileSync(targetPath, "utf-8");
    // Struktur mentah sama seperti sp2.js. generateWAMessageContent TIDAK mengubah
    // interactiveButtons jadi tombol (itu dikerjakan lapisan sendMessage), jadi
    // lewat sPR tombolnya harus dibangun manual.
    return {
      interactiveMessage: {
        header: { title: "", hasMediaAttachment: false },
        body: { text: `🔒 *File Privat*\n\n${info}` },
        footer: { text: "Tap tombol di bawah untuk menyalin isi file" },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "🥠 Copy Isi File",
                id: "copy_file_code",
                copy_code: content,
              }),
            },
          ],
        },
      },
    };
  }

  return generateWAMessageContent(
    {
      document: fs.readFileSync(targetPath),
      fileName,
      mimetype: "application/octet-stream",
      caption: `🔒 *File Privat*\n\n${info}`,
    },
    { upload: sock.waUploadToServer }
  );
}

async function handler(m, { sock, args, prefix, command }) {
  const conn = sock || m.conn;

  try {
    // target: reply > mention > diri sendiri
    const mentioned = m.quoted?.sender || m.mentionedJid?.[0] || null;
    const targetJid = mentioned || m.sender;

    const words = [...args].filter((a) => !a.startsWith("@"));
    let forceDoc = false;
    if (words[words.length - 1]?.toLowerCase() === "doc") {
      forceDoc = true;
      words.pop();
    }

    if (!words.length) {
      return m.reply(
        `🔒 *GF (Get File Privat)*\n\n` +
          `Format: \`${prefix}${command} [@user] <nama_file> [doc]\`\n\n` +
          `*Contoh:*\n` +
          `> ${prefix}${command} config.js\n` +
          `> ${prefix}${command} @user sp2.js\n` +
          `> ${prefix}${command} plugins/owner/sp2.js doc\n\n` +
          `_Di grup: hanya yang ditag (atau kamu sendiri) yang bisa melihat isinya._`
      );
    }

    const rawInput = words.join(" ").replace(/^[/\\]+/, "");
    const resolved = smartResolve(rawInput);

    if (resolved.status === "invalid") {
      return m.reply("🚫 Akses ditolak! Path di luar direktori bot.");
    }
    if (resolved.status === "notfound") {
      return m.reply(`❓ File atau folder tidak ditemukan:\n\`${rawInput}\``);
    }
    if (resolved.status === "ambiguous") {
      const list = resolved.matches.map((p, i) => `${i + 1}. \`${p}\``).join("\n");
      return m.reply(
        `🔎 Ada ${resolved.matches.length} file bernama *"${rawInput}"*, ketik path lengkapnya:\n\n${list}`
      );
    }

    const { path: targetPath, relPath } = resolved;
    const stat = fs.statSync(targetPath);

    if (stat.isDirectory()) {
      return m.reply(listDir(targetPath, relPath));
    }

    await m.react("⏳");

    const proto = await buildPayload(conn, { targetPath, relPath, forceDoc });

    if (m.isGroup) {
      // sBPR v2: mode "include" -> hanya JID di `target` yang bisa mendekripsi
      await sPR(conn, m.chat, proto, {
        mode: "include",
        target: [targetJid],
        additionalNodes: [BIZ_NODE],
        useCachedGroupMetadata: true,
      });
    } else {
      // Chat pribadi sudah privat, kirim biasa
      await conn.relayMessage(m.chat, proto, {});
    }

    await m.react("✅");
  } catch (err) {
    console.error("[gf] Error:", err);
    await m.react("❌");
    m.reply(`❌ Gagal mengambil file.\n\n*Error:* ${err.message}`);
  }
}

export { pluginConfig as config, handler };