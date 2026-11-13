export const config = {
  name: "stalkig",
  alias: ["igstalk", "iginfo", "profilig"],
  category: "tools",
  description: "Stalk info profil Instagram",
  usage: ".stalkig <username>",
  example: ".stalkig cristiano",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatNum(n) {
  if (!n && n !== 0) return "?";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

const FRAMES = [
  "🔍 *sᴛᴀʟᴋ ɪɢ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Menghubungi Instagram...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *sᴛᴀʟᴋ ɪɢ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Mengambil data profil...\n╰┈┈┈┈┈┈┈┈⬡",
  "🔍 *sᴛᴀʟᴋ ɪɢ...*\n\n╭┈┈⬡「 📡 *sᴛᴀᴛᴜs* 」\n┃ ⏳ Memuat foto profil...\n╰┈┈┈┈┈┈┈┈⬡",
];

async function fetchIGProfile(username) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.instagram.com/",
    "x-ig-app-id": "936619743392459",
  };

  try {
    const r = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers: { ...headers, "User-Agent": "Instagram 76.0.0.15.395 Android" } }
    );
    if (r.ok) {
      const json = await r.json();
      const user = json?.data?.user;
      if (user?.id) return user;
    }
  } catch {}

  try {
    const r = await fetch(
      `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`,
      { headers }
    );
    if (r.ok) {
      const json = await r.json();
      const user = json?.graphql?.user || json?.data?.user;
      if (user?.id) return user;
    }
  } catch {}

  try {
    const r = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers }
    );
    if (r.ok) {
      const json = await r.json();
      const user = json?.data?.user;
      if (user?.id) return user;
    }
  } catch {}

  return null;
}

export async function handler(m, { sock }) {
  const username = m.text?.trim().split(/\s+/)[0]?.replace(/^@/, "");

  if (!username) {
    return m.reply(
      `⚠️ *ᴍᴀsᴜᴋᴋᴀɴ ᴜsᴇʀɴᴀᴍᴇ*\n\n` +
      `> \`${m.prefix}stalkig <username>\`\n\n` +
      `*ᴄᴏɴᴛᴏʜ:*\n` +
      `> \`${m.prefix}stalkig cristiano\`\n` +
      `> \`${m.prefix}stalkig @natgeo\``
    );
  }

  let sent;
  try {
    sent = await sock.sendMessage(m.chat, { text: FRAMES[0] }, { quoted: m });
  } catch {
    return m.reply("❌ Gagal mengirim pesan.");
  }

  const [data] = await Promise.all([
    fetchIGProfile(username),
    (async () => {
      for (let i = 1; i < FRAMES.length; i++) {
        await sleep(800);
        try {
          await sock.sendMessage(m.chat, { text: FRAMES[i], edit: sent.key });
        } catch { break; }
      }
    })(),
  ]);

  await sleep(300);

  if (!data) {
    const errText =
      `❌ *ᴘʀᴏꜰɪʟ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
      `╭┈┈⬡「 ⚠️ *ɪɴꜰᴏ* 」\n` +
      `┃ Username \`${username}\` tidak ditemukan.\n` +
      `┃ Kemungkinan penyebab:\n` +
      `┃ • Username salah / typo\n` +
      `┃ • Akun dihapus/dinonaktifkan\n` +
      `┃ • Instagram sedang rate limit\n` +
      `╰┈┈┈┈┈┈┈┈⬡`;
    try {
      await sock.sendMessage(m.chat, { text: errText, edit: sent.key });
    } catch {
      await m.reply(errText);
    }
    return;
  }

  const name       = data.full_name || "-";
  const bio        = data.biography?.trim() || "-";
  const followers  = formatNum(data.edge_followed_by?.count);
  const following  = formatNum(data.edge_follow?.count);
  const posts      = formatNum(data.edge_owner_to_timeline_media?.count);
  const isPrivate  = data.is_private ? "🔒 Privat" : "🌐 Publik";
  const isVerified = data.is_verified ? "✅ Ya" : "—";
  const picUrl     = data.profile_pic_url_hd || data.profile_pic_url || null;
  const igLink     = `https://instagram.com/${username}`;

  const caption =
    `📸 *ɪɴꜰᴏ ᴘʀᴏꜰɪʟ ɪɢ*\n\n` +
    `╭┈┈⬡「 👤 *${username}* 」\n` +
    `┃ 📛 Nama      : ${name}\n` +
    `┃ 📝 Bio       : ${bio}\n` +
    `┃ 👥 Followers : *${followers}*\n` +
    `┃ 👤 Following : *${following}*\n` +
    `┃ 🖼️ Posts     : *${posts}*\n` +
    `┃ 🔐 Akun      : ${isPrivate}\n` +
    `┃ ✔️ Verified  : ${isVerified}\n` +
    `┃ 🔗 Link      : ${igLink}\n` +
    `╰┈┈┈┈┈┈┈┈⬡`;

  try {
    if (picUrl) {
      
      const imgBuffer = await fetch(picUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      }).then(r => r.arrayBuffer()).then(ab => Buffer.from(ab)).catch(() => null);

      await sock.sendMessage(m.chat, { delete: sent.key });
      await sleep(300);

      if (imgBuffer) {
        await sock.sendMessage(
          m.chat,
          { image: imgBuffer, caption },
          { quoted: m }
        );
      } else {
        
        await sock.sendMessage(m.chat, { text: caption }, { quoted: m });
      }
    } else {
      await sock.sendMessage(m.chat, { text: caption, edit: sent.key });
    }
  } catch {
    await m.reply(caption);
  }
}

export default { config, handler };