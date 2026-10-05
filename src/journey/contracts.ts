/**
 * The Journey Board — frozen contracts (planner-owned; frozen when Wave A starts).
 *
 * Every track (T1 model, T2 land, T3 board, T4 ui, T5 integration, T6 tests)
 * builds against these types. A change goes through the integrator, never a
 * track. Read `src/journey/README.md`, `docs/DECISIONS.md` D49–D67 and `docs/CLAUDE_JOURNEY_BOARD.md`.
 *
 * Invariants (tests enforce them; every module under src/journey keeps them):
 *
 * 1. PRESENTATION ONLY. The board is derived on read from one Household
 *    snapshot + memberId + today (App's Toronto `today`). Nothing here posts,
 *    schedules, moves, sets aside or re-adds money; nothing computes a balance;
 *    nothing is stored except per-viewer view state (`JourneyViewState`).
 *    Amounts are copies of amounts that already exist on a source record.
 * 2. STABLE IDS. Every stop / cluster / crossroads / chapter id is built from
 *    the id of the record that produced it (see `journeyIds`). Importing an
 *    older record, correcting an amount, re-reading after a sync or reloading
 *    never re-keys an unrelated stop. Selection and view state key on these ids.
 * 3. EXPECTED ≠ CONFIRMED. Expected income is never shown as received; a due
 *    date passing is never "paid"; money set aside in a pot is never "paid";
 *    a fully backed goal is never "bought"; booked is never "experienced";
 *    a planning task done is never a memory. Each is a separate enum value.
 * 4. NO COMMANDS. Selecting, hovering, zooming, animating the piece,
 *    previewing a crossroads or "arriving" anywhere calls NOTHING but a
 *    `JourneyBoardActions` callback, and every callback opens an existing
 *    surface (which keeps its own named Confirm). `ActionCall` has no variant
 *    that writes.
 * 5. ONE CLOCK. `today` comes from the App; no module creates a clock.
 *
 * Coordinates: concept metres = engine units (MANIFEST scale 1.0). Concept
 * (x, y) = (east, south) = engine (x, z). Height is engine y. The board draws
 * heights through `compressHeight`; x/z are never altered, so a board point
 * handed to Horizon is the same place.
 */
import type * as THREE from "three";
import type { DateKey, MonthKey } from "../core/calendar.ts";
import type { ChapterState } from "../core/chapters.ts";
import type { FabVerbMode } from "../core/fabActions.ts";
import type { Environment } from "../core/types.ts";
import type { LodBudgets, Point2, Point3, Polygon } from "../harbour/horizon/world/definition.ts";
import type { TerrainField } from "../harbour/horizon/land/interfaces.ts";
import type { HomeLayout } from "../home/model.ts";
import type { ThemeId } from "../theme/scenes.ts";

export type { DateKey, MonthKey, Point2, Point3, Polygon, ThemeId };

// ---------------------------------------------------------------------------
// Identity

/** A chapter IS a calendar month (D-273): its id is the month key "YYYY-MM". */
export type ChapterId = MonthKey;

/** The twelve baked stations (index `journey.stations[].id`), one per calendar month. */
export type StationId = "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec";
export const STATION_IDS: readonly StationId[] = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** The station a chapter stands at: its calendar month (1 = jan). */
export function stationForMonth(month: MonthKey): StationId {
  const index = Number(month.slice(5, 7)) - 1;
  return STATION_IDS[index >= 0 && index < 12 ? index : 0]!;
}

export type StopKind = "income" | "commitment" | "review" | "plan" | "milestone" | "memory";

/**
 * Stable id builders. The `@date` part is the SCHEDULED occurrence date of a
 * repeating record (a stable schedule key); a one-off record keys on its own
 * id alone, so correcting its date moves the stop without re-keying it.
 */
export const journeyIds = {
  /** A scheduled bill occurrence, unpaid or paid (paid = a posted transaction with source "recurring" and sourceId = recurrenceId on that date). */
  bill: (recurrenceId: string, date: DateKey) => `bill:${recurrenceId}@${date}` as const,
  /** A dated obligation that is not a recurrence (appointment, potential expense, other board item): the board item's own id. */
  billItem: (boardItemId: string, date: DateKey) => `bill:item:${boardItemId}@${date}` as const,
  /** Expected or confirmed income on a schedule: recurrence id, `payday:<memberId>` or `fund:<memberId>`. */
  income: (source: string, date: DateKey) => `income:${source}@${date}` as const,
  /** Recorded income with no schedule behind it. */
  incomeRecorded: (transactionId: string) => `income:tx:${transactionId}` as const,
  /** The Chapter's close at the Campfire. */
  review: (chapterId: ChapterId) => `review:${chapterId}` as const,
  /** The Charter's weekly Sitdown, keyed by its week start: `weekBounds(date).start`, a Sunday (Hearth's weeks run Sunday to Saturday). */
  weeklyReview: (weekStart: DateKey) => `review:week:${weekStart}` as const,
  planGoal: (goalId: string) => `plan:goal:${goalId}` as const,
  planTask: (taskId: string) => `plan:task:${taskId}` as const,
  milestone: (memberId: string, awardId: string) => `milestone:${memberId}/${awardId}` as const,
  memory: (memoryId: string) => `memory:${memoryId}` as const,
  memoryWin: (winId: string) => `memory:win:${winId}` as const,
  cluster: (date: DateKey) => `cluster:${date}` as const,
  crossroadsEra: (eraRowId: string) => `crossroads:era:${eraRowId}` as const,
  crossroadsHome: (memberId: string) => `crossroads:home:${memberId}` as const,
  crossroadsPlan: (planVersionId: string) => `crossroads:plan:${planVersionId}` as const,
} as const;

