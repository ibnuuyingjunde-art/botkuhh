import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;
import config from "../../config.js";

const pluginConfig = {
  name: "contact2",
  alias: ["info2", "hubungi2", "jadwal2"],
  category: "main",
  description: "Menampilkan kartu kontak developer, channel info, dan jadwal meeting via AIRich",
  usage: ".contact2",
  example: ".contact2",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  await m.react("📇");

  try {
    const rich = new AIRich(sock);

    const developerSection = AIRich.newLayout("Single", {
      __typename: "GenAICompactEntityPrimitive",
      title: "ynliniX's",
      subtitle: "Developer",
      secondary_subtitle: "cloudstore.my.id",
      entity_id: 81524385851,
      entity_url: "https://wa.me/6281524385851",
      entity_type: "PERSON",
      action_type: "MESSAGE",
      is_verified: true,
      image: { url: "https://u.pone.rs/yqorzxru.jpg" },
    });

    const channelSection = AIRich.newLayout("Single", {
      __typename: "GenAICompactEntityPrimitive",
      title: "Saluran Informasi Bot",
      subtitle: "Ikuti untuk pembaruan fitur",
      secondary_subtitle: "1K Pengikut",
      entity_id: 987654321,
      entity_url: "https://whatsapp.com/channel/0029VbCzuA0EVccRe8yBre1c",
      entity_type: "PAGE",
      action_type: "FOLLOW",
      is_verified: true,
      image: { url: "https://u.pone.rs/yqorzxru.jpg" },
    });

    const calendarSection = AIRich.newLayout("Single", {
      __typename: "GenAICompactEntityPrimitive",
      title: "Meeting Tim Dev",
      subtitle: "Senin, 10:00 WIB",
      secondary_subtitle: "Google Meet",
      entity_id: 867051314767696,
      entity_url: "https://meet.google.com",
      entity_type: "CALENDAR_EVENT",
      action_type: "VIEW",
      is_verified: false,
      image: { url: "https://u.pone.rs/yqorzxru.jpg" },
    });

    const sections = [developerSection, channelSection, calendarSection];

    const submessage = {
      messageType: 2,
      messageText: "Pusat Informasi & Jadwal Kontak Bot",
    };

    rich._addContent(sections, submessage);

    rich.addSuggest(["menu", "owner", "donasi"]);

    await rich.send(m.chat, { quoted: m });
  } catch (error) {
    console.error("[contact2 Plugin Error]:", error);
    await m.reply(
      `❌ Gagal memuat kartu kontak secara interaktif.\n\nSilahkan hubungi langsung: wa.me/6281524385851`
    );
  }
}

export { pluginConfig as config, handler };