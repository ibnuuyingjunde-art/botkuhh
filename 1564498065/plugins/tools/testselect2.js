import { ButtonV2 } from "../../src/lib/ichigo-builder.js";

const pluginConfig = {
  name: "testselect2",
  command: ["testselect2", "tesbtn2"],
  category: "tools",
  description: "Demo tombol single_select pake ButtonV2 (buttonsMessage) + addRowButton",
  isEnabled: true,
};

async function handler(m, { sock }) {
  const btn = new ButtonV2(sock)
    .setThumbnail("https://kappa.lol/nt7uA6") 
    .setBody("Ini demo list picker (buttonsMessage), coba pilih salah satu opsi di bawah:")
    .setFooter("Test Button V2")

    .addButton("Halo 👋", "test_halo")

    .addRowButton("≡ PILIH", [
      { header: "A1", title: "Opsi A1", description: "Deskripsi opsi A1", id: "test_a1" },
      { header: "A2", title: "Opsi A2", description: "Deskripsi opsi A2", id: "test_a2" },
      { header: "A3", title: "Opsi A3", description: "Deskripsi opsi A3", id: "test_a3" },
    ]);

  await btn.send(m.chat, { quoted: m });
}

async function testSelect2ReplyHandler(m, sock) {
  const resp = m.message?.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (!resp) return false;

  let id;
  try {
    id = JSON.parse(resp.paramsJson).id;
  } catch {
    return false;
  }

  if (!id?.startsWith("test_")) return false;

  await sock.sendText(m.chat, `Lo pilih: ${id}`, null, { quoted: m });
  return true;
}

export { pluginConfig as config, handler, testSelect2ReplyHandler };