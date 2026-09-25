/**
 * The Desk's Today page, read (SIMPLE_VIEW_DESK S2). Pure functions over
 * shipped core selectors only — nothing here posts, writes or moves money,
 * and nothing here computes a balance of its own:
 *
 * - the four pots: `fundSnapshot(h, { memberId, view, today })` (`now` leads);
 * - the three wax seals: `deskMonthSeals` over `monthSummary`, read from the
 *   same presentation-scoped household the Office's `buildDashboard` reads
 *   (`projectLedgerExperience(...).scopedHousehold`), so the Desk's seals and
 *   the Office's seals are one figure;
 * - the Level and the sundial: `fundWalk` and `nextOut` over it;
 * - the Hercules corner: the top of `discoverySelection` (which ranks
 *   `discoveryCandidates` and honours "Not now" / "Don't suggest this");
 * - the dog-ear: the Campfire's own "a fire with an empty seat" (S7).
 *
 * Unknown amounts stay `null` and read "—" downstream.
 */
import { calendarDaysBetween, formatMonthLabel, monthKeyFromDateKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { monthSummary } from "../../core/budget.ts";
import { chapterMonth, chapterReminder, openChapterFor, pendingChapterClosure } from "../../core/chapters.ts";
import { fundSnapshot, type FundSnapshot } from "../../core/fundModel.ts";
import { fundWalk, type FundWalk } from "../../core/fundWalk.ts";
import type { HerculesCapabilityId } from "../../core/herculesCapabilities.ts";
import { discoverySelection, type DiscoveryCandidate } from "../../core/herculesDiscovery.ts";
import { projectLedgerExperience } from "../../core/ledgerExperience.ts";
import { nextOut, type NextOutRow } from "../../core/nextOut.ts";
import { deskMonthSeals, type DeskMonthSeals } from "../../core/officeWide.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import type { HarbourReading } from "../data/reading.ts";
import { shortDate } from "../nav/doorSigns.ts";

export type DeskPotId = "everyday" | "prepare" | "protect" | "build";

export type DeskPot = {
  id: DeskPotId;
  name: string;
  /** Null is unknown, never zero. */
  cents: number | null;
  /** Null where a pot has no target to read against (Everyday). */
  targetCents: number | null;
  /** The door this pot opens. */
  target: string;
  object?: string;
  /** One plain line under the figure. */
  line: string;
};

export type DeskPots = { everyday: DeskPot; prepare: DeskPot; protect: DeskPot; build: DeskPot };

/** "2026-09-18" → "Sep 18"; the door signs' own short date. */
const short = shortDate;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The four pots, Everyday first. Targets of zero read as "none agreed yet", never "of $0". */
export function deskPots(snapshot: Pick<FundSnapshot, "now" | "prepare" | "protect" | "build">, engrave: (cents: number | null) => string): DeskPots {
  const prepare = snapshot.prepare;
  const prepareLine = prepare.shortOn
    ? `Short ${engrave(prepare.shortOn.shortCents)} for ${prepare.shortOn.label} on ${short(prepare.shortOn.date)}`
    : prepare.coveredThrough
      ? `Bills covered through ${short(prepare.coveredThrough)}`
      : prepare.targetCents > 0 ? `of ${engrave(prepare.targetCents)} for this month’s bills` : "No bills set aside for yet";
  const protect = snapshot.protect;
  const protectLine = protect.targetCents > 0 ? `of a ${engrave(protect.targetCents)} buffer` : "No buffer agreed yet";
  const build = snapshot.build;
  const goals = count(build.goals.length, "goal", "goals");
  const buildLine = build.targetCents > 0 ? `of ${engrave(build.targetCents)} · ${goals}` : goals;
  return {
    everyday: { id: "everyday", name: "Everyday", cents: snapshot.now, targetCents: null, target: "queen", line: "Left for everyday, now" },
    prepare: { id: "prepare", name: "Prepare", cents: prepare.amountCents, targetCents: prepare.targetCents, target: "cellar-bills", line: prepareLine },
    protect: { id: "protect", name: "Protect", cents: protect.amountCents, targetCents: protect.targetCents, target: "loft-banks", object: "bank/plan:protect", line: protectLine },
    build: { id: "build", name: "Build", cents: build.amountCents, targetCents: build.targetCents, target: "loft-banks", line: buildLine },
  };
}

export function readSnapshot(household: Household, memberId: string, scope: LedgerView, today: DateKey): FundSnapshot | null {
  try { return fundSnapshot(household, { memberId, view: scope, today }); } catch { return null; }
}

export type DeskSeals = { seals: DeskMonthSeals | null; monthLabel: string };

/**
 * The three wax seals. `deskMonthSeals` takes a `MonthSummary`; the Office
 * gets that from `buildDashboard(scopedHousehold, today).month`, which is
 * `monthSummary(scopedHousehold, monthKey)` plus pulses, the board and tips
 * the Desk would throw away. So the Desk asks for the same scoped household
 * and the same `monthSummary` directly — one figure, about a third of the cost.
 * A member who is not in the household reads "—" on every seal.
 */
export function readSeals(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskSeals {
  const monthKey = monthKeyFromDateKey(today);
  const monthLabel = formatMonthLabel(monthKey).replace(/\s\d{4}$/, "");
  try {
    const experience = projectLedgerExperience(household, memberId, scope, today);
    if (!experience.ok) return { seals: null, monthLabel };
    return { seals: deskMonthSeals(monthSummary(experience.scopedHousehold, monthKey)), monthLabel };
  } catch {
    return { seals: null, monthLabel };
  }
}

/** The shared Fund's walk of the month. Personal scope has no Fund; a household without one has no walk. */
export function readWalk(household: Household, scope: LedgerView, today: DateKey): FundWalk | null {
  if (scope !== "household" || !household.householdFund) return null;
  try { return fundWalk(household, monthKeyFromDateKey(today), today); } catch { return null; }
}

export type DeskNext = NextOutRow & { daysAhead: number };

/** The sundial: the next thing the walk still has to pay — `nextOut`'s headline row. */
export function readNext(walk: FundWalk | null, today: DateKey): DeskNext | null {
  if (!walk) return null;
  const row = nextOut(walk).rows[0];
  return row ? { ...row, daysAhead: Math.max(0, calendarDaysBetween(today, row.date)) } : null;
}

/**
 * Where each Hercules suggestion's source lives, as a house door. Typed on
 * every capability, so a new one without a door is a type error, not a dead
 * button. `hercules` means the suggestion is a conversation, so the corner
 * offers only the Talk button.
 */
export const DISCOVERY_DOORS: Readonly<Record<HerculesCapabilityId, { target: string; words: string }>> = Object.freeze({
  "review-bill": { target: "cellar-bills", words: "Read the bill jars" },
  "bills-before-payday": { target: "cellar-bills", words: "Read the bill jars" },
  "explain-fund": { target: "cellar-bills", words: "Read the bill jars" },
  "review-claim": { target: "books", words: "Open the books" },
  "explain-account": { target: "books", words: "Open the books" },
  "explain-spending": { target: "books", words: "Open the books" },
  "compare-periods": { target: "books", words: "Open the books" },
  "review-plan": { target: "plan-studio", words: "Sit down at the Plan Studio" },
  "review-goal": { target: "loft-banks", words: "Open Kitty Banks" },
  "review-health": { target: "more", words: "Open Health in the Status Centre" },
  "dress-hercules": { target: "wardrobe", words: "Open his wardrobe" },
  "resume-shift": { target: "hercules", words: "Ask Hercules" },
  "explain-page": { target: "hercules", words: "Ask Hercules" },
  "guide-entry": { target: "hercules", words: "Ask Hercules" },
});

export type DeskHercules = { candidate: DiscoveryCandidate; target: string; words: string };

/** The top card Hercules would put first on the Home page, and the door to its source. */
export function readHercules(household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskHercules | null {
  try {
    const candidate = discoverySelection({ household, memberId, view: scope, tab: "home", today }).now[0];
    if (!candidate) return null;
    const door = DISCOVERY_DOORS[candidate.capabilityId] ?? { target: "hercules", words: "Ask Hercules" };
    return { candidate, ...door };
  } catch {
    return null;
  }
}

/**
 * The dog-ear (S7): Today's corner folds down while the month's Sitdown is
 * waiting. The same condition the Campfire raises its nudge on
 * (`data/attention.ts`): the open Chapter has run past its month and no
 * Sitdown has closed it (`overdue`, `chapterReminder`), or a close is on the
 * table and this reader has not yet agreed (`proposed`). Nothing closes on its
 * own; the fold points at the Plan Studio, where the Campfire's own door goes.
 * Household only: a Chapter is the couple's.
 */
export type DeskSitdown = { why: "overdue" | "proposed"; month: string | null; words: string };

export function readSitdown(reading: HarbourReading | null, household: Household, memberId: string, scope: LedgerView, today: DateKey): DeskSitdown | null {
  if (scope !== "household") return null;
  let monthKey: MonthKey | null;
  let overdue: boolean;
  let proposed: boolean;
  if (reading?.campfire) {
    monthKey = reading.campfire.month;
    overdue = reading.campfire.overdue;
    proposed = reading.campfire.close === "proposed";
  } else {
    try {
      const open = openChapterFor(household);
      const pending = open ? pendingChapterClosure(open) : null;
      monthKey = open ? chapterMonth(open) : null;
      overdue = chapterReminder(household, { today }) !== null;
      proposed = Boolean(pending && !pending.approvals.some(row => row.memberId === memberId));
    } catch { return null; }
  }
  if (!overdue && !proposed) return null;
  const month = monthKey ? formatMonthLabel(monthKey).replace(/\s\d{4}$/, "") : null;
  return proposed
    ? { why: "proposed", month, words: `A close is on the table${month ? ` for ${month}` : ""} and your seat at the Sitdown is empty` }
    : { why: "overdue", month, words: `${month ? `${month}’s Chapter` : "The Chapter"} is still open past its month; the Sitdown is waiting` };
}

/**
 * The post (S8): the last two things harvested from the Court's retired
 * reading edition (`CourtFlat`), read straight off the harbour's own reading
 * so the Desk and the Court's mailbox say the same words.
 *
 * - `notice` is `HarbourReading.noticed` — the mailbox's one fact and one next
 *   step (`noticedItem`: a Fund pulse need outranks Hercules's `bubbleNotice`),
 *   with the door the Court's mailbox opens (`noticed.target`).
 * - `slip` is `HarbourReading.slip` — "since you were here", the household's
 *   `presenceLines` (at most three), tidied the way the Court's slip plate
 *   tidies them (whitespace folded, blanks dropped).
 *
 * Both need the harbour's reading (the notice carries the sync freshness only
 * the App knows), so a Desk handed no reading — the personal Desk, or the
 * frame before the books answer — has no post, and nothing is guessed.
 * Household only: the mailbox and the slip are the couple's.
 */
export type DeskNotice = NonNullable<HarbourReading["noticed"]>;
export type DeskPost = { notice: DeskNotice | null; slip: string[] };

export const DESK_SLIP_LINES = 3;

export function readPost(reading: HarbourReading | null, scope: LedgerView): DeskPost | null {
  if (scope !== "household" || !reading) return null;
  const noticed = reading.noticed;
  const notice = noticed && noticed.fact.trim() ? noticed : null;
  const slip = (Array.isArray(reading.slip) ? reading.slip : [])
    .map(line => String(line).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, DESK_SLIP_LINES);
  return notice || slip.length > 0 ? { notice, slip } : null;
}
