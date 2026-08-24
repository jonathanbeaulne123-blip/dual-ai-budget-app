import { describe, expect, it } from "vitest";
import {
  DAILY_CHAT_LIMIT,
  checkChatRateLimit,
  clientIp,
  corsHeaders,
  isAllowedKitchenHost,
  resetChatRateMemory,
  resolveChatOrigin,
} from "../workers/herculesGuard.js";

function requestWithOrigin(origin: string | null, method = "POST") {
  const headers = new Headers();
  if (origin) headers.set("Origin", origin);
  return new Request("https://hearth-books.jonathan-beaulne123.workers.dev/hercules/chat", {
    method,
    headers,
  });
}

function requestWithIp(ip: string | null, origin = "https://hearth-books.jonathan-beaulne123.workers.dev") {
  const headers = new Headers();
  headers.set("Origin", origin);
  if (ip) headers.set("CF-Connecting-IP", ip);
  return new Request("https://hearth-books.jonathan-beaulne123.workers.dev/hercules/chat", {
    method: "POST",
    headers,
  });
}

describe("Hercules kitchen Worker guard", () => {
  it("allows the kitchen host, Git main alias, localhost, and preview deploys — not arbitrary workers.dev", () => {
    expect(isAllowedKitchenHost("localhost")).toBe(true);
    expect(isAllowedKitchenHost("127.0.0.1")).toBe(true);
    expect(isAllowedKitchenHost("hearth-books.jonathan-beaulne123.workers.dev")).toBe(true);
    expect(isAllowedKitchenHost("main-hearth-books.jonathan-beaulne123.workers.dev")).toBe(true);
    expect(isAllowedKitchenHost("a0d7b2a7-hearth-books.jonathan-beaulne123.workers.dev")).toBe(true);
    expect(isAllowedKitchenHost("evil-hearth-books.jonathan-beaulne123.workers.dev")).toBe(false);
    expect(isAllowedKitchenHost("staging-hearth-books.jonathan-beaulne123.workers.dev")).toBe(false);
    expect(isAllowedKitchenHost("anything.workers.dev")).toBe(false);
    expect(isAllowedKitchenHost("")).toBe(false);
  });

  it("requires an Origin header on chat requests, including the Git main alias", () => {
    expect(resolveChatOrigin(requestWithOrigin(null)).allowed).toBe(false);
    expect(resolveChatOrigin(requestWithOrigin("https://evil.example")).allowed).toBe(false);
    const kitchen = resolveChatOrigin(
      requestWithOrigin("https://hearth-books.jonathan-beaulne123.workers.dev"),
    );
    expect(kitchen.allowed).toBe(true);
    expect(kitchen.origin).toBe("https://hearth-books.jonathan-beaulne123.workers.dev");
    const mainAlias = resolveChatOrigin(
      requestWithOrigin("https://main-hearth-books.jonathan-beaulne123.workers.dev"),
    );
    expect(mainAlias.allowed).toBe(true);
    expect(mainAlias.origin).toBe("https://main-hearth-books.jonathan-beaulne123.workers.dev");
    expect(resolveChatOrigin(requestWithOrigin("http://localhost:5173")).allowed).toBe(true);
  });

  it("reflects the allowed origin in CORS instead of wildcard", () => {
    const origin = "http://localhost:5173";
    expect(corsHeaders(origin)["Access-Control-Allow-Origin"]).toBe(origin);
    expect(corsHeaders(null)).toEqual({});
  });

  it("rate-limits per client IP per day when KV is bound", async () => {
    resetChatRateMemory();
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const env = { HERCULES_RATE: kv };
    const req = requestWithIp("203.0.113.1");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      const result = await checkChatRateLimit(env, req);
      expect(result.ok).toBe(true);
    }
    const blocked = await checkChatRateLimit(env, req);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    const other = await checkChatRateLimit(env, requestWithIp("203.0.113.2"));
    expect(other.ok).toBe(true);
  });

  it("limits by client IP in memory when KV is unbound; omitting householdId is not a bypass", async () => {
    resetChatRateMemory();
    const a = requestWithIp("203.0.113.10");
    const b = requestWithIp("203.0.113.11");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      expect((await checkChatRateLimit({}, a)).ok).toBe(true);
    }
    expect((await checkChatRateLimit({}, a)).ok).toBe(false);
    expect((await checkChatRateLimit({}, b)).ok).toBe(true);
  });

  it("still rate-limits when CF-Connecting-IP is missing", async () => {
    resetChatRateMemory();
    const req = requestWithOrigin("https://hearth-books.jonathan-beaulne123.workers.dev");
    expect(clientIp(req)).toBe("unknown");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      expect((await checkChatRateLimit({}, req)).ok).toBe(true);
    }
    expect((await checkChatRateLimit({}, req)).ok).toBe(false);
  });
});
