/**
 * Little Harbour · the Court's one read-model (BUILD_PLAN §5).
 *
 * Everything the Court engraves, hangs or pins comes from this one adapter,
 * built only from shipped core selectors: `fundSnapshot` for the four
 * numbers, the fund pulse for what she noticed, Hercules's bubble for the
 * good-news notice, `presenceLines` for the slip, `deriveHouseCondition`
 * for the moss, `queenGlazeFor` for the plate finish, the kitty nest and the
 * cellar jars for the door signs.
 *
 * Nothing here posts, writes or moves money. Unknown cents stay `null` and
 * read "—" downstream; they are never shown as $0.
 */
import { addDays, compareDateKeys, weekdaySunday0, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { chapterMonth, chapterReminder, openChapterFor, pendingChapterClosure, type Chapter, type Ritual } from "../../core/chapters.ts";
import { currentPlanVersion, planAcknowledgementState, type PlanLens } from "../../core/planSystem.ts";
import { shapeTasks, taskInView, type Task } from "../../core/tasks.ts";
import { fundSnapshot, type FlowItem, type FundSnapshot } from "../../core/fundModel.ts";
import { deriveFundPulseInput, fundPulse, presenceLines, type FundPulse, type FundPulseDestination, type FundPulseFreshness } from "../../core/fundPulse.ts";
import { deriveHouseCondition, type HouseCondition } from "../../core/houseCondition.ts";
import { projectHouseholdFund } from "../../core/householdFund.ts";
import { kittyBankBackingStep } from "../../core/kittyBanks.ts";
import { projectKittyNest, type KittyNest, type NestBank } from "../../core/kittyNest.ts";
import type { NestCategory } from "../../core/kittyNestDesigns.ts";
import { missingSubscriptions } from "../../core/missingSubscriptions.ts";
import { bubbleNotice, type HerculesNotice } from "../../core/notices.ts";
import { cellarDays, cellarJars, type CellarJar } from "../../core/queenCellar.ts";
import { queenGlazeFor, queenShelf, queenShelfOrder, QUEEN_SHELF_BANK_KEY, type QueenGlaze, type QueenShelfItem } from "../../core/queenPresentation.ts";
import { RACK_LIMITS, rackSettled, type QueenRackV1 } from "../../core/queenRack.ts";
import { fundWalk } from "../../core/fundWalk.ts";
import { monthKeyFromDateKey } from "../../core/calendar.ts";
import type { Goal, Household, KittyGlaze } from "../../core/types.ts";
import type { UmbrellaBankId } from "../../queen/world/bankModels.ts";

/** The 16 house tools (`TARGET_NAMES`, `src/house/navigation.ts`) plus the Status tab the pulse can point at. */
export type HouseTargetId =
  | "queen" | "loft-banks" | "cellar-bills" | "books" | "planner" | "calendar" | "journey" | "conversation"
  | "plan-studio" | "wishes" | "pottery" | "memories" | "letters" | "projector" | "hercules" | "encounters" | "more";

/**
 * Slice 2 (BUILD_PLAN_SLICE2 §5) — the tower, the cellar and the cistern, all
 * from selectors that already ship. The block below is the contract writers T
 * and C code against and is kept byte for byte as the plan writes it.
 */
export type TowerBank = { key: string; goalId: string | null; name: string; cents: number; targetCents: number; step: number; category: NestCategory; sculptSeed: string };
export type TowerShelf = { id: string; share: number; cutoff: number; full: boolean; banks: TowerBank[] };
export type TowerReading = { shelves: TowerShelf[]; jug: { safeCents: number; custodian: boolean; holder: string | null }; gun: { available: boolean }; largestTargetCents: number; smallestTargetCents: number };
export type CellarJarReading = { key: string; label: string; umbrella: UmbrellaBankId | null; amountCents: number; fill: number; state: "planned" | "set-aside" | "paid" | "short"; size: 1|2|3|4|5; due: DateKey | null; missingMark: boolean };
export type CellarReadingView = { jars: CellarJarReading[]; days: { date: DateKey; balanceCents: number; belowBuffer: boolean; today: boolean }[]; todayIndex: number; prepareCents: number | null; scaleCents: number };
export type CisternReading = { cents: number | null; target: number; level: number };

export type HarbourReading = {
  /** `fundSnapshot.now` — the Everyday remainder carved at her feet. `null` = unknown, never 0. */
  everyday: number | null;
  prepare: { cents: number | null; target: number; coveredThrough: DateKey | null; shortOn?: { date: DateKey; label: string; shortCents: number } };
  protect: { cents: number | null; target: number };
  build: { cents: number | null; target: number; goals: number };
  /** The sundial's shadow: the next dated commitment, or nothing dated. `daysAhead` is 0 for today. */
  next: { label: string; date: DateKey; cents: number; daysAhead: number; target: "cellar-bills" | "loft-banks" } | null;
  /** The mailbox: one fact and one next step. A need (pulse) always outranks good news (Hercules). */
  noticed: { fact: string; next: string; target: HouseTargetId; source: "pulse" | "hercules" } | null;
  /** "Since you were here" — at most three lines, pinned beside the mailbox. */
  slip: string[];
  condition: HouseCondition;
  glaze: QueenGlaze;
  /** Open goal banks in the tower. */
  banks: number;
  /** Bill jars on this month's cellar rail. */
  jars: number;
  mode: 1 | 2;
  freshness: FundPulseFreshness;
  /** The Rook's Tower: the rack's shelves, the banks on them, the jug and the gun on the landing. */
  tower: TowerReading;
  /** The Cellar: the jars on the rail, the Prepare water day by day, and the one dollar scale both stand on. */
  cellar: CellarReadingView;
  /** The Cistern beside the Knight: Protect against its target, as a water level. */
  cistern: CisternReading;
  /** The Glasshouse behind the Library: the planner as benches of pots by week. */
  glasshouse: GlasshouseReading;
  /** The Kitchen: the month's plan as recipe cards on the cookbook wall. */
  kitchen: KitchenReading;
  /** The Boathouse: what the shore rooms hold, in counts and never in contents. */
  boathouse: BoathouseReading;
  /** Hercules's Cottage: what his own room holds, in counts and never in contents. */
  cottage: CottageReading;
  /** The Kiln: the shelf of fired pieces, and how warm the kiln still is. */
  kiln: KilnReading;
  /** The Campfire on the shore: the month's Chapter, who has sat, and the stones already laid. */
  campfire: CampfireReading;
};

/**
 * The Glasshouse (LITTLE_HARBOUR_v2 §3): a task is a plant in a pot with a
 * paper tag, and the planner is a glasshouse with benches by week. A pot's
 * state is its plant — a seed for not started, a sprout for taken up, a bloom
 * for done — and a pot past its date is not red, it is **dry**, and the
 * watering can comes out. Nothing here is a figure; the paper is behind the
 * pot's own door.
 */
export type GlassPotState = "seed" | "sprout" | "bloom";
export type GlassPot = {
  /** `task/<id>` — the door's object, and the twin's key. */
  key: string;
  title: string;
  state: GlassPotState;
  /** Past its date and not done. Dry earth, never a red badge. */
  dry: boolean;
  /** The tag's thread: yours, the partner's, twisted for both, plain for nobody's yet. */
  thread: "mine" | "partner" | "both" | "plain";
  /** 0 = this week's bench (front, in the light), 1 = next week, 2 = the month at the back. */
  bench: 0 | 1 | 2;
  /** A Chapter move or a plan step carries a stake — the same stake the island shows. */
  staked: boolean;
  /** Goal-linked: a little cat on the tag. */
  cat: boolean;
  /** The pot's own date, for the tag's words. */
  date: DateKey | null;
};
export type GlasshouseReading = {
  /** Standing pots, benches 0–2, dry ones included. Capped for the room; the paper holds the rest. */
  pots: GlassPot[];
  /** Blooms harvested in the last seven days — the harvest shelf. Nothing is deleted; it is harvested. */
  harvested: number;
  /** Rituals in the long bed: perennials, they come back on their own. */
  perennials: { key: string; title: string }[];
  dry: number;
  /** Pots the room could not stand (over the cap). */
  overflow: number;
};

/** The room stands at most this many pots; the month's paper lists every one. */
export const GLASSHOUSE_POT_CAP = 18;

/**
 * The benches, read from the tasks the member can see in this view. The bench
 * is the pot's `doDate` (or `dueDate`): this week, next week, or the month at
 * the back — an undated pot waits at the back too. Done pots from the last
 * seven days are the harvest shelf; older harvests rest. Pure; reads rows,
 * posts nothing.
 */
export function buildGlasshouseReading(
  household: { tasks?: Task[]; rituals?: Ritual[]; members: { id: string }[] },
  memberId: string,
  today: DateKey,
): GlasshouseReading {
  const weekStart = addDays(today, -weekdaySunday0(today));
  const nextWeek = addDays(weekStart, 7);
  const monthEnd = addDays(weekStart, 28);
  const harvestSince = addDays(today, -7);
  const rows = shapeTasks(household.tasks).filter((task) => !task.deleted && taskInView(task, memberId, "household"));
  let harvested = 0;
  const pots: GlassPot[] = [];
  let dry = 0;
  for (const task of rows) {
    if (task.completedAt) {
      const doneDay = task.completedAt.slice(0, 10);
      if (compareDateKeys(doneDay, harvestSince) >= 0) harvested++;
      continue;
    }
    const date = task.doDate ?? task.dueDate;
    if (date && compareDateKeys(date, monthEnd) >= 0) continue;
    const bench: 0 | 1 | 2 = date === null ? 2 : compareDateKeys(date, nextWeek) < 0 ? 0 : compareDateKeys(date, addDays(nextWeek, 7)) < 0 ? 1 : 2;
    const isDry = date !== null && compareDateKeys(date, today) < 0;
    if (isDry) dry++;
    const partner = household.members.some((member) => member.id !== memberId && (task.assigneeId === member.id || task.acknowledgedBy.includes(member.id)));
    const mine = task.assigneeId === memberId || task.acknowledgedBy.includes(memberId);
    pots.push({
      key: `task/${task.id}`,
      title: task.title,
      state: task.acknowledgedBy.length > 0 ? "sprout" : "seed",
      dry: isDry,
      thread: mine && partner ? "both" : mine ? "mine" : partner ? "partner" : "plain",
      bench,
      staked: Boolean(task.planReference) || Boolean(task.chapterId) || Boolean(task.chapterSource),
      cat: Boolean(task.moneyLink),
      date,
    });
  }
  pots.sort((a, b) => a.bench - b.bench || (a.date && b.date ? compareDateKeys(a.date, b.date) : a.date ? -1 : b.date ? 1 : 0) || a.title.localeCompare(b.title));
  const standing = pots.slice(0, GLASSHOUSE_POT_CAP);
  const perennials = (household.rituals ?? []).filter((ritual) => ritual.state === "active").slice(0, 6)
    .map((ritual) => ({ key: `ritual/${ritual.id}`, title: ritual.title || "A ritual" }));
  return { pots: standing, harvested, perennials, dry, overflow: pots.length - standing.length };
}

/**
 * The Kitchen (LITTLE_HARBOUR_v2 §4): a plan is a recipe card — five lines,
 * always the same five. What; how much; by when; from which pot; who. The
 * wall of the kitchen is the cookbook: every line of the month's standing
 * plan, as a card. Everything else — steps, alternatives, review, versions —
 * hangs off the card and never appears unless you turn it over, which is a
 * door onto the Plan Studio, never anything the room does itself.
 */
export type RecipeCard = {
  /** `line/<id>` — the door's object into the Plan Studio, and the twin's key. */
  key: string;
  /** 1 · What. */
  what: string;
  /** 2 · How much (the decision's target when one was set, else the line's amount). */
  amountCents: number;
  /** 3 · By when. Not every card has a date. */
  when: DateKey | null;
  /** 4 · From which pot. */
  pot: PlanLens;
  /** 5 · Who. */
  who: "both" | "mine" | "partner" | null;
};
export type KitchenReading = {
  /** The cookbook wall, newest month's standing plan. Capped for the wall; the drawer holds the rest. */
  cards: RecipeCard[];
  monthKey: string | null;
  /** The plan's own standing: active, scheduled, proposed — or null with no plan at all. */
  state: "active" | "scheduled" | "proposed" | null;
  /** A proposed card sits on the table with a second chair until the other of you sits. */
  waiting: boolean;
  overflow: number;
};

export const KITCHEN_CARD_CAP = 12;
/** A kitchen before any plan: a bare wall, a clear table, the empty card waiting. */
export const EMPTY_KITCHEN_READING: KitchenReading = Object.freeze({ cards: [], monthKey: null, state: null, waiting: false, overflow: 0 });

/** The month's standing plan as recipe cards. Pure; reads `planVersions`, posts nothing. */
export function buildKitchenReading(
  household: { planVersions?: unknown[]; planAcknowledgements?: unknown[]; members: { id: string; leftAt?: string | null }[] },
  memberId: string,
  today: DateKey,
): KitchenReading {
  const version = currentPlanVersion(household as never, "household", monthKeyFromDateKey(today));
  if (!version) return EMPTY_KITCHEN_READING;
  const cards: RecipeCard[] = version.lines.map((line) => ({
    key: `line/${line.id}`,
    what: line.labelSnapshot,
    amountCents: line.decision?.targetCents ?? line.amountCents,
    when: line.decision?.deadline ?? line.dueDate ?? null,
    pot: line.lens,
    who: line.responsibility
      ? line.responsibility.kind === "joint" ? "both" : line.responsibility.memberId === memberId ? "mine" : "partner"
      : null,
  }));
  const acknowledgement = planAcknowledgementState(household as never, version);
  const state: KitchenReading["state"] = version.state === "active" ? "active" : version.state === "scheduled" ? "scheduled" : version.state === "proposed" ? "proposed" : null;
  return {
    cards: cards.slice(0, KITCHEN_CARD_CAP),
    monthKey: version.monthKey,
    state,
    waiting: !acknowledgement.complete,
    overflow: Math.max(0, cards.length - KITCHEN_CARD_CAP),
  };
}

/**
 * The Boathouse (LITTLE_HARBOUR_v2 §5): what the shore rooms hold, in counts
 * and never in contents. Shared rows only — a private wish never renders in
 * the other copy, so it never renders here either.
 */
export type BoathouseReading = {
  /** Ideas in the light (the Conservatory's shared experiences). */
  wishes: number;
  /** Kept compositions (the Theatre). */
  memories: number;
  /** Placed notes around the common rooms. */
  letters: number;
  /** Moments spent together. */
  encounters: number;
};
export const EMPTY_BOATHOUSE_READING: BoathouseReading = Object.freeze({ wishes: 0, memories: 0, letters: 0, encounters: 0 });

/** Counts from the shared Hearthside state. Pure, total: a household without one is an empty boathouse. */
export function buildBoathouseReading(household: { hearthside?: { experiences?: unknown[]; memories?: unknown[]; notes?: unknown[]; encounters?: unknown[] } }): BoathouseReading {
  const state = household.hearthside;
  if (!state || typeof state !== "object") return EMPTY_BOATHOUSE_READING;
  const count = (rows: unknown): number => (Array.isArray(rows) ? rows.length : 0);
  return { wishes: count(state.experiences), memories: count(state.memories), letters: count(state.notes), encounters: count(state.encounters) };
}

/**
 * Hercules's Cottage (LITTLE_HARBOUR_v2 §2, "Making"): what his own room
 * holds, in **counts and never in contents**. Which pieces he has on, whose
 * look is on which shelf and what anybody wrote on a keepsake all stay behind
 * the doors that own them; the cottage only ever says how many.
 */
export type CottageReading = {
  /** His name, as the household set it. The one word here that is not a count. */
  name: string;
  /** Pieces he has on right now — filled slots, never which piece or which colour. */
  worn: number;
  /** Looks kept in the cabinet: the household's standing gallery rows. */
  looks: number;
  /** Keepsakes and toys standing on his shelves (the play room's filled slots). */
  keepsakes: number;
};
export const EMPTY_COTTAGE_READING: CottageReading = Object.freeze({ name: "Hercules", worn: 0, looks: 0, keepsakes: 0 });

/** The staged outfit's slots, then the legacy equipped four. Structural only: a count never needs the catalogue. */
function wornCount(household: CottageSource): number {
  const staged = household.playRoom?.stageOutfit?.value?.selections;
  if (staged && typeof staged === "object") {
    const filled = Object.values(staged as Record<string, unknown>).filter((slot) => slot && typeof slot === "object").length;
    if (filled > 0) return filled;
  }
  const equipped = household.kitchen?.companion?.equipped;
  if (!equipped || typeof equipped !== "object") return 0;
  return Object.values(equipped as Record<string, unknown>).filter((piece) => typeof piece === "string" && piece.length > 0).length;
}

/** What `buildCottageReading` needs, and no more: the shape, not the `Household`. */
type CottageSource = {
  kitchen?: { companion?: { name?: string; equipped?: unknown } };
  companionGallery?: unknown[];
  playRoom?: { slots?: unknown[]; stageOutfit?: { value?: { selections?: unknown } | null } | null };
};

/** Counts from the shared companion state. Pure, total: a household without one is an empty cottage. */
export function buildCottageReading(household: CottageSource): CottageReading {
  const name = household.kitchen?.companion?.name?.trim() || EMPTY_COTTAGE_READING.name;
  // A withdrawn gallery row and an empty shelf both carry a `null` value; neither is a kept thing.
  const standing = (rows: unknown): number =>
    Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object" && (row as { value?: unknown }).value != null).length : 0;
  return { name, worn: wornCount(household), looks: standing(household.companionGallery), keepsakes: standing(household.playRoom?.slots) };
}

/**
 * The Kiln (LITTLE_HARBOUR_v2 §2, the Making district): pottery, full screen —
 * a wheel, a workbench, the kiln itself and **a shelf of fired pieces**. The
 * shelf is a reading of the kitty banks the household has already sculpted,
 * painted and fired in the Studio (`core/kittyStudio.ts`): one little piece
 * per bank that has come out of the kiln, in that bank's own glaze, at that
 * bank's own growth step — the same ten steps the Loft and the Tower stand
 * their cats in. No money is read beyond that step, which the studio already
 * shows on every bank.
 *
 * **Private pieces are counts, never contents.** A design row filed
 * `personal` by the other member, or a goal that is neither shared nor yours,
 * is added to `keptPrivate` and nothing else — no name, no glaze, no date.
 */
export type FiredPiece = {
  /** `bank/<bankKey>` or `goal/<id>` — the door's object into the Studio, and the twin's key. */
  key: string;
  name: string;
  glaze: KittyGlaze;
  /** Which of the four the bank stands under, or null for a bank the nest has not sorted. */
  category: NestCategory | null;
  /** 0–10, the studio's own backing step. 0 is resting clay, never a fault. */
  step: number;
  /** How many pieces this bank has taken out of the kiln. */
  firings: number;
  /** The day this bank last came out of the kiln, when the piece carries one. */
  firedOn: DateKey | null;
};
export type KilnReading = {
  /** The shelves, newest firing first. Capped for the room; the Studio holds the rest. */
  pieces: FiredPiece[];
  /** Fired pieces this member may see. */
  fired: number;
  /** Fired pieces on somebody else's own shelf: a count, and nothing else. */
  keptPrivate: number;
  /** Drafts still on the wheel — clay, not yet fired. */
  onTheWheel: number;
  /** The last day anything came out of the kiln, of the pieces this member may see. */
  lastFiredOn: DateKey | null;
  /** Days since that firing; 0 is today, null when nothing has ever been fired. */
  sinceFiring: number | null;
  /** How warm the kiln still is, 1 on the firing day fading to 0 over `KILN_WARM_DAYS`. */
  warmth: number;
  /** Pieces the shelf could not stand (over the cap). */
  overflow: number;
};

/** The shelf stands at most this many pieces; the Studio holds every one. */
export const KILN_SHELF_CAP = 12;
/** The bricks keep the heat about a week; the glow fades day by day. */
export const KILN_WARM_DAYS = 7;
/** A cold kiln, a swept shelf, nothing on the wheel. */
export const EMPTY_KILN_READING: KilnReading = Object.freeze({
  pieces: [], fired: 0, keptPrivate: 0, onTheWheel: 0, lastFiredOn: null, sinceFiring: null, warmth: 0, overflow: 0,
}) as KilnReading;

const firedDay = (at: string | null | undefined): DateKey | null => {
  if (typeof at !== "string" || at.length < 10) return null;
  const day = at.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? (day as DateKey) : null;
};
const laterDay = (a: DateKey | null, b: DateKey | null): DateKey | null =>
  a === null ? b : b === null ? a : compareDateKeys(a, b) >= 0 ? a : b;

/**
 * The shelf of fired pieces. Pure and total: it reads the design rows and the
 * goals' own envelopes, never the design documents, never the books. A
 * household with no studio work is a swept shelf and a cold kiln, which is a
 * state and not a fault.
 */
export function buildKilnReading(household: Household, memberId: string, today: DateKey): KilnReading {
  const pieces: FiredPiece[] = [];
  let keptPrivate = 0;
  let onTheWheel = 0;
  let lastFiredOn: DateKey | null = null;

  for (const row of household.kittyNestDesigns ?? []) {
    // A design row is the member's to see when the household shares it, or when it is their own.
    const visible = row.visibility === "household" || row.createdBy === memberId;
    const fired = row.studio?.fired ?? [];
    const firings = fired.length > 0 ? fired.length : row.designHasFired ? 1 : 0;
    if (!visible) { keptPrivate += firings; continue; }
    if (row.studio?.draft) onTheWheel += 1;
    if (firings === 0) continue;
    const firedOn = fired.reduce<DateKey | null>((latest, piece) => laterDay(latest, firedDay(piece.firedAt)), null);
    lastFiredOn = laterDay(lastFiredOn, firedOn);
    pieces.push({ key: `bank/${row.bankKey}`, name: row.name || "A bank", glaze: row.glaze, category: row.category, step: 0, firings, firedOn });
  }

  for (const goal of household.goals ?? []) {
    const studio = goal.envelope?.studio;
    if (!studio) continue;
    const visible = goal.shared || goal.ownerMemberId === memberId;
    const firings = studio.fired.length;
    if (!visible) { keptPrivate += firings; continue; }
    if (studio.draft) onTheWheel += 1;
    if (firings === 0) continue;
    const firedOn = studio.fired.reduce<DateKey | null>((latest, piece) => laterDay(latest, firedDay(piece.firedAt)), null);
    lastFiredOn = laterDay(lastFiredOn, firedOn);
    pieces.push({
      key: `goal/${goal.id}`,
      name: goal.name || "A bank",
      glaze: goal.envelope?.glaze ?? "cream",
      category: kilnCategoryOf(goal),
      step: kittyBankBackingStep(household, goal, today),
      firings,
      firedOn,
    });
  }

  // Newest out of the kiln stands nearest the door; an undated piece waits behind the dated ones.
  pieces.sort((a, b) =>
    (a.firedOn && b.firedOn ? compareDateKeys(b.firedOn, a.firedOn) : a.firedOn ? -1 : b.firedOn ? 1 : 0) || a.name.localeCompare(b.name));
  const standing = pieces.slice(0, KILN_SHELF_CAP);
  const sinceFiring = lastFiredOn === null ? null : Math.max(0, daysBetween(lastFiredOn, today));
  const warmth = sinceFiring === null ? 0 : Math.max(0, Math.min(1, 1 - sinceFiring / KILN_WARM_DAYS));
  return {
    pieces: standing,
    fired: pieces.reduce((sum, piece) => sum + piece.firings, 0),
    keptPrivate,
    onTheWheel,
    lastFiredOn,
    sinceFiring,
    warmth,
    overflow: pieces.length - standing.length,
  };
}

/** A goal's bank stands under the envelope's own kind; a bank without an envelope is unsorted. */
function kilnCategoryOf(goal: Goal): NestCategory | null {
  const kind = goal.envelope?.kind;
  return kind === "protect" || kind === "everyday" || kind === "prepare" || kind === "build" ? kind : null;
}

// ── The Campfire (LITTLE_HARBOUR_v2 §6): the monthly close ──────────────────

/**
 * The Campfire on the shore in front of the Boathouse — the one ritual that
 * needs two people. The month's Chapter closes here, in the paired review
 * `docs/DECISIONS.md` describes: the first agreement leaves it open, the final
 * agreement closes it and opens the reviewed successor atomically. **Nothing
 * closes on its own** — `chapterReminder` repeats until a Sitdown does it.
 *
 * This reading is names and counts only: whose seat is filled, how many stones
 * are on the path, how long since the last one was laid. Not one cent of the
 * month ever reaches the fire.
 */

/** Where the month's paired review stands, in the ring's own words. */
export type CampfireClose =
  /** Nothing proposed: the Chapter is open and the fire is only company. */
  | "none"
  /** A closure is on the table and this reader has not yet agreed to it. */
  | "proposed"
  /** This reader has agreed; the other seat is still empty. */
  | "awaiting-partner"
  /** A Chapter closed within the last few days: the fresh stone is still warm. */
  | "sealed";

/** One place at the fire: a member of the reviewed audience, and whether they have sat. */
export type CampfireSeat = { memberId: string; name: string; seated: boolean };

export type CampfireReading = {
  /** The open Chapter's month, or null when no Chapter is open. */
  month: MonthKey | null;
  /** The open Chapter's title — the couple's own words, never a figure. */
  title: string | null;
  close: CampfireClose;
  /** The ring, in the audience's own order. Two seats for two people. */
  seats: CampfireSeat[];
  /** How many of those seats are filled. */
  seated: number;
  /** Stones on the path of months: Chapters that have closed. */
  stones: number;
  /**
   * The first Sitdown ever happened. Until it does the fire is unlit kindling;
   * after it, the first campfire stays warm forever and never goes fully cold.
   */
  lit: boolean;
  /** The day the last Chapter closed. */
  lastClosedOn: DateKey | null;
  /** Days since that close; 0 is today, null when nothing has ever closed. */
  sinceClose: number | null;
  /** The seal's own glow, 1 on the closing day fading to 0 over `CAMPFIRE_SEAL_DAYS`. */
  seal: number;
  /** The open Chapter's month has ended and no Sitdown has closed it yet. */
  overdue: boolean;
};

/** The fresh stone keeps its glow about three days, and the embers rise with it. */
export const CAMPFIRE_SEAL_DAYS = 3;
/** The ring lays at most this many stones on the path; Journey holds every month. */
export const CAMPFIRE_STONE_CAP = 12;
/** A shore with nobody on it: unlit kindling, no stones, no Chapter open. */
export const EMPTY_CAMPFIRE_READING: CampfireReading = Object.freeze({
  month: null, title: null, close: "none", seats: [], seated: 0, stones: 0,
  lit: false, lastClosedOn: null, sinceClose: null, seal: 0, overdue: false,
}) as CampfireReading;

/** What `buildCampfireReading` needs, and no more. */
type CampfireSource = Pick<Household, "chapters"> & { members?: { id: string; name?: string; active?: boolean }[] };

/**
 * The fire, read. Pure and total: it reads the Chapters and the consent
 * history already on them, writes nothing, and never opens or closes
 * anything. A household that has never sat down reads as unlit kindling,
 * which is a beginning and not a fault.
 */
export function buildCampfireReading(household: CampfireSource, memberId: string, today: DateKey): CampfireReading {
  const chapters = household.chapters ?? [];
  const members = household.members ?? [];
  const nameOf = (id: string): string => members.find((row) => row.id === id)?.name?.trim() || "Someone";
  const open = openChapterFor({ chapters } as never);
  const closed = chapters.filter((row) => row.closedAt !== null);
  const lastClosedOn = closed.reduce<DateKey | null>((latest, row) => laterDay(latest, firedDay(row.closedAt)), null);
  const sinceClose = lastClosedOn === null ? null : Math.max(0, daysBetween(lastClosedOn, today));
  const seal = sinceClose === null ? 0 : Math.max(0, Math.min(1, 1 - sinceClose / CAMPFIRE_SEAL_DAYS));

  const ring = (audience: readonly string[], approvals: readonly { memberId: string }[]): CampfireSeat[] => {
    const sat = new Set(approvals.map((row) => row.memberId));
    return audience.map((id) => ({ memberId: id, name: nameOf(id), seated: sat.has(id) }));
  };
  const everyone = (seated: boolean): CampfireSeat[] => members
    .filter((row) => row.active !== false)
    .map((row) => ({ memberId: row.id, name: row.name?.trim() || "Someone", seated }));

  let close: CampfireClose = "none";
  let seats: CampfireSeat[] = everyone(false);
  const pending = open ? pendingChapterClosure(open) : null;
  if (pending) {
    // The review is on the table. Whoever has agreed is sitting; the fire waits for the rest.
    seats = ring(pending.audience, pending.approvals);
    close = pending.approvals.some((row) => row.memberId === memberId) ? "awaiting-partner" : "proposed";
  } else if (seal > 0) {
    // A Chapter closed within the seal window: the final agreement is a fact,
    // so the ring stands as the accepted review recorded it.
    const sealed = closed.filter((row) => firedDay(row.closedAt) === lastClosedOn)
      .sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? "")).at(-1) ?? null;
    const accepted = acceptedClosure(sealed);
    seats = accepted ? ring(accepted.audience, accepted.approvals) : everyone(true);
    close = "sealed";
  }

  return {
    month: open ? chapterMonth(open) : null,
    title: open ? open.title || null : null,
    close,
    seats,
    seated: seats.filter((seat) => seat.seated).length,
    stones: closed.length,
    lit: closed.length > 0,
    lastClosedOn,
    sinceClose,
    seal,
    overdue: chapterReminder({ chapters } as never, { today }) !== null,
  };
}

/** The review both of them agreed to, when the Chapter carries one. */
function acceptedClosure(chapter: Chapter | null) {
  const consent = chapter?.closure;
  if (!consent || !consent.acceptedProposalId) return null;
  return consent.proposals.find((row) => row.id === consent.acceptedProposalId) ?? null;
}

export const HARBOUR_SLIP_LINES = 3;
/** The cistern never reads bone dry: a well with nothing in it still shows a dark ring (BUILD_PLAN_SLICE2 §4). */
export const CISTERN_FLOOR = 0.06;

const daysBetween = (from: DateKey, to: DateKey): number =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Where each pulse destination sends you, in the house's own door names. */
const PULSE_TARGETS: Record<FundPulseDestination, { target: HouseTargetId; next: string }> = {
  fund: { target: "cellar-bills", next: "Read the bill jars." },
  together: { target: "encounters", next: "Spend a moment together." },
  path: { target: "journey", next: "Step into Journey." },
  status: { target: "more", next: "Open Status." },
};

/**
 * The next dated commitment, in the plan's order: (a) the first Fund bill that
 * is short, (b) the first unpaid flow item dated today or later, (c) the
 * earliest open nest bank with a date today or later. Bills go to the cellar,
 * goals to the loft. Contributions are not commitments.
 */
export function nextCommitment(snapshot: Pick<FundSnapshot, "prepare" | "flow">, nest: Pick<KittyNest, "categories">, today: DateKey): HarbourReading["next"] {
  const shortOn = snapshot.prepare.shortOn;
  if (shortOn) {
    const bill = snapshot.prepare.fundBills.find((row) => row.name === shortOn.label && row.date === shortOn.date)
      ?? snapshot.prepare.bills.find((row) => row.name === shortOn.label && row.date === shortOn.date);
    return { label: shortOn.label, date: shortOn.date, cents: bill?.targetCents ?? shortOn.shortCents, daysAhead: daysBetween(today, shortOn.date), target: "cellar-bills" };
  }
  const flow = snapshot.flow.find((item: FlowItem) => item.kind !== "contribution" && item.date >= today && item.state !== "paid" && item.amountCents !== null);
  if (flow) return { label: flow.label, date: flow.date, cents: flow.amountCents ?? 0, daysAhead: daysBetween(today, flow.date), target: flow.kind === "goal" ? "loft-banks" : "cellar-bills" };
  const bank = nest.categories
    .flatMap((category) => category.children)
    .filter((row: NestBank): row is NestBank & { date: DateKey } => row.date !== null && row.date >= today && row.state === "open")
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))[0];
  if (bank) return { label: bank.name, date: bank.date, cents: bank.targetCents, daysAhead: daysBetween(today, bank.date), target: bank.tier === "bill" ? "cellar-bills" : "loft-banks" };
  return null;
}

