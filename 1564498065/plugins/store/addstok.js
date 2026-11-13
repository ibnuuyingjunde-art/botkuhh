import config from "../../config.js";
import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
  name: "addstok",
  alias: ["tambahstok", "stok+"],
  category: "store",
  description: "Tambah stok produk digital",
  usage: ".addstok <produk> [harga] <data>",
  example: ".addstok amlight 10000 email@gmail.com:pass1,email2@gmail.com:pass2",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

const STOK_TYPE = {
  premium:  "akunep",
  premium7: "akunep",
  sewabot:  "akunep",
  sewabot7: "akunep",
  limit:    "akunep",
  amlight:  "emailtempmail",
};

function detectType(data) {
  const idx = data.indexOf(":");
  if (idx === -1) return "akunep";
  const right = data.slice(idx + 1).trim();
  return (right.includes("@") || right.startsWith("http")) ? "emailtempmail" : "akunep";
}

function parseLines(raw) {
  
  const byNewline = raw.split("\n").map(l => l.trim()).filter(Boolean);

  const result = [];
  for (const line of byNewline) {

    const parts = line.split(",").map(p => p.trim()).filter(p => p.includes(":"));
    for (const part of parts) {
      result.push(part);
    }
  }

  return result;
}

async function handler(m, { sock }) {
  const db   = getDatabase();
  const args = m.args;

  if (!args[0]) {
    const stokAll = db.setting("stokProduk") || {};
    const known   = Object.keys(STOK_TYPE);
    const custom  = Object.keys(stokAll).filter(k => !known.includes(k));

    let txt = `📦 *TAMBAH STOK PRODUK*\n\n`;
    txt += `*Format:*\n`;
    txt += `• 1 item:\n`;
    txt += `  \`.addstok <produk> email:pass\`\n\n`;
    txt += `• Banyak dipisah koma:\n`;
    txt += `  \`.addstok <produk> email1:pass1,email2:pass2\`\n\n`;
    txt += `• Banyak dipisah baris (Enter):\n`;
    txt += `  \`.addstok <produk>\`\n`;
    txt += `  \`email1:pass1\`\n`;
    txt += `  \`email2:pass2\`\n\n`;
    txt += `• Dengan harga (produk custom):\n`;
    txt += `  \`.addstok <produk> <harga> email:pass\`\n\n`;
    txt += `*Produk bawaan:*\n`;
    for (const [key, type] of Object.entries(STOK_TYPE)) {
      const jumlah = Array.isArray(stokAll[key]) ? stokAll[key].length : 0;
      txt += `│ • ${key} _(${type}, ${jumlah} item)_\n`;
    }
    if (custom.length > 0) {
      txt += `\n*Produk custom:*\n`;
      for (const key of custom) {
        const jumlah = Array.isArray(stokAll[key]) ? stokAll[key].length : 0;
        const harga  = db.setting("stokHarga")?.[key] || 0;
        txt += `│ • ${key} _(${jumlah} item, Rp ${harga.toLocaleString("id-ID")})_\n`;
      }
    }
    return m.reply(txt);
  }

  const produkKey = args[0].toLowerCase();

  let harga    = null;
  let dataArgs = args.slice(1);

  if (args[1] && /^\d+$/.test(args[1])) {
    harga    = parseInt(args[1]);
    dataArgs = args.slice(2);
  }

  const rawData = dataArgs.join(" ").trim();

  if (!rawData) {
    return m.reply(
      `❌ Data tidak boleh kosong!\n\n` +
      `*Format:*\n` +
      `• 1 item: \`.addstok ${produkKey} email:pass\`\n` +
      `• Koma  : \`.addstok ${produkKey} email1:pass1,email2:pass2\`\n` +
      `• Baris : kirim dengan Enter sebagai pemisah`
    );
  }

  const lines = parseLines(rawData);

  if (lines.length === 0) {
    return m.reply(
      `❌ Tidak ada data valid ditemukan.\n` +
      `Pastikan format: \`email:password\` atau \`email:tempmail\``
    );
  }

  const stokAll  = db.setting("stokProduk") || {};
  const stokProd = stokAll[produkKey] || [];

  let added  = 0;
  let skipped = 0;
  const tipeUsed = STOK_TYPE[produkKey] || detectType(lines[0]);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) { skipped++; continue; }

    const email = line.slice(0, idx).trim();
    const right = line.slice(idx + 1).trim();

    if (!email || !right) { skipped++; continue; }

    let item;
    if (tipeUsed === "emailtempmail") {
      item = { email, tempmail: right, addedAt: Date.now() };
    } else {
      item = { email, password: right, addedAt: Date.now() };
    }

    stokProd.push(item);
    added++;
  }

  stokAll[produkKey] = stokProd;
  db.setting("stokProduk", stokAll);

  if (harga !== null) {
    const stokHarga = db.setting("stokHarga") || {};
    stokHarga[produkKey] = harga;
    db.setting("stokHarga", stokHarga);
  }

  await db.save();

  const hargaSave = harga ?? db.setting("stokHarga")?.[produkKey] ?? 0;

  let reply = `✅ *Stok berhasil ditambahkan!*\n\n`;
  reply += `│ Produk   : *${produkKey}*\n`;
  reply += `│ Tipe     : *${tipeUsed}*\n`;
  if (hargaSave > 0) reply += `│ Harga    : *Rp ${hargaSave.toLocaleString("id-ID")}*\n`;
  reply += `│ Ditambah : *${added} item*\n`;
  if (skipped > 0) reply += `│ Dilewati : *${skipped} item* _(format salah)_\n`;
  reply += `│ Total    : *${stokProd.length} item*`;

  return m.reply(reply);
}

export { pluginConfig as config, handler, STOK_TYPE };