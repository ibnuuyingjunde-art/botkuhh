import { proto } from "ichigo";
import config from "../../config.js";

const pluginConfig = {
  name: "groupreact",
  alias: ["memberreact"],
  category: "group",
  description: "Memberikan reaksi otomatis saat ada anggota grup yang masuk atau keluar",
  isEnabled: true,
};

async function handler(m, { sock }) {
  
  if (!m || !m.messageStubType) return;

  const isMemberEvent = [27, 28].includes(m.messageStubType);

  if (isMemberEvent) {
    try {
      await sock.sendMessage(m.key.remoteJid, {
        react: {
          text: m.messageStubType === 27 ? "👋" : "🚪", 
          key: m.key
        }
      });
    } catch (err) {
      console.error("[Group React Error]", err);
    }
  }
}

export { pluginConfig as config, handler };