/**
 * What she noticed. A pulse need (`reset`, `needs-us`, `checking`) raises the
 * flag with the pulse's own words and destination; only when the pulse is
 * `covered` or `building` may Hercules's shoulder-tap take the mailbox.
 */
export function noticedItem(pulse: Pick<FundPulse, "state" | "headline" | "detail" | "destination">, hercules: HerculesNotice | null): HarbourReading["noticed"] {
  if (pulse.state === "reset" || pulse.state === "needs-us" || pulse.state === "checking") {
    const route = PULSE_TARGETS[pulse.destination];
    return { fact: `${pulse.headline} ${pulse.detail}`.trim(), next: route.next, target: route.target, source: "pulse" };
  }
  if (hercules && hercules.action !== "none") {
    const next = hercules.action === "acceptPreset" ? "Save it as a preset with Hercules." : "Review it with Hercules.";
    return { fact: hercules.spoken, next, target: "hercules", source: "hercules" };
  }
  return null;
}


// ---- slice 2: the tower, the cellar, the cistern ---------------------------

/** The empty tower: no shelves, no jug, no gun. What a place reads before the books arrive. */
export const EMPTY_TOWER_READING: TowerReading = Object.freeze({
  shelves: [], jug: { safeCents: 0, custodian: false, holder: null }, gun: { available: false }, largestTargetCents: 0, smallestTargetCents: 0,
}) as TowerReading;
/** The empty cellar: a dry rail, no days, no scale. */
export const EMPTY_CELLAR_READING: CellarReadingView = Object.freeze({
  jars: [], days: [], todayIndex: 0, prepareCents: null, scaleCents: 0,
}) as CellarReadingView;
/** The empty cistern: nothing known, the stone dark to the old line. */
export const EMPTY_CISTERN_READING: CisternReading = Object.freeze({ cents: null, target: 0, level: CISTERN_FLOOR }) as CisternReading;
/** A glasshouse with clean benches: no pots, nothing harvested, no perennials yet. */
export const EMPTY_GLASSHOUSE_READING: GlasshouseReading = Object.freeze({ pots: [], harvested: 0, perennials: [], dry: 0, overflow: 0 });

