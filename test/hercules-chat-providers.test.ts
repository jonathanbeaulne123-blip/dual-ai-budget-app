import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { resetChatRateMemory } from "../workers/herculesGuard.js";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";

function chatRequest(
  message = "Did the synthetic marker post?",
  ip = "203.0.113.91",
  overrides: Record<string, unknown> = {},
) {
  return new Request(`${origin}/hercules/chat`, {
    method: "POST",
    headers: {
      Origin: origin,
      "CF-Connecting-IP": ip,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      briefing: "Synthetic books are balanced.",
      ledgerLines: "2026-08-30 | synthetic marker merchant | no amount",
      grounded: { spoken: "The synthetic marker is in the posted journal." },
      figures: [],
      dataClassification: "synthetic",
      environment: "development",
      fullSyntheticContext: JSON.stringify({
        environment: "development",
        privateSyntheticCanary: "all authorized synthetic context",
      }),
      ...overrides,
    }),
  });
}

type ProviderMessage = { role: string; content: string };

function providerMessages(url: string, init?: RequestInit): ProviderMessage[] {
  const body = JSON.parse(String(init?.body || "{}")) as {
    systemInstruction?: { parts?: Array<{ text?: string }> };
    contents?: Array<{ role?: string; parts?: Array<{ text?: string }> }>;
    messages?: Array<{ role?: string; content?: string }>;
  };
  if (url.includes("generativelanguage.googleapis.com")) {
    const system = (body.systemInstruction?.parts ?? []).map((part) => part.text ?? "").join("\n\n");
    return [
      ...(system ? [{ role: "system", content: system }] : []),
      ...(body.contents ?? []).map((row) => ({
        role: row.role === "model" ? "assistant" : String(row.role || "user"),
        content: (row.parts ?? []).map((part) => part.text ?? "").join(""),
      })),
    ];
  }
  return (body.messages ?? []).map((row) => ({ role: String(row.role || ""), content: row.content ?? "" }));
}

function canonicalProviderMessages(messages: ProviderMessage[]) {
  const system = messages.filter((row) => row.role === "system").map((row) => row.content).join("\n\n");
  return [
    ...(system ? [{ role: "system", content: system }] : []),
    ...messages.filter((row) => row.role !== "system"),
  ];
}

const externalSyntheticEnv = {
  HERCULES_ALLOW_EXTERNAL_PROVIDERS: "true",
  HERCULES_ALLOW_FULL_SYNTHETIC_CONTEXT: "true",
  HERCULES_EXTERNAL_DATA_CLASSIFICATION: "synthetic",
};

beforeEach(() => resetChatRateMemory());
afterEach(() => vi.unstubAllGlobals());

