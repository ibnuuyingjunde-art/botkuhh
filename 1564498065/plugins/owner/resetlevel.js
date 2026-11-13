import { getDatabase } from '../../src/lib/ichigo-database.js'
import { calculateLevel, getRole } from './../../src/lib/ichigo-level.js'

const pluginConfig = {
    name: 'resetlevel',
    alias: ['resetlvl', 'rstlevel', 'rstlvl'],
    category: 'owner',
    description: 'Reset level user ke 1',
    usage: '.resetlevel [@user]',
    example: '.resetlevel @user',
    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    const db = getDatabase()

    const targetJid = m.quoted?.sender || m.mentionedJid?.[0] || m.sender
    const targetTag = targetJid.split('@')[0]

    const user = db.getUser(targetJid) || db.setUser(targetJid)
    if (!user.rpg) user.rpg = {}

    const oldLevel = calculateLevel(user.exp || 0)

    db.setUser(targetJid, {
        exp: 0,
        rpg: {
            ...user.rpg,
            level: 1,
            maxHealth: 100,
            maxMana: 100,
            maxStamina: 100,
            health: 100,
            mana: 100,
            stamina: 100,
        }
    })

    await db.save()
    await m.react('✅')
    await m.reply(
        `✅ Berhasil mereset level @${targetTag}\n\n` +
        `> Level sebelumnya: *${oldLevel}*\n` +
        `> Level sekarang: *1*\n` +
        `> Role: *${getRole(1)}*`,
        { mentions: [targetJid] }
    )
}

export { pluginConfig as config, handler }