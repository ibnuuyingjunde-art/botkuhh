import { sendBatchPrivateRelayUnified } from "../../src/spr/sbpr.js";

const pluginConfig = {
  name: "whisper",
  alias: ["bisik", "rahasia"],
  category: "fun",
  description: "Kirim pesan bisikan rahasia secara privat via sBPR",
  usage: ".whisper @tag target | pesan rahasianya",
  example: ".whisper @628123456789 | jangan bilang siapa-siapa ya",
  isOwner: false,
  isGroup: true,
  isEnabled: true,
};

async function handler(m, { sock, text }) {
  if (!text || !text.includes("|")) {
    return m.reply(
      `❌ *Format Bisikan Salah!*\n\n` +
      `> Gunakan format:\n` +
      `> *${m.prefix || '.'}whisper @tag_target | pesan rahasianya*\n\n` +
      `> Contoh: *${m.prefix || '.'}whisper @628123456789 | lu sebenarnya suka kan sama dia?*`
    );
  }

  // Pisahkan target dan pesan berdasarkan karakter "|"
  const [targetRaw, ...messageParts] = text.split("|");
  const secretMessage = messageParts.join("|").trim();

  // Dapatkan JID target dari tag atau input manual
  let targetJid = m.mentionedJid?.[0] || targetRaw.trim().replace(/[^0-9]/g, "") + "@s.whatsapp.net";
  
  if (!targetJid || targetJid.includes("NaN") || targetJid === "@s.whatsapp.net") {
    return m.reply("❌ Tag atau nomor targetnya mana nih? Coba benerin lagi formatnya.");
  }

  const senderNum = (m.sender || "").split("@")[0].split(":")[0];
  const targetNum = targetJid.split("@")[0];

  if (targetNum === senderNum) {
    return m.reply("⚠️ Yaelah, kurang kerjaan banget bisik-bisik ke diri sendiri. Jomblo ya? 💀");
  }

  const conn = sock || m.conn;

  try {
    await m.reply(`⏳ Sedang mengirimkan bisikan rahasia ke @${targetNum}...`);

    // Format pesan raw untuk sBPR (menggunakan format protobuf standar Baileys)
    const privateMsgPayload = {
      extendedTextMessage: {
        text: `👀 *WAAA ADA BISIKAN RAHASIA BUAT LO!* 👀\n\n` +
              `Seseorang (@${senderNum}) membisiki kamu lewat grup:\n` +
              `> _"${secretMessage}"_\n\n` +
              `🤫 _Pesan ini dikirim aman menggunakan fitur Private Relay._`
      }
    };

    // Kirim isi bisikan rahasia menggunakan fungsi sBPR
    await sendBatchPrivateRelayUnified(
      conn,
      m.chat, // Group JID tempat perintah dieksekusi
      [targetJid], // Target JID penerima (dalam array)
      privateMsgPayload,
      {
        verbose: false,
        msgForOthers: "🤫 *[Ssstt... Seseorang baru saja mengirim pesan bisikan di grup ini]*" // Pesan decoy/palsu untuk member lain
      }
    );

    // Konfirmasi ke pengirim di grup
    return m.reply(`✅ *Bisikan Berhasil Dikirim!*\nTarget: @${targetNum}\nSi target bakal nerima pesan ini di chat pribadi secara diam-diam. 🤫`);

  } catch (e) {
    console.error('[WHISPER Error]', e);
    return m.reply('⚠️ Gagal mengirim bisikan: ' + (e?.message || e));
  }
}

export { pluginConfig as config, handler };