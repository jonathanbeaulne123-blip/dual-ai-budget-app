import { describe, expect, it } from "vitest";
import { addRecurrence, type Household } from "../src/core/index.ts";
import { setFundOverride } from "../src/core/fundModelCommands.ts";
import { personalFundMarker } from "../src/core/fundRules.ts";
import { fundModelBootNotice, fundModelBootStep, harmlessFundModelBootRefusal } from "../src/fundModelBoot.ts";
import { fundModelPersonalUpdateAllowed } from "../src/fundModelPersonalRule.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { ALEX, fundedHousehold, migrated } from "./fixtures/fund-model.ts";

/** D-282, review H3 and M5. Fictional books only. */
function withPrivateBill(): Household {
  let h = fundedHousehold("2000");
  h.accounts = [...h.accounts, { ...h.accounts.find((row) => row.id === "ACC-CHEQUING")!, id: "ACC-ALEX-PRIVATE", name: "Alex's fictional private", scope: "personal", ownerMemberId: ALEX }];
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-20", type: "expense", amount: "80", accountId: "ACC-ALEX-PRIVATE", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional private phone" }).household;
  return migrated(h);
}

describe("each person's own sorting step passes the cloud-authority rule", () => {
  it("the boot's personal step changes only my Personal envelope", () => {
    const h = withPrivateBill();
    const step = fundModelBootStep(h, ALEX, 2)!;
    expect(step.kind).toBe("personal");
    const result = step.run(h);
    expect(result.persistenceScope).toBe("member-personal");
    expect(result.undo.commandKind).toBe("updateFundModel");
    expect(personalFundMarker(result.household, ALEX)).toBeTruthy();
    expect(fundModelPersonalUpdateAllowed(h, result.household, ALEX)).toBe(true);
    // The App's rule first requires personalMemberId to be the signed-in member; this result belongs to Alex only.
    expect(result.personalMemberId).toBe(ALEX);
    expect(result.household.lastCommittedAt).toBe(h.lastCommittedAt);
  });

  it("a private fund override passes; anything touching the Shared envelope does not", () => {
    const h = withPrivateBill();
    const bill = h.recurrences.find((row) => row.note === "Fictional private phone")!;
    const override = setFundOverride(h, { memberId: ALEX, view: "personal", sourceKind: "recurrence", sourceId: bill.id, fund: "build" });
    expect(override.persistenceScope).toBe("member-personal");
    expect(fundModelPersonalUpdateAllowed(h, override.household, ALEX)).toBe(true);
    const sneaky = { ...override.household, categories: override.household.categories.map((row) => row.id === "SUB-FOOD-GROCERIES" ? { ...row, name: "Fictional renamed" } : row) };
    expect(fundModelPersonalUpdateAllowed(h, sneaky, ALEX)).toBe(false);
    const otherPrivate = { ...override.household, goals: [...override.household.goals, { ...override.household.goals[0] ?? { id: "x" }, id: "GOAL-SNEAKY", shared: false, ownerMemberId: ALEX, name: "Fictional sneaky" } as Household["goals"][number]] };
    expect(fundModelPersonalUpdateAllowed(h, otherPrivate, ALEX)).toBe(false);
  });
});

describe("the boot says why it waits, and a lost race is quiet (review M5)", () => {
  it("names the plan that still keeps bills in Protect", () => {
    const h = planLifeFixture("household");
    expect(fundModelBootStep(h, "MEM-001", 2)).toBeNull();
    expect(fundModelBootNotice(h, "MEM-001", 2)).toMatch(/still keeps bills in Protect/);
    expect(fundModelBootNotice(h, "MEM-001", 1)).toBeNull();
    expect(fundModelBootNotice(planLifeFixture("household", { fundModel: 2 }), "MEM-001", 2)).toBeNull();
  });
  it("treats 'already sorted' as harmless and nothing else", () => {
    expect(harmlessFundModelBootRefusal("This household is already sorted the new way.")).toBe(true);
    expect(harmlessFundModelBootRefusal("Your own money is already sorted the new way.")).toBe(true);
    expect(harmlessFundModelBootRefusal("A household plan still keeps bills in Protect.")).toBe(false);
    expect(harmlessFundModelBootRefusal(null)).toBe(false);
  });
});
