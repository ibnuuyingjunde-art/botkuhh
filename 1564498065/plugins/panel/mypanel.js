import fs from 'fs'
import path from 'path'
import { cleanNumber, getAllRolesForUser } from '../../src/lib/ichigo-roles-cpanel.js'
import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'mypanel',
    alias: ['panelku'],
    category: 'panel',
    description: 'Lihat panel pterodactyl milik kamu',
    usage: '.mypanel',
    example: '.mypanel',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

const DB_PATH = path.join(process.cwd(), 'database', 'cpanel', 'panels.json')

const ROLE_EMOJI = {
    owner: '👑',
    ceo: '💼',
    reseller: '🏪'
}

const ROLE_LABEL = {
    owner: 'Owner',
    ceo: 'CEO',
    reseller: 'Reseller'
}

function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        fs.writeFileSync(DB_PATH, '{}', 'utf8')
        return {}
    }
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    } catch {
        return {}
    }
}

function getUserPanels(number) {
    const db = loadDB()
    return db[number] || []
}

async function handler(m, { sock }) {
    try {
        const number = cleanNumber(m.sender)
        const name = m.pushName
            || sock.contacts?.[m.sender]?.name
            || sock.contacts?.[m.sender]?.notify
            || number

        const panels = getUserPanels(number)
        const roles = getAllRolesForUser(m.sender)

        let txt = `🖥️ *MY PANEL*\n\n`
        txt += `◈ 👤 *Nama* : ${name}\n`
        txt += `◈ 📱 *Nomor* : \`${number}\`\n\n`
        txt += `▸ *ROLE*\n`

        if (roles.length > 0) {
            for (const r of roles) {
                const emoji = ROLE_EMOJI[r.role] || '❓'
                const label = ROLE_LABEL[r.role] || r.role
                txt += `  ▹ ${emoji} ${r.server.toUpperCase()} ➜ *${label}*\n`
            }
        } else {
            txt += `  ▹ ➖ Tidak ada role\n`
        }

        txt += `\n▸ *PANEL*\n`

        if (panels.length === 0) {
            txt += `  ▹ 📭 Belum ada panel\n\n`
            txt += `> Kamu belum memiliki panel pterodactyl apapun saat ini.`
        } else {
            for (let i = 0; i < panels.length; i++) {
                const p = panels[i]
                txt += `  ▹ *${i + 1}.* ${p.name}\n`
                txt += `       📅 ${p.createdAt || '-'}\n`
            }
        }

        return m.reply(txt)

    } catch (err) {
        console.error('[mypanel error]', err?.message || err)
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }