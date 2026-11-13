import axios from 'axios'
import config from '../../config.js'
import { hasFullAccess, getUserRole, VALID_SERVERS } from '../../src/lib/ichigo-roles-cpanel.js'
import te from '../../src/lib/ichigo-error.js'

const allCommands = VALID_SERVERS.map(v => `listserver${v}`)
const allAliases = VALID_SERVERS.map(v => `servers${v}`)

const pluginConfig = {
    name: allCommands,
    alias: allAliases,
    category: 'panel',
    description: 'List semua server di panel (v1-v5)',
    usage: '.listserverv1 atau .listserverv2',
    example: '.listserverv1',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function parseServerVersion(cmd) {
    const match = cmd.match(/v([1-5])$/i)
    if (!match) return { server: 'v1', serverKey: 's1' }
    return { server: 'v' + match[1], serverKey: 's' + match[1] }
}

function getServerConfig(pteroConfig, serverKey) {
    const serverConfigs = {
        's1': pteroConfig.server1,
        's2': pteroConfig.server2,
        's3': pteroConfig.server3,
        's4': pteroConfig.server4,
        's5': pteroConfig.server5
    }
    return serverConfigs[serverKey] || null
}

function validateServerConfig(serverConfig) {
    const missing = []
    if (!serverConfig?.domain) missing.push('domain')
    if (!serverConfig?.apikey) missing.push('apikey (PTLA)')
    return missing
}

function getAvailableServers(pteroConfig) {
    const available = []
    for (let i = 1; i <= 5; i++) {
        const cfg = pteroConfig[`server${i}`]
        if (cfg?.domain && cfg?.apikey) available.push(`v${i}`)
    }
    return available
}

function formatBytes(bytes) {
    if (bytes === 0) return 'Unlimited'
    const mb = bytes
    if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
    return `${mb} MB`
}

async function fetchAllServers(serverConfig) {
    let allServers = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
        const res = await axios.get(`${serverConfig.domain}/api/application/servers?page=${page}&per_page=50`, {
            headers: {
                'Authorization': `Bearer ${serverConfig.apikey}`,
                'Content-Type': 'application/json',
                'Accept': 'Application/vnd.pterodactyl.v1+json'
            }
        })

        const servers = res.data.data || []
        allServers = allServers.concat(servers)

        const meta = res.data.meta?.pagination
        if (meta) {
            totalPages = meta.total_pages || 1
        }
        page++
    }

    return allServers
}

function buildServerChunks(servers, serverLabel, chunkSize = 15) {
    const chunks = []

    for (let i = 0; i < servers.length; i += chunkSize) {
        const isFirst = i === 0
        const isLast = i + chunkSize >= servers.length
        const chunk = servers.slice(i, i + chunkSize)

        let txt = ''

        if (isFirst) {
            txt += `📋 *ᴅᴀꜰᴛᴀʀ sᴇʀᴠᴇʀ [${serverLabel}]*\n`
            txt += `> Total: *${servers.length}* server\n\n`
        } else {
            const part = Math.floor(i / chunkSize) + 1
            txt += `📋 *[${serverLabel}] — Halaman ${part}*\n\n`
        }

        chunk.forEach((s, idx) => {
            const attr = s.attributes
            const limits = attr.limits || {}
            const no = i + idx + 1
            txt += `${no}. *${attr.name}*\n`
            txt += `   ├ ID: \`${attr.id}\`\n`
            txt += `   ├ RAM: \`${formatBytes(limits.memory)}\`\n`
            txt += `   └ CPU: \`${limits.cpu === 0 ? 'Unlimited' : limits.cpu + '%'}\`\n`
        })

        if (isLast) {
            txt += `\n> ✅ Selesai — ${servers.length} server ditampilkan`
        }

        chunks.push(txt)
    }

    return chunks
}

async function handler(m, { sock }) {
    const pteroConfig = config.pterodactyl

    const { server: serverVersion, serverKey } = parseServerVersion(m.command)
    const serverLabel = serverVersion.toUpperCase()

    if (!hasFullAccess(m.sender, serverVersion, m.isOwner)) {
        const userRole = getUserRole(m.sender, serverVersion)
        return m.reply(
            `❌ *ᴀᴋsᴇs ᴅɪᴛᴏʟᴀᴋ*\n\n` +
            `> Kamu tidak punya akses ke *${serverLabel}*\n` +
            `> Role kamu: *${userRole || 'Tidak ada'}*`
        )
    }

    const serverConfig = getServerConfig(pteroConfig, serverKey)
    const missingConfig = validateServerConfig(serverConfig)

    if (missingConfig.length > 0) {
        const available = getAvailableServers(pteroConfig)
        let txt = `⚠️ *sᴇʀᴠᴇʀ ${serverLabel} ʙᴇʟᴜᴍ ᴋᴏɴꜰɪɢ*\n\n`
        if (available.length > 0) {
            txt += `> Server tersedia: *${available.join(', ')}*\n`
            txt += `> Contoh: \`${m.prefix}listserver${available[0]}\``
        } else {
            txt += `> Isi config pterodactyl di \`config.js\``
        }
        return m.reply(txt)
    }

    try {
        await m.reply(`🕕 Mengambil daftar server dari *${serverLabel}*...`)

        const servers = await fetchAllServers(serverConfig)

        if (servers.length === 0) {
            return m.reply(`📋 *ᴅᴀꜰᴛᴀʀ sᴇʀᴠᴇʀ [${serverLabel}]*\n\n> Tidak ada server terdaftar.`)
        }

        const chunks = buildServerChunks(servers, serverLabel, 15)

        for (const chunk of chunks) {
            await m.reply(chunk)
            
            if (chunks.length > 1) await new Promise(r => setTimeout(r, 500))
        }

        const available = getAvailableServers(pteroConfig)
        const others = available.filter(s => s !== serverVersion)
        if (others.length > 0) {
            await m.reply(`> 💡 Server lain tersedia: *${others.join(', ')}*`)
        }

    } catch (err) {
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

export { pluginConfig as config, handler }