describe("Hercules in-app chat provider chain", () => {
  it("falls through once in Gemini → Groq → OpenAI → Workers AI order with one bounded prompt", async () => {
    const attempts: Array<{ url: string; messages: ProviderMessage[] }> = [];
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      attempts.push({ url, messages: providerMessages(url, init) });
      if (url.includes("generativelanguage.googleapis.com")) return new Response("quota", { status: 429 });
      if (url.includes("api.groq.com")) return new Response("not-json", { status: 200 });
      return new Response("quiet", { status: 503 });
    });
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: "Workers AI kept the synthetic kitchen awake." }));

    const response = await worker.fetch(chatRequest(), {
      ...externalSyntheticEnv,
      GEMINI_API_KEY: "synthetic-gemini-key",
      GROQ_API_KEY: "synthetic-groq-key",
      OPENAI_API_KEY: "synthetic-openai-key",
      HERCULES_ALLOW_PAID_PROVIDERS: "true",
      AI: { run },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "workers-ai" });
    expect(attempts.map((row) => row.url)).toEqual([
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      "https://api.groq.com/openai/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ]);
    const canonicalPayloads = attempts.map((attempt) => canonicalProviderMessages(attempt.messages));
    expect(canonicalPayloads[0]).toEqual(canonicalPayloads[1]);
    expect(canonicalPayloads[1]).toEqual(canonicalPayloads[2]);
    expect(JSON.stringify(canonicalPayloads[0])).toContain("synthetic marker merchant");
    expect(JSON.stringify(canonicalPayloads[0])).toContain("Did the synthetic marker post?");
    expect(JSON.stringify(canonicalPayloads[0])).toContain("all authorized synthetic context");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stops at Gemini, keeps its key out of the URL, and sanitizes write claims", async () => {
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).not.toContain("synthetic-gemini-key");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("synthetic-gemini-key");
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "I posted $40.00 for the marker." }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn();

    const response = await worker.fetch(chatRequest("Tell me about the marker.", "203.0.113.92"), {
      ...externalSyntheticEnv,
      GEMINI_API_KEY: "synthetic-gemini-key",
      GROQ_API_KEY: "synthetic-groq-key",
      AI: { run },
    });

    const body = await response.json() as { ok: boolean; provider: string; reply: string };
    expect(body).toMatchObject({ ok: true, provider: "gemini" });
    expect(body.reply).toMatch(/don't post/i);
    expect(body.reply).not.toMatch(/I posted/i);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  it("uses high-thinking Gemini then high-reasoning Groq with useful completion budgets", async () => {
    const sentBodies: unknown[] = [];
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      sentBodies.push(JSON.parse(String(init?.body)));
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: "I posted $40.00 for the marker." } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);

    const response = await worker.fetch(chatRequest("Find the marker.", "203.0.113.93"), {
      ...externalSyntheticEnv,
      GEMINI_API_KEY: "synthetic-gemini-key",
      GROQ_API_KEY: "synthetic-groq-key",
    });

    const body = await response.json() as { ok: boolean; provider: string; reply: string };
    expect(body).toMatchObject({ ok: true, provider: "groq" });
    expect(body.reply).toMatch(/don't post/i);
    expect(sentBodies[0]).toMatchObject({
      generationConfig: {
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingLevel: "high" },
      },
    });
    expect(sentBodies[1]).toMatchObject({
      model: "openai/gpt-oss-120b",
      max_completion_tokens: 8192,
      reasoning_effort: "high",
    });
  });

  it("skips OpenAI without the paid-provider opt-in even when a secret is present", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: "Workers AI answered without a paid call." }));

    const response = await worker.fetch(chatRequest("Keep this free.", "203.0.113.94"), {
      OPENAI_API_KEY: "present-but-disabled",
      HERCULES_ALLOW_PAID_PROVIDERS: "false",
      AI: { run },
    });

    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "workers-ai" });
    expect(upstream).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps all external chat providers inert unless synthetic processing is explicitly enabled", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: "Workers AI stayed inside the fail-closed boundary." }));

    const response = await worker.fetch(chatRequest("Keep providers inert.", "203.0.113.97"), {
      GEMINI_API_KEY: "present-but-inert",
      GROQ_API_KEY: "present-but-inert",
      OPENAI_API_KEY: "present-but-inert",
      HERCULES_ALLOW_EXTERNAL_PROVIDERS: "true",
      HERCULES_EXTERNAL_DATA_CLASSIFICATION: "private",
      HERCULES_ALLOW_PAID_PROVIDERS: "true",
      AI: { run },
    });

    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "workers-ai" });
    expect(upstream).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not forward full context without the separate deployer opt-in", async () => {
    let sent = "";
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      sent = JSON.stringify(providerMessages(String(input), init));
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "The bounded synthetic marker is in the journal." }] } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", upstream);

    const response = await worker.fetch(chatRequest("Read the marker.", "203.0.113.98"), {
      HERCULES_ALLOW_EXTERNAL_PROVIDERS: "true",
      HERCULES_EXTERNAL_DATA_CLASSIFICATION: "synthetic",
      GEMINI_API_KEY: "synthetic-gemini-key",
    });

    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "gemini" });
    expect(sent).toContain("synthetic marker merchant");
    expect(sent).not.toContain("all authorized synthetic context");
  });

  it("rejects client-supplied full context from a Production-labelled request across the fallback chain", async () => {
    const prompts: string[] = [];
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      prompts.push(JSON.stringify(providerMessages(String(input), init)));
      return new Response("quiet", { status: 503 });
    });
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async (_model: string, input: { messages?: ProviderMessage[] }) => {
      prompts.push(JSON.stringify(input.messages ?? []));
      return { response: "Workers AI used only the bounded journal." };
    });

    const response = await worker.fetch(chatRequest("Read the marker.", "203.0.113.99", {
      environment: "production",
      dataClassification: "synthetic",
      fullSyntheticContext: JSON.stringify({ forbiddenProductionCanary: "must never leave" }),
    }), {
      ...externalSyntheticEnv,
      GEMINI_API_KEY: "synthetic-gemini-key",
      GROQ_API_KEY: "synthetic-groq-key",
      AI: { run },
    });

    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "workers-ai" });
    expect(prompts).toHaveLength(3);
    expect(prompts.every((prompt) => !prompt.includes("forbiddenProductionCanary"))).toBe(true);
    expect(prompts.every((prompt) => prompt.includes("synthetic marker merchant"))).toBe(true);
  });

  it("times out all configured third-party providers sequentially without racing", async () => {
    let active = 0;
    let maxActive = 0;
    const upstream = vi.fn((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      init?.signal?.addEventListener("abort", () => {
        active -= 1;
        reject(new DOMException("aborted", "AbortError"));
      }, { once: true });
    }));
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: "Workers AI answered after three deadlines." }));

    const response = await worker.fetch(chatRequest("Use the whole fallback.", "203.0.113.95"), {
      ...externalSyntheticEnv,
      GEMINI_API_KEY: "synthetic-gemini-key",
      GROQ_API_KEY: "synthetic-groq-key",
      OPENAI_API_KEY: "synthetic-openai-key",
      HERCULES_ALLOW_PAID_PROVIDERS: "true",
      HERCULES_CHAT_PROVIDER_TIMEOUT_MS: "500",
      AI: { run },
    });

    await expect(response.json()).resolves.toMatchObject({ ok: true, provider: "workers-ai" });
    expect(upstream).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
    expect(active).toBe(0);
  });

  it("returns the existing quiet response when no provider is configured", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const response = await worker.fetch(chatRequest("Anyone there?", "203.0.113.96"), {});
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "ai quiet" });
  });
});
