import path from 'path';
import fs from 'fs';
// js-beautify dimuat lazy saat dipakai
import { sendBatchPrivateRelayUnified } from '../../src/spr/sbpr.js'; // <-- Diubah menggunakan sBPR grup

const pluginConfig = {
    name: "sp2",
    alias: ["sp2"],
    category: "owner",
    description: "Manajemen plugin bot (tambah, hapus, lihat, kirim private via sBPR di grup)",
    usage: ".sp [opsi/tag] [nama_file/alias]",
    example: ".sp + owner/test | .sp - menu | .sp ? addowner | .sp @user addowner",
    isOwner: true,
    isGroup: false,
    isEnabled: true,
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function safeReply(m, text) {
    try {
        if (typeof text !== 'string') text = JSON.stringify(text, null, 2);
        return m.reply(text);
    } catch {
        return m.reply('❌ Gagal mengirim reply.');
    }
}

function detectExt(code) {
    const hasCjs = /module\.exports\s*=/.test(code) || /exports\.\w+\s*=/.test(code) || /require\s*\(/.test(code);
    const hasEsm = /export\s+default/.test(code) || /^import\s+/m.test(code);
    if (hasCjs && !hasEsm) return '.cjs';
    return '.js';
}

function normalizeExt(relPath, code) {
    const withoutExt = relPath.replace(/\.(js|cjs)$/, '');
    const ext = detectExt(code);
    return withoutExt + ext;
}

function searchPlugin(name, pluginsDir) {
    const categories = fs.readdirSync(pluginsDir).filter((f) => {
        const fullPath = path.join(pluginsDir, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
    });

    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
        for (const file of files) {
            const baseName = file.replace(/\.(js|cjs)$/, "").toLowerCase();
            if (baseName === name.toLowerCase()) {
                return { path: path.join(categoryPath, file), category, file };
            }
        }
    }

    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            try {
                const content = fs.readFileSync(filePath, "utf-8");
                const aliasMatch = content.match(/alias:\s*\[([^\]]+)\]/);
                if (aliasMatch) {
                    const aliases = aliasMatch[1].match(/['"`]([^'"`]+)['"`]/g);
                    if (aliases) {
                        const cleanAliases = aliases.map((a) => a.replace(/['"`]/g, "").toLowerCase());
                        if (cleanAliases.includes(name.toLowerCase())) {
                            return { path: filePath, category, file };
                        }
                    }
                }
            } catch {}
        }
    }
    return null;
}

