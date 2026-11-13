import botConfig from "../../config.js";

const pluginConfig = {
  name: ["testchannel", "testsaluran", "ujichannel"],
  alias: [],
  category: "owner",
  description: "Kirim pesan uji ke saluran WhatsApp yang terhubung ke IchigoStore",
  usage: ".testchannel [pesan]",
  example: ".testchannel Uji notifikasi pembelian IchigoStore",
  isOwner: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const channelId = String(botConfig.saluran?.id || "").trim();
  if (!channelId || !channelId.endsWith("@newsletter")) {
    return m.reply("ID saluran belum valid. Atur config.saluran.id dengan ID yang berakhiran @newsletter.");
  }

  const customMessage = String(m.text || "").trim().slice(0, 700);
  const text = customMessage || [
    "Uji notifikasi saluran IchigoStore",
    "Bot terhubung dan siap menerima broadcast transaksi.",
    `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`,
  ].join("\n");

  try {
    await sock.sendMessage(channelId, { text });
    await m.react("✓");
    return m.reply(`Pesan uji berhasil dikirim ke saluran.\nID: ${channelId}`);
  } catch (error) {
    return m.reply(`Gagal mengirim ke saluran: ${error.message || "kesalahan tidak diketahui"}`);
  }
}

export { pluginConfig as config, handler };