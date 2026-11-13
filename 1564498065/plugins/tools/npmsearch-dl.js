import te from "../../src/lib/ichigo-error.js";
import { npmPackageInfo } from "../../src/scraper/npmsearch.js";

const config = {
  name: "npmsearch-dl",
  alias: ["npmdl", "npmtgz"],
  category: "tools",
  description: "Download file .tgz package NPM langsung",
  usage: ".npmsearch-dl <nama package>",
  example: ".npmsearch-dl ichigo",
  cooldown: 10,
  energi: 1,
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isEnabled: true,
};

function fmtSize(bytes) {
  if (!bytes) return "-";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function handler(m, { sock }) {
  const name = (m.text || m.fullArgs || "").trim();

  if (!name) {
    return m.reply(`❌ Format: \`${m.prefix}npmsearch-dl <nama package>\``);
  }

  m.react("🕕");

  try {
    const pkg = await npmPackageInfo(name);
    if (!pkg.status) throw new Error(pkg.mess);
    if (!pkg.tarball) throw new Error("Tarball tidak ditemukan untuk package ini.");

    await sock.sendMessage(
      m.chat,
      {
        document: { url: pkg.tarball },
        fileName: `${pkg.package}-${pkg.version}.tgz`,
        mimetype: "application/gzip",
        caption:
          `📦 *${pkg.package}* \`v${pkg.version}\`\n` +
          `💾 Ukuran (unpacked): ${fmtSize(pkg.unpackedSize)}\n\n` +
          `_📦 Powered by NPM Registry_`,
      },
      { quoted: m },
    );

    m.react("✅");
  } catch (e) {
    console.error("[npmsearch-dl]", e.message);
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };