import te from "../../src/lib/ichigo-error.js";
import { resolveGroupId } from "../../src/lib/ichigo-sewa.js";
import {
  removePremiumGroup,
  listPremiumGroups,
  normalizeGroupId,
} from "../../src/lib/ichigo-premium-group.js";

const pluginConfig = {
  name: "delgcprem",
  alias: ["delpremgc", "hapusgcprem", "removegcprem"],
  category: "owner",
  description: "Hapus premium dari grup",
  usage: ".delgcprem <link/id grup/nomor list>\n.delgcprem (di dalam grup)",
  example: ".delgcprem 120363408577012139",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const input = (m.args?.[0] || "").trim();

  let groupId = null;

  try {
    if (!input) {
      if (!m.isGroup) {
        return m.reply(
          `💎 *HAPUS PREMIUM GRUP*\n\n` +
            `Dari private: *${m.prefix}delgcprem <link/id/nomor>*\n` +
            `Dari grup: ketik *${m.prefix}delgcprem* langsung di grup\n\n` +
            `Contoh:\n` +
            `• ${m.prefix}delgcprem 2 _(nomor dari ${m.prefix}listgcprem)_\n` +
            `• ${m.prefix}delgcprem 120363xxx\n` +
            `• ${m.prefix}delgcprem https://chat.whatsapp.com/xxx`,
        );
      }
      groupId = m.chat;
    } else if (/^\d{1,4}$/.test(input)) {
      // nomor urut dari .listgcprem
      const list = listPremiumGroups();
      const idx = parseInt(input, 10) - 1;
      if (!list[idx]) {
        return m.reply(
          `❌ Nomor *${input}* tidak ada di daftar\n\nLihat daftar: *${m.prefix}listgcprem*`,
        );
      }
      groupId = list[idx].id;
    } else if (input.includes("chat.whatsapp.com/")) {
      const resolved = await resolveGroupId(sock, input);
      if (!resolved) return m.reply(`❌ Link tidak valid atau grup tidak ditemukan`);
      groupId = resolved.id;
    } else {
      groupId = normalizeGroupId(input);
    }

    const removed = removePremiumGroup(groupId);
    if (!removed) {
      return m.reply(
        `❌ Grup tidak terdaftar sebagai premium\n\nLihat daftar: *${m.prefix}listgcprem*`,
      );
    }

    await m.react("✅");
    await m.reply(
      `✅ *PREMIUM GRUP DIHAPUS*\n\nGrup: *${removed.name || "Unknown"}*\nID: ${groupId.split("@")[0]}`,
    );

    if (m.chat !== groupId) {
      try {
        await sock.sendMessage(groupId, {
          text: `⛔ Status premium grup ini telah dicabut oleh owner.`,
        });
      } catch {}
    }
  } catch (error) {
    await m.react("☢");
    console.error("[delgcprem] Error:", error.message);
    await m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };