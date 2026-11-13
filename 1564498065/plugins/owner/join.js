import config from "../../config.js";
import { saluranCtx } from "../../src/lib/ichigo-context.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "join",
  alias: ["joingrup", "joingroup", "gabung"],
  category: "owner",
  description: "Bot join ke grup via link invite, support reply pesan yang mengandung link",
  usage: ".join <link> / .join (reply pesan berisi link)",
  example: ".join https://chat.whatsapp.com/xxx",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function extractAllInviteCodes(text) {
  if (!text) return [];
  const codes = [];
  const seen = new Set();

  const patterns = [
    /chat\.whatsapp\.com\/([a-zA-Z0-9]{20,})/gi,
    /invite\.whatsapp\.com\/([a-zA-Z0-9]{20,})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const code = match[1];
      if (!seen.has(code)) {
        seen.add(code);
        codes.push(code);
      }
    }
  }

  return codes;
}

function getBotIdentities(sock) {
  const ids = new Set();
  const strip = (jid) => jid?.replace(/:.*?@/, "@").split("/")[0];

  if (sock.user?.id) {
    ids.add(strip(sock.user.id));
    ids.add(sock.user.id.split(":")[0]); 
  }
  if (sock.user?.lid) {
    ids.add(strip(sock.user.lid));
    ids.add(sock.user.lid.split(":")[0]);
  }

  return [...ids].filter(Boolean);
}

function isBotParticipant(participants, botIdentities) {
  if (!Array.isArray(participants) || participants.length === 0) return false;
  return participants.some((p) => {
    const pid = p.id || p.jid || "";
    const pNum = pid.split("@")[0].split(":")[0];
    return botIdentities.some((id) => pid === id || pNum === id.split("@")[0]);
  });
}

function parseJoinError(error) {
  const code = error?.output?.statusCode || error?.data?.attrs?.code;

  switch (Number(code)) {
    case 401:
      return "Link sudah tidak valid, expired, atau bot diblokir dari grup ini";
    case 404:
      return "Grup tidak ditemukan (link ngasal/sudah direvoke)";
    case 409:
      return "ALREADY_MEMBER"; 
    case 410:
      return "Link sudah kadaluarsa (grup mengganti link invite)";
    case 408:
      return "Request timeout, coba lagi";
    default:
      break;
  }

  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("not-authorized")) return "Link sudah tidak valid atau expired";
  if (msg.includes("gone") || msg.includes("item-not-found")) return "Grup tidak ditemukan (link ngasal/sudah direvoke)";
  if (msg.includes("conflict")) return "ALREADY_MEMBER";
  if (msg.includes("timed out") || msg.includes("timeout")) return "Request timeout, coba lagi";
  if (msg.includes("account_reachout_restricted")) return "RESTRICTED";
  if (msg.includes("forbidden")) return "Bot diblokir/dilarang join grup ini";

  return error?.message || "Link tidak valid atau bot dilarang join";
}

const RESTRICTED_MESSAGE =
  `🚫 *Akun Dibatasi WhatsApp*\n\n` +
  `> Nomor bot sedang kena *restriction* dari WhatsApp untuk join grup/kontak baru ` +
  `(error: \`account_reachout_restricted\`).\n\n` +
  `*Ini bukan masalah link atau kode bot* — ini pembatasan dari sisi WhatsApp sendiri, biasanya karena:\n` +
  `> • Nomor masih baru/belum lama dipakai\n` +
  `> • Pola aktivitas mencurigakan (join banyak grup cepat, dsb)\n` +
  `> • Nomor sedang dalam status limited\n\n` +
  `*Saran:* hentikan dulu aktivitas join grup beberapa jam–hari sampai restriction hilang sendiri. ` +
  `Coba lagi nanti.`;

async function joinGroup(sock, inviteCode) {
  const botIdentities = getBotIdentities(sock);

  let preInfo = null;
  try {
    preInfo = await sock.groupGetInviteInfo(inviteCode);
    if (preInfo && isBotParticipant(preInfo.participants, botIdentities)) {
      return {
        success: false,
        alreadyMember: true,
        subject: preInfo.subject || "Unknown",
      };
    }
  } catch (_) {
    
  }

  try {
    const groupId = await sock.groupAcceptInvite(inviteCode);

    let subject = preInfo?.subject;
    let members = preInfo?.size || preInfo?.participants?.length;
    let owner = preInfo?.owner?.split("@")[0];

    if (!subject && groupId) {
      try {
        const meta = await sock.groupMetadata(groupId);
        subject = meta?.subject;
        members = meta?.participants?.length;
        owner = meta?.owner?.split("@")[0] || meta?.subjectOwner?.split("@")[0];
      } catch (_) {
        
      }
    }

    return {
      success: true,
      subject: subject || "Unknown",
      members: members ?? "?",
      owner: owner || "Unknown",
    };
  } catch (error) {
    const parsed = parseJoinError(error);
    if (parsed === "ALREADY_MEMBER") {
      return {
        success: false,
        alreadyMember: true,
        subject: preInfo?.subject || "Unknown",
      };
    }
    if (parsed === "RESTRICTED") {
      return { success: false, restricted: true, error: "Akun dibatasi WhatsApp (account_reachout_restricted)" };
    }
    return { success: false, error: parsed };
  }
}

