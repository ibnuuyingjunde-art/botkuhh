import axios from 'axios'
import FormData from 'form-data'
import { createCanvas, loadImage, GlobalFonts } from "../../src/lib/ichigo-canvas-lazy.js"
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const pluginConfig = {
  name: "fmeme",
  alias: ["polisimeme"],
  category: "canvas",
  description: "Membuat meme interaktif berbasis canvas teks polisi",
  usage: ".fmeme <kata-kata>",
  example: ".fmeme Katanya just friend kok manggil sayang",
  cooldown: 10,
  energi: 1,
  isEnabled: true,
}

async function uploadUguu(buffer) {
  let form = new FormData()
  form.append('files[]', buffer, 'image.png')

  const { data } = await axios.post('https://uguu.se/upload.php', form, {
    headers: form.getHeaders()
  })

  return data.files[0].url
}

async function handler(m, { sock, text, prefix, command }) {
  if (!text) {
    return m.reply(`*Format Salah, Kak!* ✨\n\n> Contoh penggunaan:\n\`${prefix + command} Katanya just friend kok manggil sayang\`\n> Atau pakai custom nama:\n\`${prefix + command} Rin|Katanya just friend kok manggil sayang\``)
  }

  let txtUsername, txtMeme
  if (text.includes('|')) {
    const parts = text.split('|')
    txtUsername = parts[0].trim()
    txtMeme = parts.slice(1).join('|').trim()
  } else {
    txtUsername = m.pushName || "Fikzz"
    txtMeme = text.trim()
  }

  txtUsername = txtUsername.startsWith('~') ? txtUsername : `~ ${txtUsername}`

  await m.react("⏳")

  try {
    const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/IMG-20260710-WA1772.jpg'
    const ASSETS_DIR = join(process.cwd(), 'assets', 'polisimeme')
    const FONTS_DIR = join(ASSETS_DIR, 'fonts')
    const BG_LOCAL = join(ASSETS_DIR, 'template_polisi.png')

    await mkdir(FONTS_DIR, { recursive: true })
    await mkdir(join(process.cwd(), 'tmp'), { recursive: true })

    const fontConfigs = [
      { url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', name: 'Inter-Bold.ttf', family: 'MemeInterBold' }
    ]

    for (const f of fontConfigs) {
      const fPath = join(FONTS_DIR, f.name)
      if (!existsSync(fPath)) {
        const fRes = await axios.get(f.url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } })
        await writeFile(fPath, Buffer.from(fRes.data))
      }
      GlobalFonts.registerFromPath(fPath, f.family)
    }

    if (!existsSync(BG_LOCAL)) {
      const res = await axios.get(BG_URL, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } })
      await writeFile(BG_LOCAL, Buffer.from(res.data))
    }

    const bgImg = await loadImage(BG_LOCAL)
    const canvas = createCanvas(bgImg.width, bgImg.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)

    const paperX = 404
    const paperY = 324
    const paperW = 53
    const paperH = 120

    let fontSize = 23
    let lineHeight = 31

    const senderSize = 15
    const senderOffset = 0
    
    const words = txtMeme.split(/\s+/)
    const lines = []
    for (let i = 0; i < words.length; i += 2) {
      const pair = words.slice(i, i + 2).join(' ')
      if (pair) lines.push(pair)
    }

    const safetyMargin = senderSize + senderOffset + 10
    const maxTextHeight = paperH - safetyMargin

    while (fontSize > 8) {
      const totalHeight = lines.length * lineHeight
      if (totalHeight <= maxTextHeight) {
        break
      }
      fontSize -= 1
      lineHeight -= 1.2
    }

    const centerX = paperX + (paperW / 2)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = '#262626'
    ctx.font = `bold ${senderSize}px MemeInterBold`
    ctx.fillText(txtUsername, centerX, paperY + paperH - senderOffset)

    const totalTextHeight = lines.length * lineHeight
    let startY = paperY + ((maxTextHeight - totalTextHeight) / 2)
    if (startY < paperY) startY = paperY

    ctx.textBaseline = 'top'
    ctx.font = `bold ${fontSize}px MemeInterBold`

    lines.forEach((line, index) => {
      const currentY = startY + (index * lineHeight)
      if (currentY + fontSize <= paperY + maxTextHeight) {
        ctx.fillText(line, centerX, currentY)
      }
    })

    const canvasBuffer = await canvas.encode('png')
    let url = await uploadUguu(canvasBuffer)

    await sock.sendMessage(m.chat, {
      image: { url },
      caption: `💬 *Meme Text:* "${txtMeme}"\n👤 *By:* ${txtUsername}`
    }, { quoted: m })

    await m.react("✅")

  } catch (e) {
    console.error("[Fmeme Error]", e)
    await m.react("❌")
    throw 'Maaf Kak, terjadi kendala saat memproses gambar meme.'
  }
}

export { pluginConfig as config, handler }