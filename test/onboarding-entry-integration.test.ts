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
import { GuidedSetupPreview } from "../src/GuidedSetupPreview.tsx";
import {
  acceptHouseholdWrite,
  acceptedHouseholdOnboarding,
  catalogHousehold,
  householdNeedsCharterFounding,
  newHouseholdTemplate,
  seedDemoHousehold,
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

async function openSetup() {
  await waitFor(()=>expect(document.querySelector('button.hercules-live')).not.toBeNull());
  await act(async()=>{document.querySelector('button.hercules-live')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
  await waitFor(()=>expect([...document.querySelectorAll('button')].find(item=>item.textContent?.trim()==='Set up Hearth')).not.toBeUndefined());
  await act(async()=>{button('Set up Hearth').click();});
  await waitFor(()=>expect(document.querySelector('.hercules-setup-backdrop:not([hidden])')).not.toBeNull());
}
describe("real household creation enters guided setup", () => {
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

  it("keeps the category catalogue but no longer seeds configured account facts", () => {
    const household = newHouseholdTemplate("development");
    expect(household.categories.length).toBeGreaterThan(0);
    expect(household.accounts).toEqual([]);
    expect(householdNeedsCharterFounding(household)).toBe(true);
  });

  it("accepts the demo kitchen seed through the real write boundary and exposes a member choice", async () => {
    const seeded = seedDemoHousehold({ today: "2026-09-06", environment: "development" });
    const selectedMember = seeded.members.find((member) => member.active && member.name === "Jonathan");
    let persisted: Household | null = null;
    expect(selectedMember).toBeDefined();

    const accepted = await acceptHouseholdWrite({
      previous: null,
      candidate: seeded,
      confirmationId: "demo-table-entry-test",
      actingMemberId: selectedMember!.id,
      adapters: {
        persist: async (household) => { persisted = household; },
        ingest: async () => ({ ok: true }),
      },
    });

    expect(accepted).toMatchObject({ ok: true, postedNothing: false });
    expect(persisted).toEqual(accepted.household);
    expect(accepted.household.members.find((member) => member.id === selectedMember!.id)).toMatchObject({
      active: true,
      name: "Jonathan",
    });
  });

  it("mounts the demo kitchen table and enters Home as the chosen member", async () => {
    const seeded = seedDemoHousehold({ today: "2026-09-06", environment: "development" });
    const jonathan = seeded.members.find((member) => member.active && member.name === "Jonathan")!;

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await waitFor(() => expect(container.textContent).toContain("Open the demo kitchen table"));

    act(() => button("Open the demo kitchen table").click());
    await waitFor(() => expect(container.textContent).toContain("Choose yourself"));
    await act(async () => { button("I am Jonathan").click(); });

    await waitFor(() => expect(container.querySelector("nav")).not.toBeNull());
    const acceptedDemo = writes.candidates.find((candidate) => (
      acceptedHouseholdOnboarding(candidate)?.state === "complete"
    ));
    expect(acceptedDemo).toBeDefined();
    expect(JSON.parse(localStorage.getItem("hearth:session:v1:development") ?? "null")).toMatchObject({
      memberId: jonathan.id,
      householdId: acceptedDemo!.householdId,
      view: "household",
    });
  });

  it("mounts App and proves Create household reaches the invitation", async () => {
    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await waitFor(() => expect(container.textContent).toContain("Continue with Google"));

    await act(async () => { button("Continue with Google").click(); });
    await waitFor(() => expect(container.textContent).toContain("No households yet"));

    act(() => button("Create household").click());
    await waitFor(() => expect(container.querySelector("form")).not.toBeNull());
    await act(async () => {
      (container.querySelector("form") as HTMLFormElement).requestSubmit();
    });

    await openSetup();
    await waitFor(() => expect(document.querySelector('.hercules-setup')?.textContent).toContain("When you're both ready to set up the household together"));
    expect([...document.querySelectorAll(".hercules-setup button")].find(b=>b.textContent==="Start together")).not.toBeNull();
    expect(writes.candidates[0]?.accounts).toEqual([]);
    expect(acceptedHouseholdOnboarding(writes.candidates.at(-1)!)?.state).toBe("offered");

    act(() => ([...document.querySelectorAll<HTMLButtonElement>(".hercules-setup button")].find(b=>b.textContent==="Close"))!.click());
    act(() => button("More").click());
    await waitFor(() => expect(container.textContent).toContain("This is a later Development reliability exercise, not household setup"));
    expect(container.textContent).toContain("Preview guided setup");
    expect(container.textContent).not.toContain("Prove recovery before week 1");
  });

  it("mounts existing accepted books and offers guided setup exactly once", async () => {
    writes.stored = catalogHousehold("development");
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "household",
      householdId: writes.stored.householdId,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    const offerReceiptIds = () => new Set(writes.candidates.flatMap((candidate) => candidate.commandReceipts
      .filter((receipt) => receipt.commandKind === "offerHouseholdOnboarding")
      .map((receipt) => receipt.confirmationId)));
    expect(offerReceiptIds().size).toBe(0);
    await openSetup();
    await waitFor(() => expect(offerReceiptIds().size).toBe(1));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(offerReceiptIds().size).toBe(1);
    const offers = writes.candidates.filter((candidate) => acceptedHouseholdOnboarding(candidate)?.state === "offered");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.at(-1)?.accounts.length).toBeGreaterThan(0);
  });
});

describe("Development guided setup preview", () => {
  it("shows all twelve chapters and navigation without a commit callback", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const previewRoot = createRoot(host);
    act(() => previewRoot.render(createElement(GuidedSetupPreview, { household: newHouseholdTemplate("development") })));
    const details = host.querySelector("details") as HTMLDetailsElement;
    act(() => { details.open = true; details.dispatchEvent(new Event("toggle", { bubbles: false })); });
    const chapterButtons = [...host.querySelectorAll<HTMLButtonElement>("[aria-label='Guided setup chapters'] button")];
    expect(chapterButtons).toHaveLength(12);
    expect(chapterButtons[0]?.textContent).toContain("Meet Hercules");
    expect(chapterButtons[8]?.textContent).toContain("Plan categories");
    expect(host.textContent).toContain("Nothing is saved");
    expect(host.textContent).toContain("never post money or confirm for you");
    const sampleAction = [...host.querySelectorAll<HTMLButtonElement>("button:disabled")]
      .find((candidate) => candidate.textContent?.includes("Next"));
    expect(sampleAction?.hasAttribute("aria-describedby")).toBe(false);
    act(() => [...host.querySelectorAll("[aria-label='Guided setup chapters'] button")].at(-1)?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("Let's prove one ordinary entry will be easy tomorrow");
    act(() => previewRoot.unmount());
    host.remove();
  });
});
