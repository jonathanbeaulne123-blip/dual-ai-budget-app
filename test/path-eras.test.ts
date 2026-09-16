import { describe, expect, it } from "vitest";
import { addGoal, assembleHousehold, catalogHousehold, financialAuditHash, fundGoal, splitForSync } from "../src/core/index.ts";
import {
  agreePathProposal,
  declinePathProposal,
  hasPathEraData,
  mergePathWorld,
  pathWorldChangeAuthorized,
  pendingPathProposals,
  shapeEraSpec,
  shapePathWorld,
  PATH_ERA_COMMAND_KINDS,
  type PathEraRow,
  type PathEraSpec,
} from "../src/core/pathWorld.ts";
import { crossPathEra, currentPathEra, pathEraProgress, pathEras, proposePathEra, proposePathEraPlan } from "../src/core/pathEras.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import type { Household } from "../src/core/types.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, parseCommand, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";

const ME = "MEM-002";
const PARTNER = "MEM-001";
const AT = "2026-09-12T14:00:00.000Z";
const TODAY = "2026-09-16" as const;

const era = (over: Partial<PathEraSpec> = {}): Omit<PathEraSpec, "crossedOn" | "retired"> => ({
  order: 1, name: "Moving in", finishLine: "Survive our first year without going broke", from: "2025-09", by: "2026-08",
  home: "flat", finish: { kind: "agree" }, plans: [], ...over,
});
function agreeAll(h: Household): Household {
  let next = h;
  for (const row of pendingPathProposals(next)) {
    for (const memberId of [ME, PARTNER]) {
      const fresh = shapePathWorld(next.pathWorld).find((r) => r.id === row.id) as PathEraRow;
      if (fresh.pending && !fresh.agreedByMemberIds.includes(memberId)) next = agreePathProposal(next, { memberId, rowId: fresh.id, revision: fresh.pendingRevision, at: AT }).household;
    }
  }
  return next;
}
function withJourney(): Household {
  let h = catalogHousehold();
  h = proposePathEra(h, { memberId: ME, spec: era(), at: AT }).household;
  h = proposePathEra(h, { memberId: ME, spec: era({ order: 2, name: "Make it ours", from: "2026-09", by: "2028-08", home: "furnished" }), at: AT }).household;
  h = proposePathEra(h, { memberId: PARTNER, spec: era({ order: 3, name: "Our first house", from: "2028-09", by: null, home: "house" }), at: AT }).household;
  return agreeAll(h);
}

