/** @typedef {{ get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> }} KvNamespace */

export const DAILY_CHAT_LIMIT = 60;

const KITCHEN_HOST = "hearth-books.jonathan-beaulne123.workers.dev";
/** Git production alias. `main` is not an eight-hex preview prefix. */
const KITCHEN_MAIN_ALIAS = "main-hearth-books.jonathan-beaulne123.workers.dev";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Preview deploy hostnames for this Worker only — not every *.workers.dev. */
const PREVIEW_HOST = /^[0-9a-f]{8}-hearth-books\.jonathan-beaulne123\.workers\.dev$/i;

const MEMORY_TTL_MS = 172800 * 1000;
const MAX_MEMORY_BUCKETS = 1024;

/** @type {Map<string, { count: number; expiresAt: number }>} */
const memoryLimits = new Map();

export function isAllowedKitchenHost(hostname) {
  if (!hostname) return false;
  if (LOCAL_HOSTS.has(hostname)) return true;
  if (hostname === KITCHEN_HOST || hostname === KITCHEN_MAIN_ALIAS) return true;
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
 * Cloudflare supplies CF-Connecting-IP. Missing or malformed request metadata
 * shares one `unknown` bucket instead of bypassing the meter.
 * @param {Request | undefined | null} request
 */
export function clientIp(request) {
  try {
    const ip = request?.headers?.get("CF-Connecting-IP");
    if (ip && String(ip).trim()) return String(ip).trim();
  } catch {
    /* Treat non-Request input as unknown. */
  }
  return "unknown";
}

function memoryGet(key) {
  const row = memoryLimits.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    memoryLimits.delete(key);
    return null;
  }
  return String(row.count);
}

function memoryPut(key, value) {
  const now = Date.now();
  if (memoryLimits.size >= MAX_MEMORY_BUCKETS) {
    for (const [storedKey, row] of memoryLimits) {
      if (row.expiresAt <= now) memoryLimits.delete(storedKey);
    }
  }
  if (!memoryLimits.has(key) && memoryLimits.size >= MAX_MEMORY_BUCKETS) {
    const oldestKey = memoryLimits.keys().next().value;
    if (oldestKey) memoryLimits.delete(oldestKey);
  }
  memoryLimits.set(key, {
    count: Number(value),
    expiresAt: now + MEMORY_TTL_MS,
  });
}

/** Test hook: isolate in-memory buckets between cases. */
export function resetChatRateMemory() {
  memoryLimits.clear();
}

/**
 * Meter 60 chats per client IP per UTC day. KV is durable when configured;
 * isolate memory is a bounded fallback, not a globally consistent counter.
 *
 * Concurrent failure semantics (D-146): both backends use get-then-put, so two
 * overlapping reads of the same count can both succeed and briefly exceed 60.
 * KV still wins for cross-isolate durability. A Durable Object hard cap is future work.
 *
 * @param {{ HERCULES_RATE?: KvNamespace }} env
 * @param {Request | undefined | null} request
 */
export function rateLimitAuthority(env) {
  return env?.HERCULES_RATE ? "kv" : "memory";
}

export async function checkChatRateLimit(env, request) {
  const key = `chat:${clientIp(request)}:${dayKeyUtc()}`;
  const kv = env?.HERCULES_RATE;
  const raw = kv ? await kv.get(key) : memoryGet(key);
  const count = raw ? Number(raw) : 0;
  if (!Number.isFinite(count) || count >= DAILY_CHAT_LIMIT) {
    return { ok: false, remaining: 0, authority: rateLimitAuthority(env) };
  }
  const next = String(count + 1);
  if (kv) await kv.put(key, next, { expirationTtl: 172800 });
  else memoryPut(key, next);
  return { ok: true, remaining: DAILY_CHAT_LIMIT - count - 1, authority: rateLimitAuthority(env) };
}
