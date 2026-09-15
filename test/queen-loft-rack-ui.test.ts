// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueenLoft, type LoftPour } from "../src/queen/QueenLoft.tsx";
import { queenShelf, queenShelfOrder } from "../src/core/queenPresentation.ts";
import { rackSettled, type QueenRackV1 } from "../src/core/queenRack.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { addGoal, addRecurrence, type Household } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const memberId = "MEM-001";
const today = "2026-09-12";
function withLedge(): Household {
  let h = planLifeFixture("household");
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-26", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional date night" }).household;
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: memberId }).household;
  h = addGoal(h, { name: "Fictional porch renovation", target: "900", shared: true, ownerMemberId: memberId }).household;
  return h;
}
/** The nest's own order of two fresh goals is not fixed, so the shelf is read by name: the date night, the renovation, the trip. */
const shelfOf = (h: Household) => queenShelf(projectKittyNest(h, memberId, "household", today), h, queenShelfOrder(h.kittyNestDesigns)).sort((a, b) => a.name.localeCompare(b.name));

async function render(h: Household, rack: QueenRackV1, overrides: Partial<{ onRack: ReturnType<typeof vi.fn>; pour: LoftPour }> = {}) {
  const shelf = shelfOf(h);
  const onRack = overrides.onRack ?? vi.fn();
  await act(async () => root.render(createElement(QueenLoft, {
    shelf, rack, open: true, stairRef: createRef<HTMLButtonElement>(), onExit: () => {}, onOpenGoal: () => {}, onOpenBanks: () => {}, world: "flat",
    onRack, ...(overrides.pour ? { pour: overrides.pour } : {}),
  })));
  return { shelf, onRack };
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const key = async (element: HTMLElement, k: string, shift = false) => act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true })); });
const bank = (name: string) => $$<HTMLButtonElement>("[data-ledge-bank]").find((row) => row.getAttribute("aria-label")?.startsWith(name))!;

