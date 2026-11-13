import axios from "axios";
import { ytSearch } from "../../src/scraper/ytsearch-safe.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import config from "../../config.js";
import ytdl2, { readResultBuffer } from "../../src/scraper/ytdl2.js";

const pluginConfig = {
  name: "playcall",
  alias: ["telepon", "call"],
  category: "search",
  description: "Putar musik dari YouTube lewat telpon",
  usage: ".playcall <query>",
  example: ".playcall komang",
  cooldown: 15,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock, text }) {
  const query = m.text?.trim();
  if (!query) return m.reply(`🎵 *ᴘʟᴀʏ ᴄᴀʟʟ*\n\n> Masukkan judul lagunya\n\`Contoh: ${m.prefix}playcall surat cinta untuk starla\``);

  if (!global.voipClient) {
    return m.reply("Fitur panggilan suara tidak diaktifkan (Modul VoIP belum terpasang).");
  }

  await m.react("📞");
  let tmpFile = null;

  try {
    const search = await ytSearch(query);
    if (!search.videos.length) throw new Error("Video tidak ditemukan");
    const video = search.videos[0];
    
    // Sumber: ytdl2 (scraper ytmp3.js). File cache dipakai langsung, jadi TIDAK boleh dihapus setelah panggilan.
        let audioFile = null;
    try {
      const r = await ytdl2(video.url, "mp3");
      if (!r?.status || !(r.file || r.download)) throw new Error(r?.mess || "ytdl2 gagal");
      if (r.file) {
        audioFile = r.file;
      } else {
        const buf = await readResultBuffer(r, { minBytes: 20_000 });
        const tmpDir = path.join(process.cwd(), "tmp");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        tmpFile = path.join(tmpDir, `call_${crypto.randomBytes(4).toString("hex")}.mp3`);
        fs.writeFileSync(tmpFile, buf);
        audioFile = tmpFile;
      }
    } catch (e) {
      console.error("[PlayCall] ytdl2 gagal:", e.message);
    }

    if (!audioFile) throw new Error("Gagal mengambil audio, coba lagi nanti");

    const targetNumber = m.sender.split("@")[0];
    await m.reply(`_📞 Memanggil nomormu (${targetNumber}) secara privat..._`);

    const call = await global.voipClient.call(targetNumber, {
      audioSource: audioFile,
      durationMs: 300000
    });

    call.on("connected", () => m.reply(`✅ *TERHUBUNG*\nLagu *${video.title}* sedang diputar!`));

    const cleanup = (reason) => {
      if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      m.reply(`📵 Panggilan diakhiri: ${reason}`);
    };

    call.on("ended", cleanup);
    call.on("error", (err) => {
      console.error("[VoIP Error]", err);
      cleanup(err.message);
    });

  } catch (err) {
    console.error("[PlayCall Error]", err);
    await m.react("😭");
    m.reply(`Gagal: ${err.message}`);
    
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

export { pluginConfig as config, handler };