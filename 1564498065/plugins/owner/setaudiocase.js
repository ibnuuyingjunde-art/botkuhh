import fs from "fs";
import { loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";
import config from "../../config.js";

const pluginConfig = {
  name: "setaudiocase",
  alias: ["audiocase", "setaudiomenu", "audiomenustyle"],
  category: "owner",
  description: "Mengatur gaya pengiriman audio saat menu dibuka",
  usage: ".setaudiocase <c1-c7> [nama|nomor untuk c5, nama|jid untuk c7, atau reply kartu kontak/pesan saluran]",
  example: ".setaudiocase c5 (reply kartu kontak) / .setaudiocase c7 Nama Saluran",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const CASES = {
  c1: {
    id: 1,
    name: "Voice Note Order",
    desc: "PTT di-quote ke pesan asli user. Kalau proses convert gagal, otomatis fallback jadi audio biasa.",
    emoji: "🎙️",
  },
  c2: {
    id: 2,
    name: "Poll Quoted",
    desc: "Audio dikirim dengan quote ke pesan polling palsu berisi nama bot.",
    emoji: "📊",
  },
  c3: {
    id: 3,
    name: "Text Quoted",
    desc: "Audio biasa (bukan voice note) dikirim dengan quote ke pesan teks \"setelin musiknya nya bang\".",
    emoji: "💬",
  },
  c4: {
    id: 4,
    name: "Voice Note Biasa",
    desc: "PTT di-quote langsung ke command menu, polos tanpa efek tambahan.",
    emoji: "🎵",
  },
  c5: {
    id: 5,
    name: "Fake Kontak",
    desc: "PTT dikirim dengan quote ke kartu kontak custom (nama & nomor bisa diatur sendiri).",
    emoji: "👤",
  },
  c6: {
    id: 6,
    name: "VN Cepat + Fake Kontak",
    desc: "PTT dikirim langsung dari buffer audio tanpa convert ffmpeg (lebih cepat), quoted ke kartu kontak custom pakai identitas yang sama kayak C5.",
    emoji: "⚡",
  },
  c7: {
    id: 7,
    name: "Fake Channel",
    desc: "PTT dikirim dengan efek \"Forwarded\" dari saluran (channel) custom — nama saluran bisa diatur sendiri.",
    emoji: "📡",
  },
};

function extractQuotedNewsletterInfo(quoted) {
  const msg = quoted?.message;
  if (!msg) return null;
  for (const key of Object.keys(msg)) {
    const content = msg[key];
    const info = content?.contextInfo?.forwardedNewsletterMessageInfo;
    if (info?.newsletterName) {
      return {
        newsletterName: info.newsletterName,
        newsletterJid: info.newsletterJid || "",
      };
    }
  }
  return null;
}

async function handler(m, { sock, db }) {
  const args = m.args || [];
  const pilihan = args[0]?.toLowerCase();

  if (pilihan) {
    const selected = CASES[pilihan];
    if (!selected) {
      await m.reply(
        `❌ *GAYA AUDIO TIDAK VALID*\n\n` +
        `Gunakan: *c1* s/d *c7*\n\n` +
        `Ketik *.setaudiocase* tanpa argumen untuk lihat daftar lengkap.`
      );
      return;
    }

    let fakeInfoMsg = "";
    if (selected.id === 5) {
      let namaBagian = "";
      let nomorBersih = "";
      let sumber = "";

      const isQuotedContact =
        m.quoted?.type === "contactMessage" ||
        m.quoted?.type === "contactsArrayMessage";

      if (isQuotedContact) {
        const contactMsg = m.quoted.message?.contactMessage;
        const contactsArr = m.quoted.message?.contactsArrayMessage?.contacts;
        const vcard = contactMsg?.vcard || contactsArr?.[0]?.vcard || "";

        const fnMatch = vcard.match(/FN:(.+)/i);
        const waidMatch = vcard.match(/waid=(\d+)/i);
        const telMatch = vcard.match(/TEL[^:]*:\+?(\d+)/i);

        namaBagian = (contactMsg?.displayName || fnMatch?.[1] || "").trim();
        nomorBersih = (waidMatch?.[1] || telMatch?.[1] || "").replace(/\D/g, "");
        sumber = "kartu kontak yang di-reply";
      }

      if (!namaBagian || !nomorBersih) {
        const raw = args.slice(1).join(" ").trim();
        if (raw) {
          const [n1, n2] = raw.split("|").map((s) => s?.trim());
          if (!n1 || !n2) {
            return m.reply(
              `❌ *FORMAT SALAH*\n\n` +
              `Reply kartu kontak lalu ketik *.setaudiocase c5*, ATAU\n` +
              `Ketik manual: *.setaudiocase c5 Nama Kontak|628xxxxxxxxxx*\n` +
              `Contoh: *.setaudiocase c5 Nama Kontak|628xxxxxxxxxx*`
            );
          }
          namaBagian = n1;
          nomorBersih = n2.replace(/\D/g, "");
          sumber = "input manual";
        }
      }

      if (namaBagian && nomorBersih) {
        if (nomorBersih.length < 8) {
          return m.reply("❌ Nomor tidak valid, pastikan format angka lengkap dengan kode negara (misal 62...).");
        }
        db.setting("audioFakeName", namaBagian);
        db.setting("audioFakeNumber", nomorBersih);
        fakeInfoMsg = `\n👤 Nama : *${namaBagian}*\n📱 Nomor : *+${nomorBersih}*\n📌 Sumber : _${sumber}_\n`;
      }
    }

    if (selected.id === 7) {
      let namaSaluran = "";
      let jidSaluran = "";
      let sumber = "";

      const quotedInfo = extractQuotedNewsletterInfo(m.quoted);
      if (quotedInfo) {
        namaSaluran = quotedInfo.newsletterName;
        jidSaluran = quotedInfo.newsletterJid;
        sumber = "pesan forwarded saluran yang di-reply";
      }

      if (!namaSaluran) {
        const raw = args.slice(1).join(" ").trim();
        if (raw) {
          const [n1, n2] = raw.split("|").map((s) => s?.trim());
          namaSaluran = n1 || raw;
          jidSaluran = n2 || "";
          sumber = "input manual";
        }
      }

      if (namaSaluran) {
        db.setting("audioC7Name", namaSaluran);
        if (jidSaluran) db.setting("audioC7Jid", jidSaluran);
        fakeInfoMsg =
          `\n📡 Nama Saluran : *${namaSaluran}*\n` +
          (jidSaluran ? `🆔 JID : *${jidSaluran}*\n` : "") +
          `📌 Sumber : _${sumber}_\n`;
      }
    }

    db.setting("audioMenuCase", selected.id);
    await db.save();

    const fakeName = db.setting("audioFakeName") || "Ichigo Assistant";
    const fakeNumber = db.setting("audioFakeNumber") || "6281234567890";
    const c7Name = db.setting("audioC7Name") || "Ichigo Channel";
    const c7Jid = db.setting("audioC7Jid") || "";

    await m.reply(
      `✅ *GAYA AUDIO MENU DIUBAH*\n\n` +
      `${selected.emoji} *C${selected.id} — ${selected.name}*\n` +
      `_${selected.desc}_\n` +
      (selected.id === 5
        ? (fakeInfoMsg || `\n👤 Nama saat ini : *${fakeName}*\n📱 Nomor saat ini : *+${fakeNumber}*\n_(reply kartu kontak + .setaudiocase c5, atau ketik .setaudiocase c5 Nama|Nomor)_\n`)
        : "") +
      (selected.id === 6
        ? `\n> Kartu kontak C6 pakai identitas yang sama kayak C5 — atur lewat *.setaudiocase c5 Nama|Nomor* atau reply kartu kontak.\n`
        : "") +
      (selected.id === 7
        ? (fakeInfoMsg || `\n📡 Nama Saluran saat ini : *${c7Name}*\n${c7Jid ? `🆔 JID saat ini : *${c7Jid}*\n` : ""}_(reply pesan "Forwarded" dari saluran + .setaudiocase c7, atau ketik .setaudiocase c7 Nama Saluran, atau .setaudiocase c7 Nama Saluran|jid@newsletter)_\n`)
        : "") +
      `\n> Berlaku untuk semua variant menu (kecuali V14 & V15 yang audionya sudah menyatu di variant itu sendiri).`
    );
    return;
  }

  const current =
    db.setting("audioMenuCase") ||
    (config.ui?.menuVariant <= 4 ? config.ui?.menuVariant : 4) ||
    4;

  const rows = [];
  for (const [key, val] of Object.entries(CASES)) {
    const mark = val.id === current ? " ✓" : "";
    rows.push({
      title: `${val.emoji} ${key.toUpperCase()}${mark} — ${val.name}`,
      description: val.desc,
      id: `${m.prefix}setaudiocase ${key}`,
    });
  }

  const buttons = [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🎧 Pilih Gaya Audio Menu",
        sections: [{ title: "Daftar Gaya Audio", rows }],
      }),
    },
  ];

  const audioOn = db.setting("audioMenu") !== false;

  const bodyText =
    `🎧 *AUDIO MENU CASE*\n\n` +
    `Atur gaya pengiriman audio ketika user membuka menu (.menu) 🎶\n` +
    `Status audio: *${audioOn ? "AKTIF ✅" : "NONAKTIF ❌"}* _(ubah lewat .aktifaudiomenu)_\n` +
    `Gaya aktif saat ini: *C${current} — ${CASES[`c${current}`]?.name || "Unknown"}* 🎯\n\n` +
    `*PENJELASAN GAYA:*\n\n` +
    `🎙️ *C1 — Voice Note Order*\n_PTT quoted ke pesan asli user._\n\n` +
    `📊 *C2 — Poll Quoted*\n_Audio quoted ke pesan polling palsu._\n\n` +
    `💬 *C3 — Text Quoted*\n_Audio biasa quoted ke pesan teks._\n\n` +
    `🎵 *C4 — Voice Note Biasa*\n_PTT quoted langsung, tanpa efek tambahan._\n\n` +
    `👤 *C5 — Fake Kontak*\n_PTT quoted ke kartu kontak custom. Reply kartu kontak lalu ketik_ *.setaudiocase c5* _(auto ambil nama+nomor), atau manual:_ *.setaudiocase c5 Nama Kontak|628xxxxxxxxxx*\n\n` +
    `⚡ *C6 — VN Cepat + Fake Kontak*\n_Kirim langsung dari buffer audio tanpa convert ffmpeg (paling cepat), quoted ke kartu kontak custom — identitas sama kayak C5._\n\n` +
    `📡 *C7 — Fake Channel*\n_PTT dikirim dengan efek "Forwarded" dari saluran. Reply pesan forwarded saluran lalu ketik_ *.setaudiocase c7* _(auto ambil nama saluran), atau manual:_ *.setaudiocase c7 Nama Saluran*\n\n` +
    `> Pilih gaya audio dari tombol di bawah, atau ketik *.setaudiocase c1* s/d *c7* 👇`;

  await sock.sendButton(
    m.chat,
    (await loadAssetBuffer("ichigo")),
    bodyText,
    m,
    { buttons },
  );
}

export { pluginConfig as config, handler };