describe("The loft's rack — shelves you hang, weight, mark and divide by hand", () => {
  it("stands one shelf from the old order, with a weight, a pin and a peg to hang another", async () => {
    const h = withLedge();
    const rack = rackSettled(undefined, shelfOf(h).map((row) => row.designKey), []);
    await render(h, rack);
    expect($$("[data-room-shelf]")).toHaveLength(1);
    expect($(".queen-room__sub").textContent).toMatch(/on the shelf · the top shelf is fed first$/);
    expect($(".queen-shelf__weight").getAttribute("aria-valuetext")).toBe("5 of 5");
    expect($(".queen-shelf__pin").getAttribute("aria-valuetext")).toBe("to the crown");
    expect($(".queen-rack__hang").textContent).toBe("Hang a shelf below");
    // No divider before the first bank; one between each pair.
    expect($$(".queen-divider")).toHaveLength(2);
    expect($$(".queen-divider")[0]!.getAttribute("aria-label")).toBe("Divider between Fictional date night and Fictional porch renovation");
  });

  it("hangs a shelf, moves a bank down onto it with Shift+ArrowDown, and writes the whole rack once each time", async () => {
    const h = withLedge();
    const keys = shelfOf(h).map((row) => row.designKey);
    const rack = rackSettled(undefined, keys, []);
    const { onRack } = await render(h, rack);
    await click($(".queen-rack__hang"));
    expect(onRack).toHaveBeenCalledTimes(1);
    const hung = onRack.mock.calls[0]![0] as QueenRackV1;
    expect(hung.shelves).toHaveLength(2);
    expect(hung.shelves[1]).toMatchObject({ share: 4, cutoff: 20, keys: [] });
    await render(h, hung, { onRack });
    expect($$("[data-room-shelf]")).toHaveLength(2);
    expect($(".queen-room__sub").textContent).toMatch(/on 2 shelves/);
    await key(bank("Fictional porch renovation"), "ArrowDown", true);
    expect(onRack).toHaveBeenCalledTimes(2);
    const moved = onRack.mock.calls[1]![0] as QueenRackV1;
    expect(moved.shelves[0]!.keys).toEqual(keys.filter((k) => k !== moved.shelves[1]!.keys[0]));
    expect(moved.shelves[1]!.keys).toHaveLength(1);
    await render(h, moved, { onRack });
    expect(bank("Fictional porch renovation").getAttribute("aria-label")).toContain("1 of 1 on the bottom shelf");
    // An empty shelf can be taken down; a shelf with a bank on it cannot.
    await render(h, hung, { onRack });
    await click($(".queen-shelf__down"));
    expect((onRack.mock.calls[2]![0] as QueenRackV1).shelves).toHaveLength(1);
  });

  it("slides the weight, the pin and a divider from the keyboard, each writing the rack, each read back in words", async () => {
    const h = withLedge();
    const rack = rackSettled(undefined, shelfOf(h).map((row) => row.designKey), []);
    const { onRack } = await render(h, rack);
    await key($(".queen-shelf__weight"), "ArrowRight");
    expect((onRack.mock.calls[0]![0] as QueenRackV1).shelves[0]!.share).toBe(6);
    await key($(".queen-shelf__pin"), "ArrowDown");
    expect((onRack.mock.calls[1]![0] as QueenRackV1).shelves[0]!.cutoff).toBe(19);
    await key($(".queen-shelf__pin"), "Home");
    expect((onRack.mock.calls[2]![0] as QueenRackV1).shelves[0]!.cutoff).toBe(0);
    await key($$(".queen-divider")[0]!, "ArrowRight");
    expect((onRack.mock.calls[3]![0] as QueenRackV1).shelves[0]!.splits).toEqual([2, 1, 1]);
    const half = { version: 1 as const, shelves: [{ ...rack.shelves[0]!, cutoff: 10, share: 3 }] };
    await render(h, half, { onRack });
    expect($(".queen-shelf__pin").getAttribute("aria-valuetext")).toBe("halfway");
    expect($(".queen-shelf__weight").getAttribute("aria-valuetext")).toBe("3 of 3");
    expect($(".queen-ledge").getAttribute("aria-label")).toBe("the shelf — 3 on it, share 3 of 3, fill mark halfway");
  });

  it("pours: the custodian tilts the jug, reads the split in words, confirms, and the rollover is posted once with exact cents", async () => {
    const h = withLedge();
    const rack = rackSettled(undefined, shelfOf(h).map((row) => row.designKey), []);
    const onPour = vi.fn<LoftPour["onPour"]>(async () => undefined);
    await render(h, rack, { pour: { safeCents: 100_000, custodian: true, custodianName: "Alex (fictional)", onPour } });
    expect($(".queen-jug__safe").textContent).toBe("$1000.00 safe to pour");
    expect($(".queen-pour")).toBeNull();
    const tilt = $<HTMLInputElement>(".queen-jug__tilt");
    await act(async () => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; set.call(tilt, "5"); tilt.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(tilt.getAttribute("aria-valuetext")).toBe("50% of the safe surplus, $500.00");
    // Half the surplus over one shelf of three, split equally: the lidded date night takes nothing (no goal); the two goals share it.
    expect($(".queen-room__line").textContent).toBe("The jug tilts. $500.00 to the shelf (Fictional porch renovation $250.00, Fictional trip to the shore $250.00).");
    await click($(".queen-pour"));
    const sheet = document.querySelector("[role='dialog']");
    expect(sheet?.textContent).toMatch(/Pour \$500\.00 of the Fund's surplus over the rack/);
    expect(onPour).not.toHaveBeenCalled();
    await click([...document.querySelectorAll<HTMLButtonElement>("[role='dialog'] button")].find((row) => row.textContent === "Pour it")!);
    expect(onPour).toHaveBeenCalledTimes(1);
    expect(onPour.mock.calls[0]![0]).toEqual([{ goalId: expect.any(String), amountCents: 25_000 }, { goalId: expect.any(String), amountCents: 25_000 }]);
    expect(onPour.mock.calls[0]![1]).toBe(50_000);
  });

  it("shows who holds the jug to everyone else, and nothing to pour when the surplus is nil", async () => {
    const h = withLedge();
    const rack = rackSettled(undefined, shelfOf(h).map((row) => row.designKey), []);
    await render(h, rack, { pour: { safeCents: 100_000, custodian: false, custodianName: "Sam (fictional)", onPour: vi.fn(async () => undefined) } });
    expect($(".queen-jug__holder").textContent).toBe("Sam (fictional) holds the jug.");
    expect($(".queen-jug__tilt")).toBeNull();
    await render(h, rack, { pour: { safeCents: 0, custodian: true, custodianName: "Alex", onPour: vi.fn(async () => undefined) } });
    expect($(".queen-jug__safe").textContent).toBe("Nothing safe to pour this month");
    expect($<HTMLInputElement>(".queen-jug__tilt").disabled).toBe(true);
  });
});
