import fetch from "node-fetch";
import te from "../../src/lib/ichigo-error.js";
import { A2UI, sendA2UIWidget } from "../../src/lib/ichigo-ui.js";

const pluginConfig = {
  name: "infogempa1",
  alias: ["gempa1", "bmkg1"],
  category: "information",
  description: "Scraper data peringatan Gempa Terkini langsung dari BMKG",
  usage: ".gempa1",
  example: ".gempa1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  await m.react("🕕");

  try {
    
    const url = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
    const response = await fetch(url);
    
    if (!response.ok) throw new Error("Gagal terhubung ke server BMKG");
    
    const data = await response.json();
    const gempa = data?.Infogempa?.gempa;

    if (!gempa) throw new Error("Data gempa tidak ditemukan");

    const shakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;

    const ui = new A2UI();

    const headerImg = ui.image(shakemapUrl, { variant: "header", fit: "contain" });
    
    const title = ui.text(`[ INFO GEMPA TERKINI ]`, { variant: "h1" });
    const subtitle = ui.text(`Waktu: ${gempa.Tanggal} | ${gempa.Jam}`, { variant: "body" });
    
    const detailText = ui.text(
      `Lokasi: ${gempa.Wilayah}\n` +
      `Magnitude: ${gempa.Magnitude} SR\n` +
      `Kedalaman: ${gempa.Kedalaman}\n` +
      `Koordinat: ${gempa.Lintang}, ${gempa.Bujur}\n` +
      `Potensi: ${gempa.Potensi}`,
      { variant: "body" }
    );

    let dirasakanText = "";
    if (gempa.Dirasakan && gempa.Dirasakan !== "-") {
      dirasakanText = ui.text(`Dirasakan: ${gempa.Dirasakan}`, { variant: "caption" });
    } else {
      dirasakanText = ui.text(`Sumber: BMKG Indonesia`, { variant: "caption" });
    }

    const layoutColumn = ui.column([headerImg, title, subtitle, detailText, dirasakanText]);
    const gempaCard = ui.card(layoutColumn);
    
    ui.root([gempaCard]);

    await sendA2UIWidget(sock, m.chat, {
      a2ui: ui,
      bodyText: `Peringatan Gempa Terkini dari BMKG.`,
      footer: "• A2UI BMKG Scraper",
      buttons: [], 
      quoted: m
    });

    await m.react("✅");

  } catch (err) {
    console.error("[GEMPA_BMKG_ERROR]", err);
    await m.react("☢");
    m.reply(`Gagal mengambil data BMKG: ${err.message || err}`);
  }
}

export { pluginConfig as config, handler };