/**
 * The Rook's Tower: the rack as it stands (`rackSettled` over the loft's own
 * shelf order), each shelf's brass share and pin, and one bank per key with
 * the studio's 0–10 backing step. A shelf is `full` when every bank on it has
 * reached the shelf's pin — the same room the pour computes, at zero poured.
 *
 * The tower stands exactly what `QueenLoft` stands: the Build ledge
 * (`queenShelf`), not every open goal bank in the nest. A household whose
 * goals are filed under Protect or Everyday therefore has a bare tower and an
 * honest one — tapping a bank here opens the Loft at that bank, so the tower
 * may never show a bank the Loft does not have.
 */
export function buildTowerReading(household: Household, memberId: string, today: DateKey, nest: Pick<KittyNest, "categories">): TowerReading {
  const order = queenShelfOrder(household.kittyNestDesigns);
  const shelf = queenShelf(nest, household, order);
  const stored = household.kittyNestDesigns?.find((row) => row.bankKey === QUEEN_SHELF_BANK_KEY && row.visibility === "household")?.rack as QueenRackV1 | undefined;
  const rack = rackSettled(stored, shelf.map((item) => item.designKey), order);
  const byKey = new Map(shelf.map((item) => [item.designKey, item] as const));
  const towerBank = (item: QueenShelfItem): TowerBank => ({
    key: item.designKey,
    goalId: item.goalId,
    name: item.name,
    cents: item.bank.amountCents ?? 0,
    targetCents: Math.max(0, item.bank.targetCents),
    step: item.bank.goal ? kittyBankBackingStep(household, item.bank.goal, today) : item.step,
    category: item.bank.category ?? "build",
    sculptSeed: item.designKey,
  });
  const shelves: TowerShelf[] = rack.shelves.map((row) => {
    const banks = row.keys.flatMap((key) => { const item = byKey.get(key); return item ? [towerBank(item)] : []; });
    const room = banks.reduce((sum, bank) => sum + Math.max(0, Math.round((bank.targetCents * row.cutoff) / RACK_LIMITS.marks) - bank.cents), 0);
    return { id: row.id, share: row.share, cutoff: row.cutoff, full: room === 0, banks };
  });
  const targets = shelves.flatMap((row) => row.banks).map((bank) => bank.targetCents).filter((cents) => cents > 0);
  const fund = household.householdFund ?? null;
  const backingKnown = nest.categories.every((bank) => bank.amountCents !== null);
  let safeCents = 0;
  if (fund && backingKnown) { try { safeCents = Math.max(0, projectHouseholdFund(household, today).safeRolloverCents); } catch { safeCents = 0; } }
  const custodian = Boolean(fund && backingKnown && fund.custodianMemberId === memberId);
  const holder = fund ? household.members.find((row) => row.id === fund.custodianMemberId)?.name ?? null : null;
  return {
    shelves,
    jug: { safeCents, custodian, holder },
    gun: { available: custodian },
    largestTargetCents: targets.length ? Math.max(...targets) : 0,
    smallestTargetCents: targets.length ? Math.min(...targets) : 0,
  };
}

