/** @typedef {{ get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> }} KvNamespace */

export const DAILY_CHAT_LIMIT = 60;

const KITCHEN_HOST = "hearth-books.jonathan-beaulne123.workers.dev";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Preview deploy hostnames for this Worker only — not every *.workers.dev. */
const PREVIEW_HOST = /^[0-9a-f]{8}-hearth-books\.jonathan-beaulne123\.workers\.dev$/i;

export function isAllowedKitchenHost(hostname) {
  if (!hostname) return false;
  if (LOCAL_HOSTS.has(hostname)) return true;
  if (hostname === KITCHEN_HOST) return true;
  return PREVIEW_HOST.test(hostname);
}

/**
 * Require a browser Origin on chat POSTs. Reflect it in CORS when allowed.
 * @returns {{ allowed: boolean; origin: string | null }}
 */
export function resolveChatOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return { allowed: false, origin: null };
  try {
    const host = new URL(origin).hostname;
    if (!isAllowedKitchenHost(host)) return { allowed: false, origin };
    return { allowed: true, origin };
  } catch {
    return { allowed: false, origin };
  }
}

export function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function dayKeyUtc() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {{ HERCULES_RATE?: KvNamespace }} env
 * @param {string | undefined | null} householdId
 */
export async function checkChatRateLimit(env, householdId) {
  const id = String(householdId || "").trim();
  if (!env?.HERCULES_RATE || !id) return { ok: true, remaining: DAILY_CHAT_LIMIT };
  const key = `chat:${id}:${dayKeyUtc()}`;
  const raw = await env.HERCULES_RATE.get(key);
  const count = raw ? Number(raw) : 0;
  if (!Number.isFinite(count) || count >= DAILY_CHAT_LIMIT) {
    return { ok: false, remaining: 0 };
  }
  await env.HERCULES_RATE.put(key, String(count + 1), { expirationTtl: 172800 });
  return { ok: true, remaining: DAILY_CHAT_LIMIT - count - 1 };
}