/** A back-reference to the record(s) a stop was derived from. Never a copy of the record. */
export type SourceRef =
  | { kind: "recurrence"; id: string }
  | { kind: "transaction"; id: string }
  | { kind: "boardItem"; id: string }
  | { kind: "fundEvent"; id: string }
  | { kind: "chapter"; id: string }
  | { kind: "goal"; id: string }
  | { kind: "task"; id: string }
  | { kind: "planVersion"; id: string }
  | { kind: "planLine"; id: string }
  | { kind: "pathEra"; id: string }
  | { kind: "homeAward"; memberId: string; id: string }
  | { kind: "hearthsideMemory"; id: string }
  | { kind: "win"; id: string };

/** A stop tied to a real place on the island uses that place's baked identity. Dated stops without a place have none. */
export type PlaceRef =
  | { kind: "host"; id: string }
  | { kind: "station"; id: StationId }
  | { kind: "reserve"; id: string }
  | { kind: "homestead"; id: string }
  | { kind: "kittyPlaza" };

// ---------------------------------------------------------------------------
// Actions: the only way out of the board

/** The Add flows the App's `openRecordFlow` accepts (FabVerbMode). */
export type RecordMode = FabVerbMode;
/**
 * What a stop may pre-fill: only what `openRecordFlow` honours in-view today (a recurrence for Bill paid). An amount
 * prefill is not offered: `openRecordFlow` keeps `amount` only for a cross-view hand-off (App.tsx L6364).
 */
export type RecordPrefill = { recurrenceId?: string };
/** Books pane requests the App already understands (`setBooksPaneRequest`). */
export type BooksRef = { kind: "month"; monthKey: MonthKey } | { kind: "register" } | { kind: "fund" };
/**
 * Where "Enter Horizon here" lands. `{x, y}` is concept metres (engine x, z);
 * Horizon grounds it (`restoreHorizonPosition`), falling back to the nearest
 * walkable path node, so water and restricted places are never teleport targets.
 * `{host}` lands on the host's baked `returnAt`.
 */
export type HorizonLocation = { x: number; y: number } | { host: string };

/**
 * The callback surface the App supplies. Every member OPENS an existing
 * surface; none posts, confirms, completes or grants. The App keeps each
 * surface's own named Confirm and permission boundary.
 */
export type JourneyBoardActions = {
  /** `openRecordFlow(mode, …)` — the Add sheet (expense/income/shift/transfer/bill). */
  openRecord(mode: RecordMode, prefill?: RecordPrefill): void;
  /** Bill paid at this recurrence's named Confirm (`openRecordFlow("bill", …, recurrenceId)` → `postOneRecurrence` after Confirm). */
  openBillPaid(recurrenceId: string): void;
  /** `openHouseObject(target, object)` / `openAtlasTarget` — any house target (cellar-bills, plan-studio, planner, memories, …). */
  openPlace(target: string, object?: string): void;
  /** The Campfire ritual (the Chapter close). Opening it closes nothing. */
  openCampfire(chapterId: ChapterId): void;
  /** The Charter's weekly Sitdown. */
  openWeeklySitdown(): void;
  /** The member's HomeBook (`useHomeBook().open`); only the viewer's own home is editable. */
  openHomeBook(memberId: string): void;
  /** The Era planner (both-agree era proposals live there). */
  openEraPlanner(eraId: string): void;
  /** The Kitty Bank room for a goal (`openHouseObject("loft-banks", "bank/goal:<id>")`). */
  openKitty(goalId: string): void;
  /** The Calendar. `date` is the stop's date; the Calendar route has no date focus today, so the App may open it on today's month. */
  openCalendar(date: DateKey): void;
  openBooks(ref: BooksRef): void;
  /**
   * The App's reviewed recurrence path (the due review: `dueOccurrenceReview` → its named Confirm → `postOneRecurrence`),
   * opened above the board, focused on `recurrenceId` when given. Opening it records nothing (review B1 / M1).
   */
  openDueReview(recurrenceId?: string): void;
  /**
   * Explicit "Enter Horizon here": the only way the board hands off to the detailed world. Returns `false` when the
   * passage could not start (one is already in flight), so the board can say so; nothing else returns a value.
   */
  enterHorizon(location: HorizonLocation): boolean | void;
  /** Leave the board the way the house route came (`putHouseObjectBack`). */
  back(): void;
};

/** One callback invocation, as data, so the map panel and the list run the SAME action. No variant writes. */
export type ActionCall =
  | { name: "openRecord"; mode: RecordMode; prefill?: RecordPrefill }
  | { name: "openBillPaid"; recurrenceId: string }
  | { name: "openDueReview"; recurrenceId?: string }
  | { name: "openPlace"; target: string; object?: string }
  | { name: "openCampfire"; chapterId: ChapterId }
  | { name: "openWeeklySitdown" }
  | { name: "openHomeBook"; memberId: string }
  | { name: "openEraPlanner"; eraId: string }
  | { name: "openKitty"; goalId: string }
  | { name: "openCalendar"; date: DateKey }
  | { name: "openBooks"; ref: BooksRef }
  | { name: "enterHorizon"; location: HorizonLocation }
  | { name: "back" };

export type StopAction = {
  /** Stable within its stop: `<stopId>#<verb>`. */
  id: string;
  /** Plain words ("Mark paid…", "Record income", "Open the Campfire"). Ends in "…" when a Confirm follows. */
  label: string;
  call: ActionCall;
  primary?: boolean;
};

/** The one dispatcher both the map panel and the list use. */
export function runJourneyAction(actions: JourneyBoardActions, call: ActionCall): void {
  switch (call.name) {
    case "openRecord": actions.openRecord(call.mode, call.prefill); return;
    case "openBillPaid": actions.openBillPaid(call.recurrenceId); return;
    case "openDueReview": actions.openDueReview(call.recurrenceId); return;
    case "openPlace": actions.openPlace(call.target, call.object); return;
    case "openCampfire": actions.openCampfire(call.chapterId); return;
    case "openWeeklySitdown": actions.openWeeklySitdown(); return;
    case "openHomeBook": actions.openHomeBook(call.memberId); return;
    case "openEraPlanner": actions.openEraPlanner(call.eraId); return;
    case "openKitty": actions.openKitty(call.goalId); return;
    case "openCalendar": actions.openCalendar(call.date); return;
    case "openBooks": actions.openBooks(call.ref); return;
    case "enterHorizon": actions.enterHorizon(call.location); return;
    case "back": actions.back(); return;
  }
}

// ---------------------------------------------------------------------------
// Stops

/** Where the figure on a stop comes from. The UI prints it beside the amount. */
export type AmountBasis =
  /** A schedule's own amount (a recurrence, a board item). Not yet recorded. */
  | "scheduled"
  /** The Fund's observed lower-median estimate (`prepareFundInflows`, estimated=true). */
  | "estimate"
  /** A posted transaction / confirmed Fund event. */
  | "recorded"
  /** A goal's target. */
  | "target"
  /** No figure is known; `amountCents` is null. Unknown is never zero. */
  | "unknown";

type StopBase<K extends StopKind> = {
  kind: K;
  id: string;
  /** Toronto civil date the stop stands on. */
  date: DateKey;
  chapterId: ChapterId;
  label: string;
  /** Null = unknown (never 0). Absent = the stop has no amount by nature (a review, a memory). */
  amountCents?: number | null;
  amountBasis?: AmountBasis;
  placeRef?: PlaceRef;
  sourceRefs: SourceRef[];
  /** Major stops get a signpost at Sky/Region and stronger geometry; ordinary stops are day marks. */
  major: boolean;
  /** Where the date sits against today. Never implies completion. */
  relation: "past" | "today" | "future";
  /** The working controls this stop reveals. The list shows the SAME actions. */
  actions: StopAction[];
};

export type CommitmentStatus =
  /** Scheduled after today, not recorded. */
  | "upcoming"
  /** Scheduled today, not recorded. */
  | "due-today"
  /** Its day passed and it is still not recorded. NOT paid. */
  | "overdue"
  /** A posted transaction exists for this occurrence (sourceRefs names it). */
  | "paid"
  /** The Calendar's "earlier receipt corrected or excluded · payment status needs review" (calendarWeight allowPost=false). */
  | "needs-review";
export type CommitmentStop = StopBase<"commitment"> & {
  status: CommitmentStatus;
  /** Which pot it is set aside in (dayLedger slip `pot`). Set aside is NOT paid. */
  setAside: "prepare" | "build" | null;
  recurrenceId: string | null;
  /** The board kind (`BoardKind`) for words and icons: rent, utility, visit, … */
  boardKind: string;
};

export type IncomeStatus =
  /** Scheduled / estimated; nothing recorded yet. A past expected stop stays "expected" and reads "not recorded". */
  | "expected"
  /** A posted income transaction or a confirmed Fund contribution. */
  | "confirmed";
export type IncomeStop = StopBase<"income"> & {
  status: IncomeStatus;
  origin: "schedule" | "payday" | "fund-estimate" | "fund-confirmed" | "recorded";
  memberId: string | null;
};

export type ChapterReviewStatus =
  /** A later month; nothing to do yet. */
  | "upcoming"
  /** The month is running; the close happens at the Campfire when we choose. */
  | "open"
  /** The month ended and its Chapter is still open (`chapterReminder`). Not a failure. */
  | "close-due"
  /** A closure proposal waits on this viewer (`pendingChapterClosure`). */
  | "waiting-on-you"
  /** A closure proposal waits on the partner. */
  | "waiting-on-partner"
  /** Closed at a Sitdown. */
  | "closed"
  /** No Chapter was kept for this month (a skipped month is never a failure). */
  | "no-chapter";
export type WeeklyReviewStatus =
  | "scheduled"
  /** A weekly Sitdown session exists for that week (`weeklySession`). Existing ≠ finished. */
  | "session-open";
export type ReviewStop = StopBase<"review"> &
  ({ reviewKind: "chapter-close"; status: ChapterReviewStatus; chapterRecordId: string | null } |
   { reviewKind: "weekly-sitdown"; status: WeeklyReviewStatus; weekStart: DateKey });

export type PlanStop = StopBase<"plan"> &
  ({ planKind: "goal"; goalId: string;
     /** "fully-backed" is not "bought"; "bought" only with a recorded purchase (`goal.purchaseId`). */
     status: "backing" | "fully-backed" | "bought";
     /** 0–10, `kittyBankBackingStep`. */
     step: number;
     savedCents: number; targetCents: number } |
   { planKind: "task"; taskId: string;
     /** A done task is a trace, never a memory. */
     status: "open" | "done";
     /** The plan line it serves, when `Task.planReference` names one. */
     planLineId: string | null });

export type MilestoneStop = StopBase<"milestone"> & {
  /** Per member (the only evaluator is `src/home/progression.ts`). */
  memberId: string;
  awardId: string;
  /**
   * "granted": `HomeState.awards` holds it (date = grantedAt).
   * "ready-to-record": `homeProgress(...).eligible && !earned`; it is recorded the next time the member saves the
   * home (awards are granted only inside `acceptHome`). date = today. Nothing is placed automatically.
   */
  status: "granted" | "ready-to-record";
  /** The blueprint family it unlocks (catalogue `Family`). */
  unlocks: string;
};

export type MemoryStop = StopBase<"memory"> & {
  /** Only memories kept by every active member (hearthside `memoryKeptByEveryone`, or a Win in `memories(h)`). */
  status: "kept-by-everyone";
  memoryKind: "hearthside" | "win";
  hideAmounts: boolean;
};

export type Stop = IncomeStop | CommitmentStop | ReviewStop | PlanStop | MilestoneStop | MemoryStop;

/** Several stops on one date form one expandable cluster on the route (never overlapping tiles). */
export type StopCluster = {
  id: string; // journeyIds.cluster(date)
  date: DateKey;
  chapterId: ChapterId;
  /** Ordered: overdue/needs-review → due → income → review → plan → milestone → memory, then by id. */
  stopIds: string[];
  /** "3 on Tue 15 Sep". */
  label: string;
  major: boolean;
};

// ---------------------------------------------------------------------------
// Crossroads: only real choices

export type CrossroadsKind = "eraProposal" | "homeBlueprint" | "planFork";

/** Differences read from existing calculations only (the era rows, `planVersionDiff`, the two home layouts). No invented outcomes. */
export type CrossroadsPreview =
  | { kind: "era"; changes: { field: "name" | "finishLine" | "by" | "home" | "finish" | "plans"; before: string | null; after: string | null }[] }
  | { kind: "home"; layout: HomeLayout; roomsAdded: string[]; roomsRemoved: string[]; lockedFamilies: string[] }
  | { kind: "plan"; added: { label: string; amountCents: number | null }[]; removed: { label: string; amountCents: number | null }[]; changed: { label: string; field: string; before: string; after: string }[] };

export type CrossroadsAlternative = {
  id: string;
  /** Neutral words: "As agreed now" / "Bianca's suggestion"; never "success" or "failure". */
  label: string;
  description: string;
  /** The standing state. Previewing another alternative is visibly provisional. */
  isCurrent: boolean;
  preview: CrossroadsPreview;
};

export type Crossroads = {
  id: string;
  kind: CrossroadsKind;
  chapterId: ChapterId;
  date: DateKey;
  label: string;
  question: string;
  alternatives: CrossroadsAlternative[];
  /** True when the choice can be revisited later through the same surface. */
  reversible: boolean;
  reversibleNote: string;
  /**
   * "Confirm" never runs a command: it opens the surface that owns the choice (and its own Confirm):
   * eraProposal → openEraPlanner, homeBlueprint → openHomeBook, planFork → openPlace("plan-studio").
   */
  confirm: { callback: "openEraPlanner" | "openHomeBook" | "openPlace"; call: ActionCall; label: string };
  /** Members whose agreement is still missing, by id (both-agree rows). */
  waitingOn: string[];
  placeRef?: PlaceRef;
  sourceRefs: SourceRef[];
};

// ---------------------------------------------------------------------------
// Chapters, piece, summary, board

export type UnresolvedCounts = {
  overdueCommitments: number;
  commitmentsNeedingReview: number;
  /** 1 when the month ended and its Chapter is still open. */
  chapterCloseDue: 0 | 1;
  /** Shown, never counted in `attention`: the app cannot know money arrived until someone records it. */
  expectedIncomeNotRecorded: number;
  /** overdue + needs-review + close-due. A past chapter with attention > 0 stays readable, never "ruined". */
  attention: number;
};

/** Small, grounded traces a past chapter keeps. Each names its source. */
export type ChapterTrace =
  | { kind: "chapter-closed"; outcome: ChapterState; sourceRefs: SourceRef[] }
  | { kind: "books-closed"; sourceRefs: SourceRef[] }
  | { kind: "plan-reviewed"; sourceRefs: SourceRef[] }
  | { kind: "goal-fully-backed"; goalId: string; sourceRefs: SourceRef[] }
  | { kind: "task-done"; taskId: string; sourceRefs: SourceRef[] }
  | { kind: "memory-kept"; stopId: string; sourceRefs: SourceRef[] }
  | { kind: "milestone"; stopId: string; sourceRefs: SourceRef[] };

export type DayCell = {
  date: DateKey;
  relation: "past" | "today" | "future";
  stopIds: string[];
  clusterId: string | null;
  /** Posted entries that day: they enrich the day, they never add spaces or movement. */
  postedCount: number;
  /** Last day of a Monday-to-Sunday week (dayLedger `flagstone`). */
  flagstone: boolean;
  /** The Charter's weekly Sitdown falls here. */
  sitdown: boolean;
};

export type Chapter = {
  id: ChapterId;
  stationId: StationId;
  /** "September 2026". */
  label: string;
  /** By calendar against today's month. "open" is today's month. The future never looks like history. */
  state: "past" | "open" | "upcoming";
  /** The Chapter record for the month (`chapterMonths`): own / still-open (an earlier one spanning it) / none. */
  record: { chapterRecordId: string | null; kind: "own" | "still-open" | "none"; recordState: ChapterState | null; title: string | null };
  unresolved: UnresolvedCounts;
  traces: ChapterTrace[];
  /** Every day of the month, 1…N (N sits at the station). */
  days: DayCell[];
  stopIds: string[];
  crossroadsIds: string[];
};

/** Device-local token looks (P4). A synced look would need schema; deferred. */
export type PieceLookId = "lantern" | "cat" | "boat" | "kettle";
export const PIECE_LOOKS: readonly PieceLookId[] = ["lantern", "cat", "boat", "kettle"];
export const DEFAULT_PIECE_LOOK: PieceLookId = "lantern";

/**
 * The household's current place: today's period. Separate from the viewer's selection, from the camera and from any
 * body in Horizon. Browsing another chapter never moves it.
 */
export type HouseholdPiece = {
  /** Today's month. */
  anchorChapterId: ChapterId;
  atStationId: StationId;
  /** Today; the piece stands on today's day space. */
  atDate: DateKey;
  /** An earlier month whose Chapter is still open (close due), or null. The piece shows a small gate-ajar hint pointing at its review stop. */
  waitingChapterId: ChapterId | null;
  /** The model sets DEFAULT_PIECE_LOOK; the UI overlays the device-local `JourneyViewState.pieceLook` before handing it to the board. */
  lookId: PieceLookId;
};

export type AttentionItem = { id: string; words: string; stopId: string | null; call: ActionCall };

/** The calm header: where we are · what needs attention · what is next · what I can do. From existing selectors only. */
export type BoardSummary = {
  chapterId: ChapterId;
  /** "September 2026". */
  periodLabel: string;
  /** Everyday · now (`readSnapshot(...).now` via campCardModel); null when the Fund cannot say. */
  everyday: { cents: number | null; figure: string } | null;
  /** readCardLeaving words ("Leaving next · Hydro $142.00 · Sat 27 · +2 this week"). */
  leavingWords: string;
  /** readNeeds + overdue/needs-review commitments + close-due chapter, most pressing first. */
  attention: AttentionItem[];
  /** Up to three next items from today on (stop ids), in date order. */
  next: string[];
  /** Always present (Record, Calendar, Books, Plan). Direct access never depends on the map. */
  quickActions: StopAction[];
};

export type JourneyBoard = {
  version: 1;
  householdId: string;
  memberId: string;
  today: DateKey;
  /** Today's month. */
  currentChapterId: ChapterId;
  /** The chapters on the board: one lap, ≤ 12 consecutive months, so one chapter per station. */
  window: { from: ChapterId; to: ChapterId };
  chapters: Chapter[];
  /** Sorted by date, then kind order, then id. */
  stops: Stop[];
  clusters: StopCluster[];
  crossroads: Crossroads[];
  piece: HouseholdPiece;
  summary: BoardSummary;
  /**
   * Committed member homes the board can draw at map scale: the viewer's own `personalLife.home.layout` (never the
   * draft, never `future`) on the viewer's claimed plot (`hearthside.homePlots`, default `HOME_RESERVE_ID`). A
   * partner's layout is private to their envelope and is not on this device (listed in `limitations`).
   */
  homes: JourneyHome[];
  /** Kept memories with no date: list only (never placed on a guessed day). */
  undatedMemories: MemoryStop[];
  /** Chapters older than the window: traces only, list only. */
  olderChapters: { id: ChapterId; unresolved: UnresolvedCounts; traces: ChapterTrace[] }[];
  /** A new household: honest empty board (no invented achievements); `summary.quickActions` carries setup actions. */
  empty: boolean;
  /** Plain-language limits shown in the list's footer (e.g. "Bianca's home is private to her device"). */
  limitations: string[];
};

export type DeriveJourneyBoardOptions = {
  /** Months before today's month (default 8). pastMonths + 1 + aheadMonths ≤ 12. */
  pastMonths?: number;
  /** Months after today's month (default 3). */
  aheadMonths?: number;
};
/** T1's entry point signature (implemented in src/journey/model). Pure; memoize on (household.revision, memberId, today). */
export type DeriveJourneyBoard = (household: import("../core/types.ts").Household, memberId: string, today: DateKey, options?: DeriveJourneyBoardOptions) => JourneyBoard;

// ---------------------------------------------------------------------------
// List equivalent

export type ListRow = {
  /** Same id as the thing it lists (chapter id, cluster id, stop id, crossroads id). */
  id: string;
  level: "chapter" | "cluster" | "stop" | "crossroads";
  chapterId: ChapterId;
  date: DateKey | null;
  /** Kind in words (never colour alone): "Bill", "Income · expected", "Review", "Plan", "Milestone", "Memory", "Crossroads". */
  kindLabel: string;
  label: string;
  /** "$142.00 · scheduled", "Unknown amount", "" for none. */
  amountText: string;
  /** "Overdue · not recorded", "Paid · recorded 3 Sep", "Set aside in Prepare · not paid", … */
  statusText: string;
  /** Exactly the actions the map panel offers for the same id. */
  actions: StopAction[];
  depth: 0 | 1 | 2;
};
export type BoardToList = (board: JourneyBoard) => ListRow[];

// ---------------------------------------------------------------------------
// Route space (T3 lays it out from the board + the land; pure, no three)

export type MonthSpace = {
  chapterId: ChapterId;
  stationId: StationId;
  /** Engine coords with compressed height (board space). */
  at: Point3;
  state: Chapter["state"];
};
export type DaySpace = {
  date: DateKey;
  chapterId: ChapterId;
  /** 1…N along the month's stretch; N sits at the station. */
  index: number;
  at: Point3;
  /** Unit tangent of the route at this space (x, z). */
  tangent: Point2;
  relation: DayCell["relation"];
  stopIds: string[];
  clusterId: string | null;
  flagstone: boolean;
};
/** One month's stretch: the ribbon arc from the previous station to this chapter's station. */
export type RouteStretch = {
  chapterId: ChapterId;
  fromStationId: StationId;
  toStationId: StationId;
  /** Ribbon centreline, board space. */
  points: Point3[];
  lengthEu: number;
  days: DaySpace[];
};
export type RouteSpace = {
  months: MonthSpace[];
  stretches: RouteStretch[];
  /** Where the route crosses itself (drawn over/under; no space is ever placed at a crossing). */
  crossings: { at: Point2; overChapterId: ChapterId; underChapterId: ChapterId }[];
};
export type LayoutRoute = (board: JourneyBoard, land: JourneyLandData) => RouteSpace;

// ---------------------------------------------------------------------------
// Camera, heights, LOD (numbers from MANIFEST journey.camera / journey.lod)

export type CameraTier = "sky" | "region" | "stop";
/**
 * MANIFEST journey.camera: sky = the island's diagonal (√(2000²+1800²) ≈ 2691), region 250, stop 80, upClose 25
 * (orbit radii for the manifest's 50° lens). The board keeps the FRAMED GROUND EXTENT of those radii
 * (frame height = 2·r·tan(25°)) with a near-orthographic 20° lens: distance = r·tan(25°)/tan(10°).
 * Sky additionally fits the whole island extent to the viewport. upClose is not a board tier: below Stop the board
 * never enters the world by zoom; "Enter Horizon here" does, explicitly.
 */
export const JOURNEY_CAMERA = {
  referenceFovDeg: 50,
  fovDeg: 20,
  /** Gently angled, stable: pitch from horizontal, heading 0 = north up. No free rotation. */
  pitchDeg: 58,
  headingDeg: 0,
  radius: { sky: 2691, region: 250, stop: 80 },
  upCloseRadius: 25,
  /** Min / max zoom radius; tiers switch at the geometric midpoints. */
  minRadius: 60,
  maxRadius: 2900,
} as const;
/** Frame height (ground eu) for an orbit radius under the reference lens. */
export function frameHeightForRadius(radius: number): number {
  return 2 * radius * Math.tan((JOURNEY_CAMERA.referenceFovDeg / 2) * Math.PI / 180);
}
export function tierForRadius(radius: number): CameraTier {
  const r = JOURNEY_CAMERA.radius;
  return radius >= Math.sqrt(r.sky * r.region) ? "sky" : radius >= Math.sqrt(r.region * r.stop) ? "region" : "stop";
}

/**
 * View-only height compression (presentation, never the island): tall land and buildings must not hide the route.
 * Ground: h ≤ knee → h·below; above → knee·below + (h − knee)·above. Buildings: height·buildingScale on compressed ground.
 */
export const HEIGHT_COMPRESSION = { knee: 20, below: 0.5, above: 0.18, buildingScale: 0.5, routeLift: 1.2 } as const;
export function compressHeight(height: number): number {
  const { knee, below, above } = HEIGHT_COMPRESSION;
  return height <= knee ? height * below : knee * below + (height - knee) * above;
}

/** MANIFEST journey.lod [full, lite]: the board (land + route + spaces + piece + homes) stays inside L0 at Sky and L1 below. */
export const JOURNEY_LOD = {
  sky: { triangles: { full: 40_000, lite: 25_000 }, drawCalls: { full: 60, lite: 40 } },
  region: { triangles: { full: 80_000, lite: 45_000 } },
  coastVertices: 400,
} as const;

// ---------------------------------------------------------------------------
// Land (T2)

export type LandLineKind = "road" | "skate" | "walk" | "cable" | "rail" | "ferry" | "row";
export type JourneyLandLine = { id: string; kind: LandLineKind; /** Simplified plan points (concept x, y). */ points: Point2[] };

/**
 * What `loadJourneyLand()` returns: the baked index (`/horizon/world/horizon-geo-1.index.json.gz`) reduced to what the
 * board draws, plus the `journey` terrain LOD (20 m lattice) of `horizon-geo-1.bin`. No pathGraph, collision,
 * solids, chunks, movers or weather. Geometry is never read from MANIFEST.json at runtime.
 */
export type JourneyLandData = {
  revision: string;
  extent: { w: number; h: number };
  seaLevel: number;
  /** ≤ JOURNEY_LOD.coastVertices points. */
  coastline: Polygon;
  water: { id: string; kind: string; level: number; outline: Polygon }[];
  landforms: { id: string; outline: Polygon; minHeight: number; maxHeight: number }[];
  districts: { id: string; neighbourhood: string | null; heart: Point2 | null; label: string }[];
  hosts: { id: string; door: Point2; doorHeight: number; footprint: Polygon | null; height: number; roofHeight: number | null }[];
  reserves: { id: string; outline: Polygon; door: Point2 }[];
  lines: JourneyLandLine[];
  stations: { id: StationId; month: number; anchor: Point2; height: number; footprint: Polygon | null }[];
  /** The carved Year Walk stretches, simplified; reference only (the board ribbon is its own presentation, P3). */
  yearWalk: { stationId: StationId; fromStationId: StationId; lengthEu: number; points: Point3[] }[];
  homestead: { id: string; anchor: Point2; height: number; footprint: Polygon }[];
  kittyPlaza: { xy: Point2; height: number };
  terrain: TerrainField;
  lod: LodBudgets;
  /** The road's spans (ROAD.md §7), drawn as bridges at map scale. Absent in a land extracted before format 2. */
  bridges?: JourneyLandBridge[];
  /** Where a road runs under cover (a tunnel, the Prow gallery): drawn dimmed and dashed, with portal notches. */
  covers?: JourneyLandCover[];
  /** Boulevard reaches (the corridor's `boulevard` context): a slightly wider road with a planted band. Present only
   * when the index carries corridors. */
  boulevards?: JourneyLandBoulevard[];
  /** The Water's Way (slim format 4): neighbourhood buildings at or above the Journey height and every landmark, from the
   * index's `dressing`. Absent when the island carries no dressing. */
  dressing?: JourneyLandDressingMap;
};
/** A dressed building on the map (`buildingJourneyShape` at the bake: plan footprint, raw base, eave height and roof rise)
 * and a story landmark (base and sighted top, raw heights). */
