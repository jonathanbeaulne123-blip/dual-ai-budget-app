/**
 * The Journey Map (Horizon Clock) — shared contracts. One writer: the integrator.
 *
 * Every lane (L1 model, L2 land, L3 board, L4 ui) builds against these types; a change goes through the integrator.
 * Read `src/journey/README.md`, `docs/DECISIONS.md` (D49–D67 the Journey Board, D68+ the Horizon Clock) and
 * `docs/CLAUDE_JOURNEY_CLOCK.md`. The route board these replaced (route, spaces, camera tiers, piece looks, the
 * summary card, the dressings, view state v1) was deleted with its code; only the v1 view-state key and its migration
 * remain, so a stored record still restores.
 *
 * Invariants (tests enforce them; every module under src/journey keeps them):
 *
 * 1. PRESENTATION ONLY. The board is derived on read from one Household
 *    snapshot + memberId + today (App's Toronto `today`). Nothing here posts,
 *    schedules, moves, sets aside or re-adds money; nothing computes a balance;
 *    nothing is stored except per-viewer view state (`JourneyViewStateV2`).
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
  /**
   * The "+" dial's "All tools" chip — opens the App's quick sheet of every tool (`setQuickSheetOpen(true)`). Opening it
   * records nothing. Optional so a host without the sheet can omit it; the dial hides the chip when absent.
   */
  openAllTools?(): void;
  /**
   * The "+" dial's "Simple view" chip — switches the device to the flat motion edition (`chooseMotionEdition("flat")`),
   * a per-device display preference. Never touches the books. Optional; the dial hides the chip when absent.
   */
  chooseSimpleView?(): void;
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
  | { name: "back" }
  | { name: "openAllTools" }
  | { name: "chooseSimpleView" };

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
    // Optional callbacks: a host that did not supply one does nothing (the dial hides that chip).
    case "openAllTools": actions.openAllTools?.(); return;
    case "chooseSimpleView": actions.chooseSimpleView?.(); return;
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

/**
 * The household's current place: today's period (drawn as the cat-eared bus; one look, ruling 9). Separate from the viewer's selection, from the camera and from any
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
};

export type AttentionItem = { id: string; words: string; stopId: string | null; call: ActionCall };

/** The Journey Map's board (model v2): derived on read, never stored. */
export type JourneyBoard = {
  version: 2;
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
  /** A new household: honest empty board (no invented achievements, no invented stops). */
  empty: boolean;
  /** Plain-language limits shown in the list's footer (e.g. "Bianca's home is private to her device"). */
  limitations: string[];
  /** This week, Monday to Sunday around today (rulings 7, 13). */
  week: JourneyWeek;
  /** One entry per chapter in `window`, in window order: the Year ring's minis. */
  year: YearChapter[];
  /** Every "to check" stop id (`isToCheck`), date order. The header chip and Hercules count exactly these. */
  toCheck: string[];
  /** The purse chip. */
  purse: Purse;
  /** Hercules's bubble and the checklist's sections. */
  digest: Digest;
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
  /** The stop's money direction (`MoneyDirection`); "none" for rows that are not money. */
  direction: MoneyDirection;
  /** True exactly when `isToCheck(stop)`; the row shows "!" and words, never colour alone. */
  toCheck: boolean;
};
export type BoardToList = (board: JourneyBoard) => ListRow[];

// ---------------------------------------------------------------------------
// Heights and LOD (numbers from MANIFEST journey.lod)

/**
 * View-only height compression (presentation, never the island): tall land and buildings must not hide the route.
 * Ground: h ≤ knee → h·below; above → knee·below + (h − knee)·above. Buildings: height·buildingScale on compressed ground.
 */
export const HEIGHT_COMPRESSION = { knee: 20, below: 0.5, above: 0.18, buildingScale: 0.5, routeLift: 1.2 } as const;
export function compressHeight(height: number): number {
  const { knee, below, above } = HEIGHT_COMPRESSION;
  return height <= knee ? height * below : knee * below + (height - knee) * above;
}

