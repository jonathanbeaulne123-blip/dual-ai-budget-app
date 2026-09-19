import { describe, expect, it } from "vitest";
import { addRecurrence, catalogHousehold, legacyHouseholdPlanDraft, setBudget, type Household } from "../src/core/index.ts";
import { buildGuidedPlan } from "../src/core/planGuide.ts";
import { evaluatePlanDrift, planLensCopy, planLensOrder, PLAN_LENS_COPY, PLAN_LENS_COPY_V2, type PlanVersion } from "../src/core/planSystem.ts";
import { planLesson, PLAN_LESSONS } from "../src/core/planLearning.ts";
import { projectKittyNest, nestCategoryMeanings, NEST_CATEGORY_MEANINGS } from "../src/core/kittyNest.ts";
import { queenBanks, queenBankWords, queenNestDoors } from "../src/core/queenPresentation.ts";
import type { PlanProjection } from "../src/core/planProjection.ts";
import { ALEX, TODAY, buffer, fundBill, fundedHousehold, migrated } from "./fixtures/fund-model.ts";

const BANNED = /\b(moved|transferred)\b/i;
const context = (household: Household) => ({ household, memberId: ALEX, view: "household" as const, today: "2026-09-11" });

describe("words match the numbers (slice 6)", () => {
  it("switches every Kitty, Queen and Plan meaning together, and never claims money moved", () => {
    const v1 = catalogHousehold(), v2 = migrated(catalogHousehold());
    expect(planLensCopy(v1)).toBe(PLAN_LENS_COPY);
    expect(planLensCopy(v2)).toBe(PLAN_LENS_COPY_V2);
    expect(planLensOrder(v2)).toEqual(["prepare", "protect", "build", "everyday"]);
    expect(PLAN_LENS_COPY_V2.protect.prompt).toMatch(/buffer/);
    expect(PLAN_LENS_COPY_V2.prepare.prompt).toMatch(/has to leave/);
    expect(nestCategoryMeanings(1)).toBe(NEST_CATEGORY_MEANINGS);
    expect(nestCategoryMeanings(2).protect).not.toMatch(/bill/i);
    expect(queenBankWords(1).lowerBankKey).toBe("plan:protect");
    expect(queenBankWords(2).lowerBankKey).toBe("plan:prepare");
    const every = [
      ...Object.values(PLAN_LENS_COPY_V2).flatMap((row) => [row.title, row.prompt]),
      ...Object.values(nestCategoryMeanings(2)),
      ...Object.values(queenBankWords(2).labels), ...Object.values(queenBankWords(2).meanings),
    ];
    for (const text of every) expect(text).not.toMatch(BANNED);
  });
  it("puts Prepare before Protect behind the Queen's lower door once sorted", () => {
    const h = migrated(fundedHousehold());
    const nest = projectKittyNest(h, ALEX, "household", TODAY);
    expect(queenNestDoors(nest).protect.map((row) => row.category)).toEqual(["prepare", "protect"]);
    expect(queenBanks(nest).protect.banks.map((row) => row.category)).toEqual(["prepare", "protect"]);
    const v1 = projectKittyNest(fundedHousehold(), ALEX, "household", TODAY);
    expect(queenNestDoors(v1).protect.map((row) => row.category)).toEqual(["protect", "prepare"]);
  });
  it("teaches timing under Prepare and the buffer under Protect in v2", () => {
    const projection = { firstExposed: { label: "Rent", gapCents: 100, date: "2026-09-20" }, lines: [], everydayNowCents: null } as unknown as PlanProjection;
    expect(planLesson(projection).lens).toBe("protect");
    expect(planLesson(projection, undefined, [], 2)).toMatchObject({ lens: "prepare", id: PLAN_LESSONS.protect.id });
    expect(planLesson(projection, "protect", [], 2).id).toBe("buffers");
  });
});

describe("writers file bills under Prepare once sorted (slice 6)", () => {
  function withBill(h: Household) {
    return addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-20", type: "expense", amount: "900", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-RENT", note: "Rent" }).household;
  }
  const answers = { monthKey: "2026-09", purpose: "Calm", incomeSource: "skip", protectSource: "known", protectOwner: "joint", protectFunding: "available", prepareSource: "skip", buildSource: "skip", everydaySource: "skip" };
  it("Hercules's guided draft writes Prepare obligations (v2) and Protect obligations (v1)", () => {
    const v1 = buildGuidedPlan(context(withBill(catalogHousehold())), answers, "g1");
    expect(v1.lines.map((row) => [row.lens, row.kind])).toEqual([["protect", "obligation"]]);
    const v2 = buildGuidedPlan(context(migrated(withBill(catalogHousehold()))), answers, "g2");
    expect(v2.lines.map((row) => [row.lens, row.kind])).toEqual([["prepare", "obligation"]]);
    expect(v2.lines[0]!.id).toMatch(/^GUIDE-g2-bill-prepare-/);
    const unlinked = buildGuidedPlan(context(migrated(catalogHousehold())), { ...answers, protectSource: "unlinked", protectLabel: "Car repair", protectAmount: "300", protectDate: "2026-09-25", protectOwner: ALEX }, "g3");
    expect(unlinked.lines[0]).toMatchObject({ lens: "prepare", kind: "obligation", responsibility: { kind: "member", memberId: ALEX } });
    expect(unlinked.note).toMatch(/Prepare: left open|Everyday/);
  });
  it("adopts essential budget lines as Prepare once sorted", () => {
    let h = setBudget(catalogHousehold(), { monthKey: "2026-09", subcategoryId: "SUB-HOUSING-RENT", amount: "900" } as never).household;
    expect(legacyHouseholdPlanDraft(h, "2026-09", ALEX, "2026-09-11T00:00:00.000Z").lines.find((row) => row.kind === "obligation")?.lens).toBe("protect");
    h = migrated(h);
    expect(legacyHouseholdPlanDraft(h, "2026-09", ALEX, "2026-09-11T00:00:00.000Z").lines.find((row) => row.kind === "obligation")?.lens).toBe("prepare");
  });
  it("flags a short Prepare bill as a shortfall and a thin buffer as 'buffer below agreed'", () => {
    let h = fundedHousehold("500");
    h = fundBill(h, { note: "Rent", amount: "900", subcategoryId: "SUB-HOUSING-RENT", day: 25 }).household;
    h = buffer(h, "200");
    h = migrated(h);
    const version: PlanVersion = {
      id: "PV-1", scope: "household", monthKey: "2026-09", sequence: 1, lines: [{ id: "L-1", lens: "prepare", kind: "obligation", labelSnapshot: "Rent", amountCents: 90000, cadence: "monthly", dueDate: "2026-09-25", assumptionIds: [], createdBy: ALEX, responsibility: { kind: "joint" } }],
      assumptions: [], reason: "Fictional", digest: "d", state: "active", createdBy: ALEX, createdAt: "2026-09-01T00:00:00.000Z",
    };
    const rules = evaluatePlanDrift(h, version, TODAY).map((row) => row.rule);
    expect(rules).toContain("protected-shortfall");
    expect(rules).toContain("buffer-below-agreed");
    expect(rules).not.toContain("true-expense-pace");
  });
});
