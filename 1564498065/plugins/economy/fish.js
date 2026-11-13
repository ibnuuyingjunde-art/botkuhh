const pluginConfig = {
  name: "fish",
  alias: ["mancing", "fishing", "pancing"],
  category: "economy",
  description: "Mancing untuk mendapatkan ikan dan koin",
  usage: ".fish",
  example: ".fish",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 5,
  isEnabled: true,
};

const IKAN = [
  
  { nama: "Ikan Lele", emoji: "🐟", rarity: "common", koin: [10, 30], exp: [5, 15], chance: 30 },
  { nama: "Ikan Mas", emoji: "🐠", rarity: "common", koin: [15, 35], exp: [8, 18], chance: 25 },
  { nama: "Ikan Nila", emoji: "🐡", rarity: "common", koin: [12, 32], exp: [6, 16], chance: 20 },
  
  { nama: "Ikan Gurame", emoji: "🦈", rarity: "uncommon", koin: [40, 80], exp: [20, 40], chance: 10 },
  { nama: "Ikan Bawal", emoji: "🐬", rarity: "uncommon", koin: [50, 90], exp: [25, 45], chance: 7 },
  
  { nama: "Ikan Kakap", emoji: "🦭", rarity: "rare", koin: [100, 200], exp: [50, 100], chance: 4 },
  { nama: "Ikan Tuna", emoji: "🐋", rarity: "rare", koin: [150, 250], exp: [75, 125], chance: 2 },
  
  { nama: "Ikan Arwana", emoji: "🐉", rarity: "legendary", koin: [500, 1000], exp: [200, 400], chance: 1 },
  { nama: "Ikan Dewa", emoji: "✨", rarity: "legendary", koin: [1000, 2000], exp: [500, 800], chance: 0.5 },
];

const SAMPAH = [
  { nama: "Botol Plastik", emoji: "🍶" },
  { nama: "Sandal Jepit", emoji: "🩴" },
  { nama: "Kaleng Bekas", emoji: "🥫" },
  { nama: "Tas Kresek", emoji: "🛍️" },
  { nama: "Ban Bekas", emoji: "⭕" },
];

const RARITY_COLOR = {
  common: "⬜",
  uncommon: "🟩",
  rare: "🟦",
  legendary: "🟨",
};

const RARITY_LABEL = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

const FISHING_MESSAGES = [
  "🎣 Kamu melempar kail ke sungai...",
  "🎣 Kamu mencari spot mancing yang bagus...",
  "🎣 Kail kamu dilempar ke tengah danau...",
  "🎣 Kamu duduk santai sambil nunggu ikan...",
  "🎣 Kamu melempar umpan ke laut...",
];

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getResult() {
  const roll = Math.random() * 100;

  if (roll < 15) {
    return { type: "sampah", item: SAMPAH[Math.floor(Math.random() * SAMPAH.length)] };
  }

  if (roll < 20) {
    return { type: "kosong" };
  }

  const fishRoll = Math.random() * 100;
  let cumulative = 0;

  for (const ikan of IKAN) {
    cumulative += ikan.chance;
    if (fishRoll <= cumulative) {
      return { type: "ikan", item: ikan };
    }
  }

  return { type: "ikan", item: IKAN[0] };
}

async function handler(m, { sock, db }) {
  try {
    const user = db.getUser(m.sender) || {};

    if (!user.inventory) user.inventory = {};
    if (!user.fishStats) user.fishStats = { total: 0, legendary: 0, sampah: 0 };

    const fishingMsg = FISHING_MESSAGES[Math.floor(Math.random() * FISHING_MESSAGES.length)];
    await m.reply(fishingMsg);

    await new Promise(r => setTimeout(r, 2000));

    const result = getResult();

    if (result.type === "kosong") {
      user.fishStats.total = (user.fishStats.total || 0) + 1;
      db.setUser(m.sender, user);

      return await sock.sendMessage(m.chat, {
        text: `😔 *Tidak Ada Yang Menyantap Umpanmu*\n\n> Ikannya kabur! Coba lagi nanti.`,
      }, { quoted: m });
    }

    if (result.type === "sampah") {
      user.fishStats.total = (user.fishStats.total || 0) + 1;
      user.fishStats.sampah = (user.fishStats.sampah || 0) + 1;

      const koinSampah = random(1, 5);
      user.koin = (user.koin || 0) + koinSampah;
      db.setUser(m.sender, user);

      return await sock.sendMessage(m.chat, {
        text: `🗑️ *Dapat Sampah!*\n\n│ ${result.item.emoji} *${result.item.nama}*\n│ 💰 Dijual: *+${koinSampah} koin*\n\n> Yah, lumayan daripada nggak dapat apa-apa 😅`,
      }, { quoted: m });
    }

    const ikan = result.item;
    const koin = random(ikan.koin[0], ikan.koin[1]);
    const exp = random(ikan.exp[0], ikan.exp[1]);

    user.koin = (user.koin || 0) + koin;
    user.exp = (user.exp || 0) + exp;
    user.fishStats.total = (user.fishStats.total || 0) + 1;
    if (ikan.rarity === "legendary") {
      user.fishStats.legendary = (user.fishStats.legendary || 0) + 1;
    }

    const invKey = ikan.nama;
    user.inventory[invKey] = (user.inventory[invKey] || 0) + 1;

    db.setUser(m.sender, user);

    const rarityColor = RARITY_COLOR[ikan.rarity];
    const rarityLabel = RARITY_LABEL[ikan.rarity];

    let text = `${ikan.emoji} *DAPAT IKAN!*\n\n`;
    text += `╭─〔 🎣 *Hasil Mancing* 〕\n`;
    text += `│ 🐟 Ikan    : *${ikan.nama}*\n`;
    text += `│ ${rarityColor} Rarity  : *${rarityLabel}*\n`;
    text += `│ 💰 Koin    : *+${koin}*\n`;
    text += `│ ✨ EXP     : *+${exp}*\n`;
    text += `╰────────────────⬣\n\n`;
    text += `╭─〔 📊 *Statistik* 〕\n`;
    text += `│ 💰 Total Koin  : *${user.koin.toLocaleString()}*\n`;
    text += `│ 🎣 Total Mancing: *${user.fishStats.total}x*\n`;
    text += `│ 🌟 Legendary   : *${user.fishStats.legendary}x*\n`;
    text += `╰────────────────⬣`;

    if (ikan.rarity === "legendary") {
      text = `🎉 *LEGENDARY FISH!* 🎉\n\n` + text;
    }

    await sock.sendMessage(m.chat, { text }, { quoted: m });

  } catch (error) {
    console.error("[fish] Error:", error.message);
    await m.reply("❌ Gagal mancing. Coba lagi!\n> " + error.message);
  }
}

export default {
  config: pluginConfig,
  handler,
};