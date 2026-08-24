import { readFileSync } from "node:fs";
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

function requestWithIp(ip: string | null) {
  const headers = new Headers({
    Origin: "https://hearth-books.jonathan-beaulne123.workers.dev",
  });
  if (ip) headers.set("CF-Connecting-IP", ip);
  return new Request("https://hearth-books.jonathan-beaulne123.workers.dev/hercules/chat", {
    method: "POST",
    headers,
  });
}

describe("Hercules kitchen Worker guard", () => {
  it("allows the kitchen host, Git main alias, localhost, and previews — not arbitrary workers.dev", () => {
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

  it("requires an Origin header on chat requests", () => {
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
    const request = requestWithIp("203.0.113.1");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      const result = await checkChatRateLimit(env, request);
      expect(result.ok).toBe(true);
    }
    const blocked = await checkChatRateLimit(env, request);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    const other = await checkChatRateLimit(env, requestWithIp("203.0.113.2"));
    expect(other.ok).toBe(true);
  });

  it("uses isolate memory when KV is absent instead of bypassing the limit", async () => {
    resetChatRateMemory();
    const request = requestWithIp("203.0.113.10");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      expect((await checkChatRateLimit({}, request)).ok).toBe(true);
    }
    expect((await checkChatRateLimit({}, request)).ok).toBe(false);
    expect((await checkChatRateLimit({}, requestWithIp("203.0.113.11"))).ok).toBe(true);
  });

  it("shares an unknown bucket when client IP metadata is absent", async () => {
    resetChatRateMemory();
    const request = requestWithOrigin("https://hearth-books.jonathan-beaulne123.workers.dev");
    expect(clientIp(request)).toBe("unknown");
    for (let i = 0; i < DAILY_CHAT_LIMIT; i++) {
      expect((await checkChatRateLimit({}, request)).ok).toBe(true);
    }
    expect((await checkChatRateLimit({}, request)).ok).toBe(false);
  });

  it("tells the model not to echo prompt labels or quote briefing card totals", () => {
    const worker = readFileSync("workers/site.js", "utf8");
    expect(worker).toContain("checkChatRateLimit(env, request)");
    expect(worker).not.toContain("checkChatRateLimit(env, body?.householdId)");
    expect(worker).toMatch(/Never echo section labels/);
    expect(worker).toMatch(/PROMPT_ECHO/);
    expect(worker).toMatch(/quote GROUNDED JOURNAL tray vs statement/);
    expect(worker).not.toMatch(/quote owed \/ utilization from the briefing/);
  });
});