/** MANIFEST journey.lod [full, lite]: the map (clay land + bezel + props + homes) stays inside this budget. */
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

/** The clay land (L2) the map scene (L3) stands on. */
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
  /** Replace homes (a committed HomeBook edit). */
  setHomes(homes: JourneyHome[]): void;
  /** Where concept metres sit in the diorama: `dioramaFrame(land)` from this land's coastline (never constants). */
  frame: DioramaFrame;
  /**
   * The drawn clay surface's diorama y at concept (x, y) — what a prop, a house, the bus or Hercules stands on. Differs
   * from `toDiorama`'s height near the coast, where the clay eases to the slab.
   */
  dioramaGroundAt(x: number, y: number): number;
  /**
   * One low-poly copy of the clay island at diorama scale (centred on the frame, `islandUnits` radius), shared by the
   * Year ring's instanced minis (board/year.ts). The land owns and disposes it.
   */
  miniGeometry(): THREE.BufferGeometry;
  /**
   * Horizon Clock Week calm: soften, lower and thin the clay away from `calm.trail` (concept metres), keeping `clear`
   * discs free (the Week tiles and the pile), by `amount` 0…1; `null` restores the land as drawn. Presentation only.
   * The land caches the calm field per `calm` object identity, so the caller passes the SAME object for the whole
   * week and only changes `amount`; a recompute of the field costs a few tens of ms on the full tier.
   */
  setCalm?(calm: JourneyLandCalm | null, amount?: number): void;
  /** Triangles / draw calls this land adds, for the LOD budget test. */
  stats(): { triangles: number; drawCalls: number };
  dispose(): void;
};
export type BuildJourneyLand = (land: JourneyLandData, options: BuildJourneyLandOptions) => JourneyLandHandle;
/** What the Week passes to calm the land: the trail (concept metres) and discs to keep clear (tiles, the pile; metres). */
export type JourneyLandCalm = { trail: readonly Point2[]; clear?: readonly { x: number; y: number; r: number }[] };

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
// Marks (the canvas is aria-hidden; every mark is a DOM button)

/** A projected screen anchor for one DOM mark (the canvas is aria-hidden; marks are real buttons). */
export type MarkAnchor = { id: string; x: number; y: number; depth: number; visible: boolean; bridge?: JourneyLandBridge['landmark'] };

// ---------------------------------------------------------------------------
// Themes (all three authored: `JourneyClayPalettes`)

export const JOURNEY_THEMES: readonly ThemeId[] = ["classic", "taylor", "newfoundland"];
// ---------------------------------------------------------------------------
// Per-viewer view state (device-local; nothing financial): the identity; v2 lives with the Horizon Clock below

export type JourneyViewIdentity = { environment: Environment; householdId: string; memberId: string };
/**
 * The route board's old key, `hearth:journey-board:v1:<environment>:<householdId>:<memberId>`: read ONCE (by
 * ui/viewState.ts, inside try/catch) to migrate a stored record to v2; never written.
 */
export function journeyViewStateKeyV1(identity: JourneyViewIdentity): string {
  return `hearth:journey-board:v1:${[identity.environment, identity.householdId, identity.memberId].map(encodeURIComponent).join(":")}`;
}

// ---------------------------------------------------------------------------
// The mounted component (L4 implements, the App mounts)

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
  /**
   * The header's theme dot. Applies the APP-WIDE theme through the existing appearance store (`store.apply`, as the
   * appearance picker does; ruling 12), never a board-only preview. The UI hides the dot when absent.
   */
  onChooseTheme?: (theme: ThemeId) => void;
};

// ===========================================================================
// Horizon Clock — the Journey Map (v2)
//
// The approved prototype (`horizon-clock.html`) as contracts: a clay diorama of the real island inside a clock bezel
// of 31 day slots (Month), a ring of twelve minis (Year) and a Party Board trail along the Year Walk (Week), driven by
// one level pull `t` (0 Year → 1 Month → 2 Week).
//
// Money honesty, for every lane (tests enforce it):
// - A null amount draws NO stack and reads "Unknown amount". Unknown is never zero and never a guessed height.
// - Expected / estimated / scheduled money is never summed with recorded money: solid stacks are recorded,
//   see-through stacks are not, and every figure keeps its basis in words.
// - Fund contributions are their own figure ("To the Fund"), never summed into "In".
// - "To check" is ONE definition (`isToCheck`); a passed date never makes anything paid, and expected pay whose date
//   passed unrecorded is not "to check" (D60).
// - Status words come from model/words.ts only; the map and the list run the same `actions[]`.
// ===========================================================================

// ---------------------------------------------------------------------------
// Levels: one pull, three views

/** The three map levels. Year = twelve minis; Month = the clock (today's chapter by default); Week = the trail. */
export type JourneyLevel = "year" | "month" | "week";
/** The levels in pull order (Year → Month → Week), for the LevelPull and the Key. */
export const JOURNEY_LEVELS: readonly JourneyLevel[] = ["year", "month", "week"];
/**
 * The level pull's rest values. `t` is continuous in [0, 2] while pinching / wheeling / dragging the LevelPull; it
 * settles on one of these. Every pop and camera move is a function of `t` (board/levels.ts); under reduced motion
 * `t` jumps between rests (a cut).
 */
export const LEVEL_T = { year: 0, month: 1, week: 2 } as const satisfies Record<JourneyLevel, number>;
/** The level a pull value reads as (nearest rest; clamped to [0, 2]): t < 0.5 Year, t < 1.5 Month, else Week. */
export function levelForT(t: number): JourneyLevel {
  const v = Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : LEVEL_T.month;
  return v < 0.5 ? "year" : v < 1.5 ? "month" : "week";
}

// ---------------------------------------------------------------------------
// Money on the map: direction, coin stacks, "to check"

/**
 * Which way a stop's money goes. "in" = an income stop (pay, recorded income, a Fund contribution — drawn as a mint
 * in-stack, but summed only into "To the Fund", see `isFundStop`); "out" = a commitment (bill, planned cost);
 * "none" = everything else (reviews, plans, milestones, memories). A goal (basis `target`) is "none": a target is
 * not money moving, so it never gets a stack.
 */
export type MoneyDirection = "in" | "out" | "none";
/** L1's `directionOf(stop)` (model/money.ts). Pure; the board and the list both read it. */
export type DirectionOf = (stop: Stop) => MoneyDirection;

/**
 * How a coin stack is drawn. "solid" = recorded (a commitment with status "paid", an income stop "confirmed");
 * "see-through" = not recorded (scheduled, expected, estimate, overdue, needs-review). A see-through stack is never
 * drawn on top of, or added to, a solid one as if it were the same money.
 */
export type StackFill = "solid" | "see-through";

/**
 * One ruler per level (ruling 6): Month and Week draw a ring every $100.00, Year a ring every $1,000.00. A stack
 * caps at `maxRings` with a visible break mark; the amount is always printed beside it, so a capped stack never
 * hides the figure.
 */
export const STACK_RULER = {
  month: { centsPerRing: 10_000 },
  week: { centsPerRing: 10_000 },
  year: { centsPerRing: 100_000 },
  maxRings: 30,
} as const satisfies Record<JourneyLevel, { centsPerRing: number }> & { maxRings: number };

/**
 * A stack's height in rings. `rings` is exact (fractional: $142.00 at Month = 1.42 rings); `drawnRings` is what the
 * geometry draws (≤ `STACK_RULER.maxRings`); `capped` = the break mark shows. A known $0.00 is `rings: 0` (the board
 * draws one flat coin at most); it is never confused with unknown, which has no stack at all.
 */
