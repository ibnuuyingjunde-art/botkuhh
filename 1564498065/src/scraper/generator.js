import axios from 'axios';
import crypto from 'crypto';

class GeneratorEmail {
  constructor() {
    this.baseUrl = 'https://generator.email';
  }

  // Membuat atau menghasilkan format email acak yang kompatibel dengan generator.email
  generateEmail() {
    const randomName = 'am' + Date.now().toString().slice(-6) + crypto.randomInt(100, 999);
    // Domain yang sering digunakan oleh layanan generator.email
    const domains = ['generator.email', 'boximail.com', 'emailnax.com'];
    const chosenDomain = domains[crypto.randomInt(0, domains.length)];
    const email = `${randomName}@${chosenDomain}`;
    
    return {
      email,
      username: randomName,
      domain: chosenDomain
    };
  }

  // Memeriksa inbox / kotak masuk dari email yang digenerate
  async checkInbox(email) {
    try {
      const [name, domain] = email.split('@');
      const res = await axios.get(`${this.baseUrl}/${domain}/${name}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': `${this.baseUrl}/`
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (res.status !== 200 || !res.data) {
        return [];
      }

      const html = res.data;
      const links = [];
      
      // Mengambil link verifikasi / oobCode Firebase atau tautan masuk di dalam HTML inbox
      const oobMatches = html.match(/https?:\/\/[^\s"'<>]+oobCode=[a-zA-Z0-9_-]+/gi);
      if (oobMatches) {
        oobMatches.forEach(u => links.push(u));
      }

      const generalMatches = html.match(/https?:\/\/[^\s"'<>]*alightcreative[^\s"'<>]*/gi);
      if (generalMatches) {
        generalMatches.forEach(u => links.push(u));
      }

      return [...new Set(links)];
    } catch (err) {
      console.error("[GeneratorEmail Error]:", err.message);
      return [];
    }
  }
}

export { GeneratorEmail };
export default GeneratorEmail;