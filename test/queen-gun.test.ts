import { describe, expect, it } from "vitest";
import { formatCad } from "../src/core/money.ts";
import { GUN_BILLS, gunFire, gunRoom, gunRoundTotal, gunStep, gunWords, type GunRound, type GunTarget } from "../src/core/queenGun.ts";
import { loftBankScale } from "../src/core/queenPresentation.ts";

const trip: GunTarget = { goalId: "G-TRIP", name: "A trip", amountCents: 20_000, targetCents: 100_000 };
const roof: GunTarget = { goalId: "G-ROOF", name: "The roof", amountCents: 99_000, targetCents: 100_000 };

describe("The loft's money gun — shots add up here; one round posts through the Fund's rollover", () => {
  it("adds each bill to its bank, in exact cents, without touching anything else", () => {
    let round: GunRound = [];
    for (const bill of [GUN_BILLS[1], GUN_BILLS[1], GUN_BILLS[0]]) round = gunFire(round, trip, bill, 1_000_000).round;
    expect(round).toEqual([{ goalId: "G-TRIP", cents: 4_500 }]);
    expect(gunRoundTotal(round)).toBe(4_500);
    expect(gunRoom(trip, round)).toBe(75_500);
  });
  it("never shoots a bank past its target, nor the round past the safe surplus", () => {
    const hit = gunFire([], roof, 5_000, 1_000_000);
    expect(hit).toMatchObject({ landed: 1_000, why: "trimmed" });
    expect(gunFire(hit.round, roof, 5_000, 1_000_000)).toMatchObject({ landed: 0, why: "full" });
    const capped = gunFire([], trip, 10_000, 3_000);
    expect(capped).toMatchObject({ landed: 3_000, why: "trimmed" });
    expect(gunFire(capped.round, trip, 500, 3_000)).toMatchObject({ landed: 0, why: "empty" });
    expect(gunFire([], trip, 0, 3_000).why).toBe("empty");
  });
  it("grows the bank by the studio's ten steps as the round lands", () => {
    expect(gunStep(trip, 0)).toBe(2);
    expect(gunStep(trip, 30_000)).toBe(5);
    expect(gunStep(trip, 80_000)).toBe(10);
    expect(gunStep({ amountCents: 5, targetCents: 0 }, 100)).toBe(0);
  });
  it("says the round in words", () => {
    const names = new Map([["G-TRIP", "A trip"], ["G-ROOF", "The roof"]]);
    expect(gunWords([], names, 10_000, formatCad)).toMatch(/nothing moves until you send it/);
    const round = gunFire(gunFire([], trip, 2_000, 10_000).round, roof, 500, 10_000).round;
    expect(gunWords(round, names, 10_000, formatCad)).toBe("$20.00 at A trip, $5.00 at The roof — $25.00 thrown, $75.00 still loaded.");
  });
});

describe("The loft's banks are sized by their goal", () => {
  it("makes a $10 goal teeny next to a $10,000 one, on a log scale, within bounds", () => {
    expect(loftBankScale(1_000)).toBe(0.22);
    expect(loftBankScale(10_000)).toBe(0.55);
    expect(loftBankScale(100_000)).toBe(0.88);
    expect(loftBankScale(1_000_000)).toBe(1.21);
    expect(loftBankScale(1_000_000_000)).toBe(1.5);
    expect(loftBankScale(0)).toBe(0.22);
    expect(loftBankScale(1_000_000) / loftBankScale(1_000)).toBeGreaterThan(5);
  });
});

import { rackSetSplit } from "../src/core/queenRack.ts";
describe("The divider's card sets a bank's split directly", () => {
  it("sets one bank's parts within 1–10 and leaves other shelves alone", () => {
    const rack = { version: 1 as const, shelves: [{ id: "top", share: 5, cutoff: 20, keys: ["a", "b"] }, { id: "low", share: 1, cutoff: 20, keys: ["c"] }] };
    expect(rackSetSplit(rack, "top", 1, 4).shelves[0]!.splits).toEqual([1, 4]);
    expect(rackSetSplit(rack, "top", 0, 99).shelves[0]!.splits).toEqual([10, 1]);
    expect(rackSetSplit(rack, "low", 0, 3).shelves[1]).toEqual(rack.shelves[1]);
    expect(rackSetSplit(rack, "top", 5, 3)).toEqual(rack);
  });
});
