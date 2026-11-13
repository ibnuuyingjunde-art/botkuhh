import { Button } from "../../src/lib/ichigo-builder.js";

const pluginConfig = {
  name: "testselect",
  command: ["testselect", "tesbtn"],
  category: "tools",
  description: "Demo tombol single_select pake addRowButton",
  isEnabled: true,
};

async function handler(m, { sock }) {
  const btn = new Button(sock)
    .setBody("Ini demo list picker, coba pilih salah satu opsi di bawah:")
    .setFooter("Test Button")
    .addSelection("≡ PILIH")

    .makeSection("Kategori A")
    .addRowButton([
      { header: "A1", title: "Opsi A1", description: "Deskripsi opsi A1", id: "test_a1" },
      { header: "A2", title: "Opsi A2", description: "Deskripsi opsi A2", id: "test_a2" },
      { header: "A3", title: "Opsi A3", description: "Deskripsi opsi A3", id: "test_a3" },
    ])

    .makeSection("Kategori B")
    .addRowButton([
      { header: "B1", title: "Opsi B1", description: "Deskripsi opsi B1", id: "test_b1" },
      { header: "B2", title: "Opsi B2", description: "Deskripsi opsi B2", id: "test_b2" },
    ]);

  await btn.send(m.chat, { quoted: m });
}

async function testSelectReplyHandler(m, sock) {
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

export { pluginConfig as config, handler, testSelectReplyHandler };