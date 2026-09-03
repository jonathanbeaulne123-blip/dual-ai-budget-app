// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHAPE_MIN_MONTHS,
  catalogHousehold,
  categoryShape,
  postEntry,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const TODAY = "2026-09-17";
const MONTH = "2026-09";

function spend(
  household: Household,
  subcategoryId: string,
  amount: string,
  date: string,
  visibility: "household" | "personal" = "household",
): Household {
  return postEntry(household, {
    date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId,
    note: "test spend", createdBy: BIANCA, visibility, confirmDuplicate: true,
  }).household;
}

/**
 * Six categories, one for each verdict the workshop itself illustrates:
 * Groceries and Coffee both run over their own trailing shape (Groceries
 * the worse of the two), Electric and Fuel sit inside it, Fun has gone
 * quiet against a real history, Vet is a single posting with no history
 * at all, and Dental has only two of the three trailing months on record.
 */
function canonicalMonth(): Household {
  let household = catalogHousehold();
  household = spend(household, "SUB-FOOD-GROCERIES", "600", "2026-06-10");
  household = spend(household, "SUB-FOOD-GROCERIES", "620", "2026-07-10");
  household = spend(household, "SUB-FOOD-GROCERIES", "580", "2026-08-10");
  household = spend(household, "SUB-FOOD-GROCERIES", "800", "2026-09-05");

  household = spend(household, "SUB-FOOD-COFFEE", "100", "2026-06-11");
  household = spend(household, "SUB-FOOD-COFFEE", "110", "2026-07-11");
  household = spend(household, "SUB-FOOD-COFFEE", "90", "2026-08-11");
  household = spend(household, "SUB-FOOD-COFFEE", "156", "2026-09-06");

  household = spend(household, "SUB-HOUSING-ELECTRIC", "85", "2026-06-12");
  household = spend(household, "SUB-HOUSING-ELECTRIC", "95", "2026-07-12");
  household = spend(household, "SUB-HOUSING-ELECTRIC", "90", "2026-08-12");
  household = spend(household, "SUB-HOUSING-ELECTRIC", "90", "2026-09-07");

  household = spend(household, "SUB-TRANSPORT-FUEL", "140", "2026-06-13");
  household = spend(household, "SUB-TRANSPORT-FUEL", "150", "2026-07-13");
  household = spend(household, "SUB-TRANSPORT-FUEL", "145", "2026-08-13");
  household = spend(household, "SUB-TRANSPORT-FUEL", "145", "2026-09-08");

  household = spend(household, "SUB-LIFE-FUN", "60", "2026-06-14");
  household = spend(household, "SUB-LIFE-FUN", "70", "2026-07-14");
  household = spend(household, "SUB-LIFE-FUN", "65", "2026-08-14");
  // Nothing posted to Fun this September — that's the quiet stretch.

  household = spend(household, "SUB-HEALTH-VET", "215", "2026-09-09");
  // No prior history anywhere in the trailing window — the single posting is the whole story.

  household = spend(household, "SUB-HEALTH-DENTAL", "50", "2026-07-15");
  household = spend(household, "SUB-HEALTH-DENTAL", "60", "2026-08-15");
  household = spend(household, "SUB-HEALTH-DENTAL", "55", "2026-09-10");
  // June is silent — only two of the three trailing months have anything on record.

  return household;
}

function rowFor(rows: ReturnType<typeof categoryShape>, subcategoryId: string) {
  return rows.find((row) => row.subcategoryId === subcategoryId)!;
}

describe("categoryShape", () => {
  it("puts Groceries first, above its own trailing shape by $180.00", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    expect(rows[0]!.subcategoryId).toBe("SUB-FOOD-GROCERIES");
    expect(rows[0]!.verdict).toBe("above");
    expect(rows[0]!.deltaCents).toBe(18000);
    expect(rows[0]!.bandLowCents).toBe(58000);
    expect(rows[0]!.bandHighCents).toBe(62000);
    expect(rows[0]!.monthToDateCents).toBe(80000);
    expect(rows[0]!.monthsSeen).toBe(SHAPE_MIN_MONTHS);
  });

  it("Coffee is also above its shape, by less than Groceries, and sorts second", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    const coffee = rowFor(rows, "SUB-FOOD-COFFEE");
    expect(coffee.verdict).toBe("above");
    expect(coffee.deltaCents).toBe(4600);
    expect(rows.findIndex((row) => row.subcategoryId === "SUB-FOOD-COFFEE")).toBe(1);
  });

  it("Electric and Fuel sit inside their own shape", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    expect(rowFor(rows, "SUB-HOUSING-ELECTRIC").verdict).toBe("in-shape");
    expect(rowFor(rows, "SUB-HOUSING-ELECTRIC").deltaCents).toBe(0);
    expect(rowFor(rows, "SUB-TRANSPORT-FUEL").verdict).toBe("in-shape");
  });

  it("Fun has gone quiet against a real three-month history", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    const fun = rowFor(rows, "SUB-LIFE-FUN");
    expect(fun.verdict).toBe("quiet");
    expect(fun.monthToDateCents).toBe(0);
    expect(fun.deltaCents).toBe(0);
    expect(fun.monthsSeen).toBe(SHAPE_MIN_MONTHS);
  });

  it("Vet is a one-off — a single posting with no prior history at all", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    const vet = rowFor(rows, "SUB-HEALTH-VET");
    expect(vet.verdict).toBe("one-off");
    expect(vet.monthsSeen).toBe(0);
    expect(vet.deltaCents).toBe(0);
  });

  it("a two-month category is unknown, never extrapolated into a verdict", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    const dental = rowFor(rows, "SUB-HEALTH-DENTAL");
    expect(dental.verdict).toBe("unknown");
    expect(dental.monthsSeen).toBe(2);
    expect(dental.deltaCents).toBe(0);
  });

  it("sorts by deltaCents descending, then subcategoryId ascending on a tie", () => {
    let household = catalogHousehold();
    // Two categories, identical three-month band and identical overage — only the id breaks the tie.
    for (const id of ["SUB-TRANSPORT-FUEL", "SUB-HOUSING-ELECTRIC"]) {
      household = spend(household, id, "100", "2026-06-01");
      household = spend(household, id, "100", "2026-07-01");
      household = spend(household, id, "100", "2026-08-01");
      household = spend(household, id, "150", "2026-09-01");
    }
    const rows = categoryShape(household, MONTH, TODAY);
    const tied = rows.filter((row) => row.deltaCents === 5000);
    expect(tied.map((row) => row.subcategoryId)).toEqual(["SUB-HOUSING-ELECTRIC", "SUB-TRANSPORT-FUEL"]);
  });

  it("a category with nothing in any of the four windows never appears at all", () => {
    const rows = categoryShape(canonicalMonth(), MONTH, TODAY);
    expect(rows.some((row) => row.subcategoryId === "SUB-HEALTH-THERAPY")).toBe(false);
  });

  it("a personal-visibility posting never counts, and never surfaces a category on its own", () => {
    let household = catalogHousehold();
    household = spend(household, "SUB-LIFE-FUN", "9000", "2026-09-05", "personal");
    const rows = categoryShape(household, MONTH, TODAY);
    expect(rows.some((row) => row.subcategoryId === "SUB-LIFE-FUN")).toBe(false);
  });

  it("a refund nets against its category's spend, the same as monthSummary already treats it", () => {
    let household = catalogHousehold();
    household = spend(household, "SUB-FOOD-GROCERIES", "600", "2026-06-01");
    household = spend(household, "SUB-FOOD-GROCERIES", "600", "2026-07-01");
    household = spend(household, "SUB-FOOD-GROCERIES", "600", "2026-08-01");
    // $1,000 spent this month, $700 of it refunded — true net is $300, well under the band.
    const purchase = postEntry(household, {
      date: "2026-09-01", type: "expense", amount: "1000", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "big shop", createdBy: BIANCA,
      visibility: "household", confirmDuplicate: true,
    });
    household = postEntry(purchase.household, {
      date: "2026-09-02", type: "refund", amount: "700", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "returned", createdBy: BIANCA,
      visibility: "household", confirmDuplicate: true, refundOfId: purchase.postedIds[0]!,
    }).household;
    const rows = categoryShape(household, MONTH, TODAY);
    const groceries = rowFor(rows, "SUB-FOOD-GROCERIES");
    expect(groceries.monthToDateCents).toBe(30000);
    expect(groceries.verdict).toBe("quiet");
  });

  it("a personal posting is excluded even inside an otherwise-visible category's total", () => {
    let household = canonicalMonth();
    household = spend(household, "SUB-FOOD-GROCERIES", "5000", "2026-09-11", "personal");
    const rows = categoryShape(household, MONTH, TODAY);
    // The huge personal posting must not move Groceries' month-to-date figure at all.
    expect(rowFor(rows, "SUB-FOOD-GROCERIES").monthToDateCents).toBe(80000);
  });

  it("counts a fully refunded trailing month as real history", () => {
    let household = catalogHousehold();
    for (const month of ["06", "07", "08"]) {
      const purchase = postEntry(household, {
        date: `2026-${month}-02`, type: "expense", amount: "100", accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES", note: "shop", createdBy: BIANCA,
        visibility: "household", confirmDuplicate: true,
      });
      household = purchase.household;
      if (month === "07") {
        household = postEntry(household, {
          date: "2026-07-03", type: "refund", amount: "100", accountId: "ACC-VISA",
          subcategoryId: "SUB-FOOD-GROCERIES", note: "returned", createdBy: BIANCA,
          visibility: "household", confirmDuplicate: true, refundOfId: purchase.postedIds[0]!,
        }).household;
      }
    }
    household = spend(household, "SUB-FOOD-GROCERIES", "50", "2026-09-02");

    const groceries = rowFor(categoryShape(household, MONTH, TODAY), "SUB-FOOD-GROCERIES");
    expect(groceries.monthsSeen).toBe(SHAPE_MIN_MONTHS);
    expect(groceries.verdict).not.toBe("unknown");
  });
});

describe("keeps its fences", () => {
  const coreSource = readFileSync(resolve(process.cwd(), "src/core/categoryShape.ts"), "utf8");
  const stageSource = readFileSync(resolve(process.cwd(), "src/ShapeStage.tsx"), "utf8");

  it("categoryShape.ts never expresses a category against another category or a total", () => {
    expect(coreSource).not.toMatch(/percent|ratio|rank|of total/i);
    expect(coreSource).not.toMatch(/from ".\/commands\.ts"/);
  });

  it("ShapeStage.tsx is nothing you can tick off, and never writes", () => {
    expect(stageSource).not.toMatch(/checkbox/i);
    expect(stageSource).not.toMatch(/checked/i);
    expect(stageSource).not.toMatch(/complete/i);
    expect(stageSource).not.toMatch(/from ".\/core\/commands\.ts"/);
  });

  it("never labels quiet categories as in shape", () => {
    expect(stageSource).toContain("Nothing over shape");
    expect(stageSource).not.toContain('"In shape"');
  });
});
