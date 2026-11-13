import fs from "fs";
import te from "../../src/lib/ichigo-error.js";
import npmsearch from "../../src/scraper/npmsearch.js";
import { getAssetBuffer, loadAssetBuffer } from "../../src/lib/ichigo-asset-manager.js";

const config = {
  name: "npmsearch",
  alias: ["searchnpm", "caripackage", "npm"],
  category: "tools",
  description: "Cari package NPM berdasarkan kata kunci",
  usage: ".npmsearch <nama package>",
  example: ".npmsearch ichigo",
  cooldown: 5,
  energi: 1,
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const query = (m.text || m.fullArgs || "").trim();

  if (!query) {
    return m.reply(
      `╭─ 📦 *NPM SEARCH*\n` +
      `│· Usage  : \`${m.prefix}npmsearch <package>\`\n` +
      `│· Contoh : \`${m.prefix}npmsearch ichigo\`\n` +
      `╰───────────────────────────`,
    );
  }

  await m.react("⏳");

  try {
    const data = await npmsearch(query);
    if (!data.status) throw new Error(data.mess);

    const { keyword, total, result, responseTime } = data;

    const caption =
      `╭─ 📦 *NPM SEARCH*\n` +
      `│· Keyword  : ${keyword}\n` +
      `│· Total    : ${total} package\n` +
      `│· Response : ${responseTime}\n` +
      `╰───────────────────────────\n\n` +
      `Pilih salah satu package di bawah buat lihat detail & link download-nya.`;

    const rows = result.slice(0, 10).map((pkg) => {
      const desc = pkg.description?.length > 72
        ? pkg.description.slice(0, 72) + "..."
        : pkg.description || "Tidak ada deskripsi";

      return {
        title: `${pkg.package} v${pkg.version}`,
        description: desc,
        id: `${m.prefix}npmsearch-get ${pkg.package}`,
      };
    });

    const assetBuffer = await loadAssetBuffer("ichigo");

    await sock.sendButton(
      m.chat,
      assetBuffer,
      caption,
      m,
      {
        buttons: [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📦 Pilih Package",
              sections: [
                {
                  title: `Hasil untuk "${keyword}"`,
                  rows,
                },
              ],
            }),
          },
        ],
        footer: "NPM Registry",
      },
    );

    await m.react("✅");

  } catch (e) {
    console.error("[npmsearch]", e.message);
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

export { config, handler };