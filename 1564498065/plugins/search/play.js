import axios from "axios";
import { generateWAMessageFromContent } from "ichigo";
import ytSearch from "../../src/scraper/ytsearch-safe.js";
import { getAudioBuffer } from "../../src/scraper/audiofetch.js";

const pluginConfig = {
  name: "play",
  alias: ["playaudio", "vplay"],
  category: "search",
  description: "Putar musik dari YouTube dengan tampilan klasik interaktif",
  usage: ".play <query>",
  example: ".play komang",
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

const API_URL = "https://api-cloud.my.id/downloader/youtube";
const API_TIMEOUT = 45_000;
const MAX_SECONDS = 15 * 60; // lagu lebih dari 15 menit sering gagal dikonversi
const VIDEO_RESOLUTION = "480"; // resolusi default tombol AMBIL VIDEO

// Satu panggilan ke API. `source` kosong = urutan sumber bawaan API.
async function callApi(url, format, source) {
  const endpoint =
    `${API_URL}?url=${encodeURIComponent(url)}&format=${format}` +
    (source ? `&source=${source}` : "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);

  try {
    const res = await fetch(endpoint, { signal: ctrl.signal });
    const type = res.headers.get("content-type") || "";

    // Balasan bukan JSON (misal halaman HTML dari proxy) jangan dipaksa res.json()
    if (!type.includes("json")) {
      const err = new Error(`API HTTP ${res.status} (balasan bukan JSON)`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    if (!res.ok || !data?.status || !data?.download) {
      const err = new Error(data?.error || data?.message || `API HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    return {
      download: data.download,
      title: data.title,
      source: data.source,
      format: String(data.format || "mp3").toLowerCase(),
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("TIMEOUT");
      e.status = 408;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const AUDIO_MIME = { mp3: "audio/mpeg", m4a: "audio/mp4" };

async function handler(m, { sock }) {
  const query = m.text?.trim();
  if (!query) return m.reply(`🎵 *PLIKASI PLAY*\n\n> Contoh:\n\`${m.prefix}play komang\``);

  await m.react("⏳");

  let uiSent = false;

  try {
    const search = await ytSearch(query);
    if (!search?.videos?.length) throw new Error("Lagu tidak ditemukan di YouTube.");
    const video = search.videos[0];

    const seconds = video.seconds ?? video.duration?.seconds;
    if (seconds && seconds > MAX_SECONDS) {
      await m.react("⚠️");
      return m.reply("Durasi lagu terlalu panjang (maks 15 menit), coba cari yang lain ya.");
    }

    const prefix = m.prefix || ".";
    const durasi = video.duration?.timestamp || "-";

    const contentText = `Judul: ${video.title}`;

    let footerText = `╭─❍ *DETAIL MUSIK*\n`;
    footerText += `├ ⏱️ Durasi  : ${durasi}\n`;
    footerText += `├ 🎙️ Channel : ${video.author?.name || "-"}\n`;
    footerText += `├ 🔗 Sumber  : API Cloud\n`;
    footerText += `╰─❍ Audio sedang diproses, tunggu sebentar ya...\n`;
    footerText += `📥 Tekan tombol di bawah buat ambil versi video`;

    let imgBuffer;
    try {
      const hdThumbUrl = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      const compressedUrl = `https://wsrv.nl/?url=${encodeURIComponent(hdThumbUrl)}&w=300&output=jpeg&q=60`;

      const resImg = await axios.get(compressedUrl, { responseType: "arraybuffer", timeout: 15000 });
      imgBuffer = Buffer.from(resImg.data);
    } catch (e) {
      try {
        const safeUrl = `https://i.ytimg.com/vi/${video.videoId}/default.jpg`;
        const fallbackImg = await axios.get(safeUrl, { responseType: "arraybuffer", timeout: 10000 });
        imgBuffer = Buffer.from(fallbackImg.data);
      } catch (err) {
        imgBuffer = Buffer.from("ffd8ffe000104a46494600010101004800480000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103011100021101031101ffc4001500010100000000000000000000000000000008ffc40014100100000000000000000000000000000000ffc4001501010100000000000000000000000000000009ffc40014110100000000000000000000000000000000ffda000c03010002110311003f00f0fc00fffd9", "hex");
      }
    }

    const content = {
      buttonsMessage: {
        buttons: [
          {
            // Tombol menjalankan plugin ytmp4, yang memakai API api-cloud (SaveTube dulu)
            buttonId: `${prefix}ytmp4 ${video.url} ${VIDEO_RESOLUTION}`,
            buttonText: { displayText: "AMBIL VIDEO" },
            type: 1,
          },
        ],
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          jpegThumbnail: imgBuffer,
          name: `— 「 You tube play  」 —`,
          address: ` durasi  ${durasi}`,
        },
        contentText: contentText,
        footerText: footerText,
        headerType: 6,
        contextInfo: {
          mentionedJid: [m.sender],
          externalAdReply: null,
        },
      },
    };

    const msg = generateWAMessageFromContent(m.chat, content, {
      userJid: sock.user.id || sock.user.jid,
      quoted: m,
    });

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    uiSent = true;

    let result;
    try {
      result = await getAudioBuffer(video.url);
    } catch (apiErr) {
      console.error("[Play API Error]", apiErr);
      await m.react("⏰");
      return m.reply(
        "⏰ Server lagi lemot atau gagal saat ambil audio.\n" +
          "Kartu di atas tetap bisa dipakai buat ambil versi video, atau coba `.play` lagi beberapa saat lagi."
      );
    }

    try {
      await sock.sendMessage(
        m.chat,
        {
          audio: result.buffer,
          mimetype: AUDIO_MIME[result.format] || "audio/mpeg",
          ptt: false,
          fileName: `${result.title || video.title}.${result.format === "m4a" ? "m4a" : "mp3"}`,
        },
        { quoted: m }
      );
    } catch (audioErr) {
      console.error("[Play Audio Send Error]", audioErr);
      await m.react("❌");
      return m.reply("⚠️ Kartu berhasil dikirim, tapi bot gagal mengirim audionya. Coba lagi ya.");
    }

    await m.react("✅");
  } catch (err) {
    console.error("[Play Error]", err);
    await m.react("😭");
    // Pesan teknis cukup di log, user dikasih pesan umum
    const pesan =
      err?.message === "Lagu tidak ditemukan di YouTube."
        ? err.message
        : uiSent
          ? "ada kendala setelah kartu terkirim."
          : "fitur pemutar musik sedang mengalami kendala.";
    m.reply(`Mohon maaf Kak, ${pesan}`);
  }
}

export { pluginConfig as config, handler };