/** A jar's state, exactly as the vision words it: frosted = planned, solid = set aside, cleanly shattered = paid, cracked only on a confirmed shortfall. */
export function jarState(jar: Pick<CellarJar, "paid" | "full" | "strike">): CellarJarReading["state"] {
  if (jar.paid) return "paid";
  if (jar.strike === "crack") return "short";
  return jar.full ? "set-aside" : "planned";
}

/** The umbrella whose bank stands inside the jar, or null before the money model sorted the household (and for the two umbrellas that have no bank). */
export function jarUmbrella(jar: Pick<CellarJar, "umbrellaId">): UmbrellaBankId | null {
  const id = jar.umbrellaId;
  if (!id || id === "coming-in" || id === "moving-money") return null;
  return id;
}

/**
 * The Cellar: the month's jars, the Prepare water day by day, and the one
 * dollar scale both stand on — the larger of the biggest jar and the prepare
 * balance, so $1,000 of water is exactly a $1,000 jar's height.
 */
export function buildCellarReading(household: Household, memberId: string, today: DateKey, nest: Pick<KittyNest, "categories" | "history">, prepareCents: number | null): CellarReadingView {
  const jars = cellarJars(nest, household, today);
  const marks = new Set(missingSubscriptions(household, { today, memberId }).open.map((entry) => entry.recurrenceId));
  const rows: CellarJarReading[] = jars.map((jar) => ({
    key: jar.id,
    label: jar.label,
    umbrella: jarUmbrella(jar),
    amountCents: jar.targetCents,
    fill: jar.fill,
    state: jarState(jar),
    size: jar.size,
    due: jar.date,
    missingMark: jar.type === "subscription" && jar.recurrenceId !== null && marks.has(jar.recurrenceId),
  }));
  const days = cellarDays(fundWalk(household, monthKeyFromDateKey(today), today), today)
    .map((day) => ({ date: day.date, balanceCents: day.balanceCents, belowBuffer: day.belowBuffer, today: day.today }));
  const found = days.findIndex((day) => day.today);
  const biggest = rows.reduce((top, row) => Math.max(top, row.amountCents), 0);
  // The room's ruler has to hold everything the room draws. The month's water is walked
  // day by day, and its crest is routinely above the standing balance — a ruler that
  // stopped at the balance pinned the cistern to the top of its glass for half the month.
  const crest = days.reduce((top, day) => Math.max(top, day.balanceCents), 0);
  return {
    jars: rows,
    days,
    todayIndex: found < 0 ? 0 : found,
    prepareCents,
    scaleCents: Math.max(biggest, prepareCents ?? 0, crest),
  };
}

