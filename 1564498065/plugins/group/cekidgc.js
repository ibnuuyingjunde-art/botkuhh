import { sharp } from "../../src/lib/ichigo-lazy.js";
import config from "../../config.js";
import axios from "axios";
import { generateWAMessageFromContent, proto, prepareWAMessageMedia } from "ichigo";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "cekidgc",
  alias: ["idgc", "idgrup", "groupid", "infogc", "groupinfo"],
  category: "group",
  description: "Cek ID dan info lengkap grup",
  usage: ".cekidgc [link grup]",
  example: ".cekidgc https://chat.whatsapp.com/xxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(
    typeof timestamp === "number" && timestamp < 1e12
      ? timestamp * 1000
      : timestamp,
  );
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildVcard(jid, name) {
  const number = String(jid || "").split("@")[0];
  const displayName = name || number || "Unknown";
  return (
    `BEGIN:VCARD\n` +
    `VERSION:3.0\n` +
    `N:;${displayName};;;\n` +
    `FN:${displayName}\n` +
    `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
    `END:VCARD`
  );
}

// ── Resolve JID @lid (privacy id acak) ke JID nomor asli @s.whatsapp.net ──
// JID @lid BUKAN nomor HP — kalau langsung dipakai jadi TEL di vCard,
// hasilnya nomor acak ("togel"). Harus di-resolve dulu ke nomor asli.
async function resolvePhoneJid(sock, participant) {
  const rawId =
    (typeof participant === "string" ? participant : participant?.id) || "";

  // Baileys versi baru kadang sudah menyertakan phoneNumber langsung
  if (participant && typeof participant === "object" && participant.phoneNumber) {
    return participant.phoneNumber;
  }

  if (!rawId) return rawId;
  if (!rawId.endsWith("@lid")) return rawId;

  // Coba lewat lid-mapping store bawaan Baileys
  try {
    const mapped = await sock?.signalRepository?.lidMapping?.getPNForLID?.(rawId);
    if (mapped) return mapped;
  } catch {}

  // Fallback: query langsung ke WhatsApp
  try {
    const [result] = (await sock.onWhatsApp(rawId)) || [];
    if (result?.jid) return result.jid;
  } catch {}

  // Tidak berhasil di-resolve, kembalikan apa adanya (lebih baik daripada gagal total)
  return rawId;
}

async function handler(m, { sock }) {
  await m.react("⏳");

  try {
    const rawInput = m.text?.trim() || "";

    // ── Deteksi aksi dari single_select (format: "aksi|targetGroupJid") ──
    let actionType = null;
    let input = rawInput;
    if (rawInput.includes("|")) {
      const [act, target] = rawInput.split("|");
      actionType = act?.trim() || null;
      input = target?.trim() || "";
    }

    let groupJid = null;
    let groupMeta = null;
    let groupLink = null;

    if (input && input.includes("chat.whatsapp.com/")) {
      const inviteCode = input
        .split("chat.whatsapp.com/")[1]
        ?.split(/[\s?]/)[0];

      if (!inviteCode) {
        m.react("✘");
        return m.reply(`── .✦ ──\n\n> Link grup tidak valid .☘︎ ݁˖`);
      }

      try {
        groupMeta = await sock.groupGetInviteInfo(inviteCode);
        groupJid = groupMeta?.id;
        groupLink = `https://chat.whatsapp.com/${inviteCode}`;
      } catch {
        m.react("✘");
        return m.reply(
          `── .✦ ──\n\n> Link grup tidak valid atau sudah expired .☘︎ ݁˖`,
        );
      }
    } else if (input && input.endsWith("@g.us")) {
      groupJid = input;
      try {
        groupMeta = await sock.groupMetadata(groupJid);
      } catch {
        m.react("✘");
        return m.reply(
          `── .✦ ──\n\n> Tidak bisa mengakses grup tersebut .☘︎ ݁˖`,
        );
      }
    } else if (m.isGroup) {
      groupJid = m.chat;
      groupMeta = await sock.groupMetadata(groupJid);
    } else {
      return m.reply(
        `── .✦ 𝗖𝗘𝗞 𝗜𝗗 𝗚𝗥𝗨𝗣 ✦. ── 𝜗ৎ\n\n` +
          `> Gunakan di grup atau masukkan link grup\n\n` +
          `> \`${m.prefix}cekidgc\` — di dalam grup\n` +
          `> \`${m.prefix}cekidgc https://chat.whatsapp.com/xxx\``,
      );
    }

    if (!groupMeta || !groupJid) {
      m.react("✘");
      return m.reply(`── .✦ ──\n\n> Tidak dapat menemukan info grup .☘︎ ݁˖`);
    }

    // kalau belum punya link grup, coba ambil (butuh bot jadi admin)
    if (!groupLink) {
      try {
        const inviteCode = await sock.groupInviteCode(groupJid);
        if (inviteCode) groupLink = `https://chat.whatsapp.com/${inviteCode}`;
      } catch {}
    }

    const groupName = groupMeta.subject || "Unknown";
    const participants = groupMeta.participants || [];
    const memberCount = participants.length || groupMeta.size || 0;
    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin",
    );
    const adminCount = admins.length;
    const groupOwner = groupMeta.owner || groupMeta.subjectOwner || "—";
    const createdAt = formatDate(groupMeta.creation);
    const groupDesc = groupMeta.desc || "—";

    // ── Eksekusi aksi single_select (kontak, id, tanggal) ──
    if (actionType) {
      switch (actionType) {
        case "kontakmember": {
          if (!participants.length) {
            m.react("✘");
            return m.reply(`── .✦ ──\n\n> Tidak ada member ditemukan .☘︎ ݁˖`);
          }
          const targets = participants.slice(0, 100);
          const resolvedTargets = await Promise.all(
            targets.map((p) => resolvePhoneJid(sock, p)),
          );
          await sock.sendMessage(
            m.chat,
            {
              contacts: {
                displayName: `${targets.length} Kontak Member`,
                contacts: resolvedTargets.map((jid) => ({ vcard: buildVcard(jid) })),
              },
            },
            { quoted: m },
          );
          if (participants.length > 100) {
            await m.reply(
              `── .✦ ──\n\n> Menampilkan 100 dari ${participants.length} member (batas kirim kontak) .☘︎ ݁˖`,
            );
          }
          return m.react("✓");
        }

        case "kontakadmin": {
          if (!admins.length) {
            m.react("✘");
            return m.reply(`── .✦ ──\n\n> Grup ini tidak memiliki admin .☘︎ ݁˖`);
          }
          const resolvedAdmins = await Promise.all(
            admins.map((p) => resolvePhoneJid(sock, p)),
          );
          await sock.sendMessage(
            m.chat,
            {
              contacts: {
                displayName: `${admins.length} Kontak Admin`,
                contacts: resolvedAdmins.map((jid) => ({ vcard: buildVcard(jid) })),
              },
            },
            { quoted: m },
          );
          return m.react("✓");
        }

        case "kontakowner": {
          if (!groupOwner || groupOwner === "—") {
            m.react("✘");
            return m.reply(`── .✦ ──\n\n> ID owner grup tidak diketahui .☘︎ ݁˖`);
          }
          const resolvedOwner = await resolvePhoneJid(sock, groupOwner);
          await sock.sendMessage(
            m.chat,
            {
              contacts: {
                displayName: "Owner Grup",
                contacts: [{ vcard: buildVcard(resolvedOwner) }],
              },
            },
            { quoted: m },
          );
          return m.react("✓");
        }

        case "tglbuat": {
          m.react("✓");
          return m.reply(
            `── .✦ 𝗧𝗔𝗡𝗚𝗚𝗔𝗟 𝗗𝗜𝗕𝗨𝗔𝗧 ✦. ── 𝜗ৎ\n\n` +
              `> Grup *${groupName}* dibuat pada:\n> *${createdAt}*\n\n.☘︎ ݁˖`,
          );
        }

        case "ownerid": {
          const resolved = await resolvePhoneJid(sock, groupOwner);
          const extra =
            resolved !== groupOwner ? `\n> ✦ ɴᴏᴍᴏʀ ᴀsʟɪ  : \`${resolved}\`` : "";
          m.react("✓");
          return m.reply(
            `── .✦ 𝗢𝗪𝗡𝗘𝗥 𝗜𝗗 ✦. ── 𝜗ৎ\n\n> ✦ ɪᴅ ɢʀᴜᴘ    : \`${groupOwner}\`${extra}\n\n.☘︎ ݁˖`,
          );
        }

        case "adminid": {
          if (!admins.length) {
            m.react("✘");
            return m.reply(`── .✦ ──\n\n> Grup ini tidak memiliki admin .☘︎ ݁˖`);
          }
          const resolvedIds = await Promise.all(
            admins.map((p) => resolvePhoneJid(sock, p)),
          );
          const idList = admins
            .map((p, i) => {
              const resolved = resolvedIds[i];
              const extra = resolved !== p.id ? ` — nomor: \`${resolved}\`` : "";
              return `> ${i + 1}. \`${p.id}\`${extra}`;
            })
            .join("\n");
          m.react("✓");
          return m.reply(
            `── .✦ 𝗔𝗗𝗠𝗜𝗡 𝗜𝗗 ✦. ── 𝜗ৎ\n\n${idList}\n\n.☘︎ ݁˖`,
          );
        }

        case "listmember": {
          if (!participants.length) {
            m.react("✘");
            return m.reply(`── .✦ ──\n\n> Tidak ada member ditemukan .☘︎ ݁˖`);
          }
          const shown = participants.slice(0, 50);
          const resolvedShown = await Promise.all(
            shown.map((p) => resolvePhoneJid(sock, p)),
          );
          const list = shown
            .map((p, i) => {
              const tag =
                p.admin === "superadmin"
                  ? " (Owner/SuperAdmin)"
                  : p.admin === "admin"
                    ? " (Admin)"
                    : "";
              return `> ${i + 1}. \`${resolvedShown[i]}\`${tag}`;
            })
            .join("\n");
          const more =
            participants.length > 50
              ? `\n\n> +${participants.length - 50} member lainnya tidak ditampilkan .☘︎ ݁˖`
              : "";
          m.react("✓");
          return m.reply(
            `── .✦ 𝗗𝗔𝗙𝗧𝗔𝗥 𝗠𝗘𝗠𝗕𝗘𝗥 ✦. ── 𝜗ৎ\n\n${list}${more}`,
          );
        }

        case "cekdesc": {
          m.react("✓");
          return m.reply(
            `── .✦ 𝗗𝗘𝗦𝗞𝗥𝗜𝗣𝗦𝗜 𝗚𝗥𝗨𝗣 ✦. ── 𝜗ৎ\n\n${groupDesc}\n\n.☘︎ ݁˖`,
          );
        }

        default:
          break; // aksi tidak dikenal, lanjut tampilkan info grup normal
      }
    }

    const descPreview =
      groupDesc.length > 120 ? groupDesc.slice(0, 120) + "..." : groupDesc;
    const isRestrict = groupMeta.restrict ? "Admin Only" : "Semua Member";
    const isAnnounce = groupMeta.announce ? "Aktif" : "Nonaktif";
    const isCommunity = groupMeta.isCommunity ? "✓ Ya" : "✘ Tidak";
    const joinMode = groupMeta.joinApprovalMode ? "Perlu Approval" : "Bebas";

    let ppBuffer = null;
    try {
      const ppUrl = await sock.profilePictureUrl(groupJid, "image");
      if (ppUrl) {
        ppBuffer = Buffer.from(
          (
            await axios.get(ppUrl, {
              responseType: "arraybuffer",
              timeout: 10000,
            })
          ).data,
        );
      }
    } catch {}

    const saluranId = config.saluran?.id || "120363409557700746@newsletter";
    const saluranName = config.saluran?.name || config.bot?.name || "lyniX's MD";

    const infoText =
      `── .✦ 𝗚𝗥𝗢𝗨𝗣 𝗜𝗡𝗙𝗢 ✦. ── 𝜗ৎ\n\n` +
      `╭─〔 ${groupName} 〕───⬣\n` +
      `│  ✦ ɴᴀᴍᴀ        : *${groupName}*\n` +
      `│  ✦ ɪᴅ             : \`${groupJid}\`\n` +
      `│  ✦ ᴍᴇᴍʙᴇʀ     : *${memberCount}*\n` +
      `│  ✦ ᴀᴅᴍɪɴ        : *${adminCount}*\n` +
      `│  ✦ ᴏᴡɴᴇʀ       : @${groupOwner.replace(/@.+/g, "")}\n` +
      `│  ✦ ᴅɪʙᴜᴀᴛ       : *${createdAt}*\n` +
      `│  ✦ ᴋᴏᴍᴜɴᴀᴛs : *${isCommunity}*\n` +
      `│  ✦ ᴇᴅɪᴛ ɪɴꜰᴏ   : *${isRestrict}*\n` +
      `│  ✦ ᴀɴɴᴏᴜɴᴄᴇ : *${isAnnounce}*\n` +
      `│  ✦ ᴊᴏɪɴ ᴍᴏᴅᴇ  : *${joinMode}*\n` +
      `│  ✦ ᴅᴇsᴋʀɪᴘsɪ  : ${descPreview}\n` +
      `╰──────────────⬣\n\n` +
      `.☘︎ ݁˖ © ${config.bot?.name || "lyniX's MD"}`;

    // ── Buttons ──
    const buttons = [
      {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Copy Nama Grup",
          id: "copy_nama",
          copy_code: groupName,
        }),
      },
      {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Copy ID Grup",
          id: "copy_id",
          copy_code: groupJid,
        }),
      },
      {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Copy Deskripsi",
          id: "copy_desc",
          copy_code: groupDesc,
        }),
      },
    ];

    if (groupLink) {
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🔗 Buka Grup",
          url: groupLink,
          merchant_url: groupLink,
        }),
      });
      buttons.push({
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Copy Link Grup",
          id: "copy_link",
          copy_code: groupLink,
        }),
      });
    }

    buttons.push({
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "☰ Menu Lainnya",
        sections: [
          {
            title: "Informasi Grup",
            highlight_label: "",
            rows: [
              {
                header: "",
                title: "👑 Daftar Admin",
                description: `Lihat ${adminCount} admin grup ini`,
                id: `${m.prefix}listadmin ${groupJid}`,
              },
              {
                header: "",
                title: "👥 Daftar Member",
                description: `Lihat ${memberCount} member grup ini`,
                id: `${m.prefix}cekidgc listmember|${groupJid}`,
              },
              {
                header: "",
                title: "📜 Deskripsi Lengkap",
                description: "Tampilkan deskripsi grup secara penuh",
                id: `${m.prefix}cekidgc cekdesc|${groupJid}`,
              },
              {
                header: "",
                title: "📇 Kontak Member",
                description: `Kirim kontak ${memberCount} member ke chat`,
                id: `${m.prefix}cekidgc kontakmember|${groupJid}`,
              },
              {
                header: "",
                title: "📇 Kontak Admin",
                description: `Kirim kontak ${adminCount} admin ke chat`,
                id: `${m.prefix}cekidgc kontakadmin|${groupJid}`,
              },
              {
                header: "",
                title: "📇 Kirim Kontak Owner Grup",
                description: "Kirim kontak owner grup sebagai vCard",
                id: `${m.prefix}cekidgc kontakowner|${groupJid}`,
              },
              {
                header: "",
                title: "🗓️ Tanggal Dibuat",
                description: "Lihat kapan grup ini dibuat",
                id: `${m.prefix}cekidgc tglbuat|${groupJid}`,
              },
              {
                header: "",
                title: "🆔 Owner ID",
                description: "Lihat ID lengkap owner grup",
                id: `${m.prefix}cekidgc ownerid|${groupJid}`,
              },
              {
                header: "",
                title: "🆔 Admin ID",
                description: "Lihat ID lengkap semua admin",
                id: `${m.prefix}cekidgc adminid|${groupJid}`,
              },
              {
                header: "",
                title: "🔄 Refresh Info",
                description: "Ambil ulang info grup terbaru",
                id: `${m.prefix}cekidgc ${groupJid}`,
              },
            ],
          },
        ],
      }),
    });

    // ── Header media (foto profil grup, kalau ada) ──
    let headerMedia = null;
    if (ppBuffer) {
      try {
        const resized = await sharp(ppBuffer)
          .resize(300, 300, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toBuffer();
        headerMedia = await prepareWAMessageMedia(
          { image: resized },
          { upload: sock.waUploadToServer },
        );
      } catch {}
    }

    const msg = generateWAMessageFromContent(
      m.chat,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body: proto.Message.InteractiveMessage.Body.fromObject({
                text: infoText,
              }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({
                text: `© ${config.bot?.name || "lyniX's MD"}`,
              }),
              ...(headerMedia
                ? {
                    header: proto.Message.InteractiveMessage.Header.fromObject({
                      hasMediaAttachment: true,
                      ...headerMedia,
                    }),
                  }
                : {}),
              nativeFlowMessage:
                proto.Message.InteractiveMessage.NativeFlowMessage.fromObject(
                  { buttons },
                ),
              contextInfo: {
                mentionedJid: [m.sender, groupOwner],
                forwardingScore: 9999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                  newsletterJid: saluranId,
                  newsletterName: saluranName,
                  serverMessageId: 127,
                },
              },
            }),
          },
        },
      },
      { userJid: m.sender, quoted: m },
    );

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
    await m.react("✓");
  } catch (error) {
    console.error("[CekIdGc] Error:", error.message);
    await m.react("✘");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };