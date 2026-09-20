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
import { projectKittyNest, type KittyNest, type NestBank } from "../../core/kittyNest.ts";
import { bubbleNotice, type HerculesNotice } from "../../core/notices.ts";
import { cellarJars } from "../../core/queenCellar.ts";
import { queenGlazeFor, type QueenGlaze } from "../../core/queenPresentation.ts";
import type { Household } from "../../core/types.ts";

/** The 16 house tools (`TARGET_NAMES`, `src/house/navigation.ts`) plus the Status tab the pulse can point at. */
export type HouseTargetId =
  | "queen" | "loft-banks" | "cellar-bills" | "books" | "planner" | "calendar" | "journey" | "conversation"
  | "plan-studio" | "wishes" | "pottery" | "memories" | "letters" | "projector" | "hercules" | "encounters" | "more";

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
};

export const HARBOUR_SLIP_LINES = 3;

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
  };
}
