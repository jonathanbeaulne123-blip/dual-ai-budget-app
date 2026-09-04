// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addAccount, catalogHousehold, financialAuditHash, linkGoogleIdentity, postEntry, seedDemoHousehold, splitForSync, startMonthRehearsal, type Household, type PersonalEnvelope } from "../src/core/index.ts";
import { markSynchronized } from "../src/core/sharing.ts";
import { createMemoryContinuityStore, enqueueContinuitySnapshot, listContinuityOutbox, setContinuityStore } from "../src/continuity.ts";

vi.setConfig({ testTimeout: 60_000 });
afterAll(() => vi.resetConfig());

type Inspection = {
  ok: boolean;
  issue?: "missing-schema" | "incomplete-migration" | "interrupted-transaction" | "invalid-stored-data" | "projection-mismatch";
  message: string;
  entryCount: number;
};

const startup = vi.hoisted(() => ({
  cached: null as Household | null,
  inspections: [] as Array<Promise<Inspection> | Error>,
  inspectOptions: [] as Array<{ expectedAuditHash?: string }>,
  inspectCalls: 0,
  ingestOptions: [] as Array<{ auditHash?: string; incremental?: boolean }>,
  ingestCalls: 0,
  saveCalls: 0,
  savedHouseholds: [] as Household[],
  reconcileCalls: 0,
  remote: new Promise<Household>(() => {}),
  cloudRemote: new Promise<Household | null>(() => {}),
  cloudPersonal: new Promise<PersonalEnvelope | null>(() => {}),
  consistentPullCalls: 0,
  stagedCandidates: [] as Household[],
  repairedCandidates: [] as Household[],
  transportCalls: [] as Household[],
  lifecycle: [] as string[],
  transportResult: null as null | { ok: true; remoteRevision?: number } | { ok: false; errorClass: "pending-transport" | "conflict-detected" | "disconnected"; message: string },
}));

vi.mock("../src/continuity.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/continuity.ts")>();
  return {
    ...actual,
    transportHouseholdWithOutbox: vi.fn(async (input: Parameters<typeof actual.transportHouseholdWithOutbox>[0]) => {
      startup.transportCalls.push(input.household);
      startup.lifecycle.push(`transport:${input.household.transactions.length}`);
      if (startup.transportResult) return startup.transportResult;
      return actual.transportHouseholdWithOutbox(input);
    }),
  };
});

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    peekHousehold: vi.fn(() => startup.cached),
    loadHousehold: vi.fn(async () => startup.cached),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (household: Household) => {
      startup.saveCalls += 1;
      startup.savedHouseholds.push(household);
      startup.lifecycle.push(`save:${household.transactions.length}`);
    }),
  };
});

vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  return {
    ...actual,
    inspectBrowserBooks: vi.fn((household: Household, options: { expectedAuditHash?: string } = {}) => {
      startup.inspectCalls += 1;
      startup.inspectOptions.push(options);
      const next = startup.inspections.shift();
      if (next instanceof Error) throw next;
      return next ?? Promise.resolve({
        ok: true,
        message: "PGlite agrees.",
        entryCount: household.transactions.length,
      });
    }),
    ingestHouseholdBooks: vi.fn(async (household: Household, options: { auditHash?: string; incremental?: boolean } = {}) => {
      startup.ingestCalls += 1;
      startup.ingestOptions.push(options);
      startup.lifecycle.push(`ingest:${household.transactions.length}`);
      return {
        compiled: {} as never,
        status: {
          ok: true,
          engine: "pglite" as const,
          entryCount: household.transactions.length,
          inBalance: true,
          equationHolds: true,
        },
      };
    }),
    validateHouseholdBooksStaged: vi.fn(async (household: Household) => {
      startup.stagedCandidates.push(household);
      startup.lifecycle.push(`stage:${household.transactions.length}`);
      return { ok: true, engine: "pglite" as const, entryCount: household.transactions.length, inBalance: true, equationHolds: true };
    }),
    repairAcceptedHouseholdBooks: vi.fn(async (household: Household) => {
      startup.repairedCandidates.push(household);
      return { ok: true, engine: "pglite" as const, entryCount: household.transactions.length, inBalance: true, equationHolds: true };
    }),
    replaceAcceptedHouseholdBooks: vi.fn(async (household: Household) => {
      startup.repairedCandidates.push(household);
      return { ok: true, engine: "pglite" as const, entryCount: household.transactions.length, inBalance: true, equationHolds: true };
    }),
  };
});