export type StackRings = { rings: number; drawnRings: number; capped: boolean };
/**
 * Rings for an amount at a level. Null / undefined / non-finite cents → null: NO stack (unknown is never zero, never a
 * guessed height). Callers pass only stops whose direction is "in" or "out".
 */
export function ringsFor(cents: number | null | undefined, level: JourneyLevel): StackRings | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
  const rings = Math.abs(cents) / STACK_RULER[level].centsPerRing;
  return { rings, drawnRings: Math.min(rings, STACK_RULER.maxRings), capped: rings > STACK_RULER.maxRings };
}

/**
 * THE definition of "to check" (ruling 1): a commitment whose date has passed and that is not recorded as paid
 * (status overdue or needs-review). The header chip, Hercules, the honey "!" ring, the Week pile, the Year counts
 * and the list's "Needs you" all count exactly these. Upcoming items (a standing jar) never count; expected income
 * whose date passed unrecorded is not "to check" (ruling 2, D60).
 */
export function isToCheck(stop: Stop): boolean {
  return stop.kind === "commitment" && stop.relation === "past" && stop.status !== "paid";
}

/**
 * A Fund contribution (expected estimate or confirmed). Drawn as an in-stack, but its money is ONLY ever summed into
 * "To the Fund" — never into "In" (ruling 4).
 */
export function isFundStop(stop: Stop): boolean {
  return stop.kind === "income" && (stop.origin === "fund-estimate" || stop.origin === "fund-confirmed");
}

// ---------------------------------------------------------------------------
// Week, Year, purse, digest (L1 derives them; pure)

/**
 * How big a Week tile is. "today" = today's tile (largest, the bus stands on it); "money" = a day with at least one
 * in/out stop (a full tile with props on coin stacks); "stone" = a day with no money stops (a thin stepping stone,
 * still a real, selectable day).
 */
export type WeekDaySize = "today" | "money" | "stone";
/** One day of the Week trail. `stopIds` = every stop on that date, in the board's stop order. */
export type WeekDay = {
  date: DateKey;
  relation: "past" | "today" | "future";
  stopIds: string[];
  size: WeekDaySize;
};
/**
 * This week (rulings 7, 13): Monday `from` to Sunday `to` around today, seven `days`, today highlighted within it.
 * `pileStopIds` = the "to check" stops dated BEFORE `from`, pinned as one overdue pile on the first tile (a "to check"
 * stop inside the week stays on its own day with the "!" ring, so nothing is shown twice). Pinned is not paid.
 */
export type JourneyWeek = { from: DateKey; to: DateKey; days: WeekDay[]; pileStopIds: string[] };

/**
 * One Year mini (one per chapter in the window). Year stacks are COMMITMENTS AND INCOME ON THE MAP only (ruling 5),
 * legend "bills and planned costs on the map, not all spending" — never the Books' total spending.
 * - `out*` = commitments: `outRecordedCents` paid (solid), `outOpenCents` not recorded (see-through).
 * - `in*` = income stops EXCLUDING Fund contributions (`isFundStop`): confirmed (solid) / expected (see-through).
 * - Unknown amounts add nothing to any figure (they are counted in `unknownAmounts`, never as 0).
 * - Recorded and open are separate figures; nothing sums them.
 * `toCheck` = how many of this chapter's stops `isToCheck`. `kept` = a Chapter record exists for the month and is closed.
 */
export type YearChapter = {
  chapterId: ChapterId;
  outRecordedCents: number;
  outOpenCents: number;
  inRecordedCents: number;
  inOpenCents: number;
  /** Money stops in this chapter whose amount is unknown: listed, never summed, never drawn as a stack. */
  unknownAmounts: number;
  toCheck: number;
  kept: boolean;
};

/** One line of the purse's "expected today": an expected income stop dated today. Never added to `everyday`. */
export type PurseExpected = { stopId: string; label: string; amountCents: number | null };
/**
 * The purse chip: "Everyday · now" (campCardModel's
 * `readSnapshot(...).now`; null when the Fund cannot say) and, separately, today's expected pay. The UI prints them
 * apart ("expected pay isn't counted until it's in"); NOTHING sums `everyday` and `expectedToday`.
 */
