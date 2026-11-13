import { downloadMediaMessage } from "ichigo";
import config from "../../config.js";
import { uploadImage } from "../../src/lib/ichigo-uploader.js";
import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";
import te from "../../src/lib/ichigo-error.js";

const pluginConfig = {
  name: "aicard",
  alias: ["aiportfolio", "a2ui", "cardai"],
  category: "ai",
  description: "Bikin kartu interaktif (a2ui widget) otomatis pakai Gemini AI dari deskripsi singkat",
  usage: ".aicard <deskripsi diri/topik>\n(bisa reply/kirim gambar buat foto profil)",
  example: ".aicard Panda raksasa pecinta bambu dan tidur siang",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 3,
  isEnabled: true,
};

const DEFAULT_IMAGE_URL = "https://files.catbox.moe/ms64an.jpeg";

const API_BASE = "https://api.theresav.eu/api/ai/gemini";
const API_KEY = "TayRooAPIkey";

async function askGemini(message) {
  const url = new URL(API_BASE);
  url.searchParams.set("prompt", message);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "x-apikey": API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.result ?? data.message ?? data.text ?? "";
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function generateCardContent(topic) {
  const fallback = {
    title: topic.length > 40 ? topic.slice(0, 40) + "..." : topic,
    tagline: topic,
    aboutTitle: "Tentang",
    aboutContent: topic,
    skillsText: "Info: " + topic,
    projects: [
      { title: "Highlight 1", description: topic },
      { title: "Highlight 2", description: topic },
      { title: "Highlight 3", description: topic },
    ],
    footerText: "Dibuat otomatis",
  };

  try {
    const prompt =
      `Kamu adalah generator konten kartu profil interaktif untuk WhatsApp bot. ` +
      `Berdasarkan topik/deskripsi berikut, buat konten kartu dalam Bahasa Indonesia ` +
      `yang santai, singkat, dan menarik. Balas HANYA dengan satu objek JSON valid, ` +
      `TANPA markdown code fence, TANPA teks lain di luar objek JSON, dengan struktur ` +
      `persis seperti ini:\n\n` +
      `{\n` +
      `  "title": "judul utama kartu, maks 6 kata",\n` +
      `  "tagline": "satu kalimat deskripsi singkat, maks 20 kata",\n` +
      `  "aboutTitle": "judul section (misal: Tentang Saya)",\n` +
      `  "aboutContent": "paragraf tentang topik ini, maks 40 kata",\n` +
      `  "skillsText": "daftar 4-6 keahlian/ciri khas dipisah tanda • dalam satu baris",\n` +
      `  "projects": [\n` +
      `    { "title": "judul highlight 1, maks 4 kata", "description": "deskripsi singkat, maks 20 kata" },\n` +
      `    { "title": "judul highlight 2, maks 4 kata", "description": "deskripsi singkat, maks 20 kata" },\n` +
      `    { "title": "judul highlight 3, maks 4 kata", "description": "deskripsi singkat, maks 20 kata" }\n` +
      `  ],\n` +
      `  "footerText": "satu baris status/info penutup, maks 15 kata"\n` +
      `}\n\n` +
      `Topik: ${topic}`;

    const rawText = await askGemini(prompt);
    if (!rawText) return fallback;

    const parsed = extractJson(rawText);
    if (!parsed?.title || !Array.isArray(parsed?.projects)) return fallback;

    return {
      title: parsed.title || fallback.title,
      tagline: parsed.tagline || fallback.tagline,
      aboutTitle: parsed.aboutTitle || fallback.aboutTitle,
      aboutContent: parsed.aboutContent || fallback.aboutContent,
      skillsText: parsed.skillsText || fallback.skillsText,
      projects: (parsed.projects.length ? parsed.projects : fallback.projects).slice(0, 3),
      footerText: parsed.footerText || fallback.footerText,
    };
  } catch (e) {
    return fallback;
  }
}

function buildWidget(content, imageUrl) {
  const ui = new A2UI();

  const header = ui.text(content.title, { variant: "h1" });
  const profileImage = ui.image(imageUrl, { variant: "header", fit: "none" });
  const profileText = ui.text(content.tagline, { variant: "body" });
  const profileSection = ui.column([profileImage, profileText]);

  const aboutTitle = ui.text(content.aboutTitle, { variant: "h2" });
  const aboutContent = ui.text(content.aboutContent, { variant: "body" });
  const aboutSection = ui.column([aboutTitle, aboutContent]);

  const skills = ui.text(content.skillsText, { variant: "caption" });

  const projectsTitle = ui.text("Highlight", { variant: "h2" });
  const projectIds = content.projects.map((proj) => {
    const title = ui.text(proj.title, { variant: "h3" });
    const desc = ui.text(proj.description, { variant: "body" });
    const body = ui.column([title, desc]);
    return ui.card(body);
  });
  const projectsSection = ui.column([projectsTitle, ...projectIds]);

  const contact = ui.text(content.footerText, { variant: "caption" });

  ui.root([header, profileSection, aboutSection, skills, projectsSection, contact]);

  return ui;
}

async function handler(m, { sock }) {
  const topic = m.args.join(" ");
  if (!topic) {
    return m.reply(
      `🪄 *AI Card*\n\n` +
        `> Bikin kartu interaktif otomatis pakai AI\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}aicard <deskripsi diri/topik>*\n` +
        `> Bisa reply/kirim gambar buat dipakai sebagai foto profil kartu\n\n` +
        `*CONTOH:*\n` +
        `> *${m.prefix}aicard Panda raksasa pecinta bambu dan tidur siang*`
    );
  }

  await m.react("🕕");

  try {
    
    let imageUrl = DEFAULT_IMAGE_URL;
    let imageMsg = null;
    if (m.quoted?.message?.imageMessage) imageMsg = { key: m.quoted.key, message: m.quoted.message };
    else if (m.message?.imageMessage) imageMsg = { key: m.key, message: m.message };

    if (imageMsg) {
      try {
        const buffer = await downloadMediaMessage(imageMsg, "buffer", {});
        const uploadedPath = await uploadImage(buffer, "aicard.jpg");
        if (uploadedPath) imageUrl = uploadedPath;
      } catch {
        
      }
    }

    const content = await generateCardContent(topic);
    const ui = buildWidget(content, imageUrl);

    const bodyLines = [content.title];
    if (content.tagline && content.tagline.trim() !== content.title.trim()) {
      bodyLines.push(content.tagline);
    }

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      bodyText: bodyLines.join("\n"),
      footer: `• ${config.botName || "AI Card"}`,
      buttons: [
        {
          params: {
            display_text: "Kunjungi",
            url: config.store?.website || "https://ichigostore.my.id",
            merchant_url: config.store?.website || "https://ichigostore.my.id",
          },
        },
        {
          params: {
            display_text: "Channel",
            url: config.channel?.link || "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c",
            merchant_url: config.channel?.link || "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c",
          },
        },
      ],
      expiration: 7776000,
    });

    await m.react("✅");
  } catch (e) {
    console.error(e);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };