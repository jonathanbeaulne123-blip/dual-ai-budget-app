// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { personalReplicaForMember, seedDemoHousehold } from "../src/core/index.ts";
import {
  activeHouseholdId,
  clearHousehold,
  listHouseholdReplicas,
  loadHousehold,
  loadPersonalReplica,
  saveHousehold,
  selectHouseholdReplica,
} from "../src/storage.ts";
import { loadSession, saveSession } from "../src/session.ts";

function household(id: string, name: string) {
  return {
    ...seedDemoHousehold({ today: "2026-08-24", environment: "development" }),
    householdId: id,
    inviteCode: `INVITE-${id}`,
    name,
  };
}

describe("multi-ledger replicas", () => {
  beforeEach(() => localStorage.clear());

  it("migrates the legacy environment snapshot without losing it", async () => {
    const legacy = household("HH-LEGACY", "Legacy kitchen");
    localStorage.setItem("hearth:v1:development", JSON.stringify(legacy));

    const loaded = await loadHousehold("development", null, "MEM-001");

    expect(loaded?.householdId).toBe("HH-LEGACY");
    expect(activeHouseholdId("development")).toBe("HH-LEGACY");
    expect(await listHouseholdReplicas("development")).toMatchObject([
      { householdId: "HH-LEGACY", name: "Legacy kitchen" },
    ]);
    expect((await loadPersonalReplica("development", "HH-LEGACY", "MEM-001"))?.memberId).toBe("MEM-001");
  });

  it("keeps multiple households and switches the active pointer", async () => {
    const first = household("HH-FIRST", "First home");
    const second = household("HH-SECOND", "Second home");
    await saveHousehold(first, { memberId: "MEM-001" });
    await saveHousehold(second, { memberId: "MEM-001", activate: false });

    expect((await listHouseholdReplicas("development")).map((item) => item.householdId).sort()).toEqual([
      "HH-FIRST",
      "HH-SECOND",
    ]);
    expect(activeHouseholdId("development")).toBe("HH-FIRST");

    const selected = await selectHouseholdReplica("development", "HH-SECOND", "MEM-001");
    expect(selected.name).toBe("Second home");
    expect(activeHouseholdId("development")).toBe("HH-SECOND");
    expect((await loadHousehold("development"))?.householdId).toBe("HH-SECOND");
  });

  it("writes only the signed-in member's personal rows to their replica", async () => {
    const base = household("HH-PRIVATE", "Private rows");
    const sample = base.transactions[0]!;
    const withPrivateRows = {
      ...base,
      transactions: [
        ...base.transactions,
        { ...sample, id: "TX-MEM-001", createdBy: "MEM-001", visibility: "personal" as const },
        { ...sample, id: "TX-MEM-002", createdBy: "MEM-002", visibility: "personal" as const },
      ],
    };

    const first = personalReplicaForMember(withPrivateRows, "MEM-001");
    const second = personalReplicaForMember(withPrivateRows, "MEM-002");
    expect(first.transactions.map((tx) => tx.id)).toContain("TX-MEM-001");
    expect(first.transactions.map((tx) => tx.id)).not.toContain("TX-MEM-002");
    expect(second.transactions.map((tx) => tx.id)).toContain("TX-MEM-002");

    await saveHousehold(withPrivateRows, { memberId: "MEM-001" });
    expect((await loadPersonalReplica("development", "HH-PRIVATE", "MEM-001"))?.transactions.map((tx) => tx.id)).toContain("TX-MEM-001");
    expect(await loadPersonalReplica("development", "HH-PRIVATE", "MEM-002")).toBeNull();
  });

  it("clears only the selected ledger and keeps the other replica readable", async () => {
    await saveHousehold(household("HH-KEEP", "Keep me"), { memberId: "MEM-001", activate: false });
    await saveHousehold(household("HH-CLEAR", "Clear me"), { memberId: "MEM-001" });

    await clearHousehold("development", "HH-CLEAR");

    expect((await listHouseholdReplicas("development")).map((item) => item.householdId)).toEqual(["HH-KEEP"]);
    expect((await loadHousehold("development"))?.householdId).toBe("HH-KEEP");
  });

  it("remembers the active household in the environment session", () => {
    saveSession("development", { memberId: "MEM-001", view: "personal", householdId: "HH-SECOND" });
    expect(loadSession("development")).toEqual({
      memberId: "MEM-001",
      view: "personal",
      householdId: "HH-SECOND",
    });
  });
});
