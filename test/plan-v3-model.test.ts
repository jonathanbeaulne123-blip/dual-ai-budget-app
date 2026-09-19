import { describe, expect, it } from "vitest";
import { planStudioFundSnapshot, planStudioV3Model, pendingContributions, monthName } from "../src/plan-v3/model.ts";
import { planStudioV3Enabled } from "../src/plan-v3/flag.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { fundWalk } from "../src/core/fundWalk.ts";
import { acknowledgeHouseholdPlan, appendPlanSitdownTurn, proposeHouseholdFundContribution } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

const today = "2026-09-11";

describe("Plan Studio v3 adapter", () => {
  it("is off unless the flag says 1 or true", () => {
    expect(planStudioV3Enabled(undefined)).toBe(false);
    expect(planStudioV3Enabled("0")).toBe(false);
    expect(planStudioV3Enabled("yes")).toBe(false);
    expect(planStudioV3Enabled("1")).toBe(true);
    expect(planStudioV3Enabled("true")).toBe(true);
  });

  it("has the fundSnapshot shape and passes the nest's figures through unchanged", () => {
    const h = planLifeFixture("household");
    const snap = planStudioFundSnapshot(h, { memberId: "MEM-001", view: "household", today });
    expect(Object.keys(snap).sort()).toEqual(["build", "flow", "now", "prepare", "protect", "undividedContributions"]);
    const nest = projectKittyNest(h, "MEM-001", "household", today);
    const amount = (key: string) => nest.categories.find(row => row.category === key)!.amountCents;
    expect(snap.now.amountCents).toBe(amount("everyday"));
    expect(snap.prepare.amountCents).toBe(amount("prepare"));
    expect(snap.protect.amountCents).toBe(amount("protect"));
    expect(snap.build.amountCents).toBe(amount("build"));
    // The four readings are the King, exactly — nothing is added or invented.
    expect(snap.now.amountCents! + snap.prepare.amountCents! + snap.protect.amountCents! + snap.build.amountCents!).toBe(nest.totalCents);
    // No split command exists yet, so nothing is claimed as undivided.
    expect(snap.undividedContributions).toEqual([]);
  });

  it("walks the month from the Fund walk, day by day, without new arithmetic", () => {
    const h = planLifeFixture("household");
    const snap = planStudioFundSnapshot(h, { memberId: "MEM-001", view: "household", today });
    const walk = fundWalk(h, "2026-09", today);
    expect(snap.flow?.source).toBe("fund-walk");
    expect(snap.flow?.days).toHaveLength(30);
    const last = walk.points.at(-1)!;
    expect(snap.flow!.days.at(-1)!.balanceCents).toBe(last.balanceCents);
    const rent = snap.flow!.days.find(day => day.date === "2026-09-20")!;
    expect(rent.outflows.map(row => [row.label, row.amountCents, row.fund])).toContainEqual(["Fictional rent", 90000, "prepare"]);
    const contributions = snap.flow!.days.flatMap(day => day.contributions);
    expect(contributions.reduce((sum, row) => sum + row.amountCents, 0)).toBe(snap.flow!.totalInCents);
    expect(contributions.every(row => row.split === null)).toBe(true);
  });

  it("reads agreement per person and never claims both agreed early", () => {
    let h = planLifeFixture("household");
    let model = planStudioV3Model(h, { memberId: "MEM-001", view: "household", today });
    expect(model.agreement.kind).toBe("waiting-me");
    expect(model.agreement.paws.map(p => p.agreed)).toEqual([false, false]);
    const version = model.agreement.version!;
    h = acknowledgeHouseholdPlan(h, { planVersionId: version.id, expectedDigest: version.digest, memberId: "MEM-001", createdBy: "MEM-001" }).household;
    model = planStudioV3Model(h, { memberId: "MEM-001", view: "household", today });
    expect(model.agreement.kind).toBe("waiting-partner");
    expect(model.agreement.label).toBe("Waiting for Sam (fictional)");
    expect(model.agreement.paws.map(p => p.agreed)).toEqual([true, false]);
    h = acknowledgeHouseholdPlan(h, { planVersionId: version.id, expectedDigest: version.digest, memberId: "MEM-002", createdBy: "MEM-002" }).household;
    model = planStudioV3Model(h, { memberId: "MEM-002", view: "household", today });
    expect(model.agreement.kind).toBe("agreed");
    expect(model.agreement.paws.every(p => p.agreed)).toBe(true);
  });

  it("resumes from the Shared Sitdown session, not a new shape", () => {
    let h = planLifeFixture("household");
    expect(planStudioV3Model(h, { memberId: "MEM-001", view: "household", today }).session.state).toBe("none");
    h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-TEST", monthKey: "2026-09", planDraftId: "LIFE-DRAFT", memberId: "MEM-001", text: "Paused at Prepare.", checkpoint: { stage: 3 } }).household;
    const model = planStudioV3Model(h, { memberId: "MEM-002", view: "household", today });
    expect(model.session).toMatchObject({ state: "active", stage: 3, sitDownSessionId: "SITDOWN-TEST" });
  });

  it("personal plans read the plan projection and have no Shared session", () => {
    const h = planLifeFixture("personal");
    const model = planStudioV3Model(h, { memberId: "MEM-001", view: "personal", today });
    expect(model.snapshot.flow?.source).toBe("plan-projection");
    expect(model.agreement.kind).toBe("kept");
    expect(model.session.state).toBe("none");
    expect(model.chapter).toBeNull();
    expect(model.monthLabel).toBe(monthName("2026-09"));
  });

  it("shows at most one badge, and a partner's waiting offer wins", () => {
    const h = planLifeFixture("household");
    h.planBridgeDecisions = [{ id: "B1", monthKey: "2026-09", kind: "contribution", label: "Fictional offer", amountCents: 1000, offeredByMemberId: "MEM-002", state: "proposed", createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z" }];
    expect(planStudioV3Model(h, { memberId: "MEM-001", view: "household", today }).badge).toEqual({ tool: "letter", text: "1 waiting" });
    // My own offer is not waiting on me.
    expect(planStudioV3Model(h, { memberId: "MEM-002", view: "household", today }).badge?.tool).not.toBe("letter");
  });

  it("lists pending contributions as waiting, never as counted", () => {
    const h0 = planLifeFixture("household");
    const offer = proposeHouseholdFundContribution(h0, { memberId: "MEM-002", contributorMemberId: "MEM-002", date: "2026-09-10", amount: "140", source: { version: 1, kind: "external-received", explanation: "Fictional" } });
    const pending = pendingContributions(offer.household, "MEM-001");
    expect(pending).toEqual([expect.objectContaining({ memberName: "Sam (fictional)", amountCents: 14000, waitingOnMe: true })]);
    const before = planStudioFundSnapshot(h0, { memberId: "MEM-001", view: "household", today });
    const after = planStudioFundSnapshot(offer.household, { memberId: "MEM-001", view: "household", today });
    expect(after.now.amountCents).toBe(before.now.amountCents);
  });

  it("marks a lens unchanged only when it matches last month's agreed plan", () => {
    const h = planLifeFixture("household");
    const model = planStudioV3Model(h, { memberId: "MEM-001", view: "household", today });
    expect(model.previousMonthLabel).toBeNull();
    expect(Object.values(model.lenses).every(lens => lens.sameAsLast === false)).toBe(true);
    const version = model.agreement.version!;
    h.planVersions = [...h.planVersions!, { ...version, id: "PREV", monthKey: "2026-08", state: "active", sequence: 1 }];
    const routine = planStudioV3Model(h, { memberId: "MEM-001", view: "household", today });
    expect(routine.previousMonthLabel).toBe("August");
    expect(routine.lenses.protect.sameAsLast).toBe(true);
  });
});
