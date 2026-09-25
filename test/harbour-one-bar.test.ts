// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { Compass, EDITION_FLIP_KEY, editionKeyShouldFlip, flipMotionEdition, useEditionFlipKey, type CompassFab } from "../src/harbour/nav/Compass.tsx";
import { MOTION_KEY, readMotionEdition } from "../src/harbour/nav/QuickSheet.tsx";
import { VillageHUD } from "../src/harbour/village/VillageHUD.tsx";

/**
 * The glass over the harbour (Tool Atlas brief §2.4, §4.1, §6): the seven-control
 * bar retired. The island stands three bubbles — Simple view, All tools, Record —
 * fixed to the viewport, in the declared focus order; the flip and the backtick
 * write the same `hearth:motion` switch the sheet does; the App's door edition
 * carries the same three things and steps aside while the island's glass stands.
 */
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); window.localStorage.clear(); document.body.innerHTML = ""; });

function fab(log: string[] = []): CompassFab {
  return { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: (open) => log.push(`open:${open}`), onPick: (mode) => log.push(`pick:${mode}`), onGo: (tab) => log.push(`go:${tab}`) };
}

function hud(overrides: Record<string, unknown> = {}) {
  return createElement(VillageHUD, { place: "court", travelling: null, onVisit: () => undefined, onView: () => undefined, onJourney: () => undefined, avatar: "jonathan", fab: fab(), onQuickSheet: () => undefined, ...overrides } as Parameters<typeof VillageHUD>[0]);
}

const bubbles = () => [...host.querySelectorAll<HTMLElement>("[data-glass-bubble]")].map((node) => node.dataset.glassBubble);
const flip = () => host.querySelector<HTMLButtonElement>("[data-glass-flip]")!;

