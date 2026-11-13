import axios from "axios";

const pluginConfig = {
  name: "cuaca",
  alias: ["weather", "cuacahari"],
  category: "info",
  description: "Cek cuaca kota tertentu",
  usage: ".cuaca <nama kota>",
  example: ".cuaca Jakarta",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const weatherCodes = {
  0: { label: "Cerah", emoji: "☀️" },
  1: { label: "Sebagian Cerah", emoji: "🌤️" },
  2: { label: "Berawan Sebagian", emoji: "⛅" },
  3: { label: "Mendung", emoji: "☁️" },
  45: { label: "Berkabut", emoji: "🌫️" },
  48: { label: "Kabut Beku", emoji: "🌫️" },
  51: { label: "Gerimis Ringan", emoji: "🌦️" },
  53: { label: "Gerimis Sedang", emoji: "🌦️" },
  55: { label: "Gerimis Lebat", emoji: "🌧️" },
  61: { label: "Hujan Ringan", emoji: "🌧️" },
  63: { label: "Hujan Sedang", emoji: "🌧️" },
  65: { label: "Hujan Lebat", emoji: "🌧️" },
  71: { label: "Salju Ringan", emoji: "🌨️" },
  73: { label: "Salju Sedang", emoji: "🌨️" },
  75: { label: "Salju Lebat", emoji: "❄️" },
  80: { label: "Hujan Lokal", emoji: "🌦️" },
  81: { label: "Hujan Lokal Sedang", emoji: "🌧️" },
  82: { label: "Hujan Lokal Lebat", emoji: "⛈️" },
  95: { label: "Badai Petir", emoji: "⛈️" },
  96: { label: "Badai Petir + Hujan Es", emoji: "⛈️" },
  99: { label: "Badai Petir Lebat", emoji: "🌩️" },
};

function getWeatherInfo(code) {
  return weatherCodes[code] || { label: "Tidak Diketahui", emoji: "🌡️" };
}

function getWindDirection(degree) {
  const dirs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
  return dirs[Math.round(degree / 45) % 8];
}

function getUVLabel(uv) {
  if (uv <= 2) return "Rendah 🟢";
  if (uv <= 5) return "Sedang 🟡";
  if (uv <= 7) return "Tinggi 🟠";
  if (uv <= 10) return "Sangat Tinggi 🔴";
  return "Ekstrem ⚫";
}

async function handler(m, { sock }) {
  const kota = m.args?.join(" ") || m.text?.trim();

  if (!kota) {
    return m.reply("❌ Masukkan nama kota!\n\nContoh: `.cuaca Jakarta`");
  }

  try {
    await m.reply(`🔍 Mencari cuaca untuk *${kota}*...`);

    const geoRes = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
      params: {
        name: kota,
        count: 1,
        language: "id",
        format: "json",
      },
      timeout: 10000,
    });

    const results = geoRes.data?.results;
    if (!results || results.length === 0) {
      return m.reply(`❌ Kota *${kota}* tidak ditemukan.\n\nCoba gunakan nama kota dalam Bahasa Inggris, contoh: *Makassar*, *Surabaya*, *Bandung*`);
    }

    const location = results[0];
    const { latitude, longitude, name, country, admin1 } = location;

    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude,
        longitude,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "uv_index",
          "precipitation",
          "ichigo_cover",
          "visibility",
        ].join(","),
        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "weather_code",
          "precipitation_sum",
          "sunrise",
          "sunset",
        ].join(","),
        timezone: "Asia/Makassar",
        forecast_days: 4,
      },
      timeout: 10000,
    });

    const current = weatherRes.data.current;
    const daily = weatherRes.data.daily;
    const weather = getWeatherInfo(current.weather_code);

    const suhu = current.temperature_2m;
    const suhuRasa = current.apparent_temperature;
    const kelembaban = current.relative_humidity_2m;
    const angin = current.wind_speed_10m;
    const arahAngin = getWindDirection(current.wind_direction_10m);
    const uv = current.uv_index;
    const hujan = current.precipitation;
    const awan = current.ichigo_cover;
    const visibilitas = current.visibility ? (current.visibility / 1000).toFixed(1) : "N/A";

    const sunrise = daily.sunrise?.[0]?.split("T")[1] || "N/A";
    const sunset = daily.sunset?.[0]?.split("T")[1] || "N/A";

    const hariList = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    let forecastText = "";
    for (let i = 1; i <= 3; i++) {
      const date = new Date(daily.time[i]);
      const hari = hariList[date.getDay()];
      const wInfo = getWeatherInfo(daily.weather_code[i]);
      const max = daily.temperature_2m_max[i];
      const min = daily.temperature_2m_min[i];
      const rain = daily.precipitation_sum[i];
      forecastText += `│ ${wInfo.emoji} *${hari}* — ${min}°C / ${max}°C`;
      if (rain > 0) forecastText += ` 💧${rain}mm`;
      forecastText += `\n`;
    }

    const lokasi = [name, admin1, country].filter(Boolean).join(", ");

    const text = `${weather.emoji} *CUACA HARI INI*
╭─〔 📍 *${lokasi}* 〕
│ 🌡️ Suhu      : *${suhu}°C* (terasa ${suhuRasa}°C)
│ ${weather.emoji} Kondisi   : *${weather.label}*
│ 💧 Kelembaban: *${kelembaban}%*
│ 🌬️ Angin     : *${angin} km/h* (${arahAngin})
│ ☁️ Tutupan   : *${awan}%*
│ 👁️ Jarak     : *${visibilitas} km*
│ ☔ Hujan     : *${hujan} mm*
│ 🔆 UV Index  : *${getUVLabel(uv)}*
│ 🌅 Sunrise   : *${sunrise}*
│ 🌇 Sunset    : *${sunset}*
╰────────────────⬣

📅 *PRAKIRAAN 3 HARI*
╭────────────────
${forecastText}╰────────────────⬣

> _Data dari Open-Meteo • ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}_`;

    await sock.sendMessage(
      m.chat,
      { text },
      { quoted: m }
    );

  } catch (error) {
    console.error("[cuaca] Error:", error.message);
    await m.reply("❌ Gagal mengambil data cuaca. Coba lagi nanti.\n> " + error.message);
  }
}

export default {
  config: pluginConfig,
  handler,
};