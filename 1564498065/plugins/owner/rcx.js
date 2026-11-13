// plugins/owner/rcx.js
// Kirim sticker reaction (associationType: 11) N kali ke SATU pesan yang di-reply,
// biar numpuk jadi baris kecil di bawah pesan itu — efek ".slken"

const pluginConfig = {
  name: ["rcx", "slken"],
  alias: [],
  category: "owner",
  description: "Sticker reaction numpuk N kali ke pesan yang di-reply",
  usage: ".rcx <jumlah> (reply pesan target)",
  example: ".rcx 5",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

// ================= ISI DATA STICKER DI SINI =================
const STICKER = {
  url: "https://mmg.whatsapp.net/v/t62.15575-24/867836421_1135144482223779_7676474370535765552_n.enc?ccb=11-4&oh=01_Q5Aa5wGKVj6MQphisRZmorqwo_KTk8HoQ9RYxprltHZtajK-dQ&oe=6B0DF68C&_nc_sid=5e03e0&mms3=true",
  fileSha256: "r4dFbiV/+HFDzSLgz7kX0hCOQtin1C2+RtkxB2klaYA=",
  fileEncSha256: "lIU/wNkCTDAPtchEeTQYTTo3UuhfqRMLC0MY9VOTSdI=",
  mediaKey: "wxVPNH2BfjeD1jX+Fl4S7FSGJ/4RWhJ5ioTyWuzUjdA=",
  mimetype: "image/webp",
  directPath:
    "/v/t62.15575-24/867836421_1135144482223779_7676474370535765552_n.enc?ccb=11-4&oh=01_Q5Aa5wGKVj6MQphisRZmorqwo_KTk8HoQ9RYxprltHZtajK-dQ&oe=6B0DF68C&_nc_sid=5e03e0",
  isLottie: false,
};
// =============================================================

const MAX_RCX = 20; // batas aman biar gak rate-limit
const DELAY_MS = 300;

// ---------- Logger console ----------
const TAG = "[rcx]";
const ts = () => new Date().toISOString();

function logInfo(step, extra = "") {
  console.log(`${ts()} ${TAG} ${step}`, extra);
}

function logError(step, err, ctx = {}) {
  console.error(`\n${ts()} ${TAG} ❌ ERROR di langkah: ${step}`);
  console.error("Pesan  :", err?.message || err);
  console.error("Stack  :", err?.stack || "(tidak ada stack)");
  if (Object.keys(ctx).length) console.error("Context:", ctx);
  console.error("");
}

const toBuf = (b64) => Buffer.from(String(b64 || ""), "base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function validateSticker(s) {
  const wajib = ["url", "fileSha256", "fileEncSha256", "mediaKey", "mimetype", "directPath"];
  return wajib.filter((k) => !s[k]);
}

async function handler(m, { sock }) {
  let step = "validasi input";

  try {
    const kosong = validateSticker(STICKER);
    if (kosong.length) {
      console.error(`${ts()} ${TAG} ⚠️ Field STICKER belum diisi: ${kosong.join(", ")}`);
      return m.reply(`❌ Field STICKER belum diisi: ${kosong.join(", ")}`);
    }

    const jumlahRaw = (m.args && m.args[0]) || "";
    let jumlah = parseInt(jumlahRaw, 10);
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      return m.reply(
        `*Penggunaan:*\n${m.prefix}${m.command} <jumlah>\nReply pesan target dulu.\n\n*Contoh:*\n${m.prefix}${m.command} 5`,
      );
    }
    if (jumlah > MAX_RCX) {
      jumlah = MAX_RCX;
      await m.reply(`⚠️ Dibatasi maksimal ${MAX_RCX} biar aman dari rate-limit WA.`);
    }

    step = "cek pesan target";
    const targetKey = m.quoted?.key || m.key;
    if (!targetKey) {
      return m.reply("❌ Reply pesan yang mau di-react dulu.");
    }
    logInfo("target", `pesan id=${targetKey.id}`);

    step = "react";
    await m.react("🕕");

    step = "kirim sticker reaction berulang";
    const stickerMessage = {
      url: STICKER.url,
      fileSha256: toBuf(STICKER.fileSha256),
      fileEncSha256: toBuf(STICKER.fileEncSha256),
      mediaKey: toBuf(STICKER.mediaKey),
      mimetype: STICKER.mimetype,
      directPath: STICKER.directPath,
      isLottie: STICKER.isLottie,
    };

    let sukses = 0;
    for (let i = 0; i < jumlah; i++) {
      try {
        const payload = {
          messageContextInfo: {
            messageAssociation: {
              associationType: 11,
              parentMessageKey: targetKey,
            },
          },
          stickerMessage,
        };
        await sock.relayMessage(m.chat, payload, {});
        sukses++;
      } catch (errSatu) {
        logError(`kirim reaction ke-${i + 1}`, errSatu);
      }
      await sleep(DELAY_MS);
    }

    step = "react sukses";
    await m.react("✅");
    logInfo("selesai", `${sukses}/${jumlah} berhasil dikirim ke pesan ${targetKey.id}`);
    await m.reply(`✅ Berhasil kirim ${sukses}/${jumlah} sticker reaction ke 1 pesan.`);
  } catch (err) {
    logError(step, err, { chat: m?.chat, command: m?.command });
    try {
      await m.react("☢");
      await m.reply(`❌ Error di langkah *${step}*\n${err?.message || err}`);
    } catch (err2) {
      logError("kirim notifikasi error", err2);
    }
  }
}

export { pluginConfig as config, handler };