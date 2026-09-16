import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { FOUNDATION_CHAPTERS, movesForChapter, ritualsForChapter, type Chapter, type Move, type Win } from "./chapters.ts";
import type { FundPulse, FundPulseDestination, FundPulseFreshness, FundPulseState, PresenceLine } from "./fundPulse.ts";
import type { KittyNest, NestBank } from "./kittyNest.ts";
import type { NestCategory } from "./kittyNestDesigns.ts";
import type { MonthObligation } from "./monthObligations.ts";
import type { Household, PotentialExpensePlan, Recurrence } from "./types.ts";

/**
 * The Queen's Nest: Household Home as one body. Stage 1 drew her regions;
 * the Still Queen (this pass) keeps her as pure state and moves navigation
 * to invisible doors, the expand into her three banks, and two rooms.
 *
 * Every function here is a pure selector over projections that already exist.
 * It reads `fundPulse`, `presenceLines`, `projectKittyNest`, the Chapter
 * read helpers, `monthObligations` and `duePotentialExpenses`, and returns
 * only display state: posture, gaze, fullness words, which region is a door
 * and where that door leads. Nothing here posts, sums money, or grades a
 * person. Amounts pass through untouched as confirmation, never as the read.
 *
 * Two doors and a belly sit over the four nest categories at the presentation
 * layer only. `allocateNestTotal` keeps computing all four; the Queen shows
 * `protect` and `prepare` at the Protect door, `build` at the Build door, and
 * `everyday` in her belly (What Now). No category is added to another, so
 * conservation to the cent stays exactly where the nest guarantees it.
 */

export type QueenRegionId = "crown" | "vine" | "face" | "hands" | "body" | "belly" | "hem";
export type QueenNestPlace = "protect" | "build" | "belly";
/** The three banks she opens into. `belly` is What Now — the present, the remainder. */
export type QueenBankId = "protect" | "whatnow" | "build";
export const QUEEN_BANK_FOR_PLACE: Readonly<Record<QueenNestPlace, QueenBankId>> = { protect: "protect", belly: "whatnow", build: "build" };

export const QUEEN_NEST_PLACE: Readonly<Record<NestCategory, QueenNestPlace>> = {
  protect: "protect",
  prepare: "protect",
  build: "build",
  everyday: "belly",
};

export function queenNestPlaceFor(category: NestCategory): QueenNestPlace {
  return QUEEN_NEST_PLACE[category];
}

export type QueenNestDoors = Readonly<Record<QueenNestPlace, NestBank[]>>;

/** Group the four category banks behind two doors and a belly. Banks are passed through, never re-summed. */
export function queenNestDoors(nest: Pick<KittyNest, "categories" | "mode">): QueenNestDoors {
  const doors: Record<QueenNestPlace, NestBank[]> = { protect: [], build: [], belly: [] };
  for (const bank of nest.categories) {
    if (!bank.category) continue;
    doors[queenNestPlaceFor(bank.category)].push(bank);
  }
  // v2: Prepare (what has to leave) reads before Protect (the buffer) behind the lower door.
  if (nest.mode === 2) doors.protect.sort((a, b) => (a.category === "prepare" ? 0 : 1) - (b.category === "prepare" ? 0 : 1));
  return doors;
}

// ---------------------------------------------------------------------------
// The still: face, posture, gaze.

export type QueenPosture = "upright" | "leaning-in" | "attentive" | "tilted" | "depleted" | "matte";
export type QueenGlaze = "glazed" | "matte" | "offline";

export type QueenStill = {
  state: FundPulseState;
  posture: QueenPosture;
  eyes: "closed" | "open";
  /** Where open eyes look. Closed eyes rest. */
  gaze: QueenRegionId | "rest";
  brow: "soft" | "weighted";
  mouth: "serene" | "level" | "set";
  glaze: QueenGlaze;
  /** Grave about the month: a dated obligation is not yet covered, or the plan no longer fits. Never about a person. */
  grave: boolean;
  /** The pulse's own routing. The Queen never invents a destination. */
  destination: FundPulseDestination;
  /** One legible sentence for the pose itself. Reads the same with motion off. */
  description: string;
};

export function queenRegionForDestination(destination: FundPulseDestination): QueenRegionId {
  switch (destination) {
    case "fund": return "body";
    case "together": return "crown";
    case "path": return "vine";
    case "status": return "face";
  }
}

export function queenGlazeFor(freshness: FundPulseFreshness): QueenGlaze {
  return freshness === "current" ? "glazed" : freshness === "offline" ? "offline" : "matte";
}

export function queenStill(pulse: Pick<FundPulse, "state" | "destination">, freshness: FundPulseFreshness): QueenStill {
  const glaze = queenGlazeFor(freshness);
  const base = { state: pulse.state, destination: pulse.destination, glaze } as const;
  switch (pulse.state) {
    case "checking":
      return {
        ...base,
        posture: "matte",
        eyes: "closed",
        gaze: "rest",
        brow: "soft",
        mouth: "level",
        glaze: glaze === "glazed" ? "matte" : glaze,
        grave: false,
        description: "Checking. Unglazed and matte, eyes closed. The evidence is not current, so she claims nothing yet.",
      };
    case "reset":
      return {
        ...base,
        posture: "tilted",
        eyes: "open",
        gaze: queenRegionForDestination(pulse.destination),
        brow: "weighted",
        mouth: "level",
        grave: true,
        description: "Time to reset. Lighter and tilted, eyes open toward the Chapter. The plan has stopped matching the month.",
      };
    case "needs-us": {
      const grave = pulse.destination === "fund";
      return {
        ...base,
        posture: grave ? "depleted" : "attentive",
        eyes: "open",
        gaze: queenRegionForDestination(pulse.destination),
        brow: grave ? "weighted" : "soft",
        mouth: grave ? "set" : "level",
        grave,
        description: grave
          ? "One thing needs us. Depleted, brow weighted, eyes open toward what is held. The next dated obligation is not yet covered."
          : "One thing needs us. Upright, eyes open and turned toward what is waiting. She points; she does not explain.",
      };
    }
    case "covered":
      return {
        ...base,
        posture: "upright",
        eyes: "closed",
        gaze: "rest",
        brow: "soft",
        mouth: "serene",
        grave: false,
        description: "Covered. Upright and glazed, eyes closed at rest. Nothing is asked of the month.",
      };
    case "building":
      return {
        ...base,
        posture: "leaning-in",
        eyes: "closed",
        gaze: "rest",
        brow: "soft",
        mouth: "serene",
        grave: false,
        description: "Building. Leaning in, the vine longer than at the last Sitdown, eyes closed. The essentials are covered and the Chapter is moving.",
      };
  }
}

// ---------------------------------------------------------------------------
// Crown: who is here.

export type QueenCrown = {
  /** `both`: presence from both people and nothing waiting. `waiting-me` takes precedence over `waiting-partner`. */
  light: "both" | "waiting-me" | "waiting-partner" | "unlit";
  lines: PresenceLine[];
};

export function queenCrown(presence: PresenceLine[], limit = 4): QueenCrown {
  const lines = presence.slice(0, Math.max(0, limit));
  const waitingMe = presence.some((line) => line.waitingOn === "me");
  const waitingPartner = presence.some((line) => line.waitingOn === "partner");
  const light = waitingMe ? "waiting-me" : waitingPartner ? "waiting-partner" : presence.length > 0 ? "both" : "unlit";
  return { light, lines };
}

// ---------------------------------------------------------------------------
// Vine: the Chapter, grown by acts.

export type QueenVine =
  | { chapter: null; growth: 0 }
  | { chapter: Chapter; title: string; week: number; acts: number; growth: 0 | 1 | 2 | 3 | 4 };

/** Growth comes from acts — rituals held and Moves done — never from amounts. */
export function queenVine(household: Pick<Household, "rituals" | "moves">, chapter: Chapter | null, today: DateKey): QueenVine {
  if (!chapter) return { chapter: null, growth: 0 };
  const held = ritualsForChapter(household, chapter.id).reduce((sum, ritual) => sum + ritual.heldOn.length, 0);
  const done = movesForChapter(household, chapter.id).filter((move) => move.state === "done").length;
  const acts = held + done;
  const week = Math.max(1, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(chapter.openedAt)) / (7 * 24 * 60 * 60 * 1000)) + 1);
  return { chapter, title: chapter.title, week, acts, growth: Math.min(4, acts) as 0 | 1 | 2 | 3 | 4 };
}

// ---------------------------------------------------------------------------
// Buds: goals in motion.

export type QueenBud = {
  id: string;
  goalId: string;
  name: string;
  bank: NestBank;
  /** Older goals are larger buds; size never follows money. */
  size: "small" | "medium" | "large";
};

export function queenBuds(nest: Pick<KittyNest, "categories">, limit: number): QueenBud[] {
  const goals = nest.categories.flatMap((category) => category.children).filter((bank) => bank.tier === "goal" && bank.goal && bank.state === "open");
  const byAge = [...goals].sort((a, b) => (a.goal!.createdAt).localeCompare(b.goal!.createdAt) || a.id.localeCompare(b.id));
  const rank = new Map(byAge.map((bank, index) => [bank.id, index]));
  const soonest = [...goals].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (rank.get(a.id)! - rank.get(b.id)!));
  return soonest.slice(0, Math.max(0, limit)).map((bank) => {
    const index = rank.get(bank.id)!;
    const size = byAge.length <= 1 || index === 0 ? "large" : index === byAge.length - 1 ? "small" : "medium";
    return { id: `bud:${bank.goal!.id}`, goalId: bank.goal!.id, name: bank.name, bank, size };
  });
}

// ---------------------------------------------------------------------------
// Hands: the one Move, or empty.

export type QueenHands =
  | { kind: "empty" }
  | { kind: "move"; move: Move; act: "done" | "acknowledge" | "setup" | "waiting"; ownerLine: string };

export function queenHands(household: Pick<Household, "members">, memberId: string, chapter: Chapter | null, move: Move | null): QueenHands {
  if (!chapter || !move) return { kind: "empty" };
  const name = (id: string | null) => household.members.find((row) => row.id === id)?.name ?? "Either of us";
  const ownerLine = move.ownerMemberId ? `${name(move.ownerMemberId)} owns this` : "Either of us can take this";
  const foundation = FOUNDATION_CHAPTERS.find((row) => row.id === chapter.foundationId);
  if (chapter.foundationId === "see-our-shared-life" && foundation && move.text === foundation.firstMove) {
    return { kind: "move", move, act: "setup", ownerLine };
  }
  if (move.needsAcknowledgment) {
    if (!move.acknowledgedByMemberIds.includes(memberId)) return { kind: "move", move, act: "acknowledge", ownerLine: `${ownerLine} · needs both of us` };
    const required = household.members.filter((row) => row.active).map((row) => row.id);
    const missing = required.filter((id) => id !== memberId && !move.acknowledgedByMemberIds.includes(id));
    if (missing.length > 0) return { kind: "move", move, act: "waiting", ownerLine: `${ownerLine} · waiting on the other of us` };
  }
  return { kind: "move", move, act: "done", ownerLine };
}

// ---------------------------------------------------------------------------
// Body: fullness, glaze, gold seams.

export type QueenFullness = "empty" | "low" | "half" | "full" | "held";

export type QueenBody = {
  /** 0–10 fill mark, the same quantization the nest shelf already draws. */
  level: number;
  fullness: QueenFullness;
  glaze: QueenGlaze;
  /** Mended corrections left visible this month, capped for drawing. */
  seams: number;
  amountCents: number;
};

export function queenFullness(king: Pick<NestBank, "amountCents" | "targetCents">): { level: number; fullness: QueenFullness } {
  if (king.amountCents <= 0) return { level: 0, fullness: "empty" };
  if (king.targetCents <= 0) return { level: 10, fullness: "held" };
  const level = Math.max(0, Math.min(10, Math.floor(king.amountCents / king.targetCents * 10)));
  return { level, fullness: level === 0 ? "low" : level < 4 ? "low" : level < 8 ? "half" : "full" };
}

/** Reversals posted this month are the corrections she keeps visible as gold seams. A count, not a sum. */
export function queenSeams(household: Pick<Household, "transactions">, today: DateKey): number {
  const monthKey = monthKeyFromDateKey(today);
  return household.transactions.filter((tx) => Boolean(tx.reversalOfId) && !tx.isDuplicate && monthKeyFromDateKey(tx.date) === monthKey).length;
}

export function queenBody(nest: Pick<KittyNest, "king">, freshness: FundPulseFreshness, seams: number): QueenBody {
  const { level, fullness } = queenFullness(nest.king);
  return { level, fullness, glaze: queenGlazeFor(freshness), seams: Math.max(0, Math.min(3, seams)), amountCents: nest.king.amountCents };
}

// ---------------------------------------------------------------------------
// Fresh glaze: what the partner last touched.

export type QueenTrace = { region: QueenRegionId | `bud:${string}`; at: string; who: string };

/** The partner's most recent touch within the last two civil days. A trace on a region, never a score. */
export function queenTrace(household: Pick<Household, "members" | "transactions" | "goalContributions">, memberId: string, today: DateKey): QueenTrace | null {
  const since = addDays(today, -1);
  const partner = household.members.find((row) => row.active && row.id !== memberId);
  if (!partner) return null;
  const candidates: QueenTrace[] = [];
  for (const tx of household.transactions) {
    if (tx.createdBy !== partner.id || tx.isDuplicate || tx.createdAt.slice(0, 10) < since) continue;
    candidates.push({ region: tx.source === "recurring" || tx.source === "calendar" ? "hem" : "body", at: tx.createdAt, who: partner.name });
  }
  for (const row of household.goalContributions ?? []) {
    if (row.memberId !== partner.id || row.createdAt.slice(0, 10) < since) continue;
    candidates.push({ region: `bud:${row.goalId}`, at: row.createdAt, who: partner.name });
  }
  return candidates.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Hem: what is coming.

export type QueenStone = {
  id: string;
  label: string;
  date: DateKey;
  kind: "obligation" | "planned";
  amountCents: number;
  /** Nearer dates sit closer to her feet and larger. */
  size: "near" | "soon" | "later";
};

/** Obligations still ahead this month, and planned expenses already due but not posted. Nearest first; fewer, never smaller. */
export function queenHem(obligations: MonthObligation[], planned: PotentialExpensePlan[], today: DateKey, limit: number): QueenStone[] {
  const rows: QueenStone[] = [
    ...obligations.filter((row) => row.date >= today).map((row) => ({ id: row.id, label: row.label, date: row.date, kind: "obligation" as const, amountCents: row.amountCents, size: "later" as const })),
    ...planned.map((row) => ({ id: `planned:${row.id}`, label: row.title, date: row.date, kind: "planned" as const, amountCents: row.expectedAmountCents, size: "later" as const })),
  ];
  const week = addDays(today, 7);
  const fortnight = addDays(today, 14);
  return rows
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((row) => ({ ...row, size: row.date <= week ? "near" : row.date <= fortnight ? "soon" : "later" }));
}

// ---------------------------------------------------------------------------
// Win: a bloom on the vine when the ladder fires.

export type QueenBloom = { win: Win; keptByMe: boolean; complete: boolean; label: string };

export function queenBloom(win: Win | null, memberId: string, activeMemberIds: string[]): QueenBloom | null {
  if (!win || win.level === "acknowledgment") return null;
  const keptByMe = win.keptByMemberIds.includes(memberId);
  const complete = activeMemberIds.length > 0 && activeMemberIds.every((id) => win.keptByMemberIds.includes(id));
  const label = win.level === "first" ? "A First" : win.level === "graduation" ? "Graduated" : "A shared Win";
  return { win, keptByMe, complete, label };
}

// ---------------------------------------------------------------------------
// How much fits at each width. Fewer, never smaller.

export type QueenLimits = { buds: number; stones: number; presence: number };

export function queenLimits(wide: boolean): QueenLimits {
  return wide ? { buds: 4, stones: 4, presence: 4 } : { buds: 2, stones: 2, presence: 2 };
}

// ---------------------------------------------------------------------------
// The Still Queen — her banks, her feet, her line, and the two rooms.

export type QueenBank = {
  id: QueenBankId;
  /** The category banks that sit behind this door, passed through untouched. */
  banks: NestBank[];
  /** A drawn share of the King, quantized to ten steps. Display only; never a money figure. */
  share: number;
};
export type QueenBanks = Readonly<Record<QueenBankId, QueenBank>>;

/**
 * Three banks over four categories at the presentation layer only:
 * protect + prepare → Protect, everyday → What Now (her belly), build → Build.
 * The banks are grouped, never re-summed; conservation stays where
 * `allocateNestTotal` guarantees it. The share is a drawing ratio, quantized.
 */
export function queenBanks(nest: Pick<KittyNest, "categories" | "king" | "mode">): QueenBanks {
  const doors = queenNestDoors(nest);
  const share = (banks: NestBank[]): number => {
    if (nest.king.amountCents <= 0) return 0;
    const held = banks.reduce((sum, bank) => sum + Math.max(0, bank.amountCents), 0);
    return Math.max(0, Math.min(10, Math.round((held / nest.king.amountCents) * 10)));
  };
  return {
    protect: { id: "protect", banks: doors.protect, share: share(doors.protect) },
    whatnow: { id: "whatnow", banks: doors.belly, share: share(doors.belly) },
    build: { id: "build", banks: doors.build, share: share(doors.build) },
  };
}

export const QUEEN_BANK_LABELS: Readonly<Record<QueenBankId, string>> = { protect: "Protect", whatnow: "What now", build: "Build" };
export const QUEEN_BANK_MEANINGS: Readonly<Record<QueenBankId, string>> = {
  protect: "The future you did not choose.",
  whatnow: "The present, the remainder.",
  build: "The future you chose.",
};
/**
 * v2 words (D-271). The lower door still opens Prepare and Protect together
 * (Prepare first) and leads down to the cellar, which is now Prepare's room;
 * which figure Prepare gets and where the Knight lives is still Jonathan's
 * call (plan §6 Q3), so the drawing is unchanged and only the words move.
 */
export const QUEEN_BANK_LABELS_V2: Readonly<Record<QueenBankId, string>> = { protect: "Prepare · Protect", whatnow: "Now", build: "Build" };
export const QUEEN_BANK_MEANINGS_V2: Readonly<Record<QueenBankId, string>> = {
  protect: "What has to leave, and the buffer we agreed.",
  whatnow: "What's left for day-to-day.",
  build: "What we chose to grow.",
};
export function queenBankWords(mode: 1 | 2): { labels: Readonly<Record<QueenBankId, string>>; meanings: Readonly<Record<QueenBankId, string>>; lowerTitle: string; lowerRoom: string; lowerBankKey: "plan:protect" | "plan:prepare" } {
  return mode === 2
    ? { labels: QUEEN_BANK_LABELS_V2, meanings: QUEEN_BANK_MEANINGS_V2, lowerTitle: "What has to leave", lowerRoom: "Prepare · down to the cellar", lowerBankKey: "plan:prepare" }
    : { labels: QUEEN_BANK_LABELS, meanings: QUEEN_BANK_MEANINGS, lowerTitle: "What arrives", lowerRoom: "Protect · down to the cellar", lowerBankKey: "plan:protect" };
}

/** At her feet: the nearest dated obligations as pure form — how many and how near. No dates, no labels. */
export type QueenFeet = { count: number; nearness: Array<QueenStone["size"]> };

export function queenFeet(stones: QueenStone[]): QueenFeet {
  return { count: stones.length, nearness: stones.map((stone) => stone.size) };
}

/** One quiet line beneath her: the Chapter and the pulse, in words. */
export type QueenLine = { chapter: string | null; word: string };

export const QUEEN_PULSE_WORDS: Readonly<Record<FundPulseState, string>> = {
  covered: "covered",
  building: "building",
  "needs-us": "one thing needs us",
  reset: "time to reset",
  checking: "checking",
};

export function queenLine(chapter: Pick<Chapter, "title"> | null, still: Pick<QueenStill, "state" | "grave">): QueenLine {
  const word = still.state === "needs-us" && still.grave ? "not yet covered" : QUEEN_PULSE_WORDS[still.state];
  return { chapter: chapter?.title ?? null, word };
}

// ---------------------------------------------------------------------------
// The cellar: a ribbon of near-identical vessels, one per month.

export type QueenJar = {
  monthKey: string;
  /** `posted` has a receipt in the books; `expected` is the next beat still ahead; `quiet` had no beat. */
  beat: "posted" | "expected" | "quiet";
  /** The one that swelled and stepped out of the rail. A read with no number attached. */
  outlier: boolean;
  now: boolean;
  /**
   * How much the month took against its usual, as a *shape*: 0.85 to 1.45,
   * quantised to the nearest twentieth. Quantising is the point — a swell you
   * can read a dollar figure off is a chart, and this is a jar. Quiet months
   * are 1: they claim nothing.
   */
  swell: number;
  /** How full the jar looks, 0 to 1, quantised the same way. A quiet month is empty, not zero-dollars. */
  fill: number;
};

/** A ratio becomes a shape here and nowhere else: clamped into a band and stepped, so no amount survives the trip. */
const band = (ratio: number, low: number, high: number, step = 0.05) =>
  Math.round(Math.max(low, Math.min(high, ratio)) / step) * step;

export type QueenRibbon = {
  recurrenceId: string;
  label: string;
  jars: QueenJar[];
  /** Months with a posted beat. */
  posted: number;
  outlierMonth: string | null;
};

function monthKeysBack(today: DateKey, months: number): string[] {
  const [year, month] = today.slice(0, 7).split("-").map(Number) as [number, number];
  const keys: string[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const index = year * 12 + (month - 1) - back;
    const y = Math.floor(index / 12);
    const m = index % 12 + 1;
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}

/**
 * One recurring cost, month by month. Each jar is the same jar; the outlier is
 * the month whose posted receipt swelled well past the usual beat. Amounts
 * decide the swell and never leave this function — the ribbon carries form.
 */
export function queenRibbon(household: Pick<Household, "transactions">, recurrence: Pick<Recurrence, "id" | "note" | "nextDate" | "payments">, today: DateKey, months = 12): QueenRibbon {
  const keys = monthKeysBack(today, months);
  const postedByMonth = new Map<string, number>();
  const linked = new Set((recurrence.payments ?? []).map((payment) => payment.transactionId));
  for (const payment of recurrence.payments ?? []) {
    const key = payment.occurrenceDate.slice(0, 7);
    postedByMonth.set(key, (postedByMonth.get(key) ?? 0) + Math.max(0, payment.amountCents));
  }
  for (const tx of household.transactions) {
    if (tx.type !== "expense" || tx.source !== "recurring" || tx.sourceId !== recurrence.id || tx.isDuplicate || tx.reversalOfId || tx.refundOfId || linked.has(tx.id)) continue;
    const key = tx.date.slice(0, 7);
    postedByMonth.set(key, (postedByMonth.get(key) ?? 0) + Math.max(0, tx.amountCents));
  }
  const amounts = [...postedByMonth.values()].filter((amount) => amount > 0).sort((a, b) => a - b);
  const usual = amounts.length ? amounts[Math.floor(amounts.length / 2)]! : 0;
  const nowKey = today.slice(0, 7);
  const nextKey = recurrence.nextDate.slice(0, 7);
  let outlierMonth: string | null = null;
  const jars: QueenJar[] = keys.map((monthKey) => {
    const posted = postedByMonth.get(monthKey) ?? 0;
    const outlier = amounts.length >= 3 && posted > 0 && posted * 100 > usual * 135;
    if (outlier && outlierMonth === null) outlierMonth = monthKey;
    const ratio = usual > 0 && posted > 0 ? posted / usual : 1;
    return {
      monthKey,
      beat: posted > 0 ? "posted" : monthKey === nextKey && monthKey >= nowKey ? "expected" : "quiet",
      outlier,
      now: monthKey === nowKey,
      swell: posted > 0 ? band(ratio, 0.85, 1.45) : 1,
      fill: posted > 0 ? band(ratio, 0, 1) : 0,
    };
  });
  return { recurrenceId: recurrence.id, label: recurrence.note.trim() || "Recurring cost", jars, posted: amounts.length, outlierMonth };
}

/** Every household recurring expense as a ribbon; the one that broke its beat comes first. */
export function queenRibbons(household: Pick<Household, "transactions" | "recurrences" | "accounts">, today: DateKey, months = 12): QueenRibbon[] {
  const householdAccounts = new Set(household.accounts.filter((account) => account.scope !== "personal").map((account) => account.id));
  return household.recurrences
    .filter((row) => row.type === "expense" && householdAccounts.has(row.accountId))
    .map((row) => queenRibbon(household, row, today, months))
    .sort((a, b) => Number(Boolean(b.outlierMonth)) - Number(Boolean(a.outlierMonth)) || b.posted - a.posted || a.label.localeCompare(b.label));
}

// ---------------------------------------------------------------------------
// The loft: goals on a ledge. Open-mouthed things accept; lidded things refuse.

export type QueenShelfItem = {
  id: string;
  name: string;
  /** A goal has a decision inside it and accepts; a bill was never a decision and refuses. */
  mouth: "open" | "lidded";
  bank: NestBank;
  goalId: string | null;
  /** Contributions so far, as marks. A count, never a sum. */
  marks: number;
  date: DateKey | null;
  /** How high the glaze stands, 0 to 1, quantised to a twentieth. Progress as a level, not a percentage. */
  fullness: number;
  /** How wide the vessel stands. Three bands, so the shelf reads at a glance and no amount leaks out of one. */
  size: "small" | "middling" | "large";
  /** How many parts are inside it: the necks on its shoulder. A count, never a sum. */
  parts: number;
  /** Its design key: the stable name the shelf's stored order is written in. */
  designKey: string;
  /** Where the stored order puts it, or null when the order does not name it. */
  place: number | null;
  /**
   * How big the bank stands, by its goal (2026-09-15, Jonathan: "a 10$ goal
   * will be teeny tiny compared to a 10,000 goal"). A continuous scale on a
   * log of the target — each tenfold is a third of a full bank taller.
   */
  scale: number;
  /** The studio's growth step, 0–10: the bank swells as it fills and slims when money is used. */
  step: number;
};

/** $10 → 0.22, $100 → 0.55, $1,000 → 0.88, $10,000 → 1.21, capped at 1.5. Shape only; never read back as a figure. */
export function loftBankScale(targetCents: number): number {
  const dollars = Math.max(10, targetCents / 100);
  const scale = 0.22 + 0.33 * Math.log10(dollars / 10);
  return Math.round(Math.min(1.5, Math.max(0.22, scale)) * 100) / 100;
}

/** Three widths, chosen so a shelf reads as a shelf. The thresholds are shape, not money, and never surface as figures. */
const shelfSize = (targetCents: number): QueenShelfItem["size"] =>
  targetCents >= 300_000 ? "large" : targetCents >= 80_000 ? "middling" : "small";

/**
 * The ledge, in the order the household put it in. The order is one list of
 * design keys on the Build plan bank's own row, so a rearrangement is one save
 * and the last save wins; banks the list does not name keep the nest's own
 * order behind the ones it does.
 */
export function queenShelf(
  nest: Pick<KittyNest, "categories">,
  household: Pick<Household, "goalContributions">,
  order: readonly string[] = [],
): QueenShelfItem[] {
  const place = new Map(order.map((key, index) => [key, index]));
  const build = nest.categories.find((bank) => bank.category === "build");
  if (!build) return [];
  const rows = build.children
    .filter((bank) => bank.state === "open")
    .map((bank, index): QueenShelfItem & { nestOrder: number } => ({
      id: bank.id,
      name: bank.name,
      mouth: bank.tier === "goal" && bank.goal ? "open" : "lidded",
      bank,
      goalId: bank.goal?.id ?? null,
      marks: bank.goal ? (household.goalContributions ?? []).filter((row) => row.goalId === bank.goal!.id).length : 0,
      date: bank.date,
      fullness: bank.targetCents > 0 ? band(bank.amountCents / bank.targetCents, 0, 1) : 0,
      size: shelfSize(bank.targetCents > 0 ? bank.targetCents : bank.amountCents),
      parts: bank.children?.length ?? 0,
      designKey: bank.designKey,
      place: place.get(bank.designKey) ?? null,
      scale: loftBankScale(bank.targetCents > 0 ? bank.targetCents : bank.amountCents),
      step: bank.targetCents > 0 ? Math.max(0, Math.min(10, Math.floor((bank.amountCents / bank.targetCents) * 10))) : 0,
      nestOrder: index,
    }));
  return rows
    .sort((a, b) => (a.place ?? Number.POSITIVE_INFINITY) - (b.place ?? Number.POSITIVE_INFINITY) || a.nestOrder - b.nestOrder)
    .map(({ nestOrder: _drop, ...row }) => row);
}

/** The bank key the shelf's order is stored on. */
export const QUEEN_SHELF_BANK_KEY = "plan:build";
/** The stored order of the ledge: one list of design keys on the Build plan bank's own household row. */
export function queenShelfOrder(designs: readonly { bankKey: string; visibility: string; order?: string[] }[] | undefined): string[] {
  return designs?.find((row) => row.bankKey === QUEEN_SHELF_BANK_KEY && row.visibility === "household")?.order ?? [];
}

/**
 * The ledge with one bank moved to `index`: the whole shelf as design keys, in
 * the order it now stands. One list, one save, and the last save wins.
 */
export function queenShelfReorder(shelf: readonly QueenShelfItem[], movingId: string, index: number): string[] {
  const keys = shelf.map((row) => row.designKey);
  const from = shelf.findIndex((row) => row.id === movingId);
  if (from < 0) return keys;
  const moving = keys[from]!;
  const rest = keys.filter((_key, i) => i !== from);
  const at = Math.max(0, Math.min(rest.length, index > from ? index - 1 : index));
  rest.splice(at, 0, moving);
  return rest;
}
