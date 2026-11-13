import axios from 'axios';
import { load } from 'cheerio';
import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;

const pluginConfig = {
    name: "igstalk",
    alias: ["instalookup", "instalookupai"],
    category: "tools",
    description: "Mencari dan menampilkan profil Instagram dengan tampilan AIRich UI.",
    usage: ".igstalk <username>",
    example: ".igstalk rennz_dev",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true,
};

const SOURCE = 'https://insta-stories-viewer.com';
const FALLBACK_PHOTO = 'https://files.catbox.moe/bpmmcz.jpeg';

async function lookupInstagram(username) {
    const sourceUrl = `${SOURCE}/${encodeURIComponent(username)}/`;
    const { data: html } = await axios.get(sourceUrl, {
        timeout: 20000,
        responseType: 'text',
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
        headers: {
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    if (typeof html !== 'string') {
        throw new Error('Respons sumber bukan HTML.');
    }

    const $ = load(html);
    const returnedUsername = ($('.profile__tabs').first()
        .attr('data-username') || '').trim().toLowerCase();

    if (returnedUsername !== username) {
        throw new Error('Profil belum tersedia atau halaman meminta verifikasi browser.');
    }

    const readText = (selector, maxLength = 1500) => $(selector).first()
        .text().replace(/\s+/g, ' ').trim().slice(0, maxLength);

    let profilePic = null;
    const avatarSrc = $('.profile__avatar-pic').first().attr('src')?.trim();
    if (avatarSrc) {
        try {
            const url = new URL(avatarSrc, sourceUrl);
            if (url.protocol === 'https:' && !url.username && !url.password) {
                profilePic = url.href;
            }
        } catch {
            // Abaikan kesalahan penulisan URL foto profil
        }
    }

    return {
        username: returnedUsername,
        profileUrl: `https://www.instagram.com/${returnedUsername}/`,
        profilePic,
        biography: readText('.profile__description'),
        posts: readText('.profile__stats-posts', 80),
        followers: readText('.profile__stats-followers', 80),
        following: readText('.profile__stats-follows', 80)
    };
}

async function handler(m, { sock, text, prefix, command }) {
    const conn = sock || m.conn;

    if (!text?.trim()) {
        return m.reply(
            `❌ *Format salah!*\n\n` +
            `> *Penggunaan:* \`${prefix + command} <username>\`\n` +
            `> *Contoh:* \`${prefix + command} rennz_dev\``
        );
    }

    const username = text.trim().replace(/^@/, '').toLowerCase();
    if (
        !/^[a-z0-9._]{1,30}$/.test(username) ||
        username.startsWith('.') ||
        username.endsWith('.') ||
        username.includes('..')
    ) {
        return m.reply('⚠️ *Username tidak valid.* Kirim username saja tanpa URL atau karakter khusus berlebih.');
    }

    try {
        await m.react('⏳');

        const profile = await lookupInstagram(username);
        const rich = new AIRich(conn);

        if (typeof rich.addCompact !== 'function') {
            await m.react('❌');
            return m.reply('⚠️ Library `AIRich` belum mendukung `addCompact()`. Silakan perbarui modul `MessageBuilderv2.js`.');
        }

        const stats = [
            profile.posts && `${profile.posts} postingan`,
            profile.followers && `${profile.followers} pengikut`,
            profile.following && `${profile.following} mengikuti`
        ].filter(Boolean).join(' • ');

        const bio = profile.biography.length > 100
            ? `${profile.biography.slice(0, 97)}...`
            : profile.biography;

        rich.addCompact({
            title: `@${profile.username}`,
            subtitle: stats,
            secondary_subtitle: bio,
            image: profile.profilePic || FALLBACK_PHOTO,
            entity_id: profile.username,
            entity_url: profile.profileUrl,
            entity_type: 'WEBSITE',
            action_type: 'OPEN_URL'
        });

        rich.addSection({
            view_model: {
                primitives: [
                    { type: 'HORIZONTAL_LINE', __typename: 'GenAIDividerPrimitive' }
                ],
                __typename: 'GenAIVStackLayoutViewModel'
            }
        });

        rich.addSection({
            view_model: {
                primitives: [
                    { __typename: 'GenAISpacerPrimitive' },
                    {
                        text: '# {{social_entity_1}}See results{{/social_entity_1}}',
                        inline_entities: [
                            {
                                key: 'social_entity_1',
                                metadata: {
                                    __typename: 'GenAISocialEntityItem',
                                    entity_id: profile.username,
                                    entity_name: profile.username,
                                    ...(profile.profilePic
                                        ? { entity_picture_url: profile.profilePic }
                                        : {}),
                                    entity_url: profile.profileUrl,
                                    entity_type: 'IG_PROFILE'
                                }
                            }
                        ],
                        __typename: 'GenAIMarkdownTextUXPrimitive'
                    },
                    { __typename: 'GenAISpacerPrimitive' }
                ],
                __typename: 'GenAIActionRowLayoutViewModel'
            }
        });

        rich.setFooter('Insta Stories Viewer • Data diperbarui secara berkala');

        await rich.send(m.chat, { quoted: m });
        await m.react('✅');

    } catch (err) {
        console.error(`[IG Stalk Error] ${username}:`, err);
        await m.react('❌');
        return m.reply(`⚠️ Gagal mengambil profil Instagram: ${err.message || err}`);
    }
}

export { pluginConfig as config, handler };