/** The cistern beside the Knight: Protect against its target, clamped so an empty well still shows a dark ring of water. */
export function buildCisternReading(protect: { cents: number | null; target: number }): CisternReading {
  const level = protect.cents === null || protect.target <= 0
    ? CISTERN_FLOOR
    : Math.max(CISTERN_FLOOR, Math.min(1, protect.cents / protect.target));
  return { cents: protect.cents, target: protect.target, level };
}

/** One pure read for the whole Court. `freshness` comes from the app's sync layer; core has no transport knowledge. */
export function buildHarbourReading(household: Household, memberId: string, today: DateKey, freshness: FundPulseFreshness): HarbourReading {
  const snapshot = fundSnapshot(household, { memberId, view: "household", today });
  const nest = projectKittyNest(household, memberId, "household", today);
  const pulse = fundPulse(deriveFundPulseInput(household, { memberId, today, freshness, activeChapter: Boolean(openChapterFor(household)) }));
  const backingAvailable = nest.categories.every((bank) => bank.amountCents !== null);
  const condition = deriveHouseCondition(household, { memberId, today, freshness, growing: pulse.state === "building", backingAvailable });
  const banks = nest.categories.flatMap((category) => category.children).filter((bank) => bank.tier === "goal" && bank.state === "open").length;
  const jars = cellarJars(nest, household, today).length;
  const mode: 1 | 2 = (nest.mode ?? snapshot.mode) === 2 ? 2 : 1;
  return {
    everyday: snapshot.now,
    prepare: {
      cents: snapshot.prepare.amountCents,
      target: snapshot.prepare.targetCents,
      coveredThrough: snapshot.prepare.coveredThrough,
      ...(snapshot.prepare.shortOn ? { shortOn: snapshot.prepare.shortOn } : {}),
    },
    protect: { cents: snapshot.protect.amountCents, target: snapshot.protect.targetCents },
    build: { cents: snapshot.build.amountCents, target: snapshot.build.targetCents, goals: snapshot.build.goals.length },
    next: nextCommitment(snapshot, nest, today),
    noticed: noticedItem(pulse, bubbleNotice(household, today)),
    slip: presenceLines(household, { memberId, today }).slice(0, HARBOUR_SLIP_LINES).map((line) => line.text),
    condition,
    glaze: queenGlazeFor(freshness),
    banks,
    jars,
    mode,
    freshness,
    glasshouse: buildGlasshouseReading(household, memberId, today),
    kitchen: buildKitchenReading(household, memberId, today),
    boathouse: buildBoathouseReading(household),
    cottage: buildCottageReading(household),
    kiln: buildKilnReading(household, memberId, today),
    campfire: buildCampfireReading(household, memberId, today),
    tower: buildTowerReading(household, memberId, today, nest),
    cellar: buildCellarReading(household, memberId, today, nest, snapshot.prepare.amountCents),
    cistern: buildCisternReading({ cents: snapshot.protect.amountCents, target: snapshot.protect.targetCents }),
  };
}
