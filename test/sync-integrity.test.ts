import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  addGoal,
  archiveAccount,
  assembleHousehold,
  catalogHousehold,
  contributeToGoal,
  ensureHouseholdShape,
  householdForView,
  mergePersonal,
  mergeShared,
  postEntry,
  splitForSync,
} from "../src/core/index.ts";
import { hashBooksSnapshot, hostedFailureStatus } from "../src/ledger/engine.ts";

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

function ids(rows: { id: string }[]): string[] {
  return rows.map((row) => row.id).sort();
}

function reconcileLike(local: ReturnType<typeof catalogHousehold>, remote: ReturnType<typeof catalogHousehold>, memberId: string) {
  const localParts = splitForSync(local, memberId);
  const remoteParts = splitForSync(remote, memberId);
  return assembleHousehold(
    mergeShared(remoteParts.shared, localParts.shared),
    mergePersonal(remoteParts.personal, localParts.personal),
  );
}

describe("sync integrity (Claude review 2026-08-22)", () => {
  it("unions concurrent goal contributions instead of last-write-wins on savedCents", () => {
    const base = addGoal(catalogHousehold(), { name: "Japan", target: 5000, shared: true }).household;
    const goalId = base.goals[0]!.id;
    const jonathan = contributeToGoal(base, goalId, "300", { createdBy: "MEM-002" }).household;
    const bianca = contributeToGoal(base, goalId, "200", { createdBy: "MEM-001" }).household;
    const merged = reconcileLike(jonathan, bianca, "MEM-002");
    expect(merged.goalContributions).toHaveLength(2);
    expect(merged.goals.find((goal) => goal.id === goalId)?.savedCents).toBe(50000);
    expect(merged.goalContributions.map((row) => row.amountCents).sort((left, right) => left - right)).toEqual([20000, 30000]);
  });

  it("keeps the other member's personal rows when reconciling a full snapshot as this member", () => {
    let remote = catalogHousehold();
    remote = postEntry(remote, grocery("MEM-001", "personal", "Bianca hair", "42.00")).household;
    remote = postEntry(remote, grocery("MEM-002", "household", "Milk")).household;
    const local = postEntry(catalogHousehold(), grocery("MEM-002", "personal", "Jonathan gym", "28.50")).household;
    const merged = reconcileLike(local, remote, "MEM-002");
    expect(merged.transactions.map((tx) => tx.note).sort()).toEqual(["Bianca hair", "Jonathan gym", "Milk"]);
    expect(householdForView(merged, "MEM-002", "personal").transactions.map((tx) => tx.note)).toEqual(["Jonathan gym"]);
    expect(householdForView(merged, "MEM-001", "personal").transactions.map((tx) => tx.note)).toEqual(["Bianca hair"]);
  });

  it("does not resurrect an archived account from a stale phone", () => {
    const base = catalogHousehold();
    const archived = archiveAccount(base, "ACC-SAVINGS").household;
    const staleWinsIfNoTimestamp = reconcileLike(base, archived, "MEM-001");
    expect(staleWinsIfNoTimestamp.accounts.find((account) => account.id === "ACC-SAVINGS")?.active).toBe(false);
    const archiveIsLocal = reconcileLike(archived, base, "MEM-002");
    expect(archiveIsLocal.accounts.find((account) => account.id === "ACC-SAVINGS")?.active).toBe(false);
  });

  it("migrates a pre-contribution savedCents total into a stable legacy row", () => {
    const raw = catalogHousehold();
    const legacy = ensureHouseholdShape({
      ...raw,
      goals: [{
        id: "GOAL-001",
        name: "Japan",
        targetCents: 500000,
        savedCents: 160000,
        deadline: null,
        shared: true,
        ownerMemberId: null,
        subcategoryId: null,
      } as never],
      goalContributions: [],
    });
    expect(legacy.goals[0]?.savedCents).toBe(160000);
    expect(legacy.goalContributions).toHaveLength(1);
    expect(legacy.goalContributions[0]?.id).toBe("GCON-LEGACY-GOAL-001");
    const again = ensureHouseholdShape(legacy);
    expect(again.goalContributions).toHaveLength(1);
    expect(again.goals[0]?.savedCents).toBe(160000);
  });

  it("split/merge/assemble keeps every id except tombstones", () => {
    let household = catalogHousehold();
    household = postEntry(household, grocery("MEM-001", "personal", "Bianca only")).household;
    household = postEntry(household, grocery("MEM-002", "personal", "Jonathan only")).household;
    household = postEntry(household, grocery("MEM-002", "household", "Groceries")).household;
    household = addGoal(household, { name: "Japan", target: 1000 }).household;
    household = contributeToGoal(household, household.goals[0]!.id, "40", { createdBy: "MEM-001" }).household;
    const left = splitForSync(household, "MEM-001");
    const right = splitForSync(household, "MEM-002");
    const assembled = assembleHousehold(mergeShared(left.shared, right.shared), mergePersonal(left.personal, right.personal));
    expect(ids(assembled.transactions)).toEqual(ids(household.transactions));
    expect(ids(assembled.shifts)).toEqual(ids(household.shifts));
    expect(ids(assembled.accounts)).toEqual(ids(household.accounts));
    expect(ids(assembled.goals)).toEqual(ids(household.goals));
    expect(ids(assembled.goalContributions)).toEqual(ids(household.goalContributions));
    expect(assembled.goals[0]?.savedCents).toBe(household.goals[0]?.savedCents);
  });

  it("hashes amounts, dates, splits, shifts, and goal contributions, not just ids", async () => {
    const posted = postEntry(catalogHousehold(), grocery("MEM-002", "household", "Milk", "12.00"));
    const changed = postEntry(catalogHousehold(), grocery("MEM-002", "household", "Milk", "12.01"));
    const sameIds: typeof posted.household = {
      ...posted.household,
      transactions: posted.household.transactions.map((tx) => ({ ...tx, amountCents: tx.amountCents + 1 })),
    };
    const originalHash = await hashBooksSnapshot(posted.household);
    expect(await hashBooksSnapshot(changed.household)).not.toBe(originalHash);
    expect(await hashBooksSnapshot(sameIds)).not.toBe(originalHash);
    expect(await hashBooksSnapshot(posted.household)).toBe(originalHash);
  });

  it("reports hosted as unreachable when the failure probe says the network is down", () => {
    const src = readFileSync(new URL("../src/ledger/engine.ts", import.meta.url), "utf8");
    expect(src).toMatch(/hostedFailureStatus\(caught, hosted\)/);
    expect(hostedFailureStatus(new Error("Failed to fetch"), { reachable: false, project: "tykhocwacaxwquhynkok" })).toEqual({
      provider: "supabase",
      reachable: false,
      schema: false,
      project: "tykhocwacaxwquhynkok",
      error: "Failed to fetch",
    });
  });
});