export type Purse = {
  everyday: { cents: number | null; figure: string } | null;
  expectedToday: PurseExpected[];
};

/**
 * What Hercules says and what the checklist sheet opens with (ruling 1; nothing that used to be visible disappears):
 * - `weekStopIds` = this week's unresolved stops (not recorded), date order — the bubble's "This week" section.
 * - `nextLeavingStopId` = the next unrecorded commitment from today on (the Week tile with the honey "›"), or null.
 * - `toCheckIds` = `board.toCheck` (the "To check" section; the chip's count).
 * - `waitingOnYou` = readNeeds items waiting on this viewer (e.g. a contribution to confirm).
 * - `chapter` = the close-due Chapter item(s) (`chapterCloseDue`), opening the Campfire.
 * The App's repeating reminders (`JourneyBoardProps.dueReview`) are a fourth, separate section with their own count.
 */
export type Digest = {
  weekStopIds: string[];
  nextLeavingStopId: string | null;
  toCheckIds: string[];
  waitingOnYou: AttentionItem[];
  chapter: AttentionItem[];
};

// ---------------------------------------------------------------------------
// List view (the Map/List toggle): same data, same actions

/** What the list shows: the level and chapter the map is on. Week = the board's `week`. */
export type ListScope =
  | { level: "year" }
  | { level: "month"; chapterId: ChapterId }
  | { level: "week" };

/**
 * The list's summary strip for its scope (ruling 3). Each figure is separate; none is a balance and none is summed
 * with another.
 * - `inBooksCents` / `outBooksCents` = Books actuals for the scope's dates via the existing pure selector
 *   (core/budget.ts `monthSummary`), labelled "in the Books" — recorded money only.
 * - `toFundCents` = recorded Fund contributions in the scope (ruling 4): never part of `inBooksCents`.
 * - `stillToComeOutCents` / `stillToComeInCents` = unrecorded scheduled stops from today on (commitments / non-Fund
 *   income with basis "scheduled"); `stillToComeEstimateCents` = basis "estimate" stops from today on, printed
 *   separately as an estimate; `stillToComeUnknown` = how many unrecorded stops have no known amount (never 0 cents).
 * - `needsYou` = how many stops in the scope `isToCheck`.
 */
export type ListStrip = {
  inBooksCents: number;
  outBooksCents: number;
  toFundCents: number;
  stillToComeOutCents: number;
  stillToComeInCents: number;
  stillToComeEstimateCents: number;
  stillToComeUnknown: number;
  needsYou: number;
};

/**
 * A group of rows. "needs-you" = the scope's "to check" rows first, each with its date; "day" = one date (Week lists
 * all seven, an empty day with `emptyText`); "chapter" = one month (Year scope); "undated" = kept memories with no date.
 * `label` is words from model/words.ts ("Today · Mon 28 Sep", "Needs you · 5").
 */
export type ListGroup = {
  id: string;
  kind: "needs-you" | "day" | "chapter" | "undated";
  date: DateKey | null;
  label: string;
  today: boolean;
  rows: ListRow[];
  /** "Nothing on this day." when `rows` is empty; null otherwise. */
  emptyText: string | null;
};
/** The readable list for one scope. Rows carry each stop's own `actions` (the map's), `direction` and `toCheck`. */
export type ListView = {
  scope: ListScope;
  /** "September 2026", "This week · Mon 28 Sep – Sun 4 Oct", "October 2025 – September 2026". */
  title: string;
  /** Null when the scope has no stops (an honest empty month says so in `emptyText`). */
  strip: ListStrip | null;
  groups: ListGroup[];
  emptyText: string | null;
  /** `board.limitations`, shown in the footer. */
  limitations: string[];
};
/** L1's `listView()` (model/list.ts). Pure; the household is read only through existing pure selectors. */
export type ListViewOf = (household: import("../core/types.ts").Household, board: JourneyBoard, scope: ListScope) => ListView;

// ---------------------------------------------------------------------------
// The diorama: concept metres ↔ clay units

/**
 * The diorama's fixed proportions (from the approved prototype). Everything is in DIORAMA UNITS (du): the island's
 * coast fits a circle of `islandUnits` du; the bezel ring runs `bezel.inner`…`bezel.outer` du with its road at
 * `bezel.road`; `slots` day slots (day 1 at north, clockwise). Heights: the slab top is `slab.top`, the sea `slab.sea`;
 * land rises `toyLift` du per compressed metre (`compressHeight`). Camera: `fovDeg` lens at `elevationDeg` above the
 * horizon. These are proportions, never island coordinates: WHERE the island is comes only from `DioramaFrame`.
 */
export const JOURNEY_DIORAMA = {
  fovDeg: 30,
  elevationDeg: 50,
  islandUnits: 4.0,
  bezel: { inner: 4.3, outer: 5.0, road: 4.62 },
  slots: 31,
  toyLift: 0.034,
  slab: { top: 0.372, sea: 0.296 },
} as const;

/**
 * Where concept metres sit in the diorama, computed by L2's `dioramaFrame(land)` from `JourneyLandData.coastline`
 * (never constants; test/journey-map-geometry-source.test.ts moves the coast and expects the frame to follow).
 * `centre` = concept (x, y) metres at the diorama origin; `radius` = the coast's enclosing radius from `centre`
 * (metres); `scale` = du per metre (`JOURNEY_DIORAMA.islandUnits / radius`).
 */
export type DioramaFrame = { centre: Point2; radius: number; scale: number };
/** L2's frame builder (land/diorama.ts). */
export type DioramaFrameOf = (land: JourneyLandData) => DioramaFrame;

/**
 * Concept (x, y) metres (+ baked height in metres) → diorama (x, y, z) du. x/z are a pure scale about `centre`
 * (concept y = south = diorama +z); height is view-only: `slab.top + compressHeight(max(0, h)) · toyLift`. The clay
 * surface eases this to the slab near the coast (`JourneyLandHandle.dioramaGroundAt`); use that for what stands on land.
 */
export function toDiorama(frame: DioramaFrame, x: number, y: number, height = 0): Point3 {
  return [
    (x - frame.centre[0]) * frame.scale,
    JOURNEY_DIORAMA.slab.top + compressHeight(Math.max(0, height)) * JOURNEY_DIORAMA.toyLift,
    (y - frame.centre[1]) * frame.scale,
  ];
}
/**
 * Diorama (x, z) du → concept (x, y) metres: the exact inverse of `toDiorama`'s plan mapping. "Enter Horizon here"
 * hands this point to Horizon unchanged (Horizon grounds it), so a place on the map is the same place in the world.
 */
export function fromDiorama(frame: DioramaFrame, dx: number, dz: number): { x: number; y: number } {
  return { x: dx / frame.scale + frame.centre[0], y: dz / frame.scale + frame.centre[1] };
}

// ---------------------------------------------------------------------------
// Clay palettes (L2 authors the values in land/clayPalette.ts; all three themes)

/**
 * One theme's clay colours (CSS "#rrggbb"), keyed exactly as the prototype's palettes. Land and board both read it.
 * Tile colours (`t*`) carry meaning only together with words and the "!" / "›" marks — never colour alone.
 */
export type JourneyClayPalette = {
  // the plinth and the land
  plinth: string; plinth2: string;
  /** Newfoundland's plinth is clapboard (painted boards texture); the others are plain clay. */
  plinthFinish: "plain" | "clapboard";
  sand: string; grass: string; grass2: string; hill: string; rock: string; snow: string; water: string; shallow: string;
  // the bezel ring and roads
  road: string; roadPast: string; roadFuture: string; stud: string; gate: string;
  // houses, trees
  wall: string; roof1: string; roof2: string; roof3: string; homeRoof: string; trunk: string; leaf: string; leaf2: string;
  // the cat-eared bus, ink, attention
  bus: string; busEar: string; glass: string; ink: string; honey: string;
  // light
  light: string; hemiSky: string; hemiGround: string;
  // Week Party Board tiles: in, out, standing jar, to check, today's base, empty day, pedestal, the trail lane
  tin: string; tout: string; tjar: string; tcheck: string; tbase: string; tempty: string; ped: string; lane: string;
};
/** All three authored themes (classic / taylor / newfoundland); none is optional. */
export type JourneyClayPalettes = Record<ThemeId, JourneyClayPalette>;
/** Prop colours shared by every theme (the prototype's PROPC): coins, mint income coins, and the props' materials. */
export type JourneyPropPalette = {
  coin: string; coinEdge: string; mint: string; mintEdge: string; jarGlass: string; jarLid: string; phone: string; screen: string;
  white: string; cross: string; flame: string; flame2: string; metal: string; disc: string; discLabel: string; umbrella: string;
  bulb: string; pot: string; porcelain: string; basket: string; leafy: string; tan: string; furWhite: string; nose: string;
  earIn: string; eye: string; tooth: string; snowflake: string;
};

// ---------------------------------------------------------------------------
// The map scene (L3 implements on the rendererOwner lease; L4 mounts)

/**
 * Mark ids the map projects (the canvas is aria-hidden; each is a real 44 px DOM button): stop ids, day dates
 * ("2026-09-28", a clock slot or a Week tile), chapter ids ("2026-09", a Year mini), plus these fixed ids.
 * `boardMarks` ids are kept.
 */
export const JOURNEY_MAP_MARKS = { piece: "piece", hercules: "hercules", pile: "pile" } as const;

/**
 * What the map scene is built from (L3 `createJourneyMapScene`). The scene draws only `board` (a v2 board) on `land`;
 * it never reads the household, never computes money, and every stack height comes from `ringsFor`.
 */
export type JourneyMapSceneOptions = {
  land: JourneyLandHandle;
  board: JourneyBoard;
  theme: ThemeId;
  /** "full" = real shadows; "lite" = blob shadows (phones). The flat tier never mounts a scene. */
  tier: "full" | "lite";
  reducedMotion: boolean;
  /** The pull value to open at (`LEVEL_T[level]`). */
  t: number;
  /** The chapter the Month clock shows (default the board's `currentChapterId`). */
  chapterId: ChapterId;
  /** Per frame that moved something: one anchor per visible mark (`JOURNEY_MAP_MARKS`, stop ids, dates, chapter ids). */
  onAnchors(anchors: MarkAnchor[]): void;
  /**
   * A canvas pick: every stop id under the pointer (a slot or tile holding several stops returns them all; the UI shows
   * "Which one?" for more than one), a chapter id for a Year mini, a date for an empty day, or [] for nothing.
   * The UI decides what selecting means; picking never acts.
   */
  onPick(ids: string[]): void;
  /** The pull moved from the canvas (pinch / wheel): the continuous `t` and the level it reads as. */
  onLevel(t: number, level: JourneyLevel): void;
  /** First frame drawn (App: journeyCloud.ready("to-journey")). Called once. */
  onReady(): void;
  /** WebGL context lost: the UI falls back to the flat clock / trail + list. */
  onLost(): void;
};
/** The mounted map scene. Every method is presentation: none posts, records, closes or grants anything. */
export type JourneyMapSceneHandle = {
  setBoard(board: JourneyBoard): void;
  /** Drive the pull to `t` (clamped [0, 2]); `animate` is ignored under reduced motion (a cut). */
  setLevel(t: number, animate: boolean): void;
  /** Turn the clock to a chapter; `direction` −1 = back a month, 1 = forward, 0 = jump. Reduced motion cuts. */
  setChapter(chapterId: ChapterId, direction: -1 | 0 | 1, animate: boolean): void;
  setSelection(id: string | null): void;
  setTheme(theme: ThemeId): void;
  resize(width: number, height: number): void;
  /** Stage px covered by chrome (header, sheets, dock); framing fits inside the uncovered rect, the canvas stays full-bleed. */
  setSafeArea(inset: { top: number; right: number; bottom: number; left: number }): void;
  /** Screen → concept ground metres (via `fromDiorama`), for "Enter Horizon here". Null over sea, the bezel or the plinth. */
  groundAt(screenX: number, screenY: number): { x: number; y: number } | null;
  sleep(): void;
  wake(): void;
  stats(): { triangles: number; drawCalls: number };
  dispose(): void;
};
/** L3's entry point (board/scene.ts), on the shared `rendererOwner` lease. */
export type CreateJourneyMapScene = (host: HTMLElement, options: JourneyMapSceneOptions) => JourneyMapSceneHandle;

