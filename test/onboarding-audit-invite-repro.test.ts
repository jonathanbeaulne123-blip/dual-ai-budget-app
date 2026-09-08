// @vitest-environment jsdom
// Real mounted entry-path regression: welcome -> create -> invitation.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Household } from "../src/core/index.ts";

const writes = vi.hoisted(() => ({ candidates: [] as Household[], stored: null as Household | null }));

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => writes.stored),
    loadHousehold: vi.fn(async () => writes.stored),
    loadHouseholdReplica: vi.fn(async () => writes.stored),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (household: Household) => {
      writes.candidates.push(household);
    }),
  };
});

vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  return {
    ...actual,
    inspectBrowserBooks: vi.fn(async (household: Household) => ({
      ok: true,
      message: "PGlite agrees.",
      entryCount: household.transactions.length,
    })),
    ingestHouseholdBooks: vi.fn(async (household: Household) => ({
      compiled: {} as never,
      status: {
        ok: true,
        engine: "pglite" as const,
        entryCount: household.transactions.length,
        inBalance: true,
        equationHolds: true,
      },
    })),
    validateHouseholdBooksStaged: vi.fn(async (household: Household) => ({
      ok: true,
      engine: "pglite" as const,
      entryCount: household.transactions.length,
      inBalance: true,
      equationHolds: true,
    })),
  };
});

vi.mock("../src/continuity.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/continuity.ts")>();
  return {
    ...actual,
    discoverContinuityMemberships: vi.fn(async () => []),
    hostedContinuityAllowed: vi.fn(() => true),
  };
});

vi.mock("../src/google/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/google/index.ts")>();
  return {
    ...actual,
    googleConfigured: vi.fn(() => true),
    connectGoogle: vi.fn(async () => ({
      memberId: "__welcome__",
      accessToken: "entry-test-token",
      expiresAt: Date.now() + 60_000,
      grantedScopes: ["openid", "email", "profile"],
      identity: {
        email: "bianca@example.com",
        subject: "google-bianca",
        displayName: "Bianca",
      },
    })),
  };
});

vi.mock("../src/deferredSurfaces.tsx", async () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: () => createElement("div", null),
  DeferredBooksPage: () => null,
  DeferredCalendarPage: () => null,
  DeferredWorkShiftPage: () => null,
  DeferredPairingCard: () => null,
  DeferredWelcomeJoin: (await import("../src/Pairing.tsx")).WelcomeJoin,
  DeferredWelcomeQrScanner: () => null,
  DeferredShiftReportScanBar: () => null,
  DeferredWorkShiftWithSevenShifts: () => null,
  loadOfficeSurface: vi.fn(async () => ({})),
  loadBooksSurface: vi.fn(async () => ({})),
  loadCalendarSurface: vi.fn(async () => ({})),
  loadWorkShiftSurface: vi.fn(async () => ({})),
}));

vi.mock("../src/HerculesPro.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/HerculesPro.tsx")>();
  return {
    ...actual,
    HerculesProApproval: () => null,
    HerculesProPermissionsCard: () => null,
  };
});

import { App } from "../src/App.tsx";
import { ledgerSyncEnabled } from "../src/ledgerSync/mode.ts";
import {
  catalogHousehold,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(assertion: () => void, timeout = 5_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown = new Error("UI condition was not met.");
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (caught) {
      lastError = caught;
    }
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
  }
  throw lastError;
}

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}


const callbackAuth = vi.hoisted(() => ({ userId: "auth-bianca", sessionId: "session-bianca", accessToken: "synthetic-token", refreshToken: "synthetic-refresh", email: "bianca@example.test", googleSubject: "google-bianca", displayName: "Bianca", expiresAt: 9999999999999 }));
vi.mock("../src/auth/supabaseSession.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../src/auth/supabaseSession.ts")>(),
  supabaseAuthEnabled: () => true,
  consumeSupabaseAuthRedirect: () => callbackAuth,
  ensureSupabaseSession: async () => callbackAuth,
  loadSupabaseSession: () => callbackAuth,
}));
vi.mock("../src/ledger/householdInvites.ts", async importOriginal => ({
  ...await importOriginal<typeof import("../src/ledger/householdInvites.ts")>(),
  registerCurrentHouseholdDevice: async () => ({ ok: true, registered: 1 }),
  redeemHouseholdInvite: vi.fn(),
}));

import { redeemHouseholdInvite } from "../src/ledger/householdInvites.ts";

describe("invitation entry with Development v2 and a retained replica", () => {
 let root: Root; let container: HTMLDivElement;
 beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
  callbackAuth.userId = "auth-bianca";
  writes.stored = null; writes.candidates = [];
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  sessionStorage.setItem("hearth:v1:pending-auth-invite", JSON.stringify({ token: "a".repeat(64), environment: "development" }));
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
 });
 afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
 it.each([false, true])("reaches recipient name after OAuth; cached household=%s", async cached => {
  expect(ledgerSyncEnabled("development")).toBe(true);
  if (cached) {
   writes.stored = catalogHousehold("development");
   localStorage.setItem("hearth:session:v1:development", JSON.stringify({ memberId: "MEM-002", view: "household", householdId: writes.stored.householdId }));
  }
  await act(async () => { root.render(createElement(App)); await Promise.resolve(); });
  await waitFor(() => {
   expect(container.querySelector("#welcome-join-title")?.textContent).toBe("Join a household");
   expect(container.textContent).toContain("Your name");
  }, 2000);
 });
 it("cancels an in-flight invitation without replacing the saved ledger or showing its late failure", async () => {
  writes.stored = catalogHousehold("development");
  const selection = JSON.stringify({ memberId: "MEM-002", view: "household", householdId: writes.stored.householdId });
  localStorage.setItem("hearth:session:v1:development", selection);
  let settle!: (value: Awaited<ReturnType<typeof redeemHouseholdInvite>>) => void;
  vi.mocked(redeemHouseholdInvite).mockImplementation(() => new Promise(resolve => { settle = resolve; }));
  await act(async () => { root.render(createElement(App)); });
  await waitFor(() => expect(container.textContent).toContain("Your name"));
  const name = container.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "Bianca");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    name.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(button("Accept invitation").disabled).toBe(false);
  await act(async () => { button("Accept invitation").click(); });
  await waitFor(() => expect(redeemHouseholdInvite).toHaveBeenCalledOnce());
  await act(async () => { button("Back to households").click(); });
  expect(container.querySelector("#welcome-join-title")).toBeNull();
  expect(sessionStorage.getItem("hearth:v1:pending-auth-invite")).toBeNull();
  await act(async () => { settle({ ok: false, reason: "invite-expired" } as Awaited<ReturnType<typeof redeemHouseholdInvite>>); });
  expect(container.querySelector("#welcome-join-title")).toBeNull();
  expect(localStorage.getItem("hearth:session:v1:development")).toBe(selection);
  expect(writes.candidates).toHaveLength(0);
  expect(container.textContent).not.toContain("Invitation expired");
 });

 it("hides the retained Personal ledger after cancelling with a different Google account", async () => {
  writes.stored = catalogHousehold("development");
  writes.stored.google.links = [{memberId:"MEM-002",email:"jonathan@example.test",subject:"google-jonathan",displayName:"Jonathan",linkedAt:"2026-09-08T12:00:00Z",lastConfirmedAt:"2026-09-08T12:00:00Z",updatedAt:"2026-09-08T12:00:00Z",grantedScopes:["openid"],active:true}];
  const selection = JSON.stringify({memberId:"MEM-002",view:"personal",householdId:writes.stored.householdId});
  localStorage.setItem("hearth:session:v1:development",selection);
  await act(async () => {root.render(createElement(App));});
  await waitFor(() => expect(container.textContent).toContain("Your name"));
  await act(async () => {button("Back to households").click();});
  expect(container.textContent).toContain("Confirm access to the saved books");
  expect(container.querySelector(".app-shell")).toBeNull();
  expect(localStorage.getItem("hearth:session:v1:development")).toBe(selection);
 });

 it("ignores an accepted invitation response after Google identity changes", async () => {
  let settle!: (value: Awaited<ReturnType<typeof redeemHouseholdInvite>>) => void;
  vi.mocked(redeemHouseholdInvite).mockImplementation(() => new Promise(resolve => { settle = resolve; }));
  await act(async () => { root.render(createElement(App)); });
  await waitFor(() => expect(container.textContent).toContain("Your name"));
  const name = container.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "Bianca");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { button("Accept invitation").click(); });
  await waitFor(() => expect(redeemHouseholdInvite).toHaveBeenCalled());
  callbackAuth.userId = "another-google-account";
  await act(async () => { settle({ ok: true, environment: "development", householdId: "another-household", memberId: "new-member" } as Awaited<ReturnType<typeof redeemHouseholdInvite>>); });
  expect(writes.candidates.some(h => h.householdId === "another-household")).toBe(false);
  expect(localStorage.getItem("hearth:session:v1:development") ?? "").not.toContain("new-member");
  expect(container.textContent).toContain("The Google account changed during this invitation");
  expect(button("Try invitation again").disabled).toBe(false);
 });

});