vi.mock("../src/ledger/supabase.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/supabase.ts")>();
  return {
    ...actual,
    pullHouseholdSnapshotById: vi.fn(() => startup.cloudRemote),
    pullPersonalSnapshotById: vi.fn(() => startup.cloudPersonal),
    pullConsistentMemberReplicaById: vi.fn(async () => {
      startup.consistentPullCalls += 1;
      const [shared, personal] = await Promise.all([startup.cloudRemote, startup.cloudPersonal]);
      return shared && personal ? { shared, personal, revision: shared.revision } : null;
    }),
  };
});

vi.mock("../src/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api.ts")>();
  return {
    ...actual,
    pullSharedHousehold: vi.fn(() => {
      startup.reconcileCalls += 1;
      return startup.remote;
    }),
  };
});

vi.mock("../src/deferredSurfaces.tsx", () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: () => createElement("div", { "data-testid": "cached-office-shell" }, "Cached office shell"),
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

import { App } from "../src/App.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find((item) => item.getAttribute("aria-label") === label || item.textContent?.trim() === label);
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}

function tapPad(container: HTMLElement, label: string): void {
  const key = [...container.querySelectorAll(".cad-pad-keys button")].find((item) => item.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
  if (!key) throw new Error(`Missing pad key ${label}`);
  act(() => { key.click(); });
}

function openExpenseSlideshow(): void {
  act(() => button("Add money").click());
  act(() => button("Add expense").click());
}

function walkExpenseToConfirm(container: HTMLElement, accountName = "Visa"): HTMLButtonElement {
  tapPad(container, "1");
  const enter = [...container.querySelectorAll("button")].find((item) => item.textContent === "Enter") as HTMLButtonElement | undefined;
  if (!enter) throw new Error("Missing Enter");
  act(() => { enter.click(); });
  const groceries = [...container.querySelectorAll("button.chip")].find((item) => item.textContent === "Groceries") as HTMLButtonElement | undefined;
  if (!groceries) throw new Error("Missing Groceries");
  act(() => { groceries.click(); });
  const account = [...container.querySelectorAll(".wallet-tile")].find((item) => item.textContent?.includes(accountName)) as HTMLButtonElement | undefined;
  if (!account) throw new Error(`Missing ${accountName} tile`);
  act(() => { account.click(); });
  const skip = [...container.querySelectorAll("button")].find((item) => item.textContent === "Skip") as HTMLButtonElement | undefined;
  if (!skip) throw new Error("Missing Skip");
  act(() => { skip.click(); });
  const confirm = container.querySelector("[data-add-confirm]") as HTMLButtonElement | null;
  if (!confirm) throw new Error("Missing Confirm");
  return confirm;
}

async function startValidation(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

async function settleUi(ms = 100): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function waitForUi(assertion: () => void, timeout = 30_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown = new Error("UI condition was not met.");
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (caught) {
      lastError = caught;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  throw lastError;
}

function cloudBackedPersonalBooks() {
  const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
  const withAccount = addAccount(catalogHousehold(), {
    name: "Private chequing",
    kind: "chequing",
    scope: "personal",
    ownerMemberId: "MEM-002",
  }).household;
  const household = linkGoogleIdentity(withAccount, {
    memberId: "MEM-002",
    ...identity,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
  return { identity, household: markSynchronized({ ...household, linked: true, revision: 12, baseRevision: 12 }) };
}

function storeAuthSession(identity: { email: string; subject: string }, expiresAt = Date.now() + 3_600_000): void {
  localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
    accessToken: "valid-access",
    refreshToken: "valid-refresh",
    userId: "auth-user-jonathan",
    sessionId: "11111111-1111-4111-8111-111111111111",
    email: identity.email,
    googleSubject: identity.subject,
    displayName: "Jonathan",
    expiresAt,
  }));
}

describe("cached-shell startup books gate", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    setContinuityStore(createMemoryContinuityStore());
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    startup.cached = { ...catalogHousehold(), linked: true };
    startup.inspections = [];
    startup.inspectOptions = [];
    startup.inspectCalls = 0;
    startup.ingestOptions = [];
    startup.ingestCalls = 0;
    startup.saveCalls = 0;
    startup.savedHouseholds = [];
    startup.reconcileCalls = 0;
    startup.remote = new Promise<Household>(() => {});
    startup.cloudRemote = new Promise<Household | null>(() => {});
    startup.cloudPersonal = new Promise<PersonalEnvelope | null>(() => {});
    startup.consistentPullCalls = 0;
    startup.stagedCandidates = [];
    startup.repairedCandidates = [];
    startup.transportCalls = [];
    startup.lifecycle = [];
    startup.transportResult = null;
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "household",
      householdId: startup.cached.householdId,
    }));
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => window.clearTimeout(id),
    });
    class TestResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    setContinuityStore(null);
  });

  it("names a missing secure cloud session and offers Google reconnect", async () => {
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    startup.cached = markSynchronized({ ...catalogHousehold(), linked: true, revision: 67 });
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    const status = container.querySelector(".sync-freshness") as HTMLElement | null;
    expect(status?.textContent).toContain("Google sign-in needed");
    expect(status?.textContent).toContain("Continue with Google");
    expect(status?.textContent).not.toContain("Checking every 4 s");
    expect(button("Continue with Google")).not.toBeNull();
    expect(localStorage.getItem("hearth:v1:supabase-auth:development")).toBeNull();

    const sessionKey = "hearth:v1:supabase-auth:development";
    const restoredSession = JSON.stringify({
      accessToken: "restored-access",
      refreshToken: "restored-refresh",
      userId: "auth-user",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "jonathan@example.com",
      expiresAt: Date.now() + 3_600_000,
    });
    localStorage.setItem(sessionKey, restoredSession);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: sessionKey,
        oldValue: null,
        newValue: restoredSession,
      }));
      await Promise.resolve();
    });
    expect(container.querySelector(".sync-freshness")?.textContent).not.toContain("Google sign-in needed");

    localStorage.removeItem(sessionKey);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: sessionKey,
        oldValue: restoredSession,
        newValue: null,
      }));
      await Promise.resolve();
    });
    expect(container.querySelector(".sync-freshness")?.textContent).toContain("Google sign-in needed");

    localStorage.setItem(sessionKey, restoredSession);
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: sessionKey,
        oldValue: null,
        newValue: restoredSession,
        storageArea: localStorage,
      }));
      await Promise.resolve();
    });
    expect(container.querySelector(".sync-freshness")?.textContent).not.toContain("Google sign-in needed");

    localStorage.clear();
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: null,
        oldValue: null,
        newValue: null,
        storageArea: localStorage,
      }));
      await Promise.resolve();
    });
    expect(container.querySelector(".sync-freshness")?.textContent).toContain("Google sign-in needed");
  });

  it("turns a refused session refresh into the same explicit reconnect state", async () => {
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    vi.stubEnv("VITE_CONTINUITY_REALTIME", "1");
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("expired", { status: 401 }));
    startup.cached = markSynchronized({ ...catalogHousehold(), linked: true, revision: 67 });
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
      accessToken: "expired-access",
      refreshToken: "expired-refresh",
      userId: "auth-user",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: "jonathan@example.com",
      googleSubject: "google-sub",
      displayName: "Jonathan",
      expiresAt: 1,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await settleUi(200);

    expect(localStorage.getItem("hearth:v1:supabase-auth:development")).toBeNull();
    expect(container.querySelector(".sync-freshness")?.textContent).toContain("Google sign-in needed");
    expect(button("Continue with Google")).not.toBeNull();
  });

  it("paints the cached kitchen immediately, locks Post, then unlocks before remote reconcile finishes", async () => {
    let resolveInspection: ((inspection: Inspection) => void) | null = null;
    startup.inspections.push(new Promise<Inspection>((resolve) => { resolveInspection = resolve; }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });

    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector("[data-testid='cached-office-shell']")).not.toBeNull();
    expect(container.querySelector("[data-books-readiness='validating']")).not.toBeNull();
    expect(startup.inspectCalls).toBe(0);
    expect(startup.reconcileCalls).toBe(0);

    openExpenseSlideshow();
    const confirmWhileValidating = walkExpenseToConfirm(container);
    expect(confirmWhileValidating.disabled).toBe(true);

    await startValidation();
    expect(startup.inspectCalls).toBe(1);
    expect(startup.reconcileCalls).toBe(0);

    await act(async () => {
      resolveInspection?.({ ok: true, message: "PGlite agrees.", entryCount: 0 });
      await Promise.resolve();
    });

    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
    const confirmReady = container.querySelector("[data-add-confirm]") as HTMLButtonElement;
    expect(confirmReady.disabled).toBe(false);
    expect(startup.reconcileCalls).toBe(1);

    const savesBeforePost = startup.saveCalls;
    act(() => { confirmReady.click(); });
    await waitForUi(() => expect(startup.saveCalls).toBeGreaterThan(savesBeforePost));
    expect(startup.saveCalls).toBeGreaterThan(savesBeforePost);
    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).toBeNull();
  });

  it.each(["household", "personal"] as const)("keeps %s Confirm uncommitted before staging while a cloud-backed device is offline", async (view) => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const books = view === "personal"
      ? addAccount(catalogHousehold(), {
        name: "Private chequing",
        kind: "chequing",
        scope: "personal",
        ownerMemberId: "MEM-002",
      }).household
      : catalogHousehold();
    startup.cached = markSynchronized({ ...books, linked: true, revision: 12, baseRevision: 12 });
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view,
      householdId: startup.cached.householdId,
    }));
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container, view === "personal" ? "Private chequing" : "Visa");
    const savesBefore = startup.saveCalls;
    act(() => { confirm.click(); });
    await waitForUi(() => expect(container.textContent).toContain("Cloud-backed books are read-only while this device is offline"));

    expect(startup.saveCalls).toBe(savesBefore);
    expect(startup.stagedCandidates).toHaveLength(0);
    expect(container.textContent).toContain("Cloud-backed books are read-only while this device is offline");
    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull();
  });

  it("refuses Auth-enabled offline Personal Confirm before refreshing an expired session", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const { identity, household } = cloudBackedPersonalBooks();
    startup.cached = household;
    startup.cloudRemote = Promise.resolve(household);
    startup.cloudPersonal = Promise.resolve(splitForSync(household, "MEM-002").personal);
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "personal",
      householdId: household.householdId,
    }));
    storeAuthSession(identity);

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    storeAuthSession(identity, 1);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const stagesBefore = startup.stagedCandidates.length;
    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container, "Private chequing");
    const savesBefore = startup.saveCalls;
    act(() => { confirm.click(); });
    await waitForUi(() => expect(container.textContent).toContain("Cloud-backed books are read-only while this device is offline"));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(startup.stagedCandidates).toHaveLength(stagesBefore);
    expect(startup.transportCalls).toHaveLength(0);
    expect(startup.saveCalls).toBe(savesBefore);
    expect(container.textContent).toContain("Cloud-backed books are read-only while this device is offline");
  });

  it("commits an online Personal Confirm only after staged acceptance and cloud acknowledgement", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const { identity, household } = cloudBackedPersonalBooks();
    startup.cached = household;
    startup.cloudRemote = Promise.resolve(household);
    startup.cloudPersonal = Promise.resolve(splitForSync(household, "MEM-002").personal);
    startup.transportResult = { ok: true, remoteRevision: 13 };
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "personal",
      householdId: household.householdId,
    }));
    storeAuthSession(identity);

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(startup.consistentPullCalls).toBeGreaterThan(0));
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    const savesBefore = startup.saveCalls;
    const ingestsBefore = startup.ingestCalls;
    const lifecycleBefore = startup.lifecycle.length;
    const commandTransactionCount = household.transactions.length + 1;
    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container, "Private chequing");
    act(() => { confirm.click(); });
    await waitForUi(() => expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).toBeNull());

    expect(startup.transportCalls).toHaveLength(1);
    expect(startup.ingestCalls).toBe(ingestsBefore + 1);
    expect(startup.saveCalls).toBeGreaterThanOrEqual(savesBefore + 1);
    expect(startup.savedHouseholds.some((saved) => (
      saved.transactions.length === commandTransactionCount
      && saved.transactions.some((row) => row.visibility === "personal" && row.amountCents === 1)
    ))).toBe(true);
    const lifecycle = startup.lifecycle.slice(lifecycleBefore);
    const stageIndex = lifecycle.indexOf(`stage:${commandTransactionCount}`);
    const transportIndex = lifecycle.indexOf(`transport:${commandTransactionCount}`);
    const ingestIndex = lifecycle.indexOf(`ingest:${commandTransactionCount}`);
    const saveIndex = lifecycle.indexOf(`save:${commandTransactionCount}`);
    expect(stageIndex).toBeGreaterThanOrEqual(0);
    expect(transportIndex).toBeGreaterThan(stageIndex);
    expect(ingestIndex).toBeGreaterThan(transportIndex);
    expect(saveIndex).toBeGreaterThan(transportIndex);
  });

  it("keeps an online Personal cloud refusal out of active and durable books", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const { identity, household } = cloudBackedPersonalBooks();
    startup.cached = household;
    startup.cloudRemote = Promise.resolve(household);
    startup.cloudPersonal = Promise.resolve(splitForSync(household, "MEM-002").personal);
    startup.transportResult = { ok: false, errorClass: "disconnected", message: "Cloud refused the Personal change." };
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "personal",
      householdId: household.householdId,
    }));
    storeAuthSession(identity);

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(startup.consistentPullCalls).toBeGreaterThan(0));
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    const savesBefore = startup.saveCalls;
    const ingestsBefore = startup.ingestCalls;
    const lifecycleBefore = startup.lifecycle.length;
    const commandTransactionCount = household.transactions.length + 1;
    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container, "Private chequing");
    act(() => { confirm.click(); });
    await waitForUi(() => expect(container.textContent).toContain("Cloud refused the Personal change"));

    expect(startup.transportCalls).toHaveLength(1);
    expect(startup.ingestCalls).toBe(ingestsBefore);
    expect(startup.savedHouseholds.slice(savesBefore).some((saved) => (
      saved.transactions.length === commandTransactionCount
      && saved.transactions.some((row) => row.visibility === "personal" && row.amountCents === 1)
    ))).toBe(false);
    const lifecycle = startup.lifecycle.slice(lifecycleBefore);
    const stageIndex = lifecycle.indexOf(`stage:${commandTransactionCount}`);
    const transportIndex = lifecycle.indexOf(`transport:${commandTransactionCount}`);
    expect(stageIndex).toBeGreaterThanOrEqual(0);
    expect(transportIndex).toBeGreaterThan(stageIndex);
    expect(lifecycle).not.toContain(`ingest:${commandTransactionCount}`);
    expect(lifecycle).not.toContain(`save:${commandTransactionCount}`);
    expect(container.textContent).toContain("Cloud refused the Personal change");
    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull();
  });

  it("refuses shared Confirm before staging when Auth belongs to a different household member", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    startup.cached = markSynchronized({ ...linked, linked: true, revision: 12, baseRevision: 12 });
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
      userId: "auth-user-bianca",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: identity.email,
      googleSubject: identity.subject,
      displayName: "Bianca",
      expiresAt: Date.now() + 3_600_000,
    }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container);
    const savesBefore = startup.saveCalls;
    const ingestsBefore = startup.ingestCalls;
    act(() => { confirm.click(); });
    await waitForUi(() => expect(container.textContent).toMatch(/Google sign-in does not match the selected household member|Continue with Google before changing these cloud-backed books/));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(listContinuityOutbox("development")).toHaveLength(0);
    expect(startup.stagedCandidates).toHaveLength(0);
    expect(startup.ingestCalls).toBe(ingestsBefore);
    expect(startup.saveCalls).toBe(savesBefore);
    expect(container.textContent).toMatch(/Google sign-in does not match the selected household member|Continue with Google before changing these cloud-backed books/);
    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull();
  });

  it("keeps writes blocked when a complete shared and Personal cloud generation is unavailable", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    startup.cached = markSynchronized({ ...linked, linked: true, revision: 12, baseRevision: 12 });
    startup.cloudRemote = Promise.resolve(markSynchronized({ ...linked, linked: true, revision: 13, baseRevision: 13 }));
    startup.cloudPersonal = Promise.resolve(null);
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
      userId: "auth-user-bianca",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: identity.email,
      googleSubject: identity.subject,
      displayName: "Bianca",
      expiresAt: Date.now() + 3_600_000,
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(startup.consistentPullCalls).toBeGreaterThan(0));
    await settleUi();

    openExpenseSlideshow();
    const confirm = walkExpenseToConfirm(container);
    const savesBefore = startup.saveCalls;
    const ingestsBefore = startup.ingestCalls;
    act(() => { confirm.click(); });
    await settleUi();

    expect(listContinuityOutbox("development")).toHaveLength(0);
    expect(startup.stagedCandidates).toHaveLength(0);
    expect(startup.ingestCalls).toBe(ingestsBefore);
    expect(startup.saveCalls).toBe(savesBefore);
    expect(container.textContent).toContain("refreshing both Shared and Personal books");
  });

  it("adopts same-member Personal with its stable newer Shared startup generation", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    const localWithOldPersonal = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "91.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Old local Personal",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const cloudSharedHousehold = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner shared row",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const cloudPersonalHousehold = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Newest cloud Personal",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    startup.cached = markSynchronized({ ...localWithOldPersonal, linked: true, revision: 12, baseRevision: 12 });
    startup.cloudRemote = Promise.resolve(markSynchronized({ ...cloudSharedHousehold, linked: true, revision: 13, baseRevision: 13 }));
    startup.cloudPersonal = Promise.resolve(splitForSync(cloudPersonalHousehold, "MEM-002").personal);
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
      accessToken: "valid-access",
      refreshToken: "valid-refresh",
      userId: "auth-user-bianca",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: identity.email,
      googleSubject: identity.subject,
      displayName: "Bianca",
      expiresAt: Date.now() + 3_600_000,
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(startup.savedHouseholds.some((saved) => (
      saved.revision === 13
      && saved.transactions.some((row) => row.note === "Newest cloud Personal")
    ))).toBe(true));

    const adopted = startup.savedHouseholds.filter((saved) => saved.revision === 13).at(-1);
    expect(adopted?.transactions.some((row) => row.note === "Partner shared row")).toBe(true);
    expect(adopted?.transactions.some((row) => row.note === "Newest cloud Personal")).toBe(true);
    expect(adopted?.transactions.some((row) => row.note === "Old local Personal")).toBe(false);
  }, 30_000);

  it("fails closed on a projection mismatch and offers retry without rebuilding", async () => {
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "projection-mismatch",
      message: "The cached snapshot and accepted journal do not agree.",
      entryCount: 2,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull();
    expect(container.textContent).toContain("Books need attention");
    expect(button("Retry validation")).not.toBeNull();
    expect(startup.ingestCalls).toBe(0);
    expect(startup.reconcileCalls).toBe(0);
    openExpenseSlideshow();
    expect(walkExpenseToConfirm(container).disabled).toBe(true);
  });

  it("keeps an arbitrary projection mismatch blocked until an authenticated cloud refresh", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const accepted = { ...seedDemoHousehold(), linked: true, revision: 8, baseRevision: 8 };
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    startup.cached = markSynchronized(accepted);
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "projection-mismatch",
        message: "The cached projection belongs to an older compiler.",
        entryCount: 0,
      }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(0);
    expect(container.textContent).toContain("Books need attention");
    expect(button("Restore from cloud copy")).not.toBeNull();
  });

  it("restores a blocked projection from authenticated shared and personal cloud copies", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    vi.stubEnv("VITE_SUPABASE_URL", "https://continuity.example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(seedDemoHousehold(), {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    const localPrivate = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "999.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Corrupted local private row",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    startup.cached = markSynchronized({ ...localPrivate, revision: 8, baseRevision: 8 });
    localStorage.setItem("hearth:session:v1:development", JSON.stringify({
      memberId: "MEM-002",
      view: "household",
      householdId: startup.cached.householdId,
    }));
    localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "auth-user",
      sessionId: "11111111-1111-4111-8111-111111111111",
      email: identity.email,
      googleSubject: identity.subject,
      displayName: "Bianca",
      expiresAt: Date.now() + 3_600_000,
    }));
    const cloudShared = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared cloud row",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const cloudPersonalHousehold = postEntry(linked, {
      date: "2026-09-03",
      type: "expense",
      amount: "8.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal cloud row",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    startup.cloudRemote = Promise.resolve(markSynchronized({ ...cloudShared, revision: 9, baseRevision: 9 }));
    startup.cloudPersonal = Promise.resolve(splitForSync(cloudPersonalHousehold, "MEM-002").personal);
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "projection-mismatch",
      message: "The cached projection is not authoritative.",
      entryCount: 0,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());
    await act(async () => {
      button("Restore from cloud copy").click();
      await Promise.resolve();
    });
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    const restored = startup.savedHouseholds.at(-1);
    expect(restored?.revision).toBe(9);
    expect(restored?.transactions.some((row) => row.note === "Shared cloud row")).toBe(true);
    expect(restored?.transactions.some((row) => row.note === "Personal cloud row")).toBe(true);
    expect(startup.consistentPullCalls).toBeGreaterThanOrEqual(1);
    expect(restored?.transactions.some((row) => row.note === "Corrupted local private row")).toBe(false);
    expect(startup.stagedCandidates.at(-1)?.householdId).toBe(restored?.householdId);
    expect(startup.repairedCandidates.at(-1)?.booksAcceptedHash).toBe(restored?.booksAcceptedHash);
  });

  it("keeps projection recovery blocked when the device still has an unacknowledged tip", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const accepted = { ...seedDemoHousehold(), linked: true, revision: 8, baseRevision: 7 };
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    startup.cached = { ...accepted, sharing: { ...markSynchronized(accepted).sharing, mode: "pending-transport", pending: true } };
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "projection-mismatch",
      message: "The cached snapshot and accepted journal do not agree.",
      entryCount: 0,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(0);
    expect(container.textContent).toContain("Books need attention");
    expect(container.textContent).toContain("Local books repair needed");
  });

  it("opens the exact pre-launch pending tip after its receipt and durable outbox binding agree", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(seedDemoHousehold(), {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    const accepted = {
      ...linked,
      linked: true,
      revision: 8,
      baseRevision: 7,
      commandReceipts: [{
        confirmationId: "confirm-legacy-tip",
        identityHash: "legacy-identity",
        auditHash: "",
        commandKind: "commit",
        postedIds: [],
        revision: 8,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    accepted.commandReceipts[0]!.auditHash = accepted.booksAcceptedHash;
    startup.cached = {
      ...accepted,
      sharing: { ...markSynchronized(accepted).sharing, mode: "pending-transport", pending: true },
    };
    enqueueContinuitySnapshot({
      household: startup.cached,
      identity,
      expectedRevision: 7,
      confirmationId: "confirm-legacy-tip",
    });
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "projection-mismatch",
        message: "The cached snapshot and accepted journal do not agree.",
        entryCount: 0,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
    expect(container.textContent).not.toContain("Books need attention");
  });

  it("repairs the pre-launch crash window after reload without treating the staged tip as active books", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(seedDemoHousehold(), {
      memberId: "MEM-002",
      ...identity,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    const previous = { ...linked, linked: true, revision: 7, baseRevision: 7 };
    previous.booksAcceptedHash = await financialAuditHash(previous);
    startup.cached = markSynchronized(previous);
    const candidate = {
      ...previous,
      revision: 8,
      baseRevision: 7,
      commandReceipts: [{
        confirmationId: "confirm-staged-crash",
        identityHash: "staged-identity",
        auditHash: "staged-audit",
        commandKind: "commit",
        postedIds: [],
        revision: 8,
        acceptedAt: "2026-09-03T12:00:00.000Z",
      }],
    };
    const durable = createMemoryContinuityStore();
    setContinuityStore(durable);
    enqueueContinuitySnapshot({
      household: candidate,
      identity,
      expectedRevision: 7,
      confirmationId: "confirm-staged-crash",
    });
    // Simulate a new process: durable metadata survives; the memory-only candidate does not.
    setContinuityStore(durable);
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "projection-mismatch",
        message: "PGlite advanced before the device snapshot.",
        entryCount: 0,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
  });

  it("repairs only a missing schema and opens after the repaired projection validates", async () => {
    startup.inspections.push(
      Promise.resolve({ ok: false, issue: "missing-schema", message: "Schema missing.", entryCount: 0 }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: 0 }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.inspectCalls).toBe(2);
    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
  });

  it("re-anchors an incomplete migration only from its accepted snapshot receipt", async () => {
    const accepted = { ...seedDemoHousehold(), linked: true };
    startup.cached = { ...accepted, booksAcceptedHash: await financialAuditHash(accepted) };
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "incomplete-migration",
        message: "PGlite needs one verified full rebuild before fast local updates can resume.",
        entryCount: startup.cached.transactions.length,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.inspectCalls).toBe(2);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
    expect(startup.inspectOptions[1]).toEqual({ expectedAuditHash: startup.cached.booksAcceptedHash });
  });

  it("keeps the receipt-gated v8 rebuild for a local-only Development household", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const accepted = { ...seedDemoHousehold(), linked: false };
    startup.cached = { ...accepted, booksAcceptedHash: await financialAuditHash(accepted) };
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "incomplete-migration",
        message: "PGlite needs one verified full rebuild before fast local updates can resume.",
        entryCount: startup.cached.transactions.length,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
  });

  it("keeps an incomplete migration blocked when the cached snapshot receipt does not match", async () => {
    startup.cached = { ...seedDemoHousehold(), linked: true, booksAcceptedHash: "changed-receipt" };
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "incomplete-migration",
      message: "PGlite needs one verified full rebuild before fast local updates can resume.",
      entryCount: startup.cached.transactions.length,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(0);
    expect(startup.inspectCalls).toBe(1);
    expect(container.textContent).toContain("receipt-covered money facts changed after acceptance");
  });

  it("does not bypass the online-required gate for a pending pre-v8 snapshot without a durable tip", async () => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    const accepted = { ...seedDemoHousehold(), linked: true, revision: 8, baseRevision: 7 };
    accepted.booksAcceptedHash = await financialAuditHash(accepted);
    startup.cached = {
      ...accepted,
      sharing: { ...markSynchronized(accepted).sharing, mode: "pending-transport", pending: true },
    };
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "incomplete-migration",
      message: "PGlite needs one verified full rebuild before fast local updates can resume.",
      entryCount: startup.cached.transactions.length,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(0);
    expect(container.textContent).toContain("Books need attention");
  });

  it("rebuilds an interrupted local projection only from its accepted snapshot receipt", async () => {
    const accepted = { ...seedDemoHousehold(), linked: true };
    startup.cached = { ...accepted, booksAcceptedHash: await financialAuditHash(accepted) };
    startup.inspections.push(
      Promise.resolve({
        ok: false,
        issue: "interrupted-transaction",
        message: "The snapshot has journal facts that PGlite does not. Nothing was discarded.",
        entryCount: 0,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.inspectCalls).toBe(2);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
    expect(startup.inspectOptions[1]).toEqual({ expectedAuditHash: startup.cached.booksAcceptedHash });
    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
  });

  it("runs the same receipt-gated interrupted recovery after Retry validation", async () => {
    const accepted = { ...seedDemoHousehold(), linked: true };
    startup.cached = { ...accepted, booksAcceptedHash: await financialAuditHash(accepted) };
    startup.inspections.push(
      new Error("PGlite worker was unavailable."),
      Promise.resolve({
        ok: false,
        issue: "interrupted-transaction",
        message: "The snapshot has journal facts that PGlite does not. Nothing was discarded.",
        entryCount: 0,
      }),
      Promise.resolve({ ok: true, message: "PGlite agrees.", entryCount: startup.cached.transactions.length }),
    );

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());
    expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull();

    act(() => button("Retry validation").click());
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(1);
    expect(startup.inspectCalls).toBe(3);
    expect(startup.ingestOptions).toEqual([{ auditHash: startup.cached.booksAcceptedHash, incremental: false }]);
    expect(startup.inspectOptions[2]).toEqual({ expectedAuditHash: startup.cached.booksAcceptedHash });
    expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull();
  });

  it("keeps an interrupted projection blocked when its saved receipt does not match", async () => {
    startup.cached = { ...seedDemoHousehold(), linked: true, booksAcceptedHash: "changed-receipt" };
    startup.inspections.push(Promise.resolve({
      ok: false,
      issue: "interrupted-transaction",
      message: "The snapshot has journal facts that PGlite does not. Nothing was discarded.",
      entryCount: 0,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull());

    expect(startup.ingestCalls).toBe(0);
    expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull();
    expect(container.textContent).toContain("receipt-covered money facts changed after acceptance");

    act(() => button("More").click());
    const reset = button("Start from scratch");
    expect(reset.disabled).toBe(false);
    expect(container.textContent).not.toContain("Starting over…");
    act(() => reset.click());
    expect(button("Delete all Development households").disabled).toBe(false);
  });

  it("keeps Bianca Month inside the current App and opens the current income slideshow", async () => {
    startup.cached = startMonthRehearsal(startup.cached!, {
      monthKey: "2026-08",
      biancaParticipantId: "MEM-001",
      jonathanPartnerId: "MEM-002",
      startedByMemberId: "MEM-001",
      now: "2026-08-01T12:00:00.000Z",
    }).household;
    startup.inspections.push(Promise.resolve({
      ok: true,
      message: "PGlite agrees.",
      entryCount: startup.cached.transactions.length,
    }));

    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
    });
    await startValidation();
    await settleUi();

    const month = container.querySelector("[aria-label='Our month']");
    expect(month).not.toBeNull();
    act(() => button("Resume our month").click());
    const weekOne = [...container.querySelectorAll(".month-week-tabs button")]
      .find((item) => item.textContent?.includes("Week 1")) as HTMLButtonElement | undefined;
    if (!weekOne) throw new Error("Missing Bianca Month week one");
    act(() => weekOne.click());
    const incomeTask = [...container.querySelectorAll(".month-task-list > li")]
      .find((item) => item.querySelector("h3")?.textContent === "Add income that arrived");
    const start = incomeTask?.querySelector("button.primary") as HTMLButtonElement | null;
    if (!start) throw new Error("Missing Bianca Month income Start");
    act(() => start.click());
    await settleUi(180);

    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull();
    expect(container.textContent).toContain("How much came in?");
  });
});
