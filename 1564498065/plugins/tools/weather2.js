import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { Button, Carousel } = IchigoBuilder;
import te from "../../src/lib/ichigo-error.js";
import { f } from "../../src/lib/ichigo-http.js";

const pluginConfig = {
  name: "weather2",
  alias: ["cuaca2", "forecast"],
  category: "tools",
  description: "Perkiraan cuaca 5 hari ke depan dalam bentuk carousel",
  usage: ".weather2 <kota>",
  example: ".weather2 Jakarta",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const FORECAST_DAYS = 5;

const WEATHER_CODE = {
  0: ["Cerah", "01d"],
  1: ["Cerah berawan sebagian", "02d"],
  2: ["Berawan sebagian", "03d"],
  3: ["Mendung", "04d"],
  45: ["Berkabut", "50d"],
  48: ["Kabut beku", "50d"],
  51: ["Gerimis ringan", "09d"],
  53: ["Gerimis sedang", "09d"],
  55: ["Gerimis lebat", "09d"],
  61: ["Hujan ringan", "10d"],
  63: ["Hujan sedang", "10d"],
  65: ["Hujan lebat", "10d"],
  71: ["Salju ringan", "13d"],
  73: ["Salju sedang", "13d"],
  75: ["Salju lebat", "13d"],
  80: ["Hujan lokal ringan", "09d"],
  81: ["Hujan lokal sedang", "09d"],
  82: ["Hujan lokal lebat", "11d"],
  95: ["Badai petir", "11d"],
  96: ["Badai petir dengan hujan es ringan", "11d"],
  99: ["Badai petir dengan hujan es lebat", "11d"],
};

function describeCode(code) {
  return WEATHER_CODE[code] || ["Tidak diketahui", "01d"];
}

function iconUrl(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

async function handler(m, { sock }) {
  const query = m.text?.trim();
  if (!query) {
    return m.reply(`WEATHER FORECAST\n\nContoh:\n${m.prefix}weather2 Jakarta`);
  }
  m.react("🕕");

  try {
    
    const geo = await f(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=id&format=json`,
    );
    const place = geo?.results?.[0];

    if (!place) {
      m.react("❌");
      return m.reply("Lokasi tidak ditemukan. Coba nama kota lain.");
    }

    const w = await f(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
      `&forecast_days=${FORECAST_DAYS}&timezone=auto`,
    );

    const daily = w?.daily;
    if (!daily?.time?.length) throw new Error("Data cuaca tidak tersedia dari server.");

    const locationLabel = [place.name, place.admin1, place.country]
      .filter(Boolean)
      .join(", ");

    const carousel = new Carousel(sock)
      .setBody(`Perkiraan cuaca 5 hari: ${locationLabel}`)
      .setFooter("Swipe untuk lihat hari berikutnya");

    for (let i = 0; i < daily.time.length; i++) {
      const [desc, icon] = describeCode(daily.weather_code[i]);
      const dateLabel = new Date(daily.time[i]).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

      const card = await new Button(sock)
        .setTitle(dateLabel)
        .setBody(
          `${desc}\n` +
          `Suhu: ${daily.temperature_2m_min[i]}°C - ${daily.temperature_2m_max[i]}°C\n` +
          `Curah hujan: ${daily.precipitation_sum[i]} mm\n` +
          `Angin maks: ${daily.wind_speed_10m_max[i]} km/j`,
        )
        .setFooter(locationLabel)
        .setImage(iconUrl(icon))
        .toCard();

      carousel.addCard(card);
    }

    await carousel.send(m.chat, { quoted: m });
    m.react("✅");
  } catch (err) {
    console.error("[Weather2] Error:", err.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { pluginConfig as config, handler };