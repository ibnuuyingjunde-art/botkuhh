import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";
import config from "../../config.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "cekidgc2",
  alias: ["idgc2", "groupinfo2", "infogc2"],
  category: "tools",
  description: "Cek ID dan info grup, ditampilkan sebagai kartu interaktif (A2UI)",
  usage: ".cekidgc2 [link grup]",
  example: ".cekidgc2 https://chat.whatsapp.com/xxxxx",
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

async function handler(m, { sock }) {
  const input = m.text?.trim();

  if (!input && !m.isGroup) {
    return m.reply(
      `📇 *ᴄᴇᴋɪᴅɢᴄ2*\n\n` +
        `> Cek info grup, ditampilkan sebagai kartu interaktif\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}cekidgc2* — dipakai di dalam grup\n` +
        `> *${m.prefix}cekidgc2 https://chat.whatsapp.com/xxxxx*`,
    );
  }

  await m.react("🕕");

  try {
    let groupJid = null;
    let groupMeta = null;
    let inviteLink = null;

    if (input && input.includes("chat.whatsapp.com/")) {
      const inviteCode = input.split("chat.whatsapp.com/")[1]?.split(/[\s?]/)[0];
      if (!inviteCode) {
        await m.react("✘");
        return m.reply(`❌ Link grup tidak valid.`);
      }
      try {
        groupMeta = await sock.groupGetInviteInfo(inviteCode);
        groupJid = groupMeta?.id;
        inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
      } catch {
        await m.react("✘");
        return m.reply(`❌ Link grup tidak valid atau sudah expired.`);
      }
    } else if (input && input.endsWith("@g.us")) {
      groupJid = input;
      try {
        groupMeta = await sock.groupMetadata(groupJid);
      } catch {
        await m.react("✘");
        return m.reply(`❌ Tidak bisa mengakses grup tersebut.`);
      }
    } else if (m.isGroup) {
      groupJid = m.chat;
      groupMeta = m.groupMetadata || (await sock.groupMetadata(groupJid));
      
      try {
        inviteLink = `https://chat.whatsapp.com/${await sock.groupInviteCode(groupJid)}`;
      } catch {
        
      }
    }

    if (!groupMeta || !groupJid) {
      await m.react("✘");
      return m.reply(`❌ Tidak dapat menemukan info grup.`);
    }

    const groupName = groupMeta.subject || "Unknown";
    const participants = groupMeta.participants || [];
    const memberCount = participants.length || groupMeta.size || 0;
    const adminCount = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin",
    ).length;
    const groupOwner = (groupMeta.owner || groupMeta.subjectOwner || "—").replace(/@.+/, "");
    const createdAt = formatDate(groupMeta.creation);
    const groupDesc = groupMeta.desc || "—";
    const descPreview = safeTruncate(groupDesc, 150);
    const isCommunity = groupMeta.isCommunity ? "Ya" : "Tidak";
    const isRestrict = groupMeta.restrict ? "Admin Only" : "Semua Member";
    const isAnnounce = groupMeta.announce ? "Aktif" : "Nonaktif";
    const joinMode = groupMeta.joinApprovalMode ? "Perlu Approval" : "Bebas";

    let imageUrl = DEFAULT_IMAGE_URL;
    try {
      const ppUrl = await sock.profilePictureUrl(groupJid, "image");
      if (ppUrl) imageUrl = ppUrl;
    } catch {
      
    }

    const infoText =
      `ID        : ${groupJid}\n` +
      `Member    : ${memberCount}\n` +
      `Admin     : ${adminCount}\n` +
      `Owner     : ${groupOwner || "—"}\n` +
      `Dibuat    : ${createdAt}\n` +
      `Komunitas : ${isCommunity}\n` +
      `Edit Info : ${isRestrict}\n` +
      `Announce  : ${isAnnounce}\n` +
      `Join Mode : ${joinMode}`;

    const descText = `Deskripsi:\n${descPreview}`;

    const ui = new A2UI();
    const image = ui.image(imageUrl, { variant: "header", fit: "contain" });
    const title = ui.text(groupName, { variant: "h1" });
    const textNode = ui.text(infoText, { variant: "body" });
    const descNode = ui.text(descText, { variant: "caption" });

    const rootChildren = [image, title, textNode, descNode];
    const nativeButtons = [
      { name: "cta_copy", params: { display_text: "Copy ID Grup", copy_code: groupJid } },
    ];

    if (inviteLink) {
      const buttonLabel = ui.text("Buka Grup");
      const button = ui.button(buttonLabel, {
        variant: "primary",
        action: { call: "openUrl", args: { url: inviteLink } },
      });
      rootChildren.push(button);
      nativeButtons.push({
        name: "cta_url",
        params: { display_text: "Buka Grup", url: inviteLink, merchant_url: inviteLink },
      });
    }

    const footerNode = ui.text(`${config.bot?.name || "lyniX's MD"}`, { variant: "caption" });
    rootChildren.push(footerNode);

    ui.root(rootChildren);

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      bodyText: groupName,
      footer: `${config.bot?.name || "lyniX's MD"}`,
      buttons: nativeButtons,
      quoted: m,
    });

    await m.react("✅");
  } catch (error) {
    console.error("[CekIdGc2] Error:", error.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };