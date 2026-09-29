/**
 * A hand-written `JourneyBoard` (T4 UI fixture). Fictional Development data only.
 *
 * Every stop kind × status, two same-day clusters, the three crossroads kinds, an undated memory, and an EMPTY
 * variant. The stops, crossroads and summary are written out literally; only the per-chapter `days` grid and the
 * unresolved counts are filled in by `chapter()` from those literals (so the grid can never disagree with them).
 */
import type {
  ActionCall, Chapter, ChapterId, CommitmentStop, Crossroads, DateKey, IncomeStop, JourneyBoard, MemoryStop, MilestoneStop, PlanStop,
  ReviewStop, StationId, Stop, StopAction, StopCluster,
} from "../../src/journey/contracts.ts";
import { STATION_IDS } from "../../src/journey/contracts.ts";

export const SAMPLE_TODAY = "2026-09-28" as DateKey;
export const SAMPLE_MEMBER = "MEM-001";
export const SAMPLE_PARTNER = "MEM-002";

const d = (s: string) => s as DateKey;
const m = (s: string) => s as ChapterId;
const relation = (date: string): "past" | "today" | "future" => (date < SAMPLE_TODAY ? "past" : date === SAMPLE_TODAY ? "today" : "future");
const act = (stopId: string, verb: string, label: string, call: ActionCall, primary = false): StopAction =>
  ({ id: `${stopId}#${verb}`, label, call, ...(primary ? { primary: true } : {}) });

function bill(id: string, recurrenceId: string, date: string, label: string, cents: number, status: CommitmentStop["status"], setAside: CommitmentStop["setAside"] = null): CommitmentStop {
  const actions: StopAction[] = status === "paid"
    ? [act(id, "books", "See it in the Books", { name: "openBooks", ref: { kind: "month", monthKey: m(date.slice(0, 7)) } }, true)]
    : status === "needs-review"
      ? [act(id, "review", "Review it in the Books", { name: "openBooks", ref: { kind: "register" } }, true)]
      : [act(id, "mark-paid", "Mark paid…", { name: "openBillPaid", recurrenceId }, true)];
  actions.push(act(id, "calendar", "Open the Calendar", { name: "openCalendar", date: d(date) }));
  return {
    kind: "commitment", id, date: d(date), chapterId: m(date.slice(0, 7)), label, amountCents: cents,
    amountBasis: status === "paid" ? "recorded" : "scheduled", sourceRefs: [{ kind: "recurrence", id: recurrenceId }],
    major: status !== "paid", relation: relation(date), actions, status, setAside, recurrenceId, boardKind: "utility",
  };
}

function income(id: string, date: string, label: string, cents: number, status: IncomeStop["status"], origin: IncomeStop["origin"], recurrenceId?: string): IncomeStop {
  const actions: StopAction[] = status === "confirmed"
    ? [act(id, "books", "See it in the Books", origin === "fund-confirmed" ? { name: "openBooks", ref: { kind: "fund" } } : { name: "openBooks", ref: { kind: "month", monthKey: m(date.slice(0, 7)) } }, true)]
    : [act(id, "record", "Record income…", { name: "openRecord", mode: "income", ...(recurrenceId ? { prefill: { recurrenceId } } : {}) }, true),
       act(id, "calendar", "Open the Calendar", { name: "openCalendar", date: d(date) })];
  return {
    kind: "income", id, date: d(date), chapterId: m(date.slice(0, 7)), label, amountCents: cents,
    amountBasis: status === "confirmed" ? "recorded" : origin === "fund-estimate" ? "estimate" : "scheduled",
    sourceRefs: recurrenceId ? [{ kind: "recurrence", id: recurrenceId }] : [], major: origin !== "fund-estimate",
    relation: relation(date), actions, status, origin, memberId: origin.startsWith("fund") ? SAMPLE_MEMBER : null,
  };
}

