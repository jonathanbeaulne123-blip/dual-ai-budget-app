// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlinksConnectPanel } from "../src/FlinksConnectPanel.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import * as flinksClient from "../src/imports/flinksClient.ts";
import * as supabaseSession from "../src/auth/supabaseSession.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(supabaseSession, "ensureSupabaseSession").mockResolvedValue({
    accessToken: "user-jwt",
    refreshToken: "refresh",
    userId: "auth-user",
    email: "demo@example.com",
    googleSubject: "google-subject",
    displayName: "Demo",
    expiresAt: Date.now() + 60_000,
  });
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

describe("Flinks connect panel", () => {
  it("shows Import from Flinks after a secure connection and stages through onImported", async () => {
    const household = catalogHousehold();
    const onImported = vi.fn();
    vi.spyOn(flinksClient, "fetchFlinksStatus").mockResolvedValue({
      ok: true,
      configured: true,
      connected: true,
      institution: "TD Demo",
      accountLabel: "Chequing",
      accountLast4: "4821",
      currency: "CAD",
    });
    vi.spyOn(flinksClient, "importFlinksInbox").mockResolvedValue({
      inbox: {
        institution: "TD Demo",
        sourceHash: "digest-batch",
        accounts: [],
        transactions: [],
      },
      batch: {
        sourceName: "TD Demo",
        sourceKind: "ofx",
        sourceHash: "digest-batch",
        accounts: [],
        rows: [],
        warnings: [],
      },
    });
    act(() => root.render(createElement(FlinksConnectPanel, {
      environment: household.environment,
      householdId: household.householdId,
      memberId: "MEM-002",
      onImported,
      onError: vi.fn(),
    })));
    await act(async () => { await Promise.resolve(); });
    const importButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Import from Flinks"));
    expect(importButton).toBeTruthy();
    act(() => importButton!.click());
    await act(async () => { await Promise.resolve(); });
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toMatch(/LoginId|paste/i);
  });
});
