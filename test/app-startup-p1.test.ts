import * as syncFreshness from "../src/syncFreshness.ts";
import { shapeWorkJob, upsertWorkJob, postWorkShiftWithAttendanceReview } from "../src/core/index.ts";
import {dueOccurrenceReview} from "../src/core/dueOccurrenceReview.ts";
import { applyDuplicateReview } from "../src/core/duplicateReviewCommand.ts";
import { prepareDuplicateReview } from "../src/core/duplicateReview.ts";
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postVisit, settleClaim, addRecurrence, postOneRecurrence, startShiftBreak, addAccount, abandonOpenShift, clockInShift, clockOutShift, catalogHousehold, financialAuditHash, linkGoogleIdentity, offerHouseholdOnboarding, postEntry, seedDemoHousehold, splitForSync, startMonthRehearsal, todayKey, type Household, type PersonalEnvelope } from "../src/core/index.ts";
import { markSynchronized } from "../src/core/sharing.ts";
import { createMemoryContinuityStore, enqueueContinuitySnapshot, listContinuityOutbox, setContinuityStore } from "../src/continuity.ts";
import { completedExistingBooksHousehold, existingBooksActivationAt } from "./fixtures/existing-books-onboarding.ts";

vi.setConfig({ testTimeout: 60_000 });
afterAll(() => vi.resetConfig());

type Inspection = {
  ok: boolean;
  issue?: "missing-schema" | "incomplete-migration" | "interrupted-transaction" | "invalid-stored-data" | "projection-mismatch";
  message: string;
  entryCount: number;
};

const startup = vi.hoisted(() => ({
  officeKitchen: null as import("../src/kitchenCommand.ts").KitchenCommand | null,
  v2: false,
  auditReceipt: "missing" as "accepted"|"missing"|"pending"|"rejected",
  auditIds: [] as string[],
  auditStatus: null as Promise<"accepted"|"missing"|"pending"|"rejected">|null,
  returnAcceptedResults:false,
  acceptedResults:new Map<string,import("../src/core/types.ts").CommitResult>(),
  v2AutoAdopt: true,
  v2Clients: [] as import("../src/ledgerSync/client.ts").ClientOptions[],
  tillOpen:null as null | (()=>void),
  receiptUndo:null as null|(()=>void),
  swipeProps:null as null | {onPostCategory:(input:{amount:string;subcategoryId:string})=>void;onClose:()=>void;onMore:(amount:string)=>void;error?:string},
  claimReview:null as null|((id:string,summary:string)=>void),
  dueProps:null as null | Parameters<typeof import("../src/DuePreviewSheet.tsx").DuePreviewSheet>[0],
  removeReview:null as null | ((transaction:import("../src/core/types.ts").Transaction)=>void),
  duplicateWriter:null as import("../src/Ledger.tsx").DuplicateCommand|null,
  countProps: null as null | Parameters<typeof import("../src/WorkShiftPage.tsx").WorkShiftPage>[0],
  punchConfirm: null as null | ((candidate: Household) => Promise<import("../src/core/types.ts").CommitResult>),
  officePunch: null as null | {onSignOut:()=>Promise<void>;onStartBreak:(kind:"paid"|"unpaid")=>void;onGo:(tab:"home"|"ledger"|"till"|"shift")=>void},
  scenarioSource: null as import("../src/scenarioSourceContext.ts").ScenarioSourceContext | null,
  saveBarrier: null as {household: Household; promise: Promise<void>} | null,
  replicas: [] as import("../src/storage.ts").HouseholdReplicaSummary[],
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
  repairFailure: null as Error | null,
  transportCalls: [] as Household[],
  lifecycle: [] as string[],
  transportResult: null as null | { ok: true; remoteRevision?: number } | { ok: false; errorClass: "pending-transport" | "conflict-detected" | "disconnected"; message: string },
}));

vi.mock("../src/ledgerSync/presence.ts", () => ({ attachLedgerPresence: () => () => {} }));
vi.mock("../src/ledgerSync/client.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledgerSync/client.ts")>();
  return { ...actual, LedgerSyncClient: class {
    options: import("../src/ledgerSync/client.ts").ClientOptions;
    constructor(options: import("../src/ledgerSync/client.ts").ClientOptions) {
      this.options = options;
      if (!startup.v2) return new actual.LedgerSyncClient(options);
      startup.v2Clients.push(options);
    }
    async start() {
      // Models an authenticated, validated canonical snapshot. SQL readiness
      // must not be a second commit authority for this already-accepted state.
      if (startup.v2AutoAdopt) await this.options.adopt(startup.cached!);
      this.options.status("ready");
    }
    async confirm(candidate: Household, _id: string, _onQueued?: () => void) {
      startup.auditIds.push(_id);
      if (!startup.punchConfirm) throw new Error("Unexpected test confirmation");
      const result=await startup.punchConfirm(candidate);
      startup.acceptedResults.set(_id,result);
      await this.options.adopt(result.household);
      return result;
    }
    result(_id:string): import("../src/core/types.ts").CommitResult | undefined { return startup.returnAcceptedResults?startup.acceptedResults.get(_id):undefined; }
    async submissionStatus(_id:string){return startup.auditStatus ?? startup.auditReceipt;}
    retryPending(){}
    async destroy() {}
  } };
});

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
    listHouseholdReplicas: vi.fn(async () => startup.replicas),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (household: Household) => {
      startup.saveCalls += 1;
      startup.savedHouseholds.push(household);
      startup.lifecycle.push(`save:${household.transactions.length}`);
      if (startup.saveBarrier?.household === household) await startup.saveBarrier.promise;
    }),
  };
});

