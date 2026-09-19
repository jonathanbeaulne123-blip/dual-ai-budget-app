import { describe, expect, it } from "vitest";
import {
  acknowledgeHouseholdPlan, addPlanBridgeToDraft, assembleHousehold, catalogHousehold, currentPlanVersion, declinePlanBridge, holdPlanBridge,
  proposeHouseholdPlan, savePlanBridgeDraft, savePlanDraft, sharePlanBridgeDraft, splitForSync, withdrawPlanBridge, type Household,
} from "../src/core/index.ts";
import { PATH_BRIDGE_WORDS, pathBridges } from "../src/core/pathBridges.ts";
import { householdForAiDisclosure } from "../src/core/visibility.ts";

const month = "2026-09";
const J = "MEM-001", B = "MEM-002";
const TODAY = "2026-09-15";
const device = (h: Household, memberId: string) => { const parts = splitForSync(h, memberId); return assembleHousehold(parts.shared, parts.personal); };
const offer = (h: Household, label = "Fictional: I can cover the hydro bill", memberId = J) =>
  savePlanBridgeDraft(h, { monthKey: month, kind: "contribution", label, amountCents: 8_765, lowCents: 5_432, highCents: 9_876, memberId, createdBy: memberId }).household;

describe("Our Path bridges, stage by stage", () => {
  it("never throws on an empty household", () => {
    expect(pathBridges(catalogHousehold(), J, TODAY)).toEqual([]);
  });

  it("lays one private plank for the owner only, then both see the offer once it is shared", () => {
    let h = offer(catalogHousehold());
    const draft = h.planBridgeDrafts![0]!;
    expect(pathBridges(h, J, TODAY)).toEqual([{ id: draft.id, label: "Fictional: I can cover the hydro bill", month, kind: "contribution", stage: 1,
      stageWords: PATH_BRIDGE_WORDS.draft, offeredByMe: true, why: expect.stringContaining("Share it with Our Home") }]);
    expect(PATH_BRIDGE_WORDS.draft).toBe("A plank laid, only you can see it");
    // The partner: neither the full-snapshot filter nor their own device shows the draft.
    expect(pathBridges(h, B, TODAY)).toEqual([]);
    expect(pathBridges(device(h, B), B, TODAY)).toEqual([]);
    expect(pathBridges(device(h, J), J, TODAY).map((b) => b.stage)).toEqual([1]);

    h = sharePlanBridgeDraft(h, { draftId: draft.id, memberId: J, createdBy: J }).household;
    const decision = h.planBridgeDecisions![0]!;
    const mine = pathBridges(h, J, TODAY), theirs = pathBridges(device(h, B), B, TODAY);
    expect(mine).toEqual([expect.objectContaining({ id: decision.id, stage: 2, stageWords: "Offered to Our Home — waiting", offeredByMe: true })]);
    expect(theirs).toEqual([expect.objectContaining({ id: decision.id, stage: 2, stageWords: "Offered to Our Home — waiting", offeredByMe: false })]);
    expect(theirs[0]!.why).toContain("offered a contribution to Our Home");

    h = holdPlanBridge(h, { decisionId: decision.id, reason: "Fictional: talk Sunday", expectedUpdatedAt: decision.updatedAt, memberId: B, createdBy: B }).household;
    expect(pathBridges(h, J, TODAY)[0]).toMatchObject({ stage: 2, stageWords: "Held for now" });
    expect(pathBridges(h, J, TODAY)[0]!.why).toContain("held it for the Sitdown");

    const held = h.planBridgeDecisions![0]!;
    h = declinePlanBridge(h, { decisionId: held.id, reason: "Fictional: the target changed", expectedUpdatedAt: held.updatedAt, memberId: B, createdBy: B }).household;
    for (const member of [J, B]) expect(pathBridges(h, member, TODAY)[0]).toMatchObject({ stage: 0, stageWords: "Not built — set aside" });
  });

  it("keeps a withdrawn offer as a stump", () => {
    let h = offer(catalogHousehold());
    h = sharePlanBridgeDraft(h, { draftId: h.planBridgeDrafts![0]!.id, memberId: J, createdBy: J }).household;
    h = withdrawPlanBridge(h, { decisionId: h.planBridgeDecisions![0]!.id, memberId: J, createdBy: J }).household;
    expect(pathBridges(h, B, TODAY)[0]).toMatchObject({ stage: 0, stageWords: "Taken back — not built", offeredByMe: false });
  });

  it("builds the bridge when both acknowledge a Plan that includes the offer, and drops a superseded row", () => {
    let h = offer(catalogHousehold());
    h = sharePlanBridgeDraft(h, { draftId: h.planBridgeDrafts![0]!.id, memberId: J, createdBy: J }).household;
    const bridge = h.planBridgeDecisions![0]!;
    h = savePlanDraft(h, { id: "DRAFT-BRIDGED", scope: "household", memberId: J, targetMonth: month, lines: [], assumptions: [], note: "fictional", createdBy: J }).household;
    h = addPlanBridgeToDraft(h, { decisionId: bridge.id, draftId: "DRAFT-BRIDGED", lens: "protect", memberId: J, createdBy: J }).household;
    h = proposeHouseholdPlan(h, { memberId: J, draftId: "DRAFT-BRIDGED", reason: "Fictional: use the offer", createdBy: J }).household;
    const version = currentPlanVersion(h, "household", month)!;
    h = acknowledgeHouseholdPlan(h, { planVersionId: version.id, expectedDigest: version.digest, memberId: J, createdBy: J }).household;
    expect(pathBridges(h, J, TODAY)[0]!.stage).toBe(2);
    h = acknowledgeHouseholdPlan(h, { planVersionId: version.id, expectedDigest: version.digest, memberId: B, createdBy: B }).household;
    expect(h.planBridgeDecisions![0]).toMatchObject({ state: "accepted", acceptedInPlanVersionId: version.id });
    for (const member of [J, B]) expect(pathBridges(device(h, member), member, TODAY)).toEqual([expect.objectContaining({ id: bridge.id, stage: 3, stageWords: "Built — part of the Plan" })]);

    // A private re-offer: a new first plank for the owner only; the built bridge still stands for both.
    h = savePlanBridgeDraft(h, { monthKey: month, kind: "contribution", label: "Fictional: a bit more for hydro", amountCents: 9_999, supersedesId: bridge.id, memberId: J, createdBy: J }).household;
    expect(pathBridges(h, J, TODAY).map((b) => b.stage).sort()).toEqual([1, 3]);
    expect(pathBridges(h, B, TODAY).map((b) => b.stage)).toEqual([3]);
    // A superseded row is dropped rather than drawn as a stump.
    const superseded = { ...h, planBridgeDecisions: h.planBridgeDecisions!.map((row) => ({ ...row, state: "superseded" as const })) };
    expect(pathBridges(superseded, B, TODAY)).toEqual([]);
  });

  it("never carries an amount, and adds nothing to the model disclosure", () => {
    let h = offer(catalogHousehold());
    h = offer(h, "Fictional: I can take the car insurance");
    h = sharePlanBridgeDraft(h, { draftId: h.planBridgeDrafts![0]!.id, memberId: J, createdBy: J }).household;
    const text = JSON.stringify([pathBridges(h, J, TODAY), pathBridges(h, B, TODAY)]);
    expect(text).not.toMatch(/8765|87\.65|5432|9876|Cents|amount/i);
    expect(Object.keys(pathBridges(h, J, TODAY)[0]!).sort()).toEqual(["id", "kind", "label", "month", "offeredByMe", "stage", "stageWords", "why"]);
    const disclosed = householdForAiDisclosure(h, B, { view: "household" });
    expect(disclosed.pathWorld ?? []).toEqual([]);
    expect(Object.keys(disclosed).some((key) => /footpath|pathBridge/i.test(key))).toBe(false);
  });
});
