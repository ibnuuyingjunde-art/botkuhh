import { getDatabase } from '../../src/lib/ichigo-database.js'
import config from '../../config.js'
import moment from 'moment-timezone'
// TODO: sesuaikan path import AIRich dengan lokasi class-nya di project
import IchigoBuilder from '../../src/lib/ichigo-builder.js';
const { AIRich } = IchigoBuilder;
const pluginConfig = {
    name: 'intro',
    alias: ['perkenalan', 'selamatdatang'],
    category: 'group',
    description: 'Tampilkan pesan intro grup',
    usage: '.intro',
    example: '.intro',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true
}

const DEFAULT_INTRO = `halo kak @user 🖐

Kenalan dulu yukk
- Nama :
- Umur :
- Asal :
- Hobi :
- Status :

Semoga betah yahh, di grup @group

> Untuk Owner:
ganti intro bawaan dengan .setintro <text>`
 function parsePlaceholders(text, m, groupMeta, mentionLabel = null) {
    const now = moment().tz('Asia/Makassar')
    const dateStr = now.format('D MMMM YYYY')
    const timeStr = now.format('HH:mm')

    const userTag = mentionLabel || `@${m.sender.split('@')[0]}`
    return text
        .replace(/@user/gi, userTag)
        .replace(/@group/gi, groupMeta?.subject || 'Grup')
        .replace(/@count/gi, groupMeta?.participants?.length || '0')
        .replace(/@date/gi, dateStr)
        .replace(/@time/gi, timeStr)
        .replace(/@desc/gi, groupMeta?.desc || 'Tidak ada deskripsi')
        .replace(/@botname/gi, config.bot?.name || "lyniX's MD")
}

// Pesan rich dengan tombol salin, berisi form intro yang tinggal diisi
async function sendCopyableForm(sock, jid, groupMeta) {
    const groupName = groupMeta?.subject || 'grup'
    const form =
        `\`intro ${groupName}\` \n` +
        `nama: \n` +
        `umur: \n` +
        `asal daerah: \n` +
        `hobi: \n` +
        `status: `

    const rich = new AIRich(sock)

    rich.addSection({
        view_model: {
            __typename: 'GenAIAddonActionLayoutViewModel',
            addon_action_type: 'COPY_TO_CLIPBOARD',
            addon_action_alignment: 'END',
            primitives: [
                {
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                    text: form,
                    inline_entities: []
                }
            ]
        }
    })

    await rich.send(jid)
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const groupData = db.getGroup(m.chat) || db.setGroup(m.chat)
    const groupMeta = m.groupMetadata

    const introText = groupData.intro || DEFAULT_INTRO
    const parsed = parsePlaceholders(introText, m, groupMeta)

    // Teks sapaan (mention tetap jalan)
    await m.reply(parsed, { mentions: [m.sender] })

    // Form intro yang bisa disalin lewat tombol
    try {
        await sendCopyableForm(sock, m.chat, groupMeta)
    } catch (err) {
        console.error('[intro] gagal kirim rich message:', err)
    }
}

export { pluginConfig as config, handler, parsePlaceholders, DEFAULT_INTRO }