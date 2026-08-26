import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogHousehold, parseFlinks, postEntry, prepareImportRows } from "../src/core/index.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/flinks-demo.json", import.meta.url), "utf8"));

describe("flinks intake adapter", () => {
  it("normalizes linked accounts and transactions into import rows", () => {
    const batch = parseFlinks(fixture, "TD Demo");
    expect(batch.rows.length).toBe(3);
    expect(batch.accounts).toHaveLength(2);
    expect(batch.rows.find((row) => row.note.includes("NO FRILLS"))).toEqual(expect.objectContaining({
      sourceKind: "flinks",
      accountLast4: "4821",
      currency: "CAD",
      suggestedType: "expense",
      note: "NO FRILLS #1234 TORONTO",
    }));
    expect(batch.rows.find((row) => row.note.includes("PAYROLL"))).toEqual(expect.objectContaining({
      suggestedType: "income",
      accountLast4: "4821",
    }));
    expect(batch.rows.find((row) => row.note.includes("TIM HORTONS"))).toEqual(expect.objectContaining({
      suggestedType: "expense",
      accountLast4: "4412",
    }));
  });

  it("prefills categories from the mapped account ledger history", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-05-01", 71], ["2026-06-01", 72], ["2026-07-01", 73]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-COFFEE",
        note: "Tim Hortons coffee",
        place: "Tim Hortons",
        createdBy: "MEM-002",
      }).household;
    }
    for (const [date, amount] of [["2026-05-01", 45], ["2026-06-01", 46], ["2026-07-01", 47]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-CHEQUING",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "No Frills groceries",
        place: "No Frills",
        createdBy: "MEM-002",
      }).household;
    }
    const batch = parseFlinks(fixture, "TD Demo");
    const rows = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: batch.rows,
    });
    const coffee = rows.find((row) => row.note.includes("TIM HORTONS"));
    const groceries = rows.find((row) => row.note.includes("NO FRILLS"));
    expect(coffee?.accountId).toBe("ACC-VISA");
    expect(coffee?.subcategoryId).toBe("SUB-FOOD-COFFEE");
    expect(groceries?.accountId).toBe("ACC-CHEQUING");
    expect(groceries?.subcategoryId).toBe("SUB-FOOD-GROCERIES");
  });
});
