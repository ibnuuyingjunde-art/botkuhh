import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "lelang",
  alias: ["auction", "ah", "market", "balailelang"],
  category: "rpg",
  description: "Balai Lelang — jual & tawar barang RPG antar player",
  usage: ".lelang <jual/bid/beli/info/batal/list/riwayat> [...]",
  example: ".lelang jual diamond 5 10000 6",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const TAX_RATE = 0.05; 
const MIN_DURATION_HOURS = 1;
const MAX_DURATION_HOURS = 48;
const MIN_START_PRICE = 50;
const MAX_ACTIVE_PER_USER = 5;

const ITEMS = {
  common: { emote: "📦", name: "Common Crate" },
  uncommon: { emote: "🛍️", name: "Uncommon Crate" },
  mythic: { emote: "🎁", name: "Mythic Crate" },
  legendary: { emote: "💎", name: "Legendary Crate" },
  rock: { emote: "🪨", name: "Batu" },
  coal: { emote: "⚫", name: "Batubara" },
  iron: { emote: "⛓️", name: "Besi" },
  gold: { emote: "🥇", name: "Emas" },
  diamond: { emote: "💠", name: "Berlian" },
  emerald: { emote: "💚", name: "Emerald" },
  wood: { emote: "🪵", name: "Kayu" },
  string: { emote: "🧵", name: "Tali" },
  trash: { emote: "🗑️", name: "Sampah" },
  fish: { emote: "🐟", name: "Ikan" },
  prawn: { emote: "🦐", name: "Udang" },
  octopus: { emote: "🐙", name: "Gurita" },
  shark: { emote: "🦈", name: "Hiu" },
  whale: { emote: "🐳", name: "Paus" },
  potion: { emote: "🥤", name: "Health Potion" },
  mpotion: { emote: "🧪", name: "Mana Potion" },
  stamina: { emote: "⚡", name: "Stamina Potion" },
  herb: { emote: "🌿", name: "Herba" },
  leather: { emote: "👞", name: "Kulit" },
  mysterybox: { emote: "📦", name: "Mystery Box" },
  sword: { emote: "⚔️", name: "Pedang Besi" },
  shield: { emote: "🛡️", name: "Perisai Besi" },
  helmet: { emote: "⛑️", name: "Helm Besi" },
  armor: { emote: "🦺", name: "Armor Besi" },
  axe: { emote: "🪓", name: "Kapak Besi" },
  pickaxe: { emote: "⛏️", name: "Beliung" },
  bow: { emote: "🏹", name: "Busur" },
  arrow: { emote: "🎯", name: "Anak Panah" },
  goldsword: { emote: "🗡️", name: "Pedang Emas" },
  diamondarmor: { emote: "💎", name: "Armor Berlian" },
  healthpotion: { emote: "❤️", name: "Health Potion (Alchemy)" },
  manapotion: { emote: "💙", name: "Mana Potion (Alchemy)" },
  staminapotion: { emote: "⚡", name: "Stamina Potion (Alchemy)" },
  strengthpotion: { emote: "💪", name: "Strength Potion" },
  defensepotion: { emote: "🛡️", name: "Defense Potion" },
  luckpotion: { emote: "🍀", name: "Luck Potion" },
  exppotion: { emote: "✨", name: "EXP Potion" },
  antidote: { emote: "💊", name: "Antidote" },
  elixir: { emote: "🧪", name: "Elixir" },
};

function displayItem(key) {
  const it = ITEMS[key];
  return it ? `${it.emote} ${it.name}` : `📦 ${key}`;
}

function fmtRp(n) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function fmtSisaWaktu(ms) {
  if (ms <= 0) return "Berakhir";
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const mnt = totalMin % 60;
  if (h > 0) return `${h}j ${mnt}m`;
  return `${mnt}m`;
}

function minIncrement(currentBid) {
  return Math.max(500, Math.ceil(currentBid * 0.05));
}

function getAuctions(db) {
  return db.setting("auctions") || {};
}

function saveAuctions(db, auctions) {
  db.setting("auctions", auctions);
  db.save();
}

function getHistory(db) {
  return db.setting("auctionHistory") || [];
}

function pushHistory(db, entry) {
  const hist = getHistory(db);
  hist.unshift(entry);
  if (hist.length > 200) hist.length = 200;
  db.setting("auctionHistory", hist);
}

