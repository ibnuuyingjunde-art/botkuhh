import http from "http";
import { execFile, spawn } from "child_process";
import fs from "fs";
import path from "path";
import config from "../../config.js";
import { getDatabase } from "./ichigo-database.js";
import { logger } from "./ichigo-logger.js";

const WEBHOOK_PORT = 3000;
const CLOUDFLARED_PATH = path.join(process.cwd(), "cloudflared");
const TUNNEL_URL_FILE  = path.join(process.cwd(), ".tunnel-url");

const PRODUK = {
  premium:   { nama: "Premium 30 Hari",  durasi: 30,  type: "premium" },
  premium7:  { nama: "Premium 7 Hari",   durasi: 7,   type: "premium" },
  sewabot:   { nama: "Sewa Bot 30 Hari", durasi: 30,  type: "sewabot" },
  sewabot7:  { nama: "Sewa Bot 7 Hari",  durasi: 7,   type: "sewabot" },
  limit:     { nama: "Limit +100",       durasi: null, type: "limit"  },
};

function getProdukFromAmount(amount) {
  const hargaMap = {
    5000:  "premium7",
    10000: "premium",
    25000: "sewabot7",
    50000: "sewabot",
    3000:  "limit",
  };
  return hargaMap[amount] || null;
}

function extractPhoneFromMessage(msg) {
  if (!msg) return null;
  
  const match = msg.match(/(?:\+?62|0)[\s\-]?8[\d\s\-]{8,12}/);
  if (!match) return null;
  let num = match[0].replace(/[\s\-]/g, "");
  if (num.startsWith("0")) num = "62" + num.slice(1);
  if (num.startsWith("+")) num = num.slice(1);
  return num + "@s.whatsapp.net";
}

function addDays(ms, days) {
  return ms + days * 24 * 60 * 60 * 1000;
}

function formatTanggal(ms) {
  return new Date(ms).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function processDonation(data, sock) {
  try {
    const amount   = data.amount_raw || 0;
    const message  = data.message || "";
    const donator  = data.donator_name || "Donatur";
    const botName  = config.bot?.name || "lyniX's MD";
    const db       = getDatabase();

    logger.info("SAWERIA", `Donasi masuk: Rp${amount} dari ${donator} | pesan: ${message}`);

    const produkKey = getProdukFromAmount(amount);
    const userJid   = extractPhoneFromMessage(message);

    const ownerNumber = Array.isArray(config.owner?.number)
      ? config.owner.number[0]
      : config.owner?.number || "";
    const ownerJid = ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    if (!userJid) {
      logger.warn("SAWERIA", `Donasi Rp${amount} dari ${donator} — tidak ada nomor WA di pesan`);
      try {
        await sock.sendMessage(ownerJid, {
          text:
            `⚠️ *DONASI MASUK TANPA NOMOR WA*\n\n` +
            `👤 Donatur : ${donator}\n` +
            `💰 Nominal : Rp${amount.toLocaleString("id-ID")}\n` +
            `💬 Pesan   : ${message || "-"}\n\n` +
            `Tidak bisa auto-aktivasi karena tidak ada nomor WA di pesan.\n` +
            `Proses manual dengan ${config.command?.prefix || "."}approve`,
        });
      } catch {}
      return;
    }

    if (!produkKey) {
      logger.warn("SAWERIA", `Nominal Rp${amount} tidak cocok produk manapun`);
      try {
        await sock.sendMessage(ownerJid, {
          text:
            `⚠️ *DONASI NOMINAL TIDAK DIKENAL*\n\n` +
            `👤 Donatur : ${donator}\n` +
            `💰 Nominal : Rp${amount.toLocaleString("id-ID")}\n` +
            `💬 Pesan   : ${message}\n` +
            `📱 WA      : ${userJid.split("@")[0]}\n\n` +
            `Nominal tidak cocok produk manapun. Proses manual jika perlu.`,
        });
      } catch {}
      return;
    }

    const produk = PRODUK[produkKey];
    const now    = Date.now();

    const userData = db.getUser(userJid) || {};

    if (produk.type === "premium") {
      const currentExpiry = userData.premiumExpiry || now;
      const base          = currentExpiry > now ? currentExpiry : now;
      const newExpiry     = addDays(base, produk.durasi);
      db.setUser(userJid, {
        isPremium: true,
        premiumExpiry: newExpiry,
      });
      logger.success("SAWERIA", `Premium aktif untuk ${userJid.split("@")[0]} hingga ${formatTanggal(newExpiry)}`);

    } else if (produk.type === "sewabot") {
      const currentExpiry = userData.sewabotExpiry || now;
      const base          = currentExpiry > now ? currentExpiry : now;
      const newExpiry     = addDays(base, produk.durasi);
      db.setUser(userJid, {
        isSewabot: true,
        sewabotExpiry: newExpiry,
      });
      logger.success("SAWERIA", `Sewabot aktif untuk ${userJid.split("@")[0]} hingga ${formatTanggal(newExpiry)}`);

    } else if (produk.type === "limit") {
      const currentLimit = userData.limit || 0;
      db.setUser(userJid, { limit: currentLimit + 100 });
      logger.success("SAWERIA", `+100 limit untuk ${userJid.split("@")[0]}`);
    }

    await db.save();

    const userNum = userJid.split("@")[0];
    let userTxt = `🎉 *PEMBAYARAN BERHASIL*\n\n`;
    userTxt += `Halo! Pembayaranmu via Saweria sudah diverifikasi otomatis.\n\n`;
    userTxt += `╭─「 ✅ Detail Aktivasi 」\n`;
    userTxt += `│ Produk  : ${produk.nama}\n`;
    userTxt += `│ Nominal : Rp${amount.toLocaleString("id-ID")}\n`;
    if (produk.durasi) {
      const expiry = addDays(now, produk.durasi);
      userTxt += `│ Expire  : ${formatTanggal(expiry)}\n`;
    }
    userTxt += `╰──\n\n`;
    userTxt += `Terima kasih sudah berlangganan ${botName}! 🌸`;

    try {
      await sock.sendMessage(userJid, { text: userTxt });
    } catch (e) {
      logger.warn("SAWERIA", `Gagal notif user: ${e.message}`);
    }

    try {
      await sock.sendMessage(ownerJid, {
        text:
          `✅ *AUTO APPROVE BERHASIL*\n\n` +
          `👤 Donatur : ${donator}\n` +
          `📱 WA      : +${userNum}\n` +
          `📦 Produk  : ${produk.nama}\n` +
          `💰 Nominal : Rp${amount.toLocaleString("id-ID")}\n\n` +
          `Produk sudah otomatis diaktifkan.`,
      });
    } catch {}

  } catch (err) {
    logger.error("SAWERIA", `Error proses donasi: ${err.message}`);
  }
}

function startWebhookServer(sock) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/webhook/saweria") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          logger.info("SAWERIA", `Webhook diterima: ${JSON.stringify(data).slice(0, 100)}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok" }));
          
          await processDonation(data, sock);
        } catch (e) {
          logger.warn("SAWERIA", `Webhook parse error: ${e.message}`);
          res.writeHead(400);
          res.end("Bad Request");
        }
      });
    } else if (req.method === "GET" && req.url === "/") {
      res.writeHead(200);
      res.end("lyniX's MD Webhook Server OK");
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(WEBHOOK_PORT, () => {
    logger.success("SAWERIA", `Webhook server aktif di port ${WEBHOOK_PORT}`);
  });

  return server;
}

async function startCloudflaredTunnel() {
  if (!fs.existsSync(CLOUDFLARED_PATH)) {
    logger.warn("SAWERIA", "cloudflared tidak ditemukan, skip tunnel");
    return null;
  }

  return new Promise((resolve) => {
    const tunnel = spawn(CLOUDFLARED_PATH, ["tunnel", "--url", `http://localhost:${WEBHOOK_PORT}`], {
      detached: false,
    });

    let resolved = false;

    tunnel.stderr.on("data", (data) => {
      const output = data.toString();
      const match  = output.match(/https:\/\/[a-z0-9\-]+\.tryichigoflare\.com/);
      if (match && !resolved) {
        resolved = true;
        const url = match[0];
        const webhookUrl = `${url}/webhook/saweria`;
        
        fs.writeFileSync(TUNNEL_URL_FILE, webhookUrl);
        logger.success("SAWERIA", `Tunnel aktif: ${webhookUrl}`);
        logger.info("SAWERIA", `Isi ke Saweria Webhook: ${webhookUrl}`);
        resolve(webhookUrl);
      }
    });

    tunnel.on("close", (code) => {
      logger.warn("SAWERIA", `Tunnel mati (code ${code}), restart dalam 10 detik...`);
      if (!resolved) resolve(null);
      
      setTimeout(() => startCloudflaredTunnel(), 10000);
    });

    tunnel.on("error", (err) => {
      logger.warn("SAWERIA", `Tunnel error: ${err.message}`);
      if (!resolved) resolve(null);
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logger.warn("SAWERIA", "Tunnel timeout, lanjut tanpa tunnel");
        resolve(null);
      }
    }, 30000);
  });
}

export async function startSaweriaWebhook(sock) {
  try {
    startWebhookServer(sock);
    const tunnelUrl = await startCloudflaredTunnel();

    if (tunnelUrl) {
      logger.success("SAWERIA", `Setup selesai!`);
      logger.info("SAWERIA", `Isi URL ini ke Saweria → Integrations → Webhook:`);
      logger.info("SAWERIA", tunnelUrl);

      const ownerNumber = Array.isArray(config.owner?.number)
        ? config.owner.number[0]
        : config.owner?.number || "";
      if (ownerNumber) {
        const ownerJid = ownerNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        setTimeout(async () => {
          try {
            await sock.sendMessage(ownerJid, {
              text:
                `🌐 *SAWERIA WEBHOOK AKTIF*\n\n` +
                `Salin URL ini ke Saweria:\n` +
                `Integrations → Webhook → Webhook URL\n\n` +
                `\`${tunnelUrl}\`\n\n` +
                `⚠️ URL berubah setiap restart bot.\n` +
                `Perlu diupdate manual di Saweria kalau bot direstart.`,
            });
          } catch {}
        }, 5000);
      }
    }
  } catch (err) {
    logger.error("SAWERIA", `Gagal start webhook: ${err.message}`);
  }
}