// ---------------------------------------------------------------------------
// Per-viewer view state v2 (device-local; nothing financial)

/**
 * The Horizon Clock's view state. `level` replaces the camera tier; `focusDate` null = "now" (the chapter is
 * `focusDate`'s month, else today's); no camera target, no expanded cluster, no piece look (the bus only).
 */
export type JourneyViewStateV2 = {
  version: 2;
  level: JourneyLevel;
  focusDate: DateKey | null;
  selectedStopId: string | null;
  listMode: "map" | "list";
  /** The last explicit "Enter Horizon here": restored when Horizon's "Journey" button returns (route object "harbour-return"). */
  lastEnter: { location: HorizonLocation; level: JourneyLevel; focusDate: DateKey | null } | null;
};
/** A missing or invalid v2 record (and no v1 record to migrate): Month, following today, map mode. */
export const DEFAULT_JOURNEY_VIEW_STATE_V2: JourneyViewStateV2 = {
  version: 2, level: "month", focusDate: null, selectedStopId: null, listMode: "map", lastEnter: null,
};
/**
 * `hearth:journey-board:v2:<environment>:<householdId>:<memberId>` (encodeURIComponent per part). Read/written only by
 * ui/viewState.ts inside try/catch; when it is missing, the v1 key is read once and migrated.
 */
export function journeyViewStateKeyV2(identity: JourneyViewIdentity): string {
  return `hearth:journey-board:v2:${[identity.environment, identity.householdId, identity.memberId].map(encodeURIComponent).join(":")}`;
}
/** The route board's camera tiers, as a stored v1 record names them (migration only). */
export type JourneyViewTierV1 = "sky" | "region" | "stop";
/** A stored v1 record's fields that survive (the route board's camera target, expanded cluster and piece look do not). */
export type JourneyViewStateV1 = {
  version: 1;
  tier: JourneyViewTierV1;
  focusDate: DateKey | null;
  selectedStopId: string | null;
  listMode: "map" | "list";
  lastEnter: { location: HorizonLocation; tier: JourneyViewTierV1; focusDate: DateKey | null } | null;
};
/** v1 tier → v2 level: sky → year, region → month, stop → week. */
export const JOURNEY_VIEW_TIER_TO_LEVEL: Readonly<Record<JourneyViewTierV1, JourneyLevel>> = { sky: "year", region: "month", stop: "week" };
/** A valid v1 record as v2. Pure. */
export function migrateJourneyViewState(v1: JourneyViewStateV1): JourneyViewStateV2 {
  return {
    version: 2,
    level: JOURNEY_VIEW_TIER_TO_LEVEL[v1.tier] ?? "month",
    focusDate: v1.focusDate,
    selectedStopId: v1.selectedStopId,
    listMode: v1.listMode,
    lastEnter: v1.lastEnter
      ? { location: v1.lastEnter.location, level: JOURNEY_VIEW_TIER_TO_LEVEL[v1.lastEnter.tier] ?? "week", focusDate: v1.lastEnter.focusDate }
      : null,
  };
}
