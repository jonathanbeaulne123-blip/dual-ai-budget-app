/**
 * The camp card, read (Tool Atlas §3.5, §4.1 "The card is three lines").
 * Pure over the Desk's own read models — the same `todayModel` and
 * `personalModel` the Desk's Today page has always read — plus the day
 * ledger for "Leaving next", so the card, the strip and the Desk can never
 * say two things:
 *
 * - line 1: Everyday · now (`fundSnapshot.now` via `readSnapshot`), or in
 *   Mine "On the clock" (the personal `clock` plate);
 * - line 2: Leaving next — the day ledger's first slip from today on, and how
 *   many more fall in the next seven days;
 * - line 3, by priority: Needs you (`presenceLines` waiting on me, the
 *   Campfire's own `readSitdown`, a Fund pulse notice) → Since you were here
 *   (the partner's purchases recorded after this viewer's last visit, then
 *   the partner's plan agreements) → the first-visit line → a quiet line;
 * - the full card: the pots (`deskPots`), the seals (`readSeals` /
 *   `readPersonalToday`), the Level's walk (`readWalk`), Hercules's line
 *   (`readHercules`, or "Shift tonight?" for a member with a job and no shift
 *   recorded today), and in Mine the six personal plates and the shift streak.
 *
 * Nothing here posts, writes or moves money, and nothing computes a balance.
 */
import { formatMonthLabel, monthKeyFromDateKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import type { DeskPlateModel } from "../../core/deskPlates.ts";
import { presenceLines } from "../../core/fundPulse.ts";
import type { FundWalk } from "../../core/fundWalk.ts";
import { projectLedgerExperience } from "../../core/ledgerExperience.ts";
import { formatCad } from "../../core/money.ts";
import { shiftPostingStreak, type ShiftStreak } from "../../core/shiftStreak.ts";
import type { Household } from "../../core/types.ts";
import type { HarbourReading } from "../data/reading.ts";
import { engravedCents } from "../desk/engraved.ts";
import { PERSONAL_LEVEL_PLATE, readPersonalToday } from "../desk/personalModel.ts";
import { deskPots, readHercules, readSeals, readSitdown, readSnapshot, readWalk, type DeskHercules, type DeskPots, type DeskSeals, type DeskSitdown } from "../desk/todayModel.ts";
import { WORDS, monthWord, shortDay } from "./copy.ts";
import { leavingNext, viewForSpace, type DayLedger, type LedgerSpace, type LeavingNext } from "./dayLedger.ts";

/** Where a line goes: an ordinary house target (`openHouseObject(target, object)`). */
export type CardDoor = { target: string; object?: string };

export type NeedsItem = { id: string; words: string; door: CardDoor; source: "presence" | "sitdown" | "pulse" };

export type CardLine3 =
  | { kind: "needs"; words: string; items: NeedsItem[]; door: CardDoor; sitdown: DeskSitdown | null }
  | { kind: "since"; words: string; door: CardDoor }
  | { kind: "first-visit"; words: string }
  | { kind: "quiet"; words: string };

export type HerculesLine =
  | { kind: "record-shift"; words: string }
  | { kind: "door"; title: string; why: string; hercules: DeskHercules }
  | { kind: "quiet"; words: string };

export type CardLeaving = { next: LeavingNext | null; words: string };

export type OursFull = { space: "ours"; pots: DeskPots; seals: DeskSeals; walk: FundWalk | null };
export type MineFull = { space: "mine"; plates: DeskPlateModel[]; level: DeskPlateModel | null; seals: DeskSeals; streak: ShiftStreak | null };

export type CampCardModel = {
  space: LedgerSpace;
  monthKey: MonthKey;
  heading: string;
  /** Ours: the Fund's Everyday · now. */
  everyday: { cents: number | null; figure: string } | null;
  /** Mine: "On the clock", the personal clock plate's glance. */
  clock: { glance: string; verdict: string } | null;
  leaving: CardLeaving;
  line3: CardLine3;
  hercules: HerculesLine;
  full: OursFull | MineFull;
};

export type CampCardInput = {
  household: Household;
  memberId: string;
  space: LedgerSpace;
  today: DateKey;
  /** The strip's day ledger for this space (`stripLedger`); the card reads "Leaving next" off it. */
  ledger: DayLedger;
  /** The harbour's reading, when the App has one (the notice and the Campfire's condition). */
  reading?: HarbourReading | null;
  /** The viewer's last visit, an ISO instant from a per-viewer record. Null: no record. */
  since?: string | null;
  /** This viewer has not seen home before. */
  firstVisit?: boolean;
  /** The viewer is on a keyboard; the first-visit line names a key, not a gesture. */
  keyboard?: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Leaving next · Hydro $142.00 · Sat 27 · +2 this week" — from the strip's own slips. */
export function readCardLeaving(ledger: DayLedger): CardLeaving {
  const next = leavingNext(ledger);
  if (!next) return { next: null, words: `${WORDS.leavingNext} · ${WORDS.nothingLeaving}` };
  const when = next.date === ledger.today ? WORDS.today : shortDay(next.date);
  const more = next.moreThisWeek > 0 ? ` · ${WORDS.thisWeek(next.moreThisWeek)}` : "";
  return { next, words: `${WORDS.leavingNext} · ${next.slip.name} ${engravedCents(next.slip.amountCents)} · ${when}${more}` };
}

/** "The 2026-09 Plan is waiting for you." → the September plan; a Bridge proposal by its label; a contribution to confirm. */
function presenceNeed(line: { id: string; text: string }, today: DateKey): NeedsItem | null {
  if (line.id.startsWith("ack:")) return { id: line.id, words: `the ${monthWord(monthKeyFromDateKey(today))} plan`, door: { target: "plan-studio" }, source: "presence" };
  if (line.id.startsWith("bridge:")) {
    const label = /"([^"]+)"/.exec(line.text)?.[1];
    return { id: line.id, words: label ? `the Bridge proposal “${label}”` : "a Bridge proposal", door: { target: "plan-studio" }, source: "presence" };
  }
  if (line.id.startsWith("motion:")) return { id: line.id, words: "a contribution to confirm", door: { target: "queen" }, source: "presence" };
  return null;
}

/** Everything waiting on this reader, most pressing first. Ours only: these are the couple's. */
export function readNeeds(input: Pick<CampCardInput, "household" | "memberId" | "today" | "reading" | "space">): { items: NeedsItem[]; sitdown: DeskSitdown | null } {
  if (input.space !== "ours") return { items: [], sitdown: null };
  const { household, memberId, today } = input;
  const items: NeedsItem[] = [];
  let lines: ReturnType<typeof presenceLines> = [];
  try { lines = presenceLines(household, { memberId, today }); } catch { lines = []; }
  for (const line of lines) {
    if (line.waitingOn !== "me") continue;
    const item = presenceNeed(line, today);
    if (item) items.push(item);
  }
  const sitdown = readSitdown(input.reading ?? null, household, memberId, "household", today);
  if (sitdown) {
    items.push({
      id: `sitdown:${sitdown.why}`,
      words: sitdown.why === "proposed" ? "your seat at the Campfire" : `${sitdown.month ? `${sitdown.month}’s` : "the"} Chapter, at the Campfire`,
      door: { target: "plan-studio" },
      source: "sitdown",
    });
  }
  const noticed = input.reading?.noticed;
  if (noticed && noticed.source === "pulse" && noticed.fact.trim()) items.push({ id: "pulse", words: noticed.fact.trim().replace(/\.$/, ""), door: { target: noticed.target }, source: "pulse" });
  return { items, sitdown };
}

/**
 * Since you were here: the partner's purchases recorded after this viewer's
 * last visit (read from the shared presentation of the books, so a partner's
 * private rows never show), then the partner's plan agreements.
 */
export function readSince(input: Pick<CampCardInput, "household" | "memberId" | "today" | "since" | "space">): { words: string; door: CardDoor } | null {
  if (input.space !== "ours") return null;
  const { household, memberId, today, since } = input;
  const name = (id: string) => household.members.find(member => member.id === id)?.name ?? null;
  if (since) {
    try {
      const experience = projectLedgerExperience(household, memberId, "household", today);
      if (experience.ok) {
        const byMember = new Map<string, { count: number; cents: number }>();
        for (const row of experience.scopedHousehold.transactions) {
          if (row.type !== "expense" || row.reversalOfId || row.createdBy === memberId || !(row.createdAt > since)) continue;
          const tally = byMember.get(row.createdBy) ?? { count: 0, cents: 0 };
          tally.count += 1; tally.cents += row.amountCents;
          byMember.set(row.createdBy, tally);
        }
        const top = [...byMember].filter(([id]) => name(id)).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
        if (top) return { words: `${name(top[0])} recorded ${plural(top[1].count, "purchase", "purchases")} · ${formatCad(top[1].cents)}`, door: { target: "books" } };
      }
    } catch { /* fall through to the plan lines */ }
  }
  let lines: ReturnType<typeof presenceLines> = [];
  try { lines = presenceLines(household, { memberId, today }); } catch { lines = []; }
  for (const line of lines) {
    const id = line.id.startsWith("ack:") ? line.id.slice(4) : null;
    if (!id || id === memberId || line.waitingOn !== null) continue;
    const who = name(id);
    if (who) return { words: `${who} agreed to the ${monthWord(monthKeyFromDateKey(today))} plan`, door: { target: "plan-studio" } };
  }
  return null;
}

/** Line 3 by priority: Needs you → Since you were here → the first visit → quiet. */
export function readLine3(input: CampCardInput): CardLine3 {
  const needs = readNeeds(input);
  const first = needs.items[0];
  if (first) {
    const more = needs.items.length > 1 ? ` · +${needs.items.length - 1}` : "";
    return { kind: "needs", words: `${WORDS.needsYou} · ${first.words}${more}`, items: needs.items, door: first.door, sitdown: needs.sitdown };
  }
  const since = readSince(input);
  if (since) return { kind: "since", words: `${WORDS.sinceYouWereHere} · ${since.words}`, door: since.door };
  if (input.firstVisit) return { kind: "first-visit", words: input.keyboard ? WORDS.firstVisitKeyboard : WORDS.firstVisit };
  return { kind: "quiet", words: WORDS.quiet };
}

/** Hercules's line: a Shift to record tonight comes first for a member with a job; then his top suggestion. */
export function readHerculesLine(household: Household, memberId: string, space: LedgerSpace, today: DateKey): HerculesLine {
  const working = (household.workJobs ?? []).some(job => job.memberId === memberId && job.active);
  const recorded = household.shifts.some(shift => shift.memberId === memberId && shift.date === today);
  if (working && !recorded) return { kind: "record-shift", words: WORDS.shiftTonight };
  const hercules = readHercules(household, memberId, viewForSpace(space), today);
  if (hercules) return { kind: "door", title: hercules.candidate.title, why: hercules.candidate.why, hercules };
  return { kind: "quiet", words: WORDS.herculesQuiet };
}

function readStreak(household: Household, memberId: string, today: DateKey): ShiftStreak | null {
  try {
    const experience = projectLedgerExperience(household, memberId, "personal", today);
    return experience.ok ? shiftPostingStreak(experience.scopedHousehold, today) : null;
  } catch { return null; }
}

const EMPTY_SNAPSHOT = {
  now: null,
  prepare: { amountCents: null, targetCents: 0, coveredThrough: null, bills: [], fundBills: [] },
  protect: { amountCents: null, targetCents: 0, refills: [] },
  build: { amountCents: null, targetCents: 0, goals: [] },
};

/** The whole card, once. */
export function campCardModel(input: CampCardInput): CampCardModel {
  const { household, memberId, space, today } = input;
  const monthKey = monthKeyFromDateKey(today);
  const leaving = readCardLeaving(input.ledger);
  const line3 = readLine3(input);
  const hercules = readHerculesLine(household, memberId, space, today);
  if (space === "ours") {
    const snapshot = readSnapshot(household, memberId, "household", today);
    const pots = deskPots(snapshot ?? EMPTY_SNAPSHOT, engravedCents);
    return {
      space, monthKey, heading: WORDS.headingOurs(monthKey),
      everyday: { cents: pots.everyday.cents, figure: engravedCents(pots.everyday.cents) },
      clock: null, leaving, line3, hercules,
      full: { space: "ours", pots, seals: readSeals(household, memberId, "household", today), walk: readWalk(household, "household", today) },
    };
  }
  const personal = readPersonalToday(household, memberId, today);
  const clockPlate = personal.plates.find(plate => plate.id === "clock") ?? null;
  return {
    space, monthKey, heading: WORDS.headingMine(monthKey),
    everyday: null,
    clock: clockPlate ? { glance: clockPlate.glance, verdict: clockPlate.verdict } : { glance: engravedCents(null), verdict: "" },
    leaving, line3, hercules,
    full: {
      space: "mine",
      plates: personal.plates.filter(plate => plate.id !== PERSONAL_LEVEL_PLATE),
      level: personal.plates.find(plate => plate.id === PERSONAL_LEVEL_PLATE) ?? null,
      seals: { seals: personal.seals, monthLabel: personal.monthLabel || formatMonthLabel(monthKey).replace(/\s\d{4}$/, "") },
      streak: readStreak(household, memberId, today),
    },
  };
}
