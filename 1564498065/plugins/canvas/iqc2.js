import axios from 'axios';
import te from '../../src/lib/ichigo-error.js';

const pluginConfig = {
    name: "iqc2",
    alias: ["qc3"],
    category: "canvas",
    description: "Membuat Fake Quote iOS style dengan informasi baterai dan provider.",
    usage: ".iqc2 [text/reply]",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    try {
        const targetText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");
        
        if (!targetText) {
            return m.reply(
                `Halo *${m.pushName}*, sepertinya kamu belum memasukkan teksnya.\n\n` +
                `Silakan gunakan perintah dengan format:\n` +
                `- .iqc2 <teks kamu>\n` +
                `- Atau balas (reply) pesan orang lain dengan .iqc2`
            );
        }

        await m.react('🕕');

        const providers = ["INDOSAT", "TELKOMSEL", "XL", "TRI", "SMARTFREN", "WIFI"];
        const randomProvider = providers[Math.floor(Math.random() * providers.length)];
        
        const now = new Date();
        const jam = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" }).replace('.', ':');
        
        const randomBaterai = Math.floor(Math.random() * (100 - 10 + 1)) + 10; 

        // Endpoint baru diatur di sini
        const apiUrl = `https://api-cloud.my.id/maker/iqc?text=${encodeURIComponent(targetText)}&provider=${encodeURIComponent(randomProvider)}&jam=${encodeURIComponent(jam)}&baterai=${randomBaterai}`;
        
        const { data } = await axios.get(apiUrl, { timeout: 30000 });
        
        // Memeriksa status API dan ketersediaan data result
        if (!data || !data.status || !data.result) {
            throw new Error("Gagal mengambil data dari server API.");
        }

        // Menghapus header data URI base64 dan mengubahnya menjadi buffer gambar
        const base64Data = data.result.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        await sock.sendMessage(m.chat, { image: imageBuffer }, { quoted: m });
        
        await m.react('✅');

    } catch (error) {
        console.error("[IQC2 Plugin Error]", error);
        await m.react('❌');
        m.reply(`Maaf *${m.pushName}*, terjadi kesalahan saat mencoba membuat gambar quote. Silakan coba lagi beberapa saat.`);
    }
}

export { pluginConfig as config, handler };