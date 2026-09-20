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
import type { DateKey } from "../../core/calendar.ts";
import { openChapterFor } from "../../core/chapters.ts";
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
import type { Household } from "../../core/types.ts";
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
};

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

/**
 * The Rook's Tower: the rack as it stands (`rackSettled` over the loft's own
 * shelf order), each shelf's brass share and pin, and one bank per key with
 * the studio's 0–10 backing step. A shelf is `full` when every bank on it has
 * reached the shelf's pin — the same room the pour computes, at zero poured.
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
  return {
    jars: rows,
    days,
    todayIndex: found < 0 ? 0 : found,
    prepareCents,
    scaleCents: Math.max(biggest, prepareCents ?? 0),
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
    tower: buildTowerReading(household, memberId, today, nest),
    cellar: buildCellarReading(household, memberId, today, nest, snapshot.prepare.amountCents),
    cistern: buildCisternReading({ cents: snapshot.protect.amountCents, target: snapshot.protect.targetCents }),
  };
}