function chapterReview(month: string, date: string, title: string, status: Extract<ReviewStop, { reviewKind: "chapter-close" }>["status"]): ReviewStop {
  const id = `review:${month}`;
  const actions: StopAction[] = status === "closed" || status === "no-chapter"
    ? [act(id, "books", `Read ${title} in the Books`, { name: "openBooks", ref: { kind: "month", monthKey: m(month) } }, true)]
    : status === "upcoming" ? []
    : [act(id, "campfire", "Open the Campfire", { name: "openCampfire", chapterId: m(month) }, true),
       act(id, "books", `Read ${title} in the Books`, { name: "openBooks", ref: { kind: "month", monthKey: m(month) } })];
  return {
    kind: "review", id, date: d(date), chapterId: m(month), label: title, placeRef: { kind: "station", id: STATION_IDS[Number(month.slice(5, 7)) - 1]! },
    sourceRefs: [], major: true, relation: relation(date), actions, reviewKind: "chapter-close", status, chapterRecordId: status === "no-chapter" ? null : `CHAP-${month}`,
  };
}

function weekly(weekStart: string, status: "scheduled" | "session-open"): ReviewStop {
  const id = `review:week:${weekStart}`;
  return {
    kind: "review", id, date: d(weekStart), chapterId: m(weekStart.slice(0, 7)), label: "Weekly Sitdown", sourceRefs: [], major: false,
    relation: relation(weekStart), actions: [act(id, "sitdown", "Open the weekly Sitdown", { name: "openWeeklySitdown" }, true)],
    reviewKind: "weekly-sitdown", status, weekStart: d(weekStart),
  };
}

function goal(goalId: string, date: string, label: string, status: "backing" | "fully-backed" | "bought", step: number, savedCents: number, targetCents: number): PlanStop {
  const id = `plan:goal:${goalId}`;
  return {
    kind: "plan", id, date: d(date), chapterId: m(date.slice(0, 7)), label, amountCents: targetCents, amountBasis: "target", placeRef: { kind: "kittyPlaza" },
    sourceRefs: [{ kind: "goal", id: goalId }], major: true, relation: relation(date),
    actions: [act(id, "kitty", "Open the Kitty Bank", { name: "openKitty", goalId }, true)], planKind: "goal", goalId, status, step, savedCents, targetCents,
  };
}

function task(taskId: string, date: string, label: string, status: "open" | "done"): PlanStop {
  const id = `plan:task:${taskId}`;
  return {
    kind: "plan", id, date: d(date), chapterId: m(date.slice(0, 7)), label, sourceRefs: [{ kind: "task", id: taskId }], major: false, relation: relation(date),
    actions: [act(id, "planner", "Open the step", { name: "openPlace", target: "planner", object: `task/${taskId}` }, true)], planKind: "task", taskId, status, planLineId: null,
  };
}

function milestone(awardId: string, date: string, label: string, status: MilestoneStop["status"]): MilestoneStop {
  const id = `milestone:${SAMPLE_MEMBER}/${awardId}`;
  return {
    kind: "milestone", id, date: d(date), chapterId: m(date.slice(0, 7)), label, placeRef: { kind: "host", id: "home" },
    sourceRefs: [{ kind: "homeAward", memberId: SAMPLE_MEMBER, id: awardId }], major: true, relation: relation(date),
    actions: [act(id, "homebook", "Open the HomeBook", { name: "openHomeBook", memberId: SAMPLE_MEMBER }, true)], memberId: SAMPLE_MEMBER, awardId, status, unlocks: awardId,
  };
}

