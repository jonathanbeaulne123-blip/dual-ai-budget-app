import { describe, expect, it } from "vitest";
import {
  DAILY_CHAT_LIMIT,
  checkChatRateLimit,
  corsHeaders,
  isAllowedKitchenHost,
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

describe("Hercules kitchen Worker guard", () => {
  it("allows only the kitchen host, localhost, and preview deploys — not arbitrary workers.dev", () => {
    expect(isAllowedKitchenHost("localhost")).toBe(true);
    expect(isAllowedKitchenHost("127.0.0.1")).toBe(true);
    expect(isAllowedKitchenHost("hearth-books.jonathan-beaulne123.workers.dev")).toBe(true);
    expect(isAllowedKitchenHost("a0d7b2a7-hearth-books.jonathan-beaulne123.workers.dev")).toBe(true);
    expect(isAllowedKitchenHost("evil-hearth-books.jonathan-beaulne123.workers.dev")).toBe(false);
    expect(isAllowedKitchenHost("anything.workers.dev")).toBe(false);
    expect(isAllowedKitchenHost("")).toBe(false);
  });

  it("requires an Origin header on chat requests", () => {
    expect(resolveChatOrigin(requestWithOrigin(null)).allowed).toBe(false);
    expect(resolveChatOrigin(requestWithOrigin("https://evil.example")).allowed).toBe(false);
    const kitchen = resolveChatOrigin(
      requestWithOrigin("https://hearth-books.jonathan-beaulne123.workers.dev"),
    );
    expect(kitchen.allowed).toBe(true);
    expect(kitchen.origin).toBe("https://hearth-books.jonathan-beaulne123.workers.dev");
    expect(resolveChatOrigin(requestWithOrigin("http://localhost:5173")).allowed).toBe(true);
  });

  it("reflects the allowed origin in CORS instead of wildcard", () => {
    const origin = "http://localhost:5173";
    expect(corsHeaders(origin)["Access-Control-Allow-Origin"]).toBe(origin);
    expect(corsHeaders(null)).toEqual({});
  });

  it("rate-limits per household per day when KV is bound", async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const env = { HERCULES_RATE: kv };
    const id = "hh-test-1";
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      const result = await checkChatRateLimit(env, id);
      expect(result.ok).toBe(true);
    }
    const blocked = await checkChatRateLimit(env, id);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    const other = await checkChatRateLimit(env, "hh-test-2");
    expect(other.ok).toBe(true);
  });

  it("skips rate limiting when KV is not configured", async () => {
    const result = await checkChatRateLimit({}, "hh-local");
    expect(result.ok).toBe(true);
  });
});
