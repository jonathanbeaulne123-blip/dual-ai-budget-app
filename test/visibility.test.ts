import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import { addGoal, postEntry, postShift, undo } from "../src/core/commands.ts";
import {
  assembleHousehold,
  emptyPersonal,
  mergeShared,
  overlayPersonalReplica,
  personalReplicaForMember,
  splitForSync,
} from "../src/core/sync.ts";
import { householdForShiftReadTools, householdForView } from "../src/core/visibility.ts";
import { executeHerculesReadToolPlan } from "../src/core/herculesTools.ts";

function grocery(createdBy: string, visibility: "household" | "personal" | "both", note: string, amount = "12.00") {
  return {
    date: "2026-08-18",
    type: "expense" as const,
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy,
    visibility,
    confirmDuplicate: true,
  };
}

describe("household and personal visibility", () => {
  it("lets each person see the household ledger, their personal ledger, and both", () => {
    let household = catalogHousehold();
    household = postEntry(household, grocery("MEM-002", "household", "Rent adjacent")).household;
    household = postEntry(household, grocery("MEM-001", "personal", "Bianca hair", "42.00")).household;
    household = postEntry(household, grocery("MEM-002", "personal", "Jonathan gym", "28.50")).household;
    household = postEntry(household, grocery("MEM-001", "both", "Saturday coffee", "18.00")).household;

    const householdView = householdForView(household, "MEM-001", "household");
    expect(householdView.transactions.map((tx) => tx.note).sort()).toEqual(["Rent adjacent", "Saturday coffee"]);

    const biancaPersonal = householdForView(household, "MEM-001", "personal");
    expect(biancaPersonal.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca hair", "Saturday coffee"]);

    const jonathanPersonal = householdForView(household, "MEM-002", "personal");
    expect(jonathanPersonal.transactions.map((tx) => tx.note)).toEqual(["Jonathan gym"]);
    expect(jonathanPersonal.transactions.some((tx) => tx.note === "Bianca hair")).toBe(false);
  });

  it("keeps a partner's personal rows out of the shared envelope", () => {
    let household = catalogHousehold();
    household = postEntry(household, grocery("MEM-001", "personal", "Bianca only")).household;
    household = postEntry(household, grocery("MEM-002", "personal", "Jonathan only")).household;
    household = postEntry(household, grocery("MEM-002", "household", "Groceries")).household;

    const { shared, personal } = splitForSync(household, "MEM-002");
    expect(shared.transactions.every((tx) => tx.visibility !== "personal")).toBe(true);
    expect(shared.transactions.map((tx) => tx.note)).toEqual(["Groceries"]);
    expect(personal.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca only", "Jonathan only"]);

    const assembled = assembleHousehold(shared, personal);
    expect(assembled.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca only", "Groceries", "Jonathan only"]);
    expect(householdForView(assembled, "MEM-002", "personal").transactions.map((tx) => tx.note)).toEqual(["Jonathan only"]);
    expect(householdForView(assembled, "MEM-001", "personal").transactions.map((tx) => tx.note)).toEqual(["Bianca only"]);
  });

  it("stores personal goals only in their owner's Personal envelope", () => {
    let household = catalogHousehold();
    household = addGoal(household, {
      name: "Jonathan surprise",
      target: "100.00",
      shared: false,
      ownerMemberId: "MEM-002",
    }).household;
    const jonathan = splitForSync(household, "MEM-002");
    const bianca = splitForSync(household, "MEM-001");
    expect(jonathan.shared.goals.some((goal) => !goal.shared)).toBe(false);
    expect(jonathan.personal.goals?.map((goal) => goal.name)).toEqual(["Jonathan surprise"]);
    expect(bianca.personal.goals).toEqual([]);
    expect(assembleHousehold(jonathan.shared, jonathan.personal).goals.map((goal) => goal.name))
      .toEqual(["Jonathan surprise"]);
  });

  it("merges concurrent household adds without dropping either person's row", () => {
    const base = catalogHousehold();
    const fromBianca = postEntry(base, grocery("MEM-001", "household", "Bianca add", "11.00")).household;
    const fromJonathan = postEntry(base, grocery("MEM-002", "household", "Jonathan add", "13.00")).household;
    const merged = mergeShared(splitForSync(fromBianca, "MEM-001").shared, splitForSync(fromJonathan, "MEM-002").shared);
    expect(merged.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca add", "Jonathan add"]);
  });

  it("does not treat a partner's personal purchase as a duplicate of a household add", () => {
    let household = catalogHousehold();
    household = postEntry(household, grocery("MEM-001", "personal", "No Frills", "47.23")).household;
    const posted = postEntry(household, grocery("MEM-002", "household", "No Frills", "47.23"));
    expect(posted.household.transactions).toHaveLength(2);
  });

  it("records tombstones when undo removes a posted row so sync cannot resurrect it", () => {
    const posted = postEntry(catalogHousehold(), grocery("MEM-002", "household", "Undo me"));
    const restored = undo(posted.household, posted.undo);
    expect(restored.transactions).toHaveLength(0);
    expect(restored.tombstones.some((tombstone) => tombstone.id === posted.postedIds[0])).toBe(true);
  });

  it("stamps shift wages and tips with the same visibility as the shift", () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-18",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100.00",
      hours: "4.00",
      createdBy: "MEM-002",
      visibility: "both",
      confirmDuplicate: true,
    });
    expect(posted.household.shifts[0]?.visibility).toBe("both");
    expect(posted.household.transactions.every((tx) => tx.visibility === "both" && tx.createdBy === "MEM-002")).toBe(true);
    const personal = householdForView(posted.household, "MEM-002", "personal");
    expect(personal.shifts).toHaveLength(1);
    expect(householdForView(posted.household, "MEM-001", "personal").shifts).toHaveLength(0);
  });

  it("assembles an empty personal envelope onto shared catalog data", () => {
    const household = catalogHousehold();
    const { shared } = splitForSync(household, "MEM-001");
    const assembled = assembleHousehold(shared, emptyPersonal("MEM-001"));
    expect(assembled.members).toHaveLength(2);
    expect(assembled.transactions).toHaveLength(0);
    expect(assembled.linked).toBe(false);
    expect(assembleHousehold(shared, emptyPersonal("MEM-001"), { linked: true }).linked).toBe(true);
  });

  it("includes the worker's own household-posted shifts in personal shift reads", () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-18",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100.00",
      cashTips: "20.00",
      ccTips: "30.00",
      hours: "4.00",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    });
    const personalView = householdForView(posted.household, "MEM-002", "personal");
    expect(personalView.shifts).toHaveLength(0);
    const shiftRead = householdForShiftReadTools(posted.household, "MEM-002", "personal");
    expect(shiftRead.shifts).toHaveLength(1);
    const run = executeHerculesReadToolPlan(posted.household, {
      calls: [{ id: "shift-1", name: "shift_summary", args: { period: "this_week" } }],
    }, "2026-08-18", { memberId: "MEM-002", view: "personal" });
    expect(run.results[0]?.status).toBe("ok");
    expect(run.results[0]?.sentence).toMatch(/1 posted shift/i);
  });

  it("overlays hosted personal shifts onto the shared cloud snapshot", () => {
    let household = catalogHousehold();
    household = postShift(household, {
      date: "2026-08-18",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "100.00",
      hours: "4.00",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const { shared } = splitForSync(household, "MEM-002");
    expect(shared.shifts).toHaveLength(0);
    const personal = personalReplicaForMember(household, "MEM-002");
    expect(personal.shifts).toHaveLength(1);
    const cloudShared = assembleHousehold(shared, null);
    const merged = overlayPersonalReplica(cloudShared, personal, "MEM-002");
    const run = executeHerculesReadToolPlan(merged, {
      calls: [{ id: "shift-2", name: "shift_summary", args: { period: "this_week" } }],
    }, "2026-08-18", { memberId: "MEM-002", view: "personal" });
    expect(run.results[0]?.status).toBe("ok");
    expect(run.results[0]?.sentence).toMatch(/1 posted shift/i);
  });
});