function memory(id: string, date: string, label: string, memoryKind: "hearthside" | "win"): MemoryStop {
  return {
    kind: "memory", id, date: d(date), chapterId: m(date.slice(0, 7)), label, sourceRefs: [], major: true, relation: relation(date),
    actions: [act(id, "open", "Open the memory", { name: "openPlace", target: "memories", object: `memory/${id}` }, true)],
    status: "kept-by-everyone", memoryKind, hideAmounts: true,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The stops (every kind × status).

export const SAMPLE_IDS = {
  overdue: "bill:REC-groceries@2026-09-15",
  dueToday: "bill:REC-rent@2026-09-28",
  needsReview: "bill:REC-streaming@2026-09-10",
  paid: "bill:REC-phone@2026-08-25",
  setAsidePrepare: "bill:REC-insurance@2026-10-05",
  setAsideBuild: "bill:REC-winter@2026-10-12",
  upcoming: "bill:REC-internet@2026-10-20",
  incomeExpectedFuture: "income:REC-pay@2026-10-09",
  incomeExpectedPast: "income:REC-side@2026-09-21",
  incomeEstimate: "income:fund:MEM-001@2026-10-02",
  incomeConfirmedSchedule: "income:REC-pay@2026-08-14",
  incomeRecorded: "income:tx:TXN-IN-1",
  incomeFundConfirmed: "income:fund:MEM-001@2026-06-02",
  goalBacking: "plan:goal:GOAL-trip",
  goalFull: "plan:goal:GOAL-buffer",
  goalBought: "plan:goal:GOAL-kettle",
  taskOpen: "plan:task:TASK-ferry",
  taskDone: "plan:task:TASK-quotes",
  milestoneGranted: "milestone:MEM-001/established",
  milestoneReady: "milestone:MEM-001/garden",
  memoryHearthside: "memory:MEMO-quiet-sunday",
  memoryWin: "memory:win:WIN-both",
  memoryUndated: "memory:MEMO-undated",
  weeklyScheduled: "review:week:2026-09-20",
  weeklyOpen: "review:week:2026-09-27",
  crossEra: "crossroads:era:PATH-ERA-1",
  crossHome: "crossroads:home:MEM-001",
  crossPlan: "crossroads:plan:PLAN-2026-10",
  clusterOverdue: "cluster:2026-09-15",
  clusterToday: "cluster:2026-09-28",
} as const;

const STOPS: Stop[] = [
  chapterReview("2026-03", "2026-03-31", "March 2026", "closed"),
  chapterReview("2026-04", "2026-04-30", "April 2026", "waiting-on-partner"),
  memory(SAMPLE_IDS.memoryWin, "2026-05-10", "Paid off the couch", "win"),
  chapterReview("2026-05", "2026-05-31", "May 2026", "waiting-on-you"),
  income(SAMPLE_IDS.incomeFundConfirmed, "2026-06-02", "Fund contribution", 60000, "confirmed", "fund-confirmed"),
  chapterReview("2026-06", "2026-06-30", "June 2026", "no-chapter"),
  memory(SAMPLE_IDS.memoryHearthside, "2026-07-12", "The quiet Sunday", "hearthside"),
  goal("GOAL-kettle", "2026-07-20", "A proper kettle", "bought", 10, 9000, 9000),
  chapterReview("2026-07", "2026-07-31", "July 2026", "closed"),
  income(SAMPLE_IDS.incomeConfirmedSchedule, "2026-08-14", "Bianca pay", 210000, "confirmed", "schedule", "REC-pay"),
  milestone("established", "2026-08-20", "A place to begin", "granted"),
  bill(SAMPLE_IDS.paid, "REC-phone", "2026-08-25", "Phone", 6500, "paid"),
  chapterReview("2026-08", "2026-08-31", "August 2026", "close-due"),
  task("TASK-quotes", "2026-09-09", "Get two insurance quotes", "done"),
  bill(SAMPLE_IDS.needsReview, "REC-streaming", "2026-09-10", "Streaming", 1799, "needs-review"),
  bill(SAMPLE_IDS.overdue, "REC-groceries", "2026-09-15", "Groceries · planned", 52000, "overdue"),
  income(SAMPLE_IDS.incomeRecorded, "2026-09-15", "Bianca pay", 210000, "confirmed", "recorded"),
  weekly("2026-09-20", "scheduled"),
  income(SAMPLE_IDS.incomeExpectedPast, "2026-09-21", "Side work", 30000, "expected", "schedule", "REC-side"),
  weekly("2026-09-27", "session-open"),
  bill(SAMPLE_IDS.dueToday, "REC-rent", "2026-09-28", "Rent", 185000, "due-today"),
  milestone("garden", "2026-09-28", "A useful rhythm", "ready-to-record"),
  goal("GOAL-buffer", "2026-09-29", "Emergency buffer", "fully-backed", 10, 300000, 300000),
  chapterReview("2026-09", "2026-09-30", "September 2026 · Breathing room", "open"),
  income(SAMPLE_IDS.incomeEstimate, "2026-10-02", "Expected Fund contribution", 98000, "expected", "fund-estimate"),
  task("TASK-ferry", "2026-10-03", "Book the ferry", "open"),
  bill(SAMPLE_IDS.setAsidePrepare, "REC-insurance", "2026-10-05", "Tenant insurance", 3400, "upcoming", "prepare"),
  income(SAMPLE_IDS.incomeExpectedFuture, "2026-10-09", "Bianca pay", 210000, "expected", "schedule", "REC-pay"),
  bill(SAMPLE_IDS.setAsideBuild, "REC-winter", "2026-10-12", "Winter reserve", 30000, "upcoming", "build"),
  bill(SAMPLE_IDS.upcoming, "REC-internet", "2026-10-20", "Internet", 8000, "upcoming"),
  chapterReview("2026-10", "2026-10-31", "October 2026", "upcoming"),
  goal("GOAL-trip", "2026-11-01", "Newfoundland, October", "backing", 3, 126000, 420000),
  chapterReview("2026-11", "2026-11-30", "November 2026", "upcoming"),
  chapterReview("2026-12", "2026-12-31", "December 2026", "upcoming"),
];

const UNDATED: MemoryStop[] = [{ ...memory(SAMPLE_IDS.memoryUndated, SAMPLE_TODAY, "Our first key", "hearthside") }];

const CLUSTERS: StopCluster[] = [
  { id: SAMPLE_IDS.clusterOverdue, date: d("2026-09-15"), chapterId: m("2026-09"), stopIds: [SAMPLE_IDS.overdue, SAMPLE_IDS.incomeRecorded], label: "2 on Tue 15 Sep", major: true },
  { id: SAMPLE_IDS.clusterToday, date: d("2026-09-28"), chapterId: m("2026-09"), stopIds: [SAMPLE_IDS.dueToday, SAMPLE_IDS.milestoneReady], label: "2 on Mon 28 Sep", major: true },
];

const CROSSROADS: Crossroads[] = [
  {
    id: SAMPLE_IDS.crossEra, kind: "eraProposal", chapterId: m("2026-09"), date: d("2026-09-28"), label: "A new era: “The flat years”",
    question: "Add “The flat years” to our journey?",
    alternatives: [
      { id: `${SAMPLE_IDS.crossEra}#agreed`, label: "Not on the journey yet", description: "Nothing changes until both of you agree.", isCurrent: true, preview: { kind: "era", changes: [] } },
      { id: `${SAMPLE_IDS.crossEra}#pending`, label: "Bianca’s suggestion", description: "2 things change if both of you agree.", isCurrent: false,
        preview: { kind: "era", changes: [{ field: "name", before: null, after: "The flat years" }, { field: "by", before: null, after: "June 2027" }] } },
    ],
    reversible: true, reversibleNote: "An era can be changed again later in the Era planner; each change needs both of you.",
    confirm: { callback: "openEraPlanner", call: { name: "openEraPlanner", eraId: "PATH-ERA-1" }, label: "Continue in the Era planner…" },
    waitingOn: [SAMPLE_PARTNER], sourceRefs: [{ kind: "pathEra", id: "PATH-ERA-1" }],
  },
  {
    id: SAMPLE_IDS.crossHome, kind: "homeBlueprint", chapterId: m("2026-09"), date: d("2026-09-28"), label: "Your future-home blueprint",
    question: "Keep your home as it is, or place the blueprint you saved?",
    alternatives: [
      { id: `${SAMPLE_IDS.crossHome}#current`, label: "Your home now", description: "The home you last saved.", isCurrent: true,
        preview: { kind: "home", layout: { rooms: [], objects: [] } as never, roomsAdded: [], roomsRemoved: [], lockedFamilies: [] } },
      { id: `${SAMPLE_IDS.crossHome}#future`, label: "Your saved blueprint", description: "Some rooms in it are still locked.", isCurrent: false,
        preview: { kind: "home", layout: { rooms: [], objects: [] } as never, roomsAdded: ["Study"], roomsRemoved: [], lockedFamilies: ["gallery"] } },
    ],
    reversible: true, reversibleNote: "You can change your home again in the HomeBook.",
    confirm: { callback: "openHomeBook", call: { name: "openHomeBook", memberId: SAMPLE_MEMBER }, label: "Continue in the HomeBook…" },
    waitingOn: [], placeRef: { kind: "host", id: "home" }, sourceRefs: [],
  },
  {
    id: SAMPLE_IDS.crossPlan, kind: "planFork", chapterId: m("2026-10"), date: d("2026-10-01"), label: "A proposed October 2026 plan",
    question: "Take up the proposed plan for this month?",
    alternatives: [
      { id: `${SAMPLE_IDS.crossPlan}#active`, label: "No plan agreed yet", description: "Nothing changes until the plan is agreed.", isCurrent: true, preview: { kind: "plan", added: [], removed: [], changed: [] } },
      { id: `${SAMPLE_IDS.crossPlan}#proposed`, label: "The proposed version", description: "Make room for the October trip", isCurrent: false,
        preview: { kind: "plan", added: [{ label: "Ferry to Newfoundland", amountCents: 42000 }], removed: [{ label: "Takeout", amountCents: 12000 }], changed: [{ label: "Groceries", field: "amount", before: "$520.00", after: "$480.00" }] } },
    ],
    reversible: true, reversibleNote: "A plan can be revised again at the kitchen table.",
    confirm: { callback: "openPlace", call: { name: "openPlace", target: "plan-studio" }, label: "Continue at the kitchen table…" },
    waitingOn: [], sourceRefs: [{ kind: "planVersion", id: "PLAN-2026-10" }],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Chapters: the day grid and counts, filled from the literals above.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const daysIn = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

const RECORD: Record<string, Chapter["record"]> = {
  "2026-03": { chapterRecordId: "CHAP-2026-03", kind: "own", recordState: "closed", title: null },
  "2026-04": { chapterRecordId: "CHAP-2026-04", kind: "own", recordState: "open", title: null },
  "2026-05": { chapterRecordId: "CHAP-2026-05", kind: "own", recordState: "open", title: null },
  "2026-06": { chapterRecordId: null, kind: "none", recordState: null, title: null },
  "2026-07": { chapterRecordId: "CHAP-2026-07", kind: "own", recordState: "closed", title: null },
  "2026-08": { chapterRecordId: "CHAP-2026-08", kind: "own", recordState: "open", title: "Make rent boring" },
  "2026-09": { chapterRecordId: "CHAP-2026-09", kind: "own", recordState: "open", title: "Breathing room" },
};

function chapter(month: string, stops: Stop[], clusters: StopCluster[], crossroads: Crossroads[]): Chapter {
  const mine = stops.filter((s) => s.chapterId === month);
  const n = daysIn(month);
  const days = Array.from({ length: n }, (_, i) => {
    const date = d(`${month}-${String(i + 1).padStart(2, "0")}`);
    const onDay = mine.filter((s) => s.date === date);
    return {
      date, relation: relation(date), stopIds: onDay.map((s) => s.id), clusterId: clusters.find((c) => c.date === date)?.id ?? null,
      postedCount: onDay.filter((s) => (s.kind === "commitment" && s.status === "paid") || (s.kind === "income" && s.status === "confirmed")).length,
      flagstone: weekdayOf(date) === 6, sitdown: onDay.some((s) => s.kind === "review" && s.reviewKind === "weekly-sitdown"),
    };
  });
  const overdue = mine.filter((s) => s.kind === "commitment" && s.status === "overdue").length;
  const review = mine.filter((s) => s.kind === "commitment" && s.status === "needs-review").length;
  const closeDue = mine.some((s) => s.kind === "review" && s.reviewKind === "chapter-close" && s.status === "close-due") ? 1 : 0;
  const state = month < SAMPLE_TODAY.slice(0, 7) ? "past" : month === SAMPLE_TODAY.slice(0, 7) ? "open" : "upcoming";
  return {
    id: m(month), stationId: STATION_IDS[Number(month.slice(5, 7)) - 1] as StationId, label: `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, state,
    record: RECORD[month] ?? { chapterRecordId: null, kind: "none", recordState: null, title: null },
    unresolved: {
      overdueCommitments: overdue, commitmentsNeedingReview: review, chapterCloseDue: closeDue as 0 | 1,
      expectedIncomeNotRecorded: mine.filter((s) => s.kind === "income" && s.status === "expected" && s.relation === "past").length,
      attention: overdue + review + closeDue,
    },
    traces: mine.filter((s) => s.kind === "milestone" && s.status === "granted").map((s) => ({ kind: "milestone" as const, stopId: s.id, sourceRefs: s.sourceRefs })),
    days, stopIds: mine.map((s) => s.id), crossroadsIds: crossroads.filter((c) => c.chapterId === month).map((c) => c.id),
  };
}

const WINDOW = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

function board(stops: Stop[], clusters: StopCluster[], crossroads: Crossroads[], extra: Partial<JourneyBoard>): JourneyBoard {
  return {
    version: 1, householdId: "HH-sample", memberId: SAMPLE_MEMBER, today: SAMPLE_TODAY, currentChapterId: m("2026-09"),
    window: { from: m(WINDOW[0]!), to: m(WINDOW.at(-1)!) },
    chapters: WINDOW.map((month) => chapter(month, stops, clusters, crossroads)),
    stops, clusters, crossroads,
    piece: { anchorChapterId: m("2026-09"), atStationId: "sep", atDate: SAMPLE_TODAY, waitingChapterId: m("2026-08"), lookId: "lantern" },
    summary: {
      chapterId: m("2026-09"), periodLabel: "September 2026", everyday: { cents: 123456, figure: "$1234.56" },
      leavingWords: "Leaving next · Rent $1850.00 · Mon 28 · +1 this week", attention: [], next: [],
      quickActions: [
        { id: "quick#expense", label: "Record a purchase…", call: { name: "openRecord", mode: "expense" }, primary: true },
        { id: "quick#bill", label: "Bill paid…", call: { name: "openRecord", mode: "bill" } },
        { id: "quick#income", label: "Record income…", call: { name: "openRecord", mode: "income" } },
        { id: "quick#calendar", label: "Open the Calendar", call: { name: "openCalendar", date: SAMPLE_TODAY } },
        { id: "quick#books", label: "Open the Books", call: { name: "openBooks", ref: { kind: "register" } } },
        { id: "quick#plan", label: "Open the kitchen table", call: { name: "openPlace", target: "plan-studio" } },
      ],
    },
    homes: [], undatedMemories: [], olderChapters: [], empty: false,
    limitations: ["Jonathan’s home and milestones are private to their own device."],
    ...extra,
  };
}

/** The full sample: every stop kind × status, two clusters, three crossroads kinds, one undated memory. */
export function sampleJourneyBoard(): JourneyBoard {
  const b = board(STOPS, CLUSTERS, CROSSROADS, { undatedMemories: UNDATED, olderChapters: [{ id: m("2026-02"), unresolved: { overdueCommitments: 0, commitmentsNeedingReview: 0, chapterCloseDue: 0, expectedIncomeNotRecorded: 0, attention: 0 }, traces: [] }] });
  b.summary.attention = [
    { id: `attention:${SAMPLE_IDS.overdue}`, words: "Groceries · planned · Tue 15 Sep · overdue, not recorded", stopId: SAMPLE_IDS.overdue, call: { name: "openBillPaid", recurrenceId: "REC-groceries" } },
    { id: `attention:${SAMPLE_IDS.needsReview}`, words: "Streaming · Thu 10 Sep · payment status needs review", stopId: SAMPLE_IDS.needsReview, call: { name: "openBooks", ref: { kind: "register" } } },
    { id: "attention:review:2026-08", words: "August 2026 · the Chapter is still open", stopId: "review:2026-08", call: { name: "openCampfire", chapterId: m("2026-08") } },
    { id: "need:fund", words: "A contribution to confirm", stopId: null, call: { name: "openBooks", ref: { kind: "fund" } } },
  ];
  b.summary.next = [SAMPLE_IDS.dueToday, SAMPLE_IDS.milestoneReady, SAMPLE_IDS.goalFull];
  return b;
}

/** A new household: honest empty board, setup actions only. */
export function sampleEmptyJourneyBoard(): JourneyBoard {
  const b = board([], [], [], { empty: true, limitations: [] });
  b.piece = { ...b.piece, waitingChapterId: null };
  b.summary = {
    ...b.summary, everyday: null, leavingWords: "Leaving next · Nothing dated this week", attention: [], next: [],
    quickActions: [
      { id: "quick#books", label: "Set up our accounts in the Books", call: { name: "openBooks", ref: { kind: "register" } }, primary: true },
      { id: "quick#plan", label: "Make our first plan", call: { name: "openPlace", target: "plan-studio" } },
      { id: "quick#calendar", label: "Open the Calendar", call: { name: "openCalendar", date: SAMPLE_TODAY } },
    ],
  };
  return b;
}
