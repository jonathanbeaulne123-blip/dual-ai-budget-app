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
import { useDialog } from "../src/useDialog.ts";

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
  h = addGoal(h, { name: "Fictional porch renovation", target: "10", shared: true, ownerMemberId: memberId }).household;
  return h;
}
const shelfOf = (h: Household) => queenShelf(projectKittyNest(h, memberId, "household", today), h, queenShelfOrder(h.kittyNestDesigns)).sort((a, b) => a.name.localeCompare(b.name));
async function render(h: Household, props: Partial<{ onRack: ReturnType<typeof vi.fn>; pour: LoftPour; dirty: boolean; onDone: () => void; rack: QueenRackV1 }> = {}) {
  const shelf = shelfOf(h);
  const rack = props.rack ?? rackSettled(undefined, shelf.map((row) => row.designKey), []);
  await act(async () => root.render(createElement(QueenLoft, {
    shelf, rack, open: true, stairRef: createRef<HTMLButtonElement>(), onExit: () => {}, onOpenGoal: () => {}, onOpenBanks: () => {}, world: "flat",
    onRack: props.onRack ?? vi.fn(), ...(props.pour ? { pour: props.pour } : {}), ...(props.dirty !== undefined ? { dirty: props.dirty } : {}), ...(props.onDone ? { onDone: props.onDone } : {}),
  })));
  return { shelf, rack };
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector);
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const bank = (name: string) => $$<HTMLButtonElement>("[data-ledge-bank]").find((row) => row.getAttribute("aria-label")?.startsWith(name))!;
const tapAt = async (target: Element) => act(async () => {
  for (const type of ["pointerdown", "pointerup"]) target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: 1, clientY: 1, button: 0 }), { isPrimary: true, pointerId: 1, pointerType: "mouse" }));
});

describe("The loft's banks are the studio's own cats, sized by their goal", () => {
  it("draws each bank as the studio's flat piece, a $10 goal far smaller than a $2,000 one", async () => {
    await render(withLedge());
    const scale = (name: string) => Number(bank(name).querySelector<HTMLElement>("[data-room-vessel]")!.style.getPropertyValue("--bank-scale"));
    expect($$(".queen-goal__kitty")).toHaveLength(3);
    expect(scale("Fictional porch renovation")).toBe(0.22);
    expect(scale("Fictional trip to the shore")).toBeCloseTo(0.98, 2);
  });
});

describe("The shelf tools explain themselves and carry sliders", () => {
  it("opens the weight's card on a tap, sets the share by slider, and closes on ×, Escape and a tap outside", async () => {
    const onRack = vi.fn();
    await render(withLedge(), { onRack });
    await click($<HTMLButtonElement>(".queen-shelf__weight")!);
    const card = $(".queen-tool-card")!;
    expect(card.getAttribute("aria-label")).toBe("The weight · the shelf");
    expect(card.textContent).toMatch(/how big a part of every pour this shelf takes/);
    const slider = card.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.value).toBe("5");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "8");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onRack).toHaveBeenCalledTimes(1);
    expect((onRack.mock.calls[0]![0] as QueenRackV1).shelves[0]!.share).toBe(8);
    await click(card.querySelector<HTMLButtonElement>(".queen-tool-card__close")!);
    expect($(".queen-tool-card")).toBeNull();
    // The pin's card, then Escape.
    await click($<HTMLButtonElement>(".queen-shelf__pin")!);
    expect($(".queen-tool-card")!.getAttribute("aria-label")).toBe("The pin · the shelf");
    await act(async () => { $(".queen-tool-card")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".queen-tool-card")).toBeNull();
    // A divider's card has a slider for each neighbour; a tap off it closes it.
    await click($$<HTMLButtonElement>(".queen-divider")[0]!);
    expect($$(".queen-tool-card input")).toHaveLength(2);
    await tapAt(document.body);
    expect($(".queen-tool-card")).toBeNull();
  });

  it("shows a held rack as not saved yet, and Done sends it", async () => {
    const onDone = vi.fn();
    await render(withLedge(), { dirty: true, onDone });
    expect($(".queen-held__mark")!.textContent).toBe("Rack not saved yet");
    await click($<HTMLButtonElement>(".queen-held__done")!);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("The money gun is merged into the jug (K15)", () => {
  it("offers no gun: the custodian's one control is the jug's \"Move $X to Kitty Banks\"", async () => {
    const onPour = vi.fn<LoftPour["onPour"]>(async () => undefined);
    await render(withLedge(), { pour: { safeCents: 5_000, custodian: true, custodianName: "Alex (fictional)", onPour } });
    expect($(".queen-gun")).toBeNull();
    expect(host.textContent).not.toMatch(/money gun/i);
    expect($(".queen-jug__tilt")).not.toBeNull();
  });
});

describe("Clicking off a pop-up closes it", () => {
  function Sheet({ onClose }: { onClose: () => void }) {
    const ref = useDialog(true, onClose);
    return createElement("div", { ref, role: "dialog", "aria-modal": "true", className: "probe" }, createElement("button", { type: "button" }, "Inside"));
  }
  it("closes the top sheet on a tap outside it, but not on a tap inside", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(createElement(Sheet, { onClose })));
    await tapAt(host.querySelector("button")!);
    expect(onClose).not.toHaveBeenCalled();
    await tapAt(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("The loft zooms like the cellar", () => {
  it("sizes the banks with the pane and the +/− keys, and remembers it on the device", async () => {
    localStorage.removeItem("hearth.queen.loft.zoom");
    await render(withLedge());
    const room = $(".queen-room--loft")!;
    expect(room.style.getPropertyValue("--loft-zoom")).toBe("1");
    await click($$<HTMLButtonElement>(".queen-loft-zoom__step").find((row) => row.getAttribute("aria-label") === "Larger banks")!);
    expect(room.style.getPropertyValue("--loft-zoom")).toBe("1.25");
    expect($(".queen-loft-zoom__read")!.textContent).toBe("125%");
    await act(async () => { $(".queen-rack")!.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true })); });
    expect(room.style.getPropertyValue("--loft-zoom")).toBe("1.5");
    await act(async () => { $(".queen-rack")!.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true })); });
    expect(localStorage.getItem("hearth.queen.loft.zoom")).toBe("1.25");
    await act(async () => { $(".queen-rack")!.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true })); });
    expect(Number(room.style.getPropertyValue("--loft-zoom"))).toBeGreaterThan(1.25);
  });
});
