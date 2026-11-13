import axios from 'axios';

const pluginConfig = {
    name: "ampremv2",
    alias: ["am2", "amprem4", "alightmotion"],
    category: "tools",
    description: "Alat untuk mengirim tautan login dan verifikasi Alight Motion Premium.",
    usage: ".ampremv2 <send/verify> <email> [link]",
    example: ".ampremv2 send amirul@gmail.com",
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, args, prefix, command }) {
    if (args.length < 2) {
        return m.reply(
            `❌ *Format salah!*\n\n` +
            `📌 *Cara Penggunaan:*\n` +
            `1️⃣ *Kirim Link Login:*\n` +
            `> \`${prefix + command} send <email>\`\n` +
            `2️⃣ *Verifikasi Link:*\n` +
            `> \`${prefix + command} verify <email> <link_dari_email>\`\n\n` +
            `💡 *Contoh:*\n` +
            `• \`${prefix + command} send amirulfathan92@gmail.com\`\n` +
            `• \`${prefix + command} verify amirulfathan92@gmail.com https://alight-creative.firebaseapp...\``
        );
    }

    const action = args[0].toLowerCase();
    const email = args[1];

    try {
        await m.react('⏳');

        if (action === 'send') {
            const apiUrl = `https://api-cloud.my.id/tools/amprem4?action=send&email=${encodeURIComponent(email)}`;
            const { data } = await axios.get(apiUrl, { timeout: 30000 });

            if (!data || !data.status) {
                throw new Error("Gagal mengirim tautan. Server mungkin sedang gangguan.");
            }

            await m.reply(`✅ *Sukses!*\n\n${data.result.message}\nSilakan cek inbox/spam di email *${email}* untuk mengambil tautan verifikasi.`);
            await m.react('✅');

        } else if (action === 'verify') {
            if (args.length < 3) {
                await m.react('❌');
                return m.reply(
                    `❌ *Tautan (Link) tidak ditemukan!*\n\n` +
                    `Gunakan format: \`${prefix + command} verify ${email} <link>\``
                );
            }

            const link = args.slice(2).join(''); 
            const apiUrl = `https://api-cloud.my.id/tools/amprem4?action=verify&email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}`;
            
            const { data } = await axios.get(apiUrl, { timeout: 45000 });

            if (!data || !data.status || !data.result) {
                throw new Error("Gagal memverifikasi tautan. Pastikan link benar, lengkap, dan belum kedaluwarsa.");
            }

            let caption = `🎉 *Verifikasi AM Premium Berhasil!*\n\n`;
            caption += `• *UID:* ${data.result.uid}\n`;
            caption += `• *Order ID:* ${data.result.orderId}\n\n`;
            caption += `_Status akun Alight Motion kamu sekarang sudah Premium!_`;

            await m.reply(caption);
            await m.react('✅');

        } else {
            await m.react('❌');
            m.reply(`⚠️ Aksi *${action}* tidak dikenali. Harap gunakan *send* atau *verify*.`);
        }

    } catch (error) {
        console.error("[AMPremV2 Error]:", error);
        await m.react('❌');
        m.reply(`⚠️ *Terjadi Kesalahan:* ${error.response?.data?.message || error.message || "Gagal menghubungi server API"}`);
    }
}

export { pluginConfig as config, handler };