import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const run = promisify(exec);

const pluginConfig = {
  name: "splaych",
  alias: ["spch", "spotifysaluran", "spoplaych"],
  category: "search",
  description: "Putar lagu Spotify ke saluran (convert opus)",
  usage: ".splaych <judul lagu>",
  example: ".splaych shut it down",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const sc = s % 60;
  return `${m}:${sc.toString().padStart(2, "0")}`;
}

async function spoplay(query) {
  const { data } = await axios.get(
    "https://api.azbry.com/api/download/spoplay",
    { params: { q: query }, timeout: 20000 },
  );
  if (!data?.status || !data?.result) throw new Error(data?.message || "API gagal.");
  return data.result;
}

async function toOggOpus(mp3Buf) {
  const tmp = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  const id = crypto.randomBytes(6).toString("hex");
  const inp = path.join(tmp, `in_${id}.mp3`);
  const out = path.join(tmp, `out_${id}.ogg`);
  fs.writeFileSync(inp, mp3Buf);
  await run(
    `ffmpeg -y -i "${inp}" -vn -map_metadata -1 -ac 1 -ar 48000 -c:a libopus -b:a 96k -vbr on -application audio -f ogg "${out}"`,
  );
  const buf = fs.readFileSync(out);
  try { fs.unlinkSync(inp); } catch {}
  try { fs.unlinkSync(out); } catch {}
  return buf;
}

async function handler(m, { sock }) {
  const raw = m.text?.trim() || "";
  let chId = config?.saluran?.id;
  let chName = config?.saluran?.name || config?.bot?.name || "lyniX's MD";
  let q = raw;

  const idchMatch = raw.match(/--idch\s+(\S+)/);
  if (idchMatch) {
    chId = idchMatch[1];
    chName = chId;
    q = raw.replace(/--idch\s+\S+/, "").trim();
  }

  if (!q)
    return m.reply(
      `╭─ 🎵 *SPOTIFY PLAY SALURAN*\n` +
      `│·Query: \`${m.prefix}splaych <judul lagu>\`\n` +
      `│·Custom: \`${m.prefix}splaych --idch <id> <judul>\`\n` +
      `╰───────────────────────────`,
    );

  if (!chId)
    return m.reply(`❌ Saluran belum diatur. Gunakan \`--idch <id>\` atau atur di config.js`);

  await m.react("🔎");

  try {
    const result = await spoplay(q);

    const caption =
      `╭─ 🎵 *NOW PLAYING*\n` +
      `│·Judul: ${result.title}\n` +
      `│·Artist: ${result.artist}\n` +
      `│·Album: ${result.album}\n` +
      `│·Durasi: ${fmtDuration(result.duration)}\n` +
      `│·Saluran: ${chId}\n` +
      `╰───────────────────────────\n` +
      `_⏳ Mengirim audio ke saluran..._`;

    await sock.sendMessage(
      m.chat,
      { image: { url: result.cover }, caption },
      { quoted: m },
    );

    await m.react("🎵");

    const mp3Buf = Buffer.from(
      (await axios.get(result.downloadLink, {
        responseType: "arraybuffer",
        timeout: 60000,
      })).data,
    );

    if (mp3Buf.length < 50000) throw new Error("Audio terlalu kecil");

    const opusBuf = await toOggOpus(mp3Buf);
    if (opusBuf.length < 10000) throw new Error("Konversi opus gagal");

    await sock.sendMessage(chId, {
      audio: opusBuf,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      contextInfo: {
        ...saluranCtx(),
        forwardedNewsletterMessageInfo: {
          newsletterJid: chId,
          serverMessageId: 100,
          newsletterName: chName,
        },
      },
    });

    await m.react("✅");
    m.reply(`✅ *${result.title}* berhasil dikirim ke saluran`);

  } catch (e) {
    console.error("[splaych]", e.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };