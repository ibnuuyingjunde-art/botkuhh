const pluginConfig = {
  name: "kudetakick",
  alias: [],
  category: "group",
  description: "Mengeluarkan semua member biasa (non-admin) dari dalam grup secara massal",
  usage: ".kudetakick",
  example: ".kudetakick",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: false,
  isBotAdmin: true,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock, prefix, command }) {
  const conn = sock || m.conn;

  const owners = ['6281524385851']; 
  const sender = m.sender.split('@')[0];

  if (!owners.includes(sender)) {
    return m.reply('_*Hanya owner yang bisa pakai*_');
  }

  let group = await conn.groupMetadata(m.chat);
  let participants = group.participants;
  
  let members = participants
    .filter(p => p.admin === null)
    .map(p => p.id);

  if (!members.length) {
    return m.reply('Tidak ada member biasa yang bisa dikick.');
  }

  await m.reply(`Pembersihan dimulai...\nMember: ${members.length}`);
  await m.react("⏳");

  try {
    await conn.groupParticipantsUpdate(m.chat, members, "remove");
  } catch (e) {
    for (let user of members) {
      try {
        await conn.groupParticipantsUpdate(m.chat, [user], "remove");
        await new Promise(r => setTimeout(r, 1200));
      } catch {}
    }
  }

  await m.react("✅");
  return m.reply('_*SUCCESS*_');
}

export { pluginConfig as config, handler };