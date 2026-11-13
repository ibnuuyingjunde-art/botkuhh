import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
    name: "ceklimitgrup",
    alias: ["limitgrup", "ceklimitgroup", "limitgroup"],
    category: "group",
    description: "Melihat daftar limit (energi) member di grup ini.",
    usage: ".ceklimitgrup",
    example: ".ceklimitgrup",
    isOwner: false,
    isPremium: false,
    isAdmin: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
};

async function handler(m, { sock }) {
    const db = getDatabase();

    const metadata = await sock.groupMetadata(m.chat);
    const participants = metadata?.participants || [];

    if (participants.length === 0) {
        return m.reply(
            `*CEK LIMIT GRUP*\n\n> Tidak dapat membaca data member grup ini.`,
        );
    }

    const list = participants.map((p) => {
        const jid = p.id;
        const user = db.getUser(jid);
        const energi = user?.energi ?? null;
        const isPremium = user?.isPremium ?? false;
        const name = user?.name || jid.split("@")[0];
        return { jid, name, energi, isPremium };
    });

    const sorted = list.slice().sort((a, b) => {
        if (a.energi === null && b.energi === null) return 0;
        if (a.energi === null) return 1;
        if (b.energi === null) return -1;
        if (a.energi === -1 && b.energi === -1) return 0;
        if (a.energi === -1) return 1;
        if (b.energi === -1) return -1;
        return a.energi - b.energi;
    });

    let txt = `*CEK LIMIT GRUP*\n${metadata.subject ? `Grup: *${metadata.subject}*\n` : ""}Total member: *${sorted.length}*\n\n`;

    for (let i = 0; i < sorted.length; i++) {
        const u = sorted[i];
        let status;
        if (u.energi === null) {
            status = "belum terdaftar";
        } else if (u.energi === -1) {
            status = "♾️ UNLIMITED";
        } else {
            status = `${u.energi}`;
        }
        const tag = u.isPremium ? " 💎" : "";

        txt += `${i + 1}. @${u.jid.split("@")[0]}${tag} — Limit: *${status}*\n`;
    }

    const terdaftar = sorted.filter((u) => u.energi !== null && u.energi !== -1);
    const totalSisa = terdaftar.reduce((a, u) => a + u.energi, 0);

    txt += `\n> Total sisa limit member terdaftar: *${totalSisa}*`;

    const mentions = sorted.map((u) => u.jid);
    await m.reply(txt, { mentions });
}

export { pluginConfig as config, handler };