async function handler(m, { sock }) {
  const input = (m.args || []).join(" ").trim();
  let sourceText = input;

  if (!input && m.quoted) {
    sourceText = m.quoted.body || m.quoted.text || m.quoted.contentText || "";
  }

  if (!sourceText) {
    return m.reply(
      `🔗 *Join Grup*\n\n` +
        `Bot akan join ke grup berdasarkan link invite yang kamu berikan.\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}join <link>* — Join via link langsung\n` +
        `> *${m.prefix}join* (reply pesan) — Join dari link di pesan yang di-reply\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}join https://chat.whatsapp.com/xxx*\n` +
        `> Reply pesan berisi link lalu ketik *${m.prefix}join*\n\n` +
        `_Bot akan mendeteksi semua link grup di pesan dan join satu per satu_`
    );
  }

  const inviteCodes = extractAllInviteCodes(sourceText);

  if (inviteCodes.length === 0) {
    return m.reply(
      `❌ *Tidak Ada Link Grup*\n\n` +
        `> Bot tidak menemukan link invite grup di pesan tersebut.\n\n` +
        `*Format link yang didukung:*\n` +
        `> *https://chat.whatsapp.com/xxx*\n` +
        `> *https://invite.whatsapp.com/xxx*`
    );
  }

  m.react("🕕");

  if (inviteCodes.length === 1) {
    const result = await joinGroup(sock, inviteCodes[0]);

    if (result.alreadyMember) {
      m.react("❌");
      return m.reply(
        `❌ *Sudah Menjadi Member*\n\n> Bot sudah join di grup *${result.subject}*`
      );
    }

    if (!result.success) {
      m.react("❌");
      if (result.restricted) return m.reply(RESTRICTED_MESSAGE);
      return m.reply(`❌ *Gagal Join*\n\n> ${result.error}`);
    }

    m.react("✅");
    const ctx = saluranCtx();
    return m.reply(
      `✅ *Berhasil Join!*\n\n` +
        `> 🏠 Nama: *${result.subject}*\n` +
        `> 👥 Member: *${result.members}*\n` +
        `> 👤 Owner: *${result.owner}*`,
      { contextInfo: ctx }
    );
  }

  let resultText =
    `🔗 *Multi Join — ${inviteCodes.length} Link Terdeteksi*\n\n` +
    `Bot akan join ke semua grup satu per satu.\n\n`;

  let successCount = 0;
  let alreadyCount = 0;
  let failedCount = 0;
  let stoppedByRestriction = false;

  for (let i = 0; i < inviteCodes.length; i++) {
    const result = await joinGroup(sock, inviteCodes[i]);

    if (result.restricted) {
      resultText += `*${i + 1}.* ${inviteCodes[i].substring(0, 12)}... — 🚫 Akun dibatasi WhatsApp\n`;
      stoppedByRestriction = true;
      break; 
    }

    if (result.alreadyMember) {
      alreadyCount++;
      resultText += `*${i + 1}.* ${result.subject} — ⚠️ Sudah member\n`;
    } else if (result.success) {
      successCount++;
      resultText += `*${i + 1}.* ${result.subject} — ✅ Berhasil join\n`;
    } else {
      failedCount++;
      resultText += `*${i + 1}.* ${inviteCodes[i].substring(0, 12)}... — ❌ ${result.error}\n`;
    }

    if (i < inviteCodes.length - 1) {
      
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  if (stoppedByRestriction) {
    resultText += `\n${RESTRICTED_MESSAGE}`;
  }

  resultText +=
    `\n\n*Hasil:*\n` +
    `> ✅ Berhasil: *${successCount}*\n` +
    `> ⚠️ Sudah member: *${alreadyCount}*\n` +
    `> ❌ Gagal: *${failedCount}*\n` +
    `> 📊 Total diproses: *${successCount + alreadyCount + failedCount}/${inviteCodes.length}*`;

  m.react(successCount > 0 ? "✅" : "❌");
  return m.reply(resultText);
}

export { pluginConfig as config, handler };