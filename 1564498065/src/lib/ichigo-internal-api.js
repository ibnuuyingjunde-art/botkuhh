

import express from "express";
import config from "../../config.js";
import { logger } from "./ichigo-logger.js";

let serverInstance = null;

function formatRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

function buildBroadcastText({ productName, amount, buyerLabel, depositId }) {
  return (
    `🛒 *ᴘᴇᴍʙᴇʟɪᴀɴ ʙᴀʀᴜ*\n\n` +
    `> Produk: ${productName || "-"}\n` +
    `> Total: ${formatRupiah(amount)}\n` +
    (buyerLabel ? `> Pembeli: ${buyerLabel}\n` : "") +
    (depositId ? `> ID: \`${depositId}\`\n` : "") +
    `\n_Terima kasih sudah berbelanja di ${config?.saluran?.name || "toko kami"}!_ 🙏`
  );
}

export function startInternalApi(sock) {
  if (serverInstance) return serverInstance; 

  const apiKey = config?.internalApi?.apiKey;
  if (!apiKey) {
    logger.warn(
      "internal-api",
      "BOT_INTERNAL_API_KEY belum diset, server API internal TIDAK dijalankan (biar gak kebuka tanpa proteksi).",
    );
    return null;
  }

  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const key = req.headers["x-internal-key"];
    if (key !== apiKey) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
  });

  app.post("/api/channel/broadcast", async (req, res) => {
    try {
      const channelId = config?.saluran?.id;
      if (!channelId) {
        return res.status(400).json({ success: false, error: "config.saluran.id belum diisi" });
      }
      const { productName, amount, buyerLabel, depositId } = req.body || {};
      const text = buildBroadcastText({ productName, amount, buyerLabel, depositId });

      await sock.sendMessage(channelId, { text });

      logger.success("internal-api", `Broadcast pembelian terkirim ke saluran (${depositId || "-"})`);
      return res.json({ success: true });
    } catch (err) {
      logger.error("internal-api", `Gagal broadcast ke saluran: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  const port = config?.internalApi?.port || 3001;
  serverInstance = app.listen(port, () => {
    logger.success("internal-api", `Server API internal jalan di port ${port}`);
  });

  return serverInstance;
}

export function stopInternalApi() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