export type JourneyLandDressingMap = {
  buildings: { id: string; footprint: Point2[]; base: number; height: number; roofHeight: number }[];
  landmarks: { id: string; label: string; at: Point3; top: Point3 }[];
};
/**
 * A road bridge (index `structures` of kind bridge + its `structure.<id>` bed): the deck's centreline stretch in engine
 * coordinates `[x, deck height (raw, uncompressed), z]`, the deck's true width (eu), the drawn lines whose own height
 * puts them ON the deck (`lineIds`: the road, and a skate lane that shares a wide deck) and the drawn lines that pass
 * UNDER it (`underIds`: a ferry, a river run, a lower skate lane), which the map breaks beneath the deck.
 */
export type JourneyLandBridge = { id: string; axis: Point3[]; width: number; lineIds: string[]; underIds: string[]; landmark?: { name:string; glyph:import('./land/bridgeGlyph').BridgeGlyph; at:Point3 } };
/** A covered stretch of a road line (plan points, portal to portal) and its two portals. */
export type JourneyLandCover = { id: string; kind: "tunnel" | "gallery"; lineId: string; points: Point2[]; portals: Point2[] };
/** A boulevard reach of a road line (plan points along the corridor stations); `median` when it has a planted median. */
export type JourneyLandBoulevard = { id: string; lineId: string; points: Point2[]; median: boolean };
export type LoadJourneyLand = (signal?: AbortSignal) => Promise<JourneyLandData>;

/** A member home drawn at map scale on its plot (`buildHomeArt(layout, {detail: "map"})`). Only the viewer's own layout is on this device. */
export type JourneyHome = { memberId: string; plotId: string; layout: HomeLayout; provisional?: boolean };

export type BuildJourneyLandOptions = {
  theme: ThemeId;
  tier: "full" | "lite";
  homes: JourneyHome[];
  season?: "spring" | "summer" | "autumn" | "winter";
};

/** The three.js land (T2) the board layer (T3) stands on. */
export type JourneyLandHandle = {
  group: THREE.Group;
  data: JourneyLandData;
  /** Concept (x, y) → board space (engine x, compressed height, engine z). */
  worldToBoard(x: number, y: number, lift?: number): Point3;
  /** Compressed ground height at concept (x, y). */
  heightAt(x: number, y: number): number;
  /** Baked (uncompressed) ground height; for handing a place to Horizon only. */
  rawHeightAt(x: number, y: number): number;
  /** True when (x, y) is on land above sea level and outside water bodies (an Enter-Horizon candidate). */
  isLand(x: number, y: number): boolean;
  stationAt(id: StationId): Point3;
  setTheme(theme: ThemeId): void;
  /** Replace homes (a committed HomeBook edit, or a provisional crossroads preview). */
  setHomes(homes: JourneyHome[]): void;
  /** Triangles / draw calls this land adds, for the LOD budget test. */
  stats(): { triangles: number; drawCalls: number };
  dispose(): void;
};
export type BuildJourneyLand = (land: JourneyLandData, options: BuildJourneyLandOptions) => JourneyLandHandle;

/** The SVG twin's data (flat tier / no WebGL / reading edition): same land, same coordinates (viewBox in concept metres). */
export type JourneyLandFlatData = {
  viewBox: [number, number, number, number];
  coast: string;
  water: { id: string; kind: string; d: string }[];
  landforms: { id: string; d: string; band: "low" | "mid" | "high" }[];
  lines: { id: string; kind: LandLineKind; d: string }[];
  /** Road bridges: the deck's centreline and its true width (concept metres), drawn under the lines. */
  bridges?: { id: string; d: string; width: number; underIds?: string[]; landmark?: JourneyLandBridge['landmark'] }[];
  hosts: { id: string; x: number; y: number }[];
  reserves: { id: string; d: string }[];
  districts: { id: string; label: string; x: number; y: number }[];
  stations: { id: StationId; x: number; y: number }[];
};

// ---------------------------------------------------------------------------
// Board scene (T3) — mounted by the UI (T4)

/** A projected screen anchor for one DOM mark (the canvas is aria-hidden; marks are real buttons). */
export type MarkAnchor = { id: string; x: number; y: number; depth: number; visible: boolean; bridge?: JourneyLandBridge['landmark'] };

