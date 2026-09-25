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
 * The one bar (Simple View Desk S1): the island's quick-travel bar carries
 * [Simple view] [⌖ Village map] [Quick travel…] [↗ Look around] [◇ Journey]
 * [+] [All tools], over the 3D harbour and the reading edition alike; the
 * flip and the backtick write the same `hearth:motion` switch the quick sheet does.
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

const barNames = () => [...host.querySelectorAll<HTMLElement>('nav[aria-label="Harbour bar"] > *')].map((node) => node.querySelector("select")?.getAttribute("aria-label") ?? node.getAttribute("aria-label"));

describe("the one bar over the harbour", () => {
  it("renders flip, map, quick travel, look, journey, + and All tools, flip at the left end", async () => {
    await act(async () => root.render(hud()));
    const bar = host.querySelector<HTMLElement>('nav[aria-label="Harbour bar"]')!;
    expect(bar).not.toBeNull();
    expect(bar.dataset.harbourBar).toBe("island");
    expect(barNames()).toEqual(["Switch to the simple view", "Village map", "Quick travel", "Look around this place", "Journey map", null, "All tools"]);
    // The unnamed child is the + dial; its button carries the name.
    expect(bar.children[5]!.classList.contains("fab-dial")).toBe(true);
    expect(bar.querySelector("button.fab")?.getAttribute("aria-label")).toBe(fabClosedLabel("household"));
    // No district row anywhere.
    expect(host.querySelector("[data-compass-district]")).toBeNull();
    // Every icon button has an accessible name.
    for (const button of bar.querySelectorAll("button:not([role=menuitem])")) expect(button.getAttribute("aria-label")).toBeTruthy();
  });

  it("keeps Arrange before the + when a room offers it, and leaves out + / All tools when the App gives neither", async () => {
    await act(async () => root.render(hud({ onArrange: () => undefined })));
    expect(barNames()).toEqual(["Switch to the simple view", "Village map", "Quick travel", "Look around this place", "Journey map", "Arrange room", null, "All tools"]);
    await act(async () => root.render(hud({ fab: undefined, onQuickSheet: undefined, onJourney: undefined })));
    expect(barNames()).toEqual(["Switch to the simple view", "Village map", "Quick travel", "Look around this place"]);
  });

  it("keeps map, quick travel, look around and journey working", async () => {
    const log: string[] = [];
    await act(async () => root.render(hud({ onVisit: (id: string, instant?: boolean) => log.push(`visit:${id}:${instant}`), onView: () => log.push("view"), onJourney: () => log.push("journey"), onQuickSheet: () => log.push("sheet") })));
    const button = (name: string) => host.querySelector<HTMLButtonElement>(`nav[aria-label="Harbour bar"] button[aria-label="${name}"]`)!;
    await act(async () => button("Village map").click());
    expect(host.querySelector('[aria-label="Village destinations"]')).not.toBeNull();
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Quick travel"]')!;
    await act(async () => { select.value = "cellar"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector('[aria-label="Village destinations"]')).toBeNull();
    await act(async () => button("Look around this place").click());
    await act(async () => button("Journey map").click());
    await act(async () => button("All tools").click());
    expect(log).toEqual(["visit:cellar:true", "view", "journey", "sheet"]);
  });

  it("reaches the Record verbs in two presses from the bar's Record", async () => {
    const log: string[] = [];
    await act(async () => root.render(hud({ fab: fab(log) })));
    await act(async () => host.querySelector<HTMLButtonElement>('nav[aria-label="Harbour bar"] button.fab')!.click());
    const verbs = [...host.querySelectorAll<HTMLButtonElement>("[data-fab-action] .record-dial__label")].map((b) => b.textContent);
    // Bill paid joins once the App wires `onBillPaid` through the bar (Tool Atlas integrator).
    expect(verbs).toEqual(["Purchase", "Shift", "Income", "Move money"]);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-fab-action="income"]')!.click());
    expect(log).toEqual(["open:true", "open:false", "pick:income"]);
  });

  it("stands in the reading edition too, with the flip reading Harbour", async () => {
    window.localStorage.setItem(MOTION_KEY, "flat");
    // The reading edition passes no wander and no character.
    await act(async () => root.render(hud({ onWander: undefined, onAvatar: undefined })));
    const flip = host.querySelector<HTMLButtonElement>(".edition-flip")!;
    expect(flip.getAttribute("aria-label")).toBe("Switch to the illustrated harbour");
    expect(flip.textContent).toContain("Harbour");
    expect(host.querySelector("button.fab")).not.toBeNull();
    expect(host.querySelector('button[aria-label="All tools"]')).not.toBeNull();
  });

  it("makes the App's door edition step aside while it stands, so there is one bar", async () => {
    const both = (island: boolean) => createElement("div", null, createElement(Compass, { fab: fab(), onQuickSheet: () => undefined }), island ? hud() : null);
    await act(async () => root.render(both(true)));
    expect(host.querySelectorAll('nav[aria-label="Harbour bar"]').length).toBe(1);
    expect(host.querySelector('[data-harbour-bar="island"]')).not.toBeNull();
    expect(host.querySelectorAll("button.fab").length).toBe(1);
    // A tool opens in front (or the Journey): the island's bar leaves, the door edition carries flip, + and All tools.
    await act(async () => root.render(both(false)));
    expect(host.querySelectorAll('nav[aria-label="Harbour bar"]').length).toBe(1);
    expect(host.querySelector('[data-harbour-bar="door"]')).not.toBeNull();
    expect(host.querySelectorAll("button.fab").length).toBe(1);
    expect(host.querySelector(".edition-flip")).not.toBeNull();
  });
});

