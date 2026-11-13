import te from '../../src/lib/ichigo-error.js'

const pluginConfig = {
    name: 'cjstoesm',
    alias: ['cjs2esm', 'cjsconvert'],
    category: 'tools',
    description: 'Convert CommonJS ke ESM dengan auto pluginConfig',
    usage: '.cjstoesm <reply kode>',
    example: '.cjstoesm',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

function detectPluginPattern(code) {
    const hasHandler = /(?:let|const)\s+handler\s*=|async\s+function\s+handler/.test(code)
    const hasPluginConfig = /pluginConfig|handler\.command/.test(code)

    let commandName = null
    const cmdMatch1 = code.match(/handler\.command\s*=\s*\[\s*['"](\w+)['"]\s*\]/)
    const cmdMatch2 = code.match(/handler\.command\s*=\s*['"](\w+)['"]/)
    const cmdMatch3 = code.match(/handler\.command\s*=\s*\[?\s*['"]?(\w+)['"]?\]?/)
    
    commandName = cmdMatch1?.[1] || cmdMatch2?.[1] || cmdMatch3?.[1] || null
    
    return {
        isPlugin: hasHandler || hasPluginConfig,
        hasHandler,
        commandName
    }
}

function generatePluginConfig(commandName = 'unnamed') {
    return `const pluginConfig = {
  name: '${commandName}',
  alias: [],
  category: 'tools',
  description: 'Deskripsi plugin',
  usage: '.${commandName} <args>',
  example: '.${commandName}',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};`
}

function convertCjsToEsm(code, isPlugin = false) {
    let result = code

    result = result.replace(/(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g, (match, imports, importPath) => {
        const items = imports.split(',').map(i => {
            const parts = i.trim().split(/\s*:\s*/)
            if (parts.length === 2) return `${parts[0].trim()} as ${parts[1].trim()}`
            return parts[0].trim()
        })
        return `import { ${items.join(', ')} } from '${importPath}';`
    })

    result = result.replace(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\.(\w+)\s*;?/g, (match, name, importPath, prop) => {
        if (name === prop) return `import { ${prop} } from '${importPath}';`
        return `import { ${prop} as ${name} } from '${importPath}';`
    })

    result = result.replace(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\.default\s*;?/g, (match, name, importPath) => {
        return `import ${name} from '${importPath}';`
    })

    result = result.replace(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g, (match, name, importPath) => {
        return `import ${name} from '${importPath}';`
    })

    result = result.replace(/^require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?$/gm, (match, importPath) => {
        return `import '${importPath}';`
    })

    result = result.replace(/module\.exports\s*=\s*\{([^}]+)\}\s*;?/g, (match, exports) => {
        const items = exports.split(',').map(i => {
            const parts = i.trim().split(/\s*:\s*/)
            if (parts.length === 2) return `${parts[1].trim()} as ${parts[0].trim()}`
            return parts[0].trim()
        })
        return `export { ${items.join(', ')} };`
    })

    result = result.replace(/module\.exports\s*=\s*(async\s+)?(function|class)\s+(\w+)\s*(\([^)]*\))?\s*\{/g, (match, asyncKw, type, name, params) => {
        if (isPlugin && name === 'handler') {
            return `${asyncKw || ''}${type} ${name}${params || ''} {`
        }
        return `export default ${asyncKw || ''}${type} ${name}${params || ''} {`
    })

    result = result.replace(/module\.exports\s*=\s*(async\s+)?(function|class)\s*(\([^)]*\))?\s*\{/g, (match, asyncKw, type, params) => {
        if (isPlugin) {
            return `${asyncKw || ''}${type}${params || ''} {`
        }
        return `export default ${asyncKw || ''}${type}${params || ''} {`
    })

    result = result.replace(/module\.exports\s*=\s*handler\s*;?/g, () => {
        return ''
    })

    result = result.replace(/module\.exports\s*=\s*(async\s+)?\(([^)]*)\)\s*=>/g, (match, asyncKw, params) => {
        if (isPlugin) {
            return `const handler = ${asyncKw || ''}(${params}) =>`
        }
        return `export default ${asyncKw || ''}(${params}) =>`
    })

    result = result.replace(/module\.exports\s*=\s*([^;\n]+)\s*;?$/gm, (match, value) => {
        if (value.trim() === 'handler') return ''
        return `export default ${value};`
    })

    result = result.replace(/exports\.(\w+)\s*=\s*(async\s+)?function\s*(\w*)\s*(\([^)]*\))?\s*\{/g, (match, exportName, asyncKw, name, params) => {
        return `export ${asyncKw || ''}function ${exportName}${params || ''} {`
    })

    result = result.replace(/exports\.(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*=>\s*\{/g, (match, exportName, asyncKw, params) => {
        return `export const ${exportName} = ${asyncKw || ''}(${params}) => {`
    })

    result = result.replace(/exports\.(\w+)\s*=\s*(\w+)\s*;?/g, (match, key, value) => {
        if (key === value) return `export { ${key} };`
        return `export { ${value} as ${key} };`
    })

    result = result.replace(/exports\.(\w+)\s*=\s*([^;\n]+)\s*;?/g, (match, key, value) => {
        if (/^(async|function|\(|class)/.test(value.trim())) return match
        return `export const ${key} = ${value};`
    })

    result = result.replace(/module\.exports\.(\w+)\s*=\s*(\w+)\s*;?/g, (match, key, value) => {
        if (key === value) return `export { ${key} };`
        return `export { ${value} as ${key} };`
    })

    result = result.replace(/Object\.assign\s*\(\s*module\.exports\s*,\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*;?/g, (match, importPath) => {
        return `export * from '${importPath}';`
    })

    result = result.replace(/handler\.command\s*=\s*\[?['"]?(\w+)['"]?\]?\s*;?/g, '')

    if ((result.includes('__dirname') || result.includes('__filename')) && !result.includes('fileURLToPath')) {
        const helperCode = `import { fileURLToPath } from 'url';\nimport { dirname } from 'path';\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\n\n`
        result = helperCode + result
    }

    result = result.replace(/\n{3,}/g, '\n\n')

    return result.trim()
}

function formatAsPlugin(convertedCode, commandName = 'unnamed') {
    const pluginConfigCode = generatePluginConfig(commandName)
    
    let handlerCode = convertedCode.trim()

    handlerCode = handlerCode.replace(/handler\.command\s*=\s*.*?;/g, '')
    handlerCode = handlerCode.replace(/export\s*{[^}]*handler[^}]*};?/g, '')
    handlerCode = handlerCode.replace(/export\s+default\s+handler;?/g, '')

    if (handlerCode.includes('const handler') || handlerCode.includes('let handler')) {
        
        handlerCode = handlerCode.replace(/(?:const|let)\s+handler\s*=\s*/, '')

        if (!handlerCode.includes('async')) {
            handlerCode = 'async ' + handlerCode
        }

        handlerCode = handlerCode.replace(/^(async\s+)\((.*?)\)\s*=>/, '$1function handler($2)')

        handlerCode = handlerCode.replace(/\{\s*alip\s*,/, '{ sock,')
        handlerCode = handlerCode.replace(/,\s*alip\s*\}/, ', sock }')
        handlerCode = handlerCode.replace(/\{\s*alip\s*\}/, '{ sock }')

        if (!handlerCode.match(/function\s+handler\s*\(\s*m\s*,/)) {
            
            handlerCode = handlerCode.replace(/function\s*\(\s*m\s*,/, 'function handler(m,')
        }
    }

    handlerCode = handlerCode.trim()
    if (!handlerCode.endsWith('}')) {
        handlerCode = handlerCode + '\n}'
    }
    
    const exportLine = `\n\nexport { pluginConfig as config, handler };`
    
    return `${pluginConfigCode}\n\n${handlerCode}${exportLine}`
}

async function handler(m, { sock }) {
    let code = m.quotedBody || m.text?.trim()

    if (!code) {
        return m.reply(
            `🔄 *ᴄᴊs ᴛᴏ ᴇsᴍ ᴄᴏɴᴠᴇʀᴛᴇʀ*\n\n` +
            `> Convert CommonJS ke ES Modules + auto pluginConfig\n\n` +
            `> *Cara pakai:*\n` +
            `> Reply kode CJS dengan ${m.prefix}${m.command}\n\n` +
            `> *Output:*\n` +
            `> • Format ESM standar (jika code biasa)\n` +
            `> • Format plugin lengkap (jika ada handler function)\n\n` +
            `> *Contoh CJS biasa:*\n` +
            `> \`const axios = require('axios')\`\n\n` +
            `> *Contoh plugin CJS:*\n` +
            `> \`let handler = async (m, { alip, text }) => {...}\`\n` +
            `> \`handler.command = ['ping']\``
        )
    }

    await m.react('⏳')

    try {
        const pattern = detectPluginPattern(code)
        const converted = convertCjsToEsm(code, pattern.isPlugin)
        
        let output = converted

        if (pattern.isPlugin && pattern.hasHandler && pattern.commandName) {
            output = formatAsPlugin(converted, pattern.commandName)

            if (!output.includes('export { pluginConfig as config, handler }')) {
                throw new Error('❌ Output plugin tidak valid - missing export statement')
            }
        } else if (pattern.isPlugin && pattern.hasHandler && !pattern.commandName) {
            return m.reply('❌ *Handler terdeteksi tapi tidak ada command!*\n\nGunakan format: \`handler.command = [\'commandname\']\`')
        }

        const infoMsg = pattern.isPlugin && pattern.hasHandler
            ? `✅ *Plugin Converted Successfully!*\n\n🔧 *Command:* \`.${pattern.commandName}\`\n📦 *Type:* Plugin (ESM + Config)\n📝 *Lines:* ${output.split('\n').length}`
            : `✅ *Code Converted to ESM!*\n\n📝 *Lines:* ${output.split('\n').length}`

        await m.reply(infoMsg)

        const codeMsg = `\`\`\`javascript\n${output}\n\`\`\``
        await m.reply(codeMsg)

        await m.react('✅')
    } catch (error) {
        console.log('[CJSTOESM ERROR]', error)
        await m.react('☢')
        m.reply(`❌ ${error.message || 'Konversi gagal'}`)
    }
}

export { pluginConfig as config, handler };