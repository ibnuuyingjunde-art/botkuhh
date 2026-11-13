import config from "../../config.js";

const pluginConfig = {
  name: "roast",
  alias: ["bully", "hina", "ejek"],
  category: "fun",
  description: "Roast seseorang tanpa filter",
  usage: ".roast @tag",
  example: ".roast @user",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

const ROAST_LIST = [
  "Anjing bro, mukamu tuh kayak hasil lab yang gagal — ilmuwan pun minta maaf sama dunia udah nyiptain kamu 💀",
  "Kontol, otakmu tuh kayak tempat sampah TPA — penuh, bau, dan semua isinya sampah yang gak ada gunanya 😂",
  "Babi, kehadiranmu di grup ini tuh kayak virus corona — semua orang berharap kamu cepet ilang dan gak balik lagi 💀",
  "Tolol banget sih, kamu tuh kayak jawaban ujian yang diisi asal — salah semua, memalukan, dan bikin gurunya nangis 🤣",
  "Bangsat, hidupmu tuh kayak draft yang gak pernah jadi — ada tapi gak kelar-kelar, dan semua orang udah bosen nunggu 💀",
  "Idiot parah, ngomong sama kamu tuh kayak ngajarin batu ngomong — capek, gak ada hasilnya, dan akhirnya nyerah sendiri 😭",
  "Anjir goblok, kamu tuh kayak software bajakan — cacat dari awal, penuh bug, dan cepet atau lambat pasti crash 💀",
  "Tai banget sih kamu, mukamu tuh level 'bikin CCTV minta resign' — kamera aja gak mau nyimpen wajah kamu 😂",
  "Kontol ngentot, IQ kamu tuh minus dan itu bukan hiperbola — hasil tesnya beneran bikin psikolog pensiun dini 💀",
  "Brengsek, kamu tuh kayak kentut di masjid — datang gak diundang, ganggu semua orang, dan bikin malu yang ada di sekitarnya 🤣",
  "Goblok akut, cara berpikirmu tuh kayak flat earther — salah total, gak bisa dibenerin, dan bikin orang sekitar malu 💀",
  "Anjing buduk, personality kamu tuh kosong kayak dompet kamu — gak ada isinya dan semua orang udah tau itu 😂",
  "Tolol level dewa, kamu tuh kayak buku yang covernya aja udah jelek — isinya bahkan lebih buruk dari yang orang kira 💀",
  "Babi ngepet, eksistensimu tuh kayak footnote yang ke-999 — ada tapi gak ada satupun orang yang sampe sana buat baca 🤣",
  "Idiot stadium akhir, omonganmu tuh kayak iklan pinjol — ganggu, gak ada yang minta, dan semua orang langsung skip 💀",
  "Bangsat kurang ajar, kamu tuh kayak charger yang kabelnya putus — keliatan ada tapi gak bisa ngapa-ngapain 😭",
  "Kontol item, nasibmu tuh kayak startup gagal seri A — udah minta-minta resources orang lain tapi gak pernah growth 💀",
  "Goblok tolol, kehadiranmu tuh kayak error message yang terus muncul — ganggu, bikin frustrasi, dan semua orang pengen close 😂",
  "Anjing kampung, kamu tuh kayak wifi yang passwordnya gak ada yang mau kasih tau — semua orang sengaja block kamu 💀",
  "Babi hutan, attitude kamu tuh kayak daging busuk — makin lama makin bau dan makin bikin orang jauh 🤣",
  "Tai kucing, kamu tuh kayak malware — masuk gak diundang, ngerusak dari dalem, dan susah banget buat dibuang 💀",
  "Tolol paripurna, masa depanmu tuh kayak meteor yang lagi jatuh — semua udah tau ujungnya dan gak ada yang bisa nolong 😂",
  "Brengsek gak tau diri, kontribusimu di hidup orang tuh kayak virus — ada cuma buat ngerusak dan bikin orang sakit 💀",
  "Idiot gak ketulungan, mukamu tuh kayak CAPTCHA yang expired — sistem aja nolak kamu duluan sebelum orang sempet mikir 🤣",
  "Anjing blo'on, kamu tuh kayak typo di cover skripsi — memalukan, permanen, dan bikin semua orang yang liat auto kasian 💀",
  "Goblok parah, otak kamu tuh kayak recycle bin penuh — isinya cuma sampah yang udah lama harusnya dibuang 😭",
  "Bangsat tolol, kamu tuh kayak plot twist yang gak perlu — ngrusak semuanya dan semua orang wish kamu gak pernah exist 💀",
  "Babi gembel, keberadaanmu tuh kayak watermark bajakan — ganggu, norak, dan semua orang cari cara ngilangin kamu 😂",
  "Kontol goblok, kamu tuh kayak loading bar yang stuck — udah bikin orang harap-harap cemas tapi ujungnya gak deliver apa-apa 💀",
  "Idiot mampus, personality kamu tuh sekosong mall bangkrut — besar, keliatan ada, tapi pas dicari isinya gak ada yang worth it 🤣",
];

const ROAST_INTRO = [
  "Oke dengerin baik-baik tolol",
  "Gue gak tanggung jawab kalau mental kamu rontok",
  "Data udah dianalisis, hasilnya lebih parah dari dugaan",
  "Minta sendiri, nangis sendiri, goblok",
  "Ini bukan serangan pribadi, ini fakta objektif yang menyakitkan",
  "Semua orang udah mikirin ini, gue cuma yang berani ngomong",
  "Siap-siap mental breakdown ya",
  "Ini pesanan kamu, terima dengan lapang dada",
  "Gue udah coba cari sisi positifmu, gagal total",
  "Jangan salahkan gue, salahkan cermin yang selama ini bohong ke kamu",
];

async function handler(m, { sock }) {
  const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
  const target = mentioned[0] || quoted;

  if (!target) {
    return m.reply(
      `❌ Tag dulu orangnya tolol!\n\n` +
      `Contoh: \`${m.prefix}roast @user\``
    );
  }

  const targetName = target.split("@")[0];
  const roast = ROAST_LIST[Math.floor(Math.random() * ROAST_LIST.length)];
  const intro = ROAST_INTRO[Math.floor(Math.random() * ROAST_INTRO.length)];

  await sock.sendMessage(
    m.chat,
    {
      text: `🔥 *ROAST* 🔥\n\n@${targetName} — ${intro}...\n\n_"${roast}"_\n\n💀 _— dikirim atas nama ${m.pushName} yang sama sekali gak nyesel_`,
      mentions: [target, m.sender],
    },
    { quoted: m }
  );
}

export { pluginConfig as config, handler };