describe("the Simple-view flip", () => {
  it("writes hearth:motion and raises the event in both directions, inverting its words", async () => {
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener(MOTION_KEY, listen);
    try {
      await act(async () => root.render(hud()));
      const flip = () => host.querySelector<HTMLButtonElement>(".edition-flip")!;
      expect(flip().textContent).toContain("Simple view");
      await act(async () => flip().click());
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("flat");
      expect(heard).toEqual(["flat"]);
      expect(flip().getAttribute("aria-label")).toBe("Switch to the illustrated harbour");
      expect(flip().textContent).toContain("Harbour");
      await act(async () => flip().click());
      // Exactly what the quick sheet's switch writes for the illustrated edition.
      expect(window.localStorage.getItem(MOTION_KEY)).toBe("");
      expect(heard).toEqual(["flat", "illustrated"]);
      expect(flip().getAttribute("aria-label")).toBe("Switch to the simple view");
    } finally { window.removeEventListener(MOTION_KEY, listen); }
  });

  it("follows an edition chosen elsewhere (the quick sheet, the backtick)", async () => {
    await act(async () => root.render(hud()));
    await act(async () => { flipMotionEdition(); });
    expect(host.querySelector(".edition-flip")?.getAttribute("aria-label")).toBe("Switch to the illustrated harbour");
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
    expect(app).toMatch(/const harbourBarFab: CompassFab = \{closed:adding,actions:fabActionsFor\(view,tab\),closedLabel:fabClosedLabel\(view\),onOpenChange:setFabOpen,onPick:\(nextMode\)=>openAddFor\(null,nextMode\)/);
    expect(app).toMatch(/onQuickSheet=\{\(\)=>setQuickSheetOpen\(true\)\} fab=\{charterTakeoverVisible\?undefined:harbourBarFab\}\/><\/Suspense>/);
    expect(app).toMatch(/HARBOUR_ENABLED&&view==="household"\?<><Compass fab=\{harbourBarFab\}/);
    // The district row is gone from the App.
    expect(app).not.toMatch(/<Compass[^>]*(?:onHome|onStudy|onKitchen|onMaking|onTogether)=/);
    // S5: the backtick flips in personal scope too (its Desk), still behind the harbour gate.
    expect(app).toMatch(/useEditionFlipKey\(HARBOUR_ENABLED && Boolean\(household && session\)\)/);
    expect(shell).toMatch(/<VillageHUD[^\n]*fab=\{props\.fab\} onQuickSheet=\{onQuickSheet\}/);
  });
});
