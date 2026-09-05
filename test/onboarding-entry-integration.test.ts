// @vitest-environment jsdom
// Real mounted entry-path regression: welcome -> create -> invitation.
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcceptWriteInput, CommandOutcome, Household } from "../src/core/index.ts";

const writes = vi.hoisted(() => ({ candidates: [] as Household[] }));

vi.mock("../src/core/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/index.ts")>();
  return {
    ...actual,
    acceptHouseholdWrite: vi.fn(async (input: AcceptWriteInput): Promise<CommandOutcome> => {
      writes.candidates.push(input.candidate);
      return {
        kind: "accepted-local",
        ok: true,
        household: input.candidate,
        previous: input.previous,
        postedIds: [],
        confirmationId: input.confirmationId ?? "create-entry-test",
        identityHash: "create-entry-test",
        revision: input.candidate.revision,
        sharingMode: "local",
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
        postedExactlyOnce: true,
        postedNothing: false,
      };
    }),
  };
});

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => null),
    loadHousehold: vi.fn(async () => null),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async () => undefined),
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
  acceptedHouseholdOnboarding,
  householdNeedsCharterFounding,
  newHouseholdTemplate,
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

describe("real household creation enters guided setup", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    writes.candidates = [];
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

    await waitFor(() => expect(container.textContent).toContain("When you're both ready to set up the household together"));
    expect(button("Start together")).not.toBeNull();
    expect(writes.candidates[0]?.accounts).toEqual([]);
    expect(acceptedHouseholdOnboarding(writes.candidates.at(-1)!)?.state).toBe("offered");

    act(() => button("Not now").click());
    act(() => button("More").click());
    await waitFor(() => expect(container.textContent).toContain("This is a later Development reliability exercise, not household setup"));
    expect(container.textContent).toContain("Preview guided setup");
    expect(container.textContent).not.toContain("Prove recovery before week 1");
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
    expect(host.querySelectorAll("[aria-label='Guided setup chapters'] button")).toHaveLength(12);
    expect(host.textContent).toContain("Nothing is saved");
    expect(host.textContent).toContain("never post money or confirm for you");
    act(() => [...host.querySelectorAll("[aria-label='Guided setup chapters'] button")].at(-1)?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("Let's prove one ordinary entry will be easy tomorrow");
    act(() => previewRoot.unmount());
    host.remove();
  });
});
