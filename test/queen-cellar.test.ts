import { describe, expect, it } from "vitest";
import type { Household } from "../src/core/types.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addPotentialExpense, addRecurrence, postDueRecurrences, postEntry, recordHouseholdFundReconciliation } from "../src/core/commands.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { fundWalk } from "../src/core/fundWalk.ts";
import { formatCad } from "../src/core/money.ts";
import { cellarDays, cellarGateWords, cellarJarType, cellarJars, cellarReading, cellarStrike, type CellarJar } from "../src/core/queenCellar.ts";

const memberId = "MEM-001";

/** A fictional September with every kind of jar on the rail. Nothing here is real. */
function withRail(): Household {
  let h = planLifeFixture("household");
  h = recordHouseholdFundReconciliation(h, { memberId, date: "2026-09-12", bankTotal: "4000", personalRemainder: "0" }).household;
  // A subscription already paid this month — the shard.
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-08", type: "expense", amount: "16", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional streaming", kind: "subscription" }).household;
  h = postDueRecurrences(h, "2026-09-08", [h.recurrences.find((row) => row.note === "Fictional streaming")!.id], { createdBy: "MEM-002" }).household;
  // A house bill for the 15th, filling; the fixture's rent on the 20th; a planned expense for the 24th.
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-15", type: "expense", amount: "140", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional hydro", kind: "bill" }).household;
  h = addPotentialExpense(h, { date: "2026-09-24", title: "Fictional winter tires", amount: "480", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", createdBy: memberId, visibility: "household" }).household;
  // Something in October, which must not be on September's rail.
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-10-03", type: "expense", amount: "45", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional gym", kind: "other" }).household;
  return h;
}
const jarsOn = (h: Household, today: string) => cellarJars(projectKittyNest(h, memberId, "household", today), h, today);
const byLabel = (rows: CellarJar[], label: string) => rows.find((row) => row.label === label)!;

describe("The cellar's strike rule — Jonathan's, exactly", () => {
  it("hammer only when due and full, by hand; a crack when due and not full; a shard when paid elsewhere; nothing early", () => {
    expect(cellarStrike({ due: true, full: true, paid: false })).toBe("hammer");
    expect(cellarStrike({ due: true, full: false, paid: false })).toBe("crack");
    expect(cellarStrike({ due: true, full: true, paid: true })).toBe("shard");
    expect(cellarStrike({ due: true, full: false, paid: true })).toBe("shard");
    expect(cellarStrike({ due: false, full: true, paid: false })).toBe("none");
    expect(cellarStrike({ due: false, full: false, paid: false })).toBe("none");
  });
  it("only leans the hammer where the cellar can strike: a planned expense that is due and full has no hammer here", () => {
    expect(cellarStrike({ due: true, full: true, paid: false, payable: false })).toBe("none");
    expect(cellarStrike({ due: true, full: false, paid: false, payable: false })).toBe("crack");
  });
});

describe("The jars on the rail", () => {
  it("reads a jar's shape from its source: house bill, subscription, other recurring, planned, appointment", () => {
    const h = withRail();
    const find = (note: string) => h.recurrences.find((row) => row.note === note)!.id;
    expect(cellarJarType({ designKey: `recurrence:${find("Fictional hydro")}` }, h)).toBe("house");
    expect(cellarJarType({ designKey: `recurrence:${find("Fictional streaming")}` }, h)).toBe("subscription");
    expect(cellarJarType({ designKey: `recurrence:${find("Fictional gym")}` }, h)).toBe("recurring");
    expect(cellarJarType({ designKey: "potential:PLAN-EX-1" }, h)).toBe("potential");
    expect(cellarJarType({ designKey: "appointment:APPT-1" }, h)).toBe("appointment");
  });

  it("puts only this month's bills on the rail, in date order, with the paid one kept as a shard", () => {
    const rows = jarsOn(withRail(), "2026-09-12");
    expect(rows.map((row) => `${row.label} ${row.date}`)).toEqual([
      "Fictional streaming 2026-09-08",
      "Fictional hydro 2026-09-15",
      "Fictional rent 2026-09-20",
      "Fictional winter tires 2026-09-24",
    ]);
    const shard = byLabel(rows, "Fictional streaming");
    expect(shard.paid).toBe(true);
    expect(shard.strike).toBe("shard");
    expect(shard.savedCents).toBe(shard.targetCents);
    expect(rows.every((row) => row.id === `cellar:${row.bankId}`)).toBe(true);
  });

  it("an early jar just holds its water: full or not, no hammer before the day", () => {
    const rows = jarsOn(withRail(), "2026-09-12");
    for (const label of ["Fictional hydro", "Fictional rent", "Fictional winter tires"]) {
      const jar = byLabel(rows, label);
      expect(jar.due).toBe(false);
      expect(jar.strike).toBe("none");
      expect(jar.daysAway).toBeGreaterThan(0);
    }
    expect(byLabel(rows, "Fictional hydro").full).toBe(true);
  });

  it("carries the bank's saved and left as confirmation, never a new figure: fill is saved over target, left is the rest", () => {
    const h = withRail();
    const rows = jarsOn(h, "2026-09-12");
    const rent = byLabel(rows, "Fictional rent");
    expect(rent.savedCents + rent.leftCents).toBe(rent.targetCents);
    expect(rent.fill).toBeCloseTo(rent.savedCents / rent.targetCents, 6);
    const nest = projectKittyNest(h, memberId, "household", "2026-09-12");
    const bank = nest.categories.flatMap((c) => c.children).find((b) => b.id === rent.bankId)!;
    expect(rent.savedCents).toBe(Math.min(bank.amountCents, bank.targetCents));
    expect(rent.targetCents).toBe(bank.targetCents);
  });

  it("on the day: the full one takes the hammer, the unfilled one cracks, the planned one has no hammer here", () => {
    const rows = jarsOn(withRail(), "2026-09-20");
    const hydro = byLabel(rows, "Fictional hydro"), rent = byLabel(rows, "Fictional rent");
    expect(hydro.due && hydro.full).toBe(true);
    expect(hydro.strike).toBe("hammer");
    expect(hydro.recurrenceId).not.toBeNull();
    expect(hydro.obligationId).toBe(`recurrence:${hydro.recurrenceId}:2026-09-15`);
    expect(rent.due && !rent.full).toBe(true);
    expect(rent.strike).toBe("crack");
    const tires = jarsOn(withRail(), "2026-09-27").find((row) => row.label === "Fictional winter tires")!;
    expect(tires.due && tires.full).toBe(true);
    expect(tires.strike).toBe("none");
    expect(tires.recurrenceId).toBeNull();
  });

  it("a bill paid by hand somewhere else in the app becomes a shard, and the hammer is gone", () => {
    let h = withRail();
    const hydro = h.recurrences.find((row) => row.note === "Fictional hydro")!;
    h = postEntry(h, { type: "expense", date: "2026-09-15", amount: "140", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional hydro", createdBy: "MEM-002", visibility: "household", source: "recurring", sourceId: hydro.id }).household;
    const jar = byLabel(jarsOn(h, "2026-09-20"), "Fictional hydro");
    expect(jar.paid).toBe(true);
    expect(jar.strike).toBe("shard");
  });
});

describe("The water and the rehearsal", () => {
  it("draws the walk day by day from its own points, opening balance first, buffer and dry as the walk says", () => {
    const h = withRail();
    const walk = fundWalk(h, "2026-09", "2026-09-12");
    const days = cellarDays(walk, "2026-09-12");
    expect(days).toHaveLength(30);
    expect(days[0]!.date).toBe("2026-09-01");
    expect(days.find((day) => day.today)?.date).toBe("2026-09-12");
    const firstDay = walk.points.filter((point) => point.date <= "2026-09-01");
    expect(days[0]!.balanceCents).toBe(firstDay.length ? firstDay[firstDay.length - 1]!.balanceCents : walk.openingCents);
    const last = walk.points[walk.points.length - 1]!;
    expect(days[29]!.balanceCents).toBe(last.balanceCents);
    for (const day of days) {
      expect(day.belowBuffer).toBe(walk.belowBufferRuns.some((run) => day.date >= run.fromDate && day.date <= run.toDate));
      expect(day.dry).toBe(walk.dryDate !== null && day.date >= walk.dryDate);
    }
  });

  it("lifting a jar out is a rehearsal: the walk defers that obligation, the household is untouched", () => {
    const h = withRail();
    const before = JSON.stringify(h);
    const nest = projectKittyNest(h, memberId, "household", "2026-09-12");
    const plain = cellarReading(h, nest, "2026-09-12");
    const rent = byLabel(plain.jars, "Fictional rent");
    const lifted = cellarReading(h, nest, "2026-09-12", { deferObligationIds: [rent.obligationId!] });
    const on = (reading: typeof plain) => reading.days.find((day) => day.date === "2026-09-25")!.balanceCents;
    expect(on(lifted)).toBe(on(plain) + rent.targetCents);
    expect(JSON.stringify(h)).toBe(before);
    expect(lifted.jars).toEqual(plain.jars);
  });

  it("the crest is the month's high water, never below the buffer, so the water is drawn against something", () => {
    const h = withRail();
    const reading = cellarReading(h, projectKittyNest(h, memberId, "household", "2026-09-12"), "2026-09-12");
    expect(reading.crestCents).toBeGreaterThanOrEqual(reading.bufferCents);
    expect(reading.crestCents).toBe(Math.max(reading.bufferCents, ...reading.days.map((day) => day.balanceCents), 0));
    expect(reading.walk.monthKey).toBe("2026-09");
  });
});

describe("The line beneath the gate", () => {
  it("says the kind, the day, the saved and the water, and only as confirmation", () => {
    const h = withRail();
    const reading = cellarReading(h, projectKittyNest(h, memberId, "household", "2026-09-20"), "2026-09-20");
    const rent = byLabel(reading.jars, "Fictional rent");
    const day = reading.days.find((row) => row.date === rent.date)!;
    const words = cellarGateWords(rent, day, formatCad);
    expect(words).toMatch(/^Fictional rent · house bill · due today · /);
    expect(words).toContain(`${formatCad(rent.savedCents)} saved of ${formatCad(rent.targetCents)}, ${formatCad(rent.leftCents)} to be safe`);
    expect(words).toContain(`water at ${formatCad(day.balanceCents)} after`);
    const hydro = byLabel(reading.jars, "Fictional hydro");
    expect(cellarGateWords(hydro, reading.days.find((row) => row.date === hydro.date)!, formatCad)).toMatch(/5 days overdue · \$140\.00 saved, ready/);
    const shard = byLabel(reading.jars, "Fictional streaming");
    expect(cellarGateWords(shard, null, formatCad)).toBe("Fictional streaming · subscription · paid · $16.00 paid.");
    expect(cellarGateWords(null, reading.days[0]!, formatCad)).toBe("No jar on this day.");
    expect(cellarGateWords(null, null, formatCad)).toBe("Nothing on the rail this month.");
  });
});
