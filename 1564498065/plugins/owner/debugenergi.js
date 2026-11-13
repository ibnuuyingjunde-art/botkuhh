const pluginConfig = {
    name: 'debugenergi',
    alias: ['deenergi', 'debugenergy'],
    category: 'owner',
    description: 'Debug energi user',
    isOwner: true,
    isEnabled: true
}

async function handler(m, { sock, db }) {
    const targetJid = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
    const cleanJid = targetJid.replace(/@.+/g, '')

    console.log('[debug] targetJid:', targetJid)
    console.log('[debug] cleanJid:', cleanJid)
    console.log('[debug] keys in db:', Object.keys(db.data.users).slice(0, 5))
    console.log('[debug] raw before:', db.data.users[cleanJid]?.energi)

    const before = db.getUser(targetJid)
    const newEnergi = db.updateEnergi(targetJid, 10)

    console.log('[debug] updateEnergi result:', newEnergi)
    console.log('[debug] raw after:', db.data.users[cleanJid]?.energi)

    const saved = await db.save()
    console.log('[debugenergi] save result:', saved)

    const after = db.getUser(targetJid)

    await m.reply(
        `🔍 *DEBUG ENERGI*\n\n` +
        `│ targetJid : ${targetJid}\n` +
        `│ cleanJid  : ${cleanJid}\n` +
        `│ Before    : ${before?.energi ?? 'null'}\n` +
        `│ After     : ${after?.energi ?? 'null'}\n` +
        `│ Raw After : ${db.data.users[cleanJid]?.energi ?? 'null'}\n` +
        `│ Result    : ${newEnergi}\n` +
        `│ Saved     : ${saved}`
    )
}

export { pluginConfig as config, handler }