function getSimilarPlugins(name, pluginsDir) {
    const results = [];
    const categories = fs.readdirSync(pluginsDir).filter((f) => {
        const fullPath = path.join(pluginsDir, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith(".");
    });

    for (const category of categories) {
        const categoryPath = path.join(pluginsDir, category);
        const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
        for (const file of files) {
            const baseName = file.replace(/\.(js|cjs)$/, "").toLowerCase();
            if (baseName.includes(name.toLowerCase()) || name.toLowerCase().includes(baseName)) {
                results.push(`${category}/${file}`);
            }
        }
    }
    return results.slice(0, 5);
}

// ==========================================
// MAIN HANDLER
// ==========================================
async function handler(m, { sock, args, prefix, command }) {
    const conn = sock || m.conn;
    const pluginsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../plugins');

    let targetJid = m.quoted ? m.quoted.sender : (m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : null);
    
    const option = args[0];
    const isAction = option && ['+', '-', '?'].includes(option[0]);
    const action = isAction ? option[0] : null;

    if (!action && !targetJid) {
        let replyText = `🛠️ *PLUGIN MANAGER*\n\n`;
        replyText += `Gunakan format: \`${prefix + command} [opsi] [nama_file/alias]\`\n\n`;
        replyText += `*Opsi CRUD:*\n`;
        replyText += `  \`+\` : Tambah/simpan plugin\n`;
        replyText += `  \`-\` : Hapus plugin\n`;
        replyText += `  \`?\` : Ambil kode plugin\n\n`;
        replyText += `*Kirim Private (sBPR):*\n`;
        replyText += `  \`${prefix + command} @user [nama_file/alias]\`\n\n`;
        replyText += `> _Fitur pencarian otomatis membaca nama file & alias dalam folder plugins!_`;
        return safeReply(m, replyText);
    }

    const pathParts = isAction ? args.slice(1) : args.filter(a => !a.startsWith('@'));
    const query = pathParts.join(' ').trim();

    if (!query) return safeReply(m, `❌ *Masukkan nama file atau alias plugin!*`);

    // --- TAMBAH PLUGIN (+) ---
    if (action === '+') {
        if (!m.quoted) return safeReply(m, '❌ *Balas pesan berisi kode atau file untuk disimpan.*');

        let code = '';
        if (typeof m.quoted.text === 'string' && m.quoted.text.trim()) {
            code = m.quoted.text;
        } else if (m.quoted.isMedia || m.quoted.mtype === 'documentMessage') {
            try {
                const buffer = await m.quoted.download();
                code = buffer.toString('utf-8');
            } catch {
                return safeReply(m, '❌ *Gagal mengunduh file media/dokumen.*');
            }
        } else {
            return safeReply(m, '❌ *Pesan yang dibalas tidak berisi teks atau file.*');
        }

        if (!code.trim()) return safeReply(m, '❌ *Kode tidak ditemukan.*');

        const ext = detectExt(code);
        let relPath = query.includes('/') ? query : `owner/${query}`;
        relPath = relPath.replace(/\.(js|cjs)$/, '') + ext;
        
        const targetPath = path.join(pluginsDir, relPath);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let beautifiedCode = code;
        try {
            const beautify = (await import('js-beautify')).default;
            beautifiedCode = beautify.js(code, { indent_size: 2, space_in_empty_paren: true });
        } catch (e) {
            console.error('[Beautify] Gagal:', e);
        }

        fs.writeFileSync(targetPath, beautifiedCode);
        return safeReply(m, `✅ *Plugin berhasil disimpan!*\n\n📍 Path: \`${relPath}\`\n⚙️ Tipe: \`${ext === '.cjs' ? 'CJS' : 'ESM'}\`\n\n> _Hot-reload akan memuatnya secara otomatis._`);
    }

    // --- CARI PLUGIN (- / ? / sBPR) ---
    let pluginInfo = null;
    if (query.includes("/")) {
        const [category, fileBase] = query.split("/");
        let filePath = path.join(pluginsDir, category, fileBase.endsWith(".js") || fileBase.endsWith(".cjs") ? fileBase : `${fileBase}.js`);
        if (!fs.existsSync(filePath) && !filePath.endsWith('.cjs')) {
             filePath = path.join(pluginsDir, category, `${fileBase}.cjs`);
        }
        if (fs.existsSync(filePath)) {
            pluginInfo = { path: filePath, category, file: path.basename(filePath) };
        }
    } else {
        pluginInfo = searchPlugin(query, pluginsDir);
    }

    if (!pluginInfo) {
        const similar = getSimilarPlugins(query, pluginsDir);
        let textError = `❌ Plugin \`${query}\` tidak ditemukan.\n\n`;
        if (similar.length > 0) {
            textError += `*Mungkin maksud kamu:*\n`;
            similar.forEach((s) => { textError += `> • \`${s}\`\n`; });
        }
        return safeReply(m, textError);
    }

    const { path: targetPath, category, file } = pluginInfo;
    const relativePath = `${category}/${file}`;
    const content = fs.readFileSync(targetPath, 'utf8');
    const ext = relativePath.endsWith('.cjs') ? 'CJS' : 'ESM';

    // --- HAPUS PLUGIN (-) ---
    if (action === '-') {
        fs.unlinkSync(targetPath);
        return safeReply(m, `🗑️ *Plugin \`${relativePath}\` berhasil dihapus.*`);
    }

    // --- AMBIL KODE (?) ---
    if (action === '?') {
        await conn.sendButton(m.chat, {
            footer: `Kode plugin \`${relativePath}\` (${ext}):`,
            buttons: [{
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: 'salin code',
                    id: 'copy_plugin_code',
                    copy_code: content
                })
            }]
        }, { quoted: m });
        return;
    }

    // --- KIRIM PRIVATE DI GRUP via sBPR (@tag) ---
    if (targetJid && !action) {
        if (!m.isGroup) return safeReply(m, '❌ *Kirim private via sBPR hanya bisa di grup.*');
        
        await m.react("⏳");
        try {
            const protoPayload = {
                interactiveMessage: {
                    header: { title: '', hasMediaAttachment: false },
                    body: { text: '' },
                    footer: { text: `Kode plugin \`${relativePath}\` (${ext}):` },
                    nativeFlowMessage: {
                        buttons: [{
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'salin code',
                                id: 'copy_plugin_code',
                                copy_code: content
                            })
                        }]
                    },
                    contextInfo: { mentionedJid: m.mentionedJid || [] }
                }
            };

            await sendBatchPrivateRelayUnified(
                conn,
                m.chat, // <-- Tetap di dalam grup!
                [targetJid], // <-- Hanya terbuka untuk target yang ditag
                protoPayload,
                {
                    msgForOthers: "🔒 _[Seseorang mengirim source code plugin secara rahasia]_", // Pesan kamuflase untuk member lain
                    additionalNodes: [{
                        tag: 'biz',
                        attrs: {},
                        content: [{
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        }],
                    }],
                    verbose: false
                }
            );
            
            await m.react("✅");
        } catch (e) {
            console.error('[.sp] Error sBPR:', e);
            await m.react("❌");
            return safeReply(m, `⚠️ Gagal mengirim kode via sBPR: ${e.message}`);
        }
    }
}

export { pluginConfig as config, handler };