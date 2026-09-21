import { describe, expect, it } from "vitest";
import { accountBookBalance } from "../src/core/accounts.ts";
import { accountRows } from "../src/core/accountsWidget.ts";
import { cloneHousehold } from "../src/core/household.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { Household } from "../src/core/types.ts";

/**
 * The balance reader is memoised per published Household OBJECT. These tests
 * pin the two properties that make that safe:
 *   1. the same object returns identical figures (a cache hit cannot drift), and
 *   2. a NEW object — which is what every command produces via structuredClone —
 *      is never served a previous snapshot's books.
 * If someone ever makes a command mutate a published snapshot in place, (2) is
 * the assertion that should fail.
 */
describe("balance reader snapshot cache", () => {
  const today = "2026-09-20" as const;
  const base = (): Household => seedDemoHousehold({ today, environment: "development" });

  it("returns the same balances for repeated reads of one snapshot", () => {
    const household = base();
    const memberId = household.members[0]!.id;
    const first = accountRows(household, memberId, today).map((row) => `${row.accountId}:${row.balanceCents}`);
    const second = accountRows(household, memberId, today).map((row) => `${row.accountId}:${row.balanceCents}`);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("does not serve a cached reader to a different snapshot object", () => {
    const household = base();
    const donor = household.transactions.find((tx) => tx.type === "expense" && tx.amountCents > 0);
    expect(donor).toBeDefined();
    const accountId = donor!.accountId;
    const before = accountBookBalance(household, accountId, today);

    // A command-shaped edit: deep clone, then mutate the clone only.
    const next = cloneHousehold(household);
    next.transactions = next.transactions.filter((tx) => tx.id !== donor!.id);

    expect(accountBookBalance(next, accountId, today)).not.toBe(before);
    // The original object must still read its own, unchanged books.
    expect(accountBookBalance(household, accountId, today)).toBe(before);
  });
});
