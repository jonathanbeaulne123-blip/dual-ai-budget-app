import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { FOUNDATION_CHAPTERS, movesForChapter, ritualsForChapter, type Chapter, type Move, type Win } from "./chapters.ts";
import type { FundPulse, FundPulseDestination, FundPulseFreshness, FundPulseState, PresenceLine } from "./fundPulse.ts";
import type { KittyNest, NestBank } from "./kittyNest.ts";
import type { NestCategory } from "./kittyNestDesigns.ts";
import type { MonthObligation } from "./monthObligations.ts";
import type { Household, PotentialExpensePlan } from "./types.ts";

/**
 * The Queen's Nest (Stage 1): Household Home as one body.
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
export function queenNestDoors(nest: Pick<KittyNest, "categories">): QueenNestDoors {
  const doors: Record<QueenNestPlace, NestBank[]> = { protect: [], build: [], belly: [] };
  for (const bank of nest.categories) {
    if (!bank.category) continue;
    doors[queenNestPlaceFor(bank.category)].push(bank);
  }
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
