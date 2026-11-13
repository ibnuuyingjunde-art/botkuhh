import { attachAntiBug } from '../../src/lib/core/attachAntiBug.js';

const pluginConfig = {
  name: "antibug",
  alias: ["anchorguard"],
  category: "owner",
  description: "Mengatur sistem perlindungan anti-bug (AnchorGuard)",
  usage: ".antibug <on/off/outgoing/block/notif/delete>",
  example: ".antibug on",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock, args, prefix, command }) {
  const conn = sock || m.conn;
  const who = conn.user.jid;

  // Pastikan database dan struktur settings aman dari undefined
  global.db = global.db || { data: {} };
  global.db.data = global.db.data || {};
  global.db.data.settings = global.db.data.settings || {};
  global.db.data.settings[who] = global.db.data.settings[who] || {};
  
  const settings = global.db.data.settings[who];
  settings.antibug = { ...global.antibug, ...(settings.antibug || {}) };
  const cfg = settings.antibug;

  const sub = (args[0] || '').toLowerCase();
  const val = (args[1] || '').toLowerCase();

  const statusText = () =>
    [
      '🛡️ *Status Lynna AnchorGuard*',
      '',
      `Aktif          : ${cfg.enabled ? 'ON ✅' : 'OFF ❌'}`,
      `Jaga keluar    : ${cfg.guardOutgoing ? 'ON ✅' : 'OFF ❌'}`,
      `Mode hapus     : ${cfg.deleteMode}`,
      `Block pengirim : ${cfg.blockOnBug ? 'ON ✅' : 'OFF ❌'}`,
      `Notif ke owner : ${cfg.notifyOwner ? 'ON ✅' : 'OFF ❌'}`,
      '',
      `Gunakan:\n${prefix + command} on/off\n${prefix + command} outgoing on/off\n${prefix + command} block on/off\n${prefix + command} notif on/off\n${prefix + command} delete auto/everyone/me`,
    ].join('\n');

  if (!sub || sub === 'status') {
    return conn.reply(m.chat, statusText(), m);
  }

  if (sub === 'on' || sub === 'off') {
    cfg.enabled = sub === 'on';
    attachAntiBug(conn);
    return conn.reply(m.chat, `Lynna AnchorGuard sekarang: ${cfg.enabled ? 'ON ✅' : 'OFF ❌'}`, m);
  }

  if (sub === 'outgoing' && (val === 'on' || val === 'off')) {
    cfg.guardOutgoing = val === 'on';
    attachAntiBug(conn);
    return conn.reply(
      m.chat,
      `Jaga pesan keluar sekarang: ${cfg.guardOutgoing ? 'ON ✅' : 'OFF ❌'}${
        cfg.guardOutgoing ? '\n⚠️ Kalau ada fitur (quotedfake/quotedOrder/dll) tiba-tiba error, coba matiin lagi ini.' : ''
      }`,
      m
    );
  }

  if (sub === 'block' && (val === 'on' || val === 'off')) {
    cfg.blockOnBug = val === 'on';
    attachAntiBug(conn);
    return conn.reply(m.chat, `Auto-block pengirim bug sekarang: ${cfg.blockOnBug ? 'ON ✅' : 'OFF ❌'}`, m);
  }

  if (sub === 'notif' && (val === 'on' || val === 'off')) {
    cfg.notifyOwner = val === 'on';
    return conn.reply(m.chat, `Notif ke owner sekarang: ${cfg.notifyOwner ? 'ON ✅' : 'OFF ❌'}`, m);
  }

  if (sub === 'delete' && ['auto', 'everyone', 'me'].includes(val)) {
    cfg.deleteMode = val;
    attachAntiBug(conn);
    return conn.reply(m.chat, `Mode hapus pesan diganti ke: ${val}`, m);
  }

  return conn.reply(m.chat, statusText(), m);
}

export { pluginConfig as config, handler };