import { saluranCtx } from "../../src/lib/ichigo-context.js";
import {
  getAutoReadMode,
  setAutoReadMode,
} from "../../src/lib/ichigo-autoread.js";

const pluginConfig = {
  name: "autoread",
  alias: ["readchat", "autobaca"],
  category: "owner",
  description: "Auto read pesan masuk (on/off/private/group)",
  usage: ".autoread on/off/private/group",
  example: ".autoread on",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const LABEL = {
  off: "Nonaktif ❌",
  all: "Aktif ✅ (semua chat)",
  private: "Aktif ✅ (private chat saja)",
  group: "Aktif ✅ (grup saja)",
};

async function handler(m) {
  const option = m.text?.toLowerCase()?.trim();

  if (!option) {
    const current = getAutoReadMode();
    return m.reply(
      `📖 *Auto Read*\n\n` +
        `> Status: *${LABEL[current]}*\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}autoread on* — Semua chat\n` +
        `> *${m.prefix}autoread private* — Private chat saja\n` +
        `> *${m.prefix}autoread group* — Grup saja\n` +
        `> *${m.prefix}autoread off* — Nonaktifkan\n\n` +
        `_Pesan dibaca langsung begitu masuk, sebelum diproses bot_`,
    );
  }

  const map = {
    on: "all",
    all: "all",
    private: "private",
    pc: "private",
    group: "group",
    gc: "group",
    off: "off",
  };
  const mode = map[option];

  if (!mode) {
    return m.reply(
      `❌ *Opsi Tidak Valid*\n\n> Gunakan *${m.prefix}autoread on/off/private/group*`,
    );
  }

  setAutoReadMode(mode);

  if (mode === "off") {
    return m.reply(
      `📖 *Auto Read Nonaktif*\n\n> Bot tidak akan otomatis membaca pesan`,
    );
  }

  return m.reply(
    `📖 *Auto Read Aktif*\n\n> Mode: *${LABEL[mode]}*`,
    { contextInfo: saluranCtx() },
  );
}

export { pluginConfig as config, handler };