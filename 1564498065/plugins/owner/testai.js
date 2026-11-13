import config from "../../config.js";
import { Agent, fetch as undiciFetch } from "undici";

const pluginConfig = {
  name: "testai",
  alias: ["cekai", "checkai"],
  category: "owner",
  description: "Cek validitas semua API key AI yang ada di config",
  usage: ".testai",
  example: ".testai",
  cooldown: 15,
  energi: 0,
  ownerOnly: true,
  isEnabled: true,
};

const agent = new Agent({
  headersTimeout: 15000,
  bodyTimeout: 15000,
  connectTimeout: 10000,
});

async function ping(url, opts = {}) {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await undiciFetch(url, {
      ...opts,
      signal: ac.signal,
      dispatcher: agent,
    });
    clearTimeout(tid);
    return r;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

const providers = [
  {
    name: "Gemini (geminiApiKey)",
    key: config.geminiApiKey,
    test: async (key) => {
      const r = await ping(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      );
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "Google AI (APIkey.google)",
    key: config.APIkey?.google,
    test: async (key) => {
      const r = await ping(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      );
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "OpenAI (APIkey.openai)",
    key: config.APIkey?.openai,
    test: async (key) => {
      const r = await ping("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "Groq (APIkey.groq)",
    key: config.APIkey?.groq,
    test: async (key) => {
      const r = await ping("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "HuggingFace (APIkey.huggingface)",
    key: config.APIkey?.huggingface,
    test: async (key) => {
      const r = await ping("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "Replicate (APIkey.replicate)",
    key: config.APIkey?.replicate,
    test: async (key) => {
      const r = await ping("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Token ${key}` },
      });
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "DeepAI (APIkey.deepai)",
    key: config.APIkey?.deepai,
    test: async (key) => {
      
      const r = await ping("https://api.deepai.org/api/text-generator", {
        method: "POST",
        headers: {
          "api-key": key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "text=hi",
      });
      if (r.status === 200) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
  {
    name: "Neoxr (APIkey.neoxr)",
    key: config.APIkey?.neoxr,
    test: async (key) => {
      const r = await ping(
        `https://api.neoxr.eu/api/multicolor?text=test&apikey=${key}`,
      );
      const ct = r.headers.get("content-type") || "";
      if (r.status === 200 && ct.includes("application/json")) {
        const j = await r.json().catch(() => null);
        if (j?.status) return { ok: true };
        return { ok: false, detail: j?.msg || "Response tidak valid" };
      }
      return { ok: false, detail: `HTTP ${r.status} (bukan JSON)` };
    },
  },
  {
    name: "LolHuman (APIkey.lolhuman)",
    key: config.APIkey?.lolhuman,
    test: async (key) => {
      const r = await ping(
        `https://api.lolhuman.xyz/api/sticker?apikey=${key}&url=https://i.ibb.co/0jqHpnp/test.png`,
      );
      const ct = r.headers.get("content-type") || "";
      if (r.status === 200) return { ok: true };
      if (ct.includes("application/json")) {
        const j = await r.json().catch(() => null);
        return { ok: false, detail: j?.message || `HTTP ${r.status}` };
      }
      return { ok: false, detail: `HTTP ${r.status}` };
    },
  },
  {
    name: "Covenant (APIkey.covenant)",
    key: config.APIkey?.covenant,
    test: async (key) => {
      const r = await ping("https://api.covenant.sbs/api/ai/colorize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: "https://example.com/test.jpg" }),
      });
      
      if ([200, 400, 422].includes(r.status)) return { ok: true };
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `HTTP ${r.status} - ${t.slice(0, 120)}` };
    },
  },
];

async function handler(m) {
  const isOwner = config.isOwner ? config.isOwner(m.sender) : true;
  if (!isOwner) {
    return m.reply(config.messages?.ownerOnly || "Khusus owner.");
  }

  m.react("🕕");
  await m.reply("🧪 Lagi ngecek semua API key AI, tunggu sebentar...");

  const results = [];

  for (const p of providers) {
    if (!p.key) {
      results.push(`◈ ${p.name}: ⚪ Kosong (belum diisi)`);
      continue;
    }
    try {
      const res = await p.test(p.key);
      if (res.ok) {
        results.push(`◈ ${p.name}: ✅ Valid`);
      } else {
        results.push(`◈ ${p.name}: ❌ Invalid\n   _${res.detail}_`);
      }
    } catch (e) {
      const isTimeout =
        e.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
        e.cause?.code === "UND_ERR_BODY_TIMEOUT" ||
        e.name === "AbortError";
      results.push(
        `◈ ${p.name}: ⚠️ ${isTimeout ? "Timeout" : "Error"}\n   _${e.message?.slice(0, 100) || "unknown"}_`,
      );
    }
  }

  m.react("✅");

  const text =
    `🧪 *ʜᴀsɪʟ ᴛᴇsᴛ ᴀᴘɪ ᴋᴇʏ*\n\n` +
    results.join("\n\n") +
    `\n\n_Cek lagi kapan saja dengan_ \`${m.prefix}testai\``;

  await m.reply(text);
}

export { pluginConfig as config, handler };