export type JourneyBoardSceneOptions = {
  land: JourneyLandHandle;
  board: JourneyBoard;
  route: RouteSpace;
  theme: ThemeId;
  tier: "full" | "lite";
  reducedMotion: boolean;
  /** Called once per rendered frame that moved something: ids = month spaces, day spaces, clusters, stops, crossroads, piece. */
  onAnchors(anchors: MarkAnchor[]): void;
  onTier(tier: CameraTier): void;
  /** A canvas pick (pointer): the id of the space/stop under it, or null. The UI decides what selecting means. */
  onPick(id: string | null): void;
  /** First frame drawn (App: journeyCloud.ready("to-journey")). */
  onReady(): void;
  /** WebGL context lost: the UI falls back to flat + list. */
  onLost(): void;
};
export type JourneyBoardSceneHandle = {
  setBoard(board: JourneyBoard, route: RouteSpace): void;
  setSelection(id: string | null): void;
  /** A crossroads alternative drawn provisionally (dashed, "preview" label), or null to return. */
  setPreview(preview: { crossroadsId: string; alternativeId: string } | null): void;
  /** Frame a tier on a concept point; animate is ignored under reduced motion (cut). */
  focus(target: { x: number; y: number } | { chapterId: ChapterId } | { date: DateKey } | "piece", tier: CameraTier, animate: boolean): void;
  /** Screen → concept ground point (for "Enter Horizon here"). Null over sea. */
  groundAt(screenX: number, screenY: number): { x: number; y: number } | null;
  setTheme(theme: ThemeId): void;
  resize(width: number, height: number): void;
  /**
   * Optional (added in the fix pass): stage px covered by chrome on each side (summary card, panel, sheet). Framing
   * centres its target in the uncovered rect and Sky fits the island inside it; the canvas stays full-bleed.
   */
  setSafeArea?(inset: { top: number; right: number; bottom: number; left: number }): void;
  sleep(): void;
  wake(): void;
  stats(): { triangles: number; drawCalls: number };
  dispose(): void;
};
export type CreateJourneyBoardScene = (host: HTMLElement, options: JourneyBoardSceneOptions) => JourneyBoardSceneHandle;

// ---------------------------------------------------------------------------
// Themes (one dressing per module; all three themes authored)

export const JOURNEY_THEMES: readonly ThemeId[] = ["classic", "taylor", "newfoundland"];
/** CSS colour strings ("#rrggbb"). */
export type JourneyLandDressing = {
  sea: string; shallows: string; sand: string; grass: string; forest: string; rock: string; snow: string;
  lake: string; river: string;
  road: string; skate: string; walk: string; cable: string; rail: string; ferry: string;
  hostWall: string; hostRoof: string; reserve: string; districtLabel: string; fog: string; sky: string;
};
export type JourneyBoardDressing = {
  ribbon: string; ribbonEdge: string;
  spacePast: string; spaceOpen: string; spaceUpcoming: string; spaceInset: string; stakes: string;
  signpost: string; selectionRing: string; provisional: string; pavilion: string; clusterBase: string;
  piece: Record<PieceLookId, { body: string; accent: string }>;
};
export type JourneyLandDressings = Record<ThemeId, JourneyLandDressing>;
export type JourneyBoardDressings = Record<ThemeId, JourneyBoardDressing>;

// ---------------------------------------------------------------------------
// Per-viewer view state (device-local; nothing financial)

export type JourneyViewState = {
  version: 1;
  tier: CameraTier;
  /** Null = "now" (follow today). */
  focusDate: DateKey | null;
  /** Camera target, concept metres; null = frame the focus. */
  target: { x: number; y: number } | null;
  selectedStopId: string | null;
  expandedClusterId: string | null;
  listMode: "map" | "list";
  pieceLook: PieceLookId;
  /** The last explicit "Enter Horizon here": restored when Horizon's "Journey" button returns (route object "harbour-return"). */
  lastEnter: { location: HorizonLocation; tier: CameraTier; focusDate: DateKey | null } | null;
};
export const DEFAULT_JOURNEY_VIEW_STATE: JourneyViewState = {
  version: 1, tier: "region", focusDate: null, target: null, selectedStopId: null, expandedClusterId: null,
  listMode: "map", pieceLook: DEFAULT_PIECE_LOOK, lastEnter: null,
};
export type JourneyViewIdentity = { environment: Environment; householdId: string; memberId: string };
/**
 * `hearth:journey-board:v1:<environment>:<householdId>:<memberId>` (encodeURIComponent per part, as
 * `houseIdentity`). Read/written only by src/journey/ui/viewState.ts, inside try/catch; a missing or invalid record is
 * DEFAULT_JOURNEY_VIEW_STATE. Household scope only (the board is Ours).
 */
export function journeyViewStateKey(identity: JourneyViewIdentity): string {
  return `hearth:journey-board:v1:${[identity.environment, identity.householdId, identity.memberId].map(encodeURIComponent).join(":")}`;
}

// ---------------------------------------------------------------------------
// The mounted component (T4 implements, T5 mounts)

export type JourneyBoardProps = {
  household: import("../core/types.ts").Household;
  memberId: string;
  environment: Environment;
  today: DateKey;
  theme: ThemeId;
  actions: JourneyBoardActions;
  /** The route's `time` (Horizon → Journey return anchor), when present. */
  focusDate?: DateKey;
  /** Route object "harbour-return": restore `lastEnter` instead of today's framing. */
  returningFromHorizon?: boolean;
  /** The App's supported-interpretation gate words ("Supported as of …"), shown when books are not current. */
  freshnessNote?: string | null;
  /** First frame drawn, or the flat board rendered (App: journeyCloud.ready("to-journey")). */
  onReady?: () => void;
  /**
   * The App's due reminders (`guard.kind === "duePreview"`): how many due repeating occurrences still wait for review,
   * or null. The UI puts "Repeating reminders · N to review" first in "Needs attention" (its action is
   * `openDueReview`); the model stays pure and never reads the App's reminder state.
   */
  dueReview?: { count: number } | null;
};
