import { shapeWorkJob, upsertWorkJob, postWorkShiftWithAttendanceReview } from "../src/core/index.ts";
// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, financialAuditHash, type Household, type PersonalEnvelope } from "../src/core/index.ts";
import { createMemoryContinuityStore, setContinuityStore } from "../src/continuity.ts";

vi.setConfig({ testTimeout: 60_000 });
afterAll(() => vi.resetConfig());

type Inspection = {
  ok: boolean;
  issue?: "missing-schema" | "incomplete-migration" | "interrupted-transaction" | "invalid-stored-data" | "projection-mismatch";
  message: string;
  entryCount: number;
};

const startup = vi.hoisted(() => ({
  v2: false,
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
  duplicateWriter:null as unknown|null,
  countProps: null as null | Parameters<typeof import("../src/WorkShiftPage.tsx").WorkShiftPage>[0],
  punchConfirm: null as null | ((candidate: Household) => Promise<import("../src/core/types.ts").CommitResult>),
  officePunch: null as null | {onSignOut:()=>Promise<void>;onStartBreak:(kind:"paid"|"unpaid")=>void;onGo:(tab:"home"|"ledger"|"till"|"shift")=>void},
  scenarioSource: null as unknown | null,
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
  return { LedgerSyncClient: class {
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
      if (!startup.punchConfirm) throw new Error("Unexpected test confirmation");
      const result=await startup.punchConfirm(candidate);
      startup.acceptedResults.set(_id,result);
      await this.options.adopt(result.household);
      return result;
    }
    result(_id:string): import("../src/core/types.ts").CommitResult | undefined { return startup.returnAcceptedResults?startup.acceptedResults.get(_id):undefined; }
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
  DeferredOffice: ({scenarioSource,onAskSettle,...punch}: {onAskSettle:(id:string,summary:string)=>void;scenarioSource?: unknown | null;onSignOut:()=>Promise<void>;onStartBreak:(kind:"paid"|"unpaid")=>void;onGo:(tab:"home"|"ledger"|"till"|"shift")=>void}) => {
    startup.officePunch=punch;startup.claimReview=onAskSettle;
    startup.scenarioSource = scenarioSource ?? null;
    return createElement("div", { "data-testid": "cached-office-shell" }, "Cached office shell");
  },
  DeferredBooksPage: (props:{onDuplicateCommand:unknown;onRemove:(transaction:import("../src/core/types.ts").Transaction)=>void}) => {startup.removeReview=props.onRemove;startup.duplicateWriter=props.onDuplicateCommand;return null;},
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

  for (const mode of ["accepted", "stale-render", "late-room", "late-auth"] as const) it(`Count receipt stays in its rendered room (${mode})`, async () => {
    startup.v2=true; vi.stubEnv("VITE_LEDGER_SYNC_V2","1"); vi.stubEnv("VITE_LEDGER_SYNC_LOCAL_AUTH","1");
    let h=countReleaseHousehold("HH-COUNT-RELEASE","MEM-002");
    h={...h,linked:true};
    h.booksAcceptedHash=await financialAuditHash(h); startup.cached=h;
    localStorage.setItem("hearth:session:v1:development",JSON.stringify({memberId:"MEM-002",view:"household",householdId:h.householdId}));
    const input={date:"2026-09-08",memberId:"MEM-002",jobId:h.workJobs[0]!.id,roleId:h.workJobs[0]!.roles[0]!.id,workedHours:6,paidBreakHours:0,cashTips:12.34,cardTips:100,customersServed:40,staffingCount:2,confirmDuplicate:true,confirmationId:"count-release-frozen"};
    const actual=postWorkShiftWithAttendanceReview(h,input);
    let release!:()=>void,calls=0; const barrier=new Promise<void>(resolve=>release=resolve);
    startup.punchConfirm=async next=>{if(next.shifts.length<=h.shifts.length)return {...actual,household:next,postedIds:[]};calls++;if(mode==="late-room"||mode==="late-auth")await barrier;return {...actual,household:next};};
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
    if(mode==="late-room"||mode==="late-auth"){
      if(mode==="late-room")await switchRoom();
      else await act(async()=>{localStorage.setItem("hearth:v1:supabase-auth:development",JSON.stringify({accessToken:"test-access",refreshToken:"test-refresh",userId:"new-auth-user",sessionId:"new-session",googleSubject:"new-subject",email:"fixture@example.com",displayName:"Fixture",expiresAt:Date.now()+3600000}));window.dispatchEvent(new CustomEvent("hearth:supabase-session-changed",{detail:{environment:"development"}}));});await act(async()=>{release();await Promise.resolve();});await settleUi(150);expect(accepted).not.toHaveBeenCalled();expect(container.querySelector(".toast")).toBeNull();}
    else await waitForUi(()=>expect(accepted).toHaveBeenCalledTimes(1),3000);
  });


});
