import { describe, expect, it } from "vitest";
import { calcPotentialDuplicateFlags, duplicateKey } from "../src/core/duplicate.ts";
import { equalSplits, percentSplits } from "../src/core/splits.ts";
import { JOINT } from "../src/core/types.ts";

describe("duplicates and splits", () => {
  it("flags every row that shares a key, in linear time", () => {
    const keys = ["a", "b", "a", "c", "b", "d"];
    const result = calcPotentialDuplicateFlags(keys);
    expect(result.flags).toEqual([true, true, true, false, true, false]);
    expect(result.duplicateKeyCount).toBe(2);
    expect(result.duplicateRowCount).toBe(4);
  });

  it("builds the same fingerprint the household already used", () => {
    expect(duplicateKey({
      date: "2026-08-18",
      amountCents: 123,
      accountId: "ACC-CHEQUING",
      type: "expense",
      note: "  No Frills ",
    })).toBe("20260818|1.23|acc-chequing|expense|no frills");
  });

  it("splits equally and by percent without losing a cent", () => {
    expect(equalSplits(["MEM-001", "MEM-002"], 185001)).toEqual([
      { party: "MEM-001", amountCents: 92500 },
      { party: "MEM-002", amountCents: 92501 },
    ]);
    expect(percentSplits([
      { party: "MEM-001", percent: 60 },
      { party: "MEM-002", percent: 40 },
    ], 100)).toEqual([
      { party: "MEM-001", amountCents: 60 },
      { party: "MEM-002", amountCents: 40 },
    ]);
    expect(percentSplits([
      { party: JOINT, percent: 33.33 },
      { party: "MEM-001", percent: 33.33 },
      { party: "MEM-002", percent: 33.34 },
    ], 100).reduce((sum, split) => sum + split.amountCents, 0)).toBe(100);
  });
});
