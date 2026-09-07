// @vitest-environment jsdom
// Mounted App regression for a stale session seat. Lives in its own file so a
// deliberately half-broken session cannot bleed into another case's module state.
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
    hostedContinuityAllowed: vi.fn(() => false),
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

vi.mock("../src/deferredSurfaces.tsx", () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: () => createElement("div", null),
  DeferredBooksPage: () => null,
  DeferredCalendarPage: () => null,
  DeferredWorkShiftPage: () => null,
  DeferredPairingCard: () => null,
  DeferredWelcomeJoin: () => null,
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
import { catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("App survives a stale session seat", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    writes.candidates = [];
    writes.stored = null;
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders without offering onboarding when the selected member is no longer active", async () => {
    const stored = catalogHousehold("development");
    const staleMemberId = "MEM-002";
    stored.members = stored.members.map((member) => (
      member.id === staleMemberId ? { ...member, active: false } : member
    ));
    writes.stored = stored;
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: staleMemberId,
      view: "household",
      householdId: stored.householdId,
    }));

    // nextChapterFor and the evidence-adoption probe both call memberProgress, which is
    // deliberately strict for command callers. Presentation must skip them for a stale
    // seat rather than take the render down.
    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(container.querySelector(".app")).not.toBeNull();
    expect(container.textContent).not.toContain("Choose an active household member.");
    expect(writes.candidates.some((candidate) => candidate.commandReceipts
      .some((receipt) => receipt.commandKind === "offerHouseholdOnboarding"))).toBe(false);
  });
});
