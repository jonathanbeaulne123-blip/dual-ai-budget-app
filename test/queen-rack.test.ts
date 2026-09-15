import { describe, expect, it } from "vitest";
import { formatCad } from "../src/core/money.ts";
import { RACK_LIMITS, pourWords, rackFromOrder, rackHangShelf, rackMoveKey, rackOrder, rackPour, rackSetCutoff, rackSetShare, rackSettled, rackSlideDivider, rackTakeDown, shapeQueenRack, shelfShareWords, type QueenRackV1, type RackBank } from "../src/core/queenRack.ts";
import { saveKittyNestDesign, shapeKittyNestDesigns } from "../src/core/kittyNestDesigns.ts";
import { catalogHousehold } from "../src/core/seed.ts";

const banks: RackBank[] = [
  { key: "goal:trip", goalId: "G-TRIP", name: "A trip", amountCents: 20_000, targetCents: 200_000 },
  { key: "goal:roof", goalId: "G-ROOF", name: "The roof", amountCents: 90_000, targetCents: 100_000 },
  { key: "goal:piano", goalId: "G-PIANO", name: "A piano", amountCents: 0, targetCents: 50_000 },
];
const rack: QueenRackV1 = { version: 1, shelves: [
  { id: "top", share: 5, cutoff: 20, keys: ["goal:trip", "goal:roof"] },
  { id: "low", share: 1, cutoff: 20, keys: ["goal:piano"] },
] };

describe("The loft's rack — shelves as weights, pins as marks, dividers as splits", () => {
  it("shapes a stored rack exactly, and refuses what it cannot read", () => {
    expect(shapeQueenRack(undefined)).toBeUndefined();
    expect(shapeQueenRack(rack)).toEqual(rack);
    for (const bad of [
      { version: 2, shelves: rack.shelves },
      { version: 1, shelves: [] },
      { version: 1, shelves: [{ id: "a", share: 0, cutoff: 20, keys: [] }] },
      { version: 1, shelves: [{ id: "a", share: 5, cutoff: 21, keys: [] }] },
      { version: 1, shelves: [{ id: "a", share: 5, cutoff: 20, keys: ["x"] }, { id: "b", share: 5, cutoff: 20, keys: ["x"] }] },
      { version: 1, shelves: [{ id: "a", share: 5, cutoff: 20, keys: ["x", "y"], splits: [1] }] },
      { version: 1, shelves: [{ id: "a", share: 5, cutoff: 20, keys: [], extra: 1 }] },
      { version: 1, shelves: Array.from({ length: RACK_LIMITS.shelves + 1 }, (_, i) => ({ id: `s${i}`, share: 1, cutoff: 20, keys: [] })) },
    ]) expect(() => shapeQueenRack(bad), JSON.stringify(bad)).toThrow(/updated Hearth/);
  });

  it("starts as one shelf from the old order, settles to the banks the loft has, and reads back as an order", () => {
    const one = rackFromOrder(["goal:roof", "goal:trip"]);
    expect(one.shelves).toHaveLength(1);
    expect(one.shelves[0]!.cutoff).toBe(RACK_LIMITS.marks);
    const settled = rackSettled(rack, ["goal:roof", "goal:piano", "goal:new"]);
    expect(settled.shelves[0]!.keys).toEqual(["goal:roof"]);
    expect(settled.shelves[1]!.keys).toEqual(["goal:piano", "goal:new"]);
    expect(rackOrder(settled)).toEqual(["goal:roof", "goal:piano", "goal:new"]);
    expect(rackSettled(undefined, ["b", "a"], ["a", "b", "gone"]).shelves[0]!.keys).toEqual(["a", "b"]);
  });

  it("moves a bank between shelves and along one, keeps its split, and never mutates the rack it was given", () => {
    const before = JSON.stringify(rack);
    const moved = rackMoveKey(rack, "goal:trip", 1, 0);
    expect(moved.shelves[0]!.keys).toEqual(["goal:roof"]);
    expect(moved.shelves[1]!.keys).toEqual(["goal:trip", "goal:piano"]);
    const along = rackMoveKey(rack, "goal:trip", 0, 2);
    expect(along.shelves[0]!.keys).toEqual(["goal:roof", "goal:trip"]);
    expect(rackMoveKey(rack, "goal:nobody", 0, 0)).toBe(rack);
    expect(JSON.stringify(rack)).toBe(before);
  });

  it("sets a share and a mark within their bands, slides a divider one step, hangs and takes down shelves", () => {
    expect(rackSetShare(rack, "low", 40).shelves[1]!.share).toBe(RACK_LIMITS.share);
    expect(rackSetShare(rack, "low", -3).shelves[1]!.share).toBe(1);
    expect(rackSetCutoff(rack, "top", 7.6).shelves[0]!.cutoff).toBe(8);
    const slid = rackSlideDivider(rack, "top", 0, "right");
    expect(slid.shelves[0]!.splits).toEqual([2, 1]);
    expect(rackSlideDivider(slid, "top", 0, "left").shelves[0]!.splits).toBeUndefined();
    expect(rackSlideDivider(rack, "top", 5, "right")).toEqual(rack);
    const hung = rackHangShelf(rack);
    expect(hung.shelves).toHaveLength(3);
    expect(hung.shelves[2]).toEqual({ id: "shelf-1", share: 1, cutoff: RACK_LIMITS.marks, keys: [] });
    expect(rackTakeDown(hung, "shelf-1").shelves).toHaveLength(2);
    expect(rackTakeDown(rack, "top")).toBe(rack);
    expect(rackTakeDown(rackFromOrder([]), "shelf-1").shelves).toHaveLength(1);
    let full = rack;
    for (let i = 0; i < 6; i += 1) full = rackHangShelf(full);
    expect(full.shelves).toHaveLength(RACK_LIMITS.shelves);
    expect(shelfShareWords(rack, "top")).toBe("5 of 6");
  });

  it("pours by share, caps each shelf at the room to its mark, flows the rest down, and is exact in cents", () => {
    const pour = rackPour(rack, banks, 60_000);
    expect(pour.pouredCents).toBe(60_000);
    expect(pour.placedCents + pour.leftCents).toBe(60_000);
    // 5:1 → $500 to the top shelf, $100 to the low one.
    expect(pour.shelves[0]!.cents).toBe(50_000);
    expect(pour.shelves[1]!.cents).toBe(10_000);
    // On the top shelf, equal splits — but the roof has only $100 of room, so the trip takes the rest.
    expect(pour.shelves[0]!.lines.map((line) => [line.name, line.cents])).toEqual([["A trip", 40_000], ["The roof", 10_000]]);
    expect(pour.shelves[1]!.lines[0]!.cents).toBe(10_000);
    expect(pour.leftCents).toBe(0);
    // A mark at half: the trip's room is $80 (half of $2000 less $200), the roof is already past half.
    const marked = rackSetCutoff(rack, "top", 10);
    const half = rackPour(marked, banks, 60_000);
    expect(half.shelves[0]!.cents).toBe(80_000 - 0 > 50_000 ? 50_000 : 80_000);
    expect(half.shelves[0]!.lines.map((line) => line.cents)).toEqual([50_000, 0]);
    expect(half.shelves[0]!.full).toBe(false);
    // Pour more than the rack can hold: the top shelf fills to its mark, the low shelf to its room, the rest stays in the Fund.
    const flood = rackPour(marked, banks, 500_000);
    expect(flood.shelves[0]!.cents).toBe(80_000);
    expect(flood.shelves[0]!.full).toBe(true);
    expect(flood.shelves[1]!.cents).toBe(50_000);
    expect(flood.leftCents).toBe(500_000 - 80_000 - 50_000);
    // Odd cents land whole: nothing is lost to rounding.
    const odd = rackPour(rack, banks, 12_345);
    expect(odd.shelves.reduce((sum, shelf) => sum + shelf.lines.reduce((s, line) => s + line.cents, 0), 0) + odd.leftCents).toBe(12_345);
    expect(odd.shelves.flatMap((shelf) => shelf.lines).every((line) => Number.isInteger(line.cents))).toBe(true);
    // Nothing to pour, and a rack with nothing on it.
    expect(rackPour(rack, banks, 0).placedCents).toBe(0);
    expect(rackPour(rackFromOrder([]), banks, 1_000).leftCents).toBe(1_000);
  });

  it("splits a shelf by its dividers", () => {
    const divided: QueenRackV1 = { version: 1, shelves: [{ id: "top", share: 5, cutoff: 20, keys: ["goal:trip", "goal:piano"], splits: [3, 1] }] };
    const pour = rackPour(divided, banks, 40_000);
    expect(pour.shelves[0]!.lines.map((line) => line.cents)).toEqual([30_000, 10_000]);
  });

  it("says the pour in one breath, with figures — this is Confirm's own preview", () => {
    expect(pourWords(rackPour(rack, banks, 60_000), formatCad)).toBe("$500.00 to the top shelf (A trip $400.00, The roof $100.00); $100.00 to the bottom shelf (A piano $100.00).");
    expect(pourWords(rackPour(rack, banks, 0), formatCad)).toBe("Nothing to pour.");
    const flood = pourWords(rackPour(rackSetCutoff(rack, "top", 10), banks, 500_000), formatCad);
    expect(flood).toContain("stays in the Fund");
  });

  it("rides the Build plan bank's household design row, writes the old order from it, and is refused on any other row", () => {
    let h = catalogHousehold("development");
    const memberId = h.members[0]!.id;
    h = saveKittyNestDesign(h, { memberId, view: "household", bankKey: "plan:build", expectedRevision: 0, name: "Build", glaze: "cream", rack }).household;
    const row = h.kittyNestDesigns!.find((r) => r.bankKey === "plan:build")!;
    expect(row.rack).toEqual(rack);
    expect(row.order).toEqual(["goal:trip", "goal:roof", "goal:piano"]);
    expect(shapeKittyNestDesigns(h.kittyNestDesigns)[0]!.rack).toEqual(rack);
    expect(() => shapeKittyNestDesigns([{ ...row, id: row.id.replace("plan:build", "plan:protect"), bankKey: "plan:protect" }])).toThrow(/updated Hearth/);
    expect(() => saveKittyNestDesign(h, { memberId, view: "household", bankKey: "plan:build", expectedRevision: 1, name: "Build", glaze: "cream", rack: { version: 1, shelves: [] } })).toThrow(/updated Hearth/);
  });
});
