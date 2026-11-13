

let _canvas = null;
async function _getCanvas() {
  if (!_canvas) _canvas = await import("@napi-rs/canvas");
  return _canvas;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function resolveStatusStyle(rawStatus) {
  const status = String(rawStatus || "").toLowerCase().trim();

  if (["paid", "completed", "success", "lunas", "berhasil"].includes(status)) {
    return { label: "PEMBAYARAN BERHASIL", color: "#00e08a", glow: "rgba(0, 224, 138, 0.4)" };
  }
  if (["pending", "waiting", "menunggu"].includes(status)) {
    return { label: "MENUNGGU PEMBAYARAN", color: "#ffb100", glow: "rgba(255, 177, 0, 0.4)" };
  }
  if (["expired", "failed", "gagal", "cancelled", "batal"].includes(status)) {
    return { label: "GAGAL / KADALUARSA", color: "#ff3b5c", glow: "rgba(255, 59, 92, 0.4)" };
  }
  return { label: status ? status.toUpperCase() : "STATUS TIDAK DIKETAHUI", color: "#00d2ff", glow: "rgba(0, 210, 255, 0.4)" };
}

function truncate(ctx, text, maxWidth) {
  let value = String(text || "-");
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value.length > 1 && ctx.measureText(value + "…").width > maxWidth) {
    value = value.slice(0, -1);
  }
  return value + "…";
}

function fieldRow(ctx, label, value, x, y, maxWidth) {
  ctx.font = "600 20px Arial";
  ctx.fillStyle = "#7d8bab";
  ctx.fillText(label, x, y);

  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncate(ctx, value, maxWidth), x, y + 34);
}

/**
 * Bikin kartu notifikasi pembelian baru.
 *
 * @param {object} data
 * @param {string} data.productName  Nama produk yang dibeli
 * @param {string} data.buyerLabel   Nama/label pembeli
 * @param {string} data.orderId      ID order/deposit
 * @param {string} data.status       Status transaksi (paid/pending/expired/...)
 * @param {string} data.websiteName  Nama/domain website asal transaksi
 * @param {string} data.paymentMethod Metode pembayaran (QRIS, DANA, dst)
 * @param {number} [data.amount]     Total transaksi (opsional, ditampilkan kalau > 0)
 * @param {string} [data.timestamp]  Teks waktu yang mau ditampilkan (opsional)
 */
async function createPurchaseCard(data) {
  const { createCanvas } = await _getCanvas();
  const width = 1024;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const statusStyle = resolveStatusStyle(data.status);

  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#0f0c29");
  bgGradient.addColorStop(0.5, "#1a1440");
  bgGradient.addColorStop(1, "#0f0c29");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width, 0, 0, width, 0, 500);
  glow.addColorStop(0, statusStyle.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const cardX = 50, cardY = 50, cardW = width - 100, cardH = height - 100;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const padX = cardX + 50;
  let cursorY = cardY + 70;

  ctx.font = "bold 18px Courier New";
  const badgeText = `● ${statusStyle.label}`;
  const badgeWidth = ctx.measureText(badgeText).width + 34;
  drawRoundedRect(ctx, padX, cursorY - 28, badgeWidth, 38, 19);
  ctx.fillStyle = statusStyle.glow;
  ctx.fill();
  ctx.fillStyle = statusStyle.color;
  ctx.fillText(badgeText, padX + 17, cursorY - 2);

  cursorY += 55;

  ctx.font = "900 46px Arial";
  const productGradient = ctx.createLinearGradient(padX, 0, padX + 700, 0);
  productGradient.addColorStop(0, "#ffffff");
  productGradient.addColorStop(1, "#92effd");
  ctx.fillStyle = productGradient;
  ctx.fillText(truncate(ctx, data.productName || "-", cardW - 100), padX, cursorY);

  cursorY += 30;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(cardX + cardW - 50, cursorY);
  ctx.stroke();

  cursorY += 55;

  const colGap = 40;
  const colWidth = (cardW - 100 - colGap) / 2;
  const col1X = padX;
  const col2X = padX + colWidth + colGap;

  fieldRow(ctx, "PEMBELI", data.buyerLabel || "-", col1X, cursorY, colWidth);
  fieldRow(ctx, "ORDER ID", data.orderId || "-", col2X, cursorY, colWidth);

  cursorY += 90;

  fieldRow(ctx, "METODE PEMBAYARAN", (data.paymentMethod || "-").toUpperCase(), col1X, cursorY, colWidth);
  fieldRow(
    ctx,
    "TOTAL",
    data.amount ? `Rp${new Intl.NumberFormat("id-ID").format(Number(data.amount) || 0)}` : "-",
    col2X,
    cursorY,
    colWidth,
  );

  cursorY += 90;

  ctx.font = "600 20px Arial";
  ctx.fillStyle = "#7d8bab";
  ctx.fillText(data.websiteName || "-", col1X, cursorY);
  if (data.timestamp) {
    const timeWidth = ctx.measureText(data.timestamp).width;
    ctx.fillText(data.timestamp, cardX + cardW - 50 - timeWidth, cursorY);
  }

  return canvas.toBuffer("image/png");
}

export { createPurchaseCard, resolveStatusStyle };
