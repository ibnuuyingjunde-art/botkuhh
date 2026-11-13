import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "cekidch2",
  alias: ["idch2", "channelinfo2", "infoch2"],
  category: "tools",
  description: "Cek ID dan info channel dari link, ditampilkan sebagai kartu interaktif (A2UI)",
  usage: ".cekidch2 <link channel>",
  example: ".cekidch2 https://whatsapp.com/channel/xxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const DEFAULT_IMAGE_URL = "https://athars.space/uploads/de11c461.jpg";

function safeTruncate(str, maxLen) {
  const chars = Array.from(str);
  if (chars.length <= maxLen) return str;
  return chars.slice(0, maxLen).join("") + "...";
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(
    typeof timestamp === "number" && timestamp < 1e12 ? timestamp * 1000 : timestamp,
  );
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSubs(count) {
  if (!count || count === 0) return "0";
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(count);
}

async function handler(m, { sock }) {
  const text = m.text?.trim();

  if (!text) {
    return m.reply(
      `📇 *ᴄᴇᴋɪᴅᴄʜ2*\n\n` +
        `> Cek info channel WhatsApp, ditampilkan sebagai kartu interaktif\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}cekidch2 https://whatsapp.com/channel/xxxxx*`,
    );
  }

  if (!text.includes("https://whatsapp.com/channel/")) {
    return m.reply(`❌ Link channel tidak valid.`);
  }

  await m.react("🕕");

  try {
    const metadata = await sock.cekIDSaluran(text);

    if (!metadata?.id) {
      await m.react("✘");
      return m.reply(`❌ Channel tidak ditemukan.`);
    }

    const chName = metadata.name || "Unknown";
    const chId = metadata.id;
    const chSubs = metadata.subscribers ?? metadata.subscribers_count ?? 0;
    const chDesc = metadata.description || "—";
    const chVerified = metadata.verification === "VERIFIED" ? "Verified" : "Unverified";
    const chCreated = formatDate(metadata.creation_time);
    const chPicUrl =
      metadata.preview === "https://mmg.whatsapp.net"
        ? DEFAULT_IMAGE_URL
        : metadata.preview || DEFAULT_IMAGE_URL;
    const descPreview = safeTruncate(chDesc, 150);

    const infoText =
      `ID         : ${chId}\n` +
      `Subscriber : ${formatSubs(chSubs)}\n` +
      `Status     : ${chVerified}\n` +
      `Dibuat     : ${chCreated}`;

    const descText = `Deskripsi:\n${descPreview}`;

    const ui = new A2UI();
    const image = ui.image(chPicUrl, { variant: "header", fit: "contain" });
    const title = ui.text(chName, { variant: "h1" });
    const textNode = ui.text(infoText, { variant: "body" });
    const descNode = ui.text(descText, { variant: "caption" });
    const buttonLabel = ui.text("Buka Channel");
    const button = ui.button(buttonLabel, {
      variant: "primary",
      action: { call: "openUrl", args: { url: text } },
    });
    const footerNode = ui.text(`${config.bot?.name || "lyniX's MD"}`, { variant: "caption" });

    ui.root([image, title, textNode, descNode, button, footerNode]);

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      bodyText: chName,
      footer: `${config.bot?.name || "lyniX's MD"}`,
      buttons: [
        { name: "cta_copy", params: { display_text: "Copy ID Channel", copy_code: chId } },
        { name: "cta_url", params: { display_text: "Buka Channel", url: text, merchant_url: text } },
      ],
      quoted: m,
    });

    await m.react("✅");
  } catch (error) {
    console.error("[CekIdCh2] Error:", error.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };