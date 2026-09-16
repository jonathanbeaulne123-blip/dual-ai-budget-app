import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import { addGoal, addRecurrence, postDueRecurrences, proposePlanBridge } from "../src/core/commands.ts";
import { agreeMissingRoll, missingSubscriptions, offerMissingRoll, withdrawMissingRoll } from "../src/core/missingSubscriptions.ts";
import { isCellarBridgeRow, sharedBridgeDecisions } from "../src/core/cellarBridge.ts";
import { sitdownBrief } from "../src/core/sitdownBrief.ts";
import { pathBridges } from "../src/core/pathBridges.ts";
import { deriveFundPulseInput, presenceLines } from "../src/core/fundPulse.ts";
import { planStudioV3Model } from "../src/plan-v3/model.ts";
import { cellarPayMark, hiddenPayMembers, setMyCellarPay } from "../src/core/cellarIncomeJars.ts";
import { executeIntent } from "../src/ledgerSync/registry.ts";
import { cellarJars } from "../src/core/queenCellar.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { umbrellaHueForCategory } from "../src/core/fundModel.ts";
import type { Household } from "../src/core/types.ts";
import { ALEX as FALEX, TODAY as FTODAY, fundBill, fundedHousehold, migrated } from "./fixtures/fund-model.ts";

/** Fictional books only. Alex (MEM-001) holds the Fund; Sam (MEM-002) is the partner. */
const ALEX = "MEM-001", SAM = "MEM-002";
const today = "2026-09-16";

function offered(): { h: Household; before: Household } {
  let h = planLifeFixture("household");
  const goal = addGoal(h, { name: "Fictional beach weekend", target: "600", shared: true, ownerMemberId: SAM });
  h = goal.household;
  const added = addRecurrence(h, { cadence: "monthly", nextDate: "2026-08-12", type: "expense", amount: "16", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional streaming", kind: "subscription" });
  h = postDueRecurrences(added.household, "2026-08-12", [added.postedIds[0]!], { createdBy: ALEX }).household;
  const before = h;
  const [entry] = missingSubscriptions(h, { today, memberId: ALEX }).open;
  h = offerMissingRoll(h, { today, memberId: ALEX, entryId: entry!.id, goalId: goal.postedIds[0]! }).household;
  return { h, before };
}

describe("the cellar's roll-over offers stay in the cellar (D-281)", () => {
  it("recognises its own rows and nothing else", () => {
    const { h } = offered();
    const rows = h.planBridgeDecisions!;
    expect(rows.filter(isCellarBridgeRow)).toHaveLength(1);
    const plain = proposePlanBridge(h, { monthKey: "2026-09", kind: "contribution", label: "Roll the extra into Fictional savings", amountCents: 500, memberId: SAM, createdBy: SAM }).household;
    expect(sharedBridgeDecisions(plain.planBridgeDecisions).map(row => row.label)).toContain("Roll the extra into Fictional savings");
    expect(sharedBridgeDecisions(plain.planBridgeDecisions).some(isCellarBridgeRow)).toBe(false);
  });

  it("the Sitdown brief, the island, the crown's pulse and the studio badge do not see it", () => {
    const { h, before } = offered();
    expect(sitdownBrief(h, { memberId: SAM, today })).toEqual(sitdownBrief(before, { memberId: SAM, today }));
    expect(pathBridges(h, SAM, today)).toEqual(pathBridges(before, SAM, today));
    expect(presenceLines(h, { memberId: SAM, today })).toEqual(presenceLines(before, { memberId: SAM, today }));
    expect(deriveFundPulseInput(h, { memberId: SAM, today, freshness: "current" })).toEqual(deriveFundPulseInput(before, { memberId: SAM, today, freshness: "current" }));
    expect(planStudioV3Model(h, { memberId: SAM, view: "household", today }).badge?.tool).not.toBe("letter");
    // The cellar itself still reads the offer.
    expect(missingSubscriptions(h, { today, memberId: SAM }).open[0]!.stage).toBe("offered");
  });

  it("a withdrawn cellar offer never reads 'took it back' on the island", () => {
    const { h, before } = offered();
    const [entry] = missingSubscriptions(h, { today, memberId: SAM }).open;
    const agreed = agreeMissingRoll(h, { today, memberId: SAM, entryId: entry!.id }).household;
    const row = agreed.planBridgeDecisions!.find(item => item.offeredByMemberId === ALEX && isCellarBridgeRow(item))!;
    const withdrawn = withdrawMissingRoll(agreed, { memberId: ALEX, rowId: row.id }).household;
    expect(pathBridges(withdrawn, ALEX, today)).toEqual(pathBridges(before, ALEX, today));
    expect(JSON.stringify(pathBridges(withdrawn, SAM, today))).not.toContain("took it back");
  });
});

describe("only the member hides their own pay (D-281)", () => {
  const at = "2026-09-16T12:00:00.000Z";
  it("the phone refuses a mark for someone else", () => {
    const h = planLifeFixture("household");
    expect(() => setMyCellarPay(h, { memberId: SAM, actorMemberId: ALEX, choice: "hide", at })).toThrow(/your own pay/);
    const mine = setMyCellarPay(h, { memberId: ALEX, actorMemberId: ALEX, choice: "hide", at }).household;
    expect([...hiddenPayMembers(mine)]).toEqual([ALEX]);
  });
  it("the authority refuses a cellar-pay mark whose member is not the sender", () => {
    const h = planLifeFixture("household");
    expect(() => executeIntent(h, "dismissNotice", [cellarPayMark(SAM, "hide", at)], ALEX, "test-1")).toThrow(/ACTOR_MISMATCH/);
    const own = executeIntent(h, "dismissNotice", [cellarPayMark(ALEX, "hide", at)], ALEX, "test-2");
    expect([...hiddenPayMembers(own.household)]).toEqual([ALEX]);
    // Every other notice key is unchanged.
    expect(() => executeIntent(h, "dismissNotice", ["fictional-notice"], SAM, "test-3")).not.toThrow();
  });
});

describe("the cellar tints bills by umbrella once sorted (D-281)", () => {
  it("uses umbrellaHueForCategory after the migration and nothing before", () => {
    let h = fundedHousehold("2000");
    h = fundBill(h, { note: "Fictional hydro", amount: "300", subcategoryId: "SUB-HOUSING-ELECTRIC", day: 28 }).household;
    const before = cellarJars(projectKittyNest(h, FALEX, "household", FTODAY), h, FTODAY);
    expect(before.every(jar => jar.umbrellaHue === null)).toBe(true);
    const sorted = migrated(h);
    const jars = cellarJars(projectKittyNest(sorted, FALEX, "household", FTODAY), sorted, FTODAY);
    const hydro = jars.find(jar => jar.label.includes("hydro"))!;
    expect(hydro.umbrellaHue).toBe(umbrellaHueForCategory(sorted, "SUB-HOUSING-ELECTRIC"));
    expect(hydro.umbrellaHue).toBe("#c9a227");
  });
});