function generateId(auctions) {
  let id;
  do {
    id = "AH" + Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (auctions[id]);
  return id;
}

async function settleExpired(db, sock) {
  const auctions = getAuctions(db);
  const now = Date.now();
  let changed = false;

  for (const id of Object.keys(auctions)) {
    const a = auctions[id];
    if (a.status !== "active" || now < a.endsAt) continue;

    changed = true;

    if (a.bidder) {
      const winner = db.getUser(a.bidder) || db.setUser(a.bidder);
      winner.inventory = winner.inventory || {};
      winner.inventory[a.item] = (winner.inventory[a.item] || 0) + a.qty;
      db.setUser(a.bidder, winner);

      const seller = db.getUser(a.seller) || db.setUser(a.seller);
      const payout = Math.floor(a.currentBid * (1 - TAX_RATE));
      seller.koin = (seller.koin || 0) + payout;
      db.setUser(a.seller, seller);

      pushHistory(db, {
        id, item: a.item, qty: a.qty, price: a.currentBid, payout,
        seller: a.seller, buyer: a.bidder, endedAt: now, result: "sold",
      });

      try {
        await sock.sendMessage(a.seller, {
          text: `🔨 *LELANG SELESAI!*\n\n${displayItem(a.item)} (${a.qty}x) milikmu (ID: ${id}) laku terjual seharga *${fmtRp(a.currentBid)}*!\nKamu menerima *${fmtRp(payout)}* (sudah dipotong pajak pasar ${Math.round(TAX_RATE * 100)}%).`,
        });
      } catch {}
      try {
        await sock.sendMessage(a.bidder, {
          text: `🎉 *SELAMAT, KAMU MENANG LELANG!*\n\nKamu memenangkan ${displayItem(a.item)} (${a.qty}x) dari lelang ID *${id}* seharga *${fmtRp(a.currentBid)}*.\nBarang sudah masuk ke inventorymu!`,
        });
      } catch {}
    } else {
      const seller = db.getUser(a.seller) || db.setUser(a.seller);
      seller.inventory = seller.inventory || {};
      seller.inventory[a.item] = (seller.inventory[a.item] || 0) + a.qty;
      db.setUser(a.seller, seller);

      pushHistory(db, {
        id, item: a.item, qty: a.qty, price: a.startPrice,
        seller: a.seller, buyer: null, endedAt: now, result: "unsold",
      });

      try {
        await sock.sendMessage(a.seller, {
          text: `📦 *LELANG BERAKHIR TANPA PENAWAR*\n\n${displayItem(a.item)} (${a.qty}x) (ID: ${id}) tidak laku terjual. Barang sudah dikembalikan ke inventorymu.`,
        });
      } catch {}
    }

    delete auctions[id];
  }

  if (changed) saveAuctions(db, auctions);
  return auctions;
}

async function handler(m, { sock }) {
  const db = getDatabase();

  let auctions = await settleExpired(db, sock);

  const user = db.getUser(m.sender) || db.setUser(m.sender);
  user.inventory = user.inventory || {};

  const args = m.args || [];
  const sub = (args[0] || "list").toLowerCase();

  if (sub === "list") {
    const active = Object.values(auctions).filter((a) => a.status === "active");
    if (active.length === 0) {
      return m.reply(
        `🔨 *BALAI LELANG* 🔨\n\nBelum ada barang yang dilelang saat ini.\n\nJadi yang pertama! Ketik:\n\`${m.prefix}lelang jual <item> <jumlah> <harga_awal> <durasi_jam>\``,
      );
    }
    active.sort((a, b) => a.endsAt - b.endsAt);

    let txt = `🔨 *BALAI LELANG* 🔨\n_${active.length} barang sedang dilelang_\n\n`;
    for (const a of active.slice(0, 10)) {
      txt += `🆔 *${a.id}*\n`;
      txt += `${displayItem(a.item)} (${a.qty}x)\n`;
      txt += `💰 Bid saat ini: *${fmtRp(a.currentBid)}*${a.bidder ? ` (${a.bidCount || 1}x bid)` : " (belum ada bid)"}\n`;
      txt += `⏳ Sisa waktu: *${fmtSisaWaktu(a.endsAt - Date.now())}*\n`;
      if (a.buyout) txt += `⚡ Beli langsung: *${fmtRp(a.buyout)}*\n`;
      txt += `\n`;
    }
    if (active.length > 10) txt += `_... dan ${active.length - 10} lelang lainnya_\n\n`;
    txt += `📌 Ketik \`${m.prefix}lelang info <id>\` buat detail\n`;
    txt += `📌 Ketik \`${m.prefix}lelang bid <id> <jumlah>\` buat nawar`;
    return m.reply(txt);
  }

  if (sub === "jual" || sub === "sell" || sub === "buka") {
    const itemKey = (args[1] || "").toLowerCase();
    const qty = parseInt(args[2]);
    const startPrice = parseInt(args[3]);
    const durationH = parseFloat(args[4]);
    const buyout = args[5] ? parseInt(args[5]) : null;

    if (!itemKey || !qty || !startPrice || !durationH) {
      return m.reply(
        `🔨 *BUKA LELANG BARU*\n\n` +
          `Format:\n\`${m.prefix}lelang jual <item> <jumlah> <harga_awal> <durasi_jam> [harga_beli_langsung]\`\n\n` +
          `Contoh:\n\`${m.prefix}lelang jual diamond 5 10000 6\`\n\`${m.prefix}lelang jual diamond 5 10000 6 50000\`\n\n` +
          `⏳ Durasi: ${MIN_DURATION_HOURS}-${MAX_DURATION_HOURS} jam\n` +
          `💰 Harga awal minimal: ${fmtRp(MIN_START_PRICE)}\n` +
          `📦 Maksimal ${MAX_ACTIVE_PER_USER} lelang aktif bersamaan`,
      );
    }

    const myActive = Object.values(auctions).filter((a) => a.status === "active" && a.seller === m.sender);
    if (myActive.length >= MAX_ACTIVE_PER_USER) {
      return m.reply(`❌ Kamu udah punya *${myActive.length}* lelang aktif! Maksimal ${MAX_ACTIVE_PER_USER} bersamaan ya.`);
    }

    if ((user.inventory[itemKey] || 0) < qty) {
      return m.reply(`❌ Stok *${displayItem(itemKey)}* kamu cuma *${user.inventory[itemKey] || 0}*, nggak cukup buat dilelang *${qty}x*.`);
    }

    if (startPrice < MIN_START_PRICE) {
      return m.reply(`❌ Harga awal minimal *${fmtRp(MIN_START_PRICE)}*.`);
    }

    if (durationH < MIN_DURATION_HOURS || durationH > MAX_DURATION_HOURS) {
      return m.reply(`❌ Durasi lelang harus antara *${MIN_DURATION_HOURS}-${MAX_DURATION_HOURS} jam*.`);
    }

    if (buyout !== null && buyout <= startPrice) {
      return m.reply(`❌ Harga beli langsung harus lebih besar dari harga awal.`);
    }

    user.inventory[itemKey] -= qty;
    db.setUser(m.sender, user);

    const id = generateId(auctions);
    const endsAt = Date.now() + durationH * 60 * 60 * 1000;

    auctions[id] = {
      id,
      seller: m.sender,
      sellerName: user.name || m.pushName || "Unknown",
      item: itemKey,
      qty,
      startPrice,
      currentBid: startPrice,
      bidder: null,
      bidderName: null,
      bidCount: 0,
      buyout,
      createdAt: Date.now(),
      endsAt,
      status: "active",
    };
    saveAuctions(db, auctions);

    let txt = `✅ *LELANG DIBUKA!*\n\n`;
    txt += `🆔 ID: *${id}*\n`;
    txt += `📦 Barang: ${displayItem(itemKey)} (${qty}x)\n`;
    txt += `💰 Harga awal: *${fmtRp(startPrice)}*\n`;
    if (buyout) txt += `⚡ Beli langsung: *${fmtRp(buyout)}*\n`;
    txt += `⏳ Berakhir dalam: *${durationH} jam*\n\n`;
    txt += `Barang sudah ditahan Balai Lelang sampai laku atau lelang dibatalkan.`;
    return m.reply(txt);
  }

  if (sub === "bid" || sub === "tawar" || sub === "nawar") {
    const id = (args[1] || "").toUpperCase();
    const amount = parseInt(args[2]);

    const a = auctions[id];
    if (!a || a.status !== "active") {
      return m.reply(`❌ Lelang dengan ID *${id}* tidak ditemukan atau sudah berakhir.`);
    }
    if (a.seller === m.sender) {
      return m.reply(`❌ Nggak bisa nawar barang lelangan sendiri!`);
    }
    if (!amount || amount <= 0) {
      return m.reply(`❌ Masukin jumlah bid yang valid.`);
    }

    const minBid = a.currentBid + (a.bidder ? minIncrement(a.currentBid) : 0);
    if (amount < minBid) {
      return m.reply(
        `❌ Bid minimal *${fmtRp(minBid)}* (bid sekarang: ${fmtRp(a.currentBid)}${a.bidder ? `, kenaikan minimal ${fmtRp(minIncrement(a.currentBid))}` : ""}).`,
      );
    }

    if ((user.koin || 0) < amount) {
      return m.reply(`❌ Koin kamu nggak cukup! Saldo: *${fmtRp(user.koin || 0)}*, butuh *${fmtRp(amount)}*.`);
    }

    if (a.bidder) {
      const prevBidder = db.getUser(a.bidder) || db.setUser(a.bidder);
      prevBidder.koin = (prevBidder.koin || 0) + a.currentBid;
      db.setUser(a.bidder, prevBidder);
      try {
        await sock.sendMessage(a.bidder, {
          text: `📢 *KAMU DISALIP!*\n\nBid kamu di lelang *${id}* (${displayItem(a.item)}) sudah dilewati jadi *${fmtRp(amount)}*. Uangmu *${fmtRp(a.currentBid)}* sudah dikembalikan.\nMau nawar lagi? Ketik \`${m.prefix}lelang bid ${id} <jumlah>\``,
        });
      } catch {}
    }

    user.koin -= amount;
    db.setUser(m.sender, user);

    a.currentBid = amount;
    a.bidder = m.sender;
    a.bidderName = user.name || m.pushName || "Unknown";
    a.bidCount = (a.bidCount || 0) + 1;
    saveAuctions(db, auctions);

    try {
      await sock.sendMessage(a.seller, {
        text: `📢 *ADA PENAWAR BARU!*\n\nLelang *${id}* (${displayItem(a.item)}) kamu baru saja ditawar *${fmtRp(amount)}* oleh ${a.bidderName}.`,
      });
    } catch {}

    return m.reply(
      `✅ *BID BERHASIL!*\n\nKamu menawar *${fmtRp(amount)}* untuk ${displayItem(a.item)} (${a.qty}x) di lelang *${id}*.\nKoin ditahan sampai lelang berakhir atau kamu disalip.`,
    );
  }

  if (sub === "beli" || sub === "buyout") {
    const id = (args[1] || "").toUpperCase();
    const a = auctions[id];
    if (!a || a.status !== "active") {
      return m.reply(`❌ Lelang dengan ID *${id}* tidak ditemukan atau sudah berakhir.`);
    }
    if (!a.buyout) {
      return m.reply(`❌ Lelang ini nggak punya opsi beli langsung. Pakai \`${m.prefix}lelang bid ${id} <jumlah>\` ya.`);
    }
    if (a.seller === m.sender) {
      return m.reply(`❌ Nggak bisa beli barang lelangan sendiri!`);
    }
    if ((user.koin || 0) < a.buyout) {
      return m.reply(`❌ Koin kamu nggak cukup! Saldo: *${fmtRp(user.koin || 0)}*, butuh *${fmtRp(a.buyout)}*.`);
    }

    if (a.bidder) {
      const prevBidder = db.getUser(a.bidder) || db.setUser(a.bidder);
      prevBidder.koin = (prevBidder.koin || 0) + a.currentBid;
      db.setUser(a.bidder, prevBidder);
      try {
        await sock.sendMessage(a.bidder, {
          text: `📢 Lelang *${id}* (${displayItem(a.item)}) dibeli langsung oleh orang lain. Uangmu *${fmtRp(a.currentBid)}* sudah dikembalikan.`,
        });
      } catch {}
    }

    user.koin -= a.buyout;
    user.inventory[a.item] = (user.inventory[a.item] || 0) + a.qty;
    db.setUser(m.sender, user);

    const seller = db.getUser(a.seller) || db.setUser(a.seller);
    const payout = Math.floor(a.buyout * (1 - TAX_RATE));
    seller.koin = (seller.koin || 0) + payout;
    db.setUser(a.seller, seller);

    pushHistory(db, {
      id, item: a.item, qty: a.qty, price: a.buyout, payout,
      seller: a.seller, buyer: m.sender, endedAt: Date.now(), result: "buyout",
    });

    delete auctions[id];
    saveAuctions(db, auctions);

    try {
      await sock.sendMessage(a.seller, {
        text: `⚡ *TERJUAL LANGSUNG!*\n\n${displayItem(a.item)} (${a.qty}x) milikmu (ID: ${id}) dibeli langsung seharga *${fmtRp(a.buyout)}*!\nKamu menerima *${fmtRp(payout)}* (sudah dipotong pajak pasar ${Math.round(TAX_RATE * 100)}%).`,
      });
    } catch {}

    return m.reply(`🎉 *PEMBELIAN BERHASIL!*\n\nKamu langsung dapet ${displayItem(a.item)} (${a.qty}x) seharga *${fmtRp(a.buyout)}*. Barang udah masuk inventorymu!`);
  }

  if (sub === "info" || sub === "cek") {
    const id = (args[1] || "").toUpperCase();
    const a = auctions[id];
    if (!a) return m.reply(`❌ Lelang dengan ID *${id}* tidak ditemukan.`);

    let txt = `🔍 *DETAIL LELANG ${id}*\n\n`;
    txt += `📦 Barang: ${displayItem(a.item)} (${a.qty}x)\n`;
    txt += `👤 Penjual: ${a.sellerName}\n`;
    txt += `💰 Harga awal: *${fmtRp(a.startPrice)}*\n`;
    txt += `📈 Bid tertinggi: *${fmtRp(a.currentBid)}*${a.bidder ? ` oleh ${a.bidderName}` : " (belum ada penawar)"}\n`;
    if (a.buyout) txt += `⚡ Beli langsung: *${fmtRp(a.buyout)}*\n`;
    txt += `⏳ Sisa waktu: *${fmtSisaWaktu(a.endsAt - Date.now())}*\n`;
    txt += `\n📌 \`${m.prefix}lelang bid ${id} <jumlah>\` buat nawar`;
    if (a.buyout) txt += `\n📌 \`${m.prefix}lelang beli ${id}\` buat beli langsung`;
    return m.reply(txt);
  }

  if (sub === "batal" || sub === "cancel") {
    const id = (args[1] || "").toUpperCase();
    const a = auctions[id];
    if (!a || a.status !== "active") {
      return m.reply(`❌ Lelang dengan ID *${id}* tidak ditemukan atau sudah berakhir.`);
    }
    if (a.seller !== m.sender) {
      return m.reply(`❌ Ini bukan lelang kamu!`);
    }
    if (a.bidder) {
      return m.reply(`❌ Lelang ini udah ada penawarnya, nggak bisa dibatalin lagi. Tunggu sampai selesai ya.`);
    }

    user.inventory[a.item] = (user.inventory[a.item] || 0) + a.qty;
    db.setUser(m.sender, user);

    delete auctions[id];
    saveAuctions(db, auctions);

    return m.reply(`✅ Lelang *${id}* dibatalkan. ${displayItem(a.item)} (${a.qty}x) sudah dikembalikan ke inventorymu.`);
  }

  if (sub === "riwayat" || sub === "history") {
    const hist = getHistory(db)
      .filter((h) => h.seller === m.sender || h.buyer === m.sender)
      .slice(0, 10);
    if (hist.length === 0) {
      return m.reply(`📜 Belum ada riwayat lelang kamu.`);
    }
    let txt = `📜 *RIWAYAT LELANG KAMU*\n\n`;
    for (const h of hist) {
      const asSeller = h.seller === m.sender;
      txt += `🆔 ${h.id} — ${displayItem(h.item)} (${h.qty}x)\n`;
      if (h.result === "unsold") {
        txt += `↩️ Tidak laku, barang dikembalikan\n\n`;
      } else {
        txt += asSeller ? `✅ Terjual *${fmtRp(h.price)}* (dapat ${fmtRp(h.payout)})\n\n` : `🛒 Kamu beli seharga *${fmtRp(h.price)}*\n\n`;
      }
    }
    return m.reply(txt.trim());
  }

  let txt = `🔨 *BALAI LELANG (AUCTION HOUSE)* 🔨\n\n`;
  txt += `Lelang barang RPG kamu ke sesama player, atau ikutan nawar barang orang lain!\n\n`;
  txt += `*Command:*\n`;
  txt += `📌 \`${m.prefix}lelang\` / \`list\` — lihat lelang aktif\n`;
  txt += `📌 \`${m.prefix}lelang jual <item> <jumlah> <harga_awal> <durasi_jam> [buyout]\` — buka lelang\n`;
  txt += `📌 \`${m.prefix}lelang bid <id> <jumlah>\` — nawar\n`;
  txt += `📌 \`${m.prefix}lelang beli <id>\` — beli langsung (kalau ada opsi buyout)\n`;
  txt += `📌 \`${m.prefix}lelang info <id>\` — detail lelang\n`;
  txt += `📌 \`${m.prefix}lelang batal <id>\` — batalin lelang kamu (kalau belum ada bid)\n`;
  txt += `📌 \`${m.prefix}lelang riwayat\` — riwayat transaksi kamu`;
  return m.reply(txt);
}

export { pluginConfig as config, handler };