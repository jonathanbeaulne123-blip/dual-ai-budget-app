import { describe, expect, it } from "vitest";
import { catalogHousehold, postEntry, type Household } from "../src/core/index.ts";
import { offeredForNewSpending, UMBRELLAS } from "../src/core/fundRules.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { ALEX, fundedHousehold, migrated } from "./fixtures/fund-model.ts";

/** D-281, review M4: card payments are moving money, not spending, once sorted. Fictional books only. */
const spend = (h: Household, amount: number, subcategoryId: string) =>
  postEntry(h, { date: "2026-10-03", type: "expense", amount, accountId: "ACC-CHEQUING", subcategoryId, createdBy: ALEX, note: "Fictional", confirmDuplicate: true }).household;

describe("card payments under the money model", () => {
  it("are offered for new spending before sorting, hidden after, and kept on a form that already has them", () => {
    const v1 = catalogHousehold();
    expect(offeredForNewSpending(v1, "SUB-DEBT-VISA")).toBe(true);
    const v2 = migrated(catalogHousehold());
    expect(offeredForNewSpending(v2, "SUB-DEBT-VISA")).toBe(false);
    expect(offeredForNewSpending(v2, "SUB-DEBT-VISA", "SUB-DEBT-VISA")).toBe(true);
    expect(offeredForNewSpending(v2, "SUB-FOOD-GROCERIES")).toBe(true);
  });

  it("never dilute an umbrella's share on the island", () => {
    const base = spend(migrated(fundedHousehold("2000")), 100, "SUB-FOOD-GROCERIES");
    const withCard = spend(base, 900, "SUB-DEBT-VISA");
    const month = (h: Household) => pathMonths(h, "2026-10-20").find((row) => row.key === "2026-10")!;
    expect(month(withCard).umbrellas).toEqual(month(base).umbrellas);
    expect(month(withCard).umbrellas).not.toHaveProperty("moving-money");
  });

  it("the Moving money rule says what the totals do", () => {
    expect(UMBRELLAS.find((row) => row.id === "moving-money")!.rule).toMatch(/Record new ones as a transfer; older lines filed here still count in spending totals/);
  });
});
