

import axios from "axios";
import { createHash } from "crypto";
import { CookieJar } from "tough-cookie";

const CONFIG = {
  BASE_URL: process.env.AMPREM2_BASE_URL || "https://www.alightpro.my.id",
  TIMEOUT: 60000,
  SECRET_KEY: "amprem-super-secret-key-2026-v2",
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  REFERER: "https://www.alightpro.my.id/",
  ORIGIN: "https://www.alightpro.my.id",
};

function createClient() {
  const jar = new CookieJar();

  const client = axios.create({
    timeout: CONFIG.TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": CONFIG.USER_AGENT,
      Referer: CONFIG.REFERER,
      Origin: CONFIG.ORIGIN,
    },
  });

  client.interceptors.request.use(async (config) => {
    const cookieHeader = await jar.getCookieString(config.url);
    if (cookieHeader) config.headers.Cookie = cookieHeader;
    return config;
  });

  client.interceptors.response.use(
    async (response) => {
      const setCookies = response.headers["set-cookie"];
      if (setCookies) {
        for (const cookie of setCookies) {
          await jar.setCookie(cookie, response.config.url);
        }
      }
      return response;
    },
    (error) => Promise.reject(error),
  );

  return client;
}

export function generatePow(email, action, nonce, timestamp, sessionId) {
  const inputStr = `${email.toLowerCase()}:${action}:${nonce}:${timestamp}:${sessionId}:${CONFIG.SECRET_KEY}`;
  return createHash("sha256").update(inputStr).digest("hex");
}

export async function getSession(client) {
  try {
    await client.get(`${CONFIG.BASE_URL}/`);
    const response = await client.get(`${CONFIG.BASE_URL}/api/session`);
    const data = response.data;

    if (!data.status || !data.token || !data.nonce) {
      return { success: false, error: data.msg || "Invalid session response" };
    }

    return {
      success: true,
      token: data.token,
      nonce: data.nonce,
      sessionId: data.sessionId,
      timestamp: data.timestamp,
    };
  } catch (error) {
    return { success: false, error: error.response?.data || error.message };
  }
}

function securityHeaders(session) {
  return {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-Amprem-Token": session.token,
    "X-Amprem-Nonce": session.nonce,
    "X-Amprem-Pow": session.pow,
    "User-Agent": CONFIG.USER_AGENT,
    Referer: CONFIG.REFERER,
    Origin: CONFIG.ORIGIN,
  };
}

async function ampremRequest(payload) {
  const client = createClient();

  const session = await getSession(client);
  if (!session.success) {
    return { status: false, error: session.error };
  }

  const action = payload.link ? "verify" : "send";
  const pow = generatePow(
    payload.email,
    action,
    session.nonce,
    session.timestamp,
    session.sessionId,
  );

  const response = await client.post(
    `${CONFIG.BASE_URL}/api/alight-motion`,
    { action, ...payload },
    { headers: securityHeaders({ ...session, pow }) },
  );

  return { status: true, data: response.data };
}

export async function Amprem2Send(email) {
  try {
    return await ampremRequest({ action: "send", email });
  } catch (error) {
    return { status: false, error: error.response?.data || error.message };
  }
}

export async function Amprem2Verif(email, link) {
  try {
    return await ampremRequest({ action: "verify", email, link });
  } catch (error) {
    return { status: false, error: error.response?.data || error.message };
  }
}

export default { Amprem2Send, Amprem2Verif, getSession, generatePow };