vi.mock("../src/ledger/engine.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/ledger/engine.ts")>();
  return {
    ...actual,
    // This fixture models the staged-books lifecycle; real PGlite has its own integration suite.
    prewarmStagedHouseholdBooks: vi.fn(async (household: Household) => {
      startup.lifecycle.push(`prewarm:${household.transactions.length}`);
    }),
    clearStagedHouseholdBooks: vi.fn(async (_environment: Household['environment'], householdId: string) => {
      startup.lifecycle.push(`clear-stage:${householdId}`);
    }),
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
      startup.lifecycle.push(`repair:${household.transactions.length}`);
      if (startup.repairFailure) throw startup.repairFailure;
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
    pullOrBootstrapConsistentMemberReplicaById: vi.fn(async () => {
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

vi.mock("../src/Till.tsx",async importOriginal=>{const actual=await importOriginal<typeof import("../src/Till.tsx")>();return {...actual,Till:(props:import("react").ComponentProps<typeof actual.Till>)=>{startup.tillOpen=props.onOpenSwipe;startup.receiptUndo=(props.strip as import("react").ReactElement<{onUndo?:()=>void}>|null)?.props?.onUndo??null;return createElement(actual.Till,props);}};});

vi.mock("../src/Swipe.tsx",()=>({Swipe:(props:NonNullable<typeof startup.swipeProps>)=>{startup.swipeProps=props;return createElement("div",{"data-testid":"swipe-stub"},props.error||"Swipe draft");}}));

vi.mock("../src/deferredSurfaces.tsx", () => ({
  DeferredSurface: ({ children }: { children: ReactNode }) => children,
  DeferredOffice: ({scenarioSource,onAskSettle,onKitchen,...punch}: {onKitchen:import("../src/kitchenCommand.ts").KitchenCommand;onAskSettle:(id:string,summary:string)=>void;scenarioSource?: import("../src/scenarioSourceContext.ts").ScenarioSourceContext | null;onSignOut:()=>Promise<void>;onStartBreak:(kind:"paid"|"unpaid")=>void;onGo:(tab:"home"|"ledger"|"till"|"shift")=>void}) => {
    startup.officeKitchen=onKitchen;startup.officePunch=punch;startup.claimReview=onAskSettle;
    startup.scenarioSource = scenarioSource ?? null;
    return createElement("div", { "data-testid": "cached-office-shell" }, "Cached office shell");
  },
  DeferredBooksPage: (props:{onDuplicateCommand:import("../src/Ledger.tsx").DuplicateCommand;onRemove:(transaction:import("../src/core/types.ts").Transaction)=>void}) => {startup.removeReview=props.onRemove;startup.duplicateWriter=props.onDuplicateCommand;return null;},
  DeferredCalendarPage: () => null,
  DeferredWorkShiftPage: (props: NonNullable<typeof startup.countProps>) => { startup.countProps=props; return createElement("div",{"data-testid":"shift-room-stub"}); },
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

vi.mock("../src/DuePreviewSheet.tsx",async importOriginal=>{const actual=await importOriginal<typeof import("../src/DuePreviewSheet.tsx")>();return {...actual,DuePreviewSheet:(props:Parameters<typeof actual.DuePreviewSheet>[0])=>{startup.dueProps=props;return createElement(actual.DuePreviewSheet,props);}};});

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
  const groceries = [...(container.querySelector('[data-entry-section="category"]')?.querySelectorAll("button.chip, button.swipe-cat") ?? [])].find((item) => item.textContent === "Groceries") as HTMLButtonElement | undefined;
  if (!groceries) throw new Error("Missing Groceries");
  act(() => { groceries.click(); });
  const account = [...(container.querySelector('[data-entry-section="account"]')?.querySelectorAll(".wallet-tile, .swipe-cat") ?? [])].find((item) => item.textContent?.includes(accountName)) as HTMLButtonElement | undefined;
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

async function acceptedScenarioFixture(): Promise<Household> {
  const h = markSynchronized({...completedExistingBooksHousehold(), linked: true});
  h.booksAcceptedHash = await financialAuditHash(h);
  const selected = JSON.parse(localStorage.getItem("hearth:session:v1:development")!);
  localStorage.setItem("hearth:session:v1:development", JSON.stringify({...selected, householdId: h.householdId}));
  return h;
}

function countReleaseHousehold(householdId: string, memberId: string): Household {
  const base = { ...catalogHousehold("development"), householdId };
  const job = shapeWorkJob({
    id: "JOB-SHARED",
    memberId,
    name: "Harbour",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-1",
        effectiveDate: "2026-01-01",
        grossHourlyRateCents: 1800,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1500,
        deductions: [],
        createdAt: "",
        updatedAt: "",
      }],
      createdAt: "",
      updatedAt: "",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CASH",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
  return upsertWorkJob(base, { job }).household;
}

describe("cached-shell startup books gate", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    startup.returnAcceptedResults=false;startup.acceptedResults.clear();
    startup.countProps = null;
    startup.v2 = false;
    startup.v2AutoAdopt = true;
    startup.v2Clients = [];
    startup.scenarioSource = null;
    startup.tillOpen = null;
    startup.swipeProps = null;
    startup.removeReview = null;
    startup.dueProps = null;
    startup.claimReview = null;
    startup.duplicateWriter = null;
    startup.punchConfirm = null;
    startup.officePunch = null;
    startup.officeKitchen = null;
    startup.saveBarrier = null;
    startup.replicas = [];
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
    startup.repairFailure = null;
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

  it("opens v2 accepted books without waiting for the legacy SQL replica", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    startup.cached = markSynchronized({ ...catalogHousehold(), linked: true, revision: 13 });
    const engine = await import("../src/ledger/engine.ts");
    vi.spyOn(engine, "ingestHouseholdBooks").mockClear().mockImplementation(() => new Promise(() => {}));
    await act(async () => { root.render(createElement(App)); });
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull(), 2000);
    expect(startup.ingestCalls).toBe(0);
    expect(engine.ingestHouseholdBooks).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Validating the local journal");
    expect(container.querySelector('.sync-freshness')?.textContent).not.toContain("Checking every");
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
    // Existing books now receive the setup offer as soon as validation opens
    // the write gate. Wait for that one metadata commit before asserting that
    // an unrelated financial Confirm is available.
    await waitForUi(() => expect(confirmReady.disabled).toBe(false));
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
    const freshness = vi.spyOn(syncFreshness, "buildSyncFreshness");
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
    await waitForUi(() => expect(freshness.mock.lastCall?.[0].syncState).toBe("synced"));
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
    const freshness = vi.spyOn(syncFreshness, "buildSyncFreshness");
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
    await waitForUi(() => expect(freshness.mock.lastCall?.[0].syncState).toBe("synced"));
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
    const savesBeforeRepair = startup.saveCalls;
    startup.repairFailure = new Error("The replacement projection did not validate.");
    await act(async () => {
      button("Restore from cloud copy").click();
      await Promise.resolve();
    });
    await waitForUi(() => expect(container.textContent).toContain("The replacement projection did not validate."));
    expect(startup.saveCalls).toBe(savesBeforeRepair);
    expect(container.querySelector("[data-books-readiness='blocked']")).not.toBeNull();

    startup.repairFailure = null;
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
    expect(startup.lifecycle.findIndex((event) => event.startsWith("repair:")))
      .toBeLessThan(startup.lifecycle.findIndex((event) => event.startsWith("save:")));
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
    // This test owns only schema repair. Give its cached books a real offered
    // record so the new startup offer write cannot outlive this test and leak
    // into the following migration assertion.
    startup.cached = offerHouseholdOnboarding(startup.cached!, {
      memberId: "MEM-002",
      at: "2026-09-06T12:00:00.000Z",
    }).household;
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
    const activationAt = existingBooksActivationAt();
    startup.cached = completedExistingBooksHousehold(activationAt);
    const rehearsalMonth = todayKey(new Date(activationAt), startup.cached.timezone).slice(0, 7);
    startup.cached = startMonthRehearsal(startup.cached!, {
      monthKey: rehearsalMonth,
      biancaParticipantId: "MEM-001",
      jonathanPartnerId: "MEM-002",
      startedByMemberId: "MEM-001",
      now: new Date(Date.parse(activationAt) + 10 * 60_000).toISOString(),
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
    // The mainline action stages asynchronously; wait for its actual UI result
    // rather than assuming a machine can finish that work within 180 ms.
    await waitForUi(() => expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull());

    expect(container.querySelector("[role='dialog'][aria-labelledby='add-sheet-title']")).not.toBeNull();
    expect(container.textContent).toContain("How much came in?");
  });


  it.each(['accepted', 'definitive rejection', 'ambiguous', 'pre-dispatch validation'] as const)('Notes App callback preserves %s', async mode => {
    startup.v2 = true; vi.stubEnv('VITE_LEDGER_SYNC_V2', '1'); vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH', '1');
    startup.cached = await acceptedScenarioFixture();
    const { scribbleChalk } = await import('../src/core/index.ts');
    const { LedgerCommandRejectedError } = await import('../src/ledgerSync/client.ts');
    const actual = scribbleChalk(startup.cached, { text: 'Only one note', author: 'MEM-002' });
    let calls = 0;
    startup.punchConfirm = async next => {
      calls++;
      if (mode === 'definitive rejection') throw new LedgerCommandRejectedError('BUSINESS_REJECTED');
      if (mode === 'ambiguous') throw new Error('Response lost');
      return { ...actual, household: next };
    };
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull(), 4000);
    const rejected = vi.fn();
    let outcome: import('../src/kitchenCommand.ts').KitchenCommandResult;
    await act(async () => {
      outcome = await startup.officeKitchen!(current => {
        if (mode === 'pre-dispatch validation') throw new Error('Invalid note draft');
        return scribbleChalk(current, { text: 'Only one note', author: 'MEM-002' });
      }, { onDefinitiveRejected: rejected });
    });
    expect(calls).toBe(mode === 'pre-dispatch validation' ? 0 : 1);
    if (mode === 'accepted') {
      expect(outcome!.ok).toBe(true);
      expect(outcome!.household.kitchen.chalkboard.filter(note => note.text === 'Only one note')).toHaveLength(1);
    } else expect(outcome!).toBeNull();
    expect(rejected).toHaveBeenCalledTimes(mode === 'definitive rejection' || mode === 'pre-dispatch validation' ? 1 : 0);
  });

  it('Notes App callback marks the unopened books gate as retryable no-write', async () => {
    startup.cached = await acceptedScenarioFixture();
    startup.inspections.push(new Promise(() => {}));
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.officeKitchen).not.toBeNull(), 4000);
    const { scribbleChalk } = await import('../src/core/index.ts');
    const rejected = vi.fn();
    const before = startup.saveCalls;
    await act(async () => {
      expect(await startup.officeKitchen!(current => scribbleChalk(current, { text: 'Keep this note', author: 'MEM-002' }), { onDefinitiveRejected: rejected })).toBeNull();
    });
    expect(rejected).toHaveBeenCalledExactlyOnceWith({ retryable: true });
    expect(startup.saveCalls).toBe(before);
  });

  it('opens an allowlisted phone Work handoff without copying auth data into its return intent',async()=>{startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');startup.cached=await acceptedScenarioFixture();window.history.replaceState({},'', '/?open=shift');await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(container.querySelector('[data-testid=shift-room-stub]')).not.toBeNull(),4000);expect(new URL(window.location.href).searchParams.has('open')).toBe(false);expect(sessionStorage.getItem('hearth:open-shift:v1')).toBe('shift');sessionStorage.removeItem('hearth:open-shift:v1');window.history.replaceState({},'', '/');});

  for (const mode of ["accepted", "stale-render", "late-room"] as const) it(`Count receipt stays in its rendered room (${mode})`, async () => {
    startup.v2=true; vi.stubEnv("VITE_LEDGER_SYNC_V2","1"); vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH","1");
    let h=countReleaseHousehold("HH-COUNT-RELEASE","MEM-002");
    h={...h,linked:true};
    h.booksAcceptedHash=await financialAuditHash(h); startup.cached=h;
    localStorage.setItem("hearth:session:v1:development",JSON.stringify({memberId:"MEM-002",view:"household",householdId:h.householdId}));
    const input={date:"2026-09-08",memberId:"MEM-002",jobId:h.workJobs[0]!.id,roleId:h.workJobs[0]!.roles[0]!.id,workedHours:6,paidBreakHours:0,cashTips:12.34,cardTips:100,customersServed:40,staffingCount:2,confirmDuplicate:true,confirmationId:"count-release-frozen"};
    const actual=postWorkShiftWithAttendanceReview(h,input);
    let release!:()=>void,calls=0; const barrier=new Promise<void>(resolve=>release=resolve);
    startup.punchConfirm=async next=>{if(next.shifts.length<=h.shifts.length)return {...actual,household:next,postedIds:[]};calls++;if(mode==="late-room")await barrier;return {...actual,household:next};};
    await act(async()=>root.render(createElement(App)));
    await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);
    await act(async()=>startup.officePunch!.onGo("shift"));
    await waitForUi(()=>expect(startup.countProps).not.toBeNull(),3000);
    const old=startup.countProps!, accepted=vi.fn(), rejected=vi.fn();
    const switchRoom=async()=>act(async()=>container.querySelectorAll<HTMLButtonElement>(".view-switch button")[1]!.click());
    if(mode==="stale-render")await switchRoom();
    await act(async()=>{old.onConfirmShift(input,null,{scope:{environment:"development",householdId:h.householdId,memberId:"MEM-002"},onAccepted:accepted,onRejected:rejected});await Promise.resolve();});
    if(mode==="stale-render"){await settleUi(100);expect(calls).toBe(0);expect(accepted).not.toHaveBeenCalled();return;}
    await waitForUi(()=>expect(calls).toBe(1),3000);
    if(mode==="late-room"){await switchRoom();await act(async()=>{release();await Promise.resolve();});await settleUi(150);expect(accepted).not.toHaveBeenCalled();expect(container.querySelector(".toast")).toBeNull();}
    else await waitForUi(()=>expect(accepted).toHaveBeenCalledTimes(1),3000);
  });

  for(const mode of ['expired','room-roundtrip','queued-expiry','late-acceptance'] as const)it(`Receipt Undo lifetime (${mode})`,async()=>{
    startup.returnAcceptedResults=true;startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    const h=clockInShift(await acceptedScenarioFixture(),{memberId:'MEM-002'}).household;h.householdFund={...h.householdFund!,custodianMemberId:'MEM-002'};h.members=h.members.map(m=>m.id==='MEM-002'?{...m,fundCardAccountId:'ACC-VISA'}:m);h.booksAcceptedHash=await financialAuditHash(h);startup.cached=h;
    const actual=postEntry(h,{date:todayKey(),type:'expense',amount:'12.34',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-002',visibility:'household',funding:{fundId:h.householdFund!.id,fundedCents:1234,destinationAccountId:'ACC-VISA'}});
    let calls=0,release!:()=>void;const barrier=new Promise<void>(resolve=>release=resolve);
    startup.punchConfirm=async next=>{calls++;if(calls>1)await barrier;const postedIds=[...next.transactions.filter(t=>!h.transactions.some(old=>old.id===t.id)).map(t=>t.id),...(next.fundEvents??[]).filter(e=>!(h.fundEvents??[]).some(old=>old.id===e.id)).map(e=>e.id)];return {...actual,postedIds,undo:{...actual.undo,id:'accepted-'+calls,postedIds,commandKind:'postEntry',actorMemberId:'MEM-002'},household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);const office=startup.officePunch!;await act(async()=>office.onGo('till'));await act(async()=>button('I spent something').click());await act(async()=>startup.swipeProps!.onPostCategory({amount:'12.34',subcategoryId:'SUB-FOOD-GROCERIES'}));await waitForUi(()=>expect(startup.receiptUndo).not.toBeNull(),3000);const undo=startup.receiptUndo!,now=Date.now();
    if(mode==='room-roundtrip'){await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[0]!.click());await act(async()=>undo());expect(calls).toBe(1);}
    if(mode==='expired'){vi.spyOn(Date,'now').mockReturnValue(now+11000);await act(async()=>undo());expect(calls).toBe(1);}
    if(mode==='queued-expiry'){await act(async()=>{office.onStartBreak('unpaid');await Promise.resolve();});await waitForUi(()=>expect(calls).toBe(2),2000);await act(async()=>undo());vi.spyOn(Date,'now').mockReturnValue(now+11000);await act(async()=>{release();await Promise.resolve();});await settleUi(150);expect(calls).toBe(2);}
    if(mode==='late-acceptance'){expect(container.querySelector('.swipe-strip-reason')?.textContent).toBeUndefined();await act(async()=>{undo();await Promise.resolve();});await waitForUi(()=>expect(calls,container.textContent??'').toBe(2),2000);vi.spyOn(Date,'now').mockReturnValue(now+11000);await act(async()=>{release();await Promise.resolve();});await waitForUi(()=>expect(container.querySelector('.swipe-strip')).toBeNull(),2000);expect(container.querySelector('.toast')).toBeNull();}
  });

  for(const mode of ['room','category'] as const)it(`Swipe rechecks a waiting purchase before queue drain (${mode})`,async()=>{
    startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    const h=clockInShift(await acceptedScenarioFixture(),{memberId:'MEM-002'}).household;h.householdFund={...h.householdFund!,custodianMemberId:'MEM-002'};h.members=h.members.map(m=>m.id==='MEM-002'?{...m,fundCardAccountId:'ACC-VISA'}:m);h.booksAcceptedHash=await financialAuditHash(h);startup.cached=h;
    let release!:()=>void,calls=0;const barrier=new Promise<void>(resolve=>release=resolve),breakResult=startShiftBreak(h,{memberId:'MEM-002',kind:'unpaid'});
    startup.punchConfirm=async next=>{calls++;await barrier;return {...breakResult,household:mode==='category'?{...next,categories:next.categories.map(c=>c.id==='SUB-FOOD-GROCERIES'?{...c,name:'Changed remotely'}:c)}:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);const office=startup.officePunch!;await act(async()=>office.onGo('till'));await act(async()=>button('I spent something').click());const swipe=startup.swipeProps!;
    await act(async()=>{office.onStartBreak('unpaid');await Promise.resolve();});await waitForUi(()=>expect(calls).toBe(1),2000);await act(async()=>swipe.onPostCategory({amount:'12.34',subcategoryId:'SUB-FOOD-GROCERIES'}));
    if(mode==='room')await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());await act(async()=>{release();await Promise.resolve();});await settleUi(150);expect(calls).toBe(1);
    if(mode==='category')expect(startup.swipeProps!.error).toContain('card, category or Fund changed');else expect(container.querySelector('[data-testid="swipe-stub"]')).toBeNull();
  });
  for(const mode of ['accepted','stale-render','late-reopen','late-rejected'] as const)it(`Swipe binds explicit Post and completion to its current sheet (${mode})`,async()=>{
    const toastTimers:Array<()=>void>=[];if(mode==='accepted'){const timer=window.setTimeout.bind(window);vi.spyOn(window,'setTimeout').mockImplementation(((handler:TimerHandler,delay?:number,...args:unknown[])=>{if(delay===8000&&typeof handler==='function'){toastTimers.push(()=>handler(...args));return 0;}return timer(handler,delay,...args);}) as typeof window.setTimeout);}
    startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    const h=await acceptedScenarioFixture();h.householdFund={...h.householdFund!,custodianMemberId:'MEM-002'};h.members=h.members.map(m=>m.id==='MEM-002'?{...m,fundCardAccountId:'ACC-VISA'}:m);h.booksAcceptedHash=await financialAuditHash(h);startup.cached=h;
    let release!:()=>void,candidate:Household|null=null;const barrier=new Promise<void>(resolve=>release=resolve);const actual=postEntry(h,{date:todayKey(),type:'expense',amount:'12.34',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-002',visibility:'household',funding:{fundId:h.householdFund!.id,fundedCents:1234,destinationAccountId:'ACC-VISA'}});
    startup.punchConfirm=async next=>{candidate=next;if(mode==='late-reopen'||mode==='late-rejected')await barrier;if(mode==='late-rejected')throw Error('Old purchase rejected');return {...actual,household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);await act(async()=>startup.officePunch!.onGo('till'));await act(async()=>button('I spent something').click());await waitForUi(()=>expect(startup.swipeProps).not.toBeNull(),2000);const old=startup.swipeProps!;
    if(mode==='stale-render')await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());
    await act(async()=>{old.onPostCategory({amount:'12.34',subcategoryId:'SUB-FOOD-GROCERIES'});await Promise.resolve();});
    if(mode==='stale-render'){await settleUi(100);expect(candidate).toBeNull();return;}
    await waitForUi(()=>expect(candidate).not.toBeNull(),4000);const added=candidate!.transactions.filter(tx=>!h.transactions.some(old=>old.id===tx.id));expect(added.some(tx=>tx.type==='expense'&&tx.amountCents===1234&&tx.subcategoryId==='SUB-FOOD-GROCERIES'&&tx.createdBy==='MEM-002')).toBe(true);
    if(mode==='late-reopen'||mode==='late-rejected'){await act(async()=>old.onClose());await act(async()=>startup.tillOpen!());await act(async()=>{release();await Promise.resolve();});await settleUi(150);expect(container.querySelector('[data-testid="swipe-stub"]')).not.toBeNull();expect(startup.swipeProps!.error).toBe('');expect(container.textContent).not.toContain('Old purchase rejected');}
    else {await waitForUi(()=>expect(container.querySelector('[data-testid="swipe-stub"]')).toBeNull(),3000);expect(container.querySelector('.toast')).not.toBeNull();expect(toastTimers.length).toBeGreaterThan(0);await act(async()=>toastTimers.forEach(clear=>clear()));expect(container.querySelector('.toast')).toBeNull();}
  });


  for(const mode of ['accepted','source','room'] as const)it(`Claim Confirm binds the displayed remainder and receiving account (${mode})`,async()=>{
    startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    const h=postVisit(await acceptedScenarioFixture(),{date:todayKey(),amount:248,note:'Claim proof',accountId:'ACC-VISA',subcategoryId:'SUB-HEALTH-DENTAL',expectedRecovery:180,confirmDuplicate:true,createdBy:'MEM-002'}).household;h.booksAcceptedHash=await financialAuditHash(h);startup.cached=h;const claim=h.claims.at(-1)!,actual=settleClaim(h,{claimId:claim.id,amount:180,toAccountId:'ACC-CHEQUING',date:todayKey(),createdBy:'MEM-002',confirmDuplicate:true});let calls=0,candidate:Household|null=null;startup.punchConfirm=async next=>{calls++;candidate=next;return {...actual,household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.claimReview).not.toBeNull(),4000);await act(async()=>startup.claimReview!(claim.id,'Old untrusted summary'));expect(container.textContent).not.toContain('Old untrusted summary');expect(button('Record the transfer').disabled).toBe(true);await act(async()=>{const select=container.querySelector<HTMLSelectElement>('[aria-label="Receiving account"]')!;select.value='ACC-CHEQUING';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(container.textContent).toContain('$180.00');expect(button('Record the transfer').disabled).toBe(false);
    if(mode==='source'){const partial=settleClaim(h,{claimId:claim.id,amount:25,toAccountId:'ACC-CHEQUING',date:todayKey(),createdBy:'MEM-002',confirmDuplicate:true}).household;await act(async()=>startup.v2Clients.at(-1)!.adopt(partial));}
    if(mode==='room'){await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[0]!.click());}
    if(mode==='accepted'){await act(async()=>button('Record the transfer').click());await waitForUi(()=>expect(calls).toBe(1),3000);expect(candidate!.claims.find(c=>c.id===claim.id)!.receivedCents).toBe(18000);expect(candidate!.transactions.filter(t=>!h.transactions.some(old=>old.id===t.id)).every(t=>t.type==='transfer'&&t.amountCents===18000)).toBe(true);await waitForUi(()=>expect(container.querySelector('[aria-labelledby="guard-title"]')).toBeNull(),3000);}
    else{expect(button('Record the transfer').disabled).toBe(true);expect(calls).toBe(0);await act(async()=>button('Cancel').click());}
  });

  for(const mode of ['accepted','source','room'] as const)it(`Due inline Confirm preserves its occurrence and scope (${mode})`,async()=>{
    startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    const h=addRecurrence(await acceptedScenarioFixture(),{cadence:'monthly',nextDate:todayKey(),type:'expense',amount:'75.25',accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES',note:'Due proof'}).household;h.booksAcceptedHash=await financialAuditHash(h);startup.cached=h;
    const id=h.recurrences.at(-1)!.id,actual=postOneRecurrence(h,id,todayKey(),{createdBy:'MEM-002'});let calls=0,candidate:Household|null=null;startup.punchConfirm=async next=>{calls++;candidate=next;return {...actual,household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.dueProps).not.toBeNull(),4000);const old=startup.dueProps!,review=dueOccurrenceReview(h,{environment:h.environment,householdId:h.householdId,memberId:'MEM-002',view:'household',recurrenceId:id,occurrenceDate:todayKey(),today:todayKey()});if(review.kind!=='ready')throw Error(review.reason);
    expect(container.querySelector('.due-preview-inline')).not.toBeNull();const arrival=container.querySelector<HTMLAnchorElement>('.due-arrival')!;expect(arrival.getAttribute('href')).toBe('#due-reminders');expect(arrival.compareDocumentPosition(container.querySelector('.due-preview-inline')!)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(container.querySelector('.due-preview-inline [role=dialog]')).toBeNull();
    if(mode==='source')await act(async()=>startup.v2Clients.at(-1)!.adopt({...h,recurrences:h.recurrences.map(r=>r.id===id?{...r,amountCents:9900}:r)}));
    if(mode==='room'){await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[0]!.click());}
    if(mode==='accepted'){await act(async()=>button('Actions for Due proof').click());await act(async()=>button('Confirm payment · Due proof').click());await waitForUi(()=>expect(calls).toBe(1),3000);expect(candidate!.transactions.some(t=>t.sourceId===id&&t.amountCents===7525&&t.date===todayKey())).toBe(true);await waitForUi(()=>expect(container.textContent).toContain('1 occurrence posted'),3000);}
    else{await act(async()=>{expect(await old.onPost(review)).toBe(false);});expect(calls).toBe(0);}
  });

  for(const mode of ['source','room','opening-source'] as const)it(`Destructive phone review requires a fresh opening after current ${mode} changes`,async()=>{
    const width=window.innerWidth;Object.defineProperty(window,'innerWidth',{value:390,writable:true,configurable:true});try{
      startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
      const result=postEntry(await acceptedScenarioFixture(),{date:'2026-09-08',type:'expense',amount:'47.23',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-002',confirmDuplicate:true});startup.cached=result.household;startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);const h=startup.cached;let writes=0;startup.punchConfirm=async next=>{writes++;return {...result,household:next};};
      await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);await act(async()=>startup.officePunch!.onGo('ledger'));const ordinary=[...container.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Open ordinary Books');if(ordinary)await act(async()=>ordinary.click());await waitForUi(()=>expect(startup.removeReview).not.toBeNull(),2000);
      const tx=h.transactions.find(row=>row.id===result.postedIds[0])!;if(mode==='opening-source'){await act(async()=>startup.v2Clients.at(-1)!.adopt({...h,revision:h.revision+1,transactions:h.transactions.map(row=>row.id===tx.id?{...row,note:'Changed before opening'}:row)}));await act(async()=>startup.removeReview!(tx));expect(container.textContent).toContain('This review changed');expect(writes).toBe(0);return;}await act(async()=>startup.removeReview!(tx));expect(container.querySelector('.phone-danger')).not.toBeNull();await act(async()=>button('Show Reverse').click());expect(button('Reverse').disabled).toBe(false);
      if(mode==='source'){const changed={...h,revision:h.revision+1,transactions:h.transactions.map(row=>row.id===tx.id?{...row,note:'New accepted detail'}:row)};await act(async()=>startup.v2Clients.at(-1)!.adopt(changed));}
      else{await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[1]!.click());await act(async()=>container.querySelectorAll<HTMLButtonElement>('.view-switch button')[0]!.click());}
      expect(container.textContent).toContain('This review changed. Cancel and open it again.');expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Reverse'&&!b.disabled)).toBe(false);expect(writes).toBe(0);
      await act(async()=>button('Cancel').click());await act(async()=>startup.removeReview!(mode==='source'?{...tx,note:'New accepted detail'}:tx));expect(button('Show Reverse')).toBeDefined();expect(writes).toBe(0);
    }finally{Object.defineProperty(window,'innerWidth',{value:width,writable:true,configurable:true});}
  });

  for(const mode of ["accepted","room-changed"] as const)it(`Prise uses the scoped App writer (${mode})`,async()=>{
    startup.v2=true;vi.stubEnv("VITE_LEDGER_SYNC_V2","1");vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH","1");
    startup.cached=postEntry(await acceptedScenarioFixture(),{date:"2026-09-08",type:"expense",amount:"47.23",accountId:"ACC-VISA",subcategoryId:"SUB-FOOD-GROCERIES",note:"Prise test",createdBy:"MEM-002",confirmDuplicate:true}).household;
    startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);
    const h=startup.cached,review=prepareDuplicateReview(h,{environment:h.environment,householdId:h.householdId,memberId:"MEM-002",view:"household",targetId:h.transactions.at(-1)!.id,isDuplicate:true,comparisonIds:[]});if(review.kind!=="ready")throw Error(review.reason);
    const result=applyDuplicateReview(h,review);let candidate:Household|null=null;startup.punchConfirm=async next=>{candidate=next;return {...result,household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);await act(async()=>startup.officePunch!.onGo("ledger"));
    const openBooks=[...container.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent==="Open ordinary Books");if(openBooks)await act(async()=>openBooks.click());
    await waitForUi(()=>expect(startup.duplicateWriter).not.toBeNull(),3000);
    const writer=startup.duplicateWriter!;
    if(mode==="room-changed")await act(async()=>container.querySelectorAll<HTMLButtonElement>(".view-switch button")[1]!.click());
    let outcome:Awaited<ReturnType<typeof writer>>=null;await act(async()=>{outcome=await writer(current=>applyDuplicateReview(current,review));});
    if(mode==="accepted"){expect(candidate).not.toBeNull();expect(candidate!.transactions.find(tx=>tx.id===review.target.id)!.isDuplicate).toBe(true);expect(outcome).toMatchObject({ok:true});}
    else{expect(candidate).toBeNull();expect(outcome).toBeNull();}
  });

  it("Punch preserves Never mind for a confirming timeline opened through Add Shift", async () => {
    startup.v2=true;vi.stubEnv("VITE_LEDGER_SYNC_V2","1");vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH","1");
    startup.cached=clockOutShift(clockInShift(await acceptedScenarioFixture(),{memberId:"MEM-002"}).household,{memberId:"MEM-002"}).household;
    startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);
    const before=startup.cached,discarded=abandonOpenShift(before,{memberId:"MEM-002"});let candidate:Household|null=null;
    startup.punchConfirm=async next=>{candidate=next;return {...discarded,household:next};};
    await act(async()=>root.render(createElement(App)));await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);
    act(()=>button("Add money").click());act(()=>button("Add shift").click());act(()=>button("Never mind").click());
    await waitForUi(()=>expect(candidate).not.toBeNull(),1500);
    expect(candidate!.kitchen.openShifts.find(row=>row.memberId==="MEM-002")!.status).toBe("cleared");
    expect(candidate!.transactions).toEqual(before.transactions);expect(container.querySelector(".add-slideshow")).toBeNull();
  });

  for (const result of ["accepted", "rejected", "navigated"] as const) it(`Punch opens pay review only after an accepted clock-out in the same intent (${result})`, async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    startup.cached=clockInShift(await acceptedScenarioFixture(),{memberId:"MEM-002"}).household;
    startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);
    const before=startup.cached,original=clockOutShift(before,{memberId:"MEM-002"});
    let release!:()=>void,candidate:Household|null=null;
    const barrier=new Promise<void>(resolve=>release=resolve);
    startup.punchConfirm=async next=>{candidate=next;await barrier;if(result==="rejected")throw Error("Clock-out was not accepted");return {...original,household:next};};
    await act(async()=>root.render(createElement(App)));
    await waitForUi(()=>expect(startup.officePunch).not.toBeNull(),4000);
    let pending!:Promise<void>;await act(async()=>{pending=startup.officePunch!.onSignOut();await Promise.resolve();});
    await waitForUi(()=>expect(candidate).not.toBeNull(),4000);expect(container.querySelector(".add-slideshow")).toBeNull();
    if(result==="navigated")await act(async()=>startup.officePunch!.onGo("ledger"));
    await act(async()=>{release();await pending;});
    if(result==="accepted")expect(container.querySelector(".add-slideshow")).not.toBeNull();
    else expect(container.querySelector(".add-slideshow")).toBeNull();
    expect(candidate!.transactions).toEqual(before.transactions);expect(candidate!.shifts).toEqual(before.shifts);
    expect(candidate!.kitchen.openShifts.find(row=>row.memberId==="MEM-002")!.status).toBe("confirming");
  });

  it("issues an accepted cached V2 pair for the scenario without legacy SQL", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    startup.cached = await acceptedScenarioFixture();
    const engine = await import("../src/ledger/engine.ts");
    vi.spyOn(engine, "ingestHouseholdBooks").mockClear().mockImplementation(() => new Promise(() => {}));
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"), 4000);
    const source = startup.scenarioSource!;
    expect(source.household).toBe(startup.cached);
    expect(source.accepted.scope).toMatchObject({memberId: "MEM-002", viewerRoom: "household", targetRoom: "household"});
    expect(source.isCurrent()).toBe(true);
    expect(source.accepted.acceptedStateId.length).toBeLessThanOrEqual(512);
    expect(engine.ingestHouseholdBooks).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='cached-office-shell']")).not.toBeNull();
  });

  it("keeps proven Personal completeness across a room change but invalidates prior choices", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    startup.cached = await acceptedScenarioFixture();
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"), 4000);
    const shared = startup.scenarioSource!;
    const personal = container.querySelectorAll<HTMLButtonElement>(".view-switch button")[1]!;
    act(() => personal.click());
    await waitForUi(() => expect(startup.scenarioSource?.accepted.scope.viewerRoom).toBe("personal"));
    expect(shared.isCurrent()).toBe(false);
    expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready");
    expect(startup.scenarioSource?.accepted.scope.authorityGeneration).not.toBe(shared.accepted.scope.authorityGeneration);
    expect(startup.v2Clients).toHaveLength(1);
  });

  it("leaves uncertain legacy Personal unavailable while keeping the accepted shell readable", async () => {
    startup.cached = await acceptedScenarioFixture();
    storeAuthSession({email: "jonathan@example.com", subject: "google-sub-jonathan"});
    await act(async () => root.render(createElement(App)));
    await startValidation();
    await waitForUi(() => expect(container.querySelector("[data-books-readiness='ready']")).not.toBeNull());
    expect(startup.scenarioSource?.accepted.ownBooks).toBe("unavailable");
    expect(container.querySelector("[data-testid='cached-office-shell']")).not.toBeNull();
    expect(startup.scenarioSource?.isCurrent()).toBe(true);
  });

  it("invalidates auth A immediately and refuses its delayed adoption after B accepts", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "0");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    storeAuthSession({email: "jonathan@example.com", subject: "google-sub-jonathan"});
    startup.cached = await acceptedScenarioFixture();
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"), 4000);
    const sourceA = startup.scenarioSource!, clientA = startup.v2Clients[0]!;
    startup.v2AutoAdopt = false;
    const lateA = {...startup.cached, revision: startup.cached.revision + 1};
    let release!: () => void;
    startup.saveBarrier = {household: lateA, promise: new Promise<void>(resolve => { release = resolve; })};
    let pendingA!: Promise<void>;
    act(() => { pendingA = Promise.resolve(clientA.adopt(lateA)); });
    await waitForUi(() => expect(startup.savedHouseholds.includes(lateA)).toBe(true));
    const stored = JSON.parse(localStorage.getItem("hearth:v1:supabase-auth:development")!);
    act(() => {
      localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({...stored, userId: "auth-user-b", sessionId: "22222222-2222-4222-8222-222222222222", googleSubject: "google-sub-b"}));
      window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed", {detail: {environment: "development"}}));
      expect(sourceA.isCurrent()).toBe(false);
    });
    await waitForUi(() => expect(startup.v2Clients).toHaveLength(2));
    expect(startup.scenarioSource?.accepted.ownBooks).not.toBe("ready");
    const currentB = {...startup.cached, revision: startup.cached.revision + 2};
    await act(async () => { await startup.v2Clients[1]!.adopt(currentB); });
    await waitForUi(() => expect(startup.scenarioSource?.accepted.scope.subject).toBe("auth-user-b"));
    expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready");
    await act(async () => { release(); await pendingA; });
    expect(startup.scenarioSource?.household).toBe(currentB);
    expect(startup.scenarioSource?.accepted.scope.subject).toBe("auth-user-b");
    const saves = startup.saveCalls;
    await act(async () => { await clientA.adopt({...lateA}); });
    expect(startup.saveCalls).toBe(saves);
  });

  it("keeps the accepted scenario scope during a token-only refresh", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "0");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    storeAuthSession({email: "jonathan@example.com", subject: "google-sub-jonathan"});
    startup.cached = await acceptedScenarioFixture();
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"), 4000);
    const source = startup.scenarioSource!, stored = JSON.parse(localStorage.getItem("hearth:v1:supabase-auth:development")!);
    act(() => {
      localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({...stored, accessToken: "rotated-test-token", refreshToken: "rotated-test-refresh", expiresAt: stored.expiresAt + 1000}));
      window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed", {detail: {environment: "development"}}));
    });
    expect(source.isCurrent()).toBe(true);
    expect(startup.v2Clients).toHaveLength(1);
    expect(JSON.stringify(source.accepted)).not.toContain("rotated-test-token");
  });

  it("still adopts accepted V2 updates after a failed household switch", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "1");
    startup.cached = await acceptedScenarioFixture();
    startup.replicas = [startup.cached.householdId, "missing-household"].map((id, index) => ({householdId: id, name: index ? "Unavailable house" : "Current house", environment: "development", revision: 1, memberIds: ["MEM-002"], updatedAt: null}));
    const storage = await import("../src/storage.ts");
    vi.spyOn(storage, "selectHouseholdReplica").mockRejectedValue(new Error("Fixture could not open that household"));
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"));
    act(() => button("Open Unavailable house").click());
    await waitForUi(() => expect(container.textContent).toContain("Fixture could not open that household"));
    const next = {...startup.cached, revision: startup.cached.revision + 1};
    await act(async () => { await startup.v2Clients[0]!.adopt(next); });
    expect(startup.scenarioSource?.household).toBe(next);
    expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready");
  });

  it.each([false, true])("binds a delayed legacy complete pair to its initiating auth (change=%s)", async changed => {
    vi.stubEnv("VITE_CLOUD_LEDGER_ONLINE_REQUIRED", "1");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    const identity = {email: "jonathan@example.com", subject: "google-sub-jonathan"};
    const base = await acceptedScenarioFixture();
    const linked = linkGoogleIdentity(base, {memberId: "MEM-002", ...identity, displayName: "Jonathan", grantedScopes: ["openid", "email"]}).household;
    startup.cached = markSynchronized({...linked, linked: true});
    startup.cached.booksAcceptedHash = await financialAuditHash(startup.cached);
    storeAuthSession(identity);
    const remote = markSynchronized({...startup.cached, revision: startup.cached.revision + 1, baseRevision: startup.cached.revision + 1});
    const emptyPersonal = splitForSync(catalogHousehold(), "MEM-002").personal;
    expect(emptyPersonal.transactions).toEqual([]);
    let release!: (value: PersonalEnvelope | null) => void;
    startup.cloudRemote = Promise.resolve(remote);
    startup.cloudPersonal = new Promise(resolve => { release = resolve; });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ok: true}), {status: 200}));
    await act(async () => root.render(createElement(App)));
    await startValidation();
    await waitForUi(() => expect(startup.consistentPullCalls).toBeGreaterThan(0));
    if (changed) {
      const auth = JSON.parse(localStorage.getItem("hearth:v1:supabase-auth:development")!);
      act(() => {
        localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({...auth, userId: "auth-user-b", sessionId: "22222222-2222-4222-8222-222222222222", googleSubject: "google-sub-b"}));
        window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed", {detail: {environment: "development"}}));
      });
    }
    await act(async () => { release(emptyPersonal); });
    if (changed) {
      await settleUi(200);
      expect(startup.savedHouseholds.some(row => row.revision === remote.revision)).toBe(false);
      expect(startup.scenarioSource?.accepted.ownBooks).not.toBe("ready");
    } else {
      await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"));
      expect(startup.scenarioSource?.accepted.acceptedRevision).toBe(remote.revision);
      expect(splitForSync(startup.scenarioSource!.household, "MEM-002").personal.transactions).toEqual([]);
    }
  });

  it("does not revive the original V2 client after A to B to A in one render", async () => {
    startup.v2 = true;
    vi.stubEnv("VITE_LEDGER_SYNC_V2", "1");
    vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH", "0");
    vi.stubEnv("VITE_SUPABASE_AUTH_ENABLED", "1");
    storeAuthSession({email: "jonathan@example.com", subject: "google-sub-jonathan"});
    startup.cached = await acceptedScenarioFixture();
    await act(async () => root.render(createElement(App)));
    await waitForUi(() => expect(startup.scenarioSource?.accepted.ownBooks).toBe("ready"));
    const originalClient = startup.v2Clients[0]!, originalSource = startup.scenarioSource!;
    startup.v2AutoAdopt = false;
    const originalAuth = localStorage.getItem("hearth:v1:supabase-auth:development")!;
    const parsed = JSON.parse(originalAuth);
    act(() => {
      localStorage.setItem("hearth:v1:supabase-auth:development", JSON.stringify({...parsed, userId: "auth-user-b", sessionId: "22222222-2222-4222-8222-222222222222", googleSubject: "google-sub-b"}));
      window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed", {detail: {environment: "development"}}));
      localStorage.setItem("hearth:v1:supabase-auth:development", originalAuth);
      window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed", {detail: {environment: "development"}}));
      expect(originalSource.isCurrent()).toBe(false);
    });
    await waitForUi(() => expect(startup.v2Clients).toHaveLength(2));
    const saves = startup.saveCalls;
    await act(async () => { await originalClient.adopt({...startup.cached, revision: startup.cached!.revision + 1} as Household); });
    expect(startup.saveCalls).toBe(saves);
    expect(startup.scenarioSource?.accepted.ownBooks).not.toBe("ready");
  });


  it('manually opens real Hercules under mounted App Development v2 and pauses it', async () => {
    startup.v2=true; vi.stubEnv('VITE_LEDGER_SYNC_V2','1'); vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    startup.cached={...catalogHousehold('development'),linked:true};
    startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);
    let calls=0;
    startup.punchConfirm=async next=>{calls++;return {...offerHouseholdOnboarding(startup.cached!,{memberId:'MEM-002'}),household:next};};
    await act(async()=>root.render(createElement(App)));
    await waitForUi(()=>expect(container.querySelector('[data-books-readiness="ready"]')).not.toBeNull());
    expect(calls).toBe(0);
    expect(document.querySelector<HTMLElement>('.hercules-setup-backdrop')!.hidden).toBe(true);
    const opener=container.querySelector<HTMLButtonElement>('button.hercules-live')!;
    expect(opener).not.toBeNull();
    await act(async()=>opener.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
    await waitForUi(()=>expect(document.querySelector<HTMLElement>('.hercules-setup-backdrop')!.hidden).toBe(false));
    await waitForUi(()=>expect(calls).toBeGreaterThan(0));
    expect(document.querySelector('.hercules-setup')!.textContent).toContain('Starting books');
    const close=[...document.querySelectorAll<HTMLButtonElement>('.hercules-setup button')].find(b=>b.textContent==='Close')!;
    await act(async()=>close.click());
    expect(document.querySelector<HTMLElement>('.hercules-setup-backdrop')!.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });


  async function auditMount(label:string, prepare?:(household:Household)=>Household) {
    startup.v2=true;vi.stubEnv('VITE_LEDGER_SYNC_V2','1');vi.stubEnv('VITE_LEDGER_SYNC_LOCAL_AUTH','1');
    startup.auditIds=[];startup.auditReceipt='missing';startup.auditStatus=null;
    startup.cached=await acceptedScenarioFixture();
    startup.cached.householdId='ENTRY-RECOVERY-'+label+'-'+crypto.randomUUID();startup.cached.workJobs=[];
    if(prepare)startup.cached=prepare(startup.cached);
    startup.cached.booksAcceptedHash=await financialAuditHash(startup.cached);
    localStorage.setItem('hearth:session:v1:development',JSON.stringify({memberId:'MEM-002',view:'household',householdId:startup.cached.householdId}));
    await act(async()=>root.render(createElement(App)));
    await waitForUi(()=>expect(container.querySelector('[data-books-readiness="ready"]')).not.toBeNull());
  }
  function auditOpen(kind:string) {
    openExpenseSlideshow();
    if(kind!=='expense')act(()=>{const b=[...container.querySelectorAll<HTMLButtonElement>('.add-slideshow-switch button')].find(b=>b.textContent===kind)!;expect(b).toBeTruthy();b.click();});
  }
  async function auditReload(){
    await act(async()=>root.unmount());root=createRoot(container);
    await act(async()=>root.render(createElement(App)));
    await waitForUi(()=>expect(container.querySelector('[data-books-readiness="ready"]')).not.toBeNull());
  }
  it.each(['expense','income','transfer','shift'])('desktop %s retains edited draft across Close and reload',async kind=>{
    await auditMount(kind);auditOpen(kind);
    if(kind==='shift')act(()=>button('Already off? Post a finished shift').click());
    const sheet=()=>container.querySelector<HTMLElement>('[data-add-slideshow]')!;
    act(()=>[...sheet().querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='More')!.click());
    const field=()=>sheet().querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    expect(field()).not.toBeNull();
    act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field(),'23.45');field().dispatchEvent(new Event('input',{bubbles:true}));});
    expect(field().value).toBe('23.45');
    act(()=>[...sheet().querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Close')!.click());
    expect(sheet().hidden).toBe(true);
    auditOpen(kind);expect(sheet().hidden).toBe(false);expect(field().value).toBe('23.45');
    await auditReload();auditOpen(kind);
    expect(sheet().getAttribute('data-add-slideshow')).toBe(kind);expect(sheet().getAttribute('data-add-slide')).toBe('full-form');
    expect(field().value).toBe('23.45');expect(startup.auditIds).toHaveLength(0);
  });
  it.each(['accepted','missing'] as const)('uncertain entry %s receipt survives reload without changed confirmation identity',async receipt=>{
    await auditMount(receipt);
    let calls=0;
    startup.punchConfirm=async next=>{calls++;if(calls===1)throw new Error('Response lost');return {household:next,postedIds:[],warnings:[],undo:undefined} as unknown as import('../src/core/types.ts').CommitResult;};
    openExpenseSlideshow();const confirm=walkExpenseToConfirm(container);
    await act(async()=>confirm.click());
    await waitForUi(()=>expect(startup.auditIds).toHaveLength(1));
    await waitForUi(()=>expect(container.querySelector('[aria-label="Entry receipt"]')).not.toBeNull());
    const id=startup.auditIds[0];
    await auditReload();openExpenseSlideshow();
    expect(container.querySelector('[aria-label="Entry receipt"]')).not.toBeNull();
    expect(container.querySelector<HTMLFieldSetElement>('.entry-sheet-fields')!.disabled).toBe(true);
    startup.auditReceipt=receipt;
    await act(async()=>button('Check entry status').click());
    await waitForUi(()=>expect(container.querySelector('[data-add-slideshow]')).toBeNull());
    expect(startup.auditIds).toEqual(receipt==='accepted'?[id]:[id,id]);
  });


  it('late old expense receipt must leave a newly opened shift draft intact',async()=>{
    await auditMount('receipt-race');
    startup.punchConfirm=async()=>{throw new Error('Response lost');};
    openExpenseSlideshow();const reviewed=walkExpenseToConfirm(container);await act(async()=>reviewed.click());
    await waitForUi(()=>expect(container.querySelector('[aria-label="Entry receipt"]')).not.toBeNull());
    let resolve!:(value:'accepted')=>void;startup.auditStatus=new Promise(r=>{resolve=r;});
    await act(async()=>button('Check entry status').click());
    act(()=>[...container.querySelectorAll<HTMLButtonElement>('[data-add-slideshow] button')].find(b=>b.textContent==='Close')!.click());
    act(()=>button('Add money').click());act(()=>button('Add shift').click());
    expect(container.querySelector('[data-add-slideshow="shift"]')).not.toBeNull();
    await act(async()=>{resolve('accepted');await Promise.resolve();});
    expect(container.querySelector('[data-add-slideshow="shift"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('[data-add-slideshow="shift"]')!.hidden).toBe(false);
  });


  it('duplicate Back to edit releases unsent review and accepts corrected entry',async()=>{
    Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:()=>{}});
    const {jointSplit}=await import('../src/core/index.ts');
    await auditMount('duplicate-edit',h=>postEntry(h,{date:todayKey(),type:'expense',amount:'0.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'',place:'',splits:jointSplit(1),createdBy:'MEM-002',visibility:'household'}).household);
    startup.punchConfirm=async next=>({household:next,postedIds:[],warnings:[],undo:undefined} as unknown as import('../src/core/types.ts').CommitResult);
    openExpenseSlideshow();const reviewed=walkExpenseToConfirm(container);await act(async()=>reviewed.click());
    await waitForUi(()=>expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Back to edit')).toBe(true));
    expect(startup.auditIds).toHaveLength(0);
    const key=Object.keys(sessionStorage).find(k=>k.includes('hearth:add:v1')&&k.endsWith(':confirmation'))!;
    const first=JSON.parse(sessionStorage.getItem(key)!).id;
    act(()=>button('Back to edit').click());expect(sessionStorage.getItem(key)).toBeNull();
    const amount=container.querySelector<HTMLInputElement>('[data-entry-section="amount"] input')!;
    act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(amount,'0.02');amount.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>container.querySelector<HTMLButtonElement>('[data-add-confirm]')!.click());
    await waitForUi(()=>expect(startup.auditIds).toHaveLength(1));
    expect(startup.auditIds[0]).not.toBe(first);
  });
  it('missing receipt after roster order changes requires review before resubmission',async()=>{
    await auditMount('basis-drift');startup.punchConfirm=async()=>{throw new Error('Response lost');};
    openExpenseSlideshow();const reviewed=walkExpenseToConfirm(container);await act(async()=>reviewed.click());
    await waitForUi(()=>expect(container.querySelector('[aria-label="Entry receipt"]')).not.toBeNull());
    const id=startup.auditIds[0];
    await act(async()=>startup.v2Clients[0]!.adopt({...startup.cached!,members:[...startup.cached!.members].reverse()}));
    await act(async()=>button('Check entry status').click());
    expect(startup.auditIds).toEqual([id]);
    expect(container.textContent).toContain('books changed while this entry was paused');
    expect(container.querySelector('[aria-label="Entry receipt"]')).toBeNull();
    expect(container.querySelector<HTMLFieldSetElement>('.entry-sheet-fields')!.disabled).toBe(false);
  });


});
