const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json"
};

export async function AmpremSend(email) {
  try {
    const url = `https://generator-amprem.zone.id/api/amsend?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    return { status: true, data };
  } catch (error) {
    return { status: false, error: error.message };
  }
}

export async function AmpremVerif(email, link) {
  try {
    const url = `https://generator-amprem.zone.id/api/amverif?email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}`;
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    return { status: true, data };
  } catch (error) {
    return { status: false, error: error.message };
  }
}