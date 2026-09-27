// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNightHour } from "../src/harbour/bubbles/glassMode.ts";
import { HarbourTwins } from "../src/harbour/court/CourtTwins.tsx";
import { createFrameBudgetWatch, FRAME_BUDGET_MS } from "../src/harbour/scene/framePolicy.ts";
import { ComfortControls } from "../src/theme/ComfortControls.tsx";
import { DEFAULT_COMFORT, parseComfort, readComfort } from "../src/theme/comfort.ts";
import { HostPanel } from "../src/harbour/panels/HostPanel.tsx";
import { publishBarBadges, NO_BAR_BADGES } from "../src/harbour/nav/barBadges.ts";

/**
 * Wave 2b's glass wiring (Tool Atlas brief §4.2, §4.3, §4.4, A9, A10, A11):
 * the frame-budget watch, the night clock, "Always show labels", and the
 * Hercules pawprint on his twin and his panel. Fictional household.
 */
const src = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); window.localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); publishBarBadges(NO_BAR_BADGES); window.localStorage.clear(); });

describe("the frame budget (§4.3)", () => {
  it("latches solid only after a whole second of missed frames, and a place change resets it", () => {
    const watch = createFrameBudgetWatch("full");
    let now = 0;
    // On budget at 60 fps: never over.
    for (let i = 0; i < 120; i += 1) { now += FRAME_BUDGET_MS.full; expect(watch.paint(now)).toBe(false); }
    // 30 ms frames on the full tier miss the 60 fps target; half a second is not enough.
    for (let i = 0; i < 16; i += 1) { now += 30; expect(watch.paint(now)).toBe(false); }
    expect(watch.over()).toBe(false);
    let flipped = false;
    for (let i = 0; i < 30 && !flipped; i += 1) { now += 30; flipped = watch.paint(now); }
    expect(flipped).toBe(true);
    expect(watch.over()).toBe(true);
    expect(watch.reset()).toBe(true);
    expect(watch.over()).toBe(false);
  });

  it("never counts the scene resting (render on demand) as a miss", () => {
    const watch = createFrameBudgetWatch("lite");
    let now = 0;
    for (let i = 0; i < 20; i += 1) { now += 900; expect(watch.paint(now)).toBe(false); }
    for (let i = 0; i < 60; i += 1) { now += FRAME_BUDGET_MS.lite; watch.paint(now); }
    expect(watch.over()).toBe(false);
  });

  it("the runtime reports camera motion and the budget, and HarbourWorld hands both (and night) to the glass and the dock", () => {
    const runtime = src("src/harbour/scene/runtime.ts");
    expect(runtime).toMatch(/onGlass\?:\(signal:\{cameraMoving:boolean;frameOverBudget:boolean\}\)=>void/);
    expect(runtime).toMatch(/if \(moving !== cameraMovingNow\) \{ cameraMovingNow = moving; glassSignal\(\); \}/);
    expect(runtime).toMatch(/if\(frameBudget\.reset\(\)\)glassSignal\(\);/);
    const world = src("src/harbour/HarbourWorld.tsx");
    expect(world).toMatch(/onGlass:setGlassScene/);
    expect(world).toMatch(/<VillageHUD[^>]*frameOverBudget=\{glassScene\.frameOverBudget\} cameraMoving=\{glassScene\.cameraMoving\} night=\{glassNight\} alwaysShowLabels=\{comfort\.labels\}/);
    expect(world).toMatch(/<Dock[^>]*lite=\{tier === "lite" \|\| glassScene\.frameOverBudget\} night=\{glassNight\} cameraMoving=\{glassScene\.cameraMoving\}/);
    expect(src("src/harbour/glass/glass.css")).toMatch(/\.glass-dock\[data-camera-moving\] \.glass-dock__glass[^{]*\{ -webkit-backdrop-filter: none; backdrop-filter: none; \}/);
  });
});

describe("night, from the device clock (§4.4)", () => {
  it("is 20:00 to 06:00", () => {
    expect([19, 20, 23, 0, 5, 6, 12].map(isNightHour)).toEqual([false, true, true, true, true, false, false]);
  });
});

describe("Always show labels (A11)", () => {
  it("is a per-device Comfort choice, off by default, beside its siblings", async () => {
    expect(DEFAULT_COMFORT.labels).toBe(false);
    expect(parseComfort({ labels: true }).labels).toBe(true);
    await act(async () => root.render(createElement(ComfortControls, { environment: "development" })));
    const toggle = host.querySelector<HTMLInputElement>("#comfort-labels")!;
    expect(toggle.closest("label")!.textContent).toMatch(/^Always show labels/);
    await act(async () => toggle.click());
    expect(readComfort("development").labels).toBe(true);
    expect(document.documentElement.dataset.labels).toBe("always");
  });

  it("reaches the island's glass, the flat bar and the door edition", () => {
    expect(src("src/harbour/HarbourEntry.tsx")).toMatch(/<GlassBar edition="desk"[^>]*alwaysShowLabels=\{comfort\.labels\}/);
    expect(src("src/App.tsx")).toMatch(/<Compass fab=\{harbourBarFab\}[^>]*alwaysShowLabels=\{comfort\.labels\}/);
  });
});

describe("the Hercules pawprint (§4.2)", () => {
  it("his twin wears it in words and as a mark", async () => {
    const rect = { id: "hercules", label: "Hercules", kind: "anchor", group: "court", x: 10, y: 10, w: 44, h: 44, visible: true } as never;
    await act(async () => root.render(createElement(HarbourTwins, { rects: [rect], badges: { hercules: "Hercules has a suggestion" }, onActivate: () => undefined })));
    const twin = host.querySelector<HTMLButtonElement>("[data-twin=hercules]")!;
    expect(twin.getAttribute("aria-label")).toBe("Hercules, Hercules has a suggestion");
    expect(twin.querySelector(".court-twins__badge svg")).toBeTruthy();
    await act(async () => root.render(createElement(HarbourTwins, { rects: [rect], onActivate: () => undefined })));
    expect(host.querySelector("[data-twin=hercules]")!.getAttribute("aria-label")).toBe("Hercules");
    expect(host.querySelector(".court-twins__badge")).toBeNull();
    expect(src("src/harbour/HarbourWorld.tsx")).toMatch(/<HarbourTwins rects=\{rects\} badges=\{herculesSuggestion\?HERCULES_PAW:undefined\}/);
  });

  it("his bubble says so when he has one", async () => {
    publishBarBadges({ scope: "household", everydayCents: null, suggestion: true });
    await act(async () => root.render(createElement(HostPanel, { host: "hercules", reading: null, onClose: () => undefined, onOpen: () => undefined })));
    expect(host.querySelector("[data-panel-suggestion]")?.textContent).toMatch(/He has a suggestion for you/);
    await act(async () => publishBarBadges(NO_BAR_BADGES));
    expect(host.querySelector("[data-panel-suggestion]")).toBeNull();
  });
});
