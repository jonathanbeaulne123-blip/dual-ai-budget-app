// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/auth/supabaseSession.ts", () => ({
  ensureSupabaseSession: vi.fn(async () => ({
    accessToken: "signed-user-jwt", refreshToken: "refresh", userId: "auth-user", email: "member@example.com",
    googleSubject: "google", displayName: "Member", expiresAt: Date.now() + 60_000,
  })),
}));

import { FlinksConnectPanel } from "../src/FlinksConnectPanel.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const digest = "a".repeat(64);
let root: Root;
let container: HTMLDivElement;

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(container.textContent || "UI did not settle.");
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Flinks Connect panel", () => {
  it("accepts only the matching iframe message and stages proposals without a posting callback", async () => {
    const onStage = vi.fn();
    const callback = `https://hearth-books.jonathan-beaulne123.workers.dev/bank/flinks/callback?state=${"s".repeat(32)}`;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/bank/flinks/status") return new Response(JSON.stringify({ ok: true, available: true, phase: "sandbox-configured", environment: "development-only", providerCallsEnabled: true, productionAllowed: false, detail: "Configured" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (path.startsWith("/bank/flinks/connections?")) return new Response(JSON.stringify({ ok: true, connections: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (path === "/bank/flinks/sessions") return new Response(JSON.stringify({ ok: true, connectionId: "connection_12345678901234567890", iframeUrl: `https://toolbox-iframe.private.fin.ag/v2/?demo=true&jsRedirect=true&accountSelectorEnable=true&accountSelectorCurrency=cad&fetchAllAccounts=false&authorizeToken=one-use&redirectUrl=${encodeURIComponent(callback)}`, messageOrigin: "https://toolbox-iframe.private.fin.ag", expiresAt: "2026-08-26T18:00:00.000Z" }), { status: 201, headers: { "Content-Type": "application/json" } });
      if (path.endsWith("/complete")) {
        expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer signed-user-jwt" }));
        return new Response(JSON.stringify({ ok: true, status: "ready", connectionId: "connection_12345678901234567890", payload: {
          provider: "flinks", sourceName: "FlinksCapital", sourceHash: `fpull_${digest}`, transactions: [{
            stableTransactionId: `ftx_${digest}`, status: "posted", accountRef: `fac_${digest}`, accountLast4: "7890", accountKind: "bank", currency: "CAD", date: "2026-08-25", debit: "12.34", credit: null, code: "DEBIT", description: "Test groceries", merchant: null,
          }],
        } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected request ${path}`);
    });
    vi.stubGlobal("fetch", fetcher);
    act(() => root.render(createElement(FlinksConnectPanel, {
      environment: "development", householdId: "HH-TEST", memberId: "MEM-001", scopeKey: "development|HH-TEST|MEM-001|household", generation: 0, disabled: false, onStage,
    })));

    act(() => (container.querySelector("button") as HTMLButtonElement).click());
    await settleUntil(() => container.querySelector("iframe") != null);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.closest(".flinks-connect")).not.toBeNull();
    expect(iframe.src).toMatch(/^https:\/\/toolbox-iframe\.private\.fin\.ag\/v2\//);
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-top-navigation");

    act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", source: iframe.contentWindow, data: { step: "REDIRECT", url: "https://example.test/?loginId=bad" } })));
    await act(async () => Promise.resolve());
    expect(onStage).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new MessageEvent("message", { origin: "https://toolbox-iframe.private.fin.ag", source: iframe.contentWindow, data: { step: "REDIRECT", url: `${callback}&loginId=11111111-1111-4111-8111-111111111111&accountId=7a6af481-e70d-4cc6-8dc7-79c3817fc469` } })));
    await settleUntil(() => onStage.mock.calls.length === 1);
    expect(onStage.mock.calls[0]?.[0].rows).toHaveLength(1);
    expect(container.textContent).toMatch(/staged for review/i);
  });

  it("lets an existing member-owned connection fetch posted evidence again", async () => {
    const onStage = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/bank/flinks/status") return new Response(JSON.stringify({ ok: true, available: true, phase: "sandbox-configured", environment: "development-only", providerCallsEnabled: true, productionAllowed: false, detail: "Configured" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (path.startsWith("/bank/flinks/connections?")) return new Response(JSON.stringify({ ok: true, connections: [{ connectionId: "connection_12345678901234567890", state: "ready", updatedAt: "2026-08-26T18:00:00.000Z" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (path.endsWith("/transactions")) return new Response(JSON.stringify({ ok: true, status: "ready", connectionId: "connection_12345678901234567890", payload: {
        provider: "flinks", sourceName: "FlinksCapital", sourceHash: `fpull_${digest}`, transactions: [{
          stableTransactionId: `ftx_${digest}`, status: "posted", accountRef: `fac_${digest}`, accountLast4: "7890", accountKind: "bank", currency: "CAD", date: "2026-08-25", debit: "12.34", credit: null, code: "DEBIT", description: "Test groceries", merchant: null,
        }],
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
      throw new Error(`Unexpected request ${path}`);
    });
    vi.stubGlobal("fetch", fetcher);
    act(() => root.render(createElement(FlinksConnectPanel, {
      environment: "development", householdId: "HH-TEST", memberId: "MEM-001", scopeKey: "development|HH-TEST|MEM-001|household", generation: 0, disabled: false, onStage,
    })));

    act(() => (container.querySelector("button") as HTMLButtonElement).click());
    await settleUntil(() => container.textContent?.includes("Fetch posted transactions") === true);
    const fetchButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Fetch posted transactions") as HTMLButtonElement;
    act(() => fetchButton.click());
    await settleUntil(() => onStage.mock.calls.length === 1);

    expect(onStage.mock.calls[0]?.[0].rows).toHaveLength(1);
    expect(fetcher.mock.calls.some(([path]) => String(path) === "/bank/flinks/sessions")).toBe(false);
  });
});
