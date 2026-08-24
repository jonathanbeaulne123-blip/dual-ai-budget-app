import { describe, expect, it } from "vitest";
import {
  assembleHousehold,
  catalogHousehold,
  ensureHouseholdShape,
  ledgerNameForView,
  nameHouseholdLedgers,
  splitForSync,
} from "../src/core/index.ts";

describe("new household ledger names", () => {
  it("names the household, shared ledger, and selected member's Personal ledger", () => {
    const named = nameHouseholdLedgers(catalogHousehold(), {
      householdName: "The North House",
      sharedLedgerName: "Kitchen Books",
      personalLedgerName: "Jonathan's Quiet Books",
      personalMemberId: "MEM-002",
    });

    expect(named.name).toBe("The North House");
    expect(ledgerNameForView(named, "MEM-002", "household")).toBe("Kitchen Books");
    expect(ledgerNameForView(named, "MEM-002", "personal")).toBe("Jonathan's Quiet Books");
    expect(ledgerNameForView(named, "MEM-001", "personal")).toBe("Bianca's Personal Ledger");
  });

  it("migrates legacy snapshots to safe names", () => {
    const legacy = { ...catalogHousehold(), ledgerNames: undefined };
    const shaped = ensureHouseholdShape(legacy as unknown as ReturnType<typeof catalogHousehold>);

    expect(shaped.ledgerNames.shared).toBe("Household Ledger");
    expect(shaped.ledgerNames.personal["MEM-001"]).toBe("Bianca's Personal Ledger");
  });

  it("keeps the names through the shared cloud envelope", () => {
    const named = nameHouseholdLedgers(catalogHousehold(), {
      householdName: "The North House",
      sharedLedgerName: "Kitchen Books",
      personalLedgerName: "Bianca's Notebook",
      personalMemberId: "MEM-001",
    });
    const parts = splitForSync(named, "MEM-001");
    const assembled = assembleHousehold(parts.shared, parts.personal);

    expect(assembled.ledgerNames).toEqual(named.ledgerNames);
    expect(ledgerNameForView(assembled, "MEM-001", "personal")).toBe("Bianca's Notebook");
  });
});