describe("the glass over the harbour", () => {
  it("stands three bubbles in focus order — Simple view, All tools, Record — and no seven-control bar", async () => {
    await act(async () => root.render(hud({ onArrange: () => undefined })));
    expect(bubbles()).toEqual(["flip", "tools", "record"]);
    for (const node of host.querySelectorAll<HTMLElement>("[data-glass-bubble]")) {
      expect(node.classList.contains("is-fixed")).toBe(true);
      expect(node.dataset.cameraDeadzone).toBe("44");
    }
    // The retired controls are gone from the glass.
    expect(host.querySelector('[aria-label="Quick travel"]')).toBeNull();
    expect(host.querySelector('[aria-label="Village map"]')).toBeNull();
    expect(host.querySelector('[aria-label="Look around this place"]')).toBeNull();
    expect(host.querySelector('[aria-label="Journey map"]')).toBeNull();
    expect(host.querySelector('[aria-label="Arrange room"]')).toBeNull();
    expect(host.querySelector('[aria-label="Village destinations"]')).toBeNull();
    expect(host.querySelector(".village-tools")).toBeNull();
    expect(host.textContent).not.toMatch(/Beyond the village|Quick travel|Village map/);
    // The accessible names start with the visible words.
    expect(flip().querySelector(".glass-bubble__label")!.textContent).toContain("Simple view");
    expect(host.querySelector("[data-glass-tools]")!.getAttribute("aria-label")).toBe("All tools and search");
    expect(host.querySelector("button.fab")!.getAttribute("aria-label")).toBe("Record");
    // The address card is glass.
    expect(host.querySelector(".village-address[data-glass-card]")).not.toBeNull();
  });

  it("leaves out Record and All tools when the App gives neither", async () => {
    await act(async () => root.render(hud({ fab: undefined, onQuickSheet: undefined })));
    expect(bubbles()).toEqual(["flip"]);
  });

  it("puts the integrator's map, strip and card between Simple view and All tools", async () => {
    await act(async () => root.render(hud({ glassBetween: createElement("button", { type: "button", "data-test-map": "" }, "The Horizon, September") })));
    const order = [...host.querySelectorAll<HTMLElement>("[data-glass-bubble], [data-test-map]")].map((node) => node.dataset.glassBubble ?? "map");
    expect(order).toEqual(["flip", "map", "tools", "record"]);
  });

  it("opens All tools, and reaches a money verb in two presses from Record", async () => {
    const log: string[] = [];
    await act(async () => root.render(hud({ fab: fab(log), onQuickSheet: () => log.push("sheet") })));
    await act(async () => host.querySelector<HTMLButtonElement>("[data-glass-tools]")!.click());
    expect(log).toEqual(["sheet"]);
    await act(async () => host.querySelector<HTMLButtonElement>("button.fab")!.click());
    const verbs = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action] .record-dial__label")].map((b) => b.textContent);
    // No onBillPaid in this fixture, so Bill paid stays hidden (the App wires it through GlassFab.onBillPaid).
    expect(verbs).toEqual(["Purchase", "Shift", "Income", "Move money"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-fab-action="income"]')!.click());
    // Record forwards the dial's open state (it shuts while an Add sheet is open), so the App hears it open and close.
    expect(log).toEqual(["sheet", "open:true", "open:false", "pick:income"]);
  });

  it("reads Island on the Desk", async () => {
    window.localStorage.setItem(MOTION_KEY, "flat");
    await act(async () => root.render(hud({ flat: true, onAvatar: undefined })));
    expect(flip().querySelector(".glass-bubble__label")!.textContent).toContain("Island");
    expect(flip().dataset.glassFlip).toBe("desk");
    // On the Desk the three stand as the flat bar: [Island] [Record] [All tools], Record centred.
    expect([...host.querySelectorAll<HTMLElement>('[data-harbour-bar="island"] [data-glass-bubble]')].map((node) => node.dataset.glassBubble)).toEqual(["flip", "record", "tools"]);
    expect(host.querySelector(".village-address")).toBeNull();
  });

  it("makes the App's door edition step aside while it stands, so there is one set", async () => {
    const both = (island: boolean) => createElement("div", null, createElement(Compass, { fab: fab(), onQuickSheet: () => undefined }), island ? hud() : null);
    await act(async () => root.render(both(true)));
    expect(host.querySelectorAll('nav[aria-label="Harbour bar"]').length).toBe(0);
    expect(host.querySelectorAll("button.fab").length).toBe(1);
    expect(host.querySelectorAll("[data-glass-flip]").length).toBe(1);
    // A tool opens in front (or the Journey): the island's glass leaves, the door edition carries the same three.
    await act(async () => root.render(both(false)));
    const door = host.querySelector<HTMLElement>('[data-harbour-bar="door"]')!;
    expect(door).not.toBeNull();
    expect([...door.querySelectorAll<HTMLElement>("[data-glass-bubble]")].map((node) => node.dataset.glassBubble)).toEqual(["flip", "record", "tools"]);
    expect(host.querySelectorAll("button.fab").length).toBe(1);
  });
});

describe("the Simple-view flip", () => {
  it("writes hearth:motion and raises the event, one tap each way, its name equal to its label", async () => {
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener(MOTION_KEY, listen);
    try {
      await act(async () => root.render(hud()));
      expect(flip().querySelector(".glass-bubble__label")!.textContent).toBe("Simple view");
      await act(async () => flip().click());
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("flat");
      expect(heard).toEqual(["flat"]);
      expect(flip().querySelector(".glass-bubble__label")!.textContent).toBe("Island");
      await act(async () => flip().click());
      // Exactly what the sheet's switch writes for the illustrated edition.
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("");
      expect(heard).toEqual(["flat", "illustrated"]);
      expect(flip().querySelector(".glass-bubble__label")!.textContent).toBe("Simple view");
    } finally { window.removeEventListener(MOTION_KEY, listen); }
  });

  it("follows an edition chosen elsewhere (the sheet, the backtick)", async () => {
    await act(async () => root.render(hud()));
    await act(async () => { flipMotionEdition(); });
    expect(flip().querySelector(".glass-bubble__label")!.textContent).toBe("Island");
    expect(readMotionEdition()).toBe("flat");
  });
});

function KeyHost({ enabled }: { enabled: boolean }) { useEditionFlipKey(enabled); return createElement("div", null, createElement("input", { "aria-label": "Amount" }), createElement("textarea", { "aria-label": "Note" }), createElement("div", { contentEditable: true, "aria-label": "Editable", suppressContentEditableWarning: true }), createElement("div", { role: "dialog", "aria-modal": "true" }, createElement("button", { type: "button" }, "In a dialog")), createElement("button", { type: "button" }, "Plain")); }

