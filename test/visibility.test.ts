import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/seed.ts";
import { addAccount, addGoal, postEntry, postShift, undo } from "../src/core/commands.ts";
import { compileHousehold } from "../src/core/journal.ts";
import {
  assembleHousehold,
  emptyPersonal,
  mergeShared,
  overlayPersonalReplica,
  personalReplicaForMember,
  splitForSync,
} from "../src/core/sync.ts";
import { householdForHerculesContext, householdForShiftReadTools, householdForView } from "../src/core/visibility.ts";
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
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
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
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
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

  it("strips all 7shifts evidence references before Hercules receives confirmed shift facts", () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-18", memberId: "MEM-002", accountId: "ACC-CASH", sales: "100.00", hours: "4.00",
      createdBy: "MEM-002", visibility: "personal", confirmDuplicate: true, customersServed: 10, staffingCount: 2, eventTag: "regular",
    }).household;
    posted.shifts[0]!.sevenShiftsPunchDigest = "a".repeat(64);
    posted.shifts[0]!.sevenShiftsEvidenceBundle = { materialHash: "raw-private-hash", evidence: [{ evidenceId: "raw-private-object" }] } as never;
    const projected = householdForHerculesContext(posted, "MEM-002", "personal");
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("sevenShiftsEvidenceBundle");
    expect(serialized).not.toContain("sevenShiftsPunchDigest");
    expect(serialized).not.toContain("raw-private-hash");
    expect(projected.shifts).toHaveLength(1);
  });

  it("keeps the requesting member's Personal account with Personal journal rows in Hercules context", () => {
    let household = addAccount(catalogHousehold(), {
      name: "Jonathan private chequing",
      kind: "chequing",
      scope: "personal",
      ownerMemberId: "MEM-002",
    }).household;
    household = addAccount(household, {
      name: "Bianca private chequing",
      kind: "chequing",
      scope: "personal",
      ownerMemberId: "MEM-001",
    }).household;
    household = postEntry(household, {
      ...grocery("MEM-002", "personal", "Jonathan private groceries"),
      accountId: "ACC-JONATHAN-PRIVATE-CHEQUING",
    }).household;

    const projected = householdForHerculesContext(household, "MEM-002", "personal");
    expect(projected.accounts.map((account) => account.id)).toContain("ACC-JONATHAN-PRIVATE-CHEQUING");
    expect(projected.accounts.map((account) => account.id)).not.toContain("ACC-BIANCA-PRIVATE-CHEQUING");
    expect(projected.transactions.map((transaction) => transaction.note)).toContain("Jonathan private groceries");
    expect(() => compileHousehold(projected)).not.toThrow();
  });

  it("reduces published schedule rows before Hercules so source identity never reaches a model or tool", () => {
    const household = catalogHousehold();
    household.sevenShiftsSchedules = [{
      id: "7SC-private-uid-hash", provenanceId: "7shifts-calendar:private-uid-hash", memberId: "MEM-002", source: "7shifts-calendar",
      startedAt: "2026-08-29T21:00:00.000Z", endedAt: "2026-08-30T02:00:00.000Z", date: "2026-08-29", scheduledMinutes: 300,
      jobId: null, roleId: null, eventTag: "regular", staffingCount: 3, staffingSource: "calendar-overlap", delivery: "selected-file",
      selfMatch: "member-name", notesPresent: true, sequence: 4, sourceUpdatedAt: "2026-08-28T00:00:00.000Z",
      createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z",
    }];
    const serialized = JSON.stringify(householdForHerculesContext(household, "MEM-002", "personal"));
    expect(serialized).not.toContain("private-uid-hash");
    expect(serialized).not.toContain("provenanceId");
    expect(serialized).not.toContain("sourceUpdatedAt");
    expect(serialized).toContain('"scheduledMinutes":300');
    expect(serialized).toContain('"staffingCount":3');
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
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
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