describe("The Journey of Life — eras (D-268)", () => {
  it("an era is real only when both of us agree, and never touches the books", async () => {
    const base = catalogHousehold();
    const before = await financialAuditHash(base);
    const proposed = proposePathEra(base, { memberId: ME, spec: era(), at: AT });
    expect(proposed.postedIds).toEqual([]);
    expect(proposed.undo.commandKind).toBe("updatePathWorld");
    expect(pathEras(proposed.household, TODAY).map((e) => e.state)).toEqual(["sketched"]);
    const row = shapePathWorld(proposed.household.pathWorld).find((r) => r.kind === "era") as PathEraRow;
    const agreed = agreePathProposal(proposed.household, { memberId: PARTNER, rowId: row.id, revision: row.pendingRevision, at: AT }).household;
    const eras = pathEras(agreed, TODAY);
    expect(eras.map((e) => e.state)).toEqual(["current"]);
    expect(eras[0]!.months[0]).toBe("2025-09");
    expect(await financialAuditHash(agreed)).toBe(before);
    expect(hasPathEraData(agreed)).toBe(true);
  });

  it("orders the journey: past, current, future; a declined suggestion stays sketched", () => {
    let h = withJourney();
    expect(pathEras(h, TODAY).map((e) => [e.spec.name, e.state])).toEqual([["Moving in", "current"], ["Make it ours", "future"], ["Our first house", "future"]]);
    // Cross the first era (the agree finish line is always met).
    h = crossPathEra(h, { memberId: ME, rowId: currentPathEra(h, TODAY)!.id, today: TODAY, at: AT }).household;
    expect(currentPathEra(h, TODAY)!.spec.name).toBe("Moving in");
    h = agreeAll(h);
    const eras = pathEras(h, TODAY);
    expect(eras.map((e) => e.state)).toEqual(["past", "current", "future"]);
    expect(eras[0]!.spec.crossedOn).toBe("2026-09");
    expect(eras[0]!.months.at(-1)).toBe("2026-08");
    expect(eras[1]!.months).toEqual(["2026-09"]);

    const sketch = proposePathEra(h, { memberId: PARTNER, spec: era({ order: 4, name: "Retirement", from: "2034-09", by: null, home: "porch" }), at: AT }).household;
    const row = pendingPathProposals(sketch).find((r) => r.kind === "era" && (r.pending as PathEraSpec).name === "Retirement")!;
    const declined = declinePathProposal(sketch, { memberId: ME, rowId: row.id, revision: row.pendingRevision, at: AT }).household;
    expect(pathEras(declined, TODAY).map((e) => e.spec.name)).toEqual(["Moving in", "Make it ours", "Our first house"]);
  });

  it("keeps a crossed era's months and finish line, and nothing new goes before the current era", () => {
    let h = withJourney();
    h = agreeAll(crossPathEra(h, { memberId: ME, rowId: currentPathEra(h, TODAY)!.id, today: TODAY, at: AT }).household);
    const past = pathEras(h, TODAY)[0]!;
    expect(() => proposePathEra(h, { memberId: ME, rowId: past.id, spec: { ...past.spec, home: "house" }, at: AT })).toThrow(/crossed era/);
    const renamed = proposePathEra(h, { memberId: ME, rowId: past.id, spec: { ...past.spec, name: "Our first year" }, at: AT }).household;
    expect(pendingPathProposals(renamed)).toHaveLength(1);
    expect(() => proposePathEra(h, { memberId: ME, spec: era({ order: 1, name: "Before", from: "2024-01", by: null }), at: AT })).toThrow(/after the era you are in/);
    expect(() => proposePathEra(h, { memberId: ME, spec: era({ order: 3, name: "Clash", from: "2029-01", by: null }), at: AT })).toThrow(/already stands/);
    const current = currentPathEra(h, TODAY)!;
    expect(() => proposePathEra(h, { memberId: ME, rowId: current.id, spec: { ...current.row.active!, retired: true }, at: AT })).toThrow(/era you are in/);
  });

  it("words only: amounts are stripped from names, finish lines and plans", () => {
    const spec = shapeEraSpec({ ...era({ name: "Save $12,000 fast", finishLine: "Put 500 away" }), crossedOn: null, retired: false })!;
    expect(spec.name).toBe("Save fast");
    expect(spec.finishLine).toBe("Put away");
    expect(shapeEraSpec({ ...era({ from: "2025-13" }), crossedOn: null, retired: false })).toBeNull();
    expect(shapeEraSpec({ ...era({ finish: { kind: "survive", months: 0 } }), crossedOn: null, retired: false })).toBeNull();
  });

  it("plans a bank inside an era (shared banks only) and shows the suggestion in pencil until agreed", () => {
    let h = withJourney();
    h = addGoal(h, { name: "The sofa", target: 2400, shared: true, ownerMemberId: ME }).household;
    h = addGoal(h, { name: "My own thing", target: 100, shared: false, ownerMemberId: ME }).household;
    const sofa = h.goals.find((g) => g.name === "The sofa")!;
    const mine = h.goals.find((g) => g.name === "My own thing")!;
    const target = pathEras(h, TODAY)[1]!;
    expect(() => proposePathEraPlan(h, { memberId: ME, rowId: target.id, plan: { id: "PLAN-1", kind: "bank", label: "Mine", goalId: mine.id, month: null }, at: AT })).toThrow(/shared Kitty Bank/);
    h = proposePathEraPlan(h, { memberId: PARTNER, rowId: target.id, plan: { id: "PLAN-1", kind: "bank", label: "The sofa", goalId: sofa.id, month: "2027-06" }, at: AT }).household;
    const pencil = pathEras(h, TODAY)[1]!;
    expect(pencil.spec.plans).toHaveLength(0);
    expect(pencil.plans).toEqual([expect.objectContaining({ label: "The sofa", sketched: true, step: 0 })]);
    expect(() => proposePathEraPlan(h, { memberId: ME, rowId: target.id, plan: { id: "PLAN-2", kind: "note", label: "Rugs", goalId: null, month: null }, at: AT })).toThrow(/waiting/);
    h = agreeAll(h);
    expect(pathEras(h, TODAY)[1]!.plans).toEqual([expect.objectContaining({ sketched: false })]);
  });

  it("a banks finish line lights one lantern per bank and refuses to cross until every one is lit", () => {
    let h = catalogHousehold();
    h = addGoal(h, { name: "Plant corner", target: 90, shared: true, ownerMemberId: ME }).household;
    h = addGoal(h, { name: "Rug", target: 600, shared: true, ownerMemberId: ME }).household;
    const [plant, rug] = [h.goals.find((g) => g.name === "Plant corner")!, h.goals.find((g) => g.name === "Rug")!];
    h = agreeAll(proposePathEra(h, { memberId: ME, spec: era({ finish: { kind: "banks", goalIds: [plant.id, rug.id] } }), at: AT }).household);
    h = fundGoal(h, { goalId: plant.id, amount: 90, fromAccountId: "ACC-SAVINGS", date: "2026-09-10", createdBy: ME, visibility: "household" }).household;
    const current = currentPathEra(h, TODAY)!;
    expect(current.progress.lanterns.map((l) => l.lit)).toEqual([true, false]);
    expect(current.progress.met).toBe(false);
    expect(() => crossPathEra(h, { memberId: ME, rowId: current.id, today: TODAY })).toThrow(/Not yet/);
  });

  it("a survive finish line counts finished months and names a month that went below zero", () => {
    const h = catalogHousehold();
    const spec = shapeEraSpec({ ...era({ from: "2026-08", by: null, finish: { kind: "survive", months: 3 } }), crossedOn: null, retired: false })!;
    const progress = pathEraProgress(h, spec, TODAY);
    expect(progress.lanterns).toHaveLength(3);
    expect(progress.why[0]).toMatch(/1 of 3 months/);
    expect(progress.met).toBe(false);
  });

  it("era rows merge like the other agreements and only the actor can add their own agreement", () => {
    const h = proposePathEra(catalogHousehold(), { memberId: ME, spec: era(), at: AT }).household;
    const row = shapePathWorld(h.pathWorld)[0] as PathEraRow;
    const forged: PathEraRow = { ...row, agreedByMemberIds: [ME, PARTNER] };
    expect(pathWorldChangeAuthorized({ ...h, pathWorld: [] }, [row], ME)).toBe(true);
    expect(pathWorldChangeAuthorized(h, [forged], ME)).toBe(false);
    const theirs = agreePathProposal(h, { memberId: PARTNER, rowId: row.id, revision: 1, at: AT }).household;
    const merged = mergePathWorld(h.pathWorld, theirs.pathWorld);
    expect((merged[0] as PathEraRow).active?.name).toBe("Moving in");
  });

  it("an era's island months ignore the 36-month cap", () => {
    const months = pathMonths(catalogHousehold(), TODAY, { from: "2020-01", through: "2026-09" });
    expect(months).toHaveLength(81);
    expect(months[0]!.key).toBe("2020-01");
  });
});

describe("pathEra capability guard", () => {
  const scope: Scope = { environment: "development", householdId: catalogHousehold().householdId, memberId: PARTNER, subject: "test-one" } as Scope;
  it("refuses a client without pathEraVersion once the household holds eras or is adding one", async () => {
    expect(PATH_ERA_COMMAND_KINDS).toEqual(["proposePathEra", "proposePathEraPlan", "crossPathEra"]);
    const h = catalogHousehold();
    const one = splitForSync(h, PARTNER), two = splitForSync(h, ME);
    const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([[PARTNER, one.personal], [ME, two.personal]]) };
    const adding = await commandFromCapture(capturedIntent(proposePathEra(h, { memberId: PARTNER, spec: era(), at: AT }).household)!, scope, crypto.randomUUID());
    expect(adding.pathEraVersion).toBe(1);
    expect(() => parseCommand({ ...adding, pathEraVersion: 2 })).toThrow();
    const old = { ...adding };
    delete (old as { pathEraVersion?: 1 }).pathEraVersion;
    await expect(prepareCommand(state, old, scope, () => {})).rejects.toThrow(/preserve your journey/);
    const accepted = await prepareCommand(state, adding, scope, () => {});
    expect(hasPathEraData(assembleHousehold(accepted.shared, accepted.personal))).toBe(true);
  });
});