const press = (target: EventTarget, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key: EDITION_FLIP_KEY, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe("the backtick flip key", () => {
  it("toggles the edition from anywhere that is not typing", async () => {
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener(MOTION_KEY, listen);
    try {
      await act(async () => root.render(createElement(KeyHost, { enabled: true })));
      const plain = [...host.querySelectorAll("button")].find((b) => b.textContent === "Plain")!;
      plain.focus();
      await act(async () => { press(plain); });
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("flat");
      await act(async () => { press(document.body); });
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("");
      expect(heard).toEqual(["flat", "illustrated"]);
    } finally { window.removeEventListener(MOTION_KEY, listen); }
  });

  it("is ignored while typing in an input, a textarea or contenteditable, and inside a modal dialog", async () => {
    await act(async () => root.render(createElement(KeyHost, { enabled: true })));
    const input = host.querySelector<HTMLInputElement>("input")!;
    input.focus();
    const typed = press(input);
    expect(typed.defaultPrevented).toBe(false);
    press(host.querySelector("textarea")!);
    press(host.querySelector('[aria-label="Editable"]')!);
    const inDialog = [...host.querySelectorAll("button")].find((b) => b.textContent === "In a dialog")!;
    inDialog.focus();
    press(inDialog);
    expect(window.localStorage.getItem(MOTION_KEY)).toBeNull();
  });

  it("never binds Tab, needs no modifier and does nothing when disabled", async () => {
    await act(async () => root.render(createElement(KeyHost, { enabled: false })));
    press(document.body);
    expect(window.localStorage.getItem(MOTION_KEY)).toBeNull();
    const base = { key: EDITION_FLIP_KEY, ctrlKey: false, metaKey: false, altKey: false, repeat: false, isComposing: false, defaultPrevented: false, target: document.body };
    expect(editionKeyShouldFlip(base)).toBe(true);
    expect(editionKeyShouldFlip({ ...base, key: "Tab" })).toBe(false);
    expect(editionKeyShouldFlip({ ...base, ctrlKey: true })).toBe(false);
    expect(editionKeyShouldFlip({ ...base, metaKey: true })).toBe(false);
    expect(editionKeyShouldFlip({ ...base, repeat: true })).toBe(false);
    expect(editionKeyShouldFlip({ ...base, isComposing: true })).toBe(false);
  });
});

describe("the seams that carry the bar", () => {
  it("threads the App's + and All tools through the harbour to the island's bar, and owns the backtick", () => {
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const shell = readFileSync(join(process.cwd(), "src", "harbour", "HarbourWorld.tsx"), "utf8");
    // The same FabSpeedDial wiring on both editions of the bar; none while the charter takes over.
    // Five verbs (Shift only with a job), Bill paid wired, and every verb opens in its D1 ledger (openRecordFlow).
    expect(app).toMatch(/const harbourBarFab: CompassFab = \{closed:adding,actions:fabActionsFor\(view,\{memberHasJob\}\),closedLabel:fabClosedLabel\(view\),onOpenChange:setFabOpen,onPick:\(nextMode\)=>openRecordFlow\(nextMode\),onBillPaid:\(\)=>openRecordFlow\("bill"\)\}/);
    expect(app).toMatch(/onQuickSheet=\{\(\)=>setQuickSheetOpen\(true\)\} fab=\{charterTakeoverVisible\?undefined:harbourBarFab\}\/><\/Suspense>/);
    // One glass chrome for both spaces (D2).
    expect(app).toMatch(/HARBOUR_ENABLED\?<><Compass fab=\{harbourBarFab\}/);
    // The district row is gone from the App.
    expect(app).not.toMatch(/<Compass[^>]*(?:onHome|onStudy|onKitchen|onMaking|onTogether)=/);
    // S5: the backtick flips in personal scope too (its Desk), still behind the harbour gate.
    expect(app).toMatch(/useEditionFlipKey\(HARBOUR_ENABLED && Boolean\(household && session\)\)/);
    expect(shell).toMatch(/<VillageHUD[^\n]*fab=\{props\.fab\} onQuickSheet=\{onQuickSheet\}/);
  });
});
