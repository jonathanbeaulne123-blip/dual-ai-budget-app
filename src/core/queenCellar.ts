import { addDays, daysInMonthKey, monthKeyFromDateKey, monthStartKey, type DateKey } from "./calendar.ts";
import { fundWalkWith, type FundWalk, type WalkHypothetical } from "./fundWalk.ts";
import type { KittyNest, NestBank } from "./kittyNest.ts";
import type { NestCategory } from "./kittyNestDesigns.ts";
import type { Household } from "./types.ts";

/**
 * The cellar as the Fund walk, walked.
 *
 * Pure display selectors over projections that already exist. The rail is
 * time; each bill is a jar on the rail at its due date; the water in the
 * cellar is `fundWalk`'s balance on the day in the gate. Nothing here posts,
 * sums money into a new figure, or grades a person. Amounts pass through as
 * confirmation for the line beneath the gate; the jar itself carries form.
 */

/** What kind of thing a jar is, read from its source. The shape says it; the words confirm it. */
export type CellarJarType = "house" | "subscription" | "recurring" | "potential" | "appointment";

/** What may be done to a jar in the gate. */
export type CellarStrike =
  /** Due and full: the hammer leans on the rail. Always by hand. */
  | "hammer"
  /** Due but not full: a crack. Paying strikes from the cellar's water, and the walk shows the buffer take it. */
  | "crack"
  /** Paid somewhere else in the app already: the shard stays as the beat. No hammer. */
  | "shard"
  /** Not due yet: the water sits, ready. Nothing to strike. */
  | "none";

/**
 * The three axes a jar is told apart on, each read from something the books
 * already hold and each a band, never a figure:
 *
 * - **form** is the purpose — a house bill, a recurring payment, a
 *   subscription, a planned expense, an appointment — and picks the cat's
 *   body (`BankForm` in the room and the flat twin).
 * - **hue** is the category group the bill is filed under (Housing, Food,
 *   Transport, Life, Health, Debt) and tints the clay; **finish** is the
 *   subcategory's place inside that group (Electric is the second Housing
 *   line, Household gas the third) and picks the glaze — plain, speckled,
 *   banded, crackled — so two bills of one group still read apart.
 * - **size** is one of five bands of how large the due is against the
 *   month's largest, so rent stands over a phone bill without either being
 *   readable as a number.
 */
export type CellarHue = "housing" | "food" | "transport" | "life" | "health" | "debt" | "clay";
export type CellarFinish = "plain" | "speckle" | "banded" | "crackle";
export type CellarSize = 1 | 2 | 3 | 4 | 5;

export type CellarJar = {
  id: string;
  bankId: string;
  label: string;
  date: DateKey;
  type: CellarJarType;
  category: NestCategory | null;
  /** The category group and line the bill is filed under, for the words and the tint. */
  groupName: string | null;
  lineName: string | null;
  hue: CellarHue;
  finish: CellarFinish;
  size: CellarSize;
  targetCents: number;
  savedCents: number;
  leftCents: number;
  /** 0–1: how high the water stands in the jar. */
  fill: number;
  /** Days from today; negative is overdue. */
  daysAway: number;
  due: boolean;
  full: boolean;
  paid: boolean;
  strike: CellarStrike;
  /** For a recurring bill: the recurrence the hammer posts. */
  recurrenceId: string | null;
  /** For a recurring bill this month: the obligation the walk can defer for a rehearsal. */
  obligationId: string | null;
};

export type CellarDay = { date: DateKey; day: number; balanceCents: number; belowBuffer: boolean; dry: boolean; today: boolean };

export type CellarReading = {
  monthKey: string;
  today: DateKey;
  jars: CellarJar[];
  days: CellarDay[];
  walk: FundWalk;
  bufferCents: number;
  /** The highest balance of the month, for drawing the water against. Never shown as a number. */
  crestCents: number;
};

/** The jar's shape from its source: a house bill is a crock, a subscription loops, a potential expense is a ghost. */
export function cellarJarType(bank: Pick<NestBank, "designKey">, household: Pick<Household, "recurrences">): CellarJarType {
  const [source, id] = bank.designKey.split(":");
  if (source === "potential") return "potential";
  if (source === "appointment") return "appointment";
  if (source === "recurrence") {
    const recurrence = household.recurrences.find((row) => row.id === id);
    if (recurrence?.kind === "subscription") return "subscription";
    if (recurrence?.kind === "bill") return "house";
    return "recurring";
  }
  return "recurring";
}

/**
 * The rule Jonathan set: the hammer only by hand, only when due and full; a
 * crack when due and not full; a shard when paid somewhere else in the app;
 * nothing early. The hammer only leans where the cellar can strike — a
 * recurring bill. A planned expense or an appointment is paid where it is
 * paid (Add, the floor); its jar still fills, cracks and shards here.
 */
export function cellarStrike(jar: Pick<CellarJar, "due" | "full" | "paid"> & { payable?: boolean }): CellarStrike {
  if (jar.paid) return "shard";
  if (!jar.due) return "none";
  if (!jar.full) return "crack";
  return jar.payable === false ? "none" : "hammer";
}

/** The category group's tint, read from its name. Unknown groups keep the bare clay. */
export function cellarHue(groupName: string | null | undefined): CellarHue {
  const name = (groupName ?? "").toLowerCase();
  if (/hous|home|rent|utilit|hydro|electric|gas|water|internet/.test(name)) return "housing";
  if (/food|grocer|eat|kitchen/.test(name)) return "food";
  if (/transport|car|transit|fuel|travel|vehicle/.test(name)) return "transport";
  if (/health|medic|dental|vet|care|therap/.test(name)) return "health";
  if (/debt|card|loan|interest|mortgage/.test(name)) return "debt";
  if (/life|fun|leisure|subscri|phone|personal|entertain/.test(name)) return "life";
  return "clay";
}

/** The category line's finish: its place among the active lines of its group, cycling through four glazes. */
export function cellarFinish(index: number): CellarFinish {
  return (["plain", "speckle", "banded", "crackle"] as const)[((index % 4) + 4) % 4]!;
}

/** Five bands of how large a due is against the month's largest. Bands, so no figure can be read off a size. */
export function cellarSize(targetCents: number, largestCents: number): CellarSize {
  if (largestCents <= 0 || targetCents <= 0) return 1;
  const ratio = targetCents / largestCents;
  return ratio >= 0.8 ? 5 : ratio >= 0.45 ? 4 : ratio >= 0.2 ? 3 : ratio >= 0.07 ? 2 : 1;
}

/** Where a bank's money is filed: the category line and its group, from the source the bank came from. */
function cellarFiling(bank: Pick<NestBank, "designKey">, household: Pick<Household, "recurrences" | "categories" | "potentialExpenses">): { groupName: string | null; lineName: string | null; hue: CellarHue; finish: CellarFinish } {
  const [source, id] = bank.designKey.split(":");
  const subcategoryId = source === "recurrence" ? household.recurrences.find((row) => row.id === id)?.subcategoryId
    : source === "potential" ? (household.potentialExpenses ?? []).find((row) => row.id === id)?.subcategoryId
      : null;
  const line = subcategoryId ? household.categories.find((row) => row.id === subcategoryId) : null;
  const group = line?.parentId ? household.categories.find((row) => row.id === line.parentId) : null;
  const siblings = group ? household.categories.filter((row) => row.parentId === group.id && row.active !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)) : [];
  const index = line ? Math.max(0, siblings.findIndex((row) => row.id === line.id)) : 0;
  return { groupName: group?.name ?? null, lineName: line?.name ?? null, hue: cellarHue(group?.name ?? line?.name), finish: cellarFinish(index) };
}

const daysBetween = (from: DateKey, to: DateKey) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** Every bill bank on the rail this month — open ones ahead, and the shards of the ones already paid. */
export function cellarJars(nest: Pick<KittyNest, "categories" | "history">, household: Pick<Household, "recurrences" | "categories" | "potentialExpenses">, today: DateKey): CellarJar[] {
  const monthKey = monthKeyFromDateKey(today);
  const rows: CellarJar[] = [];
  const bills = [
    ...nest.categories.flatMap((category) => category.children.filter((bank) => bank.tier === "bill" && bank.state === "open")),
    ...nest.history.filter((bank) => bank.tier === "bill" && bank.state === "broken"),
  ];
  const onRail = bills.filter((bank) => bank.date && monthKeyFromDateKey(bank.date) === monthKey);
  const largestCents = onRail.reduce((top, bank) => Math.max(top, bank.targetCents), 0);
  for (const bank of onRail) {
    if (!bank.date) continue;
    const [source, id] = bank.designKey.split(":");
    const targetCents = Math.max(0, bank.targetCents);
    const filing = cellarFiling(bank, household);
    const savedCents = bank.state === "broken" ? targetCents : Math.max(0, Math.min(targetCents, bank.amountCents));
    const paid = bank.state === "broken";
    const due = bank.date <= today;
    const full = targetCents > 0 && savedCents >= targetCents;
    const jar: CellarJar = {
      id: `cellar:${bank.id}`,
      bankId: bank.id,
      label: bank.name,
      date: bank.date,
      type: cellarJarType(bank, household),
      category: bank.category,
      groupName: filing.groupName,
      lineName: filing.lineName,
      hue: filing.hue,
      finish: filing.finish,
      size: cellarSize(targetCents, largestCents),
      targetCents,
      savedCents,
      leftCents: Math.max(0, targetCents - savedCents),
      fill: targetCents > 0 ? savedCents / targetCents : 0,
      daysAway: daysBetween(today, bank.date),
      due,
      full,
      paid,
      strike: "none",
      recurrenceId: source === "recurrence" ? id ?? null : null,
      obligationId: source === "recurrence" ? `recurrence:${id}:${bank.date}` : null,
    };
    jar.strike = cellarStrike({ ...jar, payable: jar.recurrenceId !== null });
    rows.push(jar);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

/** The month's water, day by day, with the walk's own buffer and dry reading. */
export function cellarDays(walk: FundWalk, today: DateKey): CellarDay[] {
  const monthKey = walk.monthKey;
  const start = monthStartKey(monthKey);
  const count = daysInMonthKey(monthKey);
  const days: CellarDay[] = [];
  let balance = walk.openingCents;
  let index = 0;
  for (let day = 1; day <= count; day += 1) {
    const date = addDays(start, day - 1);
    while (index < walk.points.length && walk.points[index]!.date <= date) { balance = walk.points[index]!.balanceCents; index += 1; }
    days.push({
      date,
      day,
      balanceCents: balance,
      belowBuffer: walk.belowBufferRuns.some((run) => date >= run.fromDate && date <= run.toDate),
      dry: walk.dryDate !== null && date >= walk.dryDate,
      today: date === today,
    });
  }
  return days;
}

/**
 * The whole room in one reading. `hypothetical` is the rehearsal: a jar lifted
 * out of the rail is an obligation the walk defers, and nothing is written.
 */
export function cellarReading(household: Household, nest: Pick<KittyNest, "categories" | "history">, today: DateKey, hypothetical: WalkHypothetical = {}): CellarReading {
  const monthKey = monthKeyFromDateKey(today);
  const walk = fundWalkWith(household, monthKey, today, hypothetical);
  const days = cellarDays(walk, today);
  return {
    monthKey,
    today,
    jars: cellarJars(nest, household, today),
    days,
    walk,
    bufferCents: walk.bufferCents,
    crestCents: Math.max(walk.bufferCents, ...days.map((day) => day.balanceCents), 0),
  };
}

/** The line beneath the gate, in words. Amounts here are confirmation, the way a peek carries them. */
export function cellarGateWords(jar: CellarJar | null, day: CellarDay | null, format: (cents: number) => string): string {
  if (!jar) return day ? (day.dry ? "The cellar runs dry here." : day.belowBuffer ? "The water is under the mark here." : "No jar on this day.") : "Nothing on the rail this month.";
  const when = jar.paid ? "paid" : jar.daysAway === 0 ? "due today" : jar.daysAway < 0 ? `${-jar.daysAway} ${jar.daysAway === -1 ? "day" : "days"} overdue` : `in ${jar.daysAway} ${jar.daysAway === 1 ? "day" : "days"}`;
  const kind = `${jar.type === "house" ? "house bill" : jar.type === "subscription" ? "subscription" : jar.type === "potential" ? "planned, not posted" : jar.type === "appointment" ? "appointment" : "recurring payment"}${jar.groupName ? ` · ${jar.groupName}${jar.lineName && jar.lineName !== jar.groupName ? ` › ${jar.lineName}` : ""}` : ""}`;
  const saved = jar.paid ? `${format(jar.targetCents)} paid` : jar.full ? `${format(jar.targetCents)} saved, ready` : `${format(jar.savedCents)} saved of ${format(jar.targetCents)}, ${format(jar.leftCents)} to be safe`;
  const water = day ? (day.dry ? "the cellar is dry here" : day.belowBuffer ? "the water is under the mark here" : `water at ${format(day.balanceCents)} after`) : "";
  return `${jar.label} · ${kind} · ${when} · ${saved}${water ? ` · ${water}` : ""}.`;
}
