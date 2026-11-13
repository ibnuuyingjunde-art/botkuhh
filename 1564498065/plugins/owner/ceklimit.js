import { getDatabase } from "../../src/lib/ichigo-database.js";

const pluginConfig = {
    name: "ceklimit",
    alias: ["limitall", "ceklimitall", "alllimit"],
    category: "owner",
    description: "Melihat daftar limit (energi) seluruh user yang terdaftar di bot.",
    usage: ".ceklimit",
    example: ".ceklimit",
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true,
};

async function handler(m, { sock }) {
    const db = getDatabase();

    const users = db.getAllUsers();
    const entries = Object.values(users || {});

    if (entries.length === 0) {
        return m.reply(
            `*CEK LIMIT (SEMUA USER)*\n\n> Belum ada user yang terdaftar di database.`,
        );
    }

    const sorted = entries.slice().sort((a, b) => {
        const ea = a.energi ?? 0;
        const eb = b.energi ?? 0;
        if (ea === -1 && eb === -1) return 0;
        if (ea === -1) return 1;
        if (eb === -1) return -1;
        return ea - eb;
    });

    let txt = `*CEK LIMIT (SEMUA USER)*\nTotal user: *${entries.length}*\n\n`;

    for (let i = 0; i < sorted.length; i++) {
        const u = sorted[i];
        const nomor = u.jid || u.number || "unknown";
        const nama = u.name || "Unknown";
        const status = u.energi === -1 ? "♾️ UNLIMITED" : `${u.energi ?? 0}`;
        const tag = u.isPremium ? " 💎" : "";

        txt += `${i + 1}. *${nama}*${tag}\n   ${nomor} — Limit: *${status}*\n`;
    }

    const totalLimited = sorted.filter((u) => u.energi !== -1);
    const totalSisa = totalLimited.reduce((a, u) => a + (u.energi ?? 0), 0);
    const totalUnlimited = sorted.length - totalLimited.length;

    txt += `\n> Total sisa limit (non-unlimited): *${totalSisa}*`;
    if (totalUnlimited > 0) {
        txt += `\n> User unlimited: *${totalUnlimited}*`;
    }

    await m.reply(txt);
}

export { pluginConfig as config, handler };