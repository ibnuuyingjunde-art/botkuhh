/**
 * Nama Plugin: Musik Apa Ini
 * Pembuat Code: Zann
 * Saluran: https://whatsapp.com/channel/0029Vb7g5Qt90x2yn7bOlM2U
 */

import axios from "axios";
import FormData from "form-data";
import config from "../../config.js";
import { downloadMediaMessage } from "ichigo";
import te from "../../src/lib/ichigo-error.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";

const pluginConfig = {
  name: "musikapaini",
  alias: ["whatmusic", "shazam", "recognizemusic", "mai"],
  category: "tools",
  description: "Identifikasi lagu dari audio",
  usage: ".musikapaini (reply audio)",
  example: ".musikapaini",
  cooldown: 20,
  energi: 2,
  isEnabled: true,
};

async function uploadAudio(buffer, filename) {
  const form = new FormData();
  form.append("file", buffer, {
    filename,
    contentType: "application/octet-stream",
  });

  const res = await axios.post(
    "https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk",
    form,
    { headers: form.getHeaders(), timeout: 30000 }
  );

  const path = res.data?.path;
  if (!res.data?.status || !path) throw new Error("Upload gagal: " + JSON.stringify(res.data));

  return path.startsWith("http") ? path : `https://c.termai.cc${path}`;
}

async function recognizeMusic(audioUrl) {
  
  try {
    const form = new FormData();
    form.append("url", audioUrl);
    form.append("return", "spotify,deezer,apple_music");
    form.append("api_token", config.APIkey?.audd || "test");

    const { data } = await axios.post("https://api.audd.io/", form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    console.log("[musikapaini] audd response:", JSON.stringify(data));

    if (data?.status === "success" && data?.result) {
      const r = data.result;
      return {
        title: r.title,
        artist: r.artist,
        album: r.album,
        release: r.release_date,
        label: r.label,
        timecode: r.timecode,
        song_link: r.song_link,
        links: {
          spotify: {
            id: r.spotify?.id || r.spotify?.external_urls?.spotify || null,
            url: r.spotify?.external_urls?.spotify || null,
          },
          deezer: {
            id: r.deezer?.id || null,
          },
          apple_music: {
            url: r.apple_music?.url || null,
          },
        },
      };
    }

    if (data?.status === "success" && !data?.result) return null;

    console.log("[musikapaini] audd error:", data?.error);
  } catch (e) {
    console.log("[musikapaini] audd gagal:", e.message);
  }

  return null;
}

async function handler(m, { sock }) {
  let audioBuffer = null;
  let filename = "audio.mp3";

  if (m.quoted?.message) {
    const quotedMsg = m.quoted.message;
    const audioMsg = quotedMsg.audioMessage || quotedMsg.documentMessage;
    if (audioMsg) {
      try {
        audioBuffer = await downloadMediaMessage(
          { key: m.quoted.key, message: quotedMsg },
          "buffer",
          {}
        );
        filename = audioMsg.fileName || "audio.mp3";
      } catch (e) {
        console.log("[musikapaini] download quoted gagal:", e.message);
      }
    }
  }

  if (!audioBuffer && m.message) {
    const audioMsg = m.message.audioMessage || m.message.documentMessage;
    if (audioMsg) {
      try {
        audioBuffer = await m.download();
        filename = audioMsg.fileName || "audio.mp3";
      } catch (e) {
        console.log("[musikapaini] download direct gagal:", e.message);
      }
    }
  }

  if (!audioBuffer) {
    return m.reply(
      `🎵 *ᴍᴜsɪᴋ ᴀᴘᴀ ɪɴɪ?*\n\n` +
      `> Identifikasi lagu dari audio\n\n` +
      `*Cara pakai:*\n` +
      `> Reply audio dengan \`${m.prefix}musikapaini\`\n` +
      `> Atau kirim audio + caption command`
    );
  }

  m.react("🎵");

  try {
    await m.reply("🕕 *ᴍᴇɴɢᴜᴘʟᴏᴀᴅ...*\n\n> Mengupload audio...");
    const audioUrl = await uploadAudio(audioBuffer, filename);
    console.log("[musikapaini] audio URL:", audioUrl);

    await m.reply("🔍 *ᴍᴇɴɢɪᴅᴇɴᴛɪꜰɪᴋᴀsɪ...*\n\n> Mencari info lagu...");
    const music = await recognizeMusic(audioUrl);

    if (!music) {
      m.react("❌");
      return m.reply(
        `❌ *ɢᴀɢᴀʟ*\n\n` +
        `> Lagu tidak dikenali.\n` +
        `> Pastikan audio mengandung musik yang cukup jelas (min. 5 detik).`
      );
    }

    const links = music.links || {};

    let text =
      `🎵 *ʟᴀɢᴜ ᴅɪᴛᴇᴍᴜᴋᴀɴ!*\n\n` +
      `╭─「 📋 *ɪɴꜰᴏ ʟᴀɢᴜ* 」\n` +
      `│·🎶 Judul   : ${music.title || "-"}\n` +
      `│·👤 Artist  : ${music.artist || "-"}\n` +
      `│·💿 Album   : ${music.album || "-"}\n` +
      `│·📅 Release : ${music.release || "-"}\n` +
      `│·🏷️ Label   : ${music.label || "-"}\n` +
      `│·⏱️ Timecode : ${music.timecode || "-"}\n` +
      `╰───────────────────────────`;

    if (music.song_link) {
      text += `\n\n🔗 *${music.song_link}*`;
    }

    const buttons = [];

    if (links.spotify?.url) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🎧 Spotify",
          url: links.spotify.url,
        }),
      });
    }

    if (links.apple_music?.url) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🍎 Apple Music",
          url: links.apple_music.url,
        }),
      });
    }

    if (links.deezer?.id) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🎵 Deezer",
          url: `https://deezer.com/track/${links.deezer.id}`,
        }),
      });
    }

    const msgContent = {
      text,
      footer: "🎵 Music Recognition • Ichigo Strife",
      contextInfo: saluranCtx(),
    };

    if (buttons.length > 0) {
      msgContent.interactiveButtons = buttons;
    }

    await sock.sendMessage(m.chat, msgContent, { quoted: m });
    m.react("✅");
  } catch (error) {
    console.error("[